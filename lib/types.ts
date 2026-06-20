// Shared types for the MediAudit AI advocacy packet.
// These mirror the JSON schema enforced on the model in app/api/audit/route.ts.

export type AuditCategory =
  | "Upcoding"
  | "Duplicate Billing"
  | "Unbundled Supply Fee";

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
  /** Fair-market benchmark range, low and high bound. */
  benchmarkLow: number;
  benchmarkHigh: number;
  /** Regional database alignment confidence, 0–100. */
  confidence: number;
  /** 1–2 sentence, compliant rationale for the flag. */
  rationale: string;
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

export interface AuditResult {
  overview: Overview;
  decodedLines: DecodedLine[];
  discrepancies: Discrepancy[];
  /** The 3-paragraph phone advocacy script. */
  phoneScript: string[];
  roadmap: RoadmapStep[];
  safety: Safety;
}

export interface AuditRequestBody {
  region: string;
  ocrText: string;
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

/** Result of the Claude vision pass that reads a bill image/PDF. */
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
