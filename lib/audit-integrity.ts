import type { AuditResult, OutputLanguage } from "./types";

function cents(value: number): number {
  const rounded = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(rounded)) {
    throw new Error("The analysis contained an invalid dollar amount. Please retry.");
  }
  return rounded;
}

/** Rebuild monetary summaries after the second model's verdicts are merged. */
export function finalizeAudit(
  result: AuditResult,
  generatedDate: string,
  language: OutputLanguage = "en",
): AuditResult {
  let low = 0;
  let high = 0;
  const discrepancies = result.discrepancies.map((flag) => {
    const charged = cents(flag.chargedAmount);
    const bounds = [cents(flag.benchmarkLow), cents(flag.benchmarkHigh)].sort((a, b) => a - b);
    if (flag.verification?.status !== "disputed") {
      low += Math.max(0, charged - bounds[1]);
      high += Math.max(0, charged - bounds[0]);
      if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high)) {
        throw new Error("The analysis total was too large. Please retry.");
      }
    }
    return {
      ...flag,
      chargedAmount: charged / 100,
      benchmarkLow: bounds[0] / 100,
      benchmarkHigh: bounds[1] / 100,
    };
  });

  return {
    ...result,
    discrepancies,
    overview: {
      ...result.overview,
      flaggedCount: discrepancies.length,
      lineItemCount: result.decodedLines.length,
      estimatedOverchargeLow: low / 100,
      estimatedOverchargeHigh: high / 100,
    },
    safety: {
      ...result.safety,
      // A second model is not legal verification or a live pricing source.
      complianceStamp: language === "es"
        ? `Generado el ${generatedDate}. Las estimaciones provienen de IA y referencias ilustrativas; no se verificaron leyes vigentes ni precios actuales. Confirme los cargos y la cobertura con su proveedor o aseguradora. Los cargos cuestionados por la segunda revisión de IA no se incluyen en el rango estimado.`
        : `Generated on ${generatedDate}. Estimates use AI and illustrative references; current laws and live prices were not verified. Confirm charges and coverage with your provider or insurer. Flags disputed by the second AI review are excluded from the estimated range.`,
    },
  };
}
