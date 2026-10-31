import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import Lenis from 'lenis';
import { initScene } from './scene.js';

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

/* ---------------- particle scene ---------------- */
const scene = initScene($('.scene'));
const mobile = window.matchMedia('(max-width: 860px)').matches;
// where the cloud sits for each chapter: [x, y, scale, alpha]
const PLACE = mobile
  ? [[0, 0.9, 0.85, 0.9], [0, 0, 0.8, 0.45], [0, 0.3, 0.75, 0.5], [0, 0, 0.8, 0.5], [0, 0, 0.7, 0.55], [0, -0.8, 0.8, 0.45], [0, -1.6, 0.6, 0.9]]
  : [[1.75, 0.15, 1, 1], [2.0, 0, 0.85, 0.75], [2.3, 0.75, 0.62, 0.8], [-1.7, -0.6, 0.55, 0.7], [0, -1.75, 1.1, 0.4], [0, -1.5, 1.05, 0.55], [2.3, -1.1, 0.8, 0.5]];

function goToShape(i) {
  if (!scene) return;
  const [x, y, sc, a] = PLACE[i];
  gsap.to(scene.uniforms.uShape, { value: i, duration: 2.2, ease: 'power3.inOut', overwrite: true });
  gsap.to(scene.group.position, { x, y, duration: 2.4, ease: 'power3.inOut', overwrite: true });
  gsap.to(scene.group.scale, { x: sc, y: sc, z: sc, duration: 2.4, ease: 'power3.inOut', overwrite: true });
  gsap.to(scene.uniforms.uAlpha, { value: a, duration: 1.6, overwrite: true });
}
if (scene) gsap.set(scene.group.position, { x: PLACE[0][0], y: PLACE[0][1] });

/* ---------------- decode text effect ---------------- */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/+=<>';
function decode(el, duration = 0.9) {
  const nodes = [];
  const walk = (n) => n.childNodes.forEach((c) => (c.nodeType === 3 ? c.textContent.trim() && nodes.push(c) : walk(c)));
  walk(el);
  nodes.forEach((node) => {
    const final = node.__final || (node.__final = node.textContent);
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, duration, ease: 'power2.out',
      onUpdate: () => {
        const n = Math.floor(o.p * final.length);
        let out = final.slice(0, n);
        for (let i = n; i < final.length; i++) out += final[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        node.textContent = out;
      },
      onComplete: () => { node.textContent = final; },
    });
  });
}

/* ---------------- kinetic variable-weight type ---------------- */
function kinetic(chars, { min = 300, max = 800, radius = 280 } = {}) {
  if (!finePointer || reduced) return;
  const mouse = { x: -9999, y: -9999 };
  const cur = chars.map(() => min);
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  gsap.ticker.add(() => {
    if (window.scrollY > innerHeight * 1.2) return;
    chars.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const d = Math.hypot(mouse.x - (r.left + r.width / 2), mouse.y - (r.top + r.height / 2));
      const target = min + (max - min) * Math.pow(Math.max(0, 1 - d / radius), 1.5);
      cur[i] += (target - cur[i]) * 0.12;
      c.style.setProperty('--w', cur[i].toFixed(0));
    });
  });
}

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
  $$('.card, [data-spot], .job, .glass').forEach((el) => {
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
  $$('.hero__outline .char').forEach((c, i) => c.style.setProperty('--i', i));
  const tl = gsap.timeline();
  if (scene) tl.fromTo(scene.uniforms.uAlpha, { value: 0 }, { value: 1, duration: 2.4, ease: 'power2.out' }, 0)
    .fromTo(scene.uniforms.uShape, { value: 0.6 }, { value: 0, duration: 3, ease: 'expo.out' }, 0);
  tl.from(split.chars, { yPercent: 115, filter: 'blur(12px)', '--w': 100, duration: 1.6, ease: 'expo.out', stagger: 0.04, clearProps: 'filter' }, 0.1)
    .add(() => $$('.hero .js-decode').forEach((el) => decode(el, 1.2)), 0.6)
    .from('.js-hero-fade', { y: 24, autoAlpha: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 }, 0.6)
    .from('.nav > *', { y: -20, autoAlpha: 0, duration: 1, ease: 'power3.out', stagger: 0.06 }, 0.7);

  tl.add(() => kinetic(split.chars), 1.4);
  return tl;
}

/* ---------------- scroll animations ---------------- */
function initScroll() {
  // particle chapters: each [data-shape] section morphs the cloud
  $$('[data-shape]').forEach((sec) => {
    const i = +sec.dataset.shape;
    ScrollTrigger.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onEnter: () => goToShape(i), onEnterBack: () => goToShape(i),
    });
  });
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => scene && scene.nudge(Math.abs(s.getVelocity()) / 60) });

  // decode labels on enter
  $$('.js-decode').filter((el) => !el.closest('.hero')).forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => decode(el) });
  });

  // nav pill: active section + sliding indicator
  const pill = $('.nav__pill'), ind = $('.nav__indicator');
  const moveInd = (a) => {
    if (!a) { gsap.to(ind, { opacity: 0, duration: 0.3 }); return; }
    gsap.to(ind, { x: a.offsetLeft, width: a.offsetWidth, opacity: 1, duration: 0.6, ease: 'expo.out' });
  };
  let activeLink = null;
  $$('.nav__pill a').forEach((a) => {
    a.addEventListener('pointerenter', () => moveInd(a));
    const sec = $(a.getAttribute('href'));
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (st) => {
        a.classList.toggle('is-active', st.isActive);
        if (st.isActive) { activeLink = a; moveInd(a); } else if (activeLink === a) { activeLink = null; moveInd(null); }
      },
    });
  });
  pill.addEventListener('pointerleave', () => moveInd(activeLink));
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
      onUpdate: () => {
        el.textContent = String(Math.round(o.v)).padStart(to < 10 ? 2 : 1, '0');
        el.parentElement.style.setProperty('--w', (100 + 500 * (o.v / to)).toFixed(0));
      },
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

  // journey: pinned path draw with a travelling marker and city stops
  mm.add('(min-width: 861px)', () => {
    const path = $('.js-jpath');
    const stops = $$('.js-stop');
    const marks = [0.0, 0.25, 0.47, 0.7, 0.995];
    const len = path.getTotalLength();
    stops.forEach((el, i) => {
      const pt = path.getPointAtLength(len * marks[i]);
      el.style.setProperty('--x', `${(pt.x / 1400) * 100}%`);
      el.style.setProperty('--y', `${(pt.y / 420) * 100}%`);
    });
    gsap.set(stops, { autoAlpha: 0, y: 20 });
    gsap.set(path, { drawSVG: 0 });
    const shown = new Set();
    const tl = gsap.timeline({
      onUpdate: () => {
        const p = tl.progress();
        stops.forEach((el, i) => {
          const on = p >= marks[i] - 0.01;
          if (on && !shown.has(i)) { shown.add(i); gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', overwrite: true }); }
          if (!on && shown.has(i)) { shown.delete(i); gsap.to(el, { autoAlpha: 0, y: 20, duration: 0.4, overwrite: true }); }
        });
      },
      scrollTrigger: { trigger: '.journey', pin: '.journey__pin', start: 'top top', end: '+=180%', scrub: 1 },
    });
    tl.to(path, { drawSVG: '100%', ease: 'none', duration: 1 }, 0)
      .to('.js-jplane', { ease: 'none', duration: 1, motionPath: { path, align: path, alignOrigin: [0.5, 0.5] } }, 0);
  });
  mm.add('(max-width: 860px)', () => {
    $$('.js-stop').forEach((el) => gsap.from(el, { x: 30, autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
  });

  // ecosystem strip: sweeping light + staggered entry
  gsap.from('.eco__item', { y: 30, autoAlpha: 0, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.js-eco', start: 'top 88%' } });
  gsap.fromTo('.js-eco', { '--sweep': '-100%' }, { '--sweep': '260%', duration: 3.2, ease: 'power2.inOut', repeat: -1, repeatDelay: 1.2 });

  // feature card: scale-in + parallax glow
  gsap.from('.feature__inner', { scale: 0.9, borderRadius: 80, autoAlpha: 0.4, ease: 'none', scrollTrigger: { trigger: '.feature', start: 'top bottom', end: 'top 30%', scrub: true } });

  // jobs: rail fills with scroll, nodes light up as each role passes
  gsap.to('.js-jobs-rail', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.js-jobs', start: 'top 60%', end: 'bottom 60%', scrub: true } });
  $$('.js-job').forEach((el) => {
    gsap.from(el.children, { y: 40, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 88%' } });
    ScrollTrigger.create({ trigger: el, start: 'top 60%', end: 'bottom 60%', toggleClass: 'is-active' });
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
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
})();
