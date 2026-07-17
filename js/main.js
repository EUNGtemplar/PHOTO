// GSAP 스크롤 인터랙션(핀/커튼/캐러셀 등)과 페이지 전반의 바닐라 JS 동작을 담당하는 메인 스크립트
(function () {
  // Hides #loading once every asset has actually finished loading — not just
  // DOMContentLoaded, which fires before images/webfonts are done. Waits on
  // both window 'load' (images/scripts/stylesheets) and document.fonts.ready
  // (async webfonts, font-display:swap) so the reveal doesn't happen before
  // text has settled onto its final font — the same reflow concern the
  // ScrollTrigger.refresh() calls below exist for.
  var loading = document.getElementById('loading');
  if (!loading) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    loading.remove();
    return;
  }
  document.documentElement.style.overflow = 'hidden';
  Promise.all([
    new Promise(function (resolve) {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    }),
    document.fonts ? document.fonts.ready : Promise.resolve()
  ]).then(function () {
    // Holds the finished loading screen on screen for a beat before the
    // fade-out starts, instead of snapping straight to it the instant
    // everything resolves.
    setTimeout(function () {
      document.documentElement.style.overflow = '';
      loading.classList.add('is-hidden');
      loading.addEventListener('transitionend', function () { loading.remove(); }, { once: true });
    }, 2000);
  });
})();

(function () {
  // Every pin/curtain below (.nav, .intro, the strengths carousel, the two
  // curtain covers) has its scroll start/end computed once, synchronously,
  // from the DOM as it's laid out right now — but Google Fonts/Typekit load
  // async with font-display:swap, so text still on the fallback font at this
  // point can reflow (different line-height/wrapping/element height) once
  // the real webfont swaps in seconds later. That leaves every already-
  // computed pin boundary pointing at a stale pixel position — the visible
  // bug being blank scroll stretches where a pin now releases/engages at the
  // wrong point relative to the reflowed layout. document.fonts.ready
  // resolves once every font actually used on the page has finished
  // loading, so refreshing there re-measures everything against final,
  // settled layout. Runs after all the ScrollTriggers below are created
  // (this promise callback fires on a later microtask/task, once the
  // synchronous script execution creating them has finished either way),
  // and re-refreshing is a no-op if fonts were already loaded.
  if (window.ScrollTrigger && document.fonts) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();

(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !window.gsap || !window.ScrollTrigger || !window.ScrollSmoother) return;

  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
  var smoother = ScrollSmoother.create({
    smooth: 1.4,
    effects: false,
    normalizeScroll: true
  });

  var navEl = document.querySelector('.nav');
  if (navEl) {
    ScrollTrigger.create({
      trigger: navEl,
      start: 'top top',
      endTrigger: 'footer',
      end: 'bottom bottom',
      pin: true,
      pinSpacing: false
    });
  }

  // scroll-behavior:smooth can't reach ScrollSmoother's virtualized scroll position,
  // so anchor clicks are intercepted and re-issued through the smoother instead.
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      var navH = navEl ? navEl.offsetHeight : 0;
      smoother.scrollTo(Math.max(0, smoother.offset(target) - navH), true);
    });
  });
})();

(function () {
  var scroller = document.querySelector('.intro-scroller');
  var introEl = document.querySelector('.intro');
  var seq = document.querySelector('.intro__sequence');
  var logo = document.querySelector('.intro__logo');
  if (!scroller || !introEl || !seq || !logo) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Words rise in (0-35%), hold static (35-55%), then rise out (55-70%) —
  // doneStageStart marks the moment they've fully exited and the YUKINIAN
  // logo takes over; the remaining 30% is the logo's zoom/blur.
  var doneStageStart = 0.7;

  if (reduced || !window.gsap || !window.ScrollTrigger) {
    scroller.style.height = 'auto';
    seq.hidden = true;
    logo.classList.add('is-visible');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Word-by-word masked reveal, scrubbed to the first 35% of the same
  // pinned scroller (well before doneStageStart below hides the whole
  // sequence) — each word slides up from behind its own overflow:hidden
  // mask (.intro__seq-word), so it looks like it rises out of a line edge
  // rather than fading in.
  var seqWordInners = gsap.utils.toArray('.intro__seq-word-inner');
  gsap.set(seqWordInners, { yPercent: 100 });
  gsap.to(seqWordInners, {
    yPercent: 0,
    stagger: 0.1,
    ease: 'expo.out',
    scrollTrigger: {
      trigger: scroller,
      start: 'top top',
      end: '35% top',
      scrub: 1
    }
  });

  // After the hold, all 5 words exit together by continuing in the same
  // upward direction they entered from (yPercent 0 -> -100, no stagger),
  // finishing right as doneStageStart hands off to the YUKINIAN logo.
  // fromTo (not to) because a plain .to() captures its "from" value at
  // creation time — i.e. yPercent:100, the pre-entrance state — so as soon
  // as this range activated it snapped back to 100 and visibly replayed the
  // rise-in before continuing on to -100. Pinning the start value to 0
  // explicitly makes it pick up exactly where the entrance tween left off.
  // immediateRender:false because fromTo() defaults that to true, which
  // would apply yPercent:0 (fully visible) the instant this runs at load —
  // overwriting the yPercent:100 hidden state gsap.set() just established,
  // before any scrolling has happened.
  gsap.fromTo(seqWordInners,
    { yPercent: 0 },
    {
      yPercent: -100,
      ease: 'expo.out',
      immediateRender: false,
      scrollTrigger: {
        trigger: scroller,
        start: '55% top',
        end: (doneStageStart * 100) + '% top',
        scrub: 3
      }
    }
  );

  var isDone = false;
  ScrollTrigger.create({
    trigger: scroller,
    start: 'top top',
    end: 'bottom bottom',
    pin: introEl,
    pinSpacing: false,
    onUpdate: function (self) {
      var done = self.progress >= doneStageStart;
      if (done === isDone) return;
      isDone = done;
      seq.classList.toggle('is-hidden', done);
      logo.classList.toggle('is-visible', done);
    },
    onLeave: function () {
      var heroEl = document.getElementById('top');
      if (!heroEl) return;
      var activeSmoother = window.ScrollSmoother && ScrollSmoother.get();
      if (activeSmoother) {
        var navH = document.querySelector('.nav');
        navH = navH ? navH.offsetHeight : 0;
        gsap.to(activeSmoother, {
          scrollTop: Math.max(0, activeSmoother.offset(heroEl) - navH),
          duration: 1.5,
          ease: 'power2.inOut'
        });
      } else {
        heroEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Once the word sequence is done and "YUKINIAN" is showing (the final 40%
  // of this same pinned scroller, see doneStageStart above), zoom + blur it
  // out in place before the pin releases into the nav/hero — same element,
  // same section, no hand-off. opacity is deliberately left alone here — it's
  // already driven by the .is-visible class toggle above, and capturing it
  // into this tween would freeze it at its pre-toggle value (0) for the whole
  // scrub range.
  gsap.to(logo, {
    scale: 6,
    filter: 'blur(24px)',
    ease: 'none',
    scrollTrigger: {
      trigger: scroller,
      start: (doneStageStart * 100) + '% top',
      end: 'bottom bottom',
      scrub: 3
    }
  });
})();

(function () {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

(function () {
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  if (!els.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function apply() {
    var vh = window.innerHeight;
    els.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      var offset = (vh / 2 - (rect.top + rect.height / 2)) * parseFloat(el.dataset.parallax);
      el.style.transform = 'translateY(' + offset + 'px)';
    });
  }
  if (window.gsap) {
    // ScrollSmoother moves the page via its own rAF-driven transform, not
    // native `scroll` events — a scroll listener here fires on a different,
    // less frequent cadence and visibly stutters against everything else.
    // gsap.ticker runs on that same rAF loop, so this stays in sync.
    gsap.ticker.add(apply);
  } else {
    var ticking = false;
    var onScroll = function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () { apply(); ticking = false; });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }
  apply();
})();

(function () {
  var links = {};
  document.querySelectorAll('.navlink').forEach(function (a) {
    links[a.getAttribute('href').slice(1)] = a;
  });
  var sections = Object.keys(links).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      links[entry.target.id].classList.toggle('navlink--active', entry.isIntersecting);
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(function (s) { io.observe(s); });
})();

(function () {
  var chars = document.querySelectorAll('.hero__title .char');
  var hero = document.querySelector('.hero');
  if (!chars.length || !hero) return;

  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.classList.add('is-revealed');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var revealed = false;
  gsap.fromTo(chars, {
    opacity: 0,
    yPercent: 120,
    scaleY: 2.3,
    scaleX: 0.7,
    transformOrigin: '50% 0%'
  }, {
    duration: 1,
    ease: 'back.inOut(2)',
    opacity: 1,
    yPercent: 0,
    scaleY: 1,
    scaleX: 1,
    stagger: 0.03,
    scrollTrigger: {
      trigger: '.hero__title',
      start: 'center bottom+=50%',
      end: 'bottom bottom-=40%',
      scrub: 3,
      onUpdate: function (self) {
        if (!revealed && self.progress >= 0.999) {
          revealed = true;
          hero.classList.add('is-revealed');
        }
      }
    }
  });
})();

(function () {
  var heroMain = document.querySelector('.hero__main');
  var hero = document.querySelector('.hero');
  if (!heroMain || !hero) return;
  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);
  gsap.fromTo(heroMain, { scale: 0.5, yPercent: 12 }, {
    scale: 1,
    yPercent: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top bottom',
      end: 'top center',
      scrub: 2
    }
  });
})();

(function () {
  // "Curtain" cover: .hero pins at its own natural height with no explicit
  // `end`, so GSAP defaults the pin duration to that height — exactly the
  // scroll distance #career (sitting right after it, pinSpacing:false, no
  // gap) needs to slide up from directly below it to fully covering it.
  // Same pin:true/pinSpacing:false shape as the .nav/.intro pins above;
  // #career gets its own position+z-index (see its CSS rule) so it actually
  // paints over the now-pinned .hero instead of the reverse.
  var hero = document.querySelector('.hero');
  var career = document.getElementById('career');
  if (!hero || !career) return;
  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    pin: true,
    pinSpacing: false
  });

  // Dims .hero as #career's top rises from the viewport bottom to the
  // viewport top — same darkening trick as the curtain reference (opacity
  // 1 -> low), scrubbed 1:1 to scroll so it stays in lockstep with the cover.
  gsap.to(hero, {
    opacity: 0.3,
    ease: 'none',
    scrollTrigger: {
      trigger: career,
      start: 'top bottom',
      end: 'top top',
      scrub: 1,
    }
  });
})();

(function () {
  // Sizes the accent photos as a fraction of #about's own rendered height
  // (not a vw unit) so they grow/shrink with however tall the real copy
  // makes the section — independent of the GSAP reveal animation below,
  // which still runs (or not) on top of whatever base size this sets.
  var about = document.querySelector('#about');
  if (!about || window.innerWidth <= 900) return;

  function sizeCards() {
    about.style.setProperty('--about-img-base', (about.getBoundingClientRect().height * 0.18) + 'px');
  }
  sizeCards();
  window.addEventListener('resize', sizeCards);
})();

(function () {
  var about = document.querySelector('#about');
  var cards = about ? about.querySelectorAll('.about__card') : [];
  if (!about || !cards.length) return;
  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);
  // reveal order alternates left/right (1,4,2,5,3,6) instead of following DOM
  // order (1,2,3,4,5,6), which read as "left column fully in, then right
  // column" — card N's rank in this list picks its stagger slot below.
  var revealOrder = [1, 4, 2, 5, 3, 6];
  cards.forEach(function (card, i) {
    var rank = revealOrder.indexOf(i + 1);
    var start = 8 + rank * 4; // % down #about's own height where this card starts revealing
    gsap.fromTo(card, { opacity: 0, y: 400, scale: 0.5 }, {
      opacity: 1,
      y: -10,
      scale: 2,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: about,
        start: start + '% center',
        end: (start + 40) + '% center',
        scrub: 1.5
      }
    });
  });
})();

(function () {
  var section = document.getElementById('strengths');
  var scroller = document.querySelector('.strengths-scroller');
  var pinWrap = document.querySelector('.strengths-pin');
  var track = document.querySelector('.strengths-track');
  if (!section || !scroller || !pinWrap || !track) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ponytail: single load-time breakpoint check (matches .about__cards' 900px cutoff),
  // not ScrollTrigger.matchMedia — revisit if live resize across 900px needs to un-pin cleanly.
  if (reduced || window.innerWidth <= 900 || !window.gsap || !window.ScrollTrigger) return;

  // Deferred until webfonts are done loading: every measurement below (card
  // widths, .strengths-pin's own rendered height, hence the whole carousel's
  // scroll distance) depends on final text metrics. Running it before
  // Google Fonts/Typekit finish swapping in bakes stale numbers straight
  // into scroller.style.height and the positions[] array — unlike GSAP's
  // own pin start/end (which ScrollTrigger.refresh() re-derives from live
  // DOM afterward, see the font-ready refresh at the top of this script),
  // these are plain JS values nothing else re-runs, so refresh() alone
  // can't correct a stale scroller height. This was the "works on the
  // second scroll pass, not the first (right after a fresh reload)" bug.
  // document.fonts.ready resolves on the next microtask if fonts were
  // already loaded, so this costs nothing on a warm cache.
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(setup);

  function setup() {
  section.classList.add('is-pin-mode');
  pinWrap.classList.add('is-horizontal');
  gsap.registerPlugin(ScrollTrigger);

  var items = track.querySelectorAll('.card');
  // Measured once, right here, before the tween ever touches `track.x` (so
  // there's no transform to account for) — each item's center-to-viewport-center
  // offset, i.e. how far the track must move (as -offset) to bring that item to
  // the middle of the screen. Last one doubles as the total scroll distance.
  var centerX = window.innerWidth / 2;
  var widths = Array.prototype.map.call(items, function (item) {
    return item.getBoundingClientRect().width;
  });
  var centers = Array.prototype.map.call(items, function (item, i) {
    var rect = item.getBoundingClientRect();
    return rect.left + widths[i] / 2 - centerX;
  });

  // First card doesn't start centered — it starts shifted off to the right
  // (only a sliver of its edge peeking into view, a hint there's more to
  // scroll) and the very first scroll step slides it in to center, same as
  // every later card-to-card step. So there's one extra position up front:
  // positions[0] = the hidden/peek state, positions[1..] = each card centered.
  var peekShift = window.innerWidth / 2 + widths[0] * 0.35;
  var positions = [-centers[0] + peekShift].concat(centers.map(function (c) { return -c; }));
  var distance = positions[0] - positions[positions.length - 1];
  gsap.set(track, { x: positions[0] });

  // pinSpacing:false + an explicit-height scroller, same technique as
  // .intro-scroller/.edu-scroller — the pinned box's height is intrinsic
  // (title + track + CSS padding, see .strengths-pin.is-horizontal), so the
  // scroller needs exactly that plus the extra distance the track travels.
  var pinHeight = pinWrap.getBoundingClientRect().height;
  var carouselHeight = pinHeight + distance;
  // One more pinHeight appended as a tail: .strengths-pin (pinned by the
  // single ScrollTrigger below) stays pinned through this extra stretch too,
  // which is exactly the distance #match needs to slide up and fully cover
  // it afterward (same "cover distance = the pinned element's own height"
  // reasoning as the hero -> career curtain). This used to be a SECOND,
  // separate ScrollTrigger pinning the same .strengths-pin right after this
  // one released — pinning one element from two independent ScrollTriggers
  // desynced on reverse scroll (stretched/blank scroll going back up), so
  // it's folded into this single pin instead; onUpdate below rescales
  // progress back to the carousel's own fraction so the card pacing itself
  // is unchanged, then just holds the last card through the tail.
  var totalHeight = carouselHeight + pinHeight;
  scroller.style.height = totalHeight + 'px';

  // 3D fanned/offset stack (see CSS): each item's --offset is its live
  // distance from viewport center, measured in card-widths — 0 exactly at
  // center, growing toward +/-1 as it slides away. Computed from the track's
  // known translation + each item's static center (not getBoundingClientRect,
  // which would read back the item's own --offset-driven translateX and
  // never quite settle on exactly 0 at the snap point).
  function updateOffsets() {
    var tx = gsap.getProperty(track, 'x');
    items.forEach(function (item, i) {
      var offset = (centers[i] + tx) / widths[i];
      item.style.setProperty('--offset', offset.toFixed(3));
      item.style.setProperty('--abs-offset', Math.min(Math.abs(offset), 1.5).toFixed(3));
    });
  }

  // Not scrubbed: raw scroll progress is only used to pick which position is
  // "current" (0 = the hidden peek state, 1..n = each card centered).
  // Whenever that step changes, the track is force-tweened straight to that
  // position — no continuous mid-drag, just a short eased jump each time
  // scroll crosses into the next/previous zone (including the very first
  // reveal of card 1).
  var currentStep = 0;
  ScrollTrigger.create({
    trigger: scroller,
    start: 'top top',
    // '+=totalHeight' (an exact pixel offset from start) instead of
    // 'bottom bottom' (a string reference to the trigger's own rect) —
    // confirmed via debug logging that 'bottom bottom' was getting
    // recomputed short by ~one pinHeight on refresh (the curtain tail
    // wasn't being honored), even though scroller.style.height was
    // genuinely set to the full totalHeight. An explicit pixel distance
    // from start sidesteps whatever GSAP does internally when re-deriving
    // a trigger's "bottom" on refresh.
    end: '+=' + totalHeight,
    pin: pinWrap,
    pinSpacing: false,
    anticipatePin: 1,
    onRefresh: function (self) {
      console.log('[strengths pin debug] onRefresh', { start: self.start, end: self.end, duration: self.end - self.start, expectedTotal: totalHeight });
    },
    onLeave: function (self) {
      console.log('[strengths pin debug] onLeave (pin released, scrolling forward)', { scrollY: window.scrollY, start: self.start, end: self.end });
    },
    onUpdate: function (self) {
      // self.progress spans the whole scroller (carousel + curtain tail)
      // now — rescale back to the carousel's own fraction first, clamped
      // to 1, so cards swap at exactly the same scroll pace as before and
      // simply hold at the last card through the extra tail.
      var carouselProgress = Math.min(self.progress * totalHeight / carouselHeight, 1);
      var step = Math.round(carouselProgress * (positions.length - 1));
      if (step === currentStep) return;
      if (step === positions.length - 1) {
        console.log('[strengths pin debug] reached last card', { scrollY: window.scrollY, progress: self.progress });
      }
      currentStep = step;
      items.forEach(function (el) { el.classList.remove('card--float'); });
      gsap.to(track, {
        x: positions[step],
        duration: 0.65,
        ease: 'back.out(2.4)', // bigger overshoot past the target then springs back — the bounce
        overwrite: true,
        onUpdate: updateOffsets,
        onComplete: function () {
          // step 0 is the hidden peek state (no card centered yet)
          if (step >= 1) items[step - 1].classList.add('card--float');
        }
      });
    }
  });
  updateOffsets(); // set the resting state before any scrolling happens

  // The lone document.fonts.ready → ScrollTrigger.refresh() (top of this
  // script) fires before this setup() runs, so it measures the page BEFORE
  // scroller.style.height grows above. Nothing re-measures after — the nav
  // pin's endTrigger:'footer' and ScrollSmoother's scroll bounds stay cached
  // at the shorter pre-growth height, so footer becomes unreachable by
  // scroll on desktop widths (mobile never hits this since the carousel
  // bails above and never grows the page). One more refresh here fixes it.
  ScrollTrigger.refresh();
  }
})();

(function () {
  // Dims .strengths-pin as #match rises to cover it. The actual pinning for
  // this curtain phase lives in the single ScrollTrigger inside the carousel
  // IIFE above (its scroller height has a trailing pinHeight tail for
  // exactly this). This tween is independent of any pin (just a scrub keyed
  // to #match's own position). Same 900px/reduced-motion/no-gsap gate as the
  // carousel above, since under that width .strengths-pin is never pinned or
  // sized to a screen-tall block.
  //
  // end is 'top 30%' rather than 'top top': the covered (hidden) portion of
  // .strengths-pin and the dimmed portion both grow together as #match rises
  // over the SAME scroll range, so finishing the dim exactly at full cover
  // ('top top') means it only ever reaches its darkest value on the sliver
  // still exposed right before it's completely hidden — imperceptible (this
  // was the "curtain doesn't seem to do anything" bug: confirmed via debug
  // logging that the opacity tween itself was scrubbing correctly, 1 -> 0.3,
  // it just finished at the same moment there was nothing left on screen to
  // see it on). Finishing at 'top 30%' — while #match still only covers the
  // bottom ~70% — completes the dim while a good two-line-ish strip is still
  // visibly exposed, so the darkening actually reads before that strip too
  // gets covered.
  var pinWrap = document.querySelector('.strengths-pin');
  var match = document.getElementById('match');
  if (!pinWrap || !match) return;
  if (window.innerWidth <= 900 || !window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);
  // Deferred the same way and for the same reason as the carousel IIFE
  // above: #match's document position depends on #strengths's final
  // (post-tail) height, which itself depends on webfonts being done. Promise
  // .then() callbacks on the same already-registered document.fonts.ready
  // fire in registration order, so this runs after that IIFE's setup().
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    gsap.to(pinWrap, {
      opacity: 0.3,
      ease: 'none',
      scrollTrigger: {
        trigger: match,
        start: 'top bottom',
        end: 'top 30%',
        scrub: true
      }
    });
  });
})();
