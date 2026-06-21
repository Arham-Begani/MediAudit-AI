// ---------------------------------------------------------------------------
// Lightweight retrieval layer for the audit pass.
//
// Before the model reasons, we hand it two curated, PUBLIC-KNOWLEDGE references:
//   1. RATE_ANCHORS  — broad, illustrative fair-price ranges for the most common
//      hospital/ER line items, so a flagged benchmark can be *grounded* in a
//      reference rather than invented from scratch.
//   2. CODING_RULES  — standard coding / bundling rules of thumb for the three
//      error patterns the auditor hunts (upcoding, duplicate billing, unbundling).
//
// These are ILLUSTRATIVE references compiled from public billing knowledge —
// they are NOT a live quote for any specific facility and NOT a Medicare API.
// The audit prompt is told to treat them as anchors and to label every flag as
// `reference-table` (a curated anchor/rule supports it) or `model-estimate`.
// This is what makes the pipeline a real retrieve -> reason -> verify flow.
// ---------------------------------------------------------------------------

export interface RateAnchor {
  /** CPT / HCPCS / revenue code, or a shorthand key for an uncoded item. */
  code: string;
  /** Plain-English name. */
  label: string;
  /** Illustrative typical fair range (USD), low and high bound. */
  low: number;
  high: number;
  /** Optional caveat shown to the model. */
  note?: string;
}

// Broad, deliberately wide ranges — the value is the *grounding method*, not
// false precision. Tightening these would overclaim accuracy we don't have.
export const RATE_ANCHORS: RateAnchor[] = [
  { code: "99281", label: "ER visit, level 1 (minor)", low: 100, high: 300 },
  { code: "99282", label: "ER visit, level 2 (low)", low: 150, high: 450 },
  { code: "99283", label: "ER visit, level 3 (moderate)", low: 250, high: 750 },
  { code: "99284", label: "ER visit, level 4 (high)", low: 450, high: 1300 },
  {
    code: "99285",
    label: "ER visit, level 5 (highest complexity)",
    low: 700,
    high: 2200,
    note: "Reserved for life-/limb-threatening acuity. Routine visits billed here are a classic upcoding pattern.",
  },
  { code: "96360", label: "IV hydration, initial hour", low: 100, high: 400 },
  { code: "96361", label: "IV hydration, each additional hour", low: 30, high: 120 },
  { code: "85025", label: "Complete blood count (CBC) w/ differential", low: 10, high: 45 },
  { code: "80048", label: "Basic metabolic panel", low: 10, high: 45 },
  { code: "80053", label: "Comprehensive metabolic panel", low: 15, high: 60 },
  { code: "71046", label: "Chest X-ray, 2 views", low: 50, high: 250 },
  {
    code: "J7030",
    label: "Saline / sodium chloride flush (small volume)",
    low: 0,
    high: 10,
    note: "Routine flushes are typically bundled into IV administration; a standalone charge is a common unbundling pattern.",
  },
  {
    code: "SUPPLY-BASIC",
    label: "Routine supplies (gloves, gauze, basic bandages, swabs)",
    low: 0,
    high: 15,
    note: "Generally bundled into the room or procedure fee under standard billing norms.",
  },
  {
    code: "SUPPLY-KIT",
    label: "Generic procedure / OR supply kit",
    low: 0,
    high: 100,
    note: "Standard kits are usually bundled into the procedure; itemizing them separately is a common unbundling pattern.",
  },
  { code: "MEDS-ORAL", label: "Single oral medication dose (e.g. acetaminophen)", low: 1, high: 10 },
  { code: "99213", label: "Office visit, established patient, moderate", low: 75, high: 200 },
  { code: "99214", label: "Office visit, established patient, high", low: 110, high: 300 },
  { code: "36415", label: "Routine venipuncture (blood draw)", low: 3, high: 25, note: "Frequently bundled with the lab panel; a large standalone fee is a common unbundling pattern." },
  { code: "80050", label: "General health panel", low: 30, high: 90 },
  { code: "81001", label: "Urinalysis, automated with microscopy", low: 5, high: 30 },
  { code: "84443", label: "Thyroid stimulating hormone (TSH)", low: 20, high: 70 },
  { code: "93000", label: "Electrocardiogram (ECG/EKG), complete", low: 20, high: 150 },
  { code: "70450", label: "CT head/brain, without contrast", low: 250, high: 1200 },
  { code: "71250", label: "CT chest, without contrast", low: 300, high: 1400 },
  { code: "72148", label: "MRI lumbar spine, without contrast", low: 400, high: 1600 },
  { code: "76700", label: "Ultrasound, abdomen, complete", low: 100, high: 500 },
  { code: "J1885", label: "Ketorolac (Toradol) injection, per 15 mg", low: 2, high: 25 },
  { code: "J2550", label: "Promethazine (Phenergan) injection", low: 2, high: 25 },
  { code: "OBS-HR", label: "Observation care, per hour", low: 30, high: 150, note: "Long observation stays are sometimes billed when an inpatient or short stay was warranted — check the duration." },
  { code: "ED-FACILITY", label: "Emergency-department facility fee", low: 200, high: 1800, note: "Facility fees vary widely by acuity level; a high-level facility fee on a quick, low-acuity visit is a red flag." },
];

export interface CodingRule {
  category: "Upcoding" | "Duplicate Billing" | "Unbundled Supply Fee";
  rule: string;
}

export const CODING_RULES: CodingRule[] = [
  {
    category: "Upcoding",
    rule: "Evaluation & Management levels (e.g. 99281–99285) must match the documented complexity and acuity of care. A routine or low-acuity encounter billed at a high level (99284/99285) is a classic upcoding pattern.",
  },
  {
    category: "Duplicate Billing",
    rule: "The same room, asset, clinician, or supply charged more than once under slightly varied descriptions (e.g. 'ER ROOM' and 'TREATMENT RM') is a duplicate-billing pattern. Legitimate repeat services (e.g. a second X-ray) are not duplicates.",
  },
  {
    category: "Unbundled Supply Fee",
    rule: "Routine low-cost supplies (saline flushes, sterile gloves, basic bandages, standard kits) are generally bundled into the room or procedure fee under standard billing norms (e.g. CMS NCCI edits). A separate line item for them is a classic unbundling pattern.",
  },
  {
    category: "Upcoding",
    rule: "Emergency E/M levels run 99281 (minor) to 99285 (high complexity / threat to life or limb). The top levels (99284–99285) on an encounter that was quick or low-acuity is a common upcoding pattern.",
  },
  {
    category: "Upcoding",
    rule: "Time- or unit-based codes (e.g. IV infusion 96360 + add-on 96361) must match the documented duration. Extra add-on units beyond the recorded time are a quantity-upcoding pattern.",
  },
  {
    category: "Duplicate Billing",
    rule: "A professional (physician) fee and a facility fee for the same encounter are each legitimate ONCE. The same professional service billed twice, or two facility fees for a single visit, is a duplicate.",
  },
  {
    category: "Unbundled Supply Fee",
    rule: "Under CMS NCCI edits, components of a bundled service (e.g. venipuncture 36415 drawn for a lab panel, or the tray/kit used in a procedure) should not be separately payable when performed together.",
  },
];

/** Render the reference layer as a compact prompt block. */
export function buildReferenceBlock(): string {
  const anchors = RATE_ANCHORS.map((a) => {
    const range = `$${a.low}–$${a.high}`;
    return `- ${a.code} · ${a.label}: ${range}${a.note ? ` — ${a.note}` : ""}`;
  }).join("\n");

  const rules = CODING_RULES.map((r) => `- [${r.category}] ${r.rule}`).join("\n");

  return `Illustrative fair-price anchors (public-knowledge ranges — NOT a live quote for this facility):
${anchors}

Coding & bundling rules of thumb:
${rules}`;
}
