# Product Plan

## 1. Problem Definition

### Who is the user?
- Korean students and learners in technical fields (e.g., physics, engineering, computer science, medical fields)
- Users who frequently encounter **English terminology within Korean context**
- Individuals who are actively learning and using **scientific / professional vocabulary**

### When do they need this?
- Studying (e.g., listening to lectures, reviewing concepts)
- Taking notes while thinking out loud
- Asking questions or explaining ideas verbally
- Writing assignments or reports
- Messaging or documenting ideas that naturally mix Korean and English

### Core Problem
Most dictation tools assume a **single language per session**, which fails for Korean users because:
- Scientific and technical terminology is often in English
- Natural speech frequently mixes Korean sentence structure with English keywords

Example:
> “quantum mechanics에서 coupling을 Hamiltonian 표현으로 설명하고, 약한 결합과 강한 결합의 관계도 같이 설명해줘.”
> "cardiovascular disease에서 hypertension이 atherosclerosis 진행에 어떤 영향을 주는지 pathophysiology 중심으로 설명해줘."

Current tools:
- Break on mixed-language input
- Misinterpret English terms
- Produce awkward or incorrect formatting

**Therefore, a system that natively supports English–Korean mixed dictation is essential.**

---

## 2. Core Use Cases

### 1. English Dictation
- User speaks fully in English
- Output is clean, structured English text

### 2. Korean Dictation
- User speaks fully in Korean
- Output is properly spaced and natural Korean text

### 3. Mixed English–Korean Dictation (Primary Use Case)
- User naturally mixes languages within a sentence
- System correctly preserves:
  - English technical terms
  - Korean grammar and particles
  - Natural bilingual formatting

Example input:
> "quantum mechanics에서 coupling을 설명할 때..."

Expected output:
- Maintains English terms (`quantum mechanics`, `coupling`)
- Maintains natural Korean structure

### 4. Quick Copy/Paste into Other Apps
- User dictates → immediately copies or pastes
- Used in:
  - notes
  - documents
  - chat applications
  - coding comments

---

## 3. User Experience Goals

### 1. Fast Start (No Friction)
- User can start recording instantly
- No setup or language selection required
- Works out-of-the-box for mixed language

### 2. Feels Real-Time
- Partial transcription appears while speaking
- Minimal delay between speech and text

### 3. Output is Clean (Not Raw)
- Proper punctuation and capitalization
- Natural sentence segmentation
- Clean Korean-English spacing
- No obvious “ASR artifacts”

### 4. Easy to Correct Mistakes
- Users can quickly edit text
- Minimal effort required to fix errors
- System avoids over-complicated correction flows

---

## 4. Key Product Features (Prioritized)

### P0 (Must-Have)
- Microphone recording (push-to-talk or toggle)
- Multilingual transcription (English + Korean + mixed)
- Cleanup / formatting layer (punctuation, spacing, readability)
- Copy-to-clipboard or paste-ready output

---

### P1 (Important Enhancements)
- Streaming / partial transcription
- Simple correction UI (edit previous text easily)
- Transcript history (recover previous dictation)

---

### P2 (Advanced Features)
- Custom vocabulary (user-defined technical terms)
- Output modes:
  - Verbatim (raw transcription)
  - Clean (light formatting)
  - Polished (more refined output)

---

## 5. Success Criteria

### 1. Latency
- Final transcription available within **1–2 seconds after speech ends**
- Streaming updates appear in near real-time

### 2. Accuracy (Critical)
- High accuracy for:
  - English terms inside Korean sentences
  - Korean grammar and spacing
- Robust handling of **code-switching mid-sentence**

### 3. User Effort to Fix Mistakes
- Users should rarely need to:
  - re-dictate
  - manually fix multiple words
- Corrections should take **seconds, not minutes**

---

## 6. Product Insight

The core insight behind this product is:

> For Korean technical users, **mixed-language speech is not an edge case—it is the default.**

Therefore, the goal is not just multilingual support, but:
- **native support for code-switching**
- **preservation of meaning and terminology**
- **output that feels natural in both languages simultaneously**

This differentiates the product from standard dictation tools and makes it truly useful in real-world academic and professional settings.