/* ==========================================================================
   Experiences page — renders the catalogue grid and drives the
   category / price filters.
   ========================================================================== */

(() => {
  'use strict';

  const grid = document.querySelector('[data-experience-grid]');
  if (!grid) return;

  const countEl = document.querySelector('[data-count]');
  const state = { cat: 'all', price: 'all' };

  const PRICE_BANDS = {
    all: () => true,
    under60: (p) => p < 60,
    '60to90': (p) => p >= 60 && p <= 90,
    over90: (p) => p > 90,
  };

  const cardHTML = (exp) => `
    <a class="card" href="experience.html?id=${exp.id}" data-card>
      <div class="card-media"><img src="${exp.img}" alt="${exp.alt}" loading="lazy"></div>
      <div class="card-body">
        <p class="card-meta"><span class="cat">${CATEGORIES[exp.category]}</span><span>${exp.duration}</span><span>${exp.group}</span></p>
        <h3>${exp.title}</h3>
        <p class="card-desc">${exp.blurb}</p>
        <p class="card-foot"><span class="price">From ${formatPrice(exp)} <small>${priceUnitLabel(exp)}</small></span></p>
      </div>
    </a>`;

  function render() {
    const matches = EXPERIENCES.filter(
      (exp) => (state.cat === 'all' || exp.category === state.cat) && PRICE_BANDS[state.price](exp.price)
    );

    grid.innerHTML = matches.length
      ? matches.map(cardHTML).join('')
      : '<p class="empty-note">Nothing in the catalogue matches that combination just yet — try widening a filter, or <a class="text-link" href="contact.html">ask us directly</a>.</p>';

    if (countEl) {
      countEl.textContent = `${matches.length} experience${matches.length === 1 ? '' : 's'}`;
    }
  }

  function bindGroup(attr, key) {
    const chips = document.querySelectorAll(`[${attr}]`);
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        state[key] = chip.getAttribute(attr);
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        render();
      });
    });
  }

  bindGroup('data-filter-cat', 'cat');
  bindGroup('data-filter-price', 'price');

  /* Allow deep links like experiences.html?category=beaches */
  const preset = new URLSearchParams(location.search).get('category');
  if (preset && CATEGORIES[preset]) {
    state.cat = preset;
    document.querySelectorAll('[data-filter-cat]').forEach((c) =>
      c.setAttribute('aria-pressed', String(c.getAttribute('data-filter-cat') === preset))
    );
  }

  render();
})();
