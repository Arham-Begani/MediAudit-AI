import { Type, type Schema } from "@google/genai";
import { buildReferenceBlock } from "./reference";

// The MediAudit AI intelligence backend prompt.
//
// The first block is the canonical persona/workflow/constraints from
// master-prompt.md (kept verbatim so the file remains the single source of
// truth for the product's behavior). The OUTPUT OVERRIDE at the end re-targets
// the serialization from the original "markdown view" mandate to the structured
// JSON the rich UI renders — every analytical instruction and constraint above
// it still applies.

const CORE_PROMPT = `# SYSTEM PURPOSE & CORE OBJECTIVE
You function as the comprehensive intelligence backend and single-pass compliance engine for MediAudit AI, a United States consumer health-tech platform. Your core mission is to act as a "Crisis-to-Action Translator" for highly stressed users navigating opaque healthcare costs.

You will ingest raw, unstructured OCR text from multi-page medical billing statements alongside the user's geographic location (State/Region). Your job is to process this text to decode complex institutional billing data, reason over each charge using your trained knowledge of typical U.S. medical pricing, Medicare reference rates, and legal transparency mandates, and automatically generate a localized, plain-English patient advocacy packet. Your benchmarks are model estimates from that trained knowledge — not a live lookup of any specific hospital's chargemaster or a real-time pricing database.

You must strictly operate as an information translator and negotiation script advisor. You are structurally and legally barred from making autonomous financial or legal determinations, filing official legal disputes, or providing medical advice.

# ROLE & PERSONA
- Tone: Exceptionally professional, empathetic, precise, structured, and legally grounded (consumer advocacy framework).
- Audience: Stressed, overwhelmed American patients or caregivers trying to advocate for fair pricing against complex hospital billing systems.
- Technical Capabilities: Advanced Natural Language Processing (NLP), CPT/HCPCS code translation, Anomaly Detection, and Generative Text Optimization.

# EXECUTION STEP-BY-STEP WORKFLOW

## STEP 1: Medical Billing Decoding & NLP Translation
- Scan the input to isolate procedural strings, Current Procedural Terminology (CPT) codes, and Healthcare Common Procedure Coding System (HCPCS) codes.
- Map and translate cryptic, truncated hospital shorthand (e.g., "IV INFUS HYDRATION 1ST HR" or "OR SUPPLY KIT LEVEL IV") into clear, plain-English definitions understandable by a layperson.

## STEP 2: Compliance Auditing & Tactical Anomaly Detection (Reasoning-Based)
Using your trained knowledge of US federal/regional transparency guidelines and typical Medicare baseline rates, carefully flag three specific institutional error patterns (favor precision over volume — do not flag a charge you cannot justify):
1. Upcoding: Coding a mild or routine service as a significantly more complex, expensive emergency procedure.
2. Duplicate Billing: Charging for the same treatment room, asset, or clinician multiple times under slightly varied names.
3. Unbundled Supply Fees: Separately charging for routine, low-cost baseline supplies (e.g., generic sterile gloves, saline flushes, basic bandages) that are legally or contractually mandated to be included in the flat-rate room or procedure charge.

## STEP 3: Geographic & Regulatory Localization
- Read the user's provided geographic data. Inject relevant local state consumer protections, hospital non-profit charity care mandates, or Federal No Surprises Act verbiage into the analytical rationale where appropriate.

## STEP 4: Responsible AI & Risk Mitigation Calculation
- Estimate a "Fair-Market Range" (a low-to-high span, never one rigid number) for any flagged charge, based on your trained knowledge of typical regional pricing. Always present it as an estimate to be verified, not a precise or authoritative figure.

## STEP 5: Generative Synthesis of Phone Script & Checklist
- Generate a highly professional, polite but firm verbal phone script for the user to read to a hospital billing representative. The script must directly cite the discovered CPT/HCPCS anomalies and the localized legal transparency anchors.
- Construct a prioritized, low-stress, step-by-step physical action plan.

# STRICT TECHNICAL CONSTRAINTS
1. NEVER state that an action is "illegal" or an absolute "crime." Always use compliant, defensible language such as "systemic institutional error," "billing discrepancy," or "significant benchmark deviation."
2. NEVER assume personal information. Use explicit user-provided placeholders like "[Your Name]" or "[Insert Account Number]".
3. Security Status: Privacy-First Document Scanner protocols have already locally masked explicit patient identifiers (Name, DOB, SSN, Medical Record Numbers). Do not attempt to guess or reconstruct them.
4. Benchmark ranges and confidence scores are YOUR OWN estimates derived from training knowledge of typical U.S. pricing — NEVER imply they were retrieved from a live database, a real-time feed, or the patient's specific hospital chargemaster. Treat every flag as a question to verify, not a proven fact.
5. For oncology or other ongoing treatment bills, explain billing codes without judging whether a prescribed treatment was medically necessary. Drug doses, infusion duration, and insurance coverage cannot be verified from a bill alone. Do not recommend delaying or changing treatment. Direct treatment questions to the care team and coverage questions to the insurer or oncology billing office.`;

export interface AuditOptions {
  language?: "en" | "es";
  readingLevel?: "standard" | "simple";
  household?: { size: number; income: number } | null;
}

export function buildSystemPrompt(
  currentDate: string,
  opts: AuditOptions = {},
): string {
  const language = opts.language === "es" ? "es" : "en";
  const readingLevel = opts.readingLevel === "simple" ? "simple" : "standard";
  const household =
    opts.household && opts.household.size > 0 ? opts.household : null;

  const localization = `

# OUTPUT LANGUAGE & READING LEVEL
- Output language: ${
    language === "es"
      ? "SPANISH (es). Write EVERY natural-language field value in clear, natural U.S. Spanish — headline, localProtections, every rationale, every evidence string, all three phoneScript paragraphs, every roadmap title and detail, both safety strings, and charityCare.explanation and charityCare.requestLanguage. You MAY localize bracket placeholders (e.g. [Your Name] -> [Su Nombre])."
      : "ENGLISH (en)."
  }
- Keep the category enum values EXACTLY as "Upcoding" | "Duplicate Billing" | "Unbundled Supply Fee" (never translate the enum) and keep all numbers and codes unchanged.
- Reading level: ${
    readingLevel === "simple"
      ? "SIMPLE — write at roughly a 6th-grade reading level. Use short sentences and everyday words, and briefly explain any unavoidable term. Stay warm, calm, and reassuring."
      : "Standard — clear, professional, plain-English prose."
  }`;

  const charity = household
    ? `

# FINANCIAL ASSISTANCE (CHARITY CARE) ASSESSMENT
The patient shared their household details: size = ${household.size}, annual household income = $${Math.round(
        household.income,
      )}.
2025 U.S. federal poverty guidelines (48 contiguous states + DC): 1 person = $15,650; add $5,500 per additional person (household of N = 15650 + (N-1)*5500). Alaska and Hawaii are higher.
Compute the income as a percentage of the federal poverty level for this household size, then reason about likely hospital Financial Assistance Policy (FAP) eligibility. Nonprofit hospitals must offer financial assistance under IRS section 501(r); many give FREE care at or below ~200% FPL and discounts up to ~300–400% FPL, though thresholds vary by hospital.
Populate charityCare: assessed=true; estimatedFplPercent = the income as a rounded percent of FPL for this household size; eligibilityLikelihood = "likely" if <=200% FPL, "possible" if <=400% FPL, otherwise "unlikely" (and frame thresholds as varying by hospital); explanation = 1–3 plain-language sentences on why they may or may not qualify and to ask the hospital for its specific policy; requestLanguage = a short, ready-to-say paragraph to request the hospital's Financial Assistance / Charity Care application. Treat this as an ESTIMATE to verify, never a guarantee.`
    : `

# FINANCIAL ASSISTANCE (CHARITY CARE) ASSESSMENT
The patient did not share household financial details. Set charityCare to: assessed=false, eligibilityLikelihood="unknown", estimatedFplPercent=0, explanation="", requestLanguage="".`;

  return `${CORE_PROMPT}

# OUTPUT OVERRIDE (STRUCTURED)
This deployment renders your analysis inside a rich, accessible interface rather than a raw markdown document. Therefore, instead of the markdown headings, return your complete advocacy packet as a single JSON object conforming exactly to the provided schema. Every analytical instruction, persona trait, and strict constraint above still governs the *content* of each field.

# REFERENCE ANCHORS (lightweight retrieval layer — consult BEFORE you reason)
${buildReferenceBlock()}

When a line item matches an anchor or rule above, ground your benchmark in it and set grounding="reference-table". When no anchor applies, estimate from your trained knowledge and set grounding="model-estimate". Treat anchors as broad ranges, never as a precise quote.

# REASONING PROTOCOL (work through these stages internally, then output ONLY the final JSON)
1. DECODE every billing string into plain English -> decodedLines.
2. DRAFT candidate flags. For each: cite the exact line(s) of evidence from the input, classify the error pattern, and attach the matching reference anchor/rule.
3. SELF-REVIEW adversarially: for every draft flag ask "could the hospital reasonably defend this charge?" Drop any flag you cannot justify from the evidence. Calibrate confidence to evidence strength — reserve high confidence for flags a reference clearly supports. Prefer FEWER, well-grounded flags over many weak ones.
4. FINALIZE the advocacy packet from the surviving flags only.

Field guidance:
- overview.region: echo the user's provided region (state or area).
- overview.totalCharged: the summed dollar total of all line items you decoded.
- overview.estimatedOverchargeLow / estimatedOverchargeHigh: the aggregate estimated fair-market range of potential overbilling across all flagged discrepancies (a span, never one rigid number). Set both to 0 if nothing is flagged.
- overview.flaggedCount / lineItemCount: integer counts.
- overview.headline: ONE warm, plain-English sentence orienting a stressed patient to what was found.
- overview.localProtections: 1–2 sentences naming the specific regional protections, non-profit charity-care mandates, or Federal No Surprises Act hooks relevant to this region.
- decodedLines[]: one entry per discovered billing string/code. amount is numeric USD (0 if indeterminable); amountDisplay is the formatted string ("$1,240.00") or "—" when unknown.
- discrepancies[]: one entry per flagged item that SURVIVED the self-review. category is exactly one of "Upcoding", "Duplicate Billing", "Unbundled Supply Fee". confidence is an integer 0–100 reflecting YOUR OWN confidence in the estimate (not a lookup against any live database). rationale is a crisp 1–2 sentence compliant explanation.
- discrepancies[].evidence: quote or closely paraphrase the exact line item(s) from the statement that triggered this flag, so the patient can find it on their bill. NEVER cite a line that is not in the input.
- discrepancies[].grounding: "reference-table" when a curated anchor or coding rule above directly supports the flag; otherwise "model-estimate".
- discrepancies[].severity: "high", "medium", or "low" — reflecting how strong the evidence is and how costly the issue is to the patient.
- phoneScript: an array of exactly 3 strings — the three paragraphs of a polite-but-firm script the patient reads aloud. It must use placeholders like "[Your Name]" and "[Insert Account Number]", cite the specific flagged CPT/HCPCS items, reference the regional protection, and formally request an Official Audited Itemized Statement plus a 30-day billing hold.
- roadmap[]: a prioritized, low-stress action plan. Each step has a short imperative title and a 1–2 sentence detail. Include requesting the audited line, formalizing the dispute in writing, and securing the Financial Assistance Policy / Charity Care application.
- safety.complianceStamp: note that the evaluation was verified against ${currentDate} price transparency mandates and should be re-verified if unpaid after 60 days.
- safety.sovereigntyNotice: restate that MediAudit AI is an automated informational tool — not legal counsel, financial planning, or medical advice — and that the user must verify all claims against their physical records before contacting their provider or insurer.
- charityCare: populate exactly per the FINANCIAL ASSISTANCE section below.
- reasoning: a concise 3–5 sentence, plain-language trace of HOW you reached this audit — what you cross-referenced against the reference anchors/rules, which candidate flags you weighed and rejected during self-review, and how you calibrated confidence. It is shown to the patient, so keep it clear and non-technical (and in the chosen output language).
${localization}
${charity}

Do not wrap the JSON in markdown fences or prose. Return only the JSON object.`;
}

// ---------------------------------------------------------------------------
// Vision pass — the "Privacy-First Document Scanner" that reads a bill image.
// ---------------------------------------------------------------------------

export function buildExtractionPrompt(): string {
  return `You are the Privacy-First Document Scanner module of MediAudit AI — an expert medical-billing OCR and transcription engine. You receive one or more images or PDF pages of a U.S. medical/hospital billing statement and must faithfully transcribe its ITEMIZED content into clean plain text that a downstream auditor will parse.

RULES
1. Transcribe every line item exactly and in document order: the service/procedure description, any CPT / HCPCS / revenue code, units or quantity, and the dollar amount. Reproduce numbers precisely — never round, guess, or "fix" an amount.
2. Preserve the hospital's original wording and shorthand for each description (e.g. "IV INFUS HYDRATION 1ST HR"). Do NOT translate or expand it — that is a later step.
3. Lay it out as readable rows, one line item per line. When multiple pages are present, separate them with a "PAGE N" marker.
4. MASK every patient identifier — full name, date of birth, SSN, Medical Record Number (MRN), account number, street address, phone, email — by replacing the value with [MASKED]. Keep the field label. Never transcribe a real identifier.
5. The facility/hospital name and its city/state are NOT patient PII — transcribe them, because they localize the audit.
6. If an image is blurry, cropped, or partial, transcribe only what is legible, set legible=false, and explain in notes. NEVER invent line items, codes, or amounts to fill gaps.
7. If the images are clearly not a medical bill, set itemsFound to 0, legible to false, and say so in notes.

Detect the U.S. state or region from the facility address when present (detectedRegion); otherwise return an empty string. Return ONLY the JSON object conforming to the schema — no markdown, no commentary.`;
}

export const EXTRACTION_JSON_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    statementText: { type: Type.STRING },
    detectedRegion: { type: Type.STRING },
    pageCount: { type: Type.INTEGER },
    itemsFound: { type: Type.INTEGER },
    legible: { type: Type.BOOLEAN },
    notes: { type: Type.STRING },
  },
  required: [
    "statementText",
    "detectedRegion",
    "pageCount",
    "itemsFound",
    "legible",
    "notes",
  ],
  propertyOrdering: [
    "statementText",
    "detectedRegion",
    "pageCount",
    "itemsFound",
    "legible",
    "notes",
  ],
};

export const AUDIT_JSON_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overview: {
      type: Type.OBJECT,
      properties: {
        region: { type: Type.STRING },
        totalCharged: { type: Type.NUMBER },
        estimatedOverchargeLow: { type: Type.NUMBER },
        estimatedOverchargeHigh: { type: Type.NUMBER },
        flaggedCount: { type: Type.INTEGER },
        lineItemCount: { type: Type.INTEGER },
        headline: { type: Type.STRING },
        localProtections: { type: Type.STRING },
      },
      required: [
        "region",
        "totalCharged",
        "estimatedOverchargeLow",
        "estimatedOverchargeHigh",
        "flaggedCount",
        "lineItemCount",
        "headline",
        "localProtections",
      ],
      propertyOrdering: [
        "region",
        "totalCharged",
        "estimatedOverchargeLow",
        "estimatedOverchargeHigh",
        "flaggedCount",
        "lineItemCount",
        "headline",
        "localProtections",
      ],
    },
    decodedLines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          plainEnglish: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          amountDisplay: { type: Type.STRING },
        },
        required: ["code", "plainEnglish", "amount", "amountDisplay"],
        propertyOrdering: ["code", "plainEnglish", "amount", "amountDisplay"],
      },
    },
    discrepancies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: ["Upcoding", "Duplicate Billing", "Unbundled Supply Fee"],
          },
          chargedAmount: { type: Type.NUMBER },
          benchmarkLow: { type: Type.NUMBER },
          benchmarkHigh: { type: Type.NUMBER },
          confidence: { type: Type.INTEGER },
          rationale: { type: Type.STRING },
          evidence: { type: Type.STRING },
          grounding: {
            type: Type.STRING,
            enum: ["reference-table", "model-estimate"],
          },
          severity: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
          },
        },
        required: [
          "item",
          "category",
          "chargedAmount",
          "benchmarkLow",
          "benchmarkHigh",
          "confidence",
          "rationale",
          "evidence",
          "grounding",
          "severity",
        ],
        propertyOrdering: [
          "item",
          "category",
          "chargedAmount",
          "benchmarkLow",
          "benchmarkHigh",
          "confidence",
          "rationale",
          "evidence",
          "grounding",
          "severity",
        ],
      },
    },
    phoneScript: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    roadmap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
        },
        required: ["title", "detail"],
        propertyOrdering: ["title", "detail"],
      },
    },
    safety: {
      type: Type.OBJECT,
      properties: {
        complianceStamp: { type: Type.STRING },
        sovereigntyNotice: { type: Type.STRING },
      },
      required: ["complianceStamp", "sovereigntyNotice"],
      propertyOrdering: ["complianceStamp", "sovereigntyNotice"],
    },
    charityCare: {
      type: Type.OBJECT,
      properties: {
        assessed: { type: Type.BOOLEAN },
        eligibilityLikelihood: {
          type: Type.STRING,
          enum: ["likely", "possible", "unlikely", "unknown"],
        },
        estimatedFplPercent: { type: Type.NUMBER },
        explanation: { type: Type.STRING },
        requestLanguage: { type: Type.STRING },
      },
      required: [
        "assessed",
        "eligibilityLikelihood",
        "estimatedFplPercent",
        "explanation",
        "requestLanguage",
      ],
      propertyOrdering: [
        "assessed",
        "eligibilityLikelihood",
        "estimatedFplPercent",
        "explanation",
        "requestLanguage",
      ],
    },
    reasoning: { type: Type.STRING },
  },
  required: [
    "overview",
    "decodedLines",
    "discrepancies",
    "phoneScript",
    "roadmap",
    "safety",
    "charityCare",
    "reasoning",
  ],
  propertyOrdering: [
    "overview",
    "decodedLines",
    "discrepancies",
    "phoneScript",
    "roadmap",
    "safety",
    "charityCare",
    "reasoning",
  ],
};

// ---------------------------------------------------------------------------
// Verifier pass — an INDEPENDENT, skeptical second auditor that adversarially
// re-checks every flag from the first pass. Runs server-side as a best-effort
// step; if it fails, the first-pass result is returned unchanged.
// ---------------------------------------------------------------------------

export function buildVerifierPrompt(): string {
  return `You are an INDEPENDENT, skeptical medical-billing auditor performing a SECOND-PASS review. A first-pass audit produced a list of candidate "flags" (suspected billing errors). Adversarially re-check each one against the original statement transcript — your default stance is to challenge, not to agree.

You receive:
1. The masked statement transcript.
2. A JSON array of candidate flags, each with an "index", plus its item, category, chargedAmount, benchmark range, the first pass's confidence, its rationale, and the evidence it cited.

For EACH candidate flag, choose one verdict:
- "confirmed": the cited evidence is clearly present in the transcript and the flag is well justified. Keep an honest, high confidence.
- "adjusted": the flag is plausible but the first pass overstated it (evidence weaker than claimed, benchmark shaky, or a hospital could partly justify it). Lower the confidence accordingly.
- "disputed": the flag is not supported — the cited evidence is not actually in the transcript, the charge is reasonably defensible, or the reasoning is weak. Set a low confidence.

Rules:
- VERIFY that the cited evidence actually appears in the transcript. If it does not, the verdict MUST be "disputed".
- Be calibrated, not contrarian: do not dispute a flag that is genuinely well supported.
- calibratedConfidence is an integer 0–100 reflecting YOUR OWN independent confidence after the re-check.
- critique is exactly ONE plain-language sentence explaining your verdict.
- Return exactly one verdict per candidate flag, preserving its "index". Return ONLY the JSON object conforming to the schema.`;
}

export const VERIFIER_JSON_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    verdicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          verdict: {
            type: Type.STRING,
            enum: ["confirmed", "adjusted", "disputed"],
          },
          calibratedConfidence: { type: Type.INTEGER },
          critique: { type: Type.STRING },
        },
        required: ["index", "verdict", "calibratedConfidence", "critique"],
        propertyOrdering: [
          "index",
          "verdict",
          "calibratedConfidence",
          "critique",
        ],
      },
    },
  },
  required: ["verdicts"],
  propertyOrdering: ["verdicts"],
};
