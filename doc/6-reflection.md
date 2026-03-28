# Reflection

---

## Process Learnings

- **Planning documents prevented thrashing** — Spent the first day writing detailed planning docs (1-product.md, 2-decision.md, 3-plan.md, 4-build.md). Never felt lost during implementation. Breaking the project into 4 phases with clear acceptance criteria let me build module-by-module without second-guessing. Would 100% do this again.

- **Validation testing informed decisions early** — Before starting Phase 0, ran experiments comparing Qwen2.5 (local) vs. Claude Haiku (API) on code-switching accuracy. Qwen2.5 silently dropped English terms in Korean sentences; Claude was 95%+ correct. This pivot happened at planning time, not mid-implementation. Saved hours of potential rework.

- **How you frame tasks to Claude matters** — The 3-plan.md file was a shared reference point. Instead of asking Claude "build the whole app," I'd say "implement Phase 1 according to section 2.3 of the plan." Specific task framing + reference docs = faster iteration and fewer misunderstandings. Claude is sensitive to context and scope clarity.

---

## Would Do Differently

- **First-time use of Claude Code & Skills**  
  This was my first project using Claude Code as the primary environment and Claude Skills for structured planning/review. It showed how powerful Skills can be when used intentionally. Next time, I’d use them more deliberately: run the plan skill at the start of *each phase* (not just once), and treat the review skill as a **pre-implementation checkpoint**, not a post-hoc step.

- **Prioritize the core loop before UI**  
  I built vocab/history panels early for demo completeness. In hindsight, it’s better to first get the full pipeline working (record → transcribe → polish), validate it end-to-end, and *then* layer UI. This would have surfaced bugs much earlier.

- **Set up logging from day one**  
  I should have added file logging at the start. I missed capturing useful links and debugging context. Next time, I’ll log key references early to avoid losing valuable information.

---

## Technical Learnings

- **Whisper vocabulary biasing — prompt engineering matters hugely** — Initially I thought `initial_prompt` parameter was just a soft hint. Testing revealed it's extremely sensitive: how you frame the vocabulary changes transcription dramatically. Example: for Korean-English code-switching, passing `initial_prompt="Django, Kubernetes, FastAPI"` increases correct technical term recognition from ~60% to 95%. The mechanics: Whisper uses the prompt as *prior context* for decoding, not as instructions. It biases the token probabilities statistically. Lesson: can't just dump random terms; they need to be words already in Whisper's training vocabulary, and they work best when contextually grouped (e.g., all DevOps terms together, not random nouns).

- **Partial transcription — monotonicity is critical** — Showing live text while recording required polling every 150ms: (1) snapshot the latest raw audio chunk, (2) convert to WAV with `afconvert`, (3) send to `/transcribe?is_partial=true`, (4) display only if different from last result. Subprocess overhead of calling `afconvert` 6-7 times/second felt wasteful but it worked. Real insight: partial results *must be monotonic* — text should only grow, never shrink. If partial tokens contradict, the UI feels broken and users distrust the output.

- **Live transcription model — tiny wins on feel, not accuracy** — For partial (live) transcription, chose `whisper tiny` over larger models. The tradeoff is clear: `tiny` is fast enough to keep up with speech in real time, making the UI feel genuinely live. `base` or `small` produce better RAW text but introduce enough latency that the live effect breaks. On a machine with more headroom, upgrading to `base` or `small` is worth trying — but on a standard Mac, `tiny` is the right call to preserve the "live transcription" feel.

---