/*
 * site.js: shared behavior for every IWC page. No library needed.
 * Scroll reveals and counters come from motion.js (Anime.js 4.5.0).
 * Each part only runs if its markup is on the page.
 * 1. Header turns solid on scroll, mobile menu.
 * 2. Home H1 types in every time Home opens (about 1.2s), newest letter green.
 * 3. Home video eases back and dims as it scrolls away. No pinning.
 * 4. Video pause button.
 * 5. Savings slider: pickups today vs with a compactor.
 * 6. Equipment filter chips.
 * 7. Contact form (mockup: nothing is sent).
 */
(function () {
  var root = document.documentElement;
  var forceOff = new URLSearchParams(location.search).get('motion') === 'off';
  var reduce = forceOff || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (forceOff) root.classList.add('motion-off');
  var $ = function (id) { return document.getElementById(id); };

  /* 1. Header */
  var nav = $('nav'), menuBtn = $('menuBtn');
  function setSolid() { nav.classList.toggle('solid', window.scrollY > 40 || nav.classList.contains('open')); }
  menuBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
    setSolid();
  });
  document.querySelectorAll('#links a').forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); });
  });

  /* 2. Typed H1 (home only) */
  var h1 = document.querySelector('h1[data-type]');
  if (h1) (function () {
    var text = h1.textContent;
    if (reduce) { h1.classList.add('ready'); return; }
    h1.setAttribute('aria-label', text);
    h1.textContent = '';
    var spans = [];
    text.split(/(\s+)/).forEach(function (part) {
      if (/^\s+$/.test(part)) { h1.appendChild(document.createTextNode(part)); return; }
      var word = document.createElement('span');
      word.style.whiteSpace = 'nowrap';
      word.setAttribute('aria-hidden', 'true');
      part.split('').forEach(function (c) {
        var s = document.createElement('span');
        s.className = 'ch'; s.textContent = c;
        word.appendChild(s); spans.push(s);
      });
      h1.appendChild(word);
    });
    h1.classList.add('typing', 'ready');
    var step = 1200 / spans.length, i = 0, last = null;
    setTimeout(function tick() {
      if (last) last.classList.remove('new');
      if (i >= spans.length) { h1.classList.remove('typing'); return; }
      last = spans[i++];
      last.classList.add('on', 'new');
      setTimeout(tick, step);
    }, 250);
  })();

  /* 3. Ease-back on scroll (home, desktop and tablet only) */
  var hero = document.querySelector('.hero'), media = $('heroMedia'), dim = $('heroDim');

  var wide = window.matchMedia('(min-width: 768px)');
  var ticking = false;
  function easeBack() {
    if (!media) return;
    if (reduce || !wide.matches) { media.style.transform = ''; media.style.borderRadius = ''; dim.style.opacity = 0; return; }
    var p = Math.min(Math.max(window.scrollY / hero.offsetHeight, 0), 1);
    media.style.transform = 'scale(' + (1 - 0.06 * p).toFixed(4) + ')';
    media.style.borderRadius = (18 * p).toFixed(1) + 'px';
    dim.style.opacity = (0.5 * p).toFixed(3);
  }
  window.addEventListener('scroll', function () {
    setSolid();
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; easeBack(); }); }
  }, { passive: true });
  window.addEventListener('resize', easeBack);
  setSolid(); easeBack();

  /* 4. Hero truck (home): stop scroll. The picture is an isometric figure in an iframe (rolloff-card.html, built
     from figures/rolloff). A full container waits on the ground. The first scroll down from the top of the page
     is held: the page stays where it is while the truck's arm picks the container up, at the truck's own pace
     however hard the scroll was, and then scrolling is handed back. It plays once per visit to the page.
     With motion off, or when the page opens already scrolled, nothing is held. */
  var rig = $('heroRig'), rigFrame = rig && rig.querySelector('iframe'), cue = $('scrollCue');
  if (rigFrame && hero) (function () {
    var LIFT_MS = 3200, HOLD_MS = 260, SAFETY_MS = 5200;
    var state = 'waiting'; /* waiting, working, done */
    var post = function (m) { if (rigFrame.contentWindow) rigFrame.contentWindow.postMessage(Object.assign({ hl: 'rig' }, m), location.origin); };
    var step = function (x) { x = Math.min(Math.max(x, 0), 1); return x * x * (3 - 2 * x); };
    /* The pick-up in three overlapping beats, as a share of the arm's swing: the hook takes up the slack and the
       nose just leaves the ground, the box is dragged up and rolls aboard, then it settles onto the frame. */
    var paced = function (u) { return 0.06 * step(u / 0.22) + 0.72 * step((u - 0.14) / 0.62) + 0.22 * step((u - 0.66) / 0.34); };
    var finish = function () {
      if (state === 'done') return;
      state = 'done';
      root.classList.remove('hero-hold');
      post({ type: 'set', t: 0, fast: true });
      if (cue) cue.classList.add('gone');
    };
    var work = function () {
      if (state !== 'waiting') return;
      state = 'working';
      root.classList.add('hero-hold');
      if (cue) cue.classList.add('gone');
      var began = performance.now();
      var safety = setTimeout(finish, SAFETY_MS); /* never leave the page held if frames stop coming */
      (function frame(now) {
        if (state !== 'working') return;
        var u = (now - began) / LIFT_MS;
        post({ type: 'set', t: 1 - paced(u), fast: true });
        if (u < 1) requestAnimationFrame(frame);
        else setTimeout(function () { clearTimeout(safety); finish(); }, HOLD_MS);
      })(began);
    };
    var atTop = function () { return hero.getBoundingClientRect().top > -8; };
    /* A scroll down is caught before the page moves. While waiting at the top it starts the truck; while the
       truck works it is swallowed. Anything else is left alone. */
    var hold = function (e, down) {
      if (state === 'done') return;
      if (state === 'working') { if (e.cancelable) e.preventDefault(); return; }
      if (down && atTop()) { if (e.cancelable) e.preventDefault(); work(); }
    };
    var ready = function () {
      if (reduce) { state = 'done'; post({ type: 'still' }); if (cue) cue.classList.add('gone'); return; }
      /* opened part-way down the page (a reload, a link to a section): the truck is already loaded */
      if (state === 'waiting' && !atTop()) finish();
    };
    rigFrame.addEventListener('load', ready);
    ready();
    if (!reduce) {
      window.addEventListener('wheel', function (e) { hold(e, e.deltaY > 0); }, { passive: false });
      var touchY = null;
      window.addEventListener('touchstart', function (e) { touchY = e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
      window.addEventListener('touchmove', function (e) {
        if (touchY === null || e.touches.length !== 1) return;
        hold(e, touchY - e.touches[0].clientY > 4);
      }, { passive: false });
      window.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        var tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        var k = e.key;
        var down = k === 'ArrowDown' || k === 'PageDown' || k === 'End' || (k === ' ' && !e.shiftKey);
        if (down || (state === 'working' && (k === 'ArrowUp' || k === 'PageUp' || k === 'Home' || k === ' '))) hold(e, down);
      });
      /* the page moved some other way (a scrollbar drag, a link to a section, focus moving down): let it go */
      window.addEventListener('scroll', function () { if (state === 'waiting' && !atTop()) finish(); }, { passive: true });
    }
  })();

  /* 4a. Equipment dropdown: tap to open on touch, hover and focus handle the rest */
  document.querySelectorAll('.has-sub').forEach(function (li) {
    var btn = li.querySelector('.sub-btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) { if (!li.contains(e.target)) { li.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
    li.addEventListener('keydown', function (e) { if (e.key === 'Escape') { li.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
  });

  /* 4b. Loop clips: play only while on screen, never when motion is off */
  (function () {
    var clips = document.querySelectorAll('video[data-loop]');
    if (!clips.length) return;
    if (reduce || !('IntersectionObserver' in window)) return; /* poster frame stays */
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { rootMargin: '120px 0px' });
    clips.forEach(function (v) { io.observe(v); });
  })();

  /* 5. Savings slider. In WordPress, RENT and RATIO come from block settings. */
  if ($('calc')) (function () {
    var RENT = 379, RATIO = 4;
    var fmt = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
    var r10 = function (n) { return Math.round(n / 10) * 10; };
    function ticks(el, n) { var h = ''; for (var k = 0; k < n; k++) h += '<i></i>'; el.innerHTML = h; }
    function update() {
      var p = +$('pulls').value, c = +$('cost').value, t = +$('terms').value;
      $('pullsOut').textContent = p; $('costOut').textContent = fmt(c); $('termsOut').textContent = t;
      var today = p * c, cp = Math.max(1, Math.ceil(p / RATIO)), withC = cp * c + RENT, save = today - withC;
      $('todayPulls').textContent = p;
      $('todayCost').textContent = (p === 1 ? 'pickup' : 'pickups') + ' · ' + fmt(r10(today)) + ' a month';
      $('compPulls').textContent = cp;
      $('compCost').textContent = (cp === 1 ? 'pickup' : 'pickups') + ' + rental · ' + fmt(r10(withC)) + ' a month';
      ticks($('todayTicks'), p); ticks($('compTicks'), cp);
      if (save > 0) {
        var each = r10(save), total = each * t;
        $('big').textContent = 'Save about ' + fmt(t > 1 ? total : each) + ' a month';
        $('per').textContent = t > 1
          ? ('across ' + t + ' terminals, about ' + fmt(each) + ' each, or ' + fmt(total * 12) + ' a year.')
          : ('per terminal, or about ' + fmt(each * 12) + ' a year.');
      } else {
        $('big').textContent = 'Probably not at this volume';
        $('per').textContent = 'A compactor may not pay for itself here. IWC can check your actual invoices for free.';
      }
    }
    ['pulls', 'cost', 'terms'].forEach(function (id) { $(id).addEventListener('input', update); });
    update();
  })();

  /* 6. Equipment filter */
  var filters = document.querySelector('.filters');
  if (filters) {
    var cards = document.querySelectorAll('.eq-grid .card');
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      filters.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      var f = b.dataset.filter;
      cards.forEach(function (c) {
        c.hidden = !(f === 'all' || c.dataset.type === f);
        c.style.opacity = 1;
      });
    });
  }

  /* 7. Contact form: mockup only, nothing leaves the page */
  var form = $('contactForm');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    form.classList.add('sent');
    $('formDone').focus();
  });
})();
