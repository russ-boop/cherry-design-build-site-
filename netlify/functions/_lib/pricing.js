/* Server-side estimate engine.
   The formulas are copied unchanged from the original assets/app.js (price, loftPrice, area, L, applyRules, rows).
   Do not change a formula here without Russ's approval. */
"use strict";

const GAP = 0.3;
const PITCH = 0.84;

/* ---------- input cleaning: every selection is checked against an allow-list ---------- */
const ENUMS = {
  project: ["ext", "loft"],
  type: ["rear", "side", "wrap"],
  houseType: ["terraced", "semi", "detached"],
  storeys: ["1", "2"],
  existingOpening: ["keep", "widen", "full"],
  roof: ["flat", "leanto"],
  doors: ["bifold", "sliding", "french"],
  flatLights: ["0", "1", "2", "3", "lantern", "lanternL"],
  pitchLights: ["0", "1", "2", "3", "L1", "L2", "L3"],
  access: ["normal", "side", "through"],
  ground: ["level", "slope"],
  loftType: ["small", "dormer", "hip", "velux"],
  frontLights: ["0", "1", "2", "3", "4"]
};
const RANGES = {
  houseW: [3, 15], houseD: [4, 15], extW: [1, 15], extD: [1, 8], sideW: [1, 6], sideD: [1, 15],
  openW: [1, 12], doorW: [0.6, 12], dormerW: [1, 15]
};
const DEFAULT_S = {
  type: "rear", houseType: "semi", houseW: 6.0, houseD: 8.0,
  extW: 5.7, fullW: true, extD: 3.5, sideW: 2.5, sideD: 6.0,
  existingOpening: "keep", openW: 3.0,
  roof: "flat", doors: "bifold", doorW: 3.6, flatLights: "2", pitchLights: "2",
  access: "normal", ground: "level", conservation: false,
  storeys: "1", project: "ext", loftType: "dormer", dormerW: 2.5, ensuite: true, frontLights: "2"
};

function cleanSelections(input) {
  const errors = [];
  const S = Object.assign({}, DEFAULT_S);
  if (!input || typeof input !== "object") return { S, errors: ["selections missing"] };
  for (const k of Object.keys(ENUMS)) {
    if (input[k] === undefined) continue;
    const v = String(input[k]);
    if (ENUMS[k].includes(v)) S[k] = v; else errors.push(`bad ${k}`);
  }
  for (const k of Object.keys(RANGES)) {
    if (input[k] === undefined) continue;
    const v = Number(input[k]);
    const [lo, hi] = RANGES[k];
    if (Number.isFinite(v) && v >= lo && v <= hi) S[k] = v; else errors.push(`bad ${k}`);
  }
  for (const k of ["fullW", "conservation", "ensuite"]) {
    if (input[k] !== undefined) S[k] = input[k] === true || input[k] === "true";
  }
  return { S, errors };
}

/* ---------- geometry helpers (unchanged from app.js) ---------- */
const isLoft = S => S.project === "loft";
const dbl = S => S.storeys === "2";
const hasRear = S => S.type !== "side";
const hasSide = S => S.type !== "rear";
const lightsSel = S => S.roof === "flat" ? S.flatLights : S.pitchLights;
const lightCount = S => { const v = lightsSel(S); return v.startsWith("L") ? Number(v.slice(1)) : (isNaN(+v) ? 0 : +v); };
const doorFace = S => S.type === "rear" ? S.extW : S.type === "side" ? S.sideW : S.houseW + S.sideW;
const openWallLen = S => S.type === "side" ? S.sideD : S.extW;
const openMax = S => Math.max(1.5, openWallLen(S) - 0.9);
const r500 = n => Math.round(n / 500) * 500;
const m = v => v.toFixed(1) + " m";

function applyRules(S) {
  S.extW = S.type === "wrap" ? S.houseW : (S.fullW ? S.houseW - 2 * GAP : Math.min(S.extW, S.houseW - 2 * GAP));
  S.sideD = Math.min(S.sideD, S.houseD - GAP);
  S.openW = Math.min(Math.max(S.openW, 1.5), openMax(S));
  const maxDoor = Math.max(1.2, doorFace(S) - 0.6);
  if (S.doors === "french") S.doorW = Math.min(1.5, maxDoor);
  else S.doorW = Math.min(Math.max(S.doorW, Math.min(1.8, maxDoor)), maxDoor);
  return maxDoor;
}

function area(S) {
  let a = 0;
  if (hasRear(S)) a += S.extW * S.extD;
  if (hasSide(S)) a += S.sideW * S.sideD + (S.type === "wrap" ? S.sideW * S.extD : 0);
  return a;
}

function L(S) {
  const hd = S.houseD / 2, rise = hd * PITCH, inW = S.houseW - 0.6;
  const dW = S.loftType === "small" ? Math.min(S.dormerW, inW) : inW;
  let ar = inW * S.houseD * 0.45;
  if (S.loftType === "small") ar += dW * hd * 0.5;
  if (S.loftType === "dormer") ar = inW * hd * 1.6;
  if (S.loftType === "hip") ar = inW * hd * 1.6 * 1.15;
  return { hd, rise, inW, dW, area: ar };
}

const LOFT_NAME = { small: "small dormer loft conversion", dormer: "full rear dormer loft conversion", hip: "hip-to-gable and rear dormer loft conversion", velux: "rooflight loft conversion" };
const TYPE_NAME = { rear: "rear extension", side: "side extension", wrap: "wrap-around extension" };

function loftPrice(S, P) {
  const g = L(S), rate = { velux: P.loftVelux, small: P.loftSmall, dormer: P.loftDormer, hip: P.loftHip }[S.loftType];
  const build = Math.max(g.area * rate, P.loftMinimum);
  const ens = S.ensuite ? P.ensuite : 0, lights = P.velux * Number(S.frontLights);
  const accessPct = S.access === "side" ? P.accessSidePct : S.access === "through" ? P.accessThroughPct : 0;
  const logistics = build * accessPct / 100 + (S.conservation ? P.conservation : 0);
  const steel = P.loftSteel;
  const sub = build + steel + ens + lights + logistics, sm = sub * P.siteMgmtPct / 100, fees = P.feeDesign + P.feeEngineer + P.feeBC;
  const total = sub + sm + fees, rp = P.rangePct / 100;
  return { area: g.area, build, steel, ens, lights, logistics, sm, fees, total, low: r500(total * (1 - rp)), high: r500(total * (1 + rp)) };
}

function price(S, P) {
  if (isLoft(S)) return loftPrice(S, P);
  const ar = area(S);
  const build = Math.max(dbl(S) ? ar * 2 * P.rateDouble : ar * (S.roof === "flat" ? P.rateFlat : P.rateLeanto), P.minimumBuild);
  const doors = S.doors === "french" ? P.frenchDoors : (S.doors === "bifold" ? P.bifoldPerM : P.slidingPerM) * S.doorW;
  const v = lightsSel(S);
  let lights;
  if (S.roof === "flat") lights = v === "lantern" ? P.lantern : v === "lanternL" ? P.lanternLarge : P.rooflight * Number(v);
  else lights = (v.startsWith("L") ? P.veluxLarge : P.velux) * lightCount(S);
  const opening = S.existingOpening === "widen" ? P.widenBase + P.widenPerM * S.openW
    : S.existingOpening === "full" ? P.fullBase + P.fullPerM * openMax(S) : 0;
  const accessPct = S.access === "side" ? P.accessSidePct : S.access === "through" ? P.accessThroughPct : 0;
  const groundPct = S.ground === "slope" ? P.slopePct : 0;
  const logistics = build * (accessPct + groundPct) / 100 + (S.conservation ? P.conservation : 0);
  const sub = build + opening + doors + lights + logistics;
  const sm = sub * P.siteMgmtPct / 100;
  const fees = P.feeDesign + P.feeEngineer + P.feeBC;
  const total = sub + sm + fees;
  const rp = P.rangePct / 100;
  return { area: ar, build, opening, doors, lights, logistics, sm, fees, total, low: r500(total * (1 - rp)), high: r500(total * (1 + rp)) };
}

/* the itemised list the customer sees (labels unchanged from app.js) */
function rows(S, P) {
  const R = price(S, P);
  if (isLoft(S)) return { R, list: [
    [`Build: ${R.area.toFixed(0)} m² ${LOFT_NAME[S.loftType]}`, R.build],
    ["Steel beams for the new floor", R.steel],
    ["En-suite shower room", R.ens],
    [`Front rooflights × ${S.frontLights}`, R.lights],
    ["Scaffold access and site logistics", R.logistics],
    ["Site management", R.sm, "SMSTS"],
    ["Design and building regs drawings", P.feeDesign],
    ["Structural engineer", P.feeEngineer],
    ["Building control", P.feeBC]
  ] };
  const doorLabel = { bifold: "Bi-fold doors", sliding: "Sliding doors", french: "French doors" }[S.doors];
  const lv = lightsSel(S);
  const lightLabel = S.roof === "flat"
    ? ({ lantern: "Roof lantern", lanternL: "Large roof lantern", "0": "Roof glazing (none)" }[lv] || `Flat rooflights × ${lv}`)
    : (lv === "0" ? "Velux windows (none)" : `${lv.startsWith("L") ? "Large Velux" : "Velux"} × ${lightCount(S)}`);
  const openLabel = { keep: "Opening into house: original door kept", widen: `Opening into house: ${m(S.openW)} with steel`, full: `Open-plan: ${m(openMax(S))} steel and piers` }[S.existingOpening];
  const list = [
    [`Build: ${R.area.toFixed(1)} m² ${dbl(S) ? "two-storey" : "single-storey"} ${TYPE_NAME[S.type]}${dbl(S) ? " (both floors)" : ""}, ${S.roof === "flat" ? "flat roof" : "pitched roof"}`, R.build],
    [openLabel, R.opening],
    [doorLabel + (S.doors === "french" ? "" : ` (${m(S.doorW)})`), R.doors],
    [lightLabel, R.lights],
    ["Site logistics and access", R.logistics],
    ["Site management", R.sm, "SMSTS"],
    ["Design and building regs drawings", P.feeDesign],
    ["Structural engineer", P.feeEngineer],
    ["Building control", P.feeBC]
  ];
  return { R, list };
}

/* planning check, unchanged from app.js (text only) */
function planning(S) {
  if (isLoft(S)) {
    const hd = S.houseD / 2, rise = hd * PITCH, inW = S.houseW - 0.6;
    const dW = S.loftType === "small" ? Math.min(S.dormerW, inW) : inW;
    let vol = S.loftType === "velux" ? 0 : dW * hd * rise / 2;
    if (S.loftType === "hip") vol += S.houseD * hd * rise / 6 * (S.houseType === "detached" ? 2 : 1);
    const limit = S.houseType === "terraced" ? 40 : 50;
    if (S.conservation) return "Planning permission likely needed";
    if (S.loftType === "hip" && S.houseType === "terraced") return "Check with us first";
    if (S.loftType === "velux") return "Likely permitted development";
    return vol <= limit ? "Likely permitted development" : "Planning permission likely needed";
  }
  if (S.conservation) return "Planning permission likely needed";
  if (dbl(S)) {
    if (S.type !== "rear") return "Planning permission likely needed";
    if (S.houseType === "terraced") return "Planning permission likely needed";
    return S.extD <= 3 ? "Possible under permitted development" : "Planning permission likely needed";
  }
  if (S.type === "wrap") return "Planning permission likely needed";
  if (S.type === "side") {
    if (S.houseType === "terraced") return "Check with us first";
    return S.sideW <= S.houseW / 2 ? "Likely permitted development" : "Planning permission likely needed";
  }
  const lim = S.houseType === "detached" ? 4 : 3, prior = S.houseType === "detached" ? 8 : 6;
  if (S.extD <= lim) return "Likely permitted development";
  if (S.extD <= prior) return "Prior approval route likely";
  return "Planning permission likely needed";
}

function describe(S) {
  return isLoft(S) ? LOFT_NAME[S.loftType] : `${dbl(S) ? "two-storey" : "single-storey"} ${TYPE_NAME[S.type]}`;
}

/* one call: clean -> apply the same layout rules as the page -> price */
function estimate(input, P) {
  const { S, errors } = cleanSelections(input);
  applyRules(S);
  const { R, list } = rows(S, P);
  return {
    errors, selections: S, description: describe(S), planning: planning(S),
    lines: list.map(([label, amount, badge]) => ({ label, amount: Math.round(amount), badge: badge || null })),
    area: Number(R.area.toFixed(1)), total: Math.round(R.total), low: R.low, high: R.high
  };
}

module.exports = { estimate, price, rows, applyRules, cleanSelections, planning, DEFAULT_S };
