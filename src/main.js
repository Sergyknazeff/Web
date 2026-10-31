import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import Lenis from 'lenis';
import { initHeroGL } from './hero-gl.js';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin);

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------------- smooth scroll ---------------- */
const lenis = new Lenis({ lerp: 0.09, smoothWheel: !reduced });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

$$('[data-link]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id?.startsWith('#')) return;
    e.preventDefault();
    lenis.scrollTo(id === '#top' ? 0 : id, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
  })
);
$('.nav__cta').addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo('#contact', { duration: 1.8 }); });
$('.hero__scroll').addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo('#about', { duration: 1.6 }); });

/* ---------------- small utilities ---------------- */
$('.js-year').textContent = new Date().getFullYear();
const clockEl = $('.js-clock');
const tick = () => {
  clockEl.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date());
};
tick(); setInterval(tick, 15000);

/* ---------------- WebGL hero ---------------- */
const gl = initHeroGL($('.hero__gl'));

/* ---------------- cursor ---------------- */
if (finePointer) {
  const cursor = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor], a, button');
    if (!t) return;
    const text = t.dataset.cursor;
    if (text) { label.textContent = text; cursor.classList.add('is-label'); }
    else cursor.classList.add('is-hover');
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest('[data-cursor], a, button');
    if (!t || t.contains(e.relatedTarget)) return;
    cursor.classList.remove('is-label', 'is-hover');
  });

  /* magnetic elements */
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });

  /* spotlight + 3D tilt on cards */
  $$('.card, [data-spot]').forEach((el) => {
    const isCard = el.classList.contains('card');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
      if (isCard) gsap.to(el, { rotateY: (x / r.width - 0.5) * 10, rotateX: -(y / r.height - 0.5) * 10, transformPerspective: 900, duration: 0.6, ease: 'power3' });
    });
    el.addEventListener('pointerleave', () => { if (isCard) gsap.to(el, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1, 0.5)' }); });
  });
}

/* ---------------- preloader → intro ---------------- */
function runLoader() {
  return new Promise((resolve) => {
    const counter = { v: 0 };
    const countEl = $('.js-count');
    const tl = gsap.timeline({ onComplete: resolve });
    tl.from('.loader__name span, .loader__name em', { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.08 })
      .to(counter, {
        v: 100, duration: reduced ? 0.2 : 1.8, ease: 'power2.inOut',
        onUpdate: () => { countEl.textContent = String(Math.round(counter.v)).padStart(3, '0'); },
      }, 0.2)
      .to('.loader__bar i', { scaleX: 1, duration: reduced ? 0.2 : 1.8, ease: 'power2.inOut' }, 0.2)
      .to('.loader__inner', { yPercent: -30, autoAlpha: 0, duration: 0.7, ease: 'power3.in' })
      .to('.loader__curtain', { scaleY: 0, duration: 1.1, ease: 'expo.inOut' }, '-=0.25');
  });
}

function heroIntro() {
  const split = SplitText.create('.js-split-hero', { type: 'chars', charsClass: 'char' });
  const tl = gsap.timeline();
  tl.to({ v: 0 }, { v: 1, duration: 2.6, ease: 'power2.out', onUpdate() { gl.setIntro(this.targets()[0].v); } }, 0)
    .from(split.chars, { yPercent: 115, rotate: 8, duration: 1.4, ease: 'expo.out', stagger: 0.035 }, 0.1)
    .from('.js-hero-fade', { y: 24, autoAlpha: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 }, 0.6)
    .from('.nav > *', { y: -20, autoAlpha: 0, duration: 1, ease: 'power3.out', stagger: 0.06 }, 0.7);

  // hover wave on hero letters
  if (finePointer) {
    split.chars.forEach((c) => c.addEventListener('pointerenter', () => {
      gsap.fromTo(c, { yPercent: 0 }, { yPercent: -14, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 });
    }));
  }
  return tl;
}

/* ---------------- scroll animations ---------------- */
function initScroll() {
  // hero parallax + shader dissolve
  ScrollTrigger.create({
    trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (s) => gl.setScroll(s.progress),
  });
  gsap.to('.hero__title', { yPercent: 35, scale: 0.92, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__bottom, .hero__top', { autoAlpha: 0, y: -40, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: '70% top', scrub: true } });

  // velocity-reactive marquee
  const track = $('.js-marquee');
  const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  let dir = 1;
  ScrollTrigger.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate: (s) => {
      const v = s.getVelocity();
      if (v !== 0) dir = v > 0 ? 1 : -1;
      const boost = Math.min(Math.abs(v) / 250, 6);
      gsap.to(loop, { timeScale: dir * (1 + boost), duration: 0.2, overwrite: true });
      gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.25, ease: 'power2.out', overwrite: false });
    },
  });
  gsap.fromTo('.marquee', { skewY: 0 }, { skewY: -2, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });

  // about: word-by-word illumination
  const about = SplitText.create('.js-scrub-text', { type: 'words', wordsClass: 'word' });
  gsap.to(about.words, {
    color: 'var(--fg)', stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: '.about__text', start: 'top 80%', end: 'bottom 45%', scrub: 0.6 },
  });

  // headings: masked line reveal
  $$('.js-split-h2, .js-split-quote').forEach((el) => {
    const s = SplitText.create(el, { type: 'lines,words', mask: 'lines', linesClass: 'split-line' });
    gsap.from(s.words, {
      yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.04,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  // generic reveal
  $$('.js-reveal').forEach((el, i) => {
    gsap.from(el, { y: 60, autoAlpha: 0, duration: 1.2, ease: 'expo.out', delay: (i % 3) * 0.08, scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // counters
  $$('.js-counter').forEach((el) => {
    const to = +el.dataset.to;
    const o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 2.2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
      onUpdate: () => { el.textContent = String(Math.round(o.v)).padStart(to < 10 ? 2 : 1, '0'); },
    });
  });

  // expertise: pinned horizontal scroll (desktop) / staggered (mobile)
  const mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', () => {
    const htrack = $('.js-htrack');
    const dist = () => htrack.scrollWidth - window.innerWidth;
    const tween = gsap.to(htrack, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.expertise', pin: '.expertise__pin', start: 'top top', end: () => `+=${dist()}`,
        scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (s) => gsap.set('.js-hprogress', { scaleX: s.progress }),
      },
    });
    // cards lift & rotate in as they enter the viewport horizontally
    $$('.card', htrack).forEach((card) => {
      gsap.from(card, {
        yPercent: 18, rotate: 4, autoAlpha: 0.2, ease: 'power2.out',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 105%', end: 'left 60%', scrub: true },
      });
    });
  });
  mm.add('(max-width: 860px)', () => {
    $$('.card').forEach((card) => gsap.from(card, { y: 60, autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 90%' } }));
  });

  // method diagram: draw lines, pop nodes, then loop data pulses
  const diagram = $('.js-diagram');
  const lines = $$('.d-lines path', diagram);
  const dtl = gsap.timeline({ scrollTrigger: { trigger: diagram, start: 'top 75%' } });
  dtl.from('.d-in > g', { x: -30, autoAlpha: 0, duration: 0.8, ease: 'expo.out', stagger: 0.1 })
    .from(lines.slice(0, 4), { drawSVG: 0, duration: 1.2, ease: 'power2.inOut', stagger: 0.08 }, 0.3)
    .from('.d-core', { scale: 0.4, autoAlpha: 0, transformOrigin: '50% 50%', duration: 1.2, ease: 'elastic.out(1, 0.6)' }, 1)
    .from(lines.slice(4), { drawSVG: 0, duration: 1, ease: 'power2.inOut', stagger: 0.08 }, 1.4)
    .from('.d-out > g', { x: 30, autoAlpha: 0, duration: 0.8, ease: 'expo.out', stagger: 0.1 }, 1.7)
    .add(() => startPulses(), 2.2);

  gsap.to('.d-core__orbit', { rotate: 360, transformOrigin: '50% 50%', duration: 20, repeat: -1, ease: 'none' });
  gsap.to('.d-core__glow', { scale: 1.15, transformOrigin: '50% 50%', duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });

  function startPulses() {
    if (reduced) return;
    $$('.pulse-dot', diagram).forEach((dot, i) => {
      const inPath = lines[i];
      const outPath = lines[4 + (i % 3)];
      const tl = gsap.timeline({ repeat: -1, delay: i * 0.55, repeatDelay: 0.6 });
      tl.set(dot, { opacity: 1 })
        .to(dot, { duration: 1.4, ease: 'power1.inOut', motionPath: { path: inPath, align: inPath, alignOrigin: [0.5, 0.5] } })
        .to(dot, { duration: 1.2, ease: 'power1.inOut', motionPath: { path: outPath, align: outPath, alignOrigin: [0.5, 0.5] } })
        .to(dot, { opacity: 0, duration: 0.2 });
    });
  }

  // steps sync
  $$('.js-step').forEach((el, i) => {
    gsap.from(el, { x: 40, autoAlpha: 0, duration: 1, ease: 'expo.out', delay: i * 0.08, scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // feature card: scale-in + parallax glow
  gsap.from('.feature__inner', { scale: 0.9, borderRadius: 80, autoAlpha: 0.4, ease: 'none', scrollTrigger: { trigger: '.feature', start: 'top bottom', end: 'top 30%', scrub: true } });

  // jobs
  $$('.js-job').forEach((el) => {
    gsap.from(el, { y: 50, autoAlpha: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  // contact
  const c = SplitText.create('.js-split-contact', { type: 'chars' });
  gsap.from(c.chars, { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.025, scrollTrigger: { trigger: '.contact__title', start: 'top 80%' } });
  gsap.from('.contact__actions', { y: 40, autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.contact__actions', start: 'top 92%' } });

  // nav hides on scroll down, shows on scroll up
  let navShown = true;
  ScrollTrigger.create({
    start: 120, end: 'max',
    onUpdate: (s) => {
      const show = s.direction === -1;
      if (show !== navShown) { navShown = show; gsap.to('.nav', { yPercent: show ? 0 : -110, duration: 0.6, ease: 'power3.out' }); }
    },
    onLeaveBack: () => { navShown = true; gsap.to('.nav', { yPercent: 0, duration: 0.6 }); },
  });
}

/* ---------------- boot ---------------- */
(async () => {
  await document.fonts.ready;
  await runLoader();
  $('.loader').remove();
  document.body.classList.remove('is-loading');
  heroIntro();
  initScroll();
  lenis.start();
  ScrollTrigger.refresh();
})();
