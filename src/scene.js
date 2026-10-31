import * as THREE from 'three';

/*
 * One persistent particle field behind the whole page.
 * Every particle carries a target position for each "chapter" shape; the vertex shader
 * blends between them with a per-particle stagger, so the cloud flows from form to form.
 *
 * 0 globe of audiences · 1 four ecosystem clusters · 2 torus knot "machine"
 * 3 AMC vortex · 4 journey ribbon · 5 data terrain · 6 initials
 */

const SHAPES = 7;

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uShape;
  uniform float uSize;
  uniform float uPR;
  uniform vec3  uMouse;
  uniform float uMouseStrength;
  ${Array.from({ length: SHAPES }, (_, i) => `attribute vec3 aP${i};`).join('\n  ')}
  attribute vec4 aRand;
  varying vec3 vColor;
  varying float vAlpha;

  float k(float x){
    float d = aRand.x * 0.45;
    return smoothstep(0.0, 1.0, clamp((x - d) / 0.55, 0.0, 1.0));
  }

  void main(){
    vec3 p = aP0;
    ${Array.from({ length: SHAPES - 1 }, (_, i) => `p = mix(p, aP${i + 1}, k(uShape - ${i}.0));`).join('\n    ')}

    // turbulence, stronger mid-transition
    float tr = sin(fract(uShape) * 3.14159);
    float t = uTime * 0.35;
    vec3 n = vec3(
      sin(p.y * 2.3 + t + aRand.y * 6.28),
      cos(p.z * 2.1 + t * 1.2 + aRand.z * 6.28),
      sin(p.x * 2.7 - t + aRand.w * 6.28)
    );
    p += n * (0.025 + tr * 0.35 * aRand.y);

    vec4 wp = modelMatrix * vec4(p, 1.0);

    // cursor repulsion (world space, z=0 plane)
    vec2 d = wp.xy - uMouse.xy;
    float dist = length(d);
    float f = smoothstep(0.9, 0.0, dist) * uMouseStrength;
    wp.xy += normalize(d + 1e-5) * f * 0.45;
    wp.z  += f * 0.6;

    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.35 + aRand.z * 0.9) * uPR * (1.0 + f * 0.7) / -mv.z;

    // iridescent palette: cyan → violet → coral, shifted by position and time
    vec3 c1 = vec3(0.49, 0.97, 1.00);
    vec3 c2 = vec3(0.56, 0.45, 1.00);
    vec3 c3 = vec3(1.00, 0.48, 0.30);
    float h = fract(aRand.w + p.x * 0.08 + p.y * 0.05 + uTime * 0.02);
    vec3 col = h < 0.5 ? mix(c1, c2, h * 2.0) : mix(c2, c3, (h - 0.5) * 2.0);
    col = mix(col, vec3(1.0), f * 0.25 + step(0.985, aRand.z) * 0.6);
    vColor = col;
    vAlpha = 0.35 + aRand.y * 0.65;
  }
`;

const fragment = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float a = smoothstep(0.5, 0.0, r);
    a = pow(a, 1.6);
    gl_FragColor = vec4(vColor, a * vAlpha * uAlpha);
  }
`;

/* ---------- shape generators ---------- */
const rand = (a = -1, b = 1) => a + Math.random() * (b - a);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

function globe(n) {
  const a = new Float32Array(n * 3);
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    let x, y, z, r;
    if (i % 7 === 0) { // inner volume
      r = Math.cbrt(Math.random()) * 1.35;
      const th = rand(0, Math.PI * 2), ph = Math.acos(rand());
      x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph); z = r * Math.sin(ph) * Math.sin(th);
    } else {
      const yy = 1 - (i / (n - 1)) * 2; r = Math.sqrt(1 - yy * yy);
      const th = g * i; const R = 1.55 + gauss() * 0.02;
      x = Math.cos(th) * r * R; y = yy * R; z = Math.sin(th) * r * R;
    }
    a.set([x, y, z], i * 3);
  }
  return a;
}

function clusters(n) {
  const a = new Float32Array(n * 3);
  const c = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map((v) => v.map((x) => x * 0.95));
  for (let i = 0; i < n; i++) {
    const m = i % 10;
    if (m < 8) {
      const v = c[i % 4];
      const s = 0.32;
      a.set([v[0] + gauss() * s, v[1] + gauss() * s, v[2] + gauss() * s], i * 3);
    } else { // filaments between clusters
      const p = c[i % 4], q = c[(i + 1 + (i >> 3) % 3) % 4], t = Math.random();
      a.set([p[0] + (q[0] - p[0]) * t + gauss() * 0.02, p[1] + (q[1] - p[1]) * t + gauss() * 0.02, p[2] + (q[2] - p[2]) * t + gauss() * 0.02], i * 3);
    }
  }
  return a;
}

function torusKnot(n) {
  const a = new Float32Array(n * 3);
  const P = 2, Q = 3, R = 1.05, tube = 0.22;
  for (let i = 0; i < n; i++) {
    const u = (i / n) * Math.PI * 2 * 1.0 + rand(0, 0.002);
    const pt = (t) => {
      const r = R * (0.6 + 0.4 * Math.cos(Q * t));
      return [r * Math.cos(P * t), r * Math.sin(P * t), 0.4 * R * Math.sin(Q * t)];
    };
    const c0 = pt(u), c1 = pt(u + 0.001);
    const T = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]];
    const tl = Math.hypot(...T); T.forEach((v, j) => (T[j] = v / tl));
    let N = [T[1], -T[0], 0]; const nl = Math.hypot(...N) || 1; N = N.map((v) => v / nl);
    const B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
    const ang = rand(0, Math.PI * 2), rr = tube * Math.sqrt(Math.random());
    a.set([0, 1, 2].map((j) => (c0[j] + (N[j] * Math.cos(ang) + B[j] * Math.sin(ang)) * rr) * 1.25), i * 3);
  }
  return a;
}

function vortex(n) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    if (i % 5 === 0) { // dense core
      const r = Math.pow(Math.random(), 2) * 0.35, th = rand(0, 6.28), ph = Math.acos(rand());
      a.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
    } else { // inflowing spiral disc
      const t = Math.random();
      const r = 0.35 + Math.pow(t, 0.8) * 2.0;
      const th = t * 14 + (i % 4) * (Math.PI / 2) + gauss() * 0.15;
      const y = gauss() * 0.04 * r;
      a.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
    }
  }
  return a;
}

function ribbon(n) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = rand(-3.4, 3.4);
    const w = rand(-0.35, 0.35);
    const y = Math.sin(x * 1.25) * 0.55 + Math.sin(x * 0.4) * 0.3 + w * Math.cos(x * 0.8) * 0.4;
    const z = w + Math.cos(x * 1.25) * 0.3;
    a.set([x, y + gauss() * 0.015, z], i * 3);
  }
  return a;
}

function terrain(n) {
  const a = new Float32Array(n * 3);
  const side = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    const gx = (i % side) / side, gz = Math.floor(i / side) / side;
    const x = (gx - 0.5) * 7, z = (gz - 0.5) * 4.5;
    const y = Math.sin(x * 0.9) * 0.18 + Math.cos(z * 1.3 + x * 0.4) * 0.22;
    a.set([x, y, z], i * 3);
  }
  return a;
}

function textShape(n, text) {
  const W = 512, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = '600 200px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + 8);
  const data = ctx.getImageData(0, 0, W, H).data;
  const pts = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    if (!pts.length) break;
    const [px, py] = pts[Math.floor(Math.random() * pts.length)];
    a.set([(px / W - 0.5) * 4.4 + rand(-0.01, 0.01), -(py / H - 0.5) * 2.2 + rand(-0.01, 0.01), gauss() * 0.06], i * 3);
  }
  return a;
}

/* ---------- scene ---------- */
export function initScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const mobile = window.matchMedia('(max-width: 860px)').matches;
  const N = mobile ? 11000 : 26000;
  const pr = Math.min(window.devicePixelRatio, mobile ? 1.5 : 2);
  renderer.setPixelRatio(pr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  const geo = new THREE.BufferGeometry();
  const shapes = [globe(N), clusters(N), torusKnot(N), vortex(N), ribbon(N), terrain(N), textShape(N, 'SK')];
  shapes.forEach((s, i) => geo.setAttribute(`aP${i}`, new THREE.BufferAttribute(s, 3)));
  geo.setAttribute('position', new THREE.BufferAttribute(shapes[0], 3));
  const r = new Float32Array(N * 4); for (let i = 0; i < r.length; i++) r[i] = Math.random();
  geo.setAttribute('aRand', new THREE.BufferAttribute(r, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

  const uniforms = {
    uTime: { value: 0 },
    uShape: { value: 0 },
    uSize: { value: mobile ? 34 : 42 },
    uPR: { value: pr },
    uAlpha: { value: 0 },
    uMouse: { value: new THREE.Vector3(99, 99, 0) },
    uMouseStrength: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  // per-shape placement and tilt (the rotation that suits each form)
  const tilt = [
    { x: 0.2, z: 0 }, { x: 0.3, z: 0.2 }, { x: 0.5, z: 0 }, { x: 1.1, z: 0.15 }, { x: 0.15, z: 0 }, { x: 0.55, z: 0 }, { x: 0, z: 0 },
  ];

  // pointer → world (z=0)
  const ndc = new THREE.Vector2(9, 9), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  const mouseTarget = new THREE.Vector3(99, 99, 0);
  let pointerActive = 0;
  window.addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) mouseTarget.copy(hit);
    pointerActive = 1;
  });
  document.addEventListener('pointerleave', () => { pointerActive = 0; });

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 1 ? 11 : 8;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // how much each form spins (ribbon, terrain and initials stay readable)
  const SPIN = [1, 1, 1, 1, 0, 0.25, 0];
  const state = { rotY: 0, scrollVel: 0, rotX: tilt[0].x, rotZ: 0 };
  const t0 = performance.now();
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  renderer.setAnimationLoop(() => {
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    uniforms.uTime.value = t;
    state.scrollVel *= 0.92;

    const s = uniforms.uShape.value;
    const i0 = Math.floor(s), i1 = Math.min(SHAPES - 1, i0 + 1), f = s - i0;
    const tx = THREE.MathUtils.lerp(tilt[i0].x, tilt[i1].x, f);
    const tz = THREE.MathUtils.lerp(tilt[i0].z, tilt[i1].z, f);
    state.rotX += (tx + ndc.y * 0.08 * pointerActive - state.rotX) * 0.05;
    state.rotZ += (tz - state.rotZ) * 0.05;
    const spinF = THREE.MathUtils.lerp(SPIN[i0], SPIN[i1], f);
    state.rotY += (0.0012 + state.scrollVel * 0.00004) * spinF;
    // forms that should face the camera settle on the nearest full turn
    const home = Math.round(state.rotY / (Math.PI * 2)) * Math.PI * 2;
    state.rotY += (home - state.rotY) * 0.05 * (1 - spinF);
    points.rotation.set(state.rotX, state.rotY + ndc.x * 0.15 * pointerActive, state.rotZ);

    uniforms.uMouse.value.lerp(mouseTarget, 0.12);
    uniforms.uMouseStrength.value += (pointerActive - uniforms.uMouseStrength.value) * 0.05;
    renderer.render(scene, camera);
  });

  return {
    uniforms,
    group,
    nudge: (v) => { state.scrollVel += v; },
  };
}
