/* POST /.netlify/functions/submit-estimate
   The only place a price is worked out. Checks the details, blocks spam and double taps,
   recalculates the estimate from the selections, saves the lead, and returns the breakdown.

   Environment variables (set in Netlify -> Site configuration -> Environment variables, never in code):
     SUPABASE_URL          e.g. https://xxxx.supabase.co
     SUPABASE_SERVICE_KEY  the secret service_role key (server only)
     IP_SALT               any long random text, used to hash IP addresses
   Without the Supabase variables the function still prices and replies (useful on preview links),
   but nothing is saved and the reply says so. */
"use strict";
const crypto = require("crypto");
const { estimate } = require("./_lib/pricing");
const PRICES = require("./_lib/prices");

const MAX_PER_HOUR = 5;   // new leads per connection per hour
const MAX_UPDATES = 40;   // re-prices per lead after the reveal
const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body)
});

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkContact(b) {
  const c = {
    name: clean(b.name, 100),
    phone: clean(b.phone, 30),
    email: clean(b.email, 200).toLowerCase(),
    postcode: clean(b.postcode, 10).toUpperCase(),
    consent: b.consent === true || b.consent === "on" || b.consent === "true"
  };
  const digits = c.phone.replace(/[^\d]/g, "");
  if (!c.name) return { error: "Please fill in your name." };
  if (digits.length < 10 || digits.length > 13) return { error: "Please check your phone number." };
  if (!EMAIL.test(c.email)) return { error: "Please check your email address." };
  if (!POSTCODE.test(c.postcode)) return { error: "Please check your postcode." };
  if (!c.consent) return { error: "Please tick the box so we can contact you." };
  c.postcode = c.postcode.replace(/\s*(\d[A-Z]{2})$/, " $1");
  return { contact: c };
}

/* minimal Supabase REST client: no extra packages */
function db() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  const call = async (path, opts = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...opts,
      headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", ...(opts.headers || {}) }
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  return { call };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if ((event.body || "").length > 20000) return json(413, { error: "Too large" });

  let b;
  try { b = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body || "{}"); }
  catch (e) { return json(400, { error: "Bad request" }); }

  // honeypot: bots fill the hidden "company" field. Pretend it worked, save nothing.
  if (clean(b.company, 200)) return json(200, { ok: true, ref: null, lines: [], low: 0, high: 0 });

  if (!UUID.test(String(b.submissionId || ""))) return json(400, { error: "Please refresh the page and try again." });
  const { contact, error } = checkContact(b.contact || {});
  if (error) return json(400, { error });

  const est = estimate(b.selections, PRICES);
  if (est.errors.length) return json(400, { error: "Something in your design didn't look right. Please refresh the page and try again." });

  const reply = {
    ok: true, ref: null, saved: false,
    description: est.description, planning: est.planning, area: est.area,
    lines: est.lines, low: est.low, high: est.high
  };

  const store = db();
  if (!store) {
    console.warn("Supabase not configured: lead NOT saved", contact.email, est.low, est.high);
    return json(200, reply);
  }

  try {
    const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || event.headers["x-forwarded-for"] || "";
    const ipHash = crypto.createHash("sha256").update(ip + (process.env.IP_SALT || "cdb")).digest("hex");

    const existing = await store.call(`projects?submission_id=eq.${b.submissionId}&select=ref,update_count`);
    if (existing && existing.length) {
      // customer changed their design after the reveal: re-price the same lead, don't make a new one
      if (b.update === true) {
        if (existing[0].update_count >= MAX_UPDATES) return json(429, { error: "Please call us on 07488 557750 to talk through more options." });
        await store.call(`projects?submission_id=eq.${b.submissionId}`, {
          method: "PATCH",
          body: JSON.stringify({
            selections: est.selections, lines: est.lines, area_m2: est.area, description: est.description,
            project_type: est.selections.project, house_type: est.selections.houseType,
            estimate_low: est.low, estimate_high: est.high, estimate_total: est.total, planning: est.planning,
            update_count: existing[0].update_count + 1, updated_at: new Date().toISOString()
          })
        });
      }
      // otherwise it's a double tap or retry: return the first one
      return json(200, { ...reply, ref: existing[0].ref, saved: true });
    }
    if (b.update === true) return json(400, { error: "Please enter your details again." });

    // spam limit per connection
    const since = new Date(Date.now() - 3600e3).toISOString();
    const recent = await store.call(`projects?ip_hash=eq.${ipHash}&created_at=gte.${since}&select=id`);
    if (recent && recent.length >= MAX_PER_HOUR) return json(429, { error: "Too many estimates from this connection. Please call us on 07488 557750." });

    const cust = await store.call("customers?on_conflict=email", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(contact)
    });

    const proj = await store.call("projects", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        submission_id: b.submissionId,
        customer_id: cust[0].id,
        project_type: est.selections.project,
        description: est.description,
        house_type: est.selections.houseType,
        selections: est.selections,
        lines: est.lines,
        area_m2: est.area,
        estimate_low: est.low,
        estimate_high: est.high,
        estimate_total: est.total,
        planning: est.planning,
        page: clean(b.page, 100),
        ip_hash: ipHash
      })
    });
    return json(200, { ...reply, ref: proj[0].ref, saved: true });
  } catch (e) {
    // two taps arriving at the same moment: the database's unique rule rejects the second, so return the first
    if (/Supabase 409/.test(e.message)) {
      try {
        const again = await store.call(`projects?submission_id=eq.${b.submissionId}&select=ref`);
        if (again && again.length) return json(200, { ...reply, ref: again[0].ref, saved: true });
      } catch (e2) { /* fall through */ }
    }
    // never lose the customer's price because the database hiccuped; Netlify Forms backup still captures the lead
    console.error("Save failed:", e.message);
    return json(200, reply);
  }
};
