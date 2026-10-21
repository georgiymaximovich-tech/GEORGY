// «Залипательные» 3D-сцены для видеоряда презентации о Нюрнбергском процессе.
// ?scene=press|sand|tiles|wave  — какая сцена;  ?render — покадровый режим:
// window.__frame(dt, sub) рисует кадр (sub подкадров = размытие движения), window.__grab() отдаёт JPEG.
import * as THREE from 'three';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 720), H = +(Q.get('h') || 1280);
const RENDER = Q.has('render');
const SCENE = Q.get('scene') || 'press';

// ---------- детерминированный ГСЧ и мелкие помощники ----------
let seed = +(Q.get('seed') || 7);
const R = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = (a, b) => a + R() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const easeIn = u => { u = clamp(u, 0, 1); return u * u * u; };
const easeOut = u => { u = clamp(u, 0, 1); return 1 - (1 - u) ** 3; };
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const col = h => new THREE.Color(h);

// ---------- рендер ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
if (!RENDER) { const s = Math.min(innerWidth / W, innerHeight / H); renderer.domElement.style.width = W * s + 'px'; renderer.domElement.style.height = H * s + 'px'; }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);

// Студийное окружение для отражений: тёмная комната с тремя софтбоксами.
function studioEnv(tint = 0x2a2f3a) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: tint, side: THREE.BackSide }));
  env.add(room);
  const box = (w, h, x, y, z, ry, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); m.rotateZ(ry); env.add(m); };
  box(14, 4, 0, 9.5, 0, 0, 0xffffff);
  box(5, 10, -16, 3, 6, 0, 0xfff2e0);
  box(4, 10, 15, 3, -8, 0, 0xdde8ff);
  const pm = new THREE.PMREMGenerator(renderer);
  return pm.fromScene(env, 0.04).texture;
}
function gradientBg(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function keyLight(color, intensity, pos, size = 6, mapSize = 2048) {
  const l = new THREE.DirectionalLight(color, intensity); l.position.set(...pos); l.castShadow = true;
  l.shadow.mapSize.set(mapSize, mapSize); const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.5; c.far = 40;
  l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; l.shadow.radius = 4; scene.add(l); scene.add(l.target); return l;
}

// =====================================================================
// 1. PRESS — гидравлический пресс плющит разноцветный пластилин
// =====================================================================
function makePress() {
  scene.background = gradientBg('#2b2f3a', '#0e1015');
  scene.environment = studioEnv(0x59606e);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1410, 0.5));
  const key = keyLight(0xfff4e6, 2.6, [-3, 9, 5], 4);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 1.4); rim.position.set(3, 4, -6); scene.add(rim);
  camera.fov = 38; camera.updateProjectionMatrix();

  const steel = new THREE.MeshPhysicalMaterial({ color: 0xb9bec7, metalness: 1, roughness: 0.28 });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x2d3139, metalness: 0.6, roughness: 0.45 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf2b705, metalness: 0.2, roughness: 0.4, clearcoat: 0.6 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // станина: основание, наковальня, колонна сзади и верхняя консоль
  const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 4), yellow); base.position.y = 0.25; base.receiveShadow = base.castShadow = true; scene.add(base);
  const anvil = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 0.3, 96), steel); anvil.position.y = 0.65; anvil.receiveShadow = anvil.castShadow = true; scene.add(anvil);
  const column = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.0), yellow); column.position.set(0, 4.5, -2.4); column.castShadow = true; scene.add(column);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 3.4), yellow); arm.position.set(0, 7.4, -1.0); arm.castShadow = true; scene.add(arm);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 64), dark); cyl.position.set(0, 6.4, 0); scene.add(cyl);
  const ram = new THREE.Group(); scene.add(ram);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 6, 48), steel); rod.position.y = 3.25; rod.castShadow = true; ram.add(rod);
  const platen = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.35, 96), steel); platen.position.y = 0.175; platen.castShadow = true; ram.add(platen);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.04, 12, 96), dark); ring.rotation.x = Math.PI / 2; ram.add(ring);
  // скребок, который сдвигает лепёшку
  const scraper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 3.4), steel); scraper.castShadow = true; scene.add(scraper);

  const TOP = 0.8;              // верх наковальни
  const R0 = 0.72, H0 = 2 * R0; // исходный «шар» пластилина
  const palettes = [
    ['#ff5f6d', '#ffc371', '#47d6b6', '#4d7cff', '#b65cff'],
    ['#ff8fab', '#ffd6e0', '#9ad1ff', '#5a6cff', '#ffe066'],
    ['#00c2a8', '#f9f871', '#ff6f91', '#845ec2', '#ff9671'],
    ['#ff4d4d', '#ffffff', '#2b59ff', '#ffd23f', '#3bceac'],
    ['#7bdff2', '#b2f7ef', '#f7d6e0', '#f2b5d4', '#eff7f6'],
    ['#ff7b00', '#ffb700', '#ffea00', '#d0ff00', '#70e000'],
  ];
  const patterns = ['layers', 'swirl', 'marble', 'halves', 'rings', 'layers', 'swirl', 'dots'];

  // форма «шара»: лёгкие бугры, как у скатанного руками пластилина
  function makeClay(idx) {
    const g = new THREE.SphereGeometry(R0, 150, 110);
    const p = g.attributes.position, n = p.count;
    const pal = palettes[idx % palettes.length].map(c => col(c));
    const pat = patterns[idx % patterns.length];
    const dir = new Float32Array(n * 3), len = new Float32Array(n), colors = new Float32Array(n * 3);
    const ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, i).normalize();
      dir.set([v.x, v.y, v.z], i * 3);
      len[i] = R0 * (1 + 0.035 * Math.sin(v.x * 5 + ph[0]) * Math.sin(v.y * 4 + ph[1]) + 0.025 * Math.sin(v.z * 7 + v.x * 3 + ph[2]));
      const yy = (v.y + 1) / 2, a = Math.atan2(v.z, v.x);
      let k;
      if (pat === 'layers') k = Math.floor(yy * 5 + 0.15 * Math.sin(a * 3 + ph[0]));
      else if (pat === 'swirl') k = Math.floor(((a / (2 * Math.PI) + 0.5) * 5 + yy * 4) % 5);
      else if (pat === 'marble') k = Math.floor((Math.sin(v.x * 4 + Math.sin(v.y * 6 + ph[1]) * 2) * 0.5 + 0.5) * 4.99);
      else if (pat === 'halves') k = (v.x + 0.15 * Math.sin(v.y * 5) > 0 ? 0 : 2) + (v.y > 0.1 * Math.sin(a * 4) ? 1 : 0);
      else if (pat === 'rings') k = Math.floor(Math.hypot(v.x, v.z) * 9) % 5;
      else k = (Math.sin(v.x * 13) * Math.sin(v.y * 13) * Math.sin(v.z * 13) > 0.15) ? 4 : 1;
      const c = pal[((k % 5) + 5) % 5];
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.6, sheen: 0.3, sheenRoughness: 0.8 }));
    m.castShadow = m.receiveShadow = true;
    m.userData = { dir, len, s: 1, wob: 0, x: 0, y: 6, vy: 0, idx, angle: rnd(0, 6.28) };
    scene.add(m);
    return m;
  }
  // деформация: шар → суперэллипсоид (плоские площадки контакта), объём сохраняется, края «рвутся»
  function deform(m, s, t) {
    const { dir, len, wob, angle } = m.userData, pos = m.geometry.attributes.position, n = pos.count;
    const p = 2 + 7 * (1 - s) ** 1.1, e = 2 / p;
    const vol = lerp(1, 1.5, 1 - 2 / p);              // объём суперэллипсоида относительно шара
    const k = 1 / Math.sqrt(s * vol);
    const bul = 0.28 * (1 - s);
    const fr = 0.07 * (1 - s) ** 1.5;
    for (let i = 0; i < n; i++) {
      const dx = dir[i * 3], dy = dir[i * 3 + 1], dz = dir[i * 3 + 2];
      const rh = Math.hypot(dx, dz), ay = Math.abs(dy);
      const nr = rh ** e, ny = ay ** e;               // суперэллиптическое отображение направлений
      const L = len[i];
      const a = Math.atan2(dz, dx) + angle;
      const u = dy;                                    // −1..1 по высоте
      const radial = L * nr * k * (1 + bul * (1 - u * u)) * (1 + fr * (Math.sin(a * 9) * 0.6 + Math.sin(a * 23 + 1.3) * 0.4) * (1 - u * u))
        * (1 + wob * 0.05 * Math.sin(a * 5 + t * 22) * (1 - u * u));
      const sx = rh > 1e-6 ? dx / rh : 0, sz = rh > 1e-6 ? dz / rh : 0;
      pos.setXYZ(i, sx * radial, Math.sign(dy) * L * ny * s, sz * radial);
    }
    pos.needsUpdate = true; m.geometry.computeVertexNormals();
  }

  const CYCLE = 3.4;
  let cur = null, old = null, lastCycle = -1, clayIdx = 0, T = 0;
  const RAM_UP = TOP + H0 + 2.6;
  function ramY(tc) {   // нижняя плоскость плиты в момент tc цикла
    const contact = TOP + H0, low = TOP + H0 * 0.2;
    if (tc < 0.8) return RAM_UP;
    if (tc < 1.15) return lerp(RAM_UP, contact + 0.02, easeIn(seg(tc, 0.8, 1.15)));
    if (tc < 2.05) return lerp(contact + 0.02, low, smooth(seg(tc, 1.15, 2.05)));
    if (tc < 2.25) return low;
    return lerp(low, RAM_UP, smooth(seg(tc, 2.25, 2.95)));
  }
  return dt => {
    T += dt;
    const c = Math.floor(T / CYCLE), tc = T - c * CYCLE;
    if (c !== lastCycle) {
      lastCycle = c;
      if (old) { scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
      old = cur; cur = makeClay(clayIdx++);
      cur.userData.y = TOP + 2.3; cur.userData.vy = 0;   // появляется под поднятой плитой
    }
    // новый шар падает и шлёпается
    const u = cur.userData;
    if (tc < 0.9) {
      u.vy -= 26 * dt; u.y += u.vy * dt;
      if (u.y < TOP) { u.y = TOP; u.wob = Math.min(1, Math.abs(u.vy) / 12); u.vy = -u.vy * 0.18; }
    }
    u.wob *= Math.exp(-dt * 5);
    // пресс
    const ry = ramY(tc); ram.position.y = ry;
    const s = clamp((ry - TOP) / H0, 0.2, 1);
    if (tc >= 1.0 && tc < 2.3) u.s = Math.min(u.s, s);
    else if (tc >= 2.3) u.s = Math.min(u.s * (1 + dt * 0.08), 0.235);  // лёгкое упругое «отпружинивание»
    const landSquash = tc < 0.9 ? 1 - 0.12 * u.wob * Math.abs(Math.sin(tc * 30)) : 1;
    deform(cur, u.s * landSquash, T);
    cur.position.set(0, u.y + H0 / 2 * u.s * landSquash, 0);
    const pop = seg(tc, 0, 0.22); cur.scale.setScalar(pop < 1 ? 1 + 2.7 * (pop - 1) ** 3 + 1.7 * (pop - 1) ** 2 : 1);  // «выскакивание» с перелётом
    if (tc > 1.15 && tc < 2.05) cur.rotation.y += dt * 0.15;
    // скребок сдвигает прошлую лепёшку вправо, она уезжает
    if (old) {
      const o = old.userData;
      const k = smooth(seg(tc, 0.0, 0.85));
      old.position.x = lerp(0, 5.2, k);
      old.position.y = TOP + H0 / 2 * o.s - Math.max(0, old.position.x - 2.2) * 0.9 * k;
      old.rotation.z = -Math.max(0, old.position.x - 1.9) * 0.35;
      scraper.visible = true; scraper.position.set(old.position.x - 2.0 + 0.04, TOP + 0.25, 0);
    } else scraper.visible = false;
    // камера: медленное покачивание
    const a = Math.sin(T * 0.21) * 0.35;
    camera.position.set(Math.sin(a) * 10.8, 4.3 + Math.sin(T * 0.13) * 0.3, Math.cos(a) * 10.8);
    camera.lookAt(0, 1.95, 0);
    key.target.position.set(0, 1, 0);
  };
}

// =====================================================================
// 2. SAND — нож режет слоёный кинетический песок на ломтики
// =====================================================================
function makeSand() {
  scene.background = gradientBg('#f3e7da', '#d9c7b4');
  scene.environment = studioEnv(0x8a8378);
  scene.add(new THREE.HemisphereLight(0xfff8ef, 0x8a7966, 0.9));
  const key = keyLight(0xfff1e0, 2.4, [4, 9, 6], 5);
  camera.fov = 36; camera.updateProjectionMatrix();

  const D = 0.17, BW = 2.0, BH = 1.25, PER = 12;   // толщина ломтика, ширина/высота блока, ломтиков в блоке
  const CUT = 0;                                      // плоскость реза (z)
  const palettes = [
    ['#ff8fab', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ffe5ec'],
    ['#9b5de5', '#f15bb5', '#fee440', '#00bbf9', '#00f5d4', '#ffffff'],
    ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#f1faee'],
    ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ffffff'],
    ['#cdb4db', '#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff', '#fefae0'],
  ];
  // песок: узор слоёв считается по координате внутри блока, поэтому срез показывает «начинку»
  const sandMats = palettes.map((p, bi) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    const pal = { value: p.map(c => col(c)) };
    const kind = { value: bi % 3 };
    m.onBeforeCompile = sh => {
      sh.uniforms.uPal = pal; sh.uniforms.uKind = kind;
      sh.vertexShader = 'attribute vec3 aPat;\nvarying vec3 vPat;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat=aPat;');
      sh.fragmentShader = 'uniform vec3 uPal[6];uniform int uKind;varying vec3 vPat;\nfloat h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 q=vPat; float f;
  if(uKind==0) f=(q.y+0.07*sin(q.x*3.3+q.z*2.1)+0.05*sin(q.z*6.0-q.x*1.9))/0.2083;
  else if(uKind==1) f=(length(vec2(q.x,q.y-0.62))+0.05*sin(q.z*4.0+q.x*2.0))/0.17;
  else f=(q.y*0.8+q.x*0.45+0.08*sin(q.z*5.0+q.y*7.0))/0.21+3.0;
  int k=int(mod(floor(f),6.0)); vec3 c=uPal[0];
  for(int i=1;i<6;i++){ if(i==k) c=uPal[i]; }
  float g=h3(floor(q*260.0)); float g2=h3(floor(q*90.0)+7.0);
  diffuseColor.rgb=c*(0.86+0.16*g+0.06*g2);
}`);
    };
    return m;
  });
  const slab = new THREE.BoxGeometry(BW, BH, D, 1, 1, 1);
  function sliceGeom(off) {
    const g = slab.clone(); const p = g.attributes.position, a = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) a.set([p.getX(i) + BW / 2, p.getY(i) + BH / 2, p.getZ(i) - off], i * 3);
    g.setAttribute('aPat', new THREE.BufferAttribute(a, 3)); g.translate(0, BH / 2, -D / 2); // опора — нижнее переднее ребро
    return g;
  }

  // стол и лента
  const wood = new THREE.MeshStandardMaterial({ color: 0xe9dccb, roughness: 0.8 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 6), wood); table.position.set(0, -0.15, -3); table.receiveShadow = true; scene.add(table);
  const btex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#3a3d44'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#33363c'; g.fillRect(0, 0, 64, 6); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 30); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 12), new THREE.MeshStandardMaterial({ map: btex, roughness: 0.7 }));
  belt.rotation.x = -Math.PI / 2; belt.position.set(0, 0.001, 6); belt.receiveShadow = true; scene.add(belt);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xd8c6b2, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.3; ground.receiveShadow = true; scene.add(ground);

  // нож
  const knife = new THREE.Group(); scene.add(knife);
  const bladeMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f8, metalness: 0.85, roughness: 0.18 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.1, 0.02), bladeMat); blade.position.y = 0.55; blade.castShadow = true; knife.add(blade);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 0.006), new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05 })); edge.position.y = 0.02; knife.add(edge);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.26, 0.16), new THREE.MeshStandardMaterial({ color: 0xe0523f, roughness: 0.45 })); handle.position.set(0, 1.22, 0); handle.castShadow = true; knife.add(handle);

  // крошки песка
  const CRUMBS = 260;
  const crumbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.022, 0), new THREE.MeshStandardMaterial({ roughness: 1 }), CRUMBS);
  crumbs.castShadow = true; scene.add(crumbs);
  const cr = Array.from({ length: CRUMBS }, () => ({ p: new THREE.Vector3(0, -5, 0), v: new THREE.Vector3(), life: 0 }));
  let crumbHead = 0; const M4 = new THREE.Matrix4(), V3 = new THREE.Vector3();
  for (let i = 0; i < CRUMBS; i++) crumbs.setColorAt(i, col('#fff'));
  function spawnCrumbs(n, pal, y0) {
    for (let j = 0; j < n; j++) {
      const c = cr[crumbHead = (crumbHead + 1) % CRUMBS];
      c.p.set(rnd(-BW / 2, BW / 2), y0 + rnd(-0.05, 0.05), CUT + rnd(-0.03, 0.03)); c.v.set(rnd(-0.3, 0.3), rnd(0, 0.6), rnd(0.2, 1.2)); c.life = rnd(1.2, 2.2);
      crumbs.setColorAt(crumbHead, col(pal[Math.floor(rnd(0, 6))]));
    }
    crumbs.instanceColor.needsUpdate = true;
  }

  // очередь ломтиков
  const slices = []; let made = 0;
  function addSlice() {
    const b = Math.floor(made / PER) % palettes.length;
    const off = (made % PER) * D;
    const m = new THREE.Mesh(sliceGeom(off), sandMats[b]); m.castShadow = m.receiveShadow = true;
    m.userData = { state: 'block', ang: 0, av: 0, z: 0, b }; scene.add(m); slices.push(m); made++;
  }
  for (let i = 0; i < 24; i++) addSlice();

  const CYCLE = 1.3, BELT = 1.6; // лента быстрее блока, ломтики не налезают друг на друга
  let T = 0, lastCycle = -1, adv = 0, cutDone = -1;
  return dt => {
    T += dt;
    const c = Math.floor(T / CYCLE), tc = T - c * CYCLE;
    if (c !== lastCycle) { lastCycle = c; adv = 0; }
    // нож: вниз — пауза — вверх
    const ky = tc < 0.38 ? lerp(BH + 0.9, -0.01, easeIn(seg(tc, 0.0, 0.38)) ** 0.7) : tc < 0.5 ? -0.01 : lerp(-0.01, BH + 0.9, smooth(seg(tc, 0.5, 0.8)));
    knife.position.set(0, ky, CUT - D - 0.012);
    knife.rotation.z = 0.04 * Math.sin(tc * 4);
    if (tc - dt < 0.3 && tc >= 0.3) spawnCrumbs(28, palettes[slices[0].userData.b], 0.05);
    if (tc - dt < 0.12 && tc >= 0.12) spawnCrumbs(14, palettes[slices[0].userData.b], BH);
    // блок подаётся вперёд на толщину ломтика
    const want = D * smooth(seg(tc, 0.85, 1.22));
    const step = want - adv; adv = want;
    // первый ломтик в блоке отрезан → падает вперёд
    const front = slices.find(s => s.userData.state === 'block');
    if (front && tc >= 0.45 && cutDone !== c) { front.userData.state = 'fall'; cutDone = c; front.userData.av = 0.6; }
    let i = 0;
    for (const s of slices) {
      const u = s.userData;
      if (u.state === 'block') { u.z = CUT - D * i + adv; i++; if (i === 1 && tc < 0.45) u.z = CUT + adv; }
      if (u.state === 'block') { s.position.set(0, 0, u.z); s.rotation.x = 0; continue; }
      if (u.state === 'fall') {
        u.av += 9.0 * Math.cos(u.ang) * dt + 0.8 * dt; u.ang += u.av * dt;
        if (u.ang >= Math.PI / 2) { u.ang = Math.PI / 2; u.av = -u.av * 0.22; if (Math.abs(u.av) < 0.15) u.state = 'belt'; }
      }
      if (u.state === 'belt' || u.ang > 1.2) u.z += BELT * dt;
      s.position.set(0, 0, u.z); s.rotation.x = u.ang;
    }
    while (slices.length && slices[0].userData.z > 9) { const s = slices.shift(); scene.remove(s); s.geometry.dispose(); }
    while (slices.filter(s => s.userData.state === 'block').length < 22) addSlice();
    btex.offset.y -= BELT * dt / 12 * 30;
    // крошки
    for (let j = 0; j < CRUMBS; j++) {
      const q = cr[j]; if (q.life > 0) {
        q.life -= dt; q.v.y -= 9.8 * dt; q.p.addScaledVector(q.v, dt);
        if (q.p.y < 0.02) { q.p.y = 0.02; q.v.set(0, 0, BELT); }
        if (q.p.z > 9 || q.life <= 0) q.p.y = -5;
      }
      M4.makeTranslation(q.p.x, q.p.y, q.p.z); crumbs.setMatrixAt(j, M4);
    }
    crumbs.instanceMatrix.needsUpdate = true;
    const a = Math.sin(T * 0.17) * 0.18;
    camera.position.set(2.5 + a * 3, 3.5 + Math.sin(T * 0.11) * 0.2, 6.3 - a);
    camera.lookAt(-0.25, 0.7, -0.2);
    key.target.position.set(0, 0, 0.5);
    V3.set(0, 0, 0);
  };
}

// =====================================================================
// 3. TILES — поле плиток синхронно переворачивается волнами
// =====================================================================
function makeTiles() {
  scene.background = gradientBg('#141a33', '#07080f');
  scene.environment = studioEnv(0x1b2033);
  scene.add(new THREE.HemisphereLight(0xc9d6ff, 0x101018, 0.6));
  const key = keyLight(0xffffff, 2.2, [-4, 12, 6], 7);
  camera.fov = 42; camera.updateProjectionMatrix();

  const NX = 9, NZ = 15, S = 0.62, TH = 0.12;
  const pal = ['#ff3cac', '#784ba0', '#2b86c5', '#00d4b4', '#ffd23f', '#ff6b35', '#f4f1de'].map(col);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0b0d16, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor);
  const half = new THREE.BoxGeometry(S * 0.9, TH / 2, S * 0.9);
  const mk = () => { const m = new THREE.InstancedMesh(half, new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }), NX * NZ); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const topM = mk(), botM = mk();
  const tiles = [];
  for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) tiles.push({ x: (x - (NX - 1) / 2) * S, z: (z - (NZ - 1) / 2) * S, ix: x, iz: z, flips: 0, faceA: 0, faceB: 1, prog: 1, start: 1e9, axis: 0 });
  tiles.forEach((t, i) => { topM.setColorAt(i, pal[0]); botM.setColorAt(i, pal[1]); });

  // узоры волн: задержка начала переворота для каждой плитки
  const cx = (NX - 1) / 2, cz = (NZ - 1) / 2;
  const waves = [
    t => Math.hypot(t.ix - cx, t.iz - cz) * 0.085,
    t => (t.iz) * 0.07 + (t.ix % 2) * 0.0,
    t => ((Math.atan2(t.iz - cz, t.ix - cx) + Math.PI) / (2 * Math.PI)) * 1.1,
    t => Math.max(Math.abs(t.ix - cx), Math.abs(t.iz - cz)) * 0.12,
    t => (t.ix + t.iz) * 0.055,
    t => ((t.ix + t.iz) % 2) * 0.35 + Math.abs(t.iz - cz) * 0.04,
    t => (NZ - 1 - t.iz) * 0.07 + Math.abs(t.ix - cx) * 0.05,
    t => Math.abs(Math.hypot(t.ix - cx, (t.iz - cz) * 0.8) - 4) * 0.11,
  ];
  const DUR = 0.55, PERIOD = 2.6;
  let T = 0, waveIdx = 0, nextWave = 0.4, colorStep = 1;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const off = new THREE.Vector3();
  return dt => {
    T += dt;
    if (T >= nextWave) {
      const w = waves[waveIdx % waves.length]; const axis = waveIdx % 2;
      colorStep++;
      tiles.forEach((t, i) => {
        t.start = T + w(t); t.prog = 0; t.axis = axis;
        // на скрытую сторону заранее кладём следующий цвет
        const hidden = t.flips % 2 === 0 ? botM : topM;
        hidden.setColorAt(i, pal[colorStep % pal.length]);
      });
      topM.instanceColor.needsUpdate = botM.instanceColor.needsUpdate = true;
      waveIdx++; nextWave = T + PERIOD;
    }
    tiles.forEach((t, i) => {
      let u = 0;
      if (T >= t.start && t.prog < 1) { t.prog = clamp((T - t.start) / DUR, 0, 1); if (t.prog >= 1) t.flips++; }
      u = t.prog < 1 && T >= t.start ? t.prog : 0;
      const k = easeOut(u) - 0.06 * Math.sin(Math.PI * clamp(u * 1.15 - 0.15, 0, 1)) * (1 - u);
      const base = (t.flips % 2) * Math.PI;
      const ang = base + Math.PI * clamp(k, 0, 1.08);
      const lift = Math.sin(Math.PI * u) * 0.45;
      e.set(t.axis === 0 ? ang : 0, 0, t.axis === 1 ? ang : 0); q.setFromEuler(e);
      for (const [mesh, dy] of [[topM, TH / 4], [botM, -TH / 4]]) {
        off.set(0, dy, 0).applyQuaternion(q);
        p.set(t.x + off.x, 0.08 + lift + off.y, t.z + off.z);
        M.compose(p, q, sc); mesh.setMatrixAt(i, M);
      }
    });
    topM.instanceMatrix.needsUpdate = botM.instanceMatrix.needsUpdate = true;
    const a = T * 0.12;
    camera.position.set(Math.sin(a) * 2.2, 8.6, 5.2 + Math.cos(a) * 1.2);
    camera.lookAt(0, 0, -0.2);
    key.target.position.set(0, 0, 0);
  };
}

// =====================================================================
// 4. WAVE — «волна маятников»: 15 маятников, ровно через 30 с снова в одной линии
// =====================================================================
function makeWave() {
  scene.background = gradientBg('#1b1035', '#05040b');
  scene.environment = studioEnv(0x1a1530);
  scene.add(new THREE.HemisphereLight(0xd8ccff, 0x0a0812, 0.5));
  const key = keyLight(0xffffff, 2.0, [3, 14, 4], 8);
  camera.fov = 40; camera.updateProjectionMatrix();

  const N = 15, LOOP = 30, N0 = 18, AMP = 0.42, G = 9.81, SCALE = 4.2, BAR = 4.6;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0d0a18, roughness: 0.6, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xd7d9e0, metalness: 1, roughness: 0.2 });
  const len = N * 0.55;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len + 0.8, 24), metal); bar.rotation.x = Math.PI / 2; bar.position.set(0, BAR, -len / 2 + 0.3); bar.castShadow = true; scene.add(bar);
  for (const z of [0.65, -len - 0.1]) for (const x of [-0.8, 0.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, Math.hypot(BAR, x), 16), metal);
    post.position.set(x / 2, BAR / 2, z); post.rotation.z = Math.atan(x / BAR); post.castShadow = true; scene.add(post);
  }
  const strMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x332244 });
  const pend = [];
  for (let k = 0; k < N; k++) {
    const Tk = LOOP / (N0 + k), L = G * (Tk / (2 * Math.PI)) ** 2 * SCALE;
    const g = new THREE.Group(); g.position.set(0, BAR, -k * 0.55); scene.add(g);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, L, 6), strMat); s.position.y = -L / 2; g.add(s);
    const c = new THREE.Color().setHSL(0.83 - k / N * 0.75, 0.85, 0.58);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 32), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, emissive: c, emissiveIntensity: 0.35 }));
    ball.position.y = -L; ball.castShadow = true; g.add(ball);
    pend.push({ g, Tk });
  }
  let T = 0;
  return dt => {
    T += dt;
    for (const p of pend) p.g.rotation.z = AMP * Math.cos(2 * Math.PI * T / p.Tk);
    const a = 2 * Math.PI * T / LOOP;   // камера тоже возвращается в исходную точку за 30 с
    camera.position.set(Math.sin(a) * 1.4 + 2.0, 6.3 + Math.sin(a * 2) * 0.25, 6.4);
    camera.lookAt(0, 2.2, -3.2);
    key.target.position.set(0, 0, -3.5);
  };
}

const step = { press: makePress, sand: makeSand, tiles: makeTiles, wave: makeWave }[SCENE]();

// ---------- запуск ----------
const cap = document.createElement('canvas'); cap.width = W; cap.height = H; const cx = cap.getContext('2d');
window.__frame = (dt, sub = 1) => {
  for (let i = 0; i < sub; i++) { step(dt / sub); renderer.render(scene, camera); cx.globalAlpha = 1 / (i + 1); cx.drawImage(renderer.domElement, 0, 0); }
  cx.globalAlpha = 1;
};
window.__grab = (q = .92) => cap.toDataURL('image/jpeg', q).split(',')[1];
window.__ready = true;
if (!RENDER) { let last = performance.now(); const loop = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; step(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
