/* ==========================================================================
   Hélène of the West — shared behavior
   Header state, mobile navigation, scroll reveal, gallery trail.
   ========================================================================== */

(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------ header */

  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');

  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (toggle && nav && header) {
    const closeMenu = () => {
      header.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };
    toggle.addEventListener('click', () => {
      const open = header.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) nav.querySelector('a')?.focus();
    });
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        closeMenu();
        toggle.focus();
      }
    });
  }

  /* ------------------------------------------------------ scroll reveal */

  const revealables = document.querySelectorAll('.reveal');
  if (revealables.length && 'IntersectionObserver' in window && !reducedMotion.matches) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* ------------------------------------------------------ gallery trail
     Images surface along the pointer's path once it has travelled a
     deliberate distance, hold for about a second, then dissolve.
     Disabled on small screens and for reduced-motion users (CSS shows
     a static collage instead). */

  const trail = document.querySelector('[data-trail]');
  if (trail) {
    const sources = JSON.parse(trail.dataset.trail);
    const SPAWN_DISTANCE = 160;      /* px of pointer travel between images */
    const HOLD_MS = 1050;            /* how long each image stays fully visible */
    const MAX_LIVE = 7;              /* cap concurrent images */

    let last = null;
    let index = 0;
    const live = [];

    /* Pre-warm the images so first hover doesn't stutter. */
    sources.forEach((src) => { const i = new Image(); i.src = src; });

    const active = () =>
      !reducedMotion.matches && window.innerWidth >= 720;

    const spawn = (x, y) => {
      const img = document.createElement('img');
      img.src = sources[index % sources.length];
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.className = 'trail-img';
      img.style.left = `${x}px`;
      img.style.top = `${y}px`;
      img.style.zIndex = String(1 + (index % 5));
      index += 1;
      trail.appendChild(img);
      live.push(img);

      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('is-live')));

      setTimeout(() => {
        img.classList.remove('is-live');
        img.classList.add('is-out');
        setTimeout(() => {
          img.remove();
          const i = live.indexOf(img);
          if (i > -1) live.splice(i, 1);
        }, 950);
      }, HOLD_MS);

      while (live.length > MAX_LIVE) {
        const oldest = live.shift();
        oldest.classList.remove('is-live');
        oldest.classList.add('is-out');
        setTimeout(() => oldest.remove(), 950);
      }
    };

    const onMove = (e) => {
      if (!active()) return;
      const rect = trail.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (last === null) {
        last = { x, y };
        return;
      }
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist >= SPAWN_DISTANCE) {
        spawn(x, y);
        last = { x, y };
      }
    };

    trail.addEventListener('pointermove', onMove);
    trail.addEventListener('pointerleave', () => { last = null; });
    /* Touch: treat drags across the section the same as cursor movement. */
    trail.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) onMove({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
  }

  /* -------------------------------------------------------- footer year */

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
