import * as THREE from 'three';

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

// Domain-warped fbm "liquid silk" with a mouse-driven lens and scroll dissolve.
const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;     // 0..1, smoothed
  uniform float uHover;     // mouse velocity energy
  uniform float uScroll;    // 0..1 over hero height
  uniform float uIntro;     // 0..1 intro reveal

  vec3 hash3(vec2 p){
    vec3 q = vec3(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)), dot(p,vec2(419.2,371.9)));
    return fract(sin(q)*43758.5453);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    float a = hash3(i).x, b = hash3(i+vec2(1,0)).x, c = hash3(i+vec2(0,1)).x, d = hash3(i+vec2(1,1)).x;
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8,-0.6,0.6,0.8);
    for(int i=0;i<6;i++){ v += a*noise(p); p = r*p*2.02 + 3.1; a *= 0.5; }
    return v;
  }

  void main(){
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
    vec2 m = (uMouse - 0.5) * vec2(uRes.x/uRes.y, 1.0);

    // lens around cursor
    float d = length(p - m);
    float lens = smoothstep(0.55, 0.0, d);
    p += (p - m) * lens * (0.18 + uHover * 0.35);

    float t = uTime * 0.06;
    p *= 1.6 + uScroll * 0.8;

    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm(p + 3.5*q + vec2(1.7, 9.2) + t*1.3), fbm(p + 3.5*q + vec2(8.3, 2.8) - t));
    float f = fbm(p + 3.0*r);

    // palette: ink → violet → ember → bone highlights
    vec3 ink    = vec3(0.031, 0.031, 0.039);
    vec3 violet = vec3(0.30, 0.22, 0.75);
    vec3 ember  = vec3(1.00, 0.36, 0.12);
    vec3 bone   = vec3(0.98, 0.92, 0.84);

    vec3 col = ink;
    col = mix(col, violet, smoothstep(0.35, 0.85, length(q)) * 0.55);
    col = mix(col, ember,  smoothstep(0.55, 1.0, f) * 0.95);
    float silk = pow(smoothstep(0.62, 0.95, f * (0.8 + r.x*0.6)), 3.0);
    col += bone * silk * 0.55;

    // fine iridescent banding
    float bands = sin(f*40.0 + uTime*0.4) * 0.5 + 0.5;
    col += vec3(0.06,0.03,0.08) * bands * smoothstep(0.4,0.9,f);

    // cursor glow
    col += ember * lens * 0.12 * (0.5 + uHover);

    // vignette + intro + scroll fade
    float vig = smoothstep(1.25, 0.2, length((uv-0.5)*vec2(1.3,1.0)));
    col *= vig;
    float reveal = smoothstep(0.0, 1.0, uIntro * 1.6 - length(uv - vec2(0.5,0.45)));
    col = mix(ink, col, reveal);
    col = mix(col, ink, uScroll * 0.85);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function initHeroGL(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.background = 'radial-gradient(circle at 60% 40%, #3a1d10, #08080a 60%)';
    return { setIntro() {}, setScroll() {} };
  }
  const dpr = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uHover: { value: 0 },
    uScroll: { value: 0 },
    uIntro: { value: 0 },
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms }));
  scene.add(mesh);

  const target = new THREE.Vector2(0.5, 0.5);
  let energy = 0;
  let last = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    energy = Math.min(1, energy + Math.hypot(dx, dy) / 400);
    last = { x: e.clientX, y: e.clientY };
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);

  const t0 = performance.now();
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    uniforms.uTime.value = (performance.now() - t0) / 1000;
    uniforms.uMouse.value.lerp(target, 0.06);
    energy *= 0.94;
    uniforms.uHover.value += (energy - uniforms.uHover.value) * 0.1;
    renderer.render(scene, camera);
  });

  return {
    setIntro: (v) => { uniforms.uIntro.value = v; },
    setScroll: (v) => { uniforms.uScroll.value = v; },
    uniforms,
  };
}
