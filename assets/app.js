{
/* Prices and pricing formulas live on the server (netlify/functions/_lib). Nothing about rates is in this file. */
const GAP = 0.3; // extensions stop 300 mm short of the house for wall thickness
const S = {
  type:"rear", houseType:"semi", houseW:6.0, houseD:8.0,
  extW:5.7, fullW:true, extD:3.5, sideW:2.5, sideD:6.0,
  existingOpening:"keep", openW:3.0,
  roof:"flat", doors:"bifold", doorW:3.6, flatLights:"2", pitchLights:"2",
  access:"normal", ground:"level", conservation:false,
  storeys:"1", project: document.body.dataset.project === "loft" ? "loft" : "ext", loftType:"dormer", dormerW:2.5, ensuite:true, frontLights:"2"
};
const isLoft = () => S.project === "loft";
const dbl = () => S.storeys === "2";
const rx = () => S.type === "rear" ? (S.houseW - S.extW) / 2 : 0;
const hasRear = () => S.type !== "side";
const hasSide = () => S.type !== "rear";
const lightsSel = () => S.roof === "flat" ? S.flatLights : S.pitchLights;
const lightCount = () => { const v = lightsSel(); return v.startsWith("L") ? Number(v.slice(1)) : (isNaN(+v) ? 0 : +v); };
const T = 0.3;
const TEAL = "#00736a", CHERRY = "#6c0023", GLASS = "#2f6f9a", WALL = "#1d1d1d";

const $ = id => document.getElementById(id);
const fmt = n => "£" + Math.round(n).toLocaleString("en-GB");
const r500 = n => Math.round(n / 500) * 500;
const m = v => v.toFixed(1) + " m";
const esc = v => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* the face the garden doors sit in, and the wall the opening is cut into */
const doorFace = () => S.type === "rear" ? S.extW : S.type === "side" ? S.sideW : S.houseW + S.sideW;
const openWallLen = () => S.type === "side" ? S.sideD : S.extW;
const openMax = () => Math.max(1.5, openWallLen() - 0.9);

function applyRules(){
  S.extW = S.type === "wrap" ? S.houseW : (S.fullW ? S.houseW - 2*GAP : Math.min(S.extW, S.houseW - 2*GAP));
  S.sideD = Math.min(S.sideD, S.houseD - GAP);
  S.openW = Math.min(Math.max(S.openW, 1.5), openMax());
  const maxDoor = Math.max(1.2, doorFace() - 0.6);
  if (S.doors === "french") S.doorW = Math.min(1.5, maxDoor);
  else S.doorW = Math.min(Math.max(S.doorW, Math.min(1.8, maxDoor)), maxDoor);
  return maxDoor;
}
function area(){
  let a = 0;
  if (hasRear()) a += S.extW * S.extD;
  if (hasSide()) a += S.sideW * S.sideD + (S.type === "wrap" ? S.sideW * S.extD : 0);
  return a;
}

/* ---------- loft geometry (40° roof) ---------- */
const PITCH = 0.84;
const L = () => {
  const hd = S.houseD / 2, rise = hd * PITCH, inW = S.houseW - 0.6;
  const dW = S.loftType === "small" ? Math.min(S.dormerW, inW) : inW;
  const hipL = S.houseType === "detached" && S.loftType !== "hip" && S.loftType !== "velux";
  const hipR = S.houseType !== "terraced" && S.loftType !== "hip" && S.loftType !== "velux";
  let area = inW * S.houseD * 0.45;
  if (S.loftType === "small") area += dW * hd * 0.5;
  if (S.loftType === "dormer") area = inW * hd * 1.6;
  if (S.loftType === "hip") area = inW * hd * 1.6 * 1.15;
  let vol = S.loftType === "velux" ? 0 : dW * hd * rise / 2;
  if (S.loftType === "hip") vol += S.houseD * hd * rise / 6 * (S.houseType === "detached" ? 2 : 1);
  return { hd, rise, inW, dW, hipL, hipR, area, vol, limit: S.houseType === "terraced" ? 40 : 50 };
};
const LOFT_NAME = { small:"small dormer loft conversion", dormer:"full rear dormer loft conversion", hip:"hip-to-gable and rear dormer loft conversion", velux:"rooflight loft conversion" };
function planning(){
  if (isLoft()) return loftPlanning();
  const bad = (t,n) => ({ c:"var(--bad)", bg:"rgba(239,106,126,.12)", t, n });
  const ok = (t,n) => ({ c:"var(--good)", bg:"rgba(76,195,138,.12)", t, n });
  const mid = (t,n) => ({ c:"var(--warn)", bg:"rgba(224,176,74,.12)", t, n });
  if (S.conservation) return bad("Planning permission likely needed", "Conservation areas and listed buildings restrict permitted development.");
  if (dbl()){
    if (S.type !== "rear") return bad("Planning permission likely needed", "Two-storey side and wrap-around extensions need a planning application.");
    if (S.houseType === "terraced") return bad("Planning permission likely needed", "Two-storey rear extensions on terraced houses usually need planning.");
    return S.extD <= 3 ? mid("Possible under permitted development", "Up to 3 m deep, at least 7 m from the rear boundary, with a roof matching the house.")
                       : bad("Planning permission likely needed", "Two-storey rear extensions over 3 m deep need planning.");
  }
  if (S.type === "wrap") return bad("Planning permission likely needed", "Wrap-around extensions combine side and rear, which usually takes them outside permitted development.");
  if (S.type === "side"){
    if (S.houseType === "terraced") return mid("Check with us first", "Side extensions are usually only possible on end-of-terrace houses.");
    return S.sideW <= S.houseW / 2 ? ok("Likely permitted development", `Single storey and no wider than half the house (${m(S.houseW/2)}).`)
                                   : bad("Planning permission likely needed", `Wider than half the house (${m(S.houseW/2)}).`);
  }
  const lim = S.houseType === "detached" ? 4 : 3, prior = S.houseType === "detached" ? 8 : 6;
  if (S.extD <= lim) return ok("Likely permitted development", `Within the ${lim} m limit for a ${S.houseType === "semi" ? "semi-detached" : S.houseType} house.`);
  if (S.extD <= prior) return mid("Prior approval route likely", `Over ${lim} m but within ${prior} m, so the larger home extension scheme can apply.`);
  return bad("Planning permission likely needed", `Deeper than ${prior} m.`);
}

function loftPlanning(){
  const g = L();
  const R = (c,bg,t,n) => ({ c, bg, t, n });
  if (S.conservation) return R("var(--bad)","rgba(239,106,126,.12)","Planning permission likely needed","Conservation areas and listed buildings restrict loft conversions.");
  if (S.loftType === "hip" && S.houseType === "terraced") return R("var(--warn)","rgba(224,176,74,.12)","Check with us first","Hip-to-gable needs a hipped roof, usually on semis, detached and end-of-terrace houses.");
  if (S.loftType === "velux") return R("var(--good)","rgba(76,195,138,.12)","Likely permitted development","Rooflights within the existing roof rarely need planning.");
  return g.vol <= g.limit
    ? R("var(--good)","rgba(76,195,138,.12)","Likely permitted development",`About ${g.vol.toFixed(0)} m³ added, within the ${g.limit} m³ allowance for a ${S.houseType === "semi" ? "semi-detached" : S.houseType} house. Dormers must be on the rear slope.`)
    : R("var(--bad)","rgba(239,106,126,.12)","Planning permission likely needed",`About ${g.vol.toFixed(0)} m³ added, over the ${g.limit} m³ allowance.`);
}
const WM = id => `<defs><pattern id="${id}" width="360" height="110" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
  <text x="0" y="55" font-family="IBM Plex Mono,monospace" font-size="15" font-weight="600" fill="rgba(108,0,35,.12)">CONCEPT ONLY · CHERRY DESIGN &amp; BUILD</text></pattern></defs>`;
const WMRECT = id => `<rect x="0" y="0" width="100%" height="100%" fill="url(#${id})" pointer-events="none"/>`;
function dimH(x1,x2,y,label){
  return `<g stroke="${TEAL}" stroke-width="1"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>
  <line x1="${x1}" y1="${y-6}" x2="${x1}" y2="${y+6}"/><line x1="${x2}" y1="${y-6}" x2="${x2}" y2="${y+6}"/></g>
  <text x="${(x1+x2)/2}" y="${y-6}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="12" font-weight="600" fill="${TEAL}">${label}</text>`;
}
function dimV(x,y1,y2,label){
  return `<g stroke="${TEAL}" stroke-width="1"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>
  <line x1="${x-6}" y1="${y1}" x2="${x+6}" y2="${y1}"/><line x1="${x-6}" y1="${y2}" x2="${x+6}" y2="${y2}"/></g>
  <text transform="translate(${x+15},${(y1+y2)/2}) rotate(-90)" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="12" font-weight="600" fill="${TEAL}">${label}</text>`;
}
/* a wall run with gaps: walls drawn as filled bars */
function wallH(x1,x2,y,t,gaps){
  let g = "", cur = x1;
  gaps.slice().sort((a,b)=>a.a-b.a).forEach(gp=>{ if (gp.a > cur) g += `<rect x="${cur}" y="${y}" width="${gp.a-cur}" height="${t}" fill="${WALL}"/>`; cur = Math.max(cur, gp.b); });
  if (cur < x2) g += `<rect x="${cur}" y="${y}" width="${x2-cur}" height="${t}" fill="${WALL}"/>`;
  return g;
}
function wallV(y1,y2,x,t,gaps){
  let g = "", cur = y1;
  gaps.slice().sort((a,b)=>a.a-b.a).forEach(gp=>{ if (gp.a > cur) g += `<rect x="${x}" y="${cur}" width="${t}" height="${gp.a-cur}" fill="${WALL}"/>`; cur = Math.max(cur, gp.b); });
  if (cur < y2) g += `<rect x="${x}" y="${cur}" width="${t}" height="${y2-cur}" fill="${WALL}"/>`;
  return g;
}
const steelH = (a,b,y) => `<line x1="${a}" y1="${y}" x2="${b}" y2="${y}" stroke="${CHERRY}" stroke-width="3" stroke-dasharray="10 4"/><rect x="${a-5}" y="${y-5}" width="9" height="10" fill="${CHERRY}"/><rect x="${b-4}" y="${y-5}" width="9" height="10" fill="${CHERRY}"/>`;
const steelV = (a,b,x) => `<line x1="${x}" y1="${a}" x2="${x}" y2="${b}" stroke="${CHERRY}" stroke-width="3" stroke-dasharray="10 4"/><rect x="${x-5}" y="${a-5}" width="10" height="9" fill="${CHERRY}"/><rect x="${x-5}" y="${b-4}" width="10" height="9" fill="${CHERRY}"/>`;

function drawPlan(){
  const VW = 620, VH = 640;
  const W = S.houseW, HD = S.houseD, ed = hasRear() ? S.extD : 0, sw = hasSide() ? S.sideW : 0;
  const totW = W + sw, totD = HD + ed;
  const s = Math.min((VW - 130) / totW, (VH - 130) / totD, 44), t = T * s;
  const x0 = (VW - totW * s) / 2 - 12, y0 = 46;
  const X = v => x0 + v * s, Y = v => y0 + v * s;
  const yR = Y(HD), xR = X(W);
  let g = `<rect x="0" y="0" width="${VW}" height="${VH}" fill="#eef3ea"/>`;
  /* house */
  g += `<rect x="${X(0)}" y="${Y(0)}" width="${W*s}" height="${HD*s}" fill="#f3f1ec"/>`;
  g += `<line x1="${X(0)}" y1="${Y(HD*0.48)}" x2="${xR}" y2="${Y(HD*0.48)}" stroke="#9a9892" stroke-width="2"/>`;
  g += `<line x1="${X(W*0.36)}" y1="${Y(0)}" x2="${X(W*0.36)}" y2="${Y(HD*0.48)}" stroke="#9a9892" stroke-width="2"/>`;
  for (let i=0;i<7;i++) g += `<line x1="${X(0.15)}" y1="${Y(0.6+i*0.28)}" x2="${X(W*0.36-0.1)}" y2="${Y(0.6+i*0.28)}" stroke="#bdbab2" stroke-width="1"/>`;
  g += `<text x="${X(W*0.68)}" y="${Y(HD*0.24)}" text-anchor="middle" font-size="12" fill="#62615c" font-family="Manrope,sans-serif" font-weight="600">LIVING ROOM</text>`;
  g += `<text x="${X(W*0.18)}" y="${Y(HD*0.24)+50}" text-anchor="middle" font-size="10" fill="#62615c" font-family="Manrope,sans-serif" font-weight="600">HALL / STAIRS</text>`;
  g += `<text x="${X(W/2)}" y="${Y(HD*0.74)}" text-anchor="middle" font-size="12" fill="#62615c" font-family="Manrope,sans-serif" font-weight="600">EXISTING KITCHEN</text>`;
  g += `<text x="${X(W/2)}" y="${Y(0)-24}" text-anchor="middle" font-size="11" fill="#62615c" font-family="Manrope,sans-serif" font-weight="700" letter-spacing="2">FRONT · STREET</text>`;
  /* house walls: front, left */
  g += `<rect x="${X(0)}" y="${Y(0)}" width="${W*s}" height="${t}" fill="${WALL}"/>`;
  g += `<rect x="${X(0)}" y="${Y(0)}" width="${t}" height="${HD*s}" fill="${WALL}"/>`;
  g += `<rect x="${X(W*0.12)}" y="${Y(0)}" width="${0.9*s}" height="${t}" fill="#f3f1ec" stroke="${WALL}" stroke-width=".6"/>`;

  /* extension footprints */
  const ext = [];
  if (hasRear()) ext.push({x:rx(), y:HD, w:S.extW, h:ed});
  if (hasSide()) ext.push({x:W, y:HD - S.sideD, w:sw, h:S.sideD + ed});
  ext.forEach(e => g += `<rect x="${X(e.x)}" y="${Y(e.y)}" width="${e.w*s}" height="${e.h*s}" fill="#fbf8f2"/>`);

  /* rear wall of the house (with original door + window, or a new opening) */
  const rearGaps = [], sideGaps = [];
  const origDoor = {a:X(W*0.28-0.45), b:X(W*0.28+0.45), type:"door"}, origWin = {a:X(W*0.7-0.6), b:X(W*0.7+0.6), type:"win"};
  const opening = S.existingOpening, newOpen = opening !== "keep";
  if (S.type === "side" || !newOpen) rearGaps.push(origDoor, origWin);
  else {
    const ow = (opening === "full" ? openMax() : S.openW);
    const a = opening === "full" ? X(rx() + 0.45) : X(rx() + S.extW/2 - ow/2);
    rearGaps.push({a, b:a + ow*s, type:"new"});
    [origDoor, origWin].forEach(o => { if (o.a > a + ow*s || o.b < a) rearGaps.push(o); });
  }
  g += wallH(X(0), xR, yR - t, t, rearGaps);
  rearGaps.forEach(gp => {
    if (gp.type === "door") g += `<path d="M${gp.a},${yR-t} L${gp.a},${yR-t-(gp.b-gp.a)} A${gp.b-gp.a},${gp.b-gp.a} 0 0 1 ${gp.b},${yR-t}" fill="none" stroke="${GLASS}" stroke-width="1.2"/>`;
    else if (gp.type === "win") g += `<rect x="${gp.a}" y="${yR-t}" width="${gp.b-gp.a}" height="${t}" fill="#fff" stroke="${WALL}" stroke-width=".8"/><line x1="${gp.a}" y1="${yR-t/2}" x2="${gp.b}" y2="${yR-t/2}" stroke="${GLASS}" stroke-width="1.2"/>`;
    else g += steelH(gp.a, gp.b, yR - t/2) + `<text x="${(gp.a+gp.b)/2}" y="${yR - t - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="${CHERRY}" font-family="IBM Plex Mono">STEEL · ${((gp.b-gp.a)/s).toFixed(1)} m</text>`;
  });
  /* right wall of the house (opening for side extensions) */
  if (S.type === "side" && newOpen){
    const ow = opening === "full" ? openMax() : S.openW;
    const mid = HD - S.sideD/2, a = Y(mid - ow/2);
    sideGaps.push({a, b:a + ow*s});
    g += wallV(Y(0), yR, xR - t, t, sideGaps) + steelV(a, a + ow*s, xR - t/2);
    g += `<text transform="translate(${xR - t - 10},${a + ow*s/2}) rotate(-90)" text-anchor="middle" font-size="11" font-weight="700" fill="${CHERRY}" font-family="IBM Plex Mono">STEEL · ${ow.toFixed(1)} m</text>`;
  } else g += `<rect x="${xR-t}" y="${Y(0)}" width="${t}" height="${HD*s}" fill="${WALL}"/>`;

  /* extension walls */
  const dw = S.doorW * s;
  if (hasRear()){
    const xs0 = X(rx()), xe = S.type === "wrap" ? X(W + sw) : X(rx() + S.extW), ye = Y(HD + ed);
    g += `<rect x="${xs0}" y="${yR}" width="${t}" height="${ed*s}" fill="${WALL}"/>`;
    if (S.type === "rear") g += `<rect x="${xe - t}" y="${yR}" width="${t}" height="${ed*s}" fill="${WALL}"/>`;
    const cx = (xs0 + xe)/2;
    g += wallH(xs0, xe, ye - t, t, [{a:cx - dw/2, b:cx + dw/2}]);
  }
  if (hasSide()){
    const xs = X(W + sw), ys = Y(HD - S.sideD), ye = Y(HD + ed);
    g += `<rect x="${xR}" y="${ys}" width="${sw*s}" height="${t}" fill="${WALL}"/>`;
    g += `<rect x="${xs - t}" y="${ys}" width="${t}" height="${ye - ys}" fill="${WALL}"/>`;
    if (S.type === "side"){
      const cx = xR + sw*s/2;
      g += wallH(xR, xs, yR - t, t, [{a:cx - dw/2, b:cx + dw/2}]);
    }
  }
  /* garden doors symbol */
  const dFace = S.type === "side" ? {x1:xR, x2:X(W+sw), y:yR} : {x1:X(rx()), x2:S.type === "wrap" ? X(W+sw) : X(rx() + S.extW), y:Y(HD+ed)};
  const dc = (dFace.x1 + dFace.x2)/2, d1 = dc - dw/2, d2 = dc + dw/2;
  if (S.doors === "bifold"){ const leaves = Math.max(2, Math.round(S.doorW/0.9)); let pts = ""; for (let i=0;i<=leaves;i++) pts += `${d1 + i*dw/leaves},${dFace.y + (i%2 ? 12 : 0)} `; g += `<polyline points="${pts}" fill="none" stroke="${GLASS}" stroke-width="2"/>`; }
  else if (S.doors === "sliding") g += `<rect x="${d1}" y="${dFace.y - t*0.7}" width="${dw*0.55}" height="${t*0.35}" fill="#d4e6f2" stroke="${GLASS}"/><rect x="${d2 - dw*0.55}" y="${dFace.y - t*0.35}" width="${dw*0.55}" height="${t*0.35}" fill="#d4e6f2" stroke="${GLASS}"/>`;
  else { const r = dw/2; g += `<path d="M${d1},${dFace.y} L${d1},${dFace.y+r} A${r},${r} 0 0 0 ${dc},${dFace.y}" fill="none" stroke="${GLASS}" stroke-width="1.4"/><path d="M${d2},${dFace.y} L${d2},${dFace.y+r} A${r},${r} 0 0 1 ${dc},${dFace.y}" fill="none" stroke="${GLASS}" stroke-width="1.4"/>`; }
  /* roof glazing inside the main extension */
  const main = S.type === "side" ? {x:W, y:HD - S.sideD, w:sw, h:S.sideD} : {x:rx(), y:HD, w:S.type === "wrap" ? W + sw : S.extW, h:ed};
  const lv = lightsSel();
  if (S.roof === "flat" && (lv === "lantern" || lv === "lanternL")){
    const big = lv === "lanternL", lw = Math.min(main.w*(big?0.6:0.42), main.w - 0.8), lh = Math.min(main.h*(big?0.55:0.38), big?2.6:1.6);
    const lx = X(main.x + (main.w - lw)/2), ly = Y(main.y + (main.h - lh)/2);
    g += `<rect x="${lx}" y="${ly}" width="${lw*s}" height="${lh*s}" fill="#d4e6f2" fill-opacity=".6" stroke="${GLASS}" stroke-dasharray="6 3"/><line x1="${lx}" y1="${ly}" x2="${lx+lw*s}" y2="${ly+lh*s}" stroke="${GLASS}" stroke-width=".8"/><line x1="${lx+lw*s}" y1="${ly}" x2="${lx}" y2="${ly+lh*s}" stroke="${GLASS}" stroke-width=".8"/>`;
  } else {
    const n = lightCount(), large = S.roof === "leanto" && lv.startsWith("L"), rw = (large ? 1.14 : 0.78), rh = (large ? 1.4 : 0.98);
    for (let i=0;i<n;i++){
      const along = S.type === "side";
      const rx = along ? main.x + (main.w - rw)/2 : main.x + (i+1)*main.w/(n+1) - rw/2;
      const ry = along ? main.y + (i+1)*main.h/(n+1) - rh/2 : main.y + Math.max(0.35, (main.h - rh)/2 - 0.3);
      g += `<rect x="${X(rx)}" y="${Y(ry)}" width="${rw*s}" height="${rh*s}" fill="#d4e6f2" fill-opacity=".6" stroke="${GLASS}" stroke-dasharray="5 3"/>`;
    }
  }
  /* labels */
  if (S.type === "side"){
    const lx = X(main.x + main.w/2), ly = Y(main.y + main.h/2);
    g += `<g transform="translate(${lx},${ly}) rotate(-90)"><text x="0" y="-2" text-anchor="middle" font-size="12" font-weight="800" fill="#161616" font-family="Manrope,sans-serif">NEW SIDE EXTENSION${dbl() ? " · 2 STOREYS" : ""}</text><text x="0" y="13" text-anchor="middle" font-size="11" fill="#62615c" font-family="IBM Plex Mono">${area().toFixed(1)} m²</text></g>`;
  } else {
    const lx = X(main.x + main.w/2), ly = Y(main.y + main.h*0.78);
    g += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="12" font-weight="800" fill="#161616" font-family="Manrope,sans-serif">NEW ${S.type === "wrap" ? "WRAP-AROUND" : "REAR"} EXTENSION${dbl() ? " · 2 STOREYS" : ""}</text>`;
    g += `<text x="${lx}" y="${ly + 15}" text-anchor="middle" font-size="11" fill="#62615c" font-family="IBM Plex Mono">approx. ${area().toFixed(1)} m² footprint</text>`;
  }
  g += `<text x="${VW/2}" y="${VH-14}" text-anchor="middle" font-size="11" fill="#4f6b47" font-family="Manrope,sans-serif" font-weight="700" letter-spacing="2">GARDEN</text>`;
  /* dimensions */
  g += dimH(X(0), xR, Y(0) - 8, "house " + m(W));
  if (hasSide() || S.type === "rear") g += dimV(X(0) - 26, Y(0), yR, "house " + m(HD));
  if (S.type === "rear") g += dimH(X(rx()), X(rx() + S.extW), Y(HD + ed) + 30, m(S.extW) + " (300 mm in each side)");
  if (S.type === "wrap") g += dimH(X(0), X(W + sw), Y(HD + ed) + 30, m(W + sw));
  if (hasRear()) g += dimV(X(totW) + 22, yR, Y(HD + ed), m(ed));
  if (hasSide()){
    g += dimH(xR, X(W + sw), Y(HD - S.sideD) - 10, m(sw));
    g += dimV(X(totW) + (hasRear() ? 46 : 22), Y(HD - S.sideD), yR, m(S.sideD));
  }
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Concept plan of your house and extension">${WM("wmP")}${g}${WMRECT("wmP")}</svg>`;
}

function drawElev(){
  const VW = 620, VH = 330, W = S.houseW, sw = hasSide() ? S.sideW : 0;
  const s = Math.min(30, (VW - 90) / (W + sw)), gy = 290, x0 = (VW - (W + sw)*s)/2, xR = x0 + W*s, line = "#1d1d1d";
  const eaves = gy - 5.4*s, ridge = gy - 7.9*s;
  let g = `<rect x="0" y="${gy}" width="${VW}" height="${VH-gy}" fill="#eef3ea"/>`;
  g += `<polygon points="${x0-0.25*s},${eaves} ${xR+0.25*s},${eaves} ${xR-0.9*s},${ridge} ${x0+0.9*s},${ridge}" fill="#5f5a57" stroke="${line}"/>`;
  g += `<rect x="${x0}" y="${eaves}" width="${W*s}" height="${5.4*s}" fill="#ece6dc" stroke="${line}"/>`;
  [0.27,0.73].forEach(f=>{ const wx = x0 + W*s*f - 0.6*s; g += `<rect x="${wx}" y="${gy-4.9*s}" width="${1.2*s}" height="${1.15*s}" fill="#d4e6f2" stroke="${line}"/>`; });
  const box = (bx, bw) => {
    let h = "", topY;
    if (dbl()){
      const wy = gy - 5.2*s; topY = S.roof === "flat" ? wy : wy - 1.4*s;
      if (S.roof === "flat") h += `<rect x="${bx}" y="${wy}" width="${bw}" height="${5.2*s}" fill="#f7f1e7" stroke="${line}" stroke-width="1.4"/><rect x="${bx-3}" y="${wy}" width="${bw+6}" height="${0.28*s}" fill="#2b2b2b"/>`;
      else h += `<polygon points="${bx-0.2*s},${wy} ${bx+bw+0.2*s},${wy} ${bx+bw-0.8*s},${topY} ${bx+0.8*s},${topY}" fill="#5f5a57" stroke="${line}"/><rect x="${bx}" y="${wy}" width="${bw}" height="${5.2*s}" fill="#f7f1e7" stroke="${line}" stroke-width="1.4"/>`;
      const n = Math.max(1, Math.round(bw/s/2.4));
      for (let i=0;i<n;i++){ const ww = 1.1*s, wx = bx + (i+0.5)*bw/n - ww/2; h += `<rect x="${wx}" y="${gy-4.6*s}" width="${ww}" height="${1.1*s}" fill="#d4e6f2" stroke="${line}"/>`; }
      return { h, topY };
    }
    if (S.roof === "flat"){ topY = gy - 3.0*s; h += `<rect x="${bx}" y="${topY}" width="${bw}" height="${3.0*s}" fill="#f7f1e7" stroke="${line}" stroke-width="1.4"/><rect x="${bx-3}" y="${topY}" width="${bw+6}" height="${0.28*s}" fill="#2b2b2b"/>`; }
    else { const ey = gy - 2.5*s; topY = gy - 3.6*s; h += `<rect x="${bx}" y="${ey}" width="${bw}" height="${2.5*s}" fill="#f7f1e7" stroke="${line}" stroke-width="1.4"/><rect x="${bx-0.2*s}" y="${topY}" width="${bw+0.4*s}" height="${ey-topY}" fill="#5f5a57" stroke="${line}"/>`; }
    return { h, topY };
  };
  let topY = gy;
  if (S.type === "rear"){ const b = box(x0 + rx()*s, S.extW*s); g += b.h; topY = b.topY; }
  if (S.type === "side"){ const b = box(xR, sw*s); g += b.h; topY = b.topY; }
  if (S.type === "wrap"){ const b = box(x0, (W + sw)*s); g += b.h; topY = b.topY; }
  if (S.type === "side" && S.roof === "flat") { /* side box sits beside house */ }
  const face = S.type === "side" ? {a:xR, w:sw*s} : {a:x0 + rx()*s, w:(S.type === "wrap" ? W + sw : S.extW)*s};
  const dw = S.doorW*s, o1 = face.a + face.w/2 - dw/2, dh = 2.1*s;
  g += `<rect x="${o1}" y="${gy-dh}" width="${dw}" height="${dh}" fill="#d4e6f2" stroke="${line}" stroke-width="1.4"/>`;
  const leaves = S.doors === "french" ? 2 : S.doors === "sliding" ? Math.max(2, Math.round(S.doorW/2)) : Math.max(2, Math.round(S.doorW/0.9));
  for (let i=1;i<leaves;i++) g += `<line x1="${o1+i*dw/leaves}" y1="${gy-dh}" x2="${o1+i*dw/leaves}" y2="${gy}" stroke="${line}" stroke-width="1.2"/>`;
  g += `<line x1="0" y1="${gy}" x2="${VW}" y2="${gy}" stroke="${line}" stroke-width="1.6"/>`;
  g += dimV(x0 + (W + sw)*s + 22, topY, gy, m((gy-topY)/s));
  g += dimH(o1, o1+dw, gy + 22, "doors " + m(S.doorW));
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Concept rear elevation">${WM("wmE")}${g}${WMRECT("wmE")}</svg>`;
}

function drawLoftElev(){
  const VW = 620, VH = 330, W = S.houseW, g0 = L();
  const gy = 300, s = Math.min(34, (VW - 100) / W, (gy - 34) / (5.4 + g0.rise)), x0 = (VW - W*s)/2, xR = x0 + W*s, line = "#1d1d1d";
  const eaves = gy - 5.4*s, ridge = eaves - g0.rise*s, inset = Math.min(g0.hd, W/2) * s;
  const tl = g0.hipL ? x0 + inset*0.9 : x0, tr = g0.hipR ? xR - inset*0.9 : xR;
  let g = `<rect x="0" y="${gy}" width="${VW}" height="${VH-gy}" fill="#eef3ea"/>`;
  if (S.loftType === "hip"){
    const oL = S.houseType === "detached" ? x0 + inset*0.9 : x0, oR = S.houseType !== "terraced" ? xR - inset*0.9 : xR;
    if (oR < xR) g += `<polygon points="${oR},${ridge} ${xR},${ridge} ${xR},${eaves}" fill="${CHERRY}" fill-opacity=".18" stroke="${CHERRY}" stroke-dasharray="5 3"/>`;
    if (oL > x0) g += `<polygon points="${x0},${ridge} ${oL},${ridge} ${x0},${eaves}" fill="${CHERRY}" fill-opacity=".18" stroke="${CHERRY}" stroke-dasharray="5 3"/>`;
  }
  g += `<polygon points="${x0-0.25*s},${eaves} ${xR+0.25*s},${eaves} ${tr},${ridge} ${tl},${ridge}" fill="#5f5a57" stroke="${line}"/>`;
  g += `<rect x="${x0}" y="${eaves}" width="${W*s}" height="${5.4*s}" fill="#ece6dc" stroke="${line}"/>`;
  [0.27,0.73].forEach(f=>{ const wx = x0 + W*s*f - 0.6*s; g += `<rect x="${wx}" y="${gy-4.9*s}" width="${1.2*s}" height="${1.15*s}" fill="#d4e6f2" stroke="${line}"/><rect x="${wx}" y="${gy-2.1*s}" width="${1.2*s}" height="${1.15*s}" fill="#d4e6f2" stroke="${line}"/>`; });
  if (S.loftType === "velux"){
    const rh = (eaves-ridge)*0.38, ry = ridge + (eaves-ridge)*0.32;
    [0.3,0.7].forEach(f=>{ const vx = x0 + W*s*f - 0.39*s; g += `<rect x="${vx}" y="${ry}" width="${0.78*s}" height="${rh}" fill="#d4e6f2" stroke="${line}" stroke-width="1.4"/><line x1="${vx}" y1="${ry+rh/2}" x2="${vx+0.78*s}" y2="${ry+rh/2}" stroke="${line}" stroke-width=".7"/>`; });
    g += `<text x="${x0 + W*s/2}" y="${ridge - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="${CHERRY}" font-family="IBM Plex Mono">ROOFLIGHTS IN REAR SLOPE</text>`;
  } else {
    const dw = g0.dW*s, dx = x0 + (W*s - dw)/2, top = ridge + 0.12*s, bot = eaves - 0.35*s;
    g += `<rect x="${dx}" y="${top}" width="${dw}" height="${bot-top}" fill="#3e3b39" stroke="${line}" stroke-width="1.4"/>`;
    const n = S.loftType === "small" ? 1 : Math.max(2, Math.round(g0.dW/2));
    for (let i=0;i<n;i++){ const ww = Math.min(1.2*s, dw/n - 0.4*s), wx = dx + (i+0.5)*dw/n - ww/2; g += `<rect x="${wx}" y="${top + (bot-top)*0.22}" width="${ww}" height="${(bot-top)*0.6}" fill="#d4e6f2" stroke="${line}"/>`; }
    g += dimH(dx, dx + dw, top - 10, "dormer " + m(g0.dW));
  }
  g += `<line x1="0" y1="${gy}" x2="${VW}" y2="${gy}" stroke="${line}" stroke-width="1.6"/>`;
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Concept rear elevation of your loft conversion">${WM("wmE")}${g}${WMRECT("wmE")}</svg>`;
}
function drawLoftSection(){
  const VW = 620, VH = 640, g0 = L(), D = S.houseD;
  const s = Math.min(46, (VW - 140) / D), gy = VH - 60, x0 = (VW - D*s)/2, xB = x0 + D*s, line = "#1d1d1d";
  const eaves = gy - 5.4*s, ridge = eaves - g0.rise*s, xm = x0 + D*s/2, t = 0.3*s;
  let g = `<rect x="0" y="${gy}" width="${VW}" height="${VH-gy}" fill="#eef3ea"/>`;
  g += `<rect x="${x0}" y="${eaves}" width="${D*s}" height="${5.4*s}" fill="#f3f1ec"/>`;
  g += `<rect x="${x0}" y="${eaves}" width="${t}" height="${5.4*s}" fill="${WALL}"/><rect x="${xB-t}" y="${eaves}" width="${t}" height="${5.4*s}" fill="${WALL}"/>`;
  g += `<line x1="${x0}" y1="${gy-2.7*s}" x2="${xB}" y2="${gy-2.7*s}" stroke="${WALL}" stroke-width="3"/>`;
  g += `<text x="${xm}" y="${gy-1.2*s}" text-anchor="middle" font-size="12" fill="#62615c" font-family="Manrope,sans-serif" font-weight="600">GROUND FLOOR</text>`;
  g += `<text x="${xm}" y="${gy-3.9*s}" text-anchor="middle" font-size="12" fill="#62615c" font-family="Manrope,sans-serif" font-weight="600">FIRST FLOOR</text>`;
  const dormer = S.loftType !== "velux";
  const faceX = xB - 0.2*s - t, roofY = ridge + 0.12*s;
  let roomPts = `${x0+t},${eaves} ${xm},${ridge} `;
  roomPts += dormer ? `${xm},${roofY} ${faceX},${roofY} ${faceX},${eaves}` : `${xB-t},${eaves}`;
  g += `<polygon points="${roomPts}" fill="#fbf8f2"/>`;
  g += `<polyline points="${x0-0.3*s},${eaves+0.2*s} ${xm},${ridge-0.1*s} ${dormer ? `${xm},${roofY-0.15*s}` : `${xB+0.3*s},${eaves+0.2*s}`}" fill="none" stroke="#5f5a57" stroke-width="${0.22*s}" stroke-linejoin="round"/>`;
  if (dormer){
    g += `<line x1="${xm}" y1="${ridge}" x2="${xB+0.3*s}" y2="${eaves+0.2*s}" stroke="#9a9892" stroke-width="1.2" stroke-dasharray="6 4"/>`;
    g += `<rect x="${xm}" y="${roofY-0.25*s}" width="${faceX-xm+0.25*s}" height="${0.25*s}" fill="#5f5a57"/>`;
    g += `<rect x="${faceX}" y="${roofY-0.25*s}" width="${0.25*s}" height="${eaves-roofY+0.25*s}" fill="#5f5a57"/>`;
    g += `<rect x="${faceX}" y="${roofY + (eaves-roofY)*0.25}" width="${0.25*s}" height="${(eaves-roofY)*0.55}" fill="#d4e6f2" stroke="${GLASS}"/>`;
    g += `<text x="${faceX-8}" y="${roofY-10}" text-anchor="end" font-size="11" font-weight="700" fill="${CHERRY}" font-family="IBM Plex Mono">NEW DORMER</text>`;
    g += `<text x="${(xm+xB)/2}" y="${ridge+(eaves-ridge)*0.38}" text-anchor="middle" font-size="10" fill="#9a9892" font-family="IBM Plex Mono">existing roof line</text>`;
  }
  g += `<line x1="${x0+t}" y1="${eaves}" x2="${xB-t}" y2="${eaves}" stroke="${CHERRY}" stroke-width="4"/>`;
  const hh = eaves - 2.2*s, hx1 = dormer ? xm - 1.2*s : xm - 0.9*s, hx2 = dormer ? faceX - 0.1*s : xm + 0.9*s;
  if (hh > ridge + 0.1*s) g += `<line x1="${hx1}" y1="${hh}" x2="${hx2}" y2="${hh}" stroke="${TEAL}" stroke-dasharray="4 3"/><text x="${hx1+4}" y="${hh-5}" font-size="10" fill="${TEAL}" font-family="IBM Plex Mono" font-weight="600">2.2 m headroom</text>`;
  g += `<text x="${dormer ? (xm+faceX)/2 : xm}" y="${eaves-0.7*s}" text-anchor="middle" font-size="12" font-weight="800" fill="#161616" font-family="Manrope,sans-serif">NEW BEDROOM${S.ensuite ? " + EN-SUITE" : ""}</text>`;
  g += `<text x="${dormer ? (xm+faceX)/2 : xm}" y="${eaves-0.7*s+15}" text-anchor="middle" font-size="11" fill="#62615c" font-family="IBM Plex Mono">approx. ${g0.area.toFixed(0)} m² usable</text>`;
  if (!dormer) for (let i=0;i<2;i++){ const f = 0.35 + i*0.2; const px = xB - (xB-xm)*f, py = eaves - (eaves-ridge)*f; g += `<line x1="${px}" y1="${py}" x2="${px-0.55*s}" y2="${py-0.55*s*PITCH}" stroke="${GLASS}" stroke-width="5"/>`; }
  if (!dormer) g += `<text x="${(xm+xB)/2+14}" y="${ridge+(eaves-ridge)*0.34}" font-size="10" font-weight="700" fill="${CHERRY}" font-family="IBM Plex Mono">ROOFLIGHTS</text>`;
  [0.3,0.62].forEach(f=>{ const bx = x0 + D*s*f; g += `<rect x="${bx-5}" y="${eaves-3}" width="10" height="${0.3*s}" fill="${CHERRY}"/><rect x="${bx-9}" y="${eaves-3}" width="18" height="3" fill="${CHERRY}"/><rect x="${bx-9}" y="${eaves+0.3*s-5}" width="18" height="3" fill="${CHERRY}"/>`; });
  g += `<text x="${x0 + D*s*0.46}" y="${eaves+0.3*s+14}" text-anchor="middle" font-size="10" font-weight="700" fill="${CHERRY}" font-family="IBM Plex Mono">STEEL BEAMS · NEW FLOOR</text>`;
  for (let i=0;i<Number(S.frontLights);i++){ const f = 0.35 + i*0.18; const px = x0 + (xm-x0)*f, py = eaves - (eaves-ridge)*f; g += `<line x1="${px}" y1="${py}" x2="${px+0.55*s}" y2="${py-0.55*s*PITCH}" stroke="${GLASS}" stroke-width="5"/>`; }
  g += `<text x="${x0}" y="${ridge-14}" font-size="11" fill="#62615c" font-family="Manrope,sans-serif" font-weight="700" letter-spacing="2">FRONT</text><text x="${xB}" y="${ridge-14}" text-anchor="end" font-size="11" fill="#62615c" font-family="Manrope,sans-serif" font-weight="700" letter-spacing="2">REAR</text>`;
  g += dimH(x0, xB, gy + 28, "house depth " + m(D));
  g += `<line x1="0" y1="${gy}" x2="${VW}" y2="${gy}" stroke="${line}" stroke-width="1.6"/>`;
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Concept section through your loft conversion">${WM("wmP")}${g}${WMRECT("wmP")}</svg>`;
}

const TYPE_NAME = { rear:"rear extension", side:"side extension", wrap:"wrap-around extension" };
function labels(){
  if (isLoft()) return [
    `Build: ${L().area.toFixed(0)} m² ${LOFT_NAME[S.loftType]}`, "Steel beams for the new floor", "En-suite shower room",
    `Front rooflights × ${S.frontLights}`, "Scaffold access and site logistics", "Site management",
    "Design and building regs drawings", "Structural engineer", "Building control"];
  const doorLabel = {bifold:"Bi-fold doors", sliding:"Sliding doors", french:"French doors"}[S.doors];
  const lv = lightsSel();
  const lightLabel = S.roof === "flat"
    ? ({lantern:"Roof lantern", lanternL:"Large roof lantern", "0":"Roof glazing (none)"}[lv] || `Flat rooflights × ${lv}`)
    : (lv === "0" ? "Velux windows (none)" : `${lv.startsWith("L") ? "Large Velux" : "Velux"} × ${lightCount()}`);
  const openLabel = {keep:"Opening into house: original door kept", widen:`Opening into house: ${m(S.openW)} with steel`, full:`Open-plan: ${m(openMax())} steel and piers`}[S.existingOpening];
  return [
    `Build: ${area().toFixed(1)} m² ${dbl() ? "two-storey" : "single-storey"} ${TYPE_NAME[S.type]}${dbl() ? " (both floors)" : ""}, ${S.roof === "flat" ? "flat roof" : "pitched roof"}`,
    openLabel, doorLabel + (S.doors === "french" ? "" : ` (${m(S.doorW)})`), lightLabel,
    "Site logistics and access", "Site management", "Design and building regs drawings", "Structural engineer", "Building control"];
}

/* ---------- estimate from the server ---------- */
let lead = null;      // { submissionId, contact, page } once the customer has sent their details
let quote = null;     // last price the server sent back
let quotedKey = "";   // which design that price was for
const designKey = () => JSON.stringify(S);
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
function askServer(update){
  const key = designKey();
  return fetch("/.netlify/functions/submit-estimate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId: lead.submissionId, contact: lead.contact, page: lead.page, selections: S, update: !!update, company: lead.company })
  }).then(r => r.json().then(d => ({ ok: r.ok, d }))).then(({ ok, d }) => {
    if (!ok) { const er = new Error(d.error || "Something went wrong."); er.check = true; throw er; }
    quote = d; quotedKey = key; render(); return d;
  });
}
let repriceTimer = null;
function reprice(){
  clearTimeout(repriceTimer);
  repriceTimer = setTimeout(() => { askServer(true).catch(e => { $("done").textContent = e.message; }); }, 600);
}

function render(){
  const maxDoor = applyRules();
  const show = (id, on) => { $(id).style.display = on ? "" : "none"; };
  document.querySelectorAll("[data-for]").forEach(el => { el.style.display = el.dataset.for === S.project ? "" : "none"; });
  show("houseDStep", true);
  show("sideStep", !isLoft() && hasSide());
  show("extWStep", !isLoft() && S.type === "rear");
  show("extDStep", !isLoft() && hasRear());
  $("ensuite").checked = S.ensuite;
  const g0 = L();
  $("dormerWWrap").style.display = isLoft() && S.loftType === "small" ? "block" : "none";
  $("dormerW").max = g0.inW.toFixed(1); $("dormerW").value = Math.min(S.dormerW, g0.inW); $("o-dormerW").textContent = m(g0.dW);
  $("loftHint").textContent = {small:"A smaller box dormer on the rear slope. Good value if you need one bedroom.", dormer:"Full-width box dormer on the rear slope, set in 300 mm from each side wall. The most popular option in Bristol.", hip:"The sloping hipped end is built up into a straight gable, then a rear dormer goes across. Best on semis and detached houses.", velux:"Rooflights in the existing roof slopes. Cheapest, but you only gain headroom where the roof is high enough."}[S.loftType];
  $("ctrlTitle").textContent = isLoft() ? "Your loft conversion" : "Your extension";
  $("moreLabel").textContent = isLoft() ? "Add more details: access and planning" : "Add more details: opening, roof, doors, glazing";
  $("cap1").textContent = isLoft() ? "Section" : "Plan"; $("tab1").textContent = isLoft() ? "Section" : "Plan";
  $("houseW").value = S.houseW; $("o-houseW").textContent = m(S.houseW);
  $("houseD").value = S.houseD; $("o-houseD").textContent = m(S.houseD);
  $("sideW").value = S.sideW; $("o-sideW").textContent = m(S.sideW);
  $("sideD").max = (S.houseD - GAP).toFixed(1); $("sideD").value = S.sideD; $("o-sideD").textContent = m(S.sideD);
  $("extW").max = (S.houseW - GAP).toFixed(1); $("extW").value = S.extW; $("extW").disabled = S.fullW; $("o-extW").textContent = m(S.extW);
  $("fullW").checked = S.fullW;
  $("extD").value = S.extD; $("o-extD").textContent = m(S.extD);
  $("doorW").max = maxDoor.toFixed(1); $("doorW").value = S.doorW; $("o-doorW").textContent = m(S.doorW);
  $("doorWWrap").style.display = S.doors === "french" ? "none" : "block";
  $("conservation").checked = S.conservation;
  document.querySelectorAll(".seg[data-key]").forEach(seg=>{
    const k = seg.dataset.key;
    seg.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", String(S[k]) === b.dataset.v));
  });
  $("flatLightsSeg").style.display = S.roof === "flat" ? "flex" : "none";
  $("pitchLightsSeg").style.display = S.roof === "flat" ? "none" : "flex";
  $("openWWrap").style.display = S.existingOpening === "widen" ? "block" : "none";
  $("openW").max = openMax().toFixed(1); $("openW").value = S.openW; $("o-openW").textContent = m(S.openW);
  const wallName = S.type === "side" ? "side wall" : "back wall";
  $("openHint").textContent = {
    keep: `Your existing doors and windows stay. The extension is built against the ${wallName}.`,
    widen: `Part of the ${wallName} comes out. A steel beam carries the house above.`,
    full: `The ${wallName} is opened up (${m(openMax())}) with a steel beam and piers at each end.`
  }[S.existingOpening];
  document.querySelector(".titleblock span").textContent = isLoft() ? `Cherry Design & Build · Concept L-01 · ${LOFT_NAME[S.loftType]}` : `Cherry Design & Build · Concept C-01 · ${dbl() ? "Two-storey" : "Single-storey"} ${TYPE_NAME[S.type]}`;

  $("plan").innerHTML = isLoft() ? drawLoftSection() : drawPlan();
  $("elev").innerHTML = isLoft() ? drawLoftElev() : drawElev();

  const p = planning();
  $("pd").style.background = p.bg; $("pd").querySelector(".dot").style.background = p.c;
  $("pdText").textContent = p.t; $("pdNote").textContent = p.n + " Indicative only; we confirm at survey.";

  $("tbArea").textContent = `${isLoft() ? "Usable area" : "Footprint"} ${(isLoft() ? L().area : area()).toFixed(1)} m²`;
  const fresh = quote && quotedKey === designKey();
  let html;
  if (quote && quote.lines && quote.lines.length){
    html = quote.lines.map(l=>`<tr><td>${esc(l.label)}${l.badge ? `<span class="badge">${esc(l.badge)}</span>` : ""}</td><td>${fmt(l.amount)}</td></tr>`).join("");
    html += `<tr class="total"><td>Estimated budget${quote.ref ? ` <small>· ref ${esc(quote.ref)}</small>` : ""}</td><td>${fmt(quote.low)} – ${fmt(quote.high)}</td></tr>`;
  } else {
    html = labels().map((l,i)=>`<tr><td>${esc(l)}${i === 5 ? `<span class="badge">SMSTS</span>` : ""}</td><td>£ ••,•••</td></tr>`).join("");
    html += `<tr class="total"><td>Estimated budget</td><td>£ ••,••• – £ ••,•••</td></tr>`;
  }
  $("priceTable").innerHTML = html;
  $("priceTable").style.opacity = quote && !fresh ? ".45" : "";
  if (lead && quote && !fresh) reprice();
}

function summary(){
  if (!quote) return "";
  return [`Cherry Design & Build: ${isLoft() ? "loft conversion" : "extension"} estimate${quote.ref ? " · ref " + quote.ref : ""}`,
    `${quote.description}, ${S.houseType === "semi" ? "semi-detached" : S.houseType} house`,
    "", ...quote.lines.filter(l=>l.amount > 0).map(l=>`${l.label}: ${fmt(l.amount)}`),
    `Estimated budget: ${fmt(quote.low)} – ${fmt(quote.high)} (ex VAT)`, `Planning: ${quote.planning}`, "", "Cherry Design & Build · 07488 557750"].join("\n");
}

/* events */
document.querySelectorAll(".seg[data-key]").forEach(seg=>{
  seg.addEventListener("click", e=>{
    const b = e.target.closest("button"); if (!b) return;
    S[seg.dataset.key] = b.dataset.v;
    if (seg.dataset.key === "doors" && b.dataset.v !== "french" && S.doorW < 2.4) S.doorW = Math.min(3.0, doorFace() - 0.6);
    render();
  });
});
$("ensuite").addEventListener("change", e=>{ S.ensuite = e.target.checked; render(); });
[["dormerW","dormerW"],["houseW","houseW"],["houseD","houseD"],["sideW","sideW"],["sideD","sideD"],["extW","extW"],["extD","extD"],["doorW","doorW"],["openW","openW"]]
  .forEach(([id,k]) => $(id).addEventListener("input", e=>{ S[k] = +e.target.value; render(); }));
$("fullW").addEventListener("change", e=>{ S.fullW = e.target.checked; render(); });
$("conservation").addEventListener("change", e=>{ S.conservation = e.target.checked; render(); });
document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click", ()=>{
  document.querySelectorAll(".tabs button").forEach(x=>x.setAttribute("aria-pressed", x === b));
  $("v-plan").hidden = b.dataset.tab !== "plan"; $("v-elev").hidden = b.dataset.tab !== "elev";
}));
if (window.matchMedia("(max-width:980px)").matches) $("v-elev").hidden = true;

$("gate").addEventListener("submit", e=>{
  e.preventDefault();
  const f = e.target, err = $("gateErr"), btn = f.querySelector("button[type=submit]");
  if (btn.disabled) return;
  const bad = [...f.querySelectorAll("input[required]")].find(i => !i.checkValidity());
  if (bad){ err.textContent = bad.name === "consent" ? "Please tick the box so we can contact you." : `Please fill in your ${bad.name}.`; bad.focus(); return; }
  err.textContent = "";
  const fd = new FormData(f), name = fd.get("name");
  lead = lead || { submissionId: newId() };
  lead.page = location.pathname; lead.company = fd.get("company") || "";
  lead.contact = { name, phone: fd.get("phone"), email: fd.get("email"), postcode: fd.get("postcode"), consent: !!fd.get("consent") };
  btn.disabled = true; const label = btn.textContent; btn.textContent = "Working out your price…";
  askServer(false).then(d => {
    $("priceBox").classList.remove("locked"); $("priceBox").classList.add("unlocked");
    $("done").textContent = `Thanks ${name}, here's your full breakdown${d.ref ? ` (reference ${d.ref})` : ""}. We'll call you within one working day to book a free site visit.`;
    /* backup copy to the Netlify Forms inbox */
    fd.set("estimate", summary()); fd.set("page", location.pathname);
    fetch("/", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body: new URLSearchParams(fd).toString() }).catch(()=>{});
  }).catch(ex => {
    lead = null;
    if (!ex.check){
      /* server unreachable: still get the details to Russ through the Netlify Forms inbox */
      fd.set("estimate", "PRICE NOT SENT (server error). Design: " + JSON.stringify(S)); fd.set("page", location.pathname);
      fetch("/", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body: new URLSearchParams(fd).toString() }).catch(()=>{});
      err.textContent = "We couldn't work out your price just now, but we've got your details and will call you. You can also ring 07488 557750.";
    } else err.textContent = ex.message;
  }).finally(() => { btn.disabled = false; btn.textContent = label; });
});
$("copySum").addEventListener("click", ()=>{
  const t = summary(), msg = $("copyMsg");
  const fallback = ()=>{ const ta = $("sumText"); ta.value = t; ta.hidden = false; ta.select(); msg.textContent = "Select and copy the text below."; };
  try { navigator.clipboard.writeText(t).then(()=>{ msg.textContent = "Copied to your clipboard."; }, fallback); } catch (e) { fallback(); }
});
$("restart").addEventListener("click", ()=>{ document.querySelector(".controls").scrollIntoView({ behavior:"smooth", block:"start" }); });
$("moreBtn").addEventListener("click", e=>{ const box = $("moreBox"); box.hidden = !box.hidden; e.currentTarget.setAttribute("aria-expanded", String(!box.hidden)); });
$("priceNow").addEventListener("click", ()=>{ $("priceBox").scrollIntoView({ behavior:"smooth", block:"start" }); });

render();
}
