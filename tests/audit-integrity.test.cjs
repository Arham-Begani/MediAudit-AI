const { test } = require("node:test");
const assert = require("node:assert/strict");
const { finalizeAudit } = require("../.test-build/audit-integrity.js");

function flag(chargedAmount, benchmarkLow, benchmarkHigh, status) {
  return { item: "Fictional fixture", chargedAmount, benchmarkLow, benchmarkHigh,
    ...(status ? { verification: { status, critique: "Fixture review" } } : {}) };
}
function packet(discrepancies) {
  return { overview: { estimatedOverchargeLow: 166, estimatedOverchargeHigh: 256,
    flaggedCount: 99, lineItemCount: 99 }, decodedLines: [{ amount: 2411 }],
    discrepancies, safety: { complianceStamp: "Verified against today's mandates",
      sovereigntyNotice: "Informational only" } };
}

test("oncology regression: $74 and $92 charges with $0–$10 benchmarks yield $146–$166", () => {
  const result = finalizeAudit(packet([flag(74, 0, 10, "confirmed"), flag(92, 0, 10, "adjusted")]), "October 28, 2026");
  assert.equal(result.overview.estimatedOverchargeLow, 146);
  assert.equal(result.overview.estimatedOverchargeHigh, 166);
  assert.equal(result.overview.flaggedCount, 2);
  assert.equal(result.overview.lineItemCount, 1);
});

test("exclude disputed flags while retaining their critique for inspection", () => {
  const result = finalizeAudit(packet([flag(74, 0, 10, "disputed"), flag(92, 0, 10)]), "today");
  assert.equal(result.overview.estimatedOverchargeLow, 82);
  assert.equal(result.overview.estimatedOverchargeHigh, 92);
  assert.equal(result.discrepancies[0].verification.status, "disputed");
});

test("empty flags reset hallucinated model totals", () => {
  const result = finalizeAudit(packet([]), "today");
  assert.equal(result.overview.estimatedOverchargeLow, 0);
  assert.equal(result.overview.estimatedOverchargeHigh, 0);
});

test("cent arithmetic, reversed bounds, and benchmarks above charges", () => {
  const result = finalizeAudit(packet([flag(.30, .20, .10), flag(.20, .30, .40)]), "today");
  assert.equal(result.overview.estimatedOverchargeLow, .10);
  assert.equal(result.overview.estimatedOverchargeHigh, .20);
  assert.equal(result.discrepancies[0].benchmarkLow, .10);
});

test("reject negative, nonfinite, nonnumeric and unsafe dollar values", () => {
  for (const invalid of [-1, NaN, Infinity, "10", Number.MAX_VALUE]) {
    assert.throws(() => finalizeAudit(packet([flag(invalid, 0, 10)]), "today"));
    assert.throws(() => finalizeAudit(packet([flag(10, invalid, 10)]), "today"));
  }
});

test("range always ordered, nonnegative and no larger than its included charges", () => {
  for (let charged = 0; charged < 100; charged += 7) {
    for (let benchmark = 0; benchmark < 140; benchmark += 11) {
      const result = finalizeAudit(packet([flag(charged, benchmark, benchmark + 10)]), "today");
      assert.ok(0 <= result.overview.estimatedOverchargeLow);
      assert.ok(result.overview.estimatedOverchargeLow <= result.overview.estimatedOverchargeHigh);
      assert.ok(result.overview.estimatedOverchargeHigh <= charged);
    }
  }
});

test("server replaces unsubstantiated verification claims in both languages without mutating input", () => {
  const input = packet([]);
  const english = finalizeAudit(input, "October 28, 2026");
  const spanish = finalizeAudit(input, "28 de octubre de 2026", "es");
  assert.match(english.safety.complianceStamp, /current laws and live prices were not verified/);
  assert.match(spanish.safety.complianceStamp, /no se verificaron leyes vigentes/);
  assert.match(english.safety.complianceStamp, /October 28, 2026/);
  assert.equal(input.safety.complianceStamp, "Verified against today's mandates");
});
