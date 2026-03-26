# Product

**This document defines the WHY: the problem we're solving, who the user is, and what success looks like.**

---

## Problem

Korean students and professionals in technical fields (engineering, CS, medicine, physics) think and speak in a natural mix of Korean and English. Most dictation tools assume a single language per session — they break on code-switching, misread English terms in Korean sentences, and produce raw output that needs heavy manual cleanup.

**For this user, mixed-language speech is not an edge case. It is the default.**

### Example Mixed-Language Speech

> Speech: "MOSFET에서 threshold voltage가 어떻게 결정되는지 band diagram 기준으로 설명해줘."  
> Meaning: Explain how the threshold voltage of a MOSFET is determined using a band diagram.

> Speech: "cardiovascular disease에서 hypertension이 atherosclerosis progression에 어떤 영향을 주는지 pathophysiology 중심으로 설명해줘."  
> Meaning: Explain how hypertension influences the progression of atherosclerosis in cardiovascular disease, focusing on pathophysiology.
---

## User

Korean-English bilingual in an academic or professional setting — engineers, researchers, medical students — who thinks and speaks in a natural mix of both languages and wants clean, paste-ready text without choosing a language or editing the output.

### When they use it

- Taking notes while thinking out loud
- Drafting documents, messages, or coding comments
- Explaining or summarizing ideas verbally

---

## Features

### P0 — Minimum requirements
- Toggle-to-record (start / stop recording)
- Multilingual transcription: Korean-only, English-only, mixed Korean–English
- Visible recording state (indicator + elapsed timer)
- Visible transcription output area
- LLM polish layer: punctuation, paragraphing, filler-word cleanup, formatting
- Inline correction of output (editable textarea — basic correction flow)
- Copy-to-clipboard output
- Error handling and recoverability across all failure states
- Reasonable latency — text ready within 1–2s of speech ending

### P1 — Strongly preferred
- Streaming output (text appears token-by-token — feels fast)
- Transcript history (past sessions accessible, each copyable)
- Custom vocabulary (user-defined terms preserved exactly)
- Thoughtful handling of mid-sentence language switching
- Privacy-conscious architecture (all audio and transcription processed locally)
- Onboarding flow (model download progress, first-use instructions)
- Empty-state UX (clear prompt for first-time users)

### P2 — Stretch goals
- Global hotkey (trigger recording without focusing the app)
- Push-to-talk mode (hold key to record)
- Tone / cleanup style settings (Formal / Natural / Verbatim)
- Export transcript as .txt or .md
- Packaging for simple install (.dmg)
