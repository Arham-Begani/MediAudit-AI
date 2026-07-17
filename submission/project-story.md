## Inspiration

A hospital bill arrives and it might as well be in another language — dozens of codes, no explanations, and a due date that won't wait. Picture **Rosa**, a caregiver whose father just came home from the ER, holding a $7,811 statement with no idea what's real, what's a mistake, or what to even ask.

She isn't unusual: about **100 million Americans carry medical debt**, and people miss out on help not because it doesn't exist, but because the information is scattered, the language is complex, and the systems aren't built for someone under stress. We wanted to turn that moment of confusion into clarity and a clear next step.

## What it does

MediAudit AI is a **crisis-to-action translator** for confusing medical bills. You snap a photo (or paste the text), pick your state, and in seconds you get back a calm, plain-English "dossier":

- **A line-by-line translation** — every cryptic CPT/HCPCS code and abbreviation in plain English.
- **Flagged charges** — it looks for three institutional billing patterns (upcoding, duplicate billing, unbundled supply fees), and each flag **cites the exact line from your bill**, shows a fair-price range, a confidence score, and whether it was grounded in a reference or estimated.
- **A ready-to-read phone script** and a **step-by-step checklist** so you know exactly what to say and do.
- **A financial-assistance estimate** (hospital charity care) plus links to **real help like 211.org**.
- One-click **Spanish** and **plain (simpler) language**, and a **print/save** button so you can walk a clean copy into the billing office.

Why does this need AI instead of a web search? A search can't read *your* photographed bill, decode *your* specific codes, or write next steps for *your* charges and *your* state. MediAudit reads the actual document and personalizes everything.

## How we built it

- **Frontend:** Next.js (App Router), React, and TypeScript, with a hand-built CSS design system (no UI kit).
- **AI:** Google's **Gemini 3 Flash**, used for vision and reasoning, with structured JSON output so the model's response renders into a rich, accessible interface.
- **A real, multi-stage pipeline** rather than a single prompt:
  1. **Vision** transcribes the bill and **masks patient identifiers** (name, DOB, SSN, MRN) as it reads.
  2. **Retrieval** — each charge is cross-referenced against a curated knowledge base of typical price anchors and coding/bundling rules.
  3. **Reasoning** produces the decoded ledger, flags, script, and checklist.
  4. **An independent second AI pass** adversarially re-checks every flag and confirms, adjusts, or disputes it before the user ever sees it.

## Challenges we ran into

- **Latency and timeouts.** Our first version used a deep, slow model with unbounded "thinking," and audits timed out. We switched to Gemini 3 Flash with a low thinking level, which kept full audits fast and reliable.
- **Trust and honesty.** It's tempting to make the AI sound authoritative, but the benchmarks are estimates, not a live database. We rewrote the product to label every number as an AI estimate, show its limits, and never declare a charge "illegal."
- **Avoiding false positives.** AI can over-flag. The independent verifier pass was our answer — a skeptical second opinion that catches weak flags.
- **Serving people under stress, in their language.** Making the entire output work in Spanish and at a 6th-grade reading level — without breaking the structured format — took careful prompt design.

## Accomplishments that we're proud of

- A genuine **retrieve → reason → verify** agentic pipeline that's honest about its limits.
- **Responsible AI built in**, not bolted on: a named risk, a concrete safeguard, and a human always in control.
- Features that actually reach the people who need help most — **Spanish, plain language, a charity-care estimate, and real local resources**.
- Turning an overwhelming document into something a stressed person can **understand, trust, and act on** — and even print and take with them.

## What we learned

- How to combine **vision, retrieval, structured output, and a multi-step reasoning pipeline** into one product.
- That for vulnerable users, **honesty and clear limits matter as much as capability** — an AI that admits uncertainty is more trustworthy, not less.
- That good **AI design thinking beats raw horsepower**: a faster model plus a smart, self-checking pipeline outperformed a slower "smarter" one.
- The value of **keeping a human in the loop** for any decision with real stakes.

## What's next for MediAudit AI

- **More confusing documents** beyond bills — hospital discharge instructions, insurance EOBs, and government or housing letters.
- **Stronger grounding** by integrating public Medicare/chargemaster pricing data for real, citable benchmarks.
- **More languages** and a fully mobile, accessibility-audited experience.
- **Partnerships** with patient-advocacy organizations (211, Dollar For, Patient Advocate Foundation) to connect users directly to help.
