# CL Summer Internship 1st Round Task

<aside>
💡 Thanks for your interest in Curation Labs—please treat this task as a fun learning experience, and remember to spend at least 60% of your time on system-designing/planning.

</aside>

## Task: Build a English + [Second Language] Voice Dictation Desktop App

### Overview

Your task is to build a **local desktop application** that delivers a voice-dictation experience inspired by [Wispr Flow](https://wisprflow.ai/), but designed specifically for **English + [Second Language] input**, including mixed-language speech in the same session.

We are not looking for a pixel-perfect clone. We are looking for a strong product and engineering interpretation of the problem: a well-scoped desktop app that feels useful, thoughtful, and reliable.

### Time Window

You will receive this task at **9:00 AM EST**.

Your submission is due by **9:00 PM EST the following day**.

This is a **36-hour take-home task**.

### Goal

Build a desktop app that allows a user to:

- speak in **English, Second Language, or mixed English–Second Language**
- receive high-quality transcribed text
- get an output that feels **cleaner and more polished than raw transcription**
- use the product in a way that feels intuitive and end-user ready

### What We Want You to Build

At minimum, your app should support the following core workflow:

1. The user opens the desktop app.
2. The user starts voice capture.
3. The user speaks in English, Second Language, or a mix of both.
4. The app converts the speech into text with reasonable latency.
5. The app presents text that is readable and polished enough to be used in real work.

### Minimum Requirements

Your submission should include these capabilities:

### 1) Desktop app

Build a working **local desktop application**.

Use any stack you think is appropriate. (Recommend either Electron or Tauri v2)

### 2) English + Second Language input

The app must handle:

- Second Language-only speech
- English-only speech
- mixed English–Second Language speech

This mixed-language behavior is the most important part of the task.

### 3) Dictation UX

The app should have a clear dictation flow, such as:

- start / stop recording
- push-to-talk or toggle-to-record
- visible recording state
- visible transcription output area

### 4) Polished output

Do more than raw speech-to-text where possible. Examples include:

- punctuation
- paragraphing
- filler-word cleanup
- formatting improvements
- basic correction flow

You do not need to solve everything perfectly, but the result should feel intentionally designed.

### 5) Reasonable product quality

The app should feel coherent and usable. We care about:

- latency
- clarity of UI
- error handling
- recoverability
- overall user experience

### Strongly Preferred

These are not strictly required, but they will strengthen a submission:

- partial / streaming transcription
- easy correction of prior output
- support for user-defined vocabulary or custom terms
- copy-to-clipboard or paste-ready workflow
- transcript history
- thoughtful handling of switching languages mid-sentence
- privacy-conscious architecture
- good onboarding or empty-state UX

### Stretch Goals

Treat these as optional. Do not sacrifice quality on the core task for feature count.

Examples:

- global hotkey
- insertion into the active text field of another app
- local/offline-first mode
- personal dictionary
- reusable text snippets
- settings for tone / cleanup style
- packaging for simple install

### What We Care About Most

We will evaluate your submission equally across three dimensions:

### 1) Codebase quality

Does the product work?

Is the codebase well-structured, maintainable, and thoughtfully implemented?

### 2) Product planning quality

We want to see how you think, not just what you code.

Your repo should include the materials you used to execute, such as:

- product plan
- technical plan
- tradeoff notes
- architecture notes
- implementation memos
- decision logs

### 3) README quality

Your README should “sell” the project like a strong public GitHub repo.

A strong README should make us want to try the product.

### Submission Requirements

Please submit a **GitHub repository** that includes:

- application source code
- setup instructions
- README
- all planning and execution documents
- any memos or notes you used while building
- any coding-agent configuration, skills, or prompt files you used

We want to see the full shape of your work, including how you used tools.

### Allowed Tools

You are encouraged to actively use coding agents.

Both **Codex** and **Claude Code** are acceptable.

We are not evaluating whether you avoided AI tools.

We are evaluating whether you used them effectively and with good judgment.

### Optional Support

[(Hopefully) Helpful Resources](https://www.notion.so/Hopefully-Helpful-Resources-32ff1fbef8c2806dada2de5788214648?pvs=21)

You may optionally book a **30-minute call** with me during the task window to discuss approach, ask clarifying questions, or get execution advice.

### What Success Looks Like

A strong submission will usually show:

- clear scoping
- a product that works end to end
- explicit tradeoffs
- good taste in what was prioritized
- strong documentation
- evidence of iteration
- a README that makes the project easy to understand and compelling to review

### Notes

- You do **not** need to perfectly replicate every Wispr Flow feature.
- Prioritize a strong core experience over breadth.
- Thoughtful simplification is better than overreaching.
- We value product judgment as much as implementation skill.

<aside>
💡 Have fun—and I’m excited to see what you build.

</aside>