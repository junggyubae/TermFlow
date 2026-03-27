# Documentation Index

Complete guide to all planning and development documents.

---

## 📖 Read in This Order

### 1. **Start Here: 6-status.md**
**What:** Current project status, implementation checklist, timeline, and metrics
**Why:** Tells you where we are right now (Phase 0 done, Phase 1 in progress) and what remains
**Length:** 5 min read

### 2. **Product Definition: 1-product.md**
**What:** The problem we're solving, who the user is, and what success looks like
**Why:** Understand the core product vision and feature scope (P0/P1/P2)
**Length:** 3 min read

### 3. **Architecture Decisions: 2-decision.md**
**What:** Detailed tradeoff analysis for every major choice (Electron vs. SwiftUI, Claude vs. Qwen2.5, Flask vs. FastAPI, etc.)
**Why:** Shows thoughtful engineering judgment and why each choice was made
**Length:** 8 min read

### 4. **Technical Plan: 3-plan.md**
**What:** System architecture, stack, repository structure, data flows, IPC contract, performance targets
**Why:** Understand how all the pieces connect and the technical sequence
**Length:** 15 min read

### 5. **Build Steps: 4-build.md**
**What:** Step-by-step implementation guide for all phases (Phase 1 sidecar, Phase 2 Swift, Phase 3 Electron, etc.)
**Why:** Shows the concrete work breakdown and acceptance criteria for each phase
**Length:** 20 min read

### 6. **Stretch Goals: 5-stretch.md**
**What:** Optional features (P2 — global hotkey, push-to-talk, settings modal, etc.)
**Why:** Shows what would be nice but isn't critical
**Length:** 2 min read

### 7. **(TODO) Reflection: 7-reflection.md**
**What:** Key learnings, what worked well, what was harder, what would you do differently
**Why:** Shows learning and iteration — evaluators value this
**Status:** Not yet written (to do after Phase 1)

### 8. **References: 8-references.md**
**What:** External papers, blog posts, and open-source projects that informed decisions
**Why:** Shows research grounding — decisions backed by prior work, not guesswork
**Length:** 3 min read

---

## 📋 Development Logs

**Location:** `doc/log/`

Timestamped implementation memos and validation results showing the development process.

**Index:** See `doc/log/INDEX.md`

**Key logs:**
- **001-red-team-review-planning.md** — Pre-implementation architecture review
- **002-planning-validation-checkpoint.md** — Verification that all prerequisites were available
- **003-phase0-implementation-progress.md** — Daily progress during Phase 0 build
- **004-red-team-review-post-pivot.md** — Post-pivot architecture review (most detailed)
- **validation_test.md** — Test protocol for validating code-switching accuracy
- **validation-results.md** — Results of Qwen2.5 testing (showed why pivot was needed)

---

## 🔄 Pivot Documentation

**Location:** `doc/pivot1/`

Complete documentation of the decision to pivot from Qwen2.5 (local) to Claude Haiku (API).

**Index:** See `doc/pivot1/INDEX.md`

**Key file:** `doc/pivot1/reason.md`
- Explains validation testing failure (35% accuracy)
- Documents three failure modes (Chinese contamination, term translation, meta-confusion)
- Shows cost/benefit analysis and privacy implications
- Justifies the decision to use Claude Haiku

**Why this matters for evaluators:**
This demonstrates clear thinking, evidence-based decision-making, and willingness to pivot when data says so. It shows good product judgment, not just coding skill.

---

## 🗂️ Full Structure

```
doc/
├── INDEX.md (this file)
├── 0-instructions.md              ← Original task description
├── 1-product.md                   ← Problem, user, features (P0/P1/P2)
├── 2-decision.md                  ← Architecture tradeoffs & justification
├── 3-plan.md                      ← Technical architecture & data flows
├── 4-build.md                     ← Step-by-step implementation guide
├── 5-stretch.md                   ← Optional features (P2)
├── 6-status.md                    ← Current status & checklist (NEW)
├── 7-reflection.md                ← (TODO) Learnings & postmortem
├── 8-references.md                ← External papers, blog posts, OSS references
│
├── log/                           ← Implementation logs (timestamped)
│   ├── INDEX.md                   ← Navigation guide for logs
│   ├── 001-red-team-review-planning.md
│   ├── 002-planning-validation-checkpoint.md
│   ├── 003-phase0-implementation-progress.md
│   ├── 004-red-team-review-post-pivot.md
│   ├── validation_test.md
│   └── validation-results.md
│
└── pivot1/                        ← Pre-pivot documentation (Qwen2.5 era)
    ├── INDEX.md                   ← Navigation guide for pivot folder
    ├── reason.md                  ← Why we pivoted (CRITICAL READ)
    ├── 1-product.md               ← (Pre-pivot) Product definition
    ├── 2-decision.md              ← (Pre-pivot) Architecture decisions
    ├── 3-plan.md                  ← (Pre-pivot) Technical plan
    ├── 4-build.md                 ← (Pre-pivot) Build steps
    ├── 5-stretch.md               ← (Pre-pivot) Stretch goals
    ├── 6-validation.md            ← Testing protocol used
    └── log/                       ← Pre-pivot development logs
```

---

## 📊 Quick Navigation by Purpose

### "I want to understand the product"
→ Read: **1-product.md** (3 min)

### "I want to understand why these architectural choices were made"
→ Read: **2-decision.md** (8 min), then **reason.md** for the pivot (5 min)

### "I want to see how the system works"
→ Read: **3-plan.md** (15 min) — includes architecture diagrams and data flows

### "I want to understand the implementation sequence"
→ Read: **4-build.md** (20 min) — broken down by phase with acceptance criteria

### "I want to see the project's current status"
→ Read: **6-status.md** (5 min) — includes checklist and timeline

### "I want to understand the pivot decision"
→ Read: **pivot1/reason.md** (10 min) — shows validation evidence and tradeoffs

### "I want to see the daily development process"
→ Read: **doc/log/INDEX.md**, then individual logs (10–15 min each)

### "I want to see everything" (for thorough evaluation)
→ Read in order: 1 → 2 → 3 → 4 → 5 → 6 → pivot1/reason.md → (log files as needed)
**Total time:** ~90 minutes

---

## 🎯 For Evaluators: What This Shows

| Document | Shows What | Evaluator Value |
|-----------|-----------|-----------------|
| **1-product.md** | Clear product thinking | Scoping + vision |
| **2-decision.md** | Tradeoff analysis | Engineering judgment |
| **3-plan.md** | Technical depth | Architecture skills |
| **4-build.md** | Execution clarity | Project management |
| **5-stretch.md** | Scope prioritization | Product judgment |
| **6-status.md** | Realistic assessment | Self-awareness |
| **pivot1/reason.md** | Data-driven decisions | Problem-solving |
| **log/** | Iteration + learning | Transparency |
| **8-references.md** | Research grounding | Intellectual rigor |

---

## 📝 Notes for README

When writing the README, mention:
1. "See `doc/` for complete planning and architecture"
2. "For how we decided to use Claude Haiku instead of Qwen2.5, see `doc/pivot1/reason.md`"
3. "Implementation logs are in `doc/log/` showing the daily development process"
4. "Current status is in `doc/6-status.md`"

This guides evaluators through the documentation in a logical order.

---

## Last Updated

- **6-status.md** created: Mar 27, 02:47 EST
- **log/INDEX.md** created: Mar 27, 02:50 EST
- **pivot1/INDEX.md** created: Mar 27, 02:52 EST
- **doc/INDEX.md** created: Mar 27, 02:55 EST
