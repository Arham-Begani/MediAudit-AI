"use client";

import { useEffect, useRef, useState } from "react";
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
import { SAMPLE_BILL, SAMPLE_REGION } from "@/lib/sample";
import type {
  AuditResult,
  Discrepancy,
  DecodedLine,
  ExtractionResult,
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
  { icon: PulseIcon, label: "Auditing line items against Medicare baselines" },
  { icon: PinIcon, label: "Localizing your state consumer protections" },
  { icon: PhoneIcon, label: "Drafting your advocacy script & action plan" },
];

const MAX_DOCS = 8;
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

type Phase = "idle" | "extracting" | "loading" | "done";

export default function Home() {
  const [region, setRegion] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [files, setFiles] = useState<UploadedDoc[]>([]);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);

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

  function loadSample() {
    setRegion(SAMPLE_REGION);
    setOcrText(SAMPLE_BILL);
    setExtraction(null);
    setError(null);
    consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setError(null);
    consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function doExtract(): Promise<ExtractionResult | null> {
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: files.map((f) => ({
            kind: f.kind,
            mediaType: f.mediaType,
            data: f.data,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not read the document.");
        return null;
      }
      const ex = data as ExtractionResult;
      setExtraction(ex);
      if (ex.statementText) setOcrText(ex.statementText);
      if (ex.detectedRegion && !region) {
        const match = US_REGIONS.find(
          (r) => r.toLowerCase() === ex.detectedRegion.trim().toLowerCase(),
        );
        if (match) setRegion(match);
      }
      return ex;
    } catch {
      setError("Could not reach the scanner. Check your connection and retry.");
      return null;
    }
  }

  async function doAudit(text: string) {
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, ocrText: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setPhase("idle");
        return;
      }
      setResult(data as AuditResult);
      setPhase("done");
    } catch {
      setError("Could not reach the analysis service. Check your connection and retry.");
      setPhase("idle");
    }
  }

  async function runExtractOnly() {
    if (files.length === 0) return;
    setError(null);
    setPhase("extracting");
    await doExtract();
    setPhase("idle");
  }

  async function runFull() {
    if (!region) {
      setError("Please choose your state or region first.");
      return;
    }
    let text = ocrText.trim();
    if (text.length < 20) {
      if (files.length > 0) {
        setError(null);
        setPhase("extracting");
        const ex = await doExtract();
        if (!ex) {
          setPhase("idle");
          return;
        }
        text = (ex.statementText ?? "").trim();
        if (text.length < 20) {
          setError("The scan didn't find itemized text. Try a clearer photo or paste the text.");
          setPhase("idle");
          return;
        }
      } else {
        setError("Upload a photo of your bill or paste the itemized text.");
        return;
      }
    }
    setError(null);
    setResult(null);
    setPhase("loading");
    await doAudit(text);
  }

  const needsScan = ocrText.trim().length < 20 && files.length > 0;
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
        </nav>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="reveal" style={{ animationDelay: "0.05s" }}>
          <span className="hero-tag">
            <span className="dot" />
            Crisis-to-Action Translator · for U.S. patients
          </span>
          <h1>
            Snap your medical bill.{" "}
            <em>Read</em> it in <span className="underline">plain English</span>.
          </h1>
          <p className="lede">
            Hospital statements are written to be opaque. Upload a photo and
            MediAudit AI reads it with vision, decodes the codes, flags the
            institutional billing errors hiding inside, and hands you a calm,
            ready-to-read script to fight back — in minutes.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-arrow" onClick={loadSample}>
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

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="section-head">
          <div>
            <span className="eyebrow">The method</span>
            <h2 style={{ marginTop: 10 }}>Two passes of Claude Opus 4.8.</h2>
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
              h: "Audit for errors",
              p: "Each charge is reasoned over at high effort — upcoding, duplicate billing, and unbundled supply fees against regional baselines.",
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
      </section>

      {/* CONSOLE */}
      <section className="section" id="audit" ref={consoleRef}>
        <div className="section-head">
          <div>
            <span className="eyebrow">Run an audit</span>
            <h2 style={{ marginTop: 10 }}>Upload or paste your bill.</h2>
          </div>
          <p>
            Snap a photo, drop a scan, or paste the text. We never need — and
            never store — your identity.
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
                Privacy-First Document Scanner · Claude Opus 4.8 vision
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

            {/* Upload */}
            <div className="field">
              <label>
                Upload your bill
                <span className="hint">— photo or PDF, up to {MAX_DOCS} pages</span>
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

            {/* Text */}
            <div className="field">
              <label htmlFor="ocr">
                Itemized statement text
                <span className="hint">
                  — auto-filled by the AI scan, or paste / edit it yourself
                </span>
                {extraction && (
                  <span className={`scan-badge ${extraction.legible ? "" : "warn"}`}>
                    {extraction.legible ? <SparkleIcon /> : <AlertIcon />}
                    Read by vision · {extraction.pageCount} pg ·{" "}
                    {extraction.itemsFound} items
                  </span>
                )}
              </label>
              <textarea
                id="ocr"
                value={ocrText}
                spellCheck={false}
                placeholder={
                  "Upload a bill above to auto-fill — or paste lines like:\n001  99285  ER VISIT EM LEVEL 5 ...  1,842.00\n005  SUPPLY  SALINE FLUSH 10ML ×3 ...  54.00"
                }
                onChange={(e) => setOcrText(e.target.value)}
              />
              <div className="textarea-tools">
                <button type="button" className="linkbtn" onClick={loadSample}>
                  ↳ Load a sample ER statement
                </button>
                <span className="char-count">
                  {ocrText.length.toLocaleString()} chars
                </span>
              </div>
              {extraction && !extraction.legible && extraction.notes && (
                <div className="scan-warn">
                  <AlertIcon />
                  <span>{extraction.notes}</span>
                </div>
              )}
            </div>

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
                ) : needsScan ? (
                  <>
                    <SparkleIcon /> Scan &amp; audit bill
                  </>
                ) : (
                  <>
                    Run the audit <ArrowRight />
                  </>
                )}
              </button>

              {needsScan && !busy && (
                <button className="linkbtn" onClick={runExtractOnly}>
                  Just read &amp; preview the text first
                </button>
              )}

              {(ocrText || region || files.length > 0) && !busy && (
                <button
                  className="linkbtn"
                  onClick={() => {
                    setOcrText("");
                    setRegion("");
                    setFiles([]);
                    setExtraction(null);
                    setError(null);
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
          <Results data={result} onReset={reset} />
        </div>
      )}

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
              Powered by Claude Opus 4.8 — vision reading + high-effort reasoning.
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
    const itemTokens = norm(d.item)
      .split(/\s+/)
      .filter((t) => t.length > 3);
    const hits = itemTokens.filter((t) => lineText.includes(t)).length;
    return itemTokens.length > 0 && hits >= Math.min(2, itemTokens.length);
  });
}

function Results({
  data,
  onReset,
}: {
  data: AuditResult;
  onReset: () => void;
}) {
  const { overview, decodedLines, discrepancies, phoneScript, roadmap, safety } =
    data;
  const [checks, setChecks] = useState<boolean[]>(() =>
    roadmap.map(() => false),
  );
  const [copied, setCopied] = useState(false);

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
            <b>Patient Advocacy Dossier</b>
            <span>
              {overview.region.toUpperCase()} · {overview.lineItemCount} LINE
              ITEMS · {overview.flaggedCount} FLAGGED
            </span>
          </div>
        </div>
        <button className="btn btn-ghost btn-arrow" onClick={onReset}>
          <RefreshIcon /> New audit
        </button>
      </div>

      {/* Overview */}
      <div className="headline-card reveal" style={{ animationDelay: delay() }}>
        <span className="eyebrow">At a glance</span>
        <h3>{overview.headline}</h3>
      </div>

      <div className="metric-grid">
        {[
          {
            k: "Total charged",
            v: usd(overview.totalCharged),
            foot: `${overview.lineItemCount} decoded line items`,
            cls: "",
          },
          {
            k: "Flagged charges",
            v: String(overview.flaggedCount),
            foot: "Potential institutional errors",
            cls: "accent",
          },
          {
            k: "Est. overbilling",
            v:
              overview.estimatedOverchargeHigh > 0
                ? `${usd(overview.estimatedOverchargeLow)}–${usd(
                    overview.estimatedOverchargeHigh,
                  )}`
                : "—",
            foot: "Fair-market confidence range",
            cls: "accent",
          },
          {
            k: "Your leverage",
            v: overview.flaggedCount > 0 ? "Strong" : "Clean",
            foot:
              overview.flaggedCount > 0
                ? "Documented basis to dispute"
                : "No anomalies detected",
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
            <b>{overview.region} protections in play. </b>
            {overview.localProtections}
          </span>
        </div>
      )}

      {/* PART 1 — decoded ledger */}
      <section className="part">
        <div className="part-head">
          <span className="pn">PART 1</span>
          <h3>Line-by-line translation</h3>
          <span className="sub">{decodedLines.length} items decoded</span>
        </div>
        <div className="ledger">
          <div className="ledger-row head">
            <div>Scanned code / jargon</div>
            <div>Plain-English meaning</div>
            <div style={{ textAlign: "right" }}>Charged</div>
          </div>
          {decodedLines.map((line, i) => {
            const flagged = isFlaggedLine(line, discrepancies);
            return (
              <div className={`ledger-row ${flagged ? "flagged" : ""}`} key={i}>
                <div className="code">
                  {line.code}
                  {flagged && (
                    <span className="flag-tag">
                      <AlertIcon /> flag
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
          <span className="pn">PART 2</span>
          <h3>Detected discrepancies</h3>
          <span className="sub">
            {discrepancies.length === 0
              ? "Nothing flagged"
              : `${discrepancies.length} flagged charge${
                  discrepancies.length > 1 ? "s" : ""
                }`}
          </span>
        </div>

        {discrepancies.length === 0 ? (
          <div className="protections">
            <ShieldIcon />
            <span>
              No upcoding, duplicate billing, or unbundled supply fees were
              detected against regional baselines. Your roadmap still helps you
              request an audited statement and charity-care review.
            </span>
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
                    <span className="cat-badge">
                      <AlertIcon /> {dsc.category}
                    </span>
                    <h4>{dsc.item}</h4>
                    <p className="rationale">{dsc.rationale}</p>
                    <div className="confidence">
                      <span className="lab">Confidence</span>
                      <span className="meter">
                        <i style={{ width: `${Math.max(0, Math.min(100, dsc.confidence))}%` }} />
                      </span>
                      <span className="num">{dsc.confidence}%</span>
                    </div>
                  </div>

                  <div className="bench">
                    <div className="row">
                      <span className="lab">Hospital charge</span>
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
                      Fair-market range{" "}
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
          <span className="pn">PART 3</span>
          <h3>Your phone advocacy script</h3>
          <span className="sub">Polite. Firm. Evidence-led.</span>
        </div>
        <div className="script">
          <div className="script-inner">
            <div className="script-bar">
              <PhoneIcon /> Read this to the billing department
            </div>
            {phoneScript.map((para, i) => (
              <p key={i}>{renderScriptLine(para)}</p>
            ))}
            <div className="script-foot">
              <span className="note">
                Replace each{" "}
                <span style={{ color: "var(--mint)" }}>[bracketed]</span> field
                with your own details before calling.
              </span>
              <button className="btn btn-copy btn-arrow" onClick={copyScript}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied" : "Copy script"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PART 4 — roadmap */}
      <section className="part">
        <div className="part-head">
          <span className="pn">PART 4</span>
          <h3>Your step-by-step roadmap</h3>
          <span className="sub">
            {doneCount}/{roadmap.length} done
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
                <span className="ix">STEP {String(i + 1).padStart(2, "0")}</span>
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
              ? "All steps complete — well advocated."
              : `${roadmap.length - doneCount} steps remaining`}
          </span>
        </div>
      </section>

      {/* PART 5 — safety */}
      <section className="part">
        <div className="part-head">
          <span className="pn">PART 5</span>
          <h3>Human-in-the-loop verification</h3>
          <span className="sub">You stay in control</span>
        </div>
        <div className="safety-grid">
          <div className="safety-card">
            <span className="stamp">
              <StampIcon /> Compliance stamp
            </span>
            <p>{safety.complianceStamp}</p>
          </div>
          <div className="safety-card">
            <span className="stamp">
              <PenIcon /> Patient sovereignty notice
            </span>
            <p>{safety.sovereigntyNotice}</p>
          </div>
        </div>
      </section>

      <div className="results-actions">
        <button className="btn btn-primary btn-arrow" onClick={copyScript}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Script copied" : "Copy my phone script"}
        </button>
        <button className="btn btn-ghost btn-arrow" onClick={onReset}>
          <RefreshIcon /> Audit another bill
        </button>
      </div>
    </>
  );
}
