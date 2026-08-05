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
- **`js/booking.js`** — the booking flow. Submissions are recorded via
  Netlify Forms (form name `booking`, reference number included). Payment
  and availability are still simulated; search for `INTEGRATION POINT` for
  the function to point at a live reservations API later.

  Pricing has two modes. Most experiences use the catalogue `price`
  (× guests, or flat for `pricingUnit: 'vehicle'`). Airport transfers are
  priced per route from `TRANSFER_ROUTES`, so the booking total always
  matches the fare published on the Transfers page; the route select
  replaces the pickup-area field for that product, and an unlisted route
  submits with the total pending a quote rather than guessing a fare.
  `airport-transfer.price` is display-only and should stay equal to the
  lowest published fare so its "from" price stays truthful.
- **`js/forms.js`** — shared validation for the contact and operator forms;
  submissions go to Netlify Forms (form names `contact` and
  `operator-application`).

## Netlify Forms

All three forms follow [the Netlify Forms setup](https://docs.netlify.com/manage/forms/setup/):
static `<form>` tags carry `name`, `method="POST"`, `data-netlify="true"`
and a hidden `form-name` input, and submissions are sent with AJAX so the
in-page success states are kept. Fields the booking flow fills via
JavaScript are registered with empty hidden inputs in `booking.html`.

- Enable **form detection** for the site in Netlify (Project configuration
  → Forms) before deploying, or submissions will 404.
- AJAX posts only succeed on the deployed site or under `netlify dev` — on
  a plain local server the forms show their failure state instead.

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
