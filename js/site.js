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

  /* 4. Hero truck (home): scroll works the truck, and the page waits.
     The picture is an isometric figure in an iframe (rolloff-card.html, built from figures/rolloff). A full
     container sits on the ground behind the truck. While the page is at its top, scroll input (wheel, a finger,
     the keys) is not given to the page. It is given to the truck: `load` goes from 0, container on the ground,
     to 1, container aboard, at ONE fixed speed for as long as the scrolling goes on, however hard or fast it is.
     Stop scrolling and the truck stops. Scroll up and it runs back. The page itself cannot move until the
     container is aboard and has settled; after that scrolling is the page's again. Back at the top, scrolling up
     sets the container down. With motion off, or if the page opens already scrolled, nothing is taken. */
  var rig = $('heroRig'), rigFrame = rig && rig.querySelector('iframe'), cue = $('scrollCue');
  if (rigFrame && hero) (function () {
    var TRAVEL_MS = 2000;  /* a full pick-up, at the truck's one speed */
    var SETTLE_MS = 320;   /* the page stays put this long after the container is aboard */
    var TOUCH_PACE = 1.5;  /* a finger gets through it a little quicker: a swipe is short, a trackpad glide is long */
    var load = 0, dir = 0, pace = 1, activeUntil = 0, settledAt = 0, frame = 0, last = 0, sent = -1;
    var post = function (m) { if (rigFrame.contentWindow) rigFrame.contentWindow.postMessage(Object.assign({ hl: 'rig' }, m), location.origin); };
    var atTop = function () { return window.scrollY <= 2; };
    var show = function () {
      if (cue) cue.classList.toggle('gone', load > 0.02);
      var t = 1 - load;
      if (Math.abs(t - sent) < 0.0004) return;
      sent = t;
      post({ type: 'set', t: t, fast: true });
    };
    var tick = function (now) {
      frame = 0;
      var dt = last ? Math.min(now - last, 50) : 16;
      last = now;
      if (now < activeUntil) {
        var before = load;
        load = Math.min(Math.max(load + (dir * pace * dt) / TRAVEL_MS, 0), 1);
        if (load === 1 && before < 1) settledAt = now + SETTLE_MS;
        show();
      }
      if (now < activeUntil && ((dir > 0 && load < 1) || (dir < 0 && load > 0))) frame = requestAnimationFrame(tick);
      else last = 0;
    };
    /* Is this scroll, down (1) or up (-1), the truck's to take? */
    var mine = function (d) {
      if (!atTop()) return false;
      if (d > 0) return load < 1 || performance.now() < settledAt;
      return load > 0;
    };
    /* Keep the truck moving that way for `tail` ms from now: each new piece of scroll input extends it. */
    var drive = function (d, tail, quicker) {
      var now = performance.now();
      pace = quicker || 1;
      if (d !== dir) { dir = d; activeUntil = 0; }
      activeUntil = Math.max(activeUntil, now + tail);
      if (!frame) frame = requestAnimationFrame(tick);
    };
    var settleNow = function () { load = 1; dir = 0; activeUntil = 0; show(); };
    var ready = function () {
      if (reduce) { post({ type: 'still' }); if (cue) cue.classList.add('gone'); return; }
      if (!atTop()) settleNow(); /* opened part-way down: the truck is already loaded */
      sent = -1;
      show();
    };
    rigFrame.addEventListener('load', ready);
    ready();
    if (reduce) return;

    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return; /* pinch zoom */
      var d = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
      if (!d || !mine(d)) return;
      if (e.cancelable) e.preventDefault();
      /* a trackpad sends a stream of small steps; a notched mouse wheel sends one big step, which earns a longer push */
      var size = Math.abs(e.deltaY) * (e.deltaMode === 1 ? 32 : 1);
      drive(d, Math.min(Math.max(size * 3.2, 120), 480));
    }, { passive: false });

    /* A finger: its direction works the truck while it moves, and a flick carries on briefly after it lifts. */
    var touch = null;
    window.addEventListener('touchstart', function (e) {
      touch = e.touches.length === 1 ? { y: e.touches[0].clientY, at: e.timeStamp, speed: 0, d: 0, taken: null } : null;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (!touch || e.touches.length !== 1) return;
      var y = e.touches[0].clientY, dy = touch.y - y, dt = Math.max(e.timeStamp - touch.at, 1);
      if (touch.taken === null) {
        if (Math.abs(dy) < 4) return;
        touch.taken = mine(dy > 0 ? 1 : -1); /* decided once, when the finger first clearly moves */
      }
      if (!touch.taken) return;
      if (e.cancelable) e.preventDefault();
      if (Math.abs(dy) >= 1) {
        touch.d = dy > 0 ? 1 : -1;
        touch.speed = Math.abs(dy) / dt;
        touch.y = y; touch.at = e.timeStamp;
        if (mine(touch.d)) drive(touch.d, 150, TOUCH_PACE);
      }
    }, { passive: false });
    var lift = function () {
      if (touch && touch.taken && touch.d && mine(touch.d)) drive(touch.d, Math.min(Math.max(touch.speed * 520, 0), 900), TOUCH_PACE);
      touch = null;
    };
    window.addEventListener('touchend', lift, { passive: true });
    window.addEventListener('touchcancel', lift, { passive: true });

    window.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
      var k = e.key;
      var d = (k === 'ArrowDown' || k === 'PageDown' || k === 'End' || (k === ' ' && !e.shiftKey)) ? 1
            : (k === 'ArrowUp' || k === 'PageUp' || k === 'Home' || (k === ' ' && e.shiftKey)) ? -1 : 0;
      if (!d || !mine(d)) return;
      e.preventDefault();
      drive(d, 420);
    });

    /* The page moved some other way (a scrollbar drag, a link to a section, focus moving down): the truck is loaded. */
    window.addEventListener('scroll', function () { if (!atTop() && load < 1) settleNow(); }, { passive: true });
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
