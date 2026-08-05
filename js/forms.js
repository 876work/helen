/* ==========================================================================
   Shared form validation — Contact and Operator application forms.

   Fields opt in via data-validate="name|email|phone|required|message".
   Inline errors follow the pattern <p class="error" id="{field-id}-error">.
   The submit button stays disabled until the form is valid.

   ▸▸ INTEGRATION POINT ◂◂
   sendForm() below simulates the network call. Point it at the live
   endpoint (or a form service) and the UI — disabled states, loading
   label, success panel — works unchanged.
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      fields.forEach(showState);
      if (!fields.every(fieldValid)) return;

      const original = submit.textContent;
      submit.disabled = true;
      submit.textContent = 'Sending…';

      await sendForm(form.id, Object.fromEntries(new FormData(form)));

      submit.textContent = original;
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.setAttribute('tabindex', '-1');
        success.focus({ preventScroll: false });
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    refresh();
  });

  /* ▸▸ INTEGRATION POINT ◂◂ — replace with a POST to the live endpoint:
       await fetch('/api/forms/' + formId, { method: 'POST', body: JSON.stringify(payload) })
     The 900 ms delay mirrors a realistic round trip so the pending
     state is honest. */
  function sendForm(formId, payload) {
    void formId; void payload;
    return new Promise((resolve) => setTimeout(resolve, 900));
  }
})();
