/* Google reviews widget. Fills any <div data-google-reviews></div> on the page.
   Data comes from /.netlify/functions/google-reviews (live from Google, cached daily).
   If Google can't be reached, it shows a "Read our reviews on Google" button instead. */
(() => {
  const boxes = document.querySelectorAll("[data-google-reviews]");
  if (!boxes.length) return;
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = u => /^https:\/\//.test(u || "") ? u : null;
  const stars = n => `<span class="rv-stars" aria-label="${n} out of 5 stars">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`;
  const G = `<svg class="rv-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

  function fallback(box, links) {
    box.innerHTML = `<div class="rv-head"><div>${G}<b>Our Google reviews</b></div>
      <a class="btn ghost" href="${esc(links.profile)}" target="_blank" rel="noopener">Read our reviews on Google</a></div>`;
  }

  function draw(box, d) {
    const cards = d.reviews.filter(r => r.text).map(r => {
      const long = r.text.length > 260;
      const who = r.authorUrl && safeUrl(r.authorUrl) ? `<a href="${esc(r.authorUrl)}" target="_blank" rel="noopener nofollow">${esc(r.author)}</a>` : esc(r.author);
      const photo = safeUrl(r.photo) ? `<img src="${esc(r.photo)}" alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer">` : `<span class="rv-init">${esc(r.author.charAt(0))}</span>`;
      return `<figure class="rv-card">
        <div class="rv-who">${photo}<div><b>${who}</b><small>${esc(r.when)}</small></div></div>
        ${stars(r.rating)}
        <blockquote>${esc(long ? r.text.slice(0, 260).replace(/\s+\S*$/, "") + "…" : r.text)}</blockquote>
        ${long ? `<a class="rv-more" href="${esc(safeUrl(r.url) || d.links.profile)}" target="_blank" rel="noopener">Read the full review on Google</a>` : ""}
      </figure>`;
    }).join("");
    box.innerHTML = `<div class="rv-head">
        <div>${G}<b>${d.rating ? d.rating.toFixed(1) : ""}</b> ${d.rating ? stars(d.rating) : ""} <span class="rv-count">from ${d.count} Google reviews</span></div>
        <div class="rv-acts"><a class="btn ghost" href="${esc(d.links.profile)}" target="_blank" rel="noopener">See all reviews</a>
        <a class="btn" href="${esc(d.links.write)}" target="_blank" rel="noopener">Leave a review</a></div>
      </div>
      <div class="rv-grid">${cards}</div>
      <p class="rv-src">Reviews shown as written on Google. Showing the reviews Google selects for this listing.</p>`;
  }

  fetch("/.netlify/functions/google-reviews")
    .then(r => r.json())
    .then(d => boxes.forEach(box => (d.configured && !d.error && d.reviews && d.reviews.length) ? draw(box, d) : fallback(box, d.links || {})))
    .catch(() => boxes.forEach(box => fallback(box, { profile: "https://www.google.com/maps/place/?q=place_id:ChIJR-ZECVuTcUgRvHKUyzeBUI0" })));
})();
