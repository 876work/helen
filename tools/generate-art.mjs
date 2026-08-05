#!/usr/bin/env node
/**
 * Hélène of the West — scene artwork generator.
 *
 * Generates the site's image set as layered SVG scenes with a shared,
 * art-directed visual language (sky, sea, landforms, palms, mist, grain).
 * Run:  node tools/generate-art.mjs
 * Output: assets/img/*.svg
 *
 * When real photography is licensed, drop equally-named .jpg files into
 * assets/img and update the extension in js/data.js — nothing else changes.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'img');
mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- helpers */

let uid = 0;
const id = (p) => `${p}${++uid}`;

function grad(stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  const g = id('g');
  const s = stops
    .map(([off, col, op]) => `<stop offset="${off}" stop-color="${col}"${op != null ? ` stop-opacity="${op}"` : ''}/>`)
    .join('');
  return {
    id: g,
    def: `<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`,
  };
}

function radial(stops) {
  const g = id('r');
  const s = stops
    .map(([off, col, op]) => `<stop offset="${off}" stop-color="${col}"${op != null ? ` stop-opacity="${op}"` : ''}/>`)
    .join('');
  return { id: g, def: `<radialGradient id="${g}">${s}</radialGradient>` };
}

/* Deterministic pseudo-random, so output is stable run to run. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* A gently undulating ridge line across the full width. */
function ridgePath(W, y, amp, seed, closeY) {
  const r = rng(seed);
  const n = 7;
  let d = `M0 ${closeY} L0 ${y}`;
  let px = 0;
  for (let i = 1; i <= n; i++) {
    const x = (W / n) * i;
    const yy = y + (r() - 0.5) * 2 * amp;
    const cx = (px + x) / 2;
    d += ` Q${cx} ${y + (r() - 0.5) * 2.6 * amp} ${x} ${yy}`;
    px = x;
  }
  d += ` L${W} ${closeY} Z`;
  return d;
}

/* The twin Pitons — steep volcanic cones with concave flanks that flare
   at the base and a softly rounded summit. */
function pitonShape(cx, baseY, h, w, color, op) {
  if (h <= 0) return '';
  const top = baseY - h;
  return `<path d="M${cx - w} ${baseY}
    C ${cx - w * 0.4} ${baseY - h * 0.13} ${cx - w * 0.24} ${baseY - h * 0.58} ${cx - w * 0.08} ${top + h * 0.05}
    Q ${cx - w * 0.005} ${top} ${cx + w * 0.07} ${top + h * 0.06}
    C ${cx + w * 0.2} ${baseY - h * 0.52} ${cx + w * 0.42} ${baseY - h * 0.11} ${cx + w * 0.78} ${baseY} Z" fill="${color}" opacity="${op}"/>`;
}

function pitons({ cx, baseY, h1, h2, gap, w1, w2, color, op = 1 }) {
  return pitonShape(cx, baseY, h1, w1, color, op) + pitonShape(cx + gap, baseY, h2, w2, color, op);
}

/* Palm silhouette: curved trunk plus a crown of drooping fronds. */
function palm({ x, y, s, flip = 1, color, op = 1 }) {
  const tx = 46 * s * flip;
  const ty = 150 * s;
  const topX = x + tx;
  const topY = y - ty;
  const trunk = `M${x} ${y} q ${tx * 0.24} ${-ty * 0.62} ${tx} ${-ty} l ${6 * s * flip} ${3 * s} q ${-tx * 0.7} ${ty * 0.44} ${-tx * 0.8} ${ty * 0.97} Z`;
  const angles = [-165, -140, -112, -84, -55, -28, -6, 16];
  let fronds = '';
  for (const a of angles) {
    const rad = (a * Math.PI) / 180;
    const len = 92 * s * (0.82 + 0.28 * Math.abs(Math.sin(rad)));
    const ex = topX + Math.cos(rad) * len * flip;
    const ey = topY + Math.sin(rad) * len * 0.62 + len * 0.34;
    const c1x = topX + Math.cos(rad) * len * 0.45 * flip;
    const c1y = topY + Math.sin(rad) * len * 0.62 - 14 * s;
    fronds += `<path d="M${topX} ${topY} Q${c1x} ${c1y} ${ex} ${ey} Q${c1x + 4 * s * flip} ${c1y + 14 * s} ${topX} ${topY + 5 * s} Z" fill="${color}"/>`;
  }
  return `<g opacity="${op}">${`<path d="${trunk}" fill="${color}"/>`}${fronds}</g>`;
}

/* Small sailing boat silhouette. */
function boat({ x, y, s, color, op = 1 }) {
  return `<g opacity="${op}" fill="${color}">
    <path d="M${x - 34 * s} ${y} q ${34 * s} ${16 * s} ${68 * s} 0 l ${-8 * s} ${10 * s} q ${-26 * s} ${10 * s} ${-52 * s} 0 Z"/>
    <path d="M${x + 2 * s} ${y - 4 * s} l 0 ${-56 * s} q ${26 * s} ${34 * s} ${30 * s} ${52 * s} Z"/>
    <path d="M${x - 4 * s} ${y - 4 * s} l 0 ${-46 * s} q ${-20 * s} ${26 * s} ${-24 * s} ${44 * s} Z"/>
  </g>`;
}

function birds({ x, y, s, color, op = 0.8 }) {
  const one = (bx, by, bs) =>
    `<path d="M${bx - 10 * bs} ${by} q ${10 * bs} ${-8 * bs} ${10 * bs} 0 q 0 ${-8 * bs} ${10 * bs} 0" fill="none" stroke="${color}" stroke-width="${2.4 * bs}" stroke-linecap="round"/>`;
  return `<g opacity="${op}">${one(x, y, s)}${one(x + 44 * s, y - 18 * s, s * 0.8)}${one(x - 40 * s, y - 30 * s, s * 0.65)}</g>`;
}

/* Sun or moon with layered glow. */
function sun({ x, y, r, color, defs }) {
  const glow = radial([[0, color, 0.55], [0.55, color, 0.16], [1, color, 0]]);
  defs.push(glow.def);
  return `<circle cx="${x}" cy="${y}" r="${r * 3.1}" fill="url(#${glow.id})"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.92"/>`;
}

/* Horizontal shimmer on the water beneath the sun. */
function shimmer({ x, y, w, color }) {
  let out = '';
  const r = rng(41);
  for (let i = 0; i < 9; i++) {
    const yy = y + i * 9 + r() * 5;
    const ww = w * (1 - i * 0.07) * (0.55 + r() * 0.5);
    out += `<rect x="${x - ww / 2}" y="${yy}" width="${ww}" height="${2.4 - i * 0.12}" rx="1.2" fill="${color}" opacity="${0.5 - i * 0.045}"/>`;
  }
  return out;
}

function mist({ W, y, color, op }) {
  return `<ellipse cx="${W / 2}" cy="${y}" rx="${W * 0.75}" ry="26" fill="${color}" opacity="${op}" filter="url(#soft)"/>`;
}

/* Rolling interior hills (cane fields, valleys). */
function hills({ W, y, amp, color, seed, closeY }) {
  return `<path d="${ridgePath(W, y, amp, seed, closeY)}" fill="${color}"/>`;
}

/* Lantern / village light dots along a shoreline. */
function lights({ x, y, n, spread, color }) {
  const r = rng(7);
  let out = '';
  for (let i = 0; i < n; i++) {
    const lx = x + (i / (n - 1) - 0.5) * spread + (r() - 0.5) * 24;
    const ly = y + (r() - 0.5) * 10;
    out += `<circle cx="${lx}" cy="${ly}" r="${2.2 + r() * 2}" fill="${color}" opacity="${0.65 + r() * 0.3}"/>`;
  }
  return out;
}

/* ------------------------------------------------------------- assembler */

function scene(cfg) {
  const W = cfg.w ?? 1600;
  const H = cfg.h ?? 1000;
  const defs = [];
  const sky = grad(cfg.sky);
  defs.push(sky.def);
  const horizon = H * (cfg.horizon ?? 0.62);

  let body = `<rect width="${W}" height="${H}" fill="url(#${sky.id})"/>`;

  if (cfg.sun) body += sun({ ...cfg.sun, x: cfg.sun.x * W, y: cfg.sun.y * H, defs });

  /* sea */
  if (cfg.sea) {
    const seaG = grad(cfg.sea.stops);
    defs.push(seaG.def);
    body += `<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#${seaG.id})"/>`;
    if (cfg.sun && cfg.sea.shimmer !== false)
      body += shimmer({ x: cfg.sun.x * W, y: horizon + 12, w: W * 0.3, color: cfg.sea.shimmerColor ?? '#F6E7C8' });
  }

  /* distant → near ridge layers, each hazier the further back */
  (cfg.ridges ?? []).forEach((rd, i) => {
    body += `<path d="${ridgePath(W, H * rd.y, rd.amp ?? 46, rd.seed ?? 11 + i * 7, cfg.sea ? horizon + 4 : H)}" fill="${rd.color}" opacity="${rd.op ?? 1}"/>`;
    if (rd.mist) body += mist({ W, y: H * rd.y + 20, color: rd.mist, op: rd.mistOp ?? 0.35 });
  });

  if (cfg.hills) cfg.hills.forEach((hl) => (body += hills({ W, y: H * hl.y, amp: hl.amp ?? 60, color: hl.color, seed: hl.seed ?? 5, closeY: H })));

  if (cfg.pitons) body += pitons({ ...cfg.pitons, cx: cfg.pitons.cx * W, baseY: cfg.sea ? horizon + 4 : H * (cfg.pitons.baseYr ?? 1) });

  if (cfg.waterfall) {
    const wf = cfg.waterfall;
    const wfG = grad([[0, wf.color, 0.05], [0.35, wf.color, 0.75], [1, wf.color, 0.9]]);
    defs.push(wfG.def);
    body += `<rect x="${wf.x * W - wf.w / 2}" y="${wf.y1 * H}" width="${wf.w}" height="${(wf.y2 - wf.y1) * H}" rx="${wf.w / 2}" fill="url(#${wfG.id})"/>
      <ellipse cx="${wf.x * W}" cy="${wf.y2 * H}" rx="${wf.w * 2.4}" ry="${wf.w * 0.6}" fill="${wf.color}" opacity="0.5" filter="url(#soft)"/>`;
  }

  if (cfg.beach) {
    const b = cfg.beach;
    body += `<path d="M0 ${H} L0 ${H * b.y} Q ${W * 0.34} ${H * (b.y - 0.05)} ${W * 0.62} ${H * (b.y + 0.1)} T ${W} ${H * (b.y + 0.16)} L${W} ${H} Z" fill="${b.color}"/>`;
    if (b.foam)
      body += `<path d="M0 ${H * b.y} Q ${W * 0.34} ${H * (b.y - 0.05)} ${W * 0.62} ${H * (b.y + 0.1)} T ${W} ${H * (b.y + 0.16)}" fill="none" stroke="${b.foam}" stroke-width="7" opacity="0.7" filter="url(#soft)"/>`;
  }

  if (cfg.boats) cfg.boats.forEach((bt) => (body += boat({ ...bt, x: bt.x * W, y: bt.y * H })));
  if (cfg.lights) body += lights({ ...cfg.lights, x: cfg.lights.x * W, y: cfg.lights.y * H });
  if (cfg.birds) body += birds({ ...cfg.birds, x: cfg.birds.x * W, y: cfg.birds.y * H });
  if (cfg.palms) cfg.palms.forEach((p) => (body += palm({ ...p, x: p.x * W, y: p.y * H })));

  /* canopy frame: dark foliage arching in from a top corner */
  if (cfg.canopy) {
    const c = cfg.canopy;
    const fx = c.side === 'right' ? W : 0;
    const dir = c.side === 'right' ? -1 : 1;
    let leaves = '';
    const r = rng(23);
    for (let i = 0; i < 7; i++) {
      const a = (18 + i * 11) * (Math.PI / 180);
      const len = W * 0.22 * (0.7 + r() * 0.6);
      const ex = fx + dir * Math.cos(a) * len;
      const ey = Math.sin(a) * len * 0.9;
      leaves += `<path d="M${fx} 0 Q ${fx + dir * len * 0.5} ${ey * 0.2} ${ex} ${ey} Q ${fx + dir * len * 0.42} ${ey * 0.55} ${fx} ${H * 0.02} Z" fill="${c.color}" opacity="${0.85 - i * 0.06}"/>`;
    }
    body += leaves;
  }

  /* vignette + grain for a printed, editorial finish */
  const vig = radial([[0, '#000', 0], [0.72, '#000', 0], [1, '#000', 0.18]]);
  defs.push(vig.def);
  body += `<rect width="${W}" height="${H}" fill="url(#${vig.id})"/>`;
  body += `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.05"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img">
<defs>
${defs.join('\n')}
<filter id="soft" x="-40%" y="-200%" width="180%" height="500%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
</defs>
${body}
</svg>`;
}

/* ------------------------------------------------------------- palettes */

const P = {
  dawn: {
    sky: [[0, '#F7ECD9'], [0.45, '#F0D5AC'], [0.8, '#E3B183'], [1, '#D9A075']],
    sea: [[0, '#C9AE8C'], [0.4, '#8FA091'], [1, '#5C7B71']],
    far: '#C99F79', mid: '#9C8266', near: '#4A463C', ink: '#2B2A25',
  },
  day: {
    sky: [[0, '#F3EFE4'], [0.55, '#E4E4D2'], [1, '#CFDCCB']],
    sea: [[0, '#BCD3C4'], [0.45, '#7FA894'], [1, '#48756A']],
    far: '#AEBBA4', mid: '#7E9078', near: '#3E5248', ink: '#26332C',
  },
  dusk: {
    sky: [[0, '#EFE0C8'], [0.5, '#E2BC8C'], [0.85, '#C98E62'], [1, '#B87F58']],
    sea: [[0, '#C39B72'], [0.45, '#7E8571'], [1, '#4C6058']],
    far: '#BC8E64', mid: '#8A6F52', near: '#41403A', ink: '#28271F',
  },
  forest: {
    sky: [[0, '#EFEFE2'], [0.6, '#D9E0C8'], [1, '#C2D0B2']],
    far: '#A9BC9B', mid: '#71906F', near: '#3C5C46', ink: '#1F3A2C',
  },
  night: {
    sky: [[0, '#243A3C'], [0.55, '#2F4E4B'], [0.85, '#546A5C'], [1, '#7A7A5F']],
    sea: [[0, '#4F5F51'], [0.5, '#2F4740'], [1, '#1E332E']],
    far: '#3E5450', mid: '#2C4340', near: '#17282A', ink: '#0F1D1F',
  },
  amber: {
    sky: [[0, '#F5E9D0'], [0.5, '#EBCB98'], [1, '#D9A76C']],
    far: '#C79A66', mid: '#9A7A4E', near: '#4E4530', ink: '#2E2A1C',
  },
};

/* --------------------------------------------------------------- scenes */

const scenes = {
  /* HOME hero — the Pitons at first light across the bay */
  'hero-pitons': {
    w: 2000, h: 1250, horizon: 0.66, sky: P.dawn.sky,
    sun: { x: 0.32, y: 0.4, r: 46, color: '#F8E3B4' },
    sea: { stops: P.dawn.sea },
    ridges: [
      { y: 0.62, amp: 30, color: P.dawn.far, op: 0.55, seed: 3, mist: '#F2DDBB', mistOp: 0.4 },
      { y: 0.645, amp: 24, color: P.dawn.mid, op: 0.7, seed: 9 },
    ],
    pitons: { cx: 0.7, h1: 560, h2: 420, gap: 290, w1: 330, w2: 220, color: P.dawn.near },
    boats: [{ x: 0.24, y: 0.78, s: 1.15, color: P.dawn.ink, op: 0.9 }],
    birds: { x: 0.48, y: 0.3, s: 1.3, color: P.dawn.ink },
    palms: [{ x: 0.965, y: 1.12, s: 2.4, flip: -1, color: P.dawn.ink }],
  },

  'gros-piton-hike': {
    horizon: 0.7, sky: P.day.sky,
    sun: { x: 0.78, y: 0.22, r: 38, color: '#F6EFD8' },
    sea: { stops: P.day.sea },
    ridges: [{ y: 0.66, amp: 26, color: P.day.far, op: 0.6, seed: 5, mist: '#EDEADA', mistOp: 0.45 }],
    pitons: { cx: 0.36, h1: 700, h2: 0, gap: 900, w1: 360, w2: 0, color: P.day.near },
    birds: { x: 0.6, y: 0.34, s: 1.1, color: P.day.ink },
    palms: [{ x: 0.94, y: 1.08, s: 2.1, flip: -1, color: P.day.ink }],
  },

  'sulphur-springs': {
    horizon: 0.75, sky: P.amber.sky,
    sun: { x: 0.24, y: 0.26, r: 40, color: '#F8E9C2' },
    ridges: [
      { y: 0.42, amp: 40, color: P.amber.far, op: 0.55, seed: 13, mist: '#F2E3C2', mistOp: 0.6 },
      { y: 0.55, amp: 52, color: P.amber.mid, op: 0.8, seed: 21, mist: '#EFDDBE', mistOp: 0.5 },
    ],
    hills: [
      { y: 0.72, amp: 60, color: P.amber.near, seed: 8 },
      { y: 0.88, amp: 40, color: P.amber.ink, seed: 15 },
    ],
    waterfall: { x: 0.63, w: 26, y1: 0.47, y2: 0.72, color: '#F4ECD9' },
    birds: { x: 0.5, y: 0.2, s: 1, color: P.amber.ink },
  },

  'sugar-beach': {
    horizon: 0.56, sky: P.day.sky,
    sun: { x: 0.68, y: 0.18, r: 36, color: '#F7F0DA' },
    sea: { stops: [[0, '#C4DACB'], [0.5, '#8AB29E'], [1, '#57857A']] },
    ridges: [{ y: 0.53, amp: 22, color: P.day.far, op: 0.5, seed: 4 }],
    pitons: { cx: 0.2, h1: 430, h2: 330, gap: 250, w1: 210, w2: 150, color: P.day.mid, op: 0.85 },
    beach: { y: 0.78, color: '#EADFC4', foam: '#F7F3E4' },
    boats: [{ x: 0.58, y: 0.66, s: 0.9, color: P.day.ink, op: 0.85 }],
    palms: [
      { x: 0.9, y: 1.04, s: 2.3, flip: -1, color: P.day.ink },
      { x: 0.985, y: 1.1, s: 1.7, flip: -1, color: P.day.ink, op: 0.92 },
    ],
  },

  'reef-snorkel': {
    horizon: 0.5, sky: [[0, '#F1EEDF'], [0.6, '#DEE5D2'], [1, '#C8DCC9']],
    sun: { x: 0.3, y: 0.16, r: 34, color: '#F6F1DC' },
    sea: { stops: [[0, '#A9CDBB'], [0.35, '#63988A'], [0.75, '#2F6A60'], [1, '#1E4C46']] },
    ridges: [{ y: 0.47, amp: 26, color: '#9FB29B', op: 0.6, seed: 6 }],
    boats: [{ x: 0.7, y: 0.6, s: 1.2, color: '#22332C', op: 0.9 }, { x: 0.5, y: 0.55, s: 0.7, color: '#22332C', op: 0.75 }],
    birds: { x: 0.62, y: 0.24, s: 1, color: '#26332C' },
    palms: [{ x: 0.05, y: 1.07, s: 2.4, flip: 1, color: '#22332C' }],
  },

  'tet-paul': {
    horizon: 0.68, sky: P.day.sky,
    sun: { x: 0.16, y: 0.2, r: 34, color: '#F6EFD8' },
    sea: { stops: P.day.sea },
    ridges: [{ y: 0.64, amp: 30, color: P.day.far, op: 0.55, seed: 17, mist: '#EDEADA', mistOp: 0.4 }],
    pitons: { cx: 0.58, h1: 560, h2: 420, gap: 280, w1: 280, w2: 190, color: P.day.near },
    hills: [{ y: 0.86, amp: 46, color: P.day.ink, seed: 12 }],
    palms: [{ x: 0.08, y: 0.95, s: 1.9, flip: 1, color: P.day.ink }],
    birds: { x: 0.4, y: 0.3, s: 1.1, color: P.day.ink },
  },

  'rainforest-waterfall': {
    horizon: 0.99, sky: P.forest.sky,
    ridges: [
      { y: 0.3, amp: 44, color: P.forest.far, op: 0.7, seed: 31, mist: '#E9EBD8', mistOp: 0.55 },
      { y: 0.46, amp: 56, color: P.forest.mid, op: 0.85, seed: 37, mist: '#E2E7D0', mistOp: 0.45 },
    ],
    hills: [
      { y: 0.62, amp: 60, color: P.forest.near, seed: 41 },
      { y: 0.84, amp: 44, color: P.forest.ink, seed: 47 },
    ],
    waterfall: { x: 0.55, w: 30, y1: 0.34, y2: 0.63, color: '#F1F2E4' },
    canopy: { side: 'left', color: P.forest.ink },
    birds: { x: 0.74, y: 0.16, s: 1, color: P.forest.ink },
  },

  'botanical-gardens': {
    horizon: 0.99, sky: [[0, '#F2EEDF'], [0.55, '#E2E3C9'], [1, '#CBD5B4']],
    ridges: [{ y: 0.34, amp: 40, color: '#ABBC96', op: 0.7, seed: 51, mist: '#EDEBD5', mistOp: 0.5 }],
    hills: [
      { y: 0.55, amp: 52, color: '#7E9468', seed: 55 },
      { y: 0.78, amp: 46, color: '#4A6342', seed: 59 },
      { y: 0.92, amp: 30, color: '#2C4530', seed: 61 },
    ],
    waterfall: { x: 0.38, w: 22, y1: 0.38, y2: 0.56, color: '#F2F1DF' },
    canopy: { side: 'right', color: '#243B28' },
    palms: [{ x: 0.1, y: 1.05, s: 2, flip: 1, color: '#2A4230' }],
  },

  'castries-market': {
    horizon: 0.68, sky: P.dawn.sky,
    sun: { x: 0.62, y: 0.24, r: 42, color: '#F8E3B4' },
    sea: { stops: P.dawn.sea },
    ridges: [{ y: 0.63, amp: 34, color: P.dawn.far, op: 0.6, seed: 65, mist: '#F2DDBB', mistOp: 0.4 }],
    hills: [{ y: 0.87, amp: 30, color: P.dawn.ink, seed: 67 }],
    boats: [
      { x: 0.24, y: 0.76, s: 1, color: P.dawn.ink },
      { x: 0.4, y: 0.72, s: 0.7, color: P.dawn.ink, op: 0.85 },
      { x: 0.12, y: 0.71, s: 0.55, color: P.dawn.ink, op: 0.7 },
    ],
    birds: { x: 0.78, y: 0.3, s: 1.2, color: P.dawn.ink },
    palms: [{ x: 0.95, y: 1.06, s: 2.2, flip: -1, color: P.dawn.ink }],
  },

  'rum-distillery': {
    horizon: 0.99, sky: P.amber.sky,
    sun: { x: 0.8, y: 0.3, r: 44, color: '#F7E2AE' },
    ridges: [{ y: 0.44, amp: 42, color: P.amber.far, op: 0.6, seed: 71, mist: '#F2E3C2', mistOp: 0.45 }],
    hills: [
      { y: 0.6, amp: 54, color: P.amber.mid, seed: 73 },
      { y: 0.78, amp: 48, color: P.amber.near, seed: 79 },
      { y: 0.93, amp: 26, color: P.amber.ink, seed: 83 },
    ],
    palms: [
      { x: 0.12, y: 0.88, s: 1.9, flip: 1, color: P.amber.ink },
      { x: 0.22, y: 0.95, s: 1.4, flip: 1, color: P.amber.ink, op: 0.9 },
    ],
    birds: { x: 0.55, y: 0.2, s: 1, color: P.amber.ink },
  },

  'fish-fry': {
    horizon: 0.66, sky: P.night.sky,
    sun: { x: 0.7, y: 0.24, r: 30, color: '#EEE3C0' },
    sea: { stops: P.night.sea, shimmerColor: '#D8C79A' },
    ridges: [{ y: 0.62, amp: 30, color: P.night.far, op: 0.8, seed: 87 }],
    hills: [{ y: 0.86, amp: 30, color: P.night.ink, seed: 89 }],
    lights: { x: 0.42, y: 0.84, n: 12, spread: 0.62, color: '#E9C98B' },
    boats: [{ x: 0.3, y: 0.74, s: 0.85, color: P.night.ink }],
    palms: [{ x: 0.06, y: 1.05, s: 2.3, flip: 1, color: '#0C1A1C' }, { x: 0.96, y: 1.08, s: 2, flip: -1, color: '#0C1A1C' }],
  },

  'pigeon-island': {
    horizon: 0.6, sky: P.day.sky,
    sun: { x: 0.42, y: 0.16, r: 34, color: '#F6F0DA' },
    sea: { stops: P.day.sea },
    ridges: [
      { y: 0.57, amp: 20, color: P.day.far, op: 0.5, seed: 91 },
      { y: 0.56, amp: 90, color: P.day.near, op: 0.95, seed: 97 },
    ],
    beach: { y: 0.82, color: '#E7DCC1', foam: '#F5F1E2' },
    boats: [{ x: 0.78, y: 0.68, s: 1, color: P.day.ink }],
    birds: { x: 0.24, y: 0.26, s: 1.1, color: P.day.ink },
  },

  'sunset-cruise': {
    horizon: 0.64, sky: P.dusk.sky,
    sun: { x: 0.5, y: 0.55, r: 52, color: '#F6D9A0' },
    sea: { stops: P.dusk.sea, shimmerColor: '#F3D8A4' },
    ridges: [{ y: 0.61, amp: 26, color: P.dusk.far, op: 0.6, seed: 101, mist: '#EFD9B4', mistOp: 0.35 }],
    pitons: { cx: 0.82, h1: 420, h2: 320, gap: 230, w1: 210, w2: 150, color: P.dusk.near, op: 0.9 },
    boats: [{ x: 0.36, y: 0.76, s: 1.4, color: P.dusk.ink }],
    birds: { x: 0.2, y: 0.3, s: 1.1, color: P.dusk.ink },
  },

  'airport-transfer': {
    horizon: 0.66, sky: P.day.sky,
    sun: { x: 0.86, y: 0.18, r: 34, color: '#F6F0DA' },
    sea: { stops: P.day.sea },
    ridges: [
      { y: 0.62, amp: 34, color: P.day.far, op: 0.55, seed: 103, mist: '#EDEADA', mistOp: 0.4 },
      { y: 0.65, amp: 50, color: P.day.mid, op: 0.8, seed: 107 },
    ],
    /* coast road: pale ribbon sweeping through the foreground headland */
    hills: [{ y: 0.8, amp: 44, color: P.day.near, seed: 109 }],
    boats: [{ x: 0.2, y: 0.74, s: 0.8, color: P.day.ink, op: 0.8 }],
    palms: [{ x: 0.9, y: 1.02, s: 2.1, flip: -1, color: P.day.ink }],
    birds: { x: 0.5, y: 0.24, s: 1, color: P.day.ink },
  },

  'island-day-hire': {
    horizon: 0.6, sky: P.dusk.sky,
    sun: { x: 0.26, y: 0.34, r: 42, color: '#F6DCA6' },
    sea: { stops: P.dusk.sea, shimmerColor: '#F3D8A4' },
    ridges: [
      { y: 0.57, amp: 28, color: P.dusk.far, op: 0.55, seed: 113, mist: '#EFD9B4', mistOp: 0.35 },
      { y: 0.59, amp: 70, color: P.dusk.mid, op: 0.85, seed: 127 },
    ],
    hills: [{ y: 0.84, amp: 40, color: P.dusk.ink, seed: 131 }],
    palms: [{ x: 0.08, y: 0.96, s: 2, flip: 1, color: P.dusk.ink }, { x: 0.16, y: 1.04, s: 1.5, flip: 1, color: P.dusk.ink, op: 0.9 }],
    birds: { x: 0.66, y: 0.26, s: 1.1, color: P.dusk.ink },
  },

  /* ABOUT page imagery */
  'about-coast': {
    horizon: 0.58, sky: P.dawn.sky,
    sun: { x: 0.74, y: 0.3, r: 44, color: '#F8E3B4' },
    sea: { stops: P.dawn.sea },
    ridges: [
      { y: 0.55, amp: 26, color: P.dawn.far, op: 0.55, seed: 137, mist: '#F2DDBB', mistOp: 0.4 },
      { y: 0.57, amp: 80, color: P.dawn.near, op: 0.95, seed: 139 },
    ],
    beach: { y: 0.84, color: '#E9DDC0', foam: '#F6F0DE' },
    birds: { x: 0.4, y: 0.22, s: 1.2, color: P.dawn.ink },
  },
  'about-village': {
    horizon: 0.64, sky: P.day.sky,
    sun: { x: 0.2, y: 0.18, r: 32, color: '#F6F0DA' },
    sea: { stops: P.day.sea },
    ridges: [{ y: 0.6, amp: 40, color: P.day.mid, op: 0.8, seed: 149, mist: '#EDEADA', mistOp: 0.35 }],
    hills: [{ y: 0.84, amp: 36, color: P.day.near, seed: 151 }],
    boats: [{ x: 0.56, y: 0.72, s: 0.9, color: P.day.ink }, { x: 0.68, y: 0.68, s: 0.6, color: P.day.ink, op: 0.8 }],
    lights: { x: 0.5, y: 0.82, n: 8, spread: 0.5, color: '#F3EBD2' },
    palms: [{ x: 0.94, y: 1.04, s: 2.2, flip: -1, color: P.day.ink }],
  },
  'about-ridge': {
    horizon: 0.99, sky: P.forest.sky,
    ridges: [
      { y: 0.36, amp: 48, color: P.forest.far, op: 0.7, seed: 157, mist: '#E9EBD8', mistOp: 0.5 },
      { y: 0.52, amp: 60, color: P.forest.mid, op: 0.85, seed: 163 },
    ],
    hills: [{ y: 0.7, amp: 56, color: P.forest.near, seed: 167 }, { y: 0.9, amp: 30, color: P.forest.ink, seed: 173 }],
    birds: { x: 0.3, y: 0.18, s: 1.1, color: P.forest.ink },
    palms: [{ x: 0.88, y: 0.92, s: 1.8, flip: -1, color: P.forest.ink }],
  },
};

/* --------------------------------------------------------------- output */

for (const [name, cfg] of Object.entries(scenes)) {
  const svg = scene(cfg);
  writeFileSync(join(OUT, `${name}.svg`), svg);
  console.log(`  ✓ ${name}.svg (${(svg.length / 1024).toFixed(1)} kB)`);
}
console.log(`\n${Object.keys(scenes).length} scenes written to assets/img/`);
