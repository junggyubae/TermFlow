# Pivot Documentation: Qwen2.5 → Claude Haiku

This folder contains the **complete pre-pivot planning** (the original plan to use Qwen2.5 7B locally) and the **detailed evidence** showing why the pivot was necessary.

---

## The Pivot Decision

**When:** March 26, 2026
**What:** Switched LLM polish layer from Qwen2.5 7B (local, via Ollama) to Claude Haiku (API)
**Why:** Validation testing revealed Qwen2.5 failed at 35% accuracy on Korean/English code-switching
**Impact:** Architecture changed from "fully local" to "audio local, text-to-cloud"

---

## Key Files

### reason.md (START HERE)
**Purpose:** The pivot decision document — explains what went wrong, why we changed, and the tradeoffs

**What it covers:**
- Validation testing results: 7/20 passed (35% ❌)
- Three critical failure modes:
  1. Chinese character contamination (garbled output)
  2. English terms translated to Korean phonetics (loses technical meaning)
  3. Meta-confusion (model outputs internal reasoning)
- Cost/benefit analysis of switching to Claude Haiku
- Privacy implications of the change
- Rationale for the decision

**Read this first if:** You want to understand why the architecture changed midway through planning.

---

## Pre-Pivot Planning Documents

These files represent the **original plan** (before the pivot). They are preserved for reference and show the decision-making process.

### 1-product.md
Original product definition (same problem/user, but with Ollama as primary polish layer)

### 2-decision.md
Original architecture decisions — favored local Qwen2.5 over cloud APIs for privacy

### 3-plan.md
Original technical plan with Ollama server instead of Claude API

### 4-build.md
Original build steps (Ollama setup, Ollama endpoints, Ollama streaming)

### 5-stretch.md
Original stretch goals (same as final version — these didn't change)

### 6-validation.md
Validation testing protocol — describes the 20-utterance test that revealed Qwen2.5's failure

---

## Pre-Pivot Logs

**Location:** `pivot1/log/`

Similar structure to `doc/log/`, but from before the pivot decision:
- Pre-development reviews
- Setup validation
- Progress notes from early phase work
- Validation test results that prompted the pivot

---

## How This Folder Relates to Final Submission

| Item | Location | Status |
|------|----------|--------|
| **Final planning (Claude Haiku)** | `doc/1-5.md` | Current architecture |
| **Pivot evidence** | `doc/pivot1/reason.md` | Shows decision was well-reasoned |
| **Pre-pivot planning** | `doc/pivot1/1-6.md` | Archived for reference |
| **Validation that prompted pivot** | `doc/pivot1/6-validation.md` | Testing methodology |
| **Test results (failure)** | `doc/log/validation-results.md` | Why we pivoted |

---

## Key Takeaway for Evaluators

This pivot demonstrates:

✅ **Clear thinking:** We didn't assume — we validated
✅ **Evidence-based decision-making:** 35% failure rate forced a change
✅ **Willingness to pivot:** Strong product intuition to abandon "fully local" for better quality
✅ **Cost/benefit analysis:** Tradeoff between privacy, cost, and quality was explicit
✅ **Complete documentation:** Even the "wrong path" is documented to show the process

The final submission uses Claude Haiku (current), but the pivot documentation proves the team's decision-making quality.

---

## Timeline

```
Mar 26, Planning Phase
  ├─ Initial plan: Use Qwen2.5 7B locally (privacy-first)
  ├─ Validation protocol designed (6-validation.md)
  ├─ 20 utterances tested against Qwen2.5
  ├─ Result: 35% accuracy ❌ (Chinese contamination, term translation)
  └─ Decision: Pivot to Claude Haiku ✅

Mar 26, Late Planning Phase
  ├─ New architecture designed (doc/2-decision.md)
  ├─ Privacy implications documented
  ├─ Cost/benefit tradeoff analysis completed
  └─ Red team review of pivot reasoning (doc/log/004-red-team-review-post-pivot.md)

Mar 26–27, Implementation Phase
  └─ Full system built with Claude Haiku (current `doc/` and `/sidecar`, `/electron-app`)
```

---

## When to Share This with Evaluators

**Mention in README:**
> "Our validation testing revealed that Qwen2.5 7B couldn't handle Korean/English code-switching (35% accuracy). We pivoted to Claude Haiku, trading some privacy for reliability. See `doc/pivot1/reason.md` for details."

This shows:
- You test your assumptions
- You're willing to change course when data says so
- You've thought deeply about tradeoffs
- You document everything (even "failed" approaches)

**Evaluators value this** — it shows pragmatism and product judgment, not just coding skill.
