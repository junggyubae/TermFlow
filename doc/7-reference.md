# References

**External resources that informed architectural and product decisions in this project.**

---

## Korean-English Code-Switching in ASR

**Extending Whisper for Korean-English Code-switching Speech Recognition**
- URL: https://ieeexplore.ieee.org/document/10929894/
- IEEE paper that extends Whisper with a per-sentence language detector, enabling multiple language tokens within a single utterance rather than one per recording. Reports 1.7% CER and 0.9% sWER improvement on a Korean-English code-switching dataset. Directly validates why `language=None` (auto-detect) is the right Whisper configuration for mixed-language input — and why a single language token per session is insufficient.

**Fine-tuning Whisper on KsponSpeech (Korean Domain-Specific ASR)**
- URL: https://www.eksss.org/archive/view_article?pid=pss-15-3-83
- Documents Whisper large-v2's baseline Korean performance (WER 29.05%, CER 13.95%) on KsponSpeech and explores fine-tuning strategies. Notably, the KsponSpeech dataset itself contains natural Korean-English-numeral code-switching, making the findings directly applicable to this project's target user. Informed the decision to use large-v3 (improved over large-v2) without fine-tuning given timeline constraints.

---

## LLM Post-Processing for Transcription

**Large Language Model Based Generative Error Correction (GenSEC, NVIDIA Research, 2024)**
- URL: https://research.nvidia.com/publication/2024-12_large-language-model-based-generative-error-correction-challenge-and-baselines
- NVIDIA's formal benchmark for using frozen LLMs to post-correct ASR output without retraining the speech model. Covers punctuation restoration, error correction, and speaker tagging. Provides the research foundation for the polish-via-Claude-Haiku approach: LLM post-processing is a well-validated strategy, not an ad hoc idea.

**Leveraging LLMs for Post-Transcription Correction (Interspeech 2024)**
- URL: https://www.isca-archive.org/interspeech_2024/koilakuntla24_interspeech.pdf
- Interspeech 2024 paper comparing zero-shot prompting (often harmful due to over-correction) against fine-tuned approaches for ASR correction. Key finding: zero-shot LLMs can over-correct and change meaning. This directly shaped the polish prompt design — instructions explicitly prohibit paraphrasing and require preservation of the user's exact phrasing, only fixing punctuation, spacing, and filler words.

---

## Voice Dictation UX

**Superwhisper vs. Wispr Flow: Mac Dictation Comparison 2025**
- URL: https://willowvoice.com/blog/super-whisper-vs-wispr-flow-comparison-reviews-and-alternatives-in-2025
- Articulates the two dominant UX philosophies in current dictation apps: Superwhisper's local-first, privacy-preserving model with deep customization versus Wispr Flow's zero-configuration, context-aware cloud approach. This tradeoff maps directly onto this project's architecture (local Whisper transcription + cloud LLM polish), and the comparison helped define where to sit on the privacy/convenience spectrum for a bilingual technical user.

**VoiceTypr — Open-Source Offline Voice Dictation App**
- URL: https://github.com/moinulmoin/voicetypr
- Open-source Tauri + React + TypeScript dictation app using local Whisper for 99+ language support. Inspectable reference for how an indie dictation app separates the native audio/inference layer from the UI layer. Reinforced the architectural decision to use a native subprocess (Swift AVAudioEngine) rather than Web Audio API for reliable mic handling on macOS.

---

## Electron + Python Sidecar Architecture

**Electron + React + Python Architecture (Medium / Project Heuristics)**
- URL: https://medium.com/heuristics/electron-react-python-part-2-architecture-d49634521efd
- Two-part series on structuring an Electron app with a Python sidecar, covering subprocess spawning from the main process, IPC routing through the main process as a relay between renderer and Python, and clean separation of concerns. Directly applicable to the architecture where the Python sidecar handles Whisper inference and Flask serves the HTTP API.

**Electron + Python Boilerplate with ZeroRPC**
- URL: https://mannidung.github.io/posts/electron-python-boilerplate/
- Tutorial using ZeroRPC over TCP as the IPC layer between Electron and a Python sidecar — a more robust alternative to raw stdin/stdout for long-running processes. Demonstrates Python subprocess launch at app startup, async JavaScript callbacks into Python functions, and PyInstaller packaging integration. Informed the decision to use HTTP (Flask) rather than stdin/stdout for the sidecar interface, which provides cleaner error handling and request/response semantics.
