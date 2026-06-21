"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertIcon,
  ArrowRight,
  CameraIcon,
  CheckIcon,
  ChevronDown,
  CloseIcon,
  CopyIcon,
  DecodeIcon,
  FileIcon,
  ImageIcon,
  LockIcon,
  PenIcon,
  PhoneIcon,
  PinIcon,
  PulseIcon,
  RefreshIcon,
  ScaleIcon,
  ScanIcon,
  ShieldIcon,
  SparkleIcon,
  StampIcon,
  UploadIcon,
} from "./components/icons";
import { ThemeToggle } from "./components/ThemeToggle";
import { SAMPLE_BILL, SAMPLE_REGION } from "@/lib/sample";
import type {
  AuditResult,
  Discrepancy,
  DecodedLine,
  ExtractionResult,
  OutputLanguage,
  ReadingLevel,
} from "@/lib/types";

const US_REGIONS = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois",
  "Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts",
  "Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota",
  "Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington",
  "West Virginia","Wisconsin","Wyoming",
];

const EXTRACT_STAGES = [
  { icon: CameraIcon, label: "Reading your uploaded pages with vision" },
  { icon: DecodeIcon, label: "Transcribing every line item & code" },
  { icon: LockIcon, label: "Masking any patient identifiers" },
];

const LOAD_STAGES = [
  { icon: DecodeIcon, label: "Decoding billing strings, CPT & HCPCS codes" },
  { icon: PulseIcon, label: "Cross-referencing charges against coding rules & anchors" },
  { icon: ShieldIcon, label: "Independently re-checking each flag (2nd AI pass)" },
  { icon: PinIcon, label: "Localizing your state consumer protections" },
  { icon: PhoneIcon, label: "Drafting your advocacy script & action plan" },
];

const MAX_DOCS = 30;
const MAX_BYTES = 14 * 1024 * 1024;

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const usdExact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(n) ? n : 0);

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function renderScriptLine(text: string) {
  return text.split(/(\[[^\]]+\])/g).map((seg, i) =>
    /^\[[^\]]+\]$/.test(seg) ? (
      <span className="ph" key={i}>
        {seg}
      </span>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
}

type UploadedDoc = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: "image" | "pdf";
  mediaType: string;
  data: string;
  preview: string | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function downscaleImage(
  file: File,
): Promise<{ data: string; mediaType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
      resolve({
        data: dataUrl.split(",")[1] ?? "",
        mediaType: "image/jpeg",
        preview: dataUrl,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

async function processFile(file: File): Promise<UploadedDoc | null> {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  try {
    if (isPdf) {
      const data = await fileToBase64(file);
      return {
        id,
        name: file.name,
        sizeLabel: fmtBytes(file.size),
        kind: "pdf",
        mediaType: "application/pdf",
        data,
        preview: null,
      };
    }
    const { data, mediaType, preview } = await downscaleImage(file);
    return {
      id,
      name: file.name,
      sizeLabel: fmtBytes(file.size),
      kind: "image",
      mediaType,
      data,
      preview,
    };
  } catch {
    try {
      const data = await fileToBase64(file);
      return {
        id,
        name: file.name,
        sizeLabel: fmtBytes(file.size),
        kind: "image",
        mediaType: file.type || "image/jpeg",
        data,
        preview: null,
      };
    } catch {
      return null;
    }
  }
}

// Keep just under the route's 120s maxDuration so a genuinely slow audit still
// completes, but a hung request eventually fails with a clear message instead of
// spinning forever during a live demo.
const REQUEST_TIMEOUT_MS = 115_000;

async function fetchJSON(
  url: string,
  body: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const isTimeout = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";

// Read a response without throwing on a non-JSON body (e.g. a crashed route
// returning an HTML 500 page), so the UI can show the real status instead of a
// misleading "could not reach" message.
async function readJson(res: Response): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
}> {
  const raw = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

// --- Console control styling (kept inline so no new CSS is needed) ---
const SEG_GROUP: CSSProperties = {
  display: "inline-flex",
  gap: 4,
  padding: 4,
  border: "1px solid var(--line-strong)",
  borderRadius: 999,
  background: "var(--card)",
};
const seg = (active: boolean): CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  background: active ? "var(--mint)" : "transparent",
  color: active ? "var(--on-dark)" : "var(--ink-soft)",
});
const FIELD_INPUT: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  background: "var(--card)",
  color: "var(--ink)",
  fontSize: 14,
  fontFamily: "inherit",
};
const TEXTAREA: CSSProperties = {
  ...FIELD_INPUT,
  resize: "vertical",
  fontFamily: "var(--font-mono), monospace",
  fontSize: 13,
  lineHeight: 1.5,
};

// Sourced context for the landing page (Problem-Understanding signal).
const STATS = [
  { big: "~100M", label: "U.S. adults carry health-care debt", src: "KFF, 2022" },
  { big: "$195B+", label: "owed in medical debt nationwide", src: "KFF · U.S. Census SIPP" },
  {
    big: "§501(r)",
    label: "requires nonprofit hospitals to offer financial assistance",
    src: "IRS / ACA",
  },
];

// Result-screen labels in both supported languages. The model writes the
// *content* in the selected language; this dictionary covers the static chrome.
const UI: Record<OutputLanguage, Record<string, string>> = {
  en: {
    dossier: "Patient Advocacy Dossier",
    lineItems: "LINE ITEMS",
    flagged: "FLAGGED",
    newAudit: "New audit",
    glance: "At a glance",
    totalCharged: "Total charged",
    decodedItems: "decoded line items",
    flaggedCharges: "Flagged charges",
    potentialErrors: "Potential institutional errors",
    estOverbilling: "Est. overbilling",
    fairRangeFoot: "Estimated fair-market range",
    leverage: "Your leverage",
    strong: "Strong",
    clean: "Clean",
    leverageStrong: "Documented basis to dispute",
    leverageClean: "No anomalies detected",
    protectionsLead: "Protections in play for",
    part: "PART",
    p1: "Line-by-line translation",
    p1sub: "items decoded",
    colCode: "Scanned code / jargon",
    colMeaning: "Plain-English meaning",
    colCharged: "Charged",
    flag: "flag",
    p2: "Detected discrepancies",
    nothingFlagged: "Nothing flagged",
    flaggedCharge: "flagged charge",
    flaggedChargePl: "flagged charges",
    estDisclaimer:
      "These benchmark ranges and confidence scores are AI estimates from the model's training knowledge of typical U.S. pricing — not a live lookup of your hospital's chargemaster or a Medicare database. Treat each flag as a question to raise and verify against your itemized statement, not proof of an error.",
    noneMsg:
      "No upcoding, duplicate billing, or unbundled supply fees were detected. Your roadmap still helps you request an audited statement and a charity-care review.",
    confidence: "Confidence",
    hospCharge: "Hospital charge",
    fairRange: "Fair-market range",
    onBill: "On your bill:",
    refGrounded: "reference-grounded",
    modelEst: "model estimate",
    p3: "Your phone advocacy script",
    p3sub: "Polite. Firm. Evidence-led.",
    readToDept: "Read this to the billing department",
    replaceNote1: "Replace each",
    bracketSample: "[bracketed]",
    replaceNote2: "field with your own details before calling.",
    copy: "Copy script",
    copied: "Copied",
    p4: "Your step-by-step roadmap",
    done: "done",
    step: "STEP",
    allDone: "All steps complete — well advocated.",
    stepsRemaining: "steps remaining",
    p5: "Human-in-the-loop verification",
    p5sub: "You stay in control",
    complianceStamp: "Compliance stamp",
    sovereignty: "Patient sovereignty notice",
    copyMy: "Copy my phone script",
    scriptCopied: "Script copied",
    auditAnother: "Audit another bill",
    charityTitle: "Financial assistance you may qualify for",
    ofFpl: "of the federal poverty level",
    askScript: "Ask for it — you can say:",
    copyRequest: "Copy request",
    likely: "Likely eligible",
    possible: "Possibly eligible",
    unlikely: "May not qualify",
    unknown: "Unknown",
    vConfirmed: "verified",
    vAdjusted: "adjusted on review",
    vDisputed: "disputed on review",
    reviewNote:
      "Every flag was independently re-checked by a second AI verification pass.",
    reasoningTitle: "How the AI reasoned",
    helpTitle: "Where to get more help",
    helpSub: "Free services & advocates",
    printSave: "Save / Print",
  },
  es: {
    dossier: "Expediente de defensa del paciente",
    lineItems: "CONCEPTOS",
    flagged: "MARCADOS",
    newAudit: "Nuevo análisis",
    glance: "Resumen",
    totalCharged: "Total cobrado",
    decodedItems: "conceptos descifrados",
    flaggedCharges: "Cargos marcados",
    potentialErrors: "Posibles errores institucionales",
    estOverbilling: "Sobrecargo estimado",
    fairRangeFoot: "Rango estimado de mercado justo",
    leverage: "Su ventaja",
    strong: "Sólida",
    clean: "Limpia",
    leverageStrong: "Base documentada para disputar",
    leverageClean: "No se detectaron anomalías",
    protectionsLead: "Protecciones aplicables para",
    part: "PARTE",
    p1: "Traducción concepto por concepto",
    p1sub: "conceptos descifrados",
    colCode: "Código / jerga",
    colMeaning: "Significado claro",
    colCharged: "Cobrado",
    flag: "alerta",
    p2: "Discrepancias detectadas",
    nothingFlagged: "Nada marcado",
    flaggedCharge: "cargo marcado",
    flaggedChargePl: "cargos marcados",
    estDisclaimer:
      "Estos rangos de referencia y niveles de confianza son estimaciones de la IA basadas en su conocimiento de precios típicos en EE. UU., no una consulta en vivo del tarifario de su hospital ni de una base de datos de Medicare. Tome cada alerta como una pregunta para plantear y verificar con su factura detallada, no como prueba de un error.",
    noneMsg:
      "No se detectó sobrecodificación, facturación duplicada ni cargos de insumos desagrupados. Su plan de acción aún le ayuda a pedir una factura auditada y una revisión de ayuda financiera.",
    confidence: "Confianza",
    hospCharge: "Cargo del hospital",
    fairRange: "Rango de mercado justo",
    onBill: "En su factura:",
    refGrounded: "con referencia",
    modelEst: "estimación del modelo",
    p3: "Su guion para abogar por teléfono",
    p3sub: "Cortés. Firme. Con evidencia.",
    readToDept: "Lea esto al departamento de facturación",
    replaceNote1: "Reemplace cada campo",
    bracketSample: "[entre corchetes]",
    replaceNote2: "con sus propios datos antes de llamar.",
    copy: "Copiar guion",
    copied: "Copiado",
    p4: "Su plan paso a paso",
    done: "hechos",
    step: "PASO",
    allDone: "Todos los pasos completos — bien defendido.",
    stepsRemaining: "pasos restantes",
    p5: "Verificación con supervisión humana",
    p5sub: "Usted mantiene el control",
    complianceStamp: "Sello de cumplimiento",
    sovereignty: "Aviso de soberanía del paciente",
    copyMy: "Copiar mi guion",
    scriptCopied: "Guion copiado",
    auditAnother: "Analizar otra factura",
    charityTitle: "Ayuda financiera para la que podría calificar",
    ofFpl: "del nivel federal de pobreza",
    askScript: "Pídala — puede decir:",
    copyRequest: "Copiar solicitud",
    likely: "Probablemente elegible",
    possible: "Posiblemente elegible",
    unlikely: "Podría no calificar",
    unknown: "Desconocido",
    vConfirmed: "verificado",
    vAdjusted: "ajustado tras revisión",
    vDisputed: "en disputa tras revisión",
    reviewNote:
      "Cada alerta fue verificada de forma independiente por una segunda revisión de IA.",
    reasoningTitle: "Cómo razonó la IA",
    helpTitle: "Dónde encontrar más ayuda",
    helpSub: "Servicios y defensores gratuitos",
    printSave: "Guardar / Imprimir",
  },
};

const CAT: Record<OutputLanguage, Record<Discrepancy["category"], string>> = {
  en: {
    Upcoding: "Upcoding",
    "Duplicate Billing": "Duplicate Billing",
    "Unbundled Supply Fee": "Unbundled Supply Fee",
  },
  es: {
    Upcoding: "Sobrecodificación",
    "Duplicate Billing": "Facturación duplicada",
    "Unbundled Supply Fee": "Insumo desagrupado",
  },
};

const SEV: Record<OutputLanguage, Record<"high" | "medium" | "low", string>> = {
  en: { high: "high", medium: "medium", low: "low" },
  es: { high: "alta", medium: "media", low: "baja" },
};

// Real service-navigation resources (matches the brief's "find support" goal
// and partner inspiration: 211.org, etc.). These help users *act*.
const RESOURCES = [
  {
    name: "211.org",
    url: "https://www.211.org",
    en: "Free, 24/7 help finding local food, housing, and health services (United Way).",
    es: "Ayuda gratuita 24/7 para encontrar comida, vivienda y servicios de salud locales (United Way).",
  },
  {
    name: "Dollar For",
    url: "https://dollarfor.org",
    en: "A nonprofit that helps you apply for hospital charity care and clear medical bills.",
    es: "Organización sin fines de lucro que le ayuda a solicitar ayuda caritativa y eliminar facturas médicas.",
  },
  {
    name: "Patient Advocate Foundation",
    url: "https://www.patientadvocate.org",
    en: "Free case managers for people facing medical debt and insurance problems.",
    es: "Gestores de casos gratuitos para personas con deudas médicas y problemas de seguro.",
  },
  {
    name: "No Surprises Help Desk",
    url: "https://www.cms.gov/nosurprises",
    en: "Federal help line for surprise medical bills: 1-800-985-3059.",
    es: "Línea federal de ayuda para facturas médicas sorpresa: 1-800-985-3059.",
  },
];

// The end-to-end agentic flow, shown on the landing page so the system is
// legible (input -> AI -> output) — what the Solution Design criterion rewards.
const PIPELINE: { label: string; kind: "io" | "ai" }[] = [
  { label: "Your bill (photo / text)", kind: "io" },
  { label: "Vision OCR + PII masking", kind: "ai" },
  { label: "Retrieve: reference KB", kind: "ai" },
  { label: "Reason + self-review", kind: "ai" },
  { label: "Independent verifier", kind: "ai" },
  { label: "Plain-English dossier", kind: "io" },
];

// The brief requires all three: a named risk, a concrete mitigation, and a
// human-in-the-loop. Stated plainly on the landing page.
const RESPONSIBLE = [
  {
    tag: "The risk",
    h: "AI can be wrong",
    p: "A stressed person might treat an AI estimate as proven fact, or lean on it instead of checking their own records.",
  },
  {
    tag: "The safeguard",
    h: "Estimates, labeled & re-checked",
    p: "Every benchmark is marked an AI estimate, re-checked by an independent second pass, and shown with a confidence score and the exact line from your bill.",
  },
  {
    tag: "You decide",
    h: "A human stays in control",
    p: "MediAudit never decides whether to dispute or pay, and never files anything. You verify against your records and make the call.",
  },
];

type Phase = "idle" | "extracting" | "loading" | "done";

export default function Home() {
  const [region, setRegion] = useState("");
  const [files, setFiles] = useState<UploadedDoc[]>([]);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [pastedText, setPastedText] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>("en");
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("standard");
  const [showAssist, setShowAssist] = useState(false);
  const [householdSize, setHouseholdSize] = useState("");
  const [householdIncome, setHouseholdIncome] = useState("");

  const consoleRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "extracting" || phase === "loading";

  useEffect(() => {
    if (!busy) return;
    setStage(0);
    const stages = phase === "extracting" ? EXTRACT_STAGES : LOAD_STAGES;
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, stages.length - 1));
    }, phase === "extracting" ? 3000 : 4200);
    return () => clearInterval(id);
  }, [phase, busy]);

  useEffect(() => {
    if (busy) loadingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (phase === "done") resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase, busy]);

  async function addFiles(list: FileList | File[]) {
    setError(null);
    const incoming = Array.from(list).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf" || /\.pdf$/i.test(f.name),
    );
    if (incoming.length === 0) {
      setError("Please add image files (JPG, PNG, WebP) or a PDF.");
      return;
    }
    const room = MAX_DOCS - files.length;
    const slice = incoming.slice(0, Math.max(0, room));
    const processed: UploadedDoc[] = [];
    for (const f of slice) {
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" is too large. Please keep each file under 14 MB.`);
        continue;
      }
      const doc = await processFile(f);
      if (doc) processed.push(doc);
    }
    if (processed.length) setFiles((prev) => [...prev, ...processed]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function runSample() {
    if (busy) return;
    setError(null);
    setResult(null);
    setFiles([]);
    setExtraction(null);
    setRegion(SAMPLE_REGION);
    setPhase("loading");
    await doAudit(SAMPLE_BILL, SAMPLE_REGION);
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setError(null);
    consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function doExtract(): Promise<ExtractionResult | null> {
    try {
      const res = await fetchJSON("/api/extract", {
        documents: files.map((f) => ({
          kind: f.kind,
          mediaType: f.mediaType,
          data: f.data,
        })),
      });
      const { ok, status, data } = await readJson(res);
      if (!ok || !data) {
        const msg = typeof data?.error === "string" ? data.error : null;
        setError(
          msg ??
            `The scanner returned an unexpected response (HTTP ${status}). Check the server terminal for the error, then retry.`,
        );
        return null;
      }
      const ex = data as unknown as ExtractionResult;
      setExtraction(ex);
      if (ex.detectedRegion && !region) {
        const match = US_REGIONS.find(
          (r) => r.toLowerCase() === ex.detectedRegion.trim().toLowerCase(),
        );
        if (match) setRegion(match);
      }
      return ex;
    } catch (e) {
      console.error("extract request failed:", e);
      setError(
        isTimeout(e)
          ? "Reading the pages timed out. Try fewer or smaller images, then retry."
          : "Couldn't reach the scanner — is the dev server running? Check its terminal, then retry.",
      );
      return null;
    }
  }

  async function doAudit(text: string, regionArg: string = region) {
    const household =
      householdSize && householdIncome && Number(householdSize) > 0
        ? { size: Number(householdSize), income: Number(householdIncome) }
        : null;
    try {
      const res = await fetchJSON("/api/audit", {
        region: regionArg,
        ocrText: text,
        language,
        readingLevel,
        household,
      });
      const { ok, status, data } = await readJson(res);
      if (!ok || !data) {
        const msg = typeof data?.error === "string" ? data.error : null;
        setError(
          msg ??
            `The analysis service returned an unexpected response (HTTP ${status}). Check the server terminal for the error, then retry.`,
        );
        setPhase("idle");
        return;
      }
      setResult(data as unknown as AuditResult);
      setPhase("done");
    } catch (e) {
      console.error("audit request failed:", e);
      setError(
        isTimeout(e)
          ? "The audit timed out. Try again, run the sample bill, or set GEMINI_THINKING_LEVEL=MINIMAL."
          : "Couldn't reach the analysis service — is the dev server running? Check its terminal for the error, then retry.",
      );
      setPhase("idle");
    }
  }

  async function runFull() {
    if (!region) {
      setError("Please choose your state or region first.");
      return;
    }
    const pasted = pastedText.trim();
    if (files.length === 0 && pasted.length < 20) {
      setError("Upload a photo of your bill, or paste its itemized text below.");
      return;
    }

    setError(null);
    setResult(null);

    // No photo? Skip the vision scan and audit the pasted text directly.
    if (files.length === 0) {
      setPhase("loading");
      await doAudit(pasted);
      return;
    }

    setPhase("extracting");
    const ex = await doExtract();
    if (!ex) {
      setPhase("idle");
      return;
    }
    const text = (ex.statementText ?? "").trim();
    if (text.length < 20) {
      setError(
        "The scan didn't find itemized text. Try clearer photos, or paste the text instead.",
      );
      setPhase("idle");
      return;
    }

    setPhase("loading");
    await doAudit(text);
  }

  const activeStages = phase === "extracting" ? EXTRACT_STAGES : LOAD_STAGES;

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="mark">
            <ScanIcon style={{ color: "var(--on-dark)" }} />
          </span>
          <span>
            <b>MediAudit</b> <span className="ai">AI</span>
          </span>
        </div>
        <nav>
          <a href="#how">How it works</a>
          <a href="#audit">Run an audit</a>
          <a className="pill-link" href="#audit">
            Decode my bill
          </a>
          <ThemeToggle />
        </nav>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="reveal" style={{ animationDelay: "0.05s" }}>
          <span className="hero-tag">
            <span className="dot" />
            Crisis-to-Action Translator · for patients &amp; caregivers
          </span>
          <h1>
            Snap your medical bill.{" "}
            <em>Read</em> it in <span className="underline">plain English</span>.
          </h1>
          <p className="lede">
            When Rosa&apos;s father came home from the ER, the $7,811 bill made
            no sense — dozens of codes, no explanation, a looming due date.
            MediAudit AI reads <em>that</em> bill with vision, turns it into
            plain English, flags what to question, and hands her a checklist and
            the exact words to say on the phone — moving a stressed caregiver
            from confusion to a clear next step.
          </p>
          <div className="hero-cta">
            <button
              className="btn btn-primary btn-arrow"
              onClick={runSample}
              disabled={busy}
            >
              Try a sample bill <ArrowRight />
            </button>
            <a className="btn btn-ghost" href="#how">
              How it works
            </a>
          </div>
          <div className="trustline">
            <span>
              <CameraIcon /> Reads photos &amp; PDFs
            </span>
            <span>
              <LockIcon /> Identifiers masked on read
            </span>
            <span>
              <ScaleIcon /> Grounded in transparency law
            </span>
          </div>
        </div>

        <div className="scan-stage reveal" style={{ animationDelay: "0.18s" }}>
          <div className="statement" aria-hidden="true">
            <div className="scan-beam" />
            <div className="st-head">
              <b>Itemized Statement</b>
              <span>PG 1/2</span>
            </div>
            <div className="st-row">
              <span className="desc">
                PATIENT <span className="redact" style={{ width: 64 }} />
              </span>
              <span className="amt">—</span>
            </div>
            <div className="st-row">
              <span className="desc">99285 ER VISIT EM LVL 5</span>
              <span className="amt">1,842</span>
            </div>
            <div className="st-row flag-row">
              <span className="desc">ER ROOM TREAT RM ×2</span>
              <span className="amt">960</span>
            </div>
            <div className="st-row">
              <span className="desc">96360 IV HYDRATION 1ST HR</span>
              <span className="amt">445</span>
            </div>
            <div className="st-row flag-row">
              <span className="desc">SALINE FLUSH 10ML ×3</span>
              <span className="amt">54</span>
            </div>
            <div className="st-row flag-row">
              <span className="desc">OR SUPPLY KIT LEVEL IV</span>
              <span className="amt">690</span>
            </div>
            <div className="st-row">
              <span className="desc">
                MRN <span className="redact" style={{ width: 48 }} />
              </span>
              <span className="amt">
                <span className="redact" style={{ width: 30 }} />
              </span>
            </div>
            <div className="st-foot">
              <span>BALANCE</span>
              <span>$7,811</span>
            </div>
          </div>
          <div className="float-chip a">
            <span className="t" style={{ background: "var(--clay-soft)" }} />
            Unbundled supply fee
          </div>
          <div className="float-chip b">
            <span className="t" style={{ background: "var(--mint)" }} />
            Fair range: $40–$95
          </div>
        </div>
      </section>

      {/* WHY THIS MATTERS */}
      <section className="section" aria-label="Why this matters">
        <div className="section-head">
          <div>
            <span className="eyebrow">Why this matters</span>
            <h2 style={{ marginTop: 10 }}>Medical debt is a community crisis.</h2>
          </div>
          <p>
            Tens of millions of families carry it — and confusing, error-prone
            bills make it worse. MediAudit AI helps anyone push back.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {STATS.map((s) => (
            <div
              key={s.big}
              style={{
                padding: "22px 20px",
                border: "1px solid var(--card-edge)",
                borderRadius: 16,
                background: "var(--card)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display), serif",
                  fontSize: 34,
                  fontWeight: 600,
                  color: "var(--clay)",
                  lineHeight: 1,
                }}
              >
                {s.big}
              </div>
              <div
                style={{ marginTop: 10, color: "var(--ink)", fontWeight: 600 }}
              >
                {s.label}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--ink-faint)",
                }}
              >
                Source: {s.src}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="section-head">
          <div>
            <span className="eyebrow">The method</span>
            <h2 style={{ marginTop: 10 }}>
              A self-verifying Gemini 3 Flash pipeline.
            </h2>
          </div>
          <p>
            A vision read followed by a high-effort reasoning audit turns a
            photo of a bill into an evidence-backed case you can act on.
          </p>
        </div>
        <div className="steps-strip">
          {[
            {
              n: "01",
              h: "Read the page",
              p: "Vision transcribes every line item from your photo or PDF and masks patient identifiers on the way in.",
            },
            {
              n: "02",
              h: "Cross-reference & verify",
              p: "Each charge is checked against curated coding rules and price anchors, then every flag is re-checked by an independent second AI pass that confirms, recalibrates, or disputes it.",
            },
            {
              n: "03",
              h: "Arm you to act",
              p: "You get a localized phone script and a low-stress, step-by-step roadmap to dispute with confidence.",
            },
          ].map((s) => (
            <div className="step-card" key={s.n}>
              <div className="num">{s.n}</div>
              <h4>{s.h}</h4>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 22,
            padding: "16px 20px",
            border: "1px dashed var(--line-strong)",
            borderRadius: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.6,
          }}
        >
          <b style={{ color: "var(--ink)" }}>Why AI, not just a web search?</b>{" "}
          A search engine can&apos;t read <em>your</em> photographed bill, decode{" "}
          <em>your</em> specific CPT/HCPCS codes, or write next steps tailored to
          your charges and your state. MediAudit reads the actual document and
          personalizes every step — in seconds.
        </div>

        <div style={{ marginTop: 26 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              marginBottom: 12,
            }}
          >
            The AI pipeline
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            {PIPELINE.map((node, i) => (
              <span
                key={node.label}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    padding: "8px 13px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    color: "var(--ink)",
                    border:
                      node.kind === "io"
                        ? "1px solid var(--mint)"
                        : "1px solid var(--line-strong)",
                    background:
                      node.kind === "io" ? "var(--mint-glow)" : "var(--card)",
                  }}
                >
                  {node.label}
                </span>
                {i < PIPELINE.length - 1 && (
                  <span style={{ color: "var(--ink-faint)", fontWeight: 700 }}>
                    →
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CONSOLE */}
      <section className="section" id="audit" ref={consoleRef}>
        <div className="section-head">
          <div>
            <span className="eyebrow">Run an audit</span>
            <h2 style={{ marginTop: 10 }}>Upload your bill.</h2>
          </div>
          <p>
            Snap photos or drop scans of every page — up to {MAX_DOCS} at once.
            We never need — and never store — your identity.
          </p>
        </div>

        <div className="console">
          <div className="console-inner">
            <div className="console-top">
              <div className="dots">
                <i />
                <i />
                <i />
              </div>
              <span className="label">
                <SparkleIcon style={{ width: 13, height: 13, verticalAlign: -2 }} />{" "}
                Privacy-First Document Scanner · Gemini 3 Flash vision
              </span>
            </div>

            <div className="field">
              <label htmlFor="region">
                Your state or region
                <span className="hint">— sets your legal protections</span>
              </label>
              <div className="select-wrap">
                <select
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="" disabled>
                    Select a state…
                  </option>
                  {US_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <ChevronDown />
              </div>
            </div>

            {/* Language + reading level */}
            <div className="field">
              <label>
                Output language &amp; reading level
                <span className="hint">— how your results are written</span>
              </label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={SEG_GROUP} role="group" aria-label="Output language">
                  <button
                    type="button"
                    aria-pressed={language === "en"}
                    style={seg(language === "en")}
                    onClick={() => setLanguage("en")}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    aria-pressed={language === "es"}
                    style={seg(language === "es")}
                    onClick={() => setLanguage("es")}
                  >
                    Español
                  </button>
                </div>
                <div style={SEG_GROUP} role="group" aria-label="Reading level">
                  <button
                    type="button"
                    aria-pressed={readingLevel === "standard"}
                    style={seg(readingLevel === "standard")}
                    onClick={() => setReadingLevel("standard")}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    aria-pressed={readingLevel === "simple"}
                    style={seg(readingLevel === "simple")}
                    onClick={() => setReadingLevel("simple")}
                  >
                    Simple (plain)
                  </button>
                </div>
              </div>
            </div>

            {/* Upload */}
            <div className="field">
              <label>
                Upload your bill
                <span className="hint">— photos or PDF, up to {MAX_DOCS} pages</span>
              </label>
              <button
                type="button"
                className={`dropzone ${dragOver ? "over" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
                }}
              >
                <span className="dz-icon">
                  <UploadIcon />
                </span>
                <span className="dz-main">
                  <b>Drop a photo or scan here</b>
                  <span>or click to browse — JPG, PNG, WebP, PDF</span>
                </span>
                <span className="dz-cta">
                  <CameraIcon /> Choose file
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {files.length > 0 && (
                <div className="doc-grid">
                  {files.map((f) => (
                    <div className="doc-thumb" key={f.id}>
                      <div className="doc-pic">
                        {f.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.preview} alt={f.name} />
                        ) : (
                          <FileIcon />
                        )}
                      </div>
                      <div className="doc-meta">
                        <span className="nm" title={f.name}>
                          {f.name}
                        </span>
                        <span className="sz">
                          {f.kind === "pdf" ? "PDF" : "Image"} · {f.sizeLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="doc-x"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => removeFile(f.id)}
                        disabled={busy}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Paste fallback — no photo needed */}
            <div className="field">
              <label htmlFor="paste">
                Or paste the itemized text
                <span className="hint">— no photo needed; skips the scan</span>
              </label>
              <textarea
                id="paste"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste the line items from your statement here…"
                rows={5}
                style={TEXTAREA}
                disabled={busy}
              />
            </div>

            {/* Financial assistance (optional) */}
            <div className="field">
              <label>
                Financial-assistance check
                <span className="hint">
                  — optional; estimates charity-care eligibility
                </span>
              </label>
              {!showAssist ? (
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => setShowAssist(true)}
                >
                  + Add household size &amp; income (optional)
                </button>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={householdSize}
                    onChange={(e) => setHouseholdSize(e.target.value)}
                    placeholder="Household size"
                    style={FIELD_INPUT}
                    disabled={busy}
                  />
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={householdIncome}
                    onChange={(e) => setHouseholdIncome(e.target.value)}
                    placeholder="Annual household income ($)"
                    style={FIELD_INPUT}
                    disabled={busy}
                  />
                  <span className="hint" style={{ gridColumn: "1 / -1" }}>
                    Used only to estimate eligibility for this audit — never
                    stored.
                  </span>
                </div>
              )}
            </div>

            {extraction && (
              <div className="field" style={{ marginTop: 4 }}>
                <span
                  className={`scan-badge ${extraction.legible ? "" : "warn"}`}
                  style={{ marginLeft: 0 }}
                >
                  {extraction.legible ? <SparkleIcon /> : <AlertIcon />}
                  Read by vision · {extraction.pageCount} pg ·{" "}
                  {extraction.itemsFound} items
                  {extraction.detectedRegion ? ` · ${extraction.detectedRegion}` : ""}
                </span>
                {!extraction.legible && extraction.notes && (
                  <div className="scan-warn">
                    <AlertIcon />
                    <span>{extraction.notes}</span>
                  </div>
                )}
              </div>
            )}

            <div className="privacy-note">
              <LockIcon />
              <span>
                The scanner masks names, DOB, SSN, and record numbers as it
                reads. We don&apos;t ask for them and won&apos;t reconstruct
                them — your statement text is used only for this single audit
                and never stored.
              </span>
            </div>

            <div className="console-actions">
              <button
                className="btn btn-primary btn-arrow"
                onClick={runFull}
                disabled={busy}
              >
                {phase === "extracting" ? (
                  <>
                    <span className="spinner" /> Reading bill…
                  </>
                ) : phase === "loading" ? (
                  <>
                    <span className="spinner" /> Auditing…
                  </>
                ) : (
                  <>
                    <SparkleIcon /> Scan &amp; audit bill <ArrowRight />
                  </>
                )}
              </button>

              {(region || files.length > 0 || pastedText) && !busy && (
                <button
                  className="linkbtn"
                  onClick={() => {
                    setRegion("");
                    setFiles([]);
                    setExtraction(null);
                    setError(null);
                    setPastedText("");
                    setShowAssist(false);
                    setHouseholdSize("");
                    setHouseholdIncome("");
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* LOADING */}
        {busy && (
          <div className="loading-wrap reveal" ref={loadingRef} style={{ marginTop: 24 }}>
            <div className="lead">
              {phase === "extracting"
                ? "Reading your document…"
                : "Building your advocacy packet…"}
            </div>
            <div className="sub">
              {phase === "extracting"
                ? "Transcribing the statement and masking identifiers."
                : "Reasoning carefully through every line — this usually takes 20–60 seconds."}
            </div>
            <div className="load-steps">
              {activeStages.map((s, i) => {
                const Icon = s.icon;
                const state =
                  i < stage ? "done" : i === stage ? "active" : "pending";
                return (
                  <div className={`load-step ${state}`} key={i}>
                    <span className="ic" style={{ position: "relative" }}>
                      {state === "done" ? <CheckIcon /> : <Icon />}
                    </span>
                    <span className="txt">{s.label}</span>
                    {state === "active" && (
                      <span style={{ marginLeft: "auto" }} className="spinner" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* RESULTS */}
      {phase === "done" && result && (
        <div className="results" ref={resultsRef}>
          <Results data={result} onReset={reset} lang={language} />
        </div>
      )}

      {/* RESPONSIBLE BY DESIGN */}
      <section className="section" aria-label="Responsible by design">
        <div className="section-head">
          <div>
            <span className="eyebrow">Responsible by design</span>
            <h2 style={{ marginTop: 10 }}>Built to be trusted under stress.</h2>
          </div>
          <p>
            Every audit ships with a named risk, a concrete safeguard, and a
            human in control.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {RESPONSIBLE.map((r) => (
            <div
              key={r.h}
              style={{
                padding: "20px",
                border: "1px solid var(--card-edge)",
                borderRadius: 16,
                background: "var(--card)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--clay)",
                  marginBottom: 8,
                }}
              >
                {r.tag}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{r.h}</div>
              <p style={{ margin: 0, color: "var(--ink-soft)", lineHeight: 1.55 }}>
                {r.p}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer" id="about">
        <div className="footer-inner">
          <div>
            <div className="brand" style={{ fontSize: "1rem" }}>
              <span className="mark" style={{ width: 28, height: 28 }}>
                <ScanIcon style={{ color: "var(--on-dark)", width: 16, height: 16 }} />
              </span>
              <span>
                <b>MediAudit</b> <span className="ai">AI</span>
              </span>
            </div>
            <p style={{ margin: "10px 0 0", color: "var(--ink-faint)" }}>
              Powered by Gemini 3 Flash — vision reading + grounded,
              self-verifying reasoning.
            </p>
          </div>
          <p style={{ maxWidth: "46ch", margin: 0 }}>
            An automated informational tool. Not legal counsel, financial
            planning, or medical advice. Always verify against your physical
            records before contacting your provider or insurer.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ============================== RESULTS ============================== */

function isFlaggedLine(line: DecodedLine, discrepancies: Discrepancy[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  const lineText = norm(`${line.code} ${line.plainEnglish}`);
  return discrepancies.some((d) => {
    if (line.amount > 0 && d.chargedAmount === line.amount) return true;
    // Match on the model's cited evidence as well as the item label so the
    // ledger highlight tracks the exact line the auditor pointed to.
    const itemTokens = norm(`${d.item} ${d.evidence ?? ""}`)
      .split(/\s+/)
      .filter((t) => t.length > 3);
    const hits = itemTokens.filter((t) => lineText.includes(t)).length;
    return itemTokens.length > 0 && hits >= Math.min(2, itemTokens.length);
  });
}

function Results({
  data,
  onReset,
  lang,
}: {
  data: AuditResult;
  onReset: () => void;
  lang: OutputLanguage;
}) {
  const {
    overview,
    decodedLines,
    discrepancies,
    phoneScript,
    roadmap,
    safety,
    charityCare,
    reasoning,
  } = data;
  const t = UI[lang];
  const catLabel = CAT[lang];
  const sevLabel = SEV[lang];
  const [checks, setChecks] = useState<boolean[]>(() =>
    roadmap.map(() => false),
  );
  const [copied, setCopied] = useState(false);
  const [copiedReq, setCopiedReq] = useState(false);

  const doneCount = checks.filter(Boolean).length;

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(phoneScript.join("\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(charityCare.requestLanguage);
      setCopiedReq(true);
      setTimeout(() => setCopiedReq(false), 2200);
    } catch {
      setCopiedReq(false);
    }
  }

  let d = -0.06;
  const delay = () => `${(d += 0.06).toFixed(2)}s`;

  return (
    <>
      <div className="dossier-banner reveal" style={{ animationDelay: delay() }}>
        <div className="left">
          <span className="seal">
            <ShieldIcon />
          </span>
          <div className="meta">
            <b>{t.dossier}</b>
            <span>
              {overview.region.toUpperCase()} · {overview.lineItemCount}{" "}
              {t.lineItems} · {overview.flaggedCount} {t.flagged}
            </span>
          </div>
        </div>
        <button className="btn btn-ghost btn-arrow" onClick={onReset}>
          <RefreshIcon /> {t.newAudit}
        </button>
      </div>

      {/* Overview */}
      <div className="headline-card reveal" style={{ animationDelay: delay() }}>
        <span className="eyebrow">{t.glance}</span>
        <h3>{overview.headline}</h3>
      </div>

      <div className="metric-grid">
        {[
          {
            k: t.totalCharged,
            v: usd(overview.totalCharged),
            foot: `${overview.lineItemCount} ${t.decodedItems}`,
            cls: "",
          },
          {
            k: t.flaggedCharges,
            v: String(overview.flaggedCount),
            foot: t.potentialErrors,
            cls: "accent",
          },
          {
            k: t.estOverbilling,
            v:
              overview.estimatedOverchargeHigh > 0
                ? `${usd(overview.estimatedOverchargeLow)}–${usd(
                    overview.estimatedOverchargeHigh,
                  )}`
                : "—",
            foot: t.fairRangeFoot,
            cls: "accent",
          },
          {
            k: t.leverage,
            v: overview.flaggedCount > 0 ? t.strong : t.clean,
            foot:
              overview.flaggedCount > 0 ? t.leverageStrong : t.leverageClean,
            cls: "good",
          },
        ].map((m, i) => (
          <div
            className="metric reveal"
            key={m.k}
            style={{ animationDelay: `${0.12 + i * 0.05}s` }}
          >
            <div className="k">{m.k}</div>
            <div className={`v ${m.cls}`}>{m.v}</div>
            <div className="foot">{m.foot}</div>
          </div>
        ))}
      </div>

      {overview.localProtections && (
        <div className="protections reveal" style={{ animationDelay: delay() }}>
          <ScaleIcon />
          <span>
            <b>
              {t.protectionsLead} {overview.region}.{" "}
            </b>
            {overview.localProtections}
          </span>
        </div>
      )}

      {charityCare?.assessed && (
        <div className="charity reveal">
          <div className="charity-head">
            <ScaleIcon />
            <b>{t.charityTitle}</b>
          </div>
          <div className="charity-status">
            <span
              className={`charity-elig charity-elig--${charityCare.eligibilityLikelihood}`}
            >
              {t[charityCare.eligibilityLikelihood]}
            </span>
            {charityCare.estimatedFplPercent > 0 && (
              <span className="charity-fpl">
                ≈ {Math.round(charityCare.estimatedFplPercent)}% {t.ofFpl}
              </span>
            )}
          </div>
          {charityCare.explanation && <p>{charityCare.explanation}</p>}
          {charityCare.requestLanguage && (
            <div className="charity-ask">
              <span className="lab">{t.askScript}</span>
              <p className="say">{charityCare.requestLanguage}</p>
              <button className="btn btn-copy btn-arrow" onClick={copyRequest}>
                {copiedReq ? <CheckIcon /> : <CopyIcon />}
                {copiedReq ? t.copied : t.copyRequest}
              </button>
            </div>
          )}
        </div>
      )}

      {/* PART 1 — decoded ledger */}
      <section className="part">
        <div className="part-head">
          <span className="pn">{t.part} 1</span>
          <h3>{t.p1}</h3>
          <span className="sub">
            {decodedLines.length} {t.p1sub}
          </span>
        </div>
        <div className="ledger">
          <div className="ledger-row head">
            <div>{t.colCode}</div>
            <div>{t.colMeaning}</div>
            <div style={{ textAlign: "right" }}>{t.colCharged}</div>
          </div>
          {decodedLines.map((line, i) => {
            const flagged = isFlaggedLine(line, discrepancies);
            return (
              <div className={`ledger-row ${flagged ? "flagged" : ""}`} key={i}>
                <div className="code">
                  {line.code}
                  {flagged && (
                    <span className="flag-tag">
                      <AlertIcon /> {t.flag}
                    </span>
                  )}
                </div>
                <div className="english">{line.plainEnglish}</div>
                <div className="amt">{line.amountDisplay || usdExact(line.amount)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PART 2 — discrepancies */}
      <section className="part">
        <div className="part-head">
          <span className="pn">{t.part} 2</span>
          <h3>{t.p2}</h3>
          <span className="sub">
            {discrepancies.length === 0
              ? t.nothingFlagged
              : `${discrepancies.length} ${
                  discrepancies.length > 1 ? t.flaggedChargePl : t.flaggedCharge
                }`}
          </span>
        </div>

        {discrepancies.length > 0 && (
          <div className="fineprint">
            <AlertIcon />
            <span>{t.estDisclaimer}</span>
          </div>
        )}

        {discrepancies.some((d) => d.verification) && (
          <div className="fineprint ok">
            <ShieldIcon />
            <span>{t.reviewNote}</span>
          </div>
        )}

        {discrepancies.length === 0 ? (
          <div className="protections">
            <ShieldIcon />
            <span>{t.noneMsg}</span>
          </div>
        ) : (
          <div className="disc-grid">
            {discrepancies.map((dsc, i) => {
              const domainMax = Math.max(dsc.chargedAmount, dsc.benchmarkHigh) * 1.14 || 1;
              const fairLeft = (dsc.benchmarkLow / domainMax) * 100;
              const fairWidth = ((dsc.benchmarkHigh - dsc.benchmarkLow) / domainMax) * 100;
              const markerLeft = Math.min((dsc.chargedAmount / domainMax) * 100, 97);
              return (
                <article
                  className="disc reveal"
                  data-cat={dsc.category}
                  key={i}
                  style={{ animationDelay: `${0.05 + i * 0.07}s` }}
                >
                  <div>
                    <div className="disc-tags">
                      <span className="cat-badge">
                        <AlertIcon /> {catLabel[dsc.category]}
                      </span>
                      {dsc.severity && (
                        <span className={`tag tag--${dsc.severity}`}>
                          {sevLabel[dsc.severity]}
                        </span>
                      )}
                      {dsc.grounding && (
                        <span
                          className={`tag ${
                            dsc.grounding === "reference-table"
                              ? "tag--ok"
                              : "tag--muted"
                          }`}
                          title={
                            dsc.grounding === "reference-table"
                              ? "Benchmark grounded in a curated reference anchor / coding rule"
                              : "Benchmark estimated by the model from its training knowledge"
                          }
                        >
                          {dsc.grounding === "reference-table"
                            ? t.refGrounded
                            : t.modelEst}
                        </span>
                      )}
                      {dsc.verification && (
                        <span
                          className={`tag ${
                            dsc.verification.status === "confirmed"
                              ? "tag--ok"
                              : dsc.verification.status === "adjusted"
                                ? "tag--medium"
                                : "tag--high"
                          }`}
                          title={dsc.verification.critique}
                        >
                          {dsc.verification.status === "confirmed"
                            ? `✓ ${t.vConfirmed}`
                            : dsc.verification.status === "adjusted"
                              ? t.vAdjusted
                              : t.vDisputed}
                        </span>
                      )}
                    </div>
                    <h4>{dsc.item}</h4>
                    <p className="rationale">{dsc.rationale}</p>
                    {dsc.evidence && (
                      <div className="evidence">
                        <span className="lab">{t.onBill}</span>
                        <span className="quote">{dsc.evidence}</span>
                      </div>
                    )}
                    <div className="confidence">
                      <span className="lab">{t.confidence}</span>
                      <span className="meter">
                        <i style={{ width: `${Math.max(0, Math.min(100, dsc.confidence))}%` }} />
                      </span>
                      <span className="num">{dsc.confidence}%</span>
                    </div>
                  </div>

                  <div className="bench">
                    <div className="row">
                      <span className="lab">{t.hospCharge}</span>
                    </div>
                    <div className="charged">{usdExact(dsc.chargedAmount)}</div>
                    <div className="track">
                      <span
                        className="fair"
                        style={{ left: `${fairLeft}%`, width: `${Math.max(fairWidth, 2)}%` }}
                      />
                      <span className="marker" style={{ left: `${markerLeft}%` }} />
                    </div>
                    <div className="scale">
                      <span>$0</span>
                      <span>{usd(domainMax)}</span>
                    </div>
                    <div className="fair-lab">
                      {t.fairRange}{" "}
                      <b>
                        {usd(dsc.benchmarkLow)}–{usd(dsc.benchmarkHigh)}
                      </b>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* PART 3 — phone script */}
      <section className="part">
        <div className="part-head">
          <span className="pn">{t.part} 3</span>
          <h3>{t.p3}</h3>
          <span className="sub">{t.p3sub}</span>
        </div>
        <div className="script">
          <div className="script-inner">
            <div className="script-bar">
              <PhoneIcon /> {t.readToDept}
            </div>
            {phoneScript.map((para, i) => (
              <p key={i}>{renderScriptLine(para)}</p>
            ))}
            <div className="script-foot">
              <span className="note">
                {t.replaceNote1}{" "}
                <span style={{ color: "var(--mint)" }}>{t.bracketSample}</span>{" "}
                {t.replaceNote2}
              </span>
              <button className="btn btn-copy btn-arrow" onClick={copyScript}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? t.copied : t.copy}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PART 4 — roadmap */}
      <section className="part">
        <div className="part-head">
          <span className="pn">{t.part} 4</span>
          <h3>{t.p4}</h3>
          <span className="sub">
            {doneCount}/{roadmap.length} {t.done}
          </span>
        </div>
        <div className="roadmap">
          {roadmap.map((step, i) => (
            <button
              type="button"
              className="task"
              data-done={checks[i]}
              key={i}
              aria-pressed={checks[i]}
              onClick={() =>
                setChecks((c) => c.map((v, j) => (j === i ? !v : v)))
              }
            >
              <span className="check">
                <CheckIcon />
              </span>
              <span className="body">
                <span className="ix">
                  {t.step} {String(i + 1).padStart(2, "0")}
                </span>
                <h4>{step.title}</h4>
                <p>{step.detail}</p>
              </span>
            </button>
          ))}
        </div>
        <div className="roadmap-progress">
          <span className="bar">
            <i style={{ width: `${(doneCount / Math.max(roadmap.length, 1)) * 100}%` }} />
          </span>
          <span>
            {doneCount === roadmap.length
              ? t.allDone
              : `${roadmap.length - doneCount} ${t.stepsRemaining}`}
          </span>
        </div>
      </section>

      {/* PART 5 — safety */}
      <section className="part">
        <div className="part-head">
          <span className="pn">{t.part} 5</span>
          <h3>{t.p5}</h3>
          <span className="sub">{t.p5sub}</span>
        </div>
        <div className="safety-grid">
          <div className="safety-card">
            <span className="stamp">
              <StampIcon /> {t.complianceStamp}
            </span>
            <p>{safety.complianceStamp}</p>
          </div>
          <div className="safety-card">
            <span className="stamp">
              <PenIcon /> {t.sovereignty}
            </span>
            <p>{safety.sovereigntyNotice}</p>
          </div>
        </div>
      </section>

      {/* PART 6 — find more help */}
      <section className="part">
        <div className="part-head">
          <span className="pn">{t.part} 6</span>
          <h3>{t.helpTitle}</h3>
          <span className="sub">{t.helpSub}</span>
        </div>
        <div className="safety-grid">
          {RESOURCES.map((r) => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="safety-card"
            >
              <span className="stamp">
                <ScaleIcon /> {r.name}
              </span>
              <p>{lang === "es" ? r.es : r.en}</p>
            </a>
          ))}
        </div>
      </section>

      {reasoning && (
        <details className="reasoning">
          <summary>{t.reasoningTitle}</summary>
          <p>{reasoning}</p>
        </details>
      )}

      <div className="results-actions">
        <button className="btn btn-primary btn-arrow" onClick={copyScript}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? t.scriptCopied : t.copyMy}
        </button>
        <button
          className="btn btn-ghost btn-arrow no-print"
          onClick={() => window.print()}
        >
          <FileIcon /> {t.printSave}
        </button>
        <button className="btn btn-ghost btn-arrow no-print" onClick={onReset}>
          <RefreshIcon /> {t.auditAnother}
        </button>
      </div>
    </>
  );
}
