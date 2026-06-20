import { NextResponse } from "next/server";
import {
  GEMINI_MODEL,
  getGeminiKey,
  makeClient,
  mapGeminiError,
  SAFETY_SETTINGS,
} from "@/lib/gemini";
import { AUDIT_JSON_SCHEMA, buildSystemPrompt } from "@/lib/system-prompt";
import type { AuditRequestBody, AuditResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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
        systemInstruction: buildSystemPrompt(today),
        responseMimeType: "application/json",
        responseSchema: AUDIT_JSON_SCHEMA,
        temperature: 0.35,
        maxOutputTokens: 16384,
        thinkingConfig: { thinkingBudget: -1 },
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

    return NextResponse.json(parsed);
  } catch (err) {
    const { message, status } = mapGeminiError(err);
    return jsonError(message, status);
  }
}
