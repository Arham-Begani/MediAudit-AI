import { NextResponse } from "next/server";
import type { Part } from "@google/genai";
import {
  GEMINI_MODEL,
  getGeminiKey,
  makeClient,
  mapGeminiError,
  SAFETY_SETTINGS,
} from "@/lib/gemini";
import {
  buildExtractionPrompt,
  EXTRACTION_JSON_SCHEMA,
} from "@/lib/system-prompt";
import type { ExtractRequestBody, ExtractionResult, DocPart } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_DOCS = 8;
const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

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

  let body: ExtractRequestBody;
  try {
    body = (await req.json()) as ExtractRequestBody;
  } catch {
    return jsonError("Malformed request body.", 400);
  }

  const docs = Array.isArray(body.documents) ? body.documents : [];
  if (docs.length === 0) {
    return jsonError("Add at least one image or PDF of your bill.", 400);
  }
  if (docs.length > MAX_DOCS) {
    return jsonError(`Please upload at most ${MAX_DOCS} pages at once.`, 400);
  }

  const parts: Part[] = [];
  for (const doc of docs as DocPart[]) {
    if (!doc?.data) continue;
    if (doc.kind === "pdf" || doc.mediaType === "application/pdf") {
      parts.push({
        inlineData: { mimeType: "application/pdf", data: doc.data },
      });
    } else {
      const mimeType = ALLOWED_IMAGE.has(doc.mediaType) ? doc.mediaType : "image/jpeg";
      parts.push({ inlineData: { mimeType, data: doc.data } });
    }
  }

  if (parts.length === 0) {
    return jsonError("Could not read the uploaded files. Please try different images.", 400);
  }

  parts.push({
    text: "Read the attached medical billing statement page(s) and return the masked, faithful transcription as JSON per your rules.",
  });

  try {
    const ai = makeClient(apiKey);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: buildExtractionPrompt(),
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_JSON_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 12000,
        thinkingConfig: { thinkingBudget: -1 },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const text = response.text;
    if (!text || !text.trim()) {
      return jsonError(
        "The scanner returned no readable result. Please try a clearer image.",
        502,
      );
    }

    let parsed: ExtractionResult;
    try {
      parsed = JSON.parse(text) as ExtractionResult;
    } catch {
      return jsonError("The scan could not be parsed. Please try again.", 502);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const { message, status } = mapGeminiError(err);
    return jsonError(message, status);
  }
}
