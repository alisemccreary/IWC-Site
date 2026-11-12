/*
 * site.js: shared behavior for every IWC page. No library needed.
 * Scroll reveals and counters come from motion.js (Anime.js 4.5.0).
 * Each part only runs if its markup is on the page.
 * 1. Header turns solid on scroll, mobile menu.
 * 2. Home H1 types once per visit (about 1.2s), newest letter green.
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
    var text = h1.textContent, seen = false;
    try { seen = sessionStorage.getItem('iwc-typed') === '1'; } catch (e) {}
    if (reduce || seen) { h1.classList.add('ready'); return; }
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
      if (i >= spans.length) { h1.classList.remove('typing'); try { sessionStorage.setItem('iwc-typed', '1'); } catch (e) {} return; }
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

  /* 4. Pause button */
  var vid = $('heroVideo'), pauseBtn = $('pauseBtn');
  if (vid && pauseBtn) {
    if (reduce) { vid.removeAttribute('autoplay'); vid.pause(); }
    pauseBtn.addEventListener('click', function () {
      if (vid.paused) { vid.play(); pauseBtn.textContent = '❚❚'; pauseBtn.setAttribute('aria-label', 'Pause background video'); }
      else { vid.pause(); pauseBtn.textContent = '▶'; pauseBtn.setAttribute('aria-label', 'Play background video'); }
    });
  }

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
