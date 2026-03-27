"""
Voice Dictation Sidecar — Flask server on localhost:5001
Endpoints: /health, /transcribe, /polish
"""

import os
import sys
import json
import time
import re
from flask import Flask, request, jsonify, Response, stream_with_context

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Whisper models — loaded at startup to hide latency
# ---------------------------------------------------------------------------
whisper_models = {}


def load_whisper():
    global whisper_models
    from faster_whisper import WhisperModel

    final_model_size = os.environ.get("WHISPER_MODEL_FINAL", os.environ.get("WHISPER_MODEL", "large-v3"))
    partial_model_size = os.environ.get("WHISPER_MODEL_PARTIAL", "tiny")

    for model_size in {final_model_size, partial_model_size}:
        print(f"Loading Whisper {model_size} (int8)...", flush=True)
        start = time.time()
        whisper_models[model_size] = WhisperModel(model_size, device="cpu", compute_type="int8")
        elapsed = time.time() - start
        print(f"Whisper {model_size} loaded in {elapsed:.1f}s", flush=True)


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# /transcribe
# ---------------------------------------------------------------------------
@app.route("/transcribe", methods=["POST"])
def transcribe():
    if not whisper_models:
        return jsonify({"error": "Whisper model not loaded"}), 503

    data = request.get_json(force=True)
    wav_path = data.get("path")
    vocab = data.get("vocab", [])

    if not wav_path or not os.path.exists(wav_path):
        return jsonify({"error": f"File not found: {wav_path}"}), 400

    # Vocabulary boost via initial_prompt — critical for Korean+English code-switching
    initial_prompt = ", ".join(vocab) if vocab else None

    # Allow explicit model override per request.
    model_size = data.get("model_size")
    if not model_size:
        model_size = "tiny" if data.get("is_partial") else os.environ.get("WHISPER_MODEL_FINAL", os.environ.get("WHISPER_MODEL", "large-v3"))
    model = whisper_models.get(model_size)
    if model is None:
        return jsonify({"error": f"Requested model not loaded: {model_size}"}), 400

    # Use beam_size from request (1 for fast chunks, 5 for final)
    beam_size = data.get("beam_size", 5)

    segments, info = model.transcribe(
        wav_path,
        language=None,
        vad_filter=True,
        beam_size=beam_size,
        initial_prompt=initial_prompt,
    )

    raw_text = " ".join(seg.text.strip() for seg in segments)

    # Language detection
    lang = info.language
    confidence = info.language_probability
    if confidence < 0.85:
        lang = "mixed"

    return jsonify({
        "raw": raw_text,
        "language": lang,
        "confidence": round(confidence, 3),
    })


# ---------------------------------------------------------------------------
# /polish — Claude Haiku SSE streaming
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a transcript cleaner.
You are NOT a chatbot and you are NOT in a conversation.
The user's message always contains raw transcript text to clean.

Rules:
- Output ONLY the cleaned transcript. Do not answer questions, explain, summarize, or add commentary.
- Never ask for more input.
- Never say things like "please provide..." or "I'm ready...".
- NEVER translate. Output in the SAME language mix as the input. If input is Korean with English terms, output must be Korean with English terms.
- NEVER output Chinese, Japanese, or any language not present in the input.
- Remove filler words: 음, 어, 그러니까 (when used as filler), 그래서 (when used as filler), um, uh, like, you know
- Fix punctuation and capitalization
- Correct Korean spacing (띄어쓰기)
- Insert paragraph breaks on natural topic shifts in longer dictations
- Preserve all English technical terms exactly as spoken — never translate them to Korean
- Preserve vocabulary terms exactly as written: {vocab_terms}
- The output should read like something the user would have typed themselves"""


def deterministic_clean(text: str) -> str:
    """Fallback cleaner used when model output is clearly non-transcript/meta."""
    if not text:
        return ""

    cleaned = text.strip()

    # Remove common filler words in English/Korean (word-boundary aware).
    filler_pattern = re.compile(
        r"\b(um+|uh+|like|you know)\b|(?<!\S)(음|어|그러니까|그니까|그래서)(?!\S)",
        flags=re.IGNORECASE,
    )
    cleaned = filler_pattern.sub(" ", cleaned)

    # Normalize whitespace and punctuation spacing.
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = re.sub(r"\s+([,.!?;:])", r"\1", cleaned)

    # Light English capitalization if sentence starts with ASCII letter.
    if cleaned and "a" <= cleaned[0].lower() <= "z":
        cleaned = cleaned[0].upper() + cleaned[1:]

    return cleaned


def is_meta_assistant_reply(text: str) -> bool:
    lowered = (text or "").strip().lower()
    if not lowered:
        return True
    bad_markers = [
        "i'm ready to clean transcripts",
        "please provide the raw speech-to-text output",
        "please provide",
        "i can help clean",
        "as an ai",
        "transcript cleaner",
        "share the transcript",
        "not a creative writer",
        "i only clean",
    ]
    return any(marker in lowered for marker in bad_markers)


def contains_meta_line(text: str) -> bool:
    lowered = (text or "").lower()
    meta_patterns = [
        r"\bi(?:'| a)?m\s+(ready|a transcript cleaner)\b",
        r"\bplease\s+(provide|share)\b",
        r"\bi only clean\b",
        r"\bnot a creative writer\b",
        r"\bas an ai\b",
    ]
    return any(re.search(p, lowered) for p in meta_patterns)


def is_grounded_in_input(raw_text: str, candidate: str) -> bool:
    """Basic grounding check: candidate should substantially overlap input tokens."""
    if not raw_text or not candidate:
        return False

    input_tokens = re.findall(r"[A-Za-z0-9_]+|[가-힣]+", raw_text.lower())
    output_tokens = re.findall(r"[A-Za-z0-9_]+|[가-힣]+", candidate.lower())
    if not input_tokens or not output_tokens:
        return False

    input_set = set(input_tokens)
    overlap = sum(1 for t in output_tokens if t in input_set)
    overlap_ratio = overlap / max(1, len(output_tokens))

    # Cleaned text should mostly be built from input tokens.
    return overlap_ratio >= 0.45


@app.route("/polish", methods=["POST"])
def polish():
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({"error": "ANTHROPIC_API_KEY not set"}), 401

    data = request.get_json(force=True)
    text = data.get("text", "")
    vocab = data.get("vocab", [])

    if not text.strip():
        return jsonify({"error": "Empty text"}), 400

    vocab_str = ", ".join(vocab) if vocab else "(none)"
    system = SYSTEM_PROMPT.replace("{vocab_terms}", vocab_str)

    client = anthropic.Anthropic(api_key=api_key)

    def generate():
        try:
            with client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                temperature=0,
                system=system,
                messages=[{
                    "role": "user",
                    "content": f"<raw_transcript>\n{text}\n</raw_transcript>",
                }],
            ) as stream:
                model_output = ""
                for token in stream.text_stream:
                    model_output += token

            final_output = model_output.strip()
            # Hard safety: never allow assistant/meta content in final output.
            if (
                is_meta_assistant_reply(final_output)
                or contains_meta_line(final_output)
                or not is_grounded_in_input(text, final_output)
            ):
                final_output = deterministic_clean(text)
            else:
                # Remove any stray meta lines if model mixed good text + bad text.
                kept_lines = []
                for line in final_output.splitlines():
                    if contains_meta_line(line):
                        continue
                    kept_lines.append(line)
                final_output = "\n".join(kept_lines).strip()
                if not final_output:
                    final_output = deterministic_clean(text)

            # Keep SSE contract while guaranteeing transcript output.
            if final_output:
                yield f"data: {json.dumps({'token': final_output})}\n\n"
            yield "data: [DONE]\n\n"
        except anthropic.AuthenticationError:
            yield f"data: {json.dumps({'error': 'API_KEY_INVALID'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import threading
    threading.Thread(target=load_whisper, daemon=True).start()
    print("Sidecar ready on http://localhost:5001", flush=True)
    app.run(threaded=True, port=5001, debug=False)
