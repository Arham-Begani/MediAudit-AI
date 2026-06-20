// Shared Gemini wiring for the two model passes (vision extraction + audit).
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type SafetySetting,
} from "@google/genai";

/** Strongest Gemini model by default; override with GEMINI_MODEL if desired. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-pro";

export function getGeminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
}

export function makeClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

// Medical-billing content is benign; turn the content filters off so a faithful
// audit of an itemized bill is never spuriously blocked.
export const SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.OFF }));

/** Map a Gemini SDK error to a user-facing message + HTTP status. */
export function mapGeminiError(err: unknown): { message: string; status: number } {
  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? (err as { status: number }).status
      : undefined;
  const msg = err instanceof Error ? err.message : String(err);

  if (status === 429 || /quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) {
    return { message: "Rate limited by Gemini. Please wait a moment and retry.", status: 429 };
  }
  if (
    status === 401 ||
    status === 403 ||
    /api[_ ]?key|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)
  ) {
    return {
      message: "The GEMINI_API_KEY was rejected or lacks access. Check the key in .env.local.",
      status: 401,
    };
  }
  return { message: `The request failed: ${msg}`, status: 502 };
}
