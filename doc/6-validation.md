# Validation Testing Protocol

**Purpose:** Before Phase 1 coding, validate that Claude Haiku handles Korean/English code-switching correctly.
**Timeline:** ~30 minutes
**Success Criteria:** 19/20 utterances pass (95%+ accuracy).

> **History:** A local model was tested first and failed at 35% accuracy. See `pivot1/reason.md` for full evidence. Claude Haiku is now the primary polish model.

---

## Test 1 — Claude Haiku Code-Switching Accuracy

**Objective:** Confirm Claude Haiku preserves English technical terms inside Korean sentences, removes fillers, and never translates.

**Test Set:** 20 utterances across four domains (5 per domain). These are realistic dictation transcripts with fillers — not clean questions.

### Medical
1. "어 그니까 cardiovascular disease에서 hypertension이 atherosclerosis progression에 영향을 많이 주는데 음 pathophysiology 관점에서 보면은..."
2. "myocardial infarction이 생기면 그러니까 pathophysiology는 어떻게 되냐면 troponin 수치가 확 올라가거든"
3. "COPD와 asthma의 차이점을 음 급성 exacerbation 관점에서 보면은..."
4. "어 sepsis 환자에서 inflammatory cascade가 어떻게 진행되냐면 cytokine들이 단계별로 올라가는 거예요"
5. "그래서 pneumonia와 bronchitis의 radiographic findings를 구분해서 보면은..."

### Engineering
1. "그래서 음 MOSFET이 그러니까 saturation region에서 동작할 때는은 threshold voltage가 어떻게 결정되는지..."
2. "impedance matching이 RF circuit에서 왜 중요하냐면 음 S-parameter 기준으로 보면은..."
3. "어 bipolar junction transistor의 active region과 saturation region을 공학적으로 비교해보면..."
4. "operational amplifier의 frequency response와 bandwidth를 음 Bode plot으로 분석해보면은..."
5. "signal integrity 문제가 high-speed PCB design에서 왜 생기냐면 그러니까..."

### Computer Science
1. "아 GitHub에서 어 merge conflict 나면은 그거를 어떻게 해결하냐면 rebase를 하거나 아니면 그냥 merge를 하거나..."
2. "REST API에서 idempotency란 음 HTTP method 관점에서 보면은..."
3. "SQL injection vulnerability를 어 parameterized query로 어떻게 막냐면..."
4. "load balancer가 distributed system에서 latency를 어떻게 최적화하냐면 그러니까..."
5. "NoSQL database가 ACID compliance를 안 하면은 transaction 관점에서 음..."

### General
1. "요즘 ChatGPT 같은 generative model이 hallucination을 보이는데 그 이유가 뭐냐면..."
2. "5G network의 latency가 4G보다 낮은 이유가 bandwidth와 spectrum 관점에서 보면은..."
3. "blockchain의 consensus algorithm인 proof-of-work와 proof-of-stake의 차이를 보면은..."
4. "cryptocurrency의 smart contract가 Ethereum에서 어떻게 security vulnerability를 만드냐면은..."
5. "이번 학기에 음 machine learning 수업에서 overfitting 문제를 어 regularization으로 해결하는 거 배웠는데 그게 뭐냐면은..."

### Acceptance Criteria

**Pass if:**
- English terms preserved exactly (case-insensitive — capitalization fixes are OK)
- Fillers removed (음, 어, 그러니까, 그니까, um, uh, like, you know)
- Output stays in the same language mix as input (Korean + English → Korean + English)
- Output is NOT an answer to a question — just cleaned text
- Output does NOT contain Chinese, Japanese, or any language not in the input

**Fail if:**
- <19/20 (below 95%)
- Any English term translated to Korean phonetics
- Any language contamination (Chinese, Japanese)

### Running the Test

```bash
# Test script
python3 << 'EOF'
import anthropic
import os

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

system_prompt = """You are a transcript cleaner. You receive raw speech-to-text output and clean it up.

Rules:
- Output ONLY the cleaned transcript. Do not answer questions, explain, summarize, or add commentary.
- NEVER translate. Output in the SAME language mix as the input.
- NEVER output Chinese, Japanese, or any language not present in the input.
- Remove filler words: 음, 어, 그러니까, 그래서 (when filler), um, uh, like, you know
- Fix punctuation and capitalization
- Correct Korean spacing
- Preserve all English technical terms exactly as spoken
- The output should read like something the user would have typed themselves"""

utterances = [
    # [paste all 20 utterances here]
]

passed = 0
for i, utt in enumerate(utterances, 1):
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": utt}]
    )
    result = msg.content[0].text
    print(f"[{i:2d}] Input:  {utt[:80]}")
    print(f"     Output: {result[:80]}")
    print()

print(f"=== Manual review: check each output for term preservation ===")
EOF
```

**Cost:** ~$0.02 total for 20 utterances.

---

## Test 2 — Claude Haiku SSE Streaming

**Objective:** Confirm Claude Haiku streams tokens incrementally via the Anthropic SDK.

```python
import anthropic, time, os

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

start = time.time()
first_token_time = None
token_count = 0

with client.messages.stream(
    model="claude-haiku-4-5-20251001",
    max_tokens=100,
    system="You are a transcript cleaner. Clean up the following text.",
    messages=[{"role": "user", "content": "그래서 음 MOSFET이 그러니까 saturation region에서 동작할 때는은..."}]
) as stream:
    for text in stream.text_stream:
        token_count += 1
        if first_token_time is None:
            first_token_time = time.time() - start

total = time.time() - start
print(f"First token: {first_token_time*1000:.0f}ms")
print(f"Total time: {total*1000:.0f}ms")
print(f"Tokens: {token_count}")
print(f"PASS" if first_token_time < 0.5 else "FAIL (>500ms)")
```

**Acceptance:**
- First token within 500ms
- Tokens arrive incrementally (not buffered)

---

## Results Template

After running both tests, log results here:

```markdown
## Claude Haiku Validation — [DATE]

### Test 1: Code-Switching
- Result: __ /20 passed
- Failed examples: [list any]
- Status: PASS / FAIL

### Test 2: SSE Streaming
- First token: __ms
- Total time: __ms
- Tokens: __
- Status: PASS / FAIL

### Recommendation
[PASS → proceed to Phase 1 / FAIL → investigate]
```
