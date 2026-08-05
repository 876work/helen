/* ==========================================================================
   Booking flow — four validated steps, a simulated confirmation call,
   and a generated reference number.

   ▸▸ INTEGRATION POINT ◂◂
   Everything UI-side is real. The one simulated piece is submitBooking()
   at the bottom of this file: replace its body with a POST to the live
   reservations API (payload shape documented there) and the rest of the
   flow — validation, loading state, confirmation screen — works unchanged.
   ========================================================================== */

(() => {
  'use strict';

  const form = document.getElementById('booking-form');
  if (!form) return;

  const steps = [...form.querySelectorAll('[data-step]')];
  const progress = [...document.querySelectorAll('[data-progress] li')];
  const stepByName = (name) => steps.find((s) => s.dataset.step === name);

  const state = {
    experienceId: null,
    current: 0,
  };

  /* ------------------------------------------------- step 1: options */

  const optionsWrap = form.querySelector('[data-experience-options]');
  optionsWrap.innerHTML = EXPERIENCES.map(
    (exp) => `
    <label class="option-card">
      <input type="radio" name="experience" value="${exp.id}">
      <span class="option-body">
        <img src="${exp.img}" alt="">
        <span>
          <span class="t">${exp.title}</span>
          <span class="m">${CATEGORIES[exp.category]} · ${exp.duration} · from ${formatPrice(exp)} ${priceUnitLabel(exp)}</span>
        </span>
      </span>
    </label>`
  ).join('');

  /* Pre-select when arriving from a detail page or the transfers page. */
  const preset = new URLSearchParams(location.search).get('experience');
  if (preset && getExperience(preset)) {
    const input = form.querySelector(`input[name="experience"][value="${preset}"]`);
    if (input) {
      input.checked = true;
      state.experienceId = preset;
    }
  }

  optionsWrap.addEventListener('change', () => {
    state.experienceId = form.querySelector('input[name="experience"]:checked')?.value ?? null;
    syncStepTwoOptions();
    refreshButtons();
  });

  /* --------------------------------------------- step 2: field setup */

  const dateEl = form.querySelector('#bk-date');
  const timeEl = form.querySelector('#bk-time');
  const guestsEl = form.querySelector('#bk-guests');
  const areaEl = form.querySelector('#bk-area');
  const pickupEl = form.querySelector('#bk-pickup');

  /* Bookings open from tomorrow, up to 18 months out. */
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 18);
  const iso = (d) => d.toISOString().slice(0, 10);
  dateEl.min = iso(tomorrow);
  dateEl.max = iso(horizon);

  areaEl.innerHTML =
    '<option value="">Where are you staying?</option>' +
    PICKUP_AREAS.map((a) => `<option value="${a}">${a}</option>`).join('');

  function syncStepTwoOptions() {
    const exp = getExperience(state.experienceId);
    if (!exp) return;

    timeEl.innerHTML =
      '<option value="">Select a time…</option>' +
      exp.times.map((t) => `<option value="${t}">${t}</option>`).join('');

    guestsEl.innerHTML =
      '<option value="">How many of you?</option>' +
      Array.from({ length: exp.maxGuests }, (_, i) => {
        const n = i + 1;
        return `<option value="${n}">${n} guest${n > 1 ? 's' : ''}</option>`;
      }).join('');

    form.querySelector('[data-selected-summary]').innerHTML =
      `Arranging: <strong>${exp.title}</strong> — ${exp.duration}, ${exp.group.toLowerCase()}.`;
  }
  syncStepTwoOptions();

  /* ---------------------------------------------------- validation */

  const validators = {
    'bk-date': (v) => Boolean(v) && v >= dateEl.min && v <= dateEl.max,
    'bk-time': (v) => Boolean(v),
    'bk-guests': (v) => Boolean(v),
    'bk-area': (v) => Boolean(v),
    'bk-pickup': (v) => v.trim().length >= 3,
    'bk-first': (v) => v.trim().length >= 2,
    'bk-last': (v) => v.trim().length >= 2,
    'bk-email': (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    'bk-phone': (v) => (v.replace(/\D/g, '').length >= 7),
  };

  const STEP_FIELDS = {
    1: ['bk-date', 'bk-time', 'bk-guests', 'bk-area', 'bk-pickup'],
    2: ['bk-first', 'bk-last', 'bk-email', 'bk-phone'],
  };

  function fieldValid(fid) {
    const el = document.getElementById(fid);
    return validators[fid](el.value);
  }

  function showFieldState(fid) {
    const el = document.getElementById(fid);
    const err = document.getElementById(`${fid}-error`);
    const ok = fieldValid(fid);
    el.setAttribute('aria-invalid', String(!ok));
    if (err) err.classList.toggle('is-visible', !ok);
    if (ok) el.removeAttribute('aria-invalid');
    return ok;
  }

  function stepValid(index) {
    if (index === 0) return Boolean(state.experienceId);
    if (index === 3) return true;
    return STEP_FIELDS[index].every(fieldValid);
  }

  /* Errors appear once a field has been visited, and continue buttons
     stay disabled until the whole step passes. */
  Object.keys(validators).forEach((fid) => {
    const el = document.getElementById(fid);
    el.addEventListener('blur', () => showFieldState(fid));
    el.addEventListener('input', () => {
      if (el.hasAttribute('aria-invalid')) showFieldState(fid);
      refreshButtons();
    });
    el.addEventListener('change', () => {
      if (el.hasAttribute('aria-invalid')) showFieldState(fid);
      refreshButtons();
    });
  });

  function refreshButtons() {
    steps.forEach((section) => {
      const idx = Number(section.dataset.step);
      const next = section.querySelector('[data-next]');
      if (next && !Number.isNaN(idx)) next.disabled = !stepValid(idx);
    });
  }

  /* ---------------------------------------------------- navigation */

  function goTo(index) {
    state.current = index;
    steps.forEach((section) => {
      const active = section.dataset.step === String(index);
      section.classList.toggle('is-active', active);
      section.hidden = !active;
    });
    progress.forEach((li, i) => {
      li.classList.toggle('is-active', i === index);
      li.classList.toggle('is-done', i < index);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) {
      goTo(state.current - 1);
      return;
    }
    const next = e.target.closest('[data-next]');
    if (next) {
      /* Belt and braces: surface any hidden errors even though the
         button only enables once the step is valid. */
      (STEP_FIELDS[state.current] || []).forEach(showFieldState);
      if (!stepValid(state.current)) return;
      if (state.current === 2) renderReview();
      goTo(state.current + 1);
    }
  });

  /* ------------------------------------------------------- review */

  function collect() {
    const exp = getExperience(state.experienceId);
    const guests = Number(guestsEl.value || 1);
    const total = exp.pricingUnit === 'vehicle' ? exp.price : exp.price * guests;
    return {
      experience: exp,
      date: dateEl.value,
      time: timeEl.value,
      guests,
      area: areaEl.value,
      pickup: pickupEl.value.trim(),
      firstName: form.querySelector('#bk-first').value.trim(),
      lastName: form.querySelector('#bk-last').value.trim(),
      email: form.querySelector('#bk-email').value.trim(),
      phone: form.querySelector('#bk-phone').value.trim(),
      notes: form.querySelector('#bk-notes').value.trim(),
      total,
    };
  }

  const prettyDate = (isoStr) =>
    new Date(`${isoStr}T12:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

  function renderReview() {
    const b = collect();
    form.querySelector('[data-review]').innerHTML = `
      <div class="review-block">
        <h4>Experience <button type="button" class="edit" data-edit="0">Edit</button></h4>
        <dl>
          <dt>Booked</dt><dd>${b.experience.title}</dd>
          <dt>Category</dt><dd>${CATEGORIES[b.experience.category]}</dd>
          <dt>Duration</dt><dd>${b.experience.duration}</dd>
        </dl>
      </div>
      <div class="review-block">
        <h4>Date &amp; party <button type="button" class="edit" data-edit="1">Edit</button></h4>
        <dl>
          <dt>Date</dt><dd>${prettyDate(b.date)}</dd>
          <dt>Time</dt><dd>${b.time}</dd>
          <dt>Guests</dt><dd>${b.guests}</dd>
          <dt>Pickup</dt><dd>${escapeHTML(b.pickup)}, ${b.area}</dd>
        </dl>
      </div>
      <div class="review-block">
        <h4>Contact <button type="button" class="edit" data-edit="2">Edit</button></h4>
        <dl>
          <dt>Name</dt><dd>${escapeHTML(b.firstName)} ${escapeHTML(b.lastName)}</dd>
          <dt>Email</dt><dd>${escapeHTML(b.email)}</dd>
          <dt>Phone</dt><dd>${escapeHTML(b.phone)}</dd>
          ${b.notes ? `<dt>Notes</dt><dd>${escapeHTML(b.notes)}</dd>` : ''}
        </dl>
      </div>
      <p class="total-line">
        <span>Total <small>${b.experience.pricingUnit === 'vehicle' ? 'per vehicle' : `${b.guests} × US$${b.experience.price}`}</small></span>
        <span>US$${b.total}</span>
      </p>`;

    form.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => goTo(Number(btn.dataset.edit)))
    );
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ------------------------------------------------ confirm & done */

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!stepValid(0) || !stepValid(1) || !stepValid(2)) return;

    const booking = collect();

    /* Loading state while the (simulated) reservation call runs. */
    steps.forEach((s) => { s.hidden = true; s.classList.remove('is-active'); });
    const loading = stepByName('loading');
    loading.hidden = false;
    loading.classList.add('is-active');
    progress.forEach((li) => li.classList.add('is-done'));

    const { reference } = await submitBooking(booking);

    loading.hidden = true;
    loading.classList.remove('is-active');
    const done = stepByName('done');
    done.hidden = false;
    done.classList.add('is-active');

    form.querySelector('[data-conf-ref]').textContent = reference;
    form.querySelector('[data-conf-title]').textContent = `See you on the island, ${booking.firstName}`;
    form.querySelector('[data-conf-summary]').innerHTML = `
      <dt>Experience</dt><dd>${booking.experience.title}</dd>
      <dt>Date</dt><dd>${prettyDate(booking.date)} at ${booking.time}</dd>
      <dt>Guests</dt><dd>${booking.guests}</dd>
      <dt>Pickup</dt><dd>${escapeHTML(booking.pickup)}, ${booking.area}</dd>
      <dt>Total</dt><dd>US$${booking.total} — payable on the day or by secure link</dd>`;
  });

  refreshButtons();

  /* ==================================================================
     ▸▸ INTEGRATION POINT ◂◂
     Replace this simulation with the live reservations API, e.g.:

       const res = await fetch('/api/bookings', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           experienceId: booking.experience.id,
           date: booking.date, time: booking.time,
           guests: booking.guests,
           pickup: { area: booking.area, detail: booking.pickup },
           contact: { firstName, lastName, email, phone, notes },
         }),
       });
       return res.json();   // → { reference: 'HW-XXXXXX' }

     Payment capture and live availability checks belong on the server
     side of that call. The UI already handles the pending state.
     ================================================================== */
  function submitBooking(booking) {
    void booking; /* payload is ready for the API — unused in simulation */
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let ref = 'HW-';
    for (let i = 0; i < 6; i++) ref += alphabet[Math.floor(Math.random() * alphabet.length)];
    return new Promise((resolve) => setTimeout(() => resolve({ reference: ref }), 1600));
  }
})();
