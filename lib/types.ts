// Shared types for the MediAudit AI advocacy packet.
// These mirror the JSON schema enforced on the model in app/api/audit/route.ts.

export type AuditCategory =
  | "Upcoding"
  | "Duplicate Billing"
  | "Unbundled Supply Fee";

export type VerificationStatus = "confirmed" | "adjusted" | "disputed";

export interface DecodedLine {
  /** The raw scanned jargon, CPT, or HCPCS code as it appeared on the bill. */
  code: string;
  /** A clear, layperson-friendly definition of what the charge is. */
  plainEnglish: string;
  /** Numeric charged amount in USD. 0 if not determinable. */
  amount: number;
  /** Human-formatted amount, e.g. "$1,240.00" or "—" when unknown. */
  amountDisplay: string;
}

export interface Discrepancy {
  /** Name of the flagged procedure, asset, or supply. */
  item: string;
  category: AuditCategory;
  /** What the hospital charged for this item. */
  chargedAmount: number;
  /** Model-estimated fair-market benchmark range, low and high bound. */
  benchmarkLow: number;
  benchmarkHigh: number;
  /** The model's own confidence in this estimate, 0–100 (not a live database lookup). */
  confidence: number;
  /** 1–2 sentence, compliant rationale for the flag. */
  rationale: string;
  /** The exact line item(s) from the bill that triggered this flag. */
  evidence: string;
  /** Whether the benchmark came from a curated reference anchor or the model's own estimate. */
  grounding: "reference-table" | "model-estimate";
  /** How strong/costly the issue is. */
  severity: "high" | "medium" | "low";
  /**
   * Verdict from the independent second-pass verifier, merged in server-side.
   * Absent if the verifier did not run (e.g. it failed and we fell back).
   */
  verification?: {
    status: VerificationStatus;
    critique: string;
  };
}

export interface RoadmapStep {
  title: string;
  detail: string;
}

export interface Overview {
  region: string;
  totalCharged: number;
  estimatedOverchargeLow: number;
  estimatedOverchargeHigh: number;
  flaggedCount: number;
  lineItemCount: number;
  /** One-sentence, plain-English read on the situation. */
  headline: string;
  /** 1–2 sentence summary of the localized legal/consumer protections in play. */
  localProtections: string;
}

export interface Safety {
  complianceStamp: string;
  sovereigntyNotice: string;
}

export type OutputLanguage = "en" | "es";
export type ReadingLevel = "standard" | "simple";

export interface Household {
  size: number;
  income: number;
}

/** Estimated hospital financial-assistance (charity-care) eligibility. */
export interface CharityCare {
  /** True only when the patient supplied household details. */
  assessed: boolean;
  eligibilityLikelihood: "likely" | "possible" | "unlikely" | "unknown";
  /** Income as a percent of the federal poverty level (0 when not assessed). */
  estimatedFplPercent: number;
  explanation: string;
  /** A ready-to-say request for the hospital's financial-assistance application. */
  requestLanguage: string;
}

export interface AuditResult {
  overview: Overview;
  decodedLines: DecodedLine[];
  discrepancies: Discrepancy[];
  /** The 3-paragraph phone advocacy script. */
  phoneScript: string[];
  roadmap: RoadmapStep[];
  safety: Safety;
  charityCare: CharityCare;
  /** A concise, plain-language trace of how the audit reasoned. */
  reasoning: string;
}

/** One verdict from the independent second-pass verifier. */
export interface VerificationVerdict {
  /** Index into the first-pass discrepancies array. */
  index: number;
  verdict: VerificationStatus;
  /** Re-calibrated confidence after the skeptical re-check, 0–100. */
  calibratedConfidence: number;
  critique: string;
}

export interface VerifierResult {
  verdicts: VerificationVerdict[];
}

export interface AuditRequestBody {
  region: string;
  ocrText: string;
  language?: OutputLanguage;
  readingLevel?: ReadingLevel;
  household?: Household | null;
}

/** A user-supplied bill page sent to the vision extractor. */
export interface DocPart {
  kind: "image" | "pdf";
  mediaType: string;
  /** Base64-encoded bytes, no data-URL prefix. */
  data: string;
}

export interface ExtractRequestBody {
  documents: DocPart[];
}

/** Result of the Gemini vision pass that reads a bill image/PDF. */
export interface ExtractionResult {
  /** Faithful, PII-masked transcription of the itemized statement. */
  statementText: string;
  /** US state/region detected from the facility address ("" if none). */
  detectedRegion: string;
  /** Pages read. */
  pageCount: number;
  /** Itemized line items detected. */
  itemsFound: number;
  /** False when the image was too blurry/partial to read fully. */
  legible: boolean;
  /** Short note on read quality or anything the user should re-check. */
  notes: string;
}
