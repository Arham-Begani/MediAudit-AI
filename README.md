# MediAudit AI

> A **Crisis-to-Action Translator** for U.S. patients drowning in opaque medical bills.

Upload **photos or a PDF** of an itemized hospital statement (up to 30 pages) plus
your state, and MediAudit AI runs a **grounded, self-verifying Gemini 3 Flash pipeline**:

1. **Reads** the image with vision — transcribing every line item and **masking patient
   identifiers** (name, DOB, SSN, MRN, account #) as it goes, and detecting the facility's
   state to auto-localize the audit.
2. **Decodes** every cryptic billing string, CPT, and HCPCS code into plain English.
3. **Cross-references** each charge against a curated **reference layer** (illustrative
   price anchors + coding/bundling rules), **audits** it for three institutional error
   patterns — **upcoding**, **duplicate billing**, and **unbundled supply fees** — then runs
   an **independent second-pass verifier** (a separate Gemini call) that adversarially
   re-checks every flag against the transcript and **confirms, recalibrates, or disputes**
   each one.
4. **Localizes** the relevant consumer protections (state law, non-profit charity-care
   mandates, the Federal No Surprises Act).
5. **Arms** you with a polite-but-firm **phone script**, an estimated fair-market range
   for every flagged charge, and a low-stress, step-by-step **roadmap** to dispute.

The intelligence backend is **Gemini 3 Flash (`gemini-3-flash-preview`)** across every
pass — vision reading, reasoning, and verification — driven by the persona, workflow, and
strict compliance constraints in [`master-prompt.md`](./master-prompt.md).

---

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **`@google/genai`** — structured JSON output; **vision** input for image/PDF reading; a configurable thinking level
- **Bespoke CSS** (no UI kit) — Fraunces / Hanken Grotesk / IBM Plex Mono

Both model calls use `responseMimeType: "application/json"` with a `responseSchema`
(structured JSON): the vision pass returns a masked transcript + detected region, and the
audit pass returns the five-section advocacy packet, which the UI renders into a rich,
accessible "dossier." Images are downscaled in the browser before upload to keep requests
fast.

---

## Run it locally

```bash
# 1. Add your Google Gemini API key
#    (get one at https://aistudio.google.com/apikey)
cp .env.example .env.local
#    then edit .env.local and paste your key into GEMINI_API_KEY

# 2. Install & start
npm install
npm run dev
```

Open **http://localhost:3000**, click **“Try a sample bill”** (or upload photos of your
own statement and pick a state), then **Run the audit**.

> The audit runs Gemini 3 Flash at a low thinking level, so a full analysis typically
> takes **10–30 seconds**. The request runs server-side with a 120s `maxDuration`, and the
> browser aborts after 115s as a safety net.

---

## How it's wired

| Path | Role |
| --- | --- |
| `master-prompt.md` | Canonical product behavior — the single source of truth for the persona, workflow & constraints. |
| `lib/system-prompt.ts` | Embeds the master prompt verbatim; holds the audit, vision-extraction, and **independent verifier** prompts, the retrieval/reasoning protocol, and all three JSON schemas. |
| `lib/reference.ts` | The retrieval layer — curated, illustrative price anchors & coding/bundling rules injected into the audit so each flag is grounded, with `grounding` marked `reference-table` vs. `model-estimate`. |
| `app/api/extract/route.ts` | Vision pass. Runs `gemini-3-flash-preview` over the uploaded image(s)/PDF, returns a masked transcript + detected region. |
| `app/api/audit/route.ts` | Reasoning pass **+ independent verifier**. Runs `gemini-3-flash-preview` for the advocacy packet, then a best-effort second pass that adversarially re-checks every flag and merges its calibrated verdicts (confirm / adjust / dispute) back in. |
| `lib/types.ts` | Shared types mirroring the schema. |
| `lib/sample.ts` | A privacy-masked sample ER statement seeded with all three error patterns. |
| `app/page.tsx` | The full experience: hero, input console, animated analysis, and the rendered dossier. |
| `app/globals.css` | The hand-crafted "editorial forensic" design system. |

---

## Privacy & scope

- Patient identifiers (name, DOB, SSN, MRN, account number) are expected to be **masked
  on-device** before paste; the app never asks for them and the model is instructed not
  to reconstruct them.
- No statement text is persisted — it is sent to the model for the single audit call only.
- MediAudit AI is an **automated informational tool**. It is **not** legal counsel,
  financial planning, or medical advice, and it never declares any charge "illegal." It
  surfaces *billing discrepancies* and *benchmark deviations* for you to verify against
  your physical records.
- The **benchmark ranges and confidence scores are AI estimates** generated from the
  model's training knowledge of typical U.S. pricing — **not** a live lookup of any
  hospital's chargemaster or a Medicare database. Treat every flag as a question to
  raise and verify, not proof of an error.

---

## Deploy

Works on any Node host. For Vercel: import the repo, set `GEMINI_API_KEY` as an
environment variable, and deploy. (`maxDuration` on the route is set to 120s — Pro plans
honor it; Hobby caps at 60s.)
