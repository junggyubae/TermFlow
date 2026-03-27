"""
Voice Dictation Sidecar — Flask server on localhost:5001
Endpoints: /health, /transcribe, /polish
"""

import os
import sys
import json
import time
from flask import Flask, request, jsonify, Response, stream_with_context

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Whisper model — loaded at startup to hide latency
# ---------------------------------------------------------------------------
whisper_model = None


def load_whisper():
    global whisper_model
    from faster_whisper import WhisperModel

    model_size = os.environ.get("WHISPER_MODEL", "large-v3")
    print(f"Loading Whisper {model_size} (int8)...", flush=True)
    start = time.time()
    whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
    elapsed = time.time() - start
    print(f"Whisper loaded in {elapsed:.1f}s", flush=True)


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# /streaming-transcribe (partial, fast, for live feedback)
# ---------------------------------------------------------------------------
@app.route("/streaming-transcribe", methods=["POST"])
def streaming_transcribe():
    if whisper_model is None:
        return jsonify({"error": "Whisper model not loaded"}), 503

    data = request.get_json(force=True)
    wav_path = data.get("path")
    vocab = data.get("vocab", [])

    if not wav_path or not os.path.exists(wav_path):
        return jsonify({"error": f"File not found: {wav_path}"}), 400

    initial_prompt = ", ".join(vocab) if vocab else None

    # Fast transcription with beam_size=1 (faster, slightly less accurate)
    segments, info = whisper_model.transcribe(
        wav_path,
        language=None,
        vad_filter=False,  # VAD is slow for streaming
        beam_size=1,  # Fast
        initial_prompt=initial_prompt,
    )

    raw_text = " ".join(seg.text.strip() for seg in segments)

    return jsonify({
        "raw": raw_text,
        "language": info.language,
        "confidence": round(info.language_probability, 3),
    })


# ---------------------------------------------------------------------------
# /transcribe (final, accurate, full context)
# ---------------------------------------------------------------------------
@app.route("/transcribe", methods=["POST"])
def transcribe():
    if whisper_model is None:
        return jsonify({"error": "Whisper model not loaded"}), 503

    data = request.get_json(force=True)
    wav_path = data.get("path")
    vocab = data.get("vocab", [])

    if not wav_path or not os.path.exists(wav_path):
        return jsonify({"error": f"File not found: {wav_path}"}), 400

    # Vocabulary boost via initial_prompt — critical for Korean+English code-switching
    initial_prompt = ", ".join(vocab) if vocab else None

    # Use beam_size from request (1 for fast chunks, 5 for final)
    beam_size = data.get("beam_size", 5)

    segments, info = whisper_model.transcribe(
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
SYSTEM_PROMPT = """You are a transcript cleaner. You receive raw speech-to-text output and clean it up.

Rules:
- Output ONLY the cleaned transcript. Do not answer questions, explain, summarize, or add commentary.
- NEVER translate. Output in the SAME language mix as the input. If input is Korean with English terms, output must be Korean with English terms.
- NEVER output Chinese, Japanese, or any language not present in the input.
- Remove filler words: 음, 어, 그러니까 (when used as filler), 그래서 (when used as filler), um, uh, like, you know
- Fix punctuation and capitalization
- Correct Korean spacing (띄어쓰기)
- Insert paragraph breaks on natural topic shifts in longer dictations
- Preserve all English technical terms exactly as spoken — never translate them to Korean
- Preserve vocabulary terms exactly as written: {vocab_terms}
- The output should read like something the user would have typed themselves"""


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
                system=system,
                messages=[{"role": "user", "content": text}],
            ) as stream:
                for token in stream.text_stream:
                    yield f"data: {json.dumps({'token': token})}\n\n"
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
    load_whisper()
    print("Sidecar ready on http://localhost:5001", flush=True)
    app.run(threaded=True, port=5001, debug=False)
