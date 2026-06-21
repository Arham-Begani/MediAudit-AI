# Synthetic test bills

A library of **fully synthetic** itemized medical statements for testing and demoing
MediAudit AI. **No real patient data appears anywhere here** — every facility, date,
and charge is invented, and all patient identifiers are pre-masked as `[MASKED]`.

Use these two ways:

1. **Text path** — paste a `.txt` straight into the audit input to test the reasoning
   pass without the camera/OCR step.
2. **Image path** — render any bill as a photo with the prompt in
   [`IMAGE_GENERATION_PROMPT.md`](./IMAGE_GENERATION_PROMPT.md), then upload it to test
   the full vision → extract → audit pipeline.

> ⚠️ **Demo rule:** only ever use these synthetic bills (or images made from them) in
> the pitch video and screenshots. Never run a real person's bill on camera — that's the
> one line the hackathon brief asks you not to cross ("avoid sensitive personal data").

---

## Ground truth (answer key)

Each bill is seeded with a known set of issues so you can check whether the auditor
catches them — and, just as importantly, whether it stays quiet when it should.
Categories: **U** = Upcoding, **D** = Duplicate Billing, **B** = Unbundled Supply Fee.

| File | Scenario | State | Seeded issues |
| --- | --- | --- | --- |
| `bill-01-er-adult-tx.txt` | Adult ER, ankle sprain after fall | TX | **U** 99285 (level-5) for a minor injury · **D** ER room billed twice (line 002 + 003) · **B** splint kit, gloves, saline flush, gauze unbundled |
| `bill-02-urgentcare-oh.txt` | Urgent care, sore throat / fever | OH | **B** one item only — "throat culture collection swab kit" unbundled. Otherwise correctly coded & fairly priced. *Tests precision: should flag ~1 item, not the whole bill.* |
| `bill-03-outpatient-surgery-fl.txt` | Outpatient knee arthroscopy | FL | **D** OR services billed twice (003) and recovery room twice (006) · **B** OR supply kit, surgical tray, sterile gloves, irrigation unbundled · possible **U** on anesthesia units |
| `bill-04-mri-imaging-ny.txt` | Outpatient MRI brain | NY | **D** full MRI billed as both "w/o & w/ contrast" *and* "w/o contrast" (001+002); gadolinium contrast billed twice (004+005) · **B** IV start kit + saline flush unbundled |
| `bill-05-maternity-il.txt` | Vaginal delivery, 2-day stay | IL | **D** labor/delivery room billed twice (002+003) · **B** nursery supply kit, diapers, peri-care pads, gloves unbundled |
| `bill-06-pediatric-er-az.txt` | Pediatric ER, asthma attack | AZ | **U** 99285 (level-5) for a moderate asthma visit · **D** treatment room twice (002+003) and nebulizer treatment twice (004+005 — verify against documented count) · **B** neb mask kit, spacer, gloves unbundled |
| `bill-07-ambulance-er-ga.txt` | Ground ambulance → ER, chest pain | GA | **D** ALS base rate billed twice (001+002) and mileage billed twice (003+004) · **B** saline flush + ECG electrodes unbundled |
| `bill-08-lab-bloodwork-pa.txt` | Outpatient annual lab panel | PA | **D / B** venipuncture (36415) billed 3× for a single routine draw (007–009) · borderline specimen-handling fee. *Subtle — tests careful line-level reading.* |
| `bill-09-physical-therapy-wa.txt` | Post-op PT session, 45 min | WA | **U** time-based units exceed a 45-min session (5×97110 + 2×97140 + 2×97530 ≈ 135 min) · **D** initial eval **and** re-eval billed same session (001+002) |
| `bill-10-clean-outpatient-co.txt` | Established office follow-up | CO | **None — intentionally clean.** Correctly coded, fairly priced. *Critical false-positive test: a good auditor should flag nothing, or only gently note line 006.* |

The two low/no-issue bills (`02` and `10`) are the most valuable for your Responsible-AI
story: filming the tool **not** inventing errors on a fair bill is strong evidence the
verifier pass and "favor precision over volume" instruction actually work.

---

## Synthetic identities (for testing PII masking)

The `.txt` files ship pre-masked. To test that the **vision pass scrubs identifiers**,
render an image with one of these **clearly fake** identities in place of `[MASKED]`,
then confirm the extracted transcript comes back masked:

| Field | Option A | Option B | Option C |
| --- | --- | --- | --- |
| Patient | JORDAN A. RIVERA | SAM T. OKAFOR | MORGAN L. CHEN |
| DOB | 04/18/1987 | 11/02/2015 | 09/30/1969 |
| MRN | MR-7741902 | MR-3360514 | MR-9028377 |
| Account | ACCT-558210447 | ACCT-220199853 | ACCT-771304628 |

These are invented strings, not real people. They exist only so you can demonstrate the
masking guardrail working on camera.
