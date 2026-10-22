// Grows every [data-bouffont] title into bouffont lettering, once per page load.
// The text stays as the no-JS fallback and as the accessible name. On the home page
// titledecider.js has already put the chosen name in the link.
import { bouffontLive, bouffont, drawFrame, loadFont } from 'bouffont';

const els = [...document.querySelectorAll('[data-bouffont]')];
const fontUrl = new URL('../fonts/danifont.ttf', import.meta.url);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
// DaniFont has no straight apostrophe, only the curly one.
const opts = (text) => ({ text: text.replace(/'/g, '’'), font, seed: 'ren', preset: 'bubble', size: 160,
  render: { outline: 0.5 }, effects: [['shine', { angle: 225 }]] });
let font;

function show(el, svg, text) {
  el.setAttribute('aria-label', text);
  el.innerHTML = svg;
  el.firstElementChild.setAttribute('aria-hidden', 'true');
  el.classList.add('bouffont');
}

async function grow(el, text) {
  const live = bouffontLive(opts(text));
  while (live.step()) {
    const fr = live.frame();
    show(el, drawFrame({ ...fr, render: { ...fr.render, draft: true } }).svg, text);
    await new Promise(requestAnimationFrame);
  }
  show(el, live.final().svg, text);
}

async function title(el) {
  const text = el.textContent.trim();
  if (still) show(el, bouffont(opts(text)).svg, text);
  else await grow(el, text);
  // titledecider swaps in the plain name on first hover; redraw it, no regrow.
  new MutationObserver(() => {
    if (el.querySelector('svg')) return;
    const t = el.textContent.trim();
    show(el, bouffont(opts(t)).svg, t);
  }).observe(el, { childList: true });
}

if (els.length) {
  try {
    font = await loadFont(fontUrl.href);
    await Promise.all(els.map(title));
  } catch (e) {
    console.warn('bouffont title:', e); // the text title stays
  }
}
