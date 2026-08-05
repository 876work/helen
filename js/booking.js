/* ==========================================================================
   Booking flow — four validated steps, submission to Netlify Forms,
   and a generated reference number.

   Submissions are recorded via Netlify Forms
   (https://docs.netlify.com/manage/forms/setup/): the static form in
   booking.html carries name="booking", method="POST", data-netlify="true"
   and hidden fields registering every JS-provided field name; AJAX posts
   only succeed on a deployed Netlify site (or `netlify dev`).

   ▸▸ INTEGRATION POINT ◂◂
   Payment capture and live availability checks are still simulated —
   when a real reservations API exists, replace submitBooking() at the
   bottom of this file; the rest of the flow (validation, loading state,
   confirmation screen) works unchanged.
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
  const flightEl = form.querySelector('#bk-flight');
  const flightField = form.querySelector('[data-flight-field]');
  const routeEl = form.querySelector('#bk-route');
  const routeField = form.querySelector('[data-route-field]');
  const areaField = form.querySelector('[data-area-field]');

  /* Airport transfers promise flight tracking, so the flight number is
     required for that product and hidden for everything else. */
  const needsFlight = () => state.experienceId === 'airport-transfer';

  /* Transfers are priced per route from the published fare guide rather
     than a single catalogue price, so the booking total always matches
     the fare shown on the Transfers page. The route replaces the pickup
     area, which would otherwise duplicate the route's origin. */
  const needsRoute = () => state.experienceId === 'airport-transfer';

  routeEl.innerHTML =
    '<option value="">Select your route…</option>' +
    TRANSFER_ROUTES.map((r, i) => `<option value="${i}">${r.from} → ${r.to} — US$${r.fare}</option>`).join('') +
    '<option value="other">Another route — we’ll quote you</option>';

  /* Bookings open from tomorrow, up to 18 months out. Format from local
     date parts — toISOString() would shift the boundary into the next UTC
     day and block next-day bookings for evening visitors west of UTC
     (Saint Lucia is UTC−4, so this bit every evening after 8 PM). */
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 18);
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

    /* Show or reset the product-specific fields. */
    flightField.hidden = !needsFlight();
    flightEl.toggleAttribute('required', needsFlight());
    if (!needsFlight()) {
      flightEl.value = '';
      flightEl.removeAttribute('aria-invalid');
      document.getElementById('bk-flight-error').classList.remove('is-visible');
    }

    routeField.hidden = !needsRoute();
    areaField.hidden = needsRoute();
    routeEl.toggleAttribute('required', needsRoute());
    areaEl.toggleAttribute('required', !needsRoute());
    const stale = needsRoute() ? [areaEl, 'bk-area-error'] : [routeEl, 'bk-route-error'];
    stale[0].value = '';
    stale[0].removeAttribute('aria-invalid');
    document.getElementById(stale[1]).classList.remove('is-visible');

    form.querySelector('[data-selected-summary]').innerHTML =
      `Arranging: <strong>${exp.title}</strong> — ${exp.duration}, ${exp.group.toLowerCase()}.`;
  }
  syncStepTwoOptions();

  /* ---------------------------------------------------- validation */

  const validators = {
    'bk-date': (v) => Boolean(v) && v >= dateEl.min && v <= dateEl.max,
    'bk-time': (v) => Boolean(v),
    'bk-guests': (v) => Boolean(v),
    'bk-area': (v) => needsRoute() || Boolean(v),
    'bk-route': (v) => !needsRoute() || Boolean(v),
    'bk-pickup': (v) => v.trim().length >= 3,
    'bk-flight': (v) => !needsFlight() || v.trim().length >= 3,
    'bk-first': (v) => v.trim().length >= 2,
    'bk-last': (v) => v.trim().length >= 2,
    'bk-email': (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    'bk-phone': (v) => (v.replace(/\D/g, '').length >= 7),
  };

  const STEP_FIELDS = {
    1: ['bk-date', 'bk-time', 'bk-guests', 'bk-area', 'bk-route', 'bk-pickup', 'bk-flight'],
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

    /* Route-priced transfers take their fare from the published guide.
       An unlisted route has no fixed fare, so the total is quoted by the
       team rather than guessed here — `total: null` signals that. */
    const route = needsRoute() && routeEl.value !== '' && routeEl.value !== 'other'
      ? TRANSFER_ROUTES[Number(routeEl.value)]
      : null;
    const routeLabel = !needsRoute()
      ? ''
      : route ? `${route.from} → ${route.to}` : 'Another route — to be quoted';

    let total;
    if (needsRoute()) total = route ? route.fare : null;
    else total = exp.pricingUnit === 'vehicle' ? exp.price : exp.price * guests;

    return {
      experience: exp,
      date: dateEl.value,
      time: timeEl.value,
      guests,
      area: needsRoute() ? '' : areaEl.value,
      routeLabel,
      pickup: pickupEl.value.trim(),
      flight: needsFlight() ? flightEl.value.trim() : '',
      firstName: form.querySelector('#bk-first').value.trim(),
      lastName: form.querySelector('#bk-last').value.trim(),
      email: form.querySelector('#bk-email').value.trim(),
      phone: form.querySelector('#bk-phone').value.trim(),
      notes: form.querySelector('#bk-notes').value.trim(),
      total,
    };
  }

  /* A null total means the route is unlisted and will be quoted. */
  const totalAmount = (b) => (b.total === null ? 'On quote' : `US$${b.total}`);
  const totalBasis = (b) => {
    if (b.total === null) return 'fare confirmed before travel';
    if (b.routeLabel) return 'per vehicle, published fare';
    return b.experience.pricingUnit === 'vehicle' ? 'per vehicle' : `${b.guests} × US$${b.experience.price}`;
  };

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
          ${b.routeLabel ? `<dt>Route</dt><dd>${escapeHTML(b.routeLabel)}</dd>` : ''}
          <dt>Pickup</dt><dd>${escapeHTML(b.pickup)}${b.area ? `, ${b.area}` : ''}</dd>
          ${b.flight ? `<dt>Flight</dt><dd>${escapeHTML(b.flight)}</dd>` : ''}
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
        <span>Total <small>${totalBasis(b)}</small></span>
        <span>${totalAmount(b)}</span>
      </p>`;

    form.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => goTo(Number(btn.dataset.edit)))
    );
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ------------------------------------------------ confirm & done */

  const confirmError = form.querySelector('[data-confirm-error]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!stepValid(0) || !stepValid(1) || !stepValid(2)) return;

    const booking = collect();
    confirmError.classList.remove('is-visible');

    /* Loading state while the reservation is recorded. */
    steps.forEach((s) => { s.hidden = true; s.classList.remove('is-active'); });
    const loading = stepByName('loading');
    loading.hidden = false;
    loading.classList.add('is-active');
    progress.forEach((li) => li.classList.add('is-done'));

    let reference;
    try {
      ({ reference } = await submitBooking(booking));
    } catch (err) {
      console.error(err);
      loading.hidden = true;
      loading.classList.remove('is-active');
      goTo(3);
      confirmError.textContent = 'We couldn’t send your booking just now. Please try again in a moment, or call us on 758-717-4814 and we’ll hold it by phone.';
      confirmError.classList.add('is-visible');
      return;
    }

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
      ${booking.routeLabel ? `<dt>Route</dt><dd>${escapeHTML(booking.routeLabel)}</dd>` : ''}
      <dt>Pickup</dt><dd>${escapeHTML(booking.pickup)}${booking.area ? `, ${booking.area}` : ''}</dd>
      ${booking.flight ? `<dt>Flight</dt><dd>${escapeHTML(booking.flight)}</dd>` : ''}
      <dt>Total</dt><dd>${booking.total === null
        ? 'Quoted before travel — we’ll confirm your fare by email'
        : `US$${booking.total} — payable on the day or by secure link`}</dd>`;
  });

  refreshButtons();

  /* ==================================================================
     Record the booking as a Netlify Forms submission
     (https://docs.netlify.com/manage/forms/setup/). The reference is
     generated client-side and included in the submission so it appears
     in Netlify's form notifications alongside the guest's details.

     ▸▸ INTEGRATION POINT ◂◂
     Payment capture and live availability checks are not part of
     Netlify Forms — when a real reservations API exists, point this
     POST at it instead and return its reference. The UI already
     handles the pending and failure states.
     ================================================================== */
  async function submitBooking(booking) {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let reference = 'HW-';
    for (let i = 0; i < 6; i++) reference += alphabet[Math.floor(Math.random() * alphabet.length)];

    /* Field names must match the inputs registered in booking.html's
       static form so Netlify accepts and stores each of them. */
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'form-name': 'booking',
        reference,
        experience: `${booking.experience.title} (${booking.experience.id})`,
        date: booking.date,
        time: booking.time,
        guests: String(booking.guests),
        area: booking.area,
        route: booking.routeLabel,
        pickup: booking.pickup,
        flight: booking.flight,
        firstName: booking.firstName,
        lastName: booking.lastName,
        email: booking.email,
        phone: booking.phone,
        notes: booking.notes,
        total: booking.total === null ? 'To be quoted' : `US$${booking.total}`,
      }).toString(),
    });
    if (!res.ok) throw new Error(`Netlify form submission failed (${res.status})`);
    return { reference };
  }
})();
