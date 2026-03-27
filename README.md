# TermFlow — Speak naturally. Paste cleanly.

A macOS desktop app for Korean engineers who naturally mix English technical terms into Korean speech.

---

**Most dictation tools break on mixed-language speech.** They either mangle English technical terms inside Korean sentences, switch the entire output to the wrong language, or produce raw output that needs heavy manual cleanup.

This app is built for the way Korean engineers, researchers, and students actually speak — Korean sentences with embedded English terms as the default, not an edge case.

- **Ready to paste anywhere** — one click or ⌘C copies clean text straight to your clipboard, ready for ChatGPT, email, Slack, or anywhere else
- **English terms survive** — terms such as "overfitting", "MOSFET", "merge conflict" stay exactly as spoken, never translated
- **Custom vocabulary** — add domain-specific terms so Whisper and Claude both recognize them correctly
- **Audio never leaves your machine** — Whisper runs fully locally; only the text transcript goes to Claude for polishing
- **Feels fast** — text streams token-by-token while Claude is still generating; partial transcript updates live while you record
- **History that persists** — every session saved, editable, copyable

---

## Quick Start

```bash
git clone https://github.com/junggyubae/TermFlow
cd cl_r1
chmod +x src/run/run.sh
./src/run/run.sh
```

One command sets up dependencies, saves your API key, and launches the app. See [SETUP.md](SETUP.md) for details.

---

## Docs

| File | Contents |
|---|---|
| [SETUP.md](SETUP.md) | **Start here** — install dependencies and run the app |
| [DEMO.md](DEMO.md) | Feature checklist and test script for evaluators |
| [doc/1-product.md](doc/1-product.md) | Product requirements and user definition |
| [doc/2-decision.md](doc/2-decision.md) | Technology choices and trade-offs |
| [doc/3-plan.md](doc/3-plan.md) | Architecture and phase plan |
| [doc/4-build.md](doc/4-build.md) | Step-by-step implementation guide |
| [doc/5-stretch.md](doc/5-stretch.md) | Stretch goals — what was built, what was skipped |
| [doc/6-reflection.md](doc/6-reflection.md) | What I learned building this |
| [doc/pivot1/](doc/pivot1/) | Why we switched the polishing model from Qwen2.5 to Claude Haiku — validation results and test logs |

---

**Project:** CL Summer Internship 1st Round Task - Voice Dictation Desktop App
