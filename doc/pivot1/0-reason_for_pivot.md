# Pivot 1: Qwen2.5 → Claude Haiku

**Date:** March 26, 2026
**Decision:** Switch LLM polish layer from Qwen2.5 7B (local) to Claude Haiku (cloud) as primary.

---

## Why We Pivoted

### Validation Testing Failed

We ran 20 bilingual (Korean/English) utterances through Qwen2.5 7B via Ollama with an explicit system prompt:
- "Never translate"
- "Never answer questions"
- "Output in same language as input"

**Result: 7/20 passed (35%) — far below the 95% threshold.**

### Three Critical Failure Modes

**1. Chinese contamination (9/20 utterances)**
Qwen2.5 confused Korean with Chinese and output Chinese characters mid-sentence:
```
Input:  "cardiovascular disease에서 hypertension이..."
Output: "心血管疾病에서高血压会对动脉粥样硬化..."
```

**2. English terms translated to Korean phonetics (4/20)**
Instead of preserving "impedance matching", model output "임피던스 매칭" (Korean phonetic transliteration):
```
Input:  "impedance matching이 RF circuit에서..."
Output: "임피던스 매칭은 RF 회로에서..."
```

**3. Meta-confusion (2/20)**
Model output its own internal reasoning in Chinese:
```
Output: "请使用英文回复" (meaning "please reply in English")
```

### Qwen2.5 14B Not Tested

We attempted to pull Qwen2.5 14B (~8.7 GB) as a potential fix, but the download failed/was killed. Given the fundamental nature of the Chinese contamination issue (rooted in Qwen2.5's training data), even 14B is unlikely to fully resolve it.

### SSE Streaming Worked (Partially)

Test 2 (SSE streaming) confirmed tokens arrive incrementally from Ollama — the streaming architecture is sound. However, first-token latency was 5.35s (cold start). This would improve on warm requests but remains a concern.

---

## What Changed

| Aspect | Before (pivot1/) | After |
|--------|-------------------|-------|
| **Primary LLM** | Qwen2.5 7B via Ollama (local) | Claude Haiku via API (cloud) |
| **Fallback LLM** | Claude Haiku (cloud) | Qwen2.5 7B (offline mode only) |
| **Privacy model** | Fully local | Cloud by default, local offline option |
| **Cost** | Free | ~$0.001/transcript |
| **API key** | Not required | Required (stored in macOS Keychain via keytar) |
| **Internet** | Not required | Required for polish (transcription still local) |
| **SSE delivery** | Ollama streaming | Claude API streaming |

---

## Rationale

1. **Korean quality is non-negotiable.** The app targets bilingual Korean/English users. If the polish layer mangles Korean or injects Chinese, the product is unusable.
2. **Claude Haiku handles Korean natively.** No Chinese contamination, reliable term preservation, precise instruction following.
3. **Privacy is addressed through transparency.** Onboarding discloses that transcripts go to Anthropic for polishing. Users who need offline mode can switch to Qwen2.5 in settings (with quality trade-off warning).
4. **Cost is negligible.** At ~$0.001/transcript, even heavy use costs <$1/month.
5. **Whisper transcription remains fully local.** Audio never leaves the machine. Only the text transcript is sent for polishing.

---

## Files Preserved

This `pivot1/` directory contains the complete pre-pivot documentation:
- `1-product.md` — Product definition
- `2-decision.md` — Architecture decisions (Qwen2.5 as primary)
- `3-plan.md` — Technical plan (Ollama-based polish)
- `4-build.md` — Build steps (Ollama-based polish)
- `5-stretch.md` — Stretch goals
- `6-validation.md` — Validation protocol (Qwen2.5 + SSE tests)
- `log/` — Project logs from red team review
