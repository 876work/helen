/* ==========================================================================
   Experience detail template — hydrates experience.html from js/data.js
   based on the ?id= query parameter, and carries the selection into
   the booking flow.
   ========================================================================== */

(() => {
  'use strict';

  const article = document.querySelector('[data-detail]');
  if (!article) return;

  const id = new URLSearchParams(location.search).get('id');
  const exp = getExperience(id);

  if (!exp) {
    document.querySelector('[data-notfound]').hidden = false;
    document.title = 'Experience not found — Hélène of the West';
    return;
  }

  document.title = `${exp.title} — Hélène of the West`;
  article.hidden = false;

  const set = (sel, value) => { document.querySelector(sel).textContent = value; };

  set('[data-category]', CATEGORIES[exp.category]);
  set('[data-title]', exp.title);
  set('[data-duration]', exp.duration);
  set('[data-group]', exp.group);
  set('[data-times]', exp.times.join(' · '));
  set('[data-meeting]', exp.meetingPoint);
  set('[data-price]', `From ${formatPrice(exp)}`);
  set('[data-price-unit]', priceUnitLabel(exp));

  /* Gallery: one lead image plus two supporting frames. */
  const galleryAlts = [
    exp.alt,
    `Another view of ${exp.title.toLowerCase()} scenery in Saint Lucia`,
    `Landscape associated with ${exp.title.toLowerCase()} in Saint Lucia`,
  ];
  document.querySelector('[data-gallery]').innerHTML = exp.gallery
    .slice(0, 3)
    .map((src, i) => `<img class="${i === 0 ? 'main' : 'side'}" src="${src}" alt="${galleryAlts[i]}">`)
    .join('');

  document.querySelector('[data-description]').innerHTML = exp.description
    .map((p) => `<p class="${p === exp.description[0] ? 'lede' : ''}">${p}</p>`)
    .join('');

  const li = (items) => items.map((t) => `<li>${t}</li>`).join('');
  document.querySelector('[data-included]').innerHTML = li(exp.included);
  document.querySelector('[data-bring]').innerHTML = li(exp.bring);

  /* Sticky panel: carry this experience into the booking flow. */
  document.querySelector('[data-book-link]').href = `booking.html?experience=${exp.id}`;

  /* Related: same category first, then neighbours from the catalogue. */
  const related = EXPERIENCES.filter((e) => e.id !== exp.id)
    .sort((a, b) => (b.category === exp.category) - (a.category === exp.category))
    .slice(0, 3);

  document.querySelector('[data-related-section]').hidden = false;
  document.querySelector('[data-related]').innerHTML = related
    .map(
      (r) => `
    <a class="card" href="experience.html?id=${r.id}">
      <div class="card-media"><img src="${r.img}" alt="${r.alt}" loading="lazy"></div>
      <div class="card-body">
        <p class="card-meta"><span class="cat">${CATEGORIES[r.category]}</span><span>${r.duration}</span></p>
        <h3>${r.title}</h3>
        <p class="card-foot"><span class="price">From ${formatPrice(r)} <small>${priceUnitLabel(r)}</small></span></p>
      </div>
    </a>`
    )
    .join('');
})();
