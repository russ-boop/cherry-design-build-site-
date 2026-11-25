{
const $ = id => document.getElementById(id);
const fmt = n => (n < 0 ? "−£" : "£") + Math.round(Math.abs(n)).toLocaleString("en-GB");
const pct = n => (isFinite(n) ? n.toFixed(1) : "0.0") + "%";
const v = id => { const x = parseFloat($(id).value); return isNaN(x) ? 0 : x; };
let mode = "hmo";
const WORKS = {
  hmo:{q:"Number of rooms", r:"£ per room", qv:6, rv:15000},
  refurb:{q:"Floor area (m²)", r:"£ per m²", qv:110, rv:1200},
  newbuild:{q:"Floor area (m²)", r:"£ per m²", qv:180, rv:2200},
  lump:{q:"Quantity", r:"Fixed price (£)", qv:1, rv:80000}
};
function sdlt(price, extra){
  const bands = [[125000,0],[250000,.02],[925000,.05],[1500000,.10],[Infinity,.12]];
  let tax = 0, last = 0;
  for (const [top, rate] of bands){ if (price > last){ tax += (Math.min(price, top) - last) * (rate + (extra ? .05 : 0)); } last = top; }
  return tax;
}
function calc(){
  const price = v("r-price"), stamp = sdlt(price, $("r-surcharge").checked), legal = v("r-legal");
  const works = v("r-qty") * v("r-rate"), fees = works * v("r-fees") / 100, cont = works * v("r-cont") / 100;
  const cost = price + stamp + legal + works + fees + cont;
  const loan = cost * v("r-ltc") / 100, cash = cost - loan, rate = v("r-rate2") / 100;
  const rows = [["Purchase price", price], ["Stamp duty", stamp], ["Legal, survey and buying costs", legal], ["Works", works], ["Professional fees", fees], ["Contingency", cont]];
  let big, bigl, verdict, out;
  if (mode === "hmo"){
    const rent = v("r-rooms") * v("r-rent") * 12 * (1 - v("r-voids") / 100);
    const run = rent * v("r-run") / 100, interest = loan * rate, net = rent - run - interest;
    const gross = rent / cost * 100, netY = (rent - run) / cost * 100, coc = cash > 0 ? net / cash * 100 : 0, equity = v("r-end") - cost;
    big = pct(coc); bigl = "Return on your cash each year";
    verdict = netY >= 8 ? ["good","Strong yield for Bristol"] : netY >= 6 ? ["mid","Workable, check the costs"] : ["bad","Thin: the numbers need work"];
    out = rows.concat([["Total cost", cost, "sum"], ["Borrowed", loan], ["Your cash in", cash, "sum"],
      ["Rent a year (after voids)", rent], ["Running costs", -run], ["Interest a year", -interest], ["Cash flow a year", net, "sum"], ["Cash flow a month", net / 12],
      ["Gross yield", gross, "pct"], ["Net yield", netY, "pct"], ["Equity created", equity, "sum"]]);
  } else {
    const months = v("r-months"), interest = loan * rate * months / 12, gdv = v("r-gdv"), sell = gdv * v("r-sell") / 100;
    const total = cost + interest + sell, profit = gdv - total;
    const poc = profit / total * 100, pog = gdv > 0 ? profit / gdv * 100 : 0, roc = cash > 0 ? profit / cash * 100 : 0;
    big = fmt(profit); bigl = `Profit · ${pct(pog)} of sale value`;
    verdict = pog >= 20 ? ["good","Healthy margin: many lenders look for 15–20% on sale value"] : pog >= 15 ? ["mid","Tight but possible: lenders often want 15–20%"] : ["bad","Margin too thin for most lenders"];
    out = rows.concat([["Finance interest", interest], ["Selling costs", sell], ["Total development cost", total, "sum"], ["Sale value (GDV)", gdv], ["Profit", profit, "sum"],
      ["Profit on cost", poc, "pct"], ["Profit on sale value", pog, "pct"], ["Your cash in", cash], ["Return on your cash", roc, "pct"]]);
  }
  $("r-big").textContent = big; $("r-bigl").textContent = bigl;
  $("r-verdict").className = "verdict " + verdict[0]; $("r-verdict").textContent = verdict[1];
  $("r-table").innerHTML = out.map(r => `<tr class="${r[2] === "sum" ? "sumrow" : ""}"><td>${r[0]}</td><td>${r[2] === "pct" ? pct(r[1]) : fmt(r[1])}</td></tr>`).join("");
}
function setMode(m){
  mode = m;
  document.querySelectorAll("#roiMode button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
  document.querySelectorAll("#roi [data-mode]").forEach(el => { el.style.display = el.dataset.mode === m ? "" : "none"; });
  $("r-rate2").value = m === "dev" ? 9 : 6;
  $("r-price").value = m === "dev" ? 250000 : 300000;
  const wk = m === "dev" ? "refurb" : "hmo", w = WORKS[wk];
  $("r-works").value = wk; $("r-qtyl").textContent = w.q; $("r-ratel").textContent = w.r; $("r-qty").value = w.qv; $("r-rate").value = w.rv;
  calc();
}
$("roiMode").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setMode(b.dataset.m); });
$("r-works").addEventListener("change", e => { const w = WORKS[e.target.value]; $("r-qtyl").textContent = w.q; $("r-ratel").textContent = w.r; $("r-qty").value = w.qv; $("r-rate").value = w.rv; calc(); });
$("roi").addEventListener("input", calc);
setMode("hmo");
}
