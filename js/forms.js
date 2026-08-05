/* ==========================================================================
   Shared form validation — Contact and Operator application forms.

   Fields opt in via data-validate="name|email|phone|required|message".
   Inline errors follow the pattern <p class="error" id="{field-id}-error">.
   The submit button stays disabled until the form is valid.

   Submissions go to Netlify Forms (https://docs.netlify.com/manage/forms/setup/):
   each form's static HTML carries name="…", method="POST",
   data-netlify="true" and a hidden form-name field, so Netlify registers
   it at deploy time; sendForm() then submits with AJAX so the on-page
   success states are kept. Note: AJAX posts only succeed on a deployed
   Netlify site (or `netlify dev`) — on a plain local server the forms
   show their failure state instead.
   ========================================================================== */

(() => {
  'use strict';

  const RULES = {
    name: (v) => v.trim().length >= 2,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    phone: (v) => v.replace(/\D/g, '').length >= 7,
    required: (v) => Boolean(v && v.trim()),
    message: (v) => v.trim().length >= 10,
  };

  document.querySelectorAll('[data-validated-form]').forEach((form) => {
    const fields = [...form.querySelectorAll('[data-validate]')];
    const submit = form.querySelector('button[type="submit"]');
    const success = form.parentElement.querySelector('[data-form-success]');

    const fieldValid = (el) => RULES[el.dataset.validate](el.value);

    const showState = (el) => {
      const ok = fieldValid(el);
      const err = document.getElementById(`${el.id}-error`);
      if (ok) {
        el.removeAttribute('aria-invalid');
      } else {
        el.setAttribute('aria-invalid', 'true');
      }
      if (err) err.classList.toggle('is-visible', !ok);
      return ok;
    };

    const refresh = () => {
      submit.disabled = !fields.every(fieldValid);
    };

    fields.forEach((el) => {
      el.addEventListener('blur', () => showState(el));
      el.addEventListener('input', () => {
        if (el.hasAttribute('aria-invalid')) showState(el);
        refresh();
      });
      el.addEventListener('change', () => {
        if (el.hasAttribute('aria-invalid')) showState(el);
        refresh();
      });
    });

    /* Inline failure note, created on first use, placed after the submit row. */
    const showFormError = (message) => {
      let note = form.querySelector('[data-form-error]');
      if (!note) {
        note = document.createElement('p');
        note.className = 'error';
        note.setAttribute('data-form-error', '');
        note.setAttribute('role', 'alert');
        form.appendChild(note);
      }
      note.textContent = message;
      note.classList.toggle('is-visible', Boolean(message));
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      fields.forEach(showState);
      if (!fields.every(fieldValid)) return;

      const original = submit.textContent;
      submit.disabled = true;
      submit.textContent = 'Sending…';
      showFormError('');

      try {
        await sendForm(form);
        submit.textContent = original;
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.setAttribute('tabindex', '-1');
          success.focus({ preventScroll: false });
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (err) {
        console.error(err);
        submit.textContent = original;
        submit.disabled = false;
        showFormError('We couldn’t send that just now. Please try again in a moment, or email us directly at helenshub.info@gmail.com.');
      }
    });

    refresh();
  });

  /* Netlify Forms AJAX submission: POST the URL-encoded fields (including
     the hidden form-name) to any path on the site — "/" by convention. */
  async function sendForm(form) {
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString(),
    });
    if (!res.ok) throw new Error(`Netlify form submission failed (${res.status})`);
  }
})();
