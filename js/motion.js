/*
 * motion.js: attribute-driven Anime.js v4.5.0 reveals for static sites.
 * From the "animejs" Claude skill (Studio Jam).
 *
 * Markup:  data-anim="fade-up | stagger | split | scramble | draw"
 *            [data-step="70"] (stagger gap in ms, stagger only)
 *          data-count="500" [data-count-prefix="$"] [data-count-suffix="+"]
 *            [data-count-grouping="true|false"] (default: commas from 10,000)
 *          data-delay="200" (ms, optional, any of the above)
 *
 * Contract with motion.css:
 * - An inline <head> script adds html.js-motion before paint. Only then do
 *   [data-anim] elements start hidden. No JS = everything visible.
 * - This module adds html.motion-ready when it runs. If it never runs (CDN
 *   down), a CSS failsafe reveals everything after 2.5s.
 * - Reduced motion (OS setting or ?motion=off) skips all animation.
 *
 * Why a custom trigger instead of onScroll autoplay:
 * - Animations are built only when they play, so nothing renders early.
 *   (A paused scrambleText linked to onScroll shows scrambled text from load.)
 * - Elements the visitor scrolled past in one jump (fast scroll, anchor links)
 *   are shown instantly in their final state instead of staying invisible.
 */
import {
  animate, stagger, splitText, scrambleText, createDrawable, createScope, set,
} from 'https://cdn.jsdelivr.net/npm/animejs@4.5.0/+esm';

const root = document.documentElement;
const forceOff = new URLSearchParams(location.search).get('motion') === 'off';

const EASE = 'outExpo';
const DUR = 450;
const RISE = 12;         // px
const TRIGGER = 0.9;     // play when the element's top passes 90% of viewport height

const delayOf = (el) => Number(el.dataset.delay || 0);
const show = (el) => { el.style.opacity = 1; };

// Each handler returns { play, skip }. play animates in; skip shows the final state.
const handlers = {
  'fade-up': (el) => ({
    play: () => animate(el, { opacity: [0, 1], y: [RISE, 0], duration: DUR, ease: EASE, delay: delayOf(el) }),
    skip: () => show(el),
  }),

  stagger: (el) => ({
    play: () => animate(el.children, {
      opacity: [0, 1], y: [RISE, 0], duration: DUR, ease: EASE,
      delay: stagger(Number(el.dataset.step || 70), { start: delayOf(el) }),
    }),
    skip: () => [...el.children].forEach(show),
  }),

  split: (el) => ({
    play: () => {
      const { words } = splitText(el, { words: { wrap: 'clip' } });
      set(words, { y: '110%' });
      show(el);
      animate(words, { y: ['110%', '0%'], duration: 900, ease: 'out(4)', delay: stagger(60, { start: delayOf(el) }) });
    },
    skip: () => show(el),
  }),

  scramble: (el) => ({
    play: () => animate(el, {
      opacity: [0, 1],
      innerHTML: scrambleText({ chars: 'uppercase' }),
      delay: delayOf(el),
    }),
    skip: () => show(el),
  }),

  draw: (el) => ({
    play: () => {
      const shapes = el.querySelectorAll('path, line, polyline, rect, circle, polygon');
      const drawables = createDrawable(shapes);
      set(drawables, { draw: '0 0' });
      show(el);
      animate(drawables, {
        draw: ['0 0', '0 1'], duration: Number(el.dataset.duration || 1600), ease: 'inOutQuad',
        delay: stagger(120, { start: delayOf(el) }),
      });
    },
    skip: () => show(el),
  }),
};

function counter(el) {
  const target = parseFloat(el.dataset.count);
  if (Number.isNaN(target)) return null;
  const finalText = el.textContent;
  const decimals = (el.dataset.count.split('.')[1] || '').length;
  const pre = el.dataset.countPrefix || '';
  const suf = el.dataset.countSuffix || '';
  // Commas only from 10,000 up, so years like 2013 stay "2013".
  const grouping = el.dataset.countGrouping
    ? el.dataset.countGrouping === 'true'
    : Math.abs(target) >= 10000;
  const fmt = (n) => pre + n.toLocaleString(undefined, {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping,
  }) + suf;
  // Below the fold: show 0 so the count-up is seen. Final text stays in the HTML for SEO.
  if (el.getBoundingClientRect().top > innerHeight) el.textContent = fmt(0);
  return {
    play: () => {
      const state = { n: 0 };
      animate(state, {
        n: target, duration: Number(el.dataset.duration || 1800), ease: 'outExpo', delay: delayOf(el),
        onUpdate: () => { el.textContent = fmt(state.n); },
        onComplete: () => { el.textContent = finalText; },
      });
    },
    skip: () => { el.textContent = finalText; },
  };
}

// Fires each item once: play when it reaches the trigger line, skip if already scrolled past.
function watch(items) {
  const pending = new Set(items);
  const check = () => {
    const line = innerHeight * TRIGGER;
    for (const item of pending) {
      const r = item.el.getBoundingClientRect();
      if (r.bottom < 0) { item.skip(); pending.delete(item); }
      else if (r.top < line) { item.play(); pending.delete(item); }
    }
    if (!pending.size) {
      removeEventListener('scroll', check);
      removeEventListener('resize', check);
    }
  };
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check, { passive: true });
  check();
}

createScope({ mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' } })
  .add((self) => {
    if (self.matches.reduce || forceOff) {
      root.classList.remove('js-motion');
      root.classList.add('motion-ready');
      return;
    }
    const items = [];
    document.querySelectorAll('[data-anim]').forEach((el) => {
      const make = handlers[el.dataset.anim];
      if (!make) { show(el); return; }
      const h = make(el);
      const safe = (fn) => () => { try { fn(); } catch (err) { h.skip(); console.warn('[motion]', el, err); } };
      items.push({ el, play: safe(h.play), skip: h.skip });
    });
    document.querySelectorAll('[data-count]').forEach((el) => {
      const h = counter(el);
      if (h) items.push({ el, ...h });
    });
    root.classList.add('motion-ready');
    watch(items);
  });
