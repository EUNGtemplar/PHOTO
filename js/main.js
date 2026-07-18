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
      // ScrollSmoother's normalizeScroll captures wheel/touch input itself,
      // so the overflow:hidden above never stopped it — see the pause below.
      var sm = window.ScrollSmoother && ScrollSmoother.get();
      if (sm) sm.paused(false);
    }, 2000);
  });
})();

(function () {
  // Every pin/curtain below (.nav, .intro, the curtain covers) has its
  // scroll start/end computed once, synchronously,
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

  // #loading's overflow:hidden (see above) doesn't reach normalizeScroll's
  // own wheel/touch capture, so without this the user can scroll straight
  // through the intro and into the hero reveal while still looking at the
  // loading screen — released once #loading fades out.
  if (document.getElementById('loading')) smoother.paused(true);

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

  var leadWords = document.querySelectorAll('.hero__lead .word');
  var motiveWords = document.querySelectorAll('.hero__motive .word');

  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.classList.add('is-revealed');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  if (leadWords.length) {
    gsap.from(leadWords, {
      color: 'rgba(255,255,255,.15)',
      stagger: 0.08,
      ease: 'none',
      scrollTrigger: { trigger: '.hero__lead', start: 'top 50%', end: 'top -10%', scrub: 1 }
    });
  }
  if (motiveWords.length) {
    gsap.from(motiveWords, {
      color: 'rgba(255,255,255,.15)',
      stagger: 0.06,
      ease: 'none',
      scrollTrigger: { trigger: '.hero__motive', start: 'top 50%', end: 'top -10%', scrub: 1 }
    });
  }

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
      start: 'center bottom+=10%',
      end: 'bottom bottom-=70%',
      scrub: 1,
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
  // Cards fall into place from above as the right-hand column scrolls past,
  // each keyed to its own position (not pinned) — the vertical-stack
  // replacement for the old horizontal 3D-fan carousel. rotateX gives the
  // same "3D" read as the old fan, just tipping the card forward on its way
  // down instead of rotating it sideways; .strengths-cards' perspective is
  // what makes that rotateX read as real depth instead of a flat squish.
  var cards = document.querySelectorAll('#strengths .card');
  if (!cards.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  cards.forEach(function (card) {
    gsap.fromTo(card, { opacity: 0, y: -70, rotateX: -25 }, {
      opacity: 1,
      y: 0,
      rotateX: 0,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: card,
        start: 'top 65%',
        end: 'top 35%',
        scrub: 1
      }
    });
  });

  // Dim the pinned left title's color once card 02 nears focus, so attention
  // shifts to the card content it's introducing rather than the title above it.
  // Scrubbed to the same range as card 02's own fade-in, so it darkens in step
  // with that card arriving and un-darkens if the user scrolls back above it.
  var strengthsTitle = document.querySelector('.strengths-aside .section__title');
  if (strengthsTitle && cards[1]) {
    gsap.fromTo(strengthsTitle, { color: '#fff' }, {
      color: '#454545',
      ease: 'power2.out',
      scrollTrigger: {
        trigger: cards[1],
        start: 'top 65%',
        end: 'top 35%',
        scrub: 2
      }
    });
  }

  // CSS position:sticky on .strengths-aside (see stylesheet) is the fallback
  // for when this bails out — under ScrollSmoother it silently never sticks,
  // same reason .nav/.intro use ScrollTrigger.pin instead (ScrollSmoother
  // transforms #smooth-content rather than moving real scrollTop, so sticky
  // never sees itself as scrolled). Same 900px cutoff as the split layout
  // itself: below it .strengths-aside is static, nothing to pin.
  //
  // .strengths-aside deliberately has no .reveal class in the HTML (unlike
  // most other section intros) — this pin is a transform-type pin (required
  // under ScrollSmoother), which leaves the element's own transform alone
  // rather than overriding it, so .reveal's CSS-transition transform would
  // still be live and stack additively with the pin's. In practice that
  // showed up as the pinned title sitting dozens of px lower than intended.
  //
  // matchMedia (not a plain innerWidth check) so the pin is created/torn
  // down again if the viewport crosses the 900px cutoff after load — a
  // resize or a tablet rotation, not just the initial page width.
  ScrollTrigger.matchMedia({
    '(min-width: 901px)': function () {
      ScrollTrigger.create({
        trigger: '.strengths-aside',
        start: 'center center',
        // endTrigger targets card 04's own meta label, not the outer
        // .strengths-cards column — the column's bottom edge trails behind
        // the label by that card's own bottom padding, so the pin used to
        // release a few px later than "YUKINIAN / 04-04" itself.
        endTrigger: '#strengths .card:last-child .card__meta',
        end: 'bottom center',
        pin: true,
        pinSpacing: false
      });
    }
  });
})();
