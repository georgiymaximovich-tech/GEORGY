// Процедурный 3D-раннер для видеоряда презентации.
// ?render — покадровый режим: window.__frame(dt) рисует кадр, window.__grab() отдаёт JPEG.
import * as THREE from 'three';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 720), H = +(Q.get('h') || 1280);
const RENDER = Q.has('render');

// ---------- детерминированный ГСЧ ----------
let seed = +(Q.get('seed') || 11);
const R = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = (a, b) => a + R() * (b - a), pick = a => a[Math.floor(R() * a.length)], chance = p => R() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = u => u * u * (3 - 2 * u);

// ---------- рендер ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);
const hud = document.createElement('canvas'); hud.width = W; hud.height = H; document.body.appendChild(hud);
const hx = hud.getContext('2d');
if (!RENDER) { const s = Math.min(innerWidth / W, innerHeight / H); for (const c of [renderer.domElement, hud]) { c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; } }

const scene = new THREE.Scene();
const FOG = new THREE.Color(0xcfe6fb);
scene.fog = new THREE.Fog(FOG, 70, 230);
const camera = new THREE.PerspectiveCamera(66, W / H, 0.1, 1200);

// ---------- «изогнутый мир»: вершинный изгиб в мировых координатах ----------
const U = { uBend: { value: 0.0021 }, uCurve: { value: 0 } };
const BEND = '{float dB=min(wp.z,0.0);wp.y-=dB*dB*uBend;wp.x+=dB*dB*uCurve;}';
function patch(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uBend = U.uBend; sh.uniforms.uCurve = U.uCurve;
    sh.vertexShader = 'uniform float uBend;uniform float uCurve;\n' + sh.vertexShader
      .replace('#include <project_vertex>', `vec4 mvPosition=vec4(transformed,1.0);
#ifdef USE_BATCHING
mvPosition=batchingMatrix*mvPosition;
#endif
#ifdef USE_INSTANCING
mvPosition=instanceMatrix*mvPosition;
#endif
{vec4 wp=modelMatrix*mvPosition;${BEND}mvPosition=viewMatrix*wp;}
gl_Position=projectionMatrix*mvPosition;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
{vec4 wp=worldPosition;${BEND}worldPosition=wp;}
#endif`);
  };
  m.customProgramCacheKey = () => 'bend';
  return m;
}
const depthMat = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
const MC = {};
function M(color, o = {}) { const k = color + JSON.stringify(o); return MC[k] || (MC[k] = patch(new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, ...o }))); }
function mesh(geo, mat, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; if (cast) m.customDepthMaterial = depthMat; return m; }
function tex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
const box = (w, h, d, sz = 1) => new THREE.BoxGeometry(w, h, d, 1, 1, Math.max(1, Math.ceil(d / sz)));

// ---------- свет и небо ----------
scene.add(new THREE.HemisphereLight(0xd6ecff, 0x8f8272, 1.55));
const sun = new THREE.DirectionalLight(0xfff0d8, 3.3);
sun.position.set(-9, 21, -4); sun.target.position.set(0, 0, -16);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 30, bottom: -30, near: 1, far: 90 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `varying vec3 vP;void main(){float h=vP.y;vec3 top=vec3(.16,.50,.93);vec3 hor=vec3(.81,.90,.98);
  vec3 c=mix(hor,top,pow(clamp(h+.05,0.,1.),.6));vec3 sd=normalize(vec3(-.35,.32,-1.));float s=max(dot(vP,sd),0.);
  c+=vec3(1.,.92,.75)*pow(s,400.)*2.+vec3(1.,.86,.62)*pow(s,10.)*.22;gl_FragColor=vec4(c,1.);}`
}));
sky.renderOrder = -1; scene.add(sky);
const cloudTex = tex(256, 128, (g, w, h) => {
  for (let i = 0; i < 14; i++) { const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 22 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
});
const clouds = [];
for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: .9 }));
  s.scale.set(rnd(120, 200), rnd(50, 80), 1); s.position.set(rnd(-400, 400), rnd(110, 260), rnd(-700, -500)); scene.add(s); clouds.push(s); }

// ---------- земля, шпалы, рельсы ----------
const LW = 2.5, LEN = 460, Z0 = 25;
const gravel = tex(256, 256, (g, w, h) => { g.fillStyle = '#8e7d6b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { const v = 90 + Math.random() * 90 | 0; g.fillStyle = `rgb(${v + 20},${v + 8},${v - 8})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); } }, true);
gravel.repeat.set(12, LEN / 5);
const ground = mesh(new THREE.PlaneGeometry(60, LEN, 1, 240), patch(new THREE.MeshStandardMaterial({ map: gravel, roughness: 1 })), false, true);
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, Z0 - LEN / 2); scene.add(ground);
const ballast = patch(new THREE.MeshStandardMaterial({ map: gravel, color: 0x7d7064, roughness: 1 }));
for (const l of [-1, 0, 1]) { const b = mesh(new THREE.PlaneGeometry(2.6, LEN, 1, 240), ballast, false, true); b.rotation.x = -Math.PI / 2; b.position.set(l * LW, .03, Z0 - LEN / 2); scene.add(b); }
const railMat = M(0xd4d9e0, { metalness: .85, roughness: .32 }), railBase = M(0x5b5048, { roughness: .8 });
for (const l of [-1, 0, 1]) for (const r of [-.72, .72]) {
  const a = mesh(box(.1, .14, LEN, 2), railMat, false, true); a.position.set(l * LW + r, .26, Z0 - LEN / 2); scene.add(a);
  const b = mesh(box(.2, .06, LEN, 2), railBase, false, true); b.position.set(l * LW + r, .17, Z0 - LEN / 2); scene.add(b); }
const SLN = 240, SP = 1.05;
const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.1, .14, .32), M(0x5a3d2b, { roughness: .9 }), SLN * 3);
sleepers.receiveShadow = true; sleepers.customDepthMaterial = depthMat; scene.add(sleepers);
const tmpM = new THREE.Matrix4();

// ---------- текстуры ----------
function graffiti() {
  return tex(512, 128, (g, w, h) => {
    g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(80,70,60,${Math.random() * .08})`; g.fillRect(Math.random() * w, 0, 4 + Math.random() * 20, h); }
    const cols = ['#ff3d7f', '#ffd23f', '#3ddcff', '#7cff6b', '#b46bff', '#ff7a2f', '#2f7bff'];
    const n = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const cx = 80 + Math.random() * 350, cy = 64, c1 = cols[Math.floor(Math.random() * cols.length)], c2 = cols[Math.floor(Math.random() * cols.length)];
      const blobs = []; for (let i = 0; i < 5 + Math.random() * 4; i++) blobs.push([cx - 90 + i * 26 + Math.random() * 10, cy + (Math.random() - .5) * 26, 20 + Math.random() * 16]);
      g.fillStyle = '#1b1b22'; for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r + 7, 0, 7); g.fill(); }
      for (const [x, y, r] of blobs) { const gr = g.createLinearGradient(0, y - r, 0, y + r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.7)'; for (const [x, y, r] of blobs) { g.beginPath(); g.ellipse(x - r * .35, y - r * .45, r * .28, r * .14, -.5, 0, 7); g.fill(); }
      g.strokeStyle = c2; g.lineWidth = 4; for (let i = 0; i < 4; i++) { const x = cx - 60 + Math.random() * 120; g.beginPath(); g.moveTo(x, cy + 20); g.lineTo(x, cy + 30 + Math.random() * 30); g.stroke(); }
    }
  });
}
const GRAF = Array.from({ length: 8 }, graffiti);
const BCOL = ['#e9a66b', '#d9776b', '#8fb5d9', '#e8d19a', '#9fcf9f', '#c9a3d9', '#f0e6d8', '#7fa7c9'];
const winTex = {};
function windows(col) {
  return winTex[col] || (winTex[col] = tex(128, 128, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 120, w, 8);
    for (const x of [14, 70]) { const gr = g.createLinearGradient(0, 30, 0, 90); gr.addColorStop(0, '#9fc4e6'); gr.addColorStop(1, '#34506e');
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 3, 27, 50, 66); g.fillStyle = gr; g.fillRect(x, 30, 44, 60);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 4, 34, 8, 52); g.fillStyle = '#f4efe6'; g.fillRect(x - 3, 88, 50, 6); }
  }, true));
}
const TRAINS = [['#2a6fe3', '#ffd23f'], ['#d8453b', '#f4f4f4'], ['#23a877', '#f6e7b8'], ['#f29a2e', '#23488f'], ['#6c5ce7', '#ffe08a']];
const trainSide = TRAINS.map(([a, b]) => tex(256, 256, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h);
  g.fillStyle = b; g.fillRect(0, 150, w, 26);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 230, w, 26);
  const gr = g.createLinearGradient(0, 40, 0, 120); gr.addColorStop(0, '#bfe0ff'); gr.addColorStop(.5, '#3d6a99'); gr.addColorStop(1, '#1d3350');
  g.fillStyle = '#1a1f2b'; g.fillRect(16, 36, 150, 88); g.fillStyle = gr; g.fillRect(20, 40, 142, 80);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(40, 40); g.lineTo(70, 40); g.lineTo(40, 120); g.lineTo(20, 120); g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(190, 30, 50, 200); g.fillStyle = gr; g.fillRect(196, 40, 38, 90);
}, true));
const trainFront = TRAINS.map(([a, b]) => tex(256, 256, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h);
  g.fillStyle = '#141a26'; g.beginPath(); g.roundRect(24, 22, 208, 104, 18); g.fill();
  const gr = g.createLinearGradient(0, 26, 0, 122); gr.addColorStop(0, '#cde7ff'); gr.addColorStop(.45, '#4b7fb3'); gr.addColorStop(1, '#182a44');
  g.fillStyle = gr; g.beginPath(); g.roundRect(30, 28, 196, 92, 14); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(60, 28); g.lineTo(100, 28); g.lineTo(60, 120); g.lineTo(30, 120); g.fill();
  g.fillStyle = b; g.fillRect(0, 150, w, 26);
  for (const x of [52, 204]) { const lg = g.createRadialGradient(x, 200, 2, x, 200, 22); lg.addColorStop(0, '#fffbe0'); lg.addColorStop(.5, '#ffe27a'); lg.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = '#20232b'; g.beginPath(); g.arc(x, 200, 17, 0, 7); g.fill(); g.fillStyle = lg; g.beginPath(); g.arc(x, 200, 22, 0, 7); g.fill(); }
  g.fillStyle = '#20232b'; g.fillRect(100, 188, 56, 24); g.fillStyle = '#e8e8e8'; g.fillRect(104, 192, 48, 16);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 232, w, 24);
}));
const stripes = (c1, c2) => tex(256, 64, (g, w, h) => { g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2;
  for (let x = -64; x < w + 64; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 64 - 32 + 32, h); g.lineTo(x + 32, h); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; g.strokeRect(0, 0, w, h); });
const redWhite = stripes('#f4f4f4', '#e0302b'), yelBlack = stripes('#ffcf2e', '#1f1f1f');

// ---------- объекты мира ----------
const items = []; // {s0,s1,obj}
function place(obj, s0, s1) { obj.userData.s0 = s0; obj.userData.s1 = s1; scene.add(obj); items.push(obj); return obj; }

function makeTrain(lane, len, pal) {
  const g = new THREE.Group(), [a] = TRAINS[pal];
  const side = trainSide[pal].clone(); side.needsUpdate = true; side.repeat.set(len / 5, 1);
  const sideM = patch(new THREE.MeshStandardMaterial({ map: side, roughness: .5, metalness: .1 }));
  const frontM = patch(new THREE.MeshStandardMaterial({ map: trainFront[pal], roughness: .45, metalness: .1, emissive: 0x332200, emissiveIntensity: .25 }));
  const roofM = M(new THREE.Color(a).lerp(new THREE.Color(0xdddddd), .55).getHex(), { roughness: .6 });
  const body = mesh(box(2.2, 2.7, len, 2), [sideM, sideM, roofM, roofM, frontM, frontM]);
  body.position.set(0, 2.05, -len / 2); g.add(body);
  const skirt = mesh(box(1.9, .55, len - .6, 2), M(0x2b2d33)); skirt.position.set(0, .55, -len / 2); g.add(skirt);
  for (let z = 1.6; z < len - 1; z += Math.max(4, (len - 3) / 2)) for (const x of [-.8, .8]) { const w = mesh(new THREE.CylinderGeometry(.34, .34, .18, 16), M(0x3a3d44, { metalness: .6, roughness: .4 })); w.rotation.z = Math.PI / 2; w.position.set(x, .4, -z); g.add(w); }
  const roofBox = mesh(box(1.4, .28, len * .5, 2), M(0x9aa0a8, { metalness: .4, roughness: .5 })); roofBox.position.set(0, 3.5, -len * .5); g.add(roofBox);
  const bump = mesh(new THREE.BoxGeometry(2.25, .22, .25), M(0x2b2d33)); bump.position.set(0, .95, 0); g.add(bump);
  g.position.x = lane * LW; return g;
}
function makeBarrier(lane) {
  const g = new THREE.Group(), m = patch(new THREE.MeshStandardMaterial({ map: redWhite, roughness: .6 }));
  const bd = mesh(new THREE.BoxGeometry(2.2, .5, .14), m); bd.position.set(0, .95, 0); g.add(bd);
  for (const x of [-.9, .9]) { const p = mesh(new THREE.BoxGeometry(.12, 1.05, .12), M(0x6b6f76, { metalness: .5 })); p.position.set(x, .52, 0); g.add(p);
    const f = mesh(new THREE.BoxGeometry(.12, .08, .6), M(0x6b6f76, { metalness: .5 })); f.position.set(x, .04, 0); g.add(f); }
  g.position.x = lane * LW; return g;
}
function makeOverhead(lane) {
  const g = new THREE.Group(), m = patch(new THREE.MeshStandardMaterial({ map: yelBlack, roughness: .6 }));
  const bd = mesh(new THREE.BoxGeometry(2.3, .6, .18), m); bd.position.set(0, 1.9, 0); g.add(bd);
  for (const x of [-1.08, 1.08]) { const p = mesh(new THREE.BoxGeometry(.14, 2.4, .14), M(0x3f434a, { metalness: .5 })); p.position.set(x, 1.2, 0); g.add(p); }
  const lamp = mesh(new THREE.SphereGeometry(.1, 10, 8), M(0xff4040, { emissive: 0xff2020, emissiveIntensity: 2 }), false, false); lamp.position.set(0, 2.3, 0); g.add(lamp);
  g.position.x = lane * LW; return g;
}
const coinGeo = new THREE.CylinderGeometry(.36, .36, .09, 28), rimGeo = new THREE.TorusGeometry(.3, .045, 8, 28);
const coinMat = M(0xffc62e, { metalness: .55, roughness: .28, emissive: 0x6a4300, emissiveIntensity: .7 }), rimMat = M(0xffe27a, { metalness: .6, roughness: .25, emissive: 0x7a5400, emissiveIntensity: .6 });
function makeCoin(x, y) { const g = new THREE.Group(); const c = mesh(coinGeo, coinMat, true, false); c.rotation.x = Math.PI / 2; g.add(c);
  const r = mesh(rimGeo, rimMat, false, false); r.position.z = .05; g.add(r); g.position.set(x, y, 0); g.userData.coin = true; return g; }

// ---------- маршрут бегуна (задаётся заранее, препятствия ставятся вокруг него) ----------
const T = 9;                      // длина перестроения
const segs = [];                  // {s0,s1,lane}
const acts = [];                  // {a,b,type:'jump'|'roll'}
let segEnd = 0, lastLane = 0, contentIdx = 0;
function addSeg() {
  const s0 = segEnd, len = rnd(38, 64);
  let lane = lastLane;
  if (segs.length) { const opts = [lastLane - 1, lastLane + 1].filter(l => l >= -1 && l <= 1); lane = chance(.85) ? pick(opts) : lastLane; }
  segs.push({ s0, s1: s0 + len, lane }); segEnd = s0 + len; lastLane = lane;
}
function segIndex(s) { let lo = 0, hi = segs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].s0 <= s) lo = m; else hi = m - 1; } return lo; }
function pathX(s) { const i = segIndex(s), g = segs[i], n = segs[i + 1];
  if (n && s > g.s1 - T) { const u = smooth(clamp((s - (g.s1 - T)) / T, 0, 1)); return (g.lane + (n.lane - g.lane) * u) * LW; } return g.lane * LW; }
function actAt(s) { for (const a of acts) if (s >= a.a && s <= a.b) return a; return null; }
function yAt(s) { const a = actAt(s); if (!a || a.type !== 'jump') return 0; const u = (s - a.a) / (a.b - a.a); return 2.1 * 4 * u * (1 - u); }

function fillSeg(i) {
  const g = segs[i], n = segs[i + 1];
  const a = g.s0 + 5, b = g.s1 - T - 6;
  for (const l of [-1, 0, 1]) {
    if (l === g.lane) continue;
    const r = R();
    if (r < .72) {                 // составы
      let p = a + rnd(0, 6);
      while (p + 11 < b) { const len = Math.min(rnd(13, 28), b - p); if (len < 11) break;
        place(makeTrain(l, len, Math.floor(R() * TRAINS.length)), p, p + len); p += len + (chance(.45) ? rnd(.8, 1.4) : rnd(8, 18)); }
    } else if (r < .9) {           // ограждения на соседнем пути
      for (let p = a + rnd(2, 8); p < b; p += rnd(14, 24)) place(chance(.5) ? makeBarrier(l) : makeOverhead(l), p, p + .3);
    }
  }
  // безопасный путь: монеты, прыжки, подкаты
  let c = a + 3;
  while (c < b - 8) {
    const t = R();
    if (t < .36 && c + 12 < b) {   // прыжок через барьер
      const s = c + 6; place(makeBarrier(g.lane), s, s + .3); acts.push({ a: s - 4.6, b: s + 4.6, type: 'jump' });
      for (let k = -4; k <= 4; k++) { const cs = s + k * 1.15; coinsQ.push([cs, g.lane * LW, 1.0 + yAt(cs)]); }
      c = s + rnd(10, 16);
    } else if (t < .6 && c + 10 < b) { // подкат
      const s = c + 6; place(makeOverhead(g.lane), s, s + .3); acts.push({ a: s - 4.2, b: s + 2.6, type: 'roll' });
      for (let k = -3; k <= 3; k++) coinsQ.push([s + k * 1.3, g.lane * LW, .55]);
      c = s + rnd(10, 16);
    } else {                        // дорожка монет
      const nC = 6 + Math.floor(R() * 5); for (let k = 0; k < nC; k++) { const cs = c + k * 1.7; if (cs > b) break; coinsQ.push([cs, g.lane * LW, 1.0]); }
      c += nC * 1.7 + rnd(6, 12);
    }
  }
  // монеты вдоль перестроения
  if (n) for (let s = g.s1 - T - 2; s < g.s1 + 3; s += 1.6) coinsQ.push([s, 'path', 1.0]);
}
const coinsQ = [];
function flushCoins() {
  while (coinsQ.length) { const [s, x, y] = coinsQ.shift(); const px = x === 'path' ? pathX(s) : x; place(makeCoin(px, y), s, s); }
}

// ---------- декорации по сторонам ----------
const scen = { wallL: -10, wallR: -10, bL: -20, bR: -20, lamp: 8, gantry: 40, bridge: 160 };
function addWall(side) {
  const k = side < 0 ? 'wallL' : 'wallR', s0 = scen[k], len = rnd(10, 16), g = new THREE.Group();
  const gm = patch(new THREE.MeshStandardMaterial({ map: pick(GRAF), roughness: .9 }));
  const w = mesh(box(.5, 2.6, len, 2), [gm, gm, M(0xa39d92), M(0xa39d92), M(0xb0aa9f), M(0xb0aa9f)]); w.position.set(0, 1.3, -len / 2); g.add(w);
  const p = mesh(new THREE.BoxGeometry(.8, 3.0, .8), M(0x9c968c)); p.position.set(0, 1.5, 0); g.add(p);
  g.position.x = side * 5.2; place(g, s0, s0 + len); scen[k] = s0 + len;
}
function addBuilding(side) {
  const k = side < 0 ? 'bL' : 'bR', s0 = scen[k], w = rnd(9, 20), d = rnd(9, 14), h = rnd(7, 24), col = pick(BCOL), g = new THREE.Group();
  const t = windows(col).clone(); t.needsUpdate = true; t.repeat.set(w / 4.2, h / 4.2);
  const wm = patch(new THREE.MeshStandardMaterial({ map: t, roughness: .85 })), rm = M(new THREE.Color(col).multiplyScalar(.7).getHex());
  const b = mesh(box(d, h, w, 3), [wm, wm, rm, rm, wm, wm], false, true); b.position.set(0, h / 2, -w / 2); g.add(b);
  const cor = mesh(box(d + .3, .5, w + .3, 3), M(0xe9e4dc)); cor.position.set(0, h + .25, -w / 2); g.add(cor);
  for (let i = 0; i < 2; i++) if (chance(.6)) { const ac = mesh(new THREE.BoxGeometry(rnd(1, 2.2), rnd(.8, 1.4), rnd(1, 2)), M(0xbfc3c9, { metalness: .3 })); ac.position.set(rnd(-d / 3, d / 3), h + .9, -rnd(2, w - 2)); g.add(ac); }
  if (chance(.25)) { const tw = new THREE.Group(); const cy = mesh(new THREE.CylinderGeometry(1.1, 1.1, 2, 14), M(0x8a5a3c)); cy.position.y = 2.6; tw.add(cy);
    const cn = mesh(new THREE.ConeGeometry(1.25, .9, 14), M(0x6b4430)); cn.position.y = 4; tw.add(cn);
    for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) { const l = mesh(new THREE.BoxGeometry(.12, 1.6, .12), M(0x4a4a4a)); l.position.set(x, .8, z); tw.add(l); }
    tw.position.set(rnd(-d / 4, d / 4), h + .5, -w / 2); g.add(tw); }
  g.position.x = side * (6.2 + d / 2); place(g, s0, s0 + w); scen[k] = s0 + w + rnd(.3, 2.5);
}
function addLamp() {
  const s0 = scen.lamp, side = Math.round(s0 / 26) % 2 ? 1 : -1, g = new THREE.Group(), m = M(0x3a3f47, { metalness: .6, roughness: .4 });
  const p = mesh(new THREE.CylinderGeometry(.09, .12, 6, 10), m); p.position.y = 3; g.add(p);
  const arm = mesh(new THREE.BoxGeometry(1.4, .1, .1), m); arm.position.set(-side * .7, 5.95, 0); g.add(arm);
  const hd = mesh(new THREE.BoxGeometry(.5, .16, .28), M(0xfff4cc, { emissive: 0xffe9a6, emissiveIntensity: 1.2 })); hd.position.set(-side * 1.35, 5.85, 0); g.add(hd);
  g.position.x = side * 4.3; place(g, s0, s0); scen.lamp += 26;
}
function addGantry() {
  const s0 = scen.gantry, g = new THREE.Group(), m = M(0x59616c, { metalness: .6, roughness: .45 });
  for (const x of [-4.4, 4.4]) { const p = mesh(new THREE.BoxGeometry(.35, 7, .35), m); p.position.set(x, 3.5, 0); g.add(p); }
  for (const y of [6.6, 7.4]) { const bm = mesh(new THREE.BoxGeometry(9.2, .22, .3), m); bm.position.set(0, y, 0); g.add(bm); }
  for (let x = -4; x <= 4; x += 1) { const d = mesh(new THREE.BoxGeometry(.08, .9, .08), m); d.position.set(x, 7, 0); d.rotation.z = (x % 2 ? .6 : -.6); g.add(d); }
  for (const l of [-1, 0, 1]) { const sb = mesh(new THREE.BoxGeometry(.5, .9, .35), M(0x22252b)); sb.position.set(l * LW, 6.05, .1); g.add(sb);
    const c = pick([0xff3030, 0x30ff6a, 0xffc830]); const li = mesh(new THREE.SphereGeometry(.12, 10, 8), M(c, { emissive: c, emissiveIntensity: 2.5 }), false, false); li.position.set(l * LW, 6.2, .3); g.add(li); }
  place(g, s0, s0); scen.gantry += rnd(60, 95);
}
function addBridge() {
  const s0 = scen.bridge, g = new THREE.Group(), d = 7;
  const deck = mesh(box(40, 1.6, d, 2), M(0xa7a097)); deck.position.set(0, 8.6, -d / 2); g.add(deck);
  const band = mesh(box(40.2, .4, d + .2, 2), M(0xc8553d)); band.position.set(0, 7.9, -d / 2); g.add(band);
  for (const z of [-.2, -d + .2]) { const rl = mesh(new THREE.BoxGeometry(40, .9, .12), M(0x5d646e, { metalness: .5 })); rl.position.set(0, 9.9, z); g.add(rl); }
  for (const x of [-6.3, 6.3]) { const p = mesh(box(1.2, 8, d - 1, 2), M(0x9b948a)); p.position.set(x, 4, -d / 2); g.add(p); }
  place(g, s0, s0 + d); scen.bridge += rnd(170, 260);
}

// ---------- персонаж ----------
const P = {};
function limb(r, len, mat) { const g = new THREE.Group(); const m = mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat); m.position.y = -(len / 2 + r * .6); g.add(m); return g; }
(function buildRunner() {
  const hood = M(0xff7a1a, { roughness: .85 }), jeans = M(0x2c4f9e, { roughness: .9 }), skin = M(0xc98b62, { roughness: .7 }),
    cap = M(0xe53935, { roughness: .6 }), shoe = M(0xf6f6f6, { roughness: .6 }), sole = M(0xe53935), bag = M(0x1fb572, { roughness: .7 });
  const root = new THREE.Group(); scene.add(root); P.root = root;
  const hips = new THREE.Group(); hips.position.y = .98; root.add(hips); P.hips = hips;
  const torso = new THREE.Group(); hips.add(torso); P.torso = torso;
  const body = mesh(new THREE.CapsuleGeometry(.25, .3, 6, 14), hood); body.scale.set(1.18, 1, .82); body.position.y = .36; torso.add(body);
  const pelvis = mesh(new THREE.CapsuleGeometry(.2, .08, 6, 12), jeans); pelvis.scale.set(1.2, 1, .85); pelvis.position.y = .05; torso.add(pelvis);
  const bp = mesh(new THREE.BoxGeometry(.42, .46, .2), bag); bp.position.set(0, .4, .24); torso.add(bp);
  const bpp = mesh(new THREE.BoxGeometry(.3, .2, .08), M(0x178a57)); bpp.position.set(0, .3, .36); torso.add(bpp);
  const hoodie = mesh(new THREE.TorusGeometry(.14, .06, 8, 16), hood); hoodie.position.set(0, .66, .1); hoodie.rotation.x = 1.2; torso.add(hoodie);
  const head = new THREE.Group(); head.position.y = .86; torso.add(head); P.head = head;
  head.add(mesh(new THREE.SphereGeometry(.2, 20, 16), skin));
  const hair = mesh(new THREE.SphereGeometry(.205, 20, 16, 0, Math.PI * 2, 0, Math.PI * .55), M(0x3a2418)); hair.rotation.x = .25; head.add(hair);
  const c = mesh(new THREE.SphereGeometry(.215, 20, 12, 0, Math.PI * 2, 0, Math.PI * .42), cap); c.position.y = .02; head.add(c);
  const brim = mesh(new THREE.BoxGeometry(.3, .035, .2), cap); brim.position.set(0, .09, .22); brim.rotation.x = -.15; head.add(brim);
  for (const x of [-.2, .2]) { const e = mesh(new THREE.SphereGeometry(.05, 8, 8), skin); e.position.set(x, -.01, 0); head.add(e); }
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * .33, .58, 0); torso.add(sh);
    const up = limb(.075, .2, hood); sh.add(up);
    const el = new THREE.Group(); el.position.y = -.33; up.add(el);
    const fo = limb(.068, .17, hood); el.add(fo);
    const hand = mesh(new THREE.SphereGeometry(.075, 10, 8), skin); hand.position.y = -.3; fo.add(hand);
    P[s < 0 ? 'shL' : 'shR'] = sh; P[s < 0 ? 'elL' : 'elR'] = el;
    const hp = new THREE.Group(); hp.position.set(s * .13, 0, 0); hips.add(hp);
    const th = limb(.1, .3, jeans); hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -.45; th.add(kn);
    const sn = limb(.088, .28, jeans); kn.add(sn);
    const an = new THREE.Group(); an.position.y = -.44; sn.add(an);
    const sb = mesh(new THREE.BoxGeometry(.19, .13, .34), shoe); sb.position.set(0, -.02, -.06); an.add(sb);
    const so = mesh(new THREE.BoxGeometry(.2, .05, .36), sole); so.position.set(0, -.09, -.06); an.add(so);
    P[s < 0 ? 'hpL' : 'hpR'] = hp; P[s < 0 ? 'knL' : 'knR'] = kn; P[s < 0 ? 'anL' : 'anR'] = an;
  }
})();
function poseRunner(D) {
  const ph = D / 2.5 * Math.PI * 2, act = actAt(D);
  const x = pathX(D), vx = (pathX(D + .8) - pathX(D - .8)) / 1.6;
  let y = yAt(D), jump = 0, roll = 0, ru = 0;
  if (act) { const u = (D - act.a) / (act.b - act.a); if (act.type === 'jump') jump = Math.sin(Math.PI * u); else { roll = Math.sin(Math.PI * clamp(u * 1.15, 0, 1)); ru = smooth(clamp((u - .12) / .7, 0, 1)); } }
  const run = 1 - Math.max(jump, roll);
  P.root.position.set(x, y, 0);
  P.root.rotation.set(0, -vx * .35, -vx * .45);
  P.hips.rotation.x = -ru * Math.PI * 2;
  P.hips.position.y = .98 + run * .07 * Math.abs(Math.cos(ph)) - roll * .42;
  P.torso.rotation.set(-.22 * run - .35 * jump - 1.1 * roll, Math.sin(ph) * .16 * run, 0);
  P.head.rotation.x = .12 * run + .3 * jump + .8 * roll;
  for (const [s, off] of [['L', 0], ['R', Math.PI]]) {
    const p = ph + off, sg = s === 'L' ? -1 : 1;
    P['hp' + s].rotation.x = run * Math.sin(p) * .95 + jump * (s === 'L' ? 1.2 : .3) + roll * 1.9;
    P['kn' + s].rotation.x = -(run * (.25 + 1.45 * Math.max(0, Math.cos(p))) + jump * (s === 'L' ? 1.9 : 1.1) + roll * 2.3);
    P['an' + s].rotation.x = run * .3 * Math.sin(p + 1);
    P['sh' + s].rotation.set(-run * Math.sin(p) * .9 - jump * 2.4 + roll * .9, 0, sg * (.12 + jump * .5));
    P['el' + s].rotation.x = run * (1.25 + .3 * Math.sin(p)) + jump * .3 + roll * 1.6;
  }
}

// ---------- частицы монет ----------
const sparkTex = tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(.3, 'rgba(255,220,90,.9)'); gr.addColorStop(1, 'rgba(255,180,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const sparks = [];
for (let i = 0; i < 80; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.visible = false; scene.add(s); sparks.push({ s, life: 0, v: new THREE.Vector3() }); }
function burst(p) { let n = 4; for (const k of sparks) { if (k.life > 0) continue; k.life = .35; k.s.visible = true; k.s.position.copy(p); k.v.set(Math.random() * 1.6 - .8, 2 + Math.random() * 2, Math.random() * 1.2); if (--n === 0) break; } }

// ---------- состояние ----------
let D = 0, time = 0, coins = 0, score = 0, camX = 0, speed = 19;
for (let i = 0; i < 4; i++) addSeg();
segs[0].lane = 0;
function generate() {
  while (segEnd < D + 280) addSeg();
  while (contentIdx < segs.length - 1 && segs[contentIdx].s0 < D + 240) { if (contentIdx > 0) fillSeg(contentIdx); else fillSeg(0); contentIdx++; flushCoins(); }
  while (scen.wallL < D + 260) addWall(-1); while (scen.wallR < D + 260) addWall(1);
  while (scen.bL < D + 300) addBuilding(-1); while (scen.bR < D + 300) addBuilding(1);
  while (scen.lamp < D + 260) addLamp(); while (scen.gantry < D + 260) addGantry(); while (scen.bridge < D + 300) addBridge();
}
const tmpV = new THREE.Vector3();
function step(dt) {
  time += dt; speed = Math.min(23, 19 + time * .03); D += speed * dt; score += speed * dt * 9;
  generate();
  for (let i = items.length - 1; i >= 0; i--) {
    const o = items[i], u = o.userData;
    if (u.s1 < D - 28) { scene.remove(o); items.splice(i, 1); continue; }
    o.position.z = D - u.s0;
    if (u.coin) { o.rotation.y = time * 3.2 + u.s0; if (!u.got && D >= u.s0 - .2) { u.got = true; coins++; score += 50; o.visible = false; o.getWorldPosition(tmpV); tmpV.y += 0; burst(new THREE.Vector3(o.position.x, o.position.y, 0)); } }
  }
  // шпалы
  const fr = (D % SP);
  for (let k = 0; k < SLN; k++) { const z = Z0 - k * SP + fr; for (let l = 0; l < 3; l++) { tmpM.makeTranslation((l - 1) * LW, .12, z); sleepers.setMatrixAt(k * 3 + l, tmpM); } }
  sleepers.instanceMatrix.needsUpdate = true;
  gravel.offset.y = (D / 5) % 1;
  U.uCurve.value = Math.sin(time * .07) * .0011;
  for (const k of sparks) if (k.life > 0) { k.life -= dt; k.v.y -= 9 * dt; k.s.position.addScaledVector(k.v, dt); const sc = .32 * Math.max(0, k.life / .35); k.s.scale.set(sc, sc, 1); k.s.material.opacity = Math.min(.8, k.life * 3); if (k.life <= 0) k.s.visible = false; }
  for (const c of clouds) { c.position.x += dt * 2; if (c.position.x > 450) c.position.x = -450; }
  poseRunner(D);
  // камера
  const px = P.root.position.x, py = P.root.position.y;
  camX += (px * .8 - camX) * Math.min(1, dt * 5);
  camera.position.set(camX, 4.6 + py * .35 + Math.sin(time * 9) * .03, 7.4);
  camera.lookAt(camX * .9, 1.2 + py * .25, -12);
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
  drawHud();
}
function pill(x, y, w, h) { hx.fillStyle = 'rgba(12,20,40,.55)'; hx.beginPath(); hx.roundRect(x, y, w, h, h / 2); hx.fill(); hx.strokeStyle = 'rgba(255,255,255,.25)'; hx.lineWidth = 2; hx.stroke(); }
function drawHud() {
  hx.clearRect(0, 0, W, H);
  const v = hx.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, H * .8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); hx.fillStyle = v; hx.fillRect(0, 0, W, H);
  const k = W / 720; hx.save(); hx.scale(k, k);
  hx.font = '900 44px "DejaVu Sans", Arial, sans-serif'; hx.textAlign = 'right'; hx.textBaseline = 'middle';
  pill(430, 28, 262, 70); hx.lineWidth = 7; hx.strokeStyle = '#0d1b33'; hx.fillStyle = '#fff';
  const sc = String(Math.floor(score)).padStart(7, '0'); hx.strokeText(sc, 670, 64); hx.fillText(sc, 670, 64);
  pill(500, 110, 192, 62);
  const g = hx.createRadialGradient(535, 136, 2, 540, 141, 22); g.addColorStop(0, '#fff3b0'); g.addColorStop(.5, '#ffc62e'); g.addColorStop(1, '#c98a00');
  hx.fillStyle = g; hx.beginPath(); hx.arc(540, 141, 21, 0, 7); hx.fill(); hx.strokeStyle = '#8a5a00'; hx.lineWidth = 3; hx.stroke();
  hx.font = '900 38px "DejaVu Sans", Arial, sans-serif'; hx.lineWidth = 7; hx.strokeStyle = '#0d1b33'; hx.fillStyle = '#ffd84a';
  hx.strokeText(coins, 670, 142); hx.fillText(coins, 670, 142);
  pill(28, 28, 118, 62); hx.textAlign = 'center'; hx.font = '900 34px "DejaVu Sans", Arial, sans-serif'; hx.fillStyle = '#7dff7a'; hx.strokeStyle = '#0d1b33';
  hx.strokeText('x2', 87, 60); hx.fillText('x2', 87, 60);
  hx.restore();
}

// ---------- запуск ----------
const cap = document.createElement('canvas'); cap.width = W; cap.height = H; const cx = cap.getContext('2d');
window.__frame = (dt, sub = 1) => {
  cx.globalAlpha = 1;
  for (let i = 0; i < sub; i++) { step(dt / sub); cx.globalAlpha = 1 / (i + 1); cx.drawImage(renderer.domElement, 0, 0); }
  cx.globalAlpha = 1; cx.drawImage(hud, 0, 0);
};
window.__grab = (q = .92) => cap.toDataURL('image/jpeg', q).split(',')[1];
window.__ready = true;
if (!RENDER) { let last = performance.now(); const loop = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; step(dt); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
