# Conversation orchestration

The application layer that owns conversation intelligence. It sits between the
telephony bridge and the model, holds the state of the call, decides what each
turn must achieve, and hands the model one objective at a time.

```
Twilio Media Streams
        ↓  μ-law audio
  MediaStreamBridge            transport only — decides nothing
        ↓  events: transcripts, tool calls, barge-in
  ConversationOrchestrator     state, stage, priorities, quality
        ↓  TurnPlan → guidance
  OpenAI Realtime (model)      writes the words
        ↓  tool calls
  ReceptionistService          executes tools, returns results
        ↓  audio
Twilio Media Streams
```

Everything lives in `apps/api/src/receptionist/orchestrator/`. The bridge gained
five call sites and no logic. No schema, API, Twilio, or OpenAI changes.

---

## What this layer can and cannot enforce

This is the constraint that shapes the design, and it comes from the transport.

The Realtime session runs **server VAD with `create_response: true`**. The model
starts speaking the moment the caller stops — _before_ the caller's transcript
exists. There is no point at which a turn can be inspected, approved, and then
released.

So "the orchestrator decides and the LLM only writes" is:

| Claim                                | Reality                                                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orchestrator owns collected state    | **Enforced.** Tool calls update state synchronously and structurally.                                                                                          |
| Orchestrator owns the stage          | **Enforced.** Derived from state; the model has no vote.                                                                                                       |
| Orchestrator picks the next question | **Enforced.** Priority order is code, not prose.                                                                                                               |
| Orchestrator caps clarification at 2 | **Enforced.** Attempt count lives in state.                                                                                                                    |
| Orchestrator decides tool usage      | **Advisory.** Realtime function calling is model-driven; the plan states the expected tool and the prompt biases hard toward it, but the model emits the call. |
| Orchestrator gates each response     | **Not possible.** Audio streams directly to the caller. Quality findings are fed forward as corrections on the next turn.                                      |

Making tool invocation and response gating truly authoritative would mean setting
`create_response: false` and driving turn-taking ourselves — paying full
transcription latency on every exchange, on a phone call, and reintroducing the
"silent after greeting" class of bug the bridge already carries a watchdog for.
That trade was not worth making silently, so it wasn't made.

Guidance is therefore injected at the **turn boundary** (`response.done`), which
is the one race-free moment: nothing is in flight, and the transcript for the
turn just finished has been applied.

---

## Components

| Component                 | File                           | Responsibility                              |
| ------------------------- | ------------------------------ | ------------------------------------------- |
| Conversation Orchestrator | `conversation-orchestrator.ts` | Facade + state manager. One per call.       |
| Conversation State        | `types.ts`                     | The complete state shape and vocabulary.    |
| Response Planner          | `response-planner.ts`          | State → `TurnPlan` for the next turn.       |
| Lead Completeness Tracker | `lead-completeness.ts`         | Known / missing / mandatory / score.        |
| Stage Transition Engine   | `stage-engine.ts`              | Derives the stage from what is true.        |
| Question Prioritizer      | `question-prioritizer.ts`      | The single highest-value next field.        |
| Sentiment Analyzer        | `sentiment.ts`                 | Seven registers, lexical, negation-aware.   |
| Clarification Manager     | `clarification.ts`             | Attempt cap, phrasing memory, confidence.   |
| Escalation Policy         | `escalation.ts`                | When a person does better than a script.    |
| Quality Validator         | `quality-validator.ts`         | Post-turn findings → next-turn corrections. |
| Guidance renderer         | `guidance.ts`                  | `TurnPlan` → the text the model receives.   |

Each is independently constructible and independently testable; the orchestrator
wires them and owns nothing else.

---

## State

`ConversationState` holds stage, disposition, collected fields, sentiment and its
history, emergency status, appointment progress, objections raised, clarification
attempts and phrasings, escalation, confidence, interruption and pending topic,
turn counts, name-usage count, and recent assistant turns.

The model is never asked to remember any of it.

---

## Stages

`GREETING → INTENT_DETECTION → RAPPORT → NAME_COLLECTION → PROBLEM_DISCOVERY →
QUALIFICATION → ADDRESS_COLLECTION → APPOINTMENT_SCHEDULING → CONFIRMATION →
CLOSING`

The stage is **derived, not advanced**. A caller who raises a second problem
during confirmation belongs back in discovery, and a forward-only machine cannot
express that — while real calls do it constantly.

Emergencies bypass the arc entirely: address, then callback, then name.

---

## Mandatory name

Every legitimate homeowner call must capture a name. Enforced in three places:

1. `LeadCompletenessTracker.MANDATORY` includes `NAME`.
2. `readyToClose()` is false while a mandatory field is missing — so the call
   cannot reach `CLOSING`.
3. `QuestionPrioritizer` puts `NAME` first in the standard order.

In an emergency the name comes _after_ address and callback — a name is worth
less than a location when water is coming through a ceiling — but it is still
mandatory, and the prioritizer returns to it once the crew can be dispatched.

Calls that are not leads (wrong number, solicitation, silence) are exempt:
holding a robocall hostage for a name is absurd.

Once captured, the first name is used **on alternating turns, up to four times**.
Every turn would read as a sales technique; never would read as a form.

---

## Question priority

**Emergency:** problem → address → callback → name → active leak → appointment

**Standard:** name → problem → address → property type → phone → appointment →
city → callback preference

Storm and insurance questions unlock only once storm or hail is in the captured
problem. Property type is inferred where possible and asked outright only after
three turns. Appointments are never offered to a panicked, angry, or frustrated
caller, and never twice after a decline.

---

## Clarification

Confidence is inferred from transcript shape — empty turns, single ambiguous
tokens, `[inaudible]` markers, filler ratio — because this transport exposes no
ASR confidence score.

Two attempts maximum. Each records its phrasing so the next differs. A third
failure lets the field go and, where a transfer exists, escalates.

---

## Quality

Each assistant turn is checked for: verbosity (>60 words), repetition (Jaccard
≥0.6 against the last six turns), asking for an already-known field, more than
one question, AI self-disclosure, missing empathy where the plan called for it,
and turns that make no forward motion.

Findings become imperative corrections on the following turn — "You just repeated
yourself. Say it a different way this time." A feedback loop, not a gate; see the
constraint section above.

---

## Backward compatibility

- `LiveConversationSignals`, tool schemas, the structured output schema, and the
  database are untouched.
- The orchestrator is additive: if it were removed, the bridge would behave
  exactly as before. Every call site is null-guarded (`this.orchestrator?.…`).
- One orchestrator per **call**, not per connection — a mid-call reconnect must
  not forget the caller's name.
- Guidance is a per-turn `conversation.item.create`, not a `session.update`, so
  it does not accumulate in the session or cause behaviour to drift as the call
  lengthens.
- Turn-taking, latency, and the response watchdog are unchanged. No
  `response.create` is issued by the guidance path.
