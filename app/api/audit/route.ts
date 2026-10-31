import { NextResponse } from "next/server";
import { finalizeAudit } from "@/lib/audit-integrity";
import {
  GEMINI_MODEL,
  getGeminiKey,
  makeClient,
  mapGeminiError,
  SAFETY_SETTINGS,
  THINKING_LEVEL,
} from "@/lib/gemini";
import {
  AUDIT_JSON_SCHEMA,
  buildSystemPrompt,
  buildVerifierPrompt,
  VERIFIER_JSON_SCHEMA,
} from "@/lib/system-prompt";
import type {
  AuditRequestBody,
  AuditResult,
  Discrepancy,
  VerificationVerdict,
  VerifierResult,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Independent second-pass verifier. Adversarially re-checks each first-pass
 * flag against the transcript and merges the verdict (calibrated confidence +
 * status + critique) back in. Best-effort: any failure returns the flags
 * unchanged so the verifier can never break the audit.
 */
async function verifyDiscrepancies(
  ai: ReturnType<typeof makeClient>,
  transcript: string,
  discrepancies: Discrepancy[],
): Promise<Discrepancy[]> {
  try {
    const candidates = discrepancies.map((d, index) => ({
      index,
      item: d.item,
      category: d.category,
      chargedAmount: d.chargedAmount,
      benchmarkLow: d.benchmarkLow,
      benchmarkHigh: d.benchmarkHigh,
      confidence: d.confidence,
      rationale: d.rationale,
      evidence: d.evidence,
    }));

    const payload = [
      "[Statement transcript]:",
      transcript,
      "",
      "[Candidate flags to re-check]:",
      JSON.stringify(candidates, null, 2),
    ].join("\n");

    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: payload,
      config: {
        systemInstruction: buildVerifierPrompt(),
        responseMimeType: "application/json",
        responseSchema: VERIFIER_JSON_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: THINKING_LEVEL },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const text = res.text;
    if (!text || !text.trim()) return discrepancies;

    const verifier = JSON.parse(text) as VerifierResult;
    const byIndex = new Map<number, VerificationVerdict>();
    for (const v of verifier.verdicts ?? []) {
      if (typeof v?.index === "number") byIndex.set(v.index, v);
    }

    return discrepancies.map((d, i) => {
      const v = byIndex.get(i);
      if (!v) return d;
      const conf =
        typeof v.calibratedConfidence === "number"
          ? Math.max(0, Math.min(100, Math.round(v.calibratedConfidence)))
          : d.confidence;
      return {
        ...d,
        confidence: conf,
        verification: { status: v.verdict, critique: v.critique ?? "" },
      };
    });
  } catch {
    return discrepancies;
  }
}

export async function POST(req: Request) {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return jsonError(
      "The server is missing a GEMINI_API_KEY. Add your key to .env.local and restart the dev server.",
      503,
    );
  }

  let body: AuditRequestBody;
  try {
    body = (await req.json()) as AuditRequestBody;
  } catch {
    return jsonError("Malformed request body.", 400);
  }

  const region = (body.region ?? "").trim();
  const ocrText = (body.ocrText ?? "").trim();
  const language = body.language === "es" ? "es" : "en";
  const readingLevel = body.readingLevel === "simple" ? "simple" : "standard";
  const household =
    body.household &&
    typeof body.household.size === "number" &&
    typeof body.household.income === "number" &&
    body.household.size > 0
      ? { size: body.household.size, income: body.household.income }
      : null;

  if (!region) return jsonError("Please select a state or region.", 400);
  if (ocrText.length < 20) {
    return jsonError(
      "Please paste the itemized text from your statement (at least a few lines).",
      400,
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const userPayload = [
    `[Geographic Context]: ${region}`,
    "",
    "[Security Status]: Patient identifiers (Name, DOB, SSN, MRN, Account No.) have already been locally masked by the Privacy-First Document Scanner. Do not reconstruct them.",
    "",
    "[Raw OCR Input]:",
    ocrText,
  ].join("\n");

  try {
    const ai = makeClient(apiKey);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPayload,
      config: {
        systemInstruction: buildSystemPrompt(today, {
          language,
          readingLevel,
          household,
        }),
        responseMimeType: "application/json",
        responseSchema: AUDIT_JSON_SCHEMA,
        temperature: 0.35,
        maxOutputTokens: 16384,
        thinkingConfig: { thinkingLevel: THINKING_LEVEL },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const text = response.text;
    if (!text || !text.trim()) {
      return jsonError(
        "The model returned no analysis. Please try again in a moment.",
        502,
      );
    }

    let parsed: AuditResult;
    try {
      parsed = JSON.parse(text) as AuditResult;
    } catch {
      return jsonError("The analysis could not be parsed. Please try again.", 502);
    }

    // Independent second-pass verification (best-effort — never blocks the result).
    if (Array.isArray(parsed.discrepancies) && parsed.discrepancies.length > 0) {
      parsed.discrepancies = await verifyDiscrepancies(
        ai,
        ocrText,
        parsed.discrepancies,
      );
    }

    return NextResponse.json(finalizeAudit(parsed, today, language));
  } catch (err) {
    const { message, status } = mapGeminiError(err);
    return jsonError(message, status);
  }
}
