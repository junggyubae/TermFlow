# Implementation Log Index

This folder contains timestamped development logs, validation results, and architectural reviews.

---

## Implementation Memos

### 001-red-team-review-planning.md
**Date:** Mar 26, 19:45 EST
**Author:** Red Team (Senior Architect)
**Purpose:** Pre-implementation review of product plan and technical architecture
**Key Content:**
- Architecture overview approval
- Critical assumptions identified
- Risk assessment and mitigation strategies
- Red team verdict: 🟡 CAUTION — Proceed with required prototypes

**Why read this:** Understand what risks the team identified before building.

---

### 002-planning-validation-checkpoint.md
**Date:** Mar 26, 17:19 EST
**Purpose:** Checkpoint validation that all prerequisites are available before Phase 1
**Key Content:**
- ✓ API keys obtained
- ✓ Whisper tested and working
- ✓ Keytar (Keychain integration) verified
- Quick checklist of setup completion

**Why read this:** Proof that environment was ready before development started.

---

### 003-phase0-implementation-progress.md
**Date:** Mar 26, 17:30 EST
**Purpose:** Daily progress log during core implementation (Phases 0)
**Key Content:**
- Sidecar build progress (Flask endpoints)
- Swift binary compilation
- Electron main process scaffolding
- Integration milestones
- Blockers encountered and resolved

**Why read this:** See how Phase 0 (core functionality) was actually built.

---

### 004-red-team-review-post-pivot.md
**Date:** Mar 26, 19:50 EST
**Author:** Senior Architect (Red Team)
**Purpose:** Architecture review after Qwen2.5 → Claude Haiku pivot decision
**Key Content:**
- ✅ Pivot decision well-reasoned
- ⚠️ Flask threading concern (health polling vs. SSE streaming)
- ⚠️ API key security (env vars vs. Keychain)
- 📋 Gaps identified (IPC channels for settings modal, vocab passing)
- 🎯 Pre-Phase-1 fixes recommended

**Why read this:** Understand the pivot rationale and what engineering adjustments were made.

---

## Validation & Testing

### validation_test.md
**Date:** Mar 26, 20:00 EST
**Purpose:** Qwen2.5 local model validation test protocol
**Key Content:**
- 20 test utterances (engineering, medical, CS, general domains)
- Test categories: Korean-only, English-only, mixed code-switching
- Expected accuracy targets
- Scoring methodology

**Why read this:** Understand the validation approach used for both Qwen2.5 and (later) Claude Haiku.

---

### validation-results.md
**Date:** Mar 26, 17:19 EST
**Purpose:** Results of Qwen2.5 local model validation (the test run that led to the pivot)
**Key Content:**
- ❌ Qwen2.5 accuracy: **35%** on code-switching preservation
- Specific failure modes:
  - Chinese character contamination (garbled output)
  - English term translation to Korean phonetics
  - Meta-confusion (asked questions instead of cleaning)
- 🎯 Decision: Switch to Claude Haiku (API)
- Cost/privacy tradeoff analysis

**Why read this:** Understand why the pivot from Qwen2.5 to Claude Haiku happened.

---

## How to Navigate This Log

**If you want to understand:**
- **The planning process** → Read 001, 002 (pre-build validation)
- **The pivot decision** → Read validation-results.md, then 004 (post-pivot review)
- **Implementation details** → Read 003 (phase progress)
- **The full timeline** → Read in order: 001 → 002 → 003 → validation process → 004

**Quick Summary Timeline:**
```
Mar 26, 19:45 ← 001: Initial architecture review (caution, proceed with care)
Mar 26, 17:19 ← 002: Setup validation (all prerequisites ready)
Mar 26, 17:30 ← 003: Phase 0 implementation starts
Mar 26, 17:19 ← validation-results.md: Qwen2.5 test fails at 35%
Mar 26, 19:50 ← 004: Post-pivot review (Claude Haiku chosen, implementation proceeds)
Mar 27, 02:47 ← Phase 0 complete, Phase 1 in progress
```

---

## Key Insights from Logs

### What Worked Well
✓ Planning-first approach caught issues before they became code
✓ Red team reviews prevented costly rewrites
✓ Validation testing (despite failure) provided clear evidence for pivot decision
✓ Modular architecture (sidecar/main/renderer) enabled parallel work

### What Was Challenging
⚠️ Flask's synchronous nature vs. SSE streaming (mitigated with `threaded=True`)
⚠️ IPC contract complexity (many channels to coordinate)
⚠️ API key management across process boundaries (Keychain → main → sidecar)
⚠️ Testing code-switching without production data (limited to 20 utterances)

### Lessons Learned
1. **Validation early saves time** — Testing Qwen2.5 early revealed it couldn't handle the task. Switching to Claude Haiku was cheaper than 10+ hours of debugging a broken pipeline.
2. **Red team reviews catch architecture issues** — Issues like Flask blocking and IPC gaps were caught by review, not discovered mid-implementation.
3. **Privacy/security is a real tradeoff** — Switched from "everything local" (Qwen2.5) to "audio local, text to Claude" (current). Both have tradeoffs. Current choice justified by accuracy + cost.
4. **Streaming UX matters** — SSE streaming makes the 300ms Claude response feel fast by showing text incrementally.
