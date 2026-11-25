/* GET /.netlify/functions/google-reviews
   Live Google rating and reviews for the business listing, straight from Google's Places API.
   Cached by Netlify for a day, so Google is asked about once a day, not on every page view.

   Environment variables (Netlify -> Site configuration -> Environment variables):
     GOOGLE_PLACES_API_KEY  Google Cloud API key with "Places API (New)" enabled. Server only.
     GOOGLE_PLACE_ID        optional. Defaults to the Cherry CPS LTD listing below.
                            When the Google profile is renamed it keeps the same ID, so nothing changes.
                            Only a brand-new listing would need this changing. */
"use strict";
const DEFAULT_PLACE_ID = "ChIJR-ZECVuTcUgRvHKUyzeBUI0"; // Cherry CPS LTD, Brentry, Bristol

const reply = (status, body, cacheSeconds) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": cacheSeconds ? "public, max-age=3600" : "no-store",
    ...(cacheSeconds ? { "Netlify-CDN-Cache-Control": `public, durable, s-maxage=${cacheSeconds}, stale-while-revalidate=604800` } : {})
  },
  body: JSON.stringify(body)
});

exports.handler = async () => {
  const placeId = process.env.GOOGLE_PLACE_ID || DEFAULT_PLACE_ID;
  const links = {
    profile: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    write: `https://search.google.com/local/writereview?placeid=${placeId}`
  };
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return reply(200, { configured: false, links }, 0);

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en-GB&regionCode=GB`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "displayName,rating,userRatingCount,googleMapsUri,reviews" }
    });
    if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const p = await res.json();
    if (p.googleMapsUri) links.profile = p.googleMapsUri;
    const reviews = (p.reviews || []).map(r => ({
      author: (r.authorAttribution && r.authorAttribution.displayName) || "Google user",
      authorUrl: (r.authorAttribution && r.authorAttribution.uri) || null,
      photo: (r.authorAttribution && r.authorAttribution.photoUri) || null,
      rating: r.rating || 0,
      when: r.relativePublishTimeDescription || "",
      text: (r.text && r.text.text) || (r.originalText && r.originalText.text) || "",
      url: r.googleMapsUri || links.profile
    }));
    return reply(200, {
      configured: true,
      name: p.displayName && p.displayName.text,
      rating: p.rating || null,
      count: p.userRatingCount || 0,
      reviews, links
    }, 86400);
  } catch (e) {
    console.error("Google reviews failed:", e.message);
    return reply(200, { configured: true, error: true, links }, 0);
  }
};
