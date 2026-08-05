# Hélène of the West

**Saint Lucia, curated.** — the website for a Saint Lucia travel and experience
booking company: curated experiences, private airport transfers and island taxi
service, and an operator onboarding channel.

A static, dependency-free multi-page site: semantic HTML, one shared design
system stylesheet, and a small amount of vanilla JavaScript. No build step —
serve the folder and it runs.

```bash
# local preview
python3 -m http.server 8000
# → http://localhost:8000
```

## Pages

| Page | File | Notes |
| --- | --- | --- |
| Home | `index.html` | Hero, editorial intro, featured experiences, cursor-trail gallery, reviews, operator band |
| Experiences | `experiences.html` | Full catalogue with working category + price filters |
| Experience detail | `experience.html?id=<slug>` | One reusable template hydrated from the catalogue data |
| Transfers & Taxi | `transfers.html` | Service explanation, fixed-fare guide, booking entry point |
| Booking | `booking.html` | Four-step validated flow → loading → confirmation with reference |
| About | `about.html` | The "Helen of the West Indies" story, photo-led layout |
| For Operators | `operators.html` | Benefits, joining steps, validated application form |
| Contact | `contact.html` | Validated contact form, details, service area, response time |

## Architecture

- **`css/styles.css`** — the whole design system: color tokens (four brand
  colors: ink, ivory, sand, sea green), spacing scale, type scale
  (Cormorant Garamond 400/500/600 + Manrope 400/500/600, self-hosted in
  `assets/fonts/`), and every component. Motion respects
  `prefers-reduced-motion` globally.
- **`js/data.js`** — the experience catalogue, transfer fare table and pickup
  areas. Single source of truth for the grid, detail template and booking
  flow. When a live inventory API exists, this module is the swap point; the
  object shape is the contract.
- **`js/main.js`** — header state, mobile menu, scroll reveal, cursor-trail
  gallery (distance-gated spawning, touch support, disabled on small screens
  and for reduced motion).
- **`js/booking.js`** — the booking flow. Payment and availability are
  simulated; search for `INTEGRATION POINT` for the exact function to replace
  with the live reservations API. Validation, loading state and the
  confirmation screen work unchanged once it's connected.
- **`js/forms.js`** — shared validation for the contact and operator forms,
  with its own `INTEGRATION POINT` for a live endpoint.

## Imagery

All scenes in `assets/img/` are generated, art-directed SVG illustrations
produced by `tools/generate-art.mjs` (run `node tools/generate-art.mjs` to
regenerate). They share one visual language — layered skies, sea, the Pitons,
palms, mist and grain — so the site ships fully self-contained with no external
image dependencies. When licensed photography is available, drop equally-named
files into `assets/img/` and update the paths in `js/data.js`.

## Placeholders to replace at launch

- Social icons in the footer currently point at the platform homepages —
  swap in the company's real profile URLs.
- The two `INTEGRATION POINT` blocks (bookings, forms) need a live backend.
