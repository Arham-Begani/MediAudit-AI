# MediAudit AI

> A **Crisis-to-Action Translator** for U.S. patients drowning in opaque medical bills.

Upload a **photo or PDF** of an itemized hospital statement (or paste the text) plus
your state, and MediAudit AI runs a **two-pass Claude Opus 4.8 pipeline**:

1. **Reads** the image with vision — transcribing every line item and **masking patient
   identifiers** (name, DOB, SSN, MRN, account #) as it goes, and detecting the facility's
   state to auto-localize the audit.
2. **Decodes** every cryptic billing string, CPT, and HCPCS code into plain English.
3. **Audits** each charge for three institutional error patterns — **upcoding**,
   **duplicate billing**, and **unbundled supply fees** — against regional baselines, at
   **high reasoning effort with adaptive thinking**.
4. **Localizes** the relevant consumer protections (state law, non-profit charity-care
   mandates, the Federal No Surprises Act).
5. **Arms** you with a polite-but-firm **phone script**, a fair-market confidence range
   for every flagged charge, and a low-stress, step-by-step **roadmap** to dispute.

The intelligence backend is **Claude (`claude-opus-4-8`)** for both passes — vision
reading and reasoning — driven by the persona, workflow, and strict compliance
constraints in [`master-prompt.md`](./master-prompt.md).

---

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **`@anthropic-ai/sdk`** — streamed, structured JSON output; **vision** input for image/PDF reading; high reasoning effort + adaptive thinking
- **Bespoke CSS** (no UI kit) — Fraunces / Hanken Grotesk / IBM Plex Mono

Both model calls use `output_config.format` (structured JSON): the vision pass returns a
masked transcript + detected region, and the audit pass returns the five-section advocacy
packet, which the UI renders into a rich, accessible "dossier." Images are downscaled in
the browser before upload to keep requests fast.

---

## Run it locally

```bash
# 1. Add your Anthropic API key
#    (get one at https://console.anthropic.com/settings/keys)
cp .env.example .env.local
#    then edit .env.local and paste your key into ANTHROPIC_API_KEY

# 2. Install & start
npm install
npm run dev
```

Open **http://localhost:3000**, click **“Decode a sample bill”** (or paste your own
statement and pick a state), then **Run the audit**.

> The audit runs Claude at high reasoning effort, so a full analysis typically takes
> **20–60 seconds**. The request is streamed server-side to avoid timeouts.

---

## How it's wired

| Path | Role |
| --- | --- |
| `master-prompt.md` | Canonical product behavior — the single source of truth for the persona, workflow & constraints. |
| `lib/system-prompt.ts` | Embeds the master prompt verbatim; holds the audit + vision-extraction prompts and both JSON schemas. |
| `app/api/extract/route.ts` | Vision pass. Streams `claude-opus-4-8` over the uploaded image(s)/PDF, returns a masked transcript + detected region. |
| `app/api/audit/route.ts` | Reasoning pass. Streams `claude-opus-4-8`, parses the JSON advocacy packet, returns it. |
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

---

## Deploy

Works on any Node host. For Vercel: import the repo, set `ANTHROPIC_API_KEY` as an
environment variable, and deploy. (`maxDuration` on the route is set to 120s — Pro plans
honor it; Hobby caps at 60s.)
