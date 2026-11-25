# Cherry Design & Build website: setup notes

## What changed in Stages 1 and 2 (25 Nov 2026)

- Prices and pricing formulas moved off the public site into `netlify/functions/_lib/`.
  The formulas are unchanged. They were checked against the original on 5,000 random designs with 0 differences.
- The `#owner` pricing panel was removed from the public pages.
- No price is on the page until the customer submits their details. The server then works it out and sends it back.
- Every lead gets a reference (CDB-2026-0001 …) and is saved in Supabase.
- Double taps, spam (honeypot field, 5 leads per connection per hour) and tampered prices are blocked.
- Netlify Forms still receives a backup copy of every lead.

## To change prices

Edit `netlify/functions/_lib/prices.js` and push to GitHub. Netlify redeploys in about a minute.
(A password-protected price page can follow once the site is on GitHub.)

## One-off setup

1. **Supabase**: create a free project, open SQL Editor, paste `supabase/schema.sql`, then Run.
2. **Netlify**: Site configuration → Environment variables. Add:
   - `SUPABASE_URL`: Supabase → Project Settings → API → Project URL
   - `SUPABASE_SERVICE_KEY`: same page, the `service_role` secret key (never put this in a page or a message)
   - `IP_SALT`: any long random text
3. **Netlify**: link the site to the GitHub repo (Site configuration → Build & deploy → Link repository).
   Build command: none. Publish directory: `/` (the repo root).

Without the Supabase variables the calculator still prices correctly, but leads are only in the Netlify Forms inbox.

## Google reviews widget

Shows the live Google rating and reviews on the homepage, Extensions, Loft conversions and About pages.
Listing: Cherry CPS LTD (place ID `ChIJR-ZECVuTcUgRvHKUyzeBUI0`). Renaming the Google profile keeps the
same ID, so nothing needs changing after the rebrand.

To switch it on: Google Cloud Console → create a project → enable **Places API (New)** → create an API key
restricted to that API → add it in Netlify as `GOOGLE_PLACES_API_KEY`.
Google needs a billing account on the project. The site asks Google about once a day (cached), so usage
should stay inside Google's free monthly allowance, but check the current allowance before switching it on.
Until the key is added, the section shows a "Read our reviews on Google" button instead.
Google returns up to 5 reviews, the ones it picks for the listing.
