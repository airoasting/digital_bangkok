// galaxy.js — Three.js 은하 씬 (Plan.md 6.1/6.3 확정 사항 구현)
//
// 렌더링 원칙: 별은 조명 받는 입체가 아니라 복사체다.
// 별 하나 = 카메라를 향한 사각형 1개. 코어, 헤일로, 회절 십자를 셰이더가 한 번에 그린다.
// 드로우콜은 별 전체가 1개(인스턴싱), 레이캐스트는 보이지 않는 picker가 따로 맡는다.
// 캔버스가 투명하므로 알파는 빛이 있는 곳에만 쌓는다(One/One + 프리멀티플라이드 출력).
// 그렇지 않으면 사각형이 뒤의 CSS 성운을 가려 검은 원반으로 보인다.
// 공전: Group.rotation.y 240초 주기, 패널 오픈 중 정지.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const ROT_PERIOD = 240; // s
const R_HOME = 48;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createGalaxy({ canvas, data, onSelect }) {
  const concepts = data.concepts;
  const N = concepts.length;
  const galaxyColor = new Map(data.galaxies.map(g => [g.id, new THREE.Color(g.color)]));
  const idx = new Map(concepts.map((c, i) => [c.id, i]));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0); // 투명: 뒤의 CSS 성운 그라디언트가 비친다
  let dprCap = 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  renderer.setSize(innerWidth, innerHeight);

  const labelRenderer = new CSS2DRenderer();
  Object.assign(labelRenderer.domElement.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '20',
  });
  labelRenderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060d, 0.0016);
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1200);
  camera.position.set(0, 0.6 * R_HOME, 1.8 * R_HOME);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 260;

  const group = new THREE.Group();
  scene.add(group);

  // 광원은 두지 않는다. 이 씬의 모든 밝은 것은 스스로 빛나는 복사체다.

  // 원경 별밭 (정적)
  {
    const n = 1400, pos = new Float32Array(n * 3);
    let s = 20260718;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) {
      const r = 320 + rnd() * 260, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x8fa2cc, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.45 });
    const backdrop = new THREE.Points(geo, mat);
    backdrop.raycast = () => {};
    scene.add(backdrop);
  }

  // 태양: 은하에서 가장 밝은 별. 별과 같은 광학 언어를 쓴다.
  // 광구: 중심은 희게 타고 가장자리로 갈수록 식으면서 코로나로 번진다. 테두리를 남기지 않는다.
  const sunMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uTime: { value: 0 }, uGlare: { value: 1 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vPos = normalize(position);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uGlare;
      varying vec3 vN; varying vec3 vV; varying vec3 vPos;

      // 값 노이즈 + fbm. 텍스처 없이 태양 표면과 코로나의 불규칙함을 만든다.
      float hash13(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float vnoise(vec3 x) {
        vec3 i = floor(x), f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash13(i + vec3(0,0,0)), hash13(i + vec3(1,0,0)), f.x),
                       mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
                       mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float a = 0.5, sum = 0.0;
        for (int i = 0; i < 4; i++) { sum += a * vnoise(p); p *= 2.03; a *= 0.5; }
        return sum;
      }
      void main() {
        float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);

        // 쌀알 무늬: 잔 대류 위에 초대형 대류를 겹쳐 느리게 끓게 한다
        float gran = fbm(vPos * 11.0 + vec3(0.0, uTime * 0.05, 0.0));
        float sgran = fbm(vPos * 3.4 - vec3(uTime * 0.02));
        // 멀리서 보는 태양은 눈부셔서 표면이 안 보인다. 다가가야 쌀알 무늬가 드러난다.
        float detail = 1.0 - 0.88 * uGlare;
        float b = 1.00 + (0.36 * (gran - 0.5) + 0.22 * (sgran - 0.5)) * detail;

        // 주연감광: 가장자리로 갈수록 어둡고 붉다
        float limb = 0.22 + 0.90 * pow(mu, 0.95);
        float lum = limb * b * (1.0 + 0.03 * sin(uTime * 0.6));

        // 온도 램프. 안쪽은 희게, 바깥은 주황으로 식는다
        vec3 cool = vec3(0.88, 0.30, 0.06);
        vec3 warm = vec3(1.00, 0.68, 0.24);
        vec3 hot  = vec3(1.00, 0.95, 0.83);
        vec3 col = mix(cool, warm, smoothstep(0.16, 0.62, lum));
        col = mix(col, hot, smoothstep(0.74, 1.02, lum));
        col *= (0.44 + 0.52 * lum) * (1.0 + 0.40 * uGlare);

        // 채층: 원반 가장자리에 얇게 걸리는 붉은 테
        col += vec3(1.0, 0.30, 0.10) * smoothstep(0.26, 0.02, mu) * 0.32;

        float a = smoothstep(0.0, 0.20, mu);
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const SUN_R = 1.9;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 32), sunMat);
  sun.renderOrder = 2;
  sun.raycast = () => {};
  group.add(sun);
  // 작아진 만큼 클릭 판정은 따로 넉넉히 둔다
  const sunPicker = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_R * 2.9, 16, 12),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  );
  group.add(sunPicker);
  // 코로나: 별과 같은 해석적 프로필. 캔버스 텍스처는 알파 경계가 드러나 쓰지 않는다.
  const coronaMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uTime: { value: 0 }, uSize: { value: 26 }, uGlare: { value: 1 } },
    vertexShader: `
      uniform float uSize;
      varying vec2 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * uSize;
        vP = (uv - 0.5) * 2.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uGlare;
      varying vec2 vP;

      // 값 노이즈 + fbm. 텍스처 없이 태양 표면과 코로나의 불규칙함을 만든다.
      float hash13(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float vnoise(vec3 x) {
        vec3 i = floor(x), f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash13(i + vec3(0,0,0)), hash13(i + vec3(1,0,0)), f.x),
                       mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
                       mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float a = 0.5, sum = 0.0;
        for (int i = 0; i < 4; i++) { sum += a * vnoise(p); p *= 2.03; a *= 0.5; }
        return sum;
      }
      void main() {
        float r = length(vP);
        if (r > 1.0) discard;
        float f = 1.0 - r;

        // 코로나는 완전한 원이 아니다. 방향마다 다르게 뻗고 느리게 뒤척인다.
        vec2 dir = r > 0.001 ? vP / r : vec2(1.0, 0.0);
        float n = fbm(vec3(dir * 2.6, uTime * 0.035));
        float rays = 0.55 + 0.9 * n;

        // 림에서 시작해 한 번에 사그라드는 감쇠. 항을 나누면 원반 밖에 고리가 뜬다.
        float halo = 0.0072 / (r * r + 0.008) * f * (0.88 + 0.24 * n);
        float reach = pow(f, 3.0) * 0.085 * rays;
        // 광구가 차지한 안쪽에서는 코로나를 죽인다. 겹치면 원반이 하얗게 날아간다.
        float occl = smoothstep(0.08, 0.17, r);
        float e = (halo + reach) * occl * (1.0 + 0.22 * uGlare) * (1.0 + 0.05 * sin(uTime * 0.6));

        vec3 hot = vec3(1.00, 0.87, 0.62);
        vec3 cool = vec3(0.85, 0.40, 0.12);
        vec3 tint = mix(cool, hot, smoothstep(0.02, 0.5, e));
        vec3 col = vec3(1.0) - exp(-tint * e * 2.4);
        gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
      }`,
  });
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), coronaMat);
  corona.frustumCulled = false;
  corona.raycast = () => {};
  corona.renderOrder = 1;
  group.add(corona);

  // 별: 조명 받는 입체가 아니라 복사체다.
  // 카메라를 향하는 사각형 하나에 코어, 헤일로, 회절 십자를 한 번에 그린다.
  // 등급(importance)은 크기가 아니라 광학으로 드러난다. 4등급 이상만 회절 십자를 얻는다.
  const dummy = new THREE.Object3D();
  const baseScale = new Float32Array(N);   // 겉보기 반경 (월드 단위)
  const baseGain = new Float32Array(N);    // 고유 광도
  const visitedSet = new Set();

  const aOffset = new Float32Array(N * 3);
  const aColor = new Float32Array(N * 3);
  const aSize = new Float32Array(N);
  const aGain = new Float32Array(N);
  const aSeed = new Float32Array(N);
  const aSpike = new Float32Array(N);

  // 결정적 난수. 같은 별은 언제 열어도 같은 표정을 갖는다.
  let hs = 0x9e3779b9;
  const hrnd = () => { hs = (hs * 1664525 + 1013904223) >>> 0; return hs / 4294967296; };

  concepts.forEach((c, i) => {
    const mag = 0.35 + 0.22 * c.importance;
    baseScale[i] = mag * 4.6;
    // 광도는 등급에 대해 비선형으로 벌린다. 5등급은 1등급보다 확연히 밝다.
    baseGain[i] = 0.9 + 2.3 * Math.pow((c.importance - 1) / 4, 1.4);
    aSize[i] = baseScale[i];
    aGain[i] = baseGain[i];
    aSeed[i] = hrnd();
    aSpike[i] = c.importance >= 5 ? 1 : c.importance >= 4 ? 0.55 : 0;
    aOffset.set(c.position, i * 3);
    const col = galaxyColor.get(c.galaxy);
    aColor[i * 3] = col.r; aColor[i * 3 + 1] = col.g; aColor[i * 3 + 2] = col.b;
  });

  const quad = new THREE.PlaneGeometry(1, 1);
  const starGeo = new THREE.InstancedBufferGeometry();
  starGeo.index = quad.index;
  starGeo.setAttribute('position', quad.attributes.position);
  starGeo.setAttribute('uv', quad.attributes.uv);
  starGeo.instanceCount = N;
  const attrOffset = new THREE.InstancedBufferAttribute(aOffset, 3);
  const attrColor = new THREE.InstancedBufferAttribute(aColor, 3);
  const attrSize = new THREE.InstancedBufferAttribute(aSize, 1);
  const attrGain = new THREE.InstancedBufferAttribute(aGain, 1);
  starGeo.setAttribute('aOffset', attrOffset);
  starGeo.setAttribute('aColor', attrColor);
  starGeo.setAttribute('aSize', attrSize);
  starGeo.setAttribute('aGain', attrGain);
  starGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  starGeo.setAttribute('aSpike', new THREE.InstancedBufferAttribute(aSpike, 1));

  const starUniforms = {
    uTime: { value: 0 },
    uViewportH: { value: innerHeight * Math.min(devicePixelRatio, 2) },
    uMinPx: { value: 7.0 },
    uRefPx: { value: 30.0 },
    uMaxPx: { value: 200.0 },
    uTwinkle: { value: 1 },
    uSpike: { value: 1 },
  };
  const starMat = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    transparent: true,
    depthWrite: false,
    // 캔버스가 투명하므로 알파도 빛이 있는 곳에서만 쌓아야 한다.
    // 순수 가산(One/One)이라 알파가 사각형 전체를 덮어 배경 성운을 가리는 일이 없다.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    vertexShader: `
      attribute vec3 aOffset;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aGain;
      attribute float aSeed;
      attribute float aSpike;
      uniform float uViewportH, uMinPx, uMaxPx, uRefPx;
      varying vec2 vP;
      varying vec3 vColor;
      varying float vGain, vSeed, vSpike;
      void main() {
        vColor = aColor;
        vSeed = aSeed;
        vSpike = aSpike;
        float on = step(0.0001, aSize);
        vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
        float dist = max(-mv.z, 0.001);
        float K = projectionMatrix[1][1] * 0.5 * uViewportH; // 거리 1에서의 픽셀/월드
        float px = aSize * K / dist;
        // 겉보기 크기를 등급처럼 압축한다. 다가가도 부풀지 않고, 멀어져도 사라지지 않는다.
        float shown = clamp(uRefPx * pow(px / uRefPx, 0.55), uMinPx, uMaxPx);
        // 실제보다 크게 그린 만큼 어두워진다. 광량이 보존되어 거리가 읽힌다.
        float fade = clamp(px / shown, 0.25, 1.0);
        vGain = aGain * fade * on;
        vP = (uv - 0.5) * 2.0;
        mv.xy += position.xy * (shown * dist / K) * on;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      precision highp float;
      uniform float uTime, uTwinkle, uSpike;
      varying vec2 vP;
      varying vec3 vColor;
      varying float vGain, vSeed, vSpike;
      void main() {
        float r = length(vP);
        if (r > 1.0) discard;
        float falloff = 1.0 - r;

        float core  = exp(-r * r / 0.0030) * 2.2;          // 뜨거운 중심
        float inner = 0.05 / (r * r + 0.02) * falloff;     // 역제곱 광휘
        float outer = pow(falloff, 1.8) * 0.30;            // 바깥으로 사그라드는 잔광

        // 회절 십자: 밝은 별에만. 광학이 곧 위계다.
        float sx = exp(-abs(vP.x) * 2.2) * exp(-(vP.y * vP.y) / 0.00055);
        float sy = exp(-abs(vP.y) * 2.2) * exp(-(vP.x * vP.x) / 0.00055);
        float spikes = (sx + sy) * vSpike * uSpike * 0.55 * falloff;

        // 섬광: 별마다 위상이 다르고, 주기가 서로 나누어떨어지지 않는다
        float tw = 1.0 + uTwinkle * (
            0.16 * sin(uTime * 1.9 + vSeed * 43.0)
          + 0.08 * sin(uTime * 3.3 + vSeed * 91.0));

        float energy = (core + inner + outer + spikes) * vGain * tw;
        if (energy < 0.004) discard;

        // 색온도 편차: 같은 장(章)이라도 별마다 미세하게 다르게 탄다
        vec3 tempShift = mix(vec3(1.06, 0.98, 0.90), vec3(0.92, 0.98, 1.10), fract(vSeed * 7.13));
        vec3 hue = clamp(vColor * tempShift, 0.0, 1.0);

        // 중심은 희게 타오르고 색은 헤일로에만 남는다
        vec3 tint = mix(hue, vec3(1.0), smoothstep(2.0, 5.2, energy));
        vec3 col = vec3(1.0) - exp(-tint * energy * 1.25);
        gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
      }`,
  });
  const stars = new THREE.Mesh(starGeo, starMat);
  stars.frustumCulled = false;
  stars.raycast = () => {};
  stars.renderOrder = 3;
  group.add(stars);

  // 클릭 판정 프록시: 보이는 별은 작아도 넉넉히 클릭되도록 큰 투명 구체를 겹친다
  const pickMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const picker = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), pickMat, N);
  const pickScale = new Float32Array(N);
  concepts.forEach((c, i) => {
    const ps = Math.max((0.35 + 0.22 * c.importance) * 2.8, 1.9);
    pickScale[i] = ps;
    dummy.position.set(...c.position);
    dummy.scale.setScalar(ps);
    dummy.updateMatrix();
    picker.setMatrixAt(i, dummy.matrix);
  });
  picker.instanceMatrix.needsUpdate = true;
  group.add(picker);


  // 상시 라벨 (importance >= 4)
  // 상시 라벨은 끈다. 이름은 가리켰을 때만 준다.
  // 별 위에 글자가 붙어 있으면 은하가 아니라 다이어그램으로 읽힌다.
  // 되살리려면 아래 등급 문턱을 5 같은 값으로 낮춘다(6이면 아무 별도 해당하지 않는다).
  const LABEL_MIN_IMPORTANCE = 6;
  const labelObjs = [];
  concepts.forEach((c) => {
    if (c.importance < LABEL_MIN_IMPORTANCE) return;
    const div = document.createElement('div');
    div.className = 'star-label';
    div.textContent = c.name;
    const obj = new CSS2DObject(div);
    obj.position.set(...c.position);
    obj.userData.galaxy = c.galaxy;
    obj.userData.importance = c.importance;
    group.add(obj);
    labelObjs.push(obj);
  });

  // 호버 라벨
  const hoverDiv = document.createElement('div');
  hoverDiv.className = 'hover-label';
  const hoverObj = new CSS2DObject(hoverDiv);
  hoverObj.visible = false;
  scene.add(hoverObj);

  // 선택 관계선
  let lines = null;
  function showEdgesFor(id) {
    if (lines) { group.remove(lines); lines.geometry.dispose(); lines.material.dispose(); lines = null; }
    if (!id) return;
    const edges = data.edges.filter(e => e.a === id || e.b === id);
    if (!edges.length) return;
    const pos = new Float32Array(edges.length * 6);
    const col = new Float32Array(edges.length * 6);
    const gold = new THREE.Color(0xf5c97b);
    edges.forEach((e, i) => {
      const A = concepts[idx.get(e.a)], B = concepts[idx.get(e.b)];
      pos.set(A.position, i * 6);
      pos.set(B.position, i * 6 + 3);
      const cA = e.cross ? gold : galaxyColor.get(A.galaxy);
      const cB = e.cross ? gold : galaxyColor.get(B.galaxy);
      col.set([cA.r, cA.g, cA.b], i * 6);
      col.set([cB.r, cB.g, cB.b], i * 6 + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    lines.raycast = () => {};
    group.add(lines);
  }

  // 필터
  let visibleG = new Set([1, 2, 3, 4, 5, 6]);
  function setFilter(gs) {
    visibleG = gs;
    concepts.forEach((c, i) => {
      const on = gs.has(c.galaxy);
      writeStar(i);
      dummy.position.set(...c.position);
      dummy.scale.setScalar(on ? pickScale[i] : 0.0001);
      dummy.updateMatrix();
      picker.setMatrixAt(i, dummy.matrix);
    });
    picker.instanceMatrix.needsUpdate = true;
    flushStars();
    // 라벨 노출은 렌더 루프의 LOD에서 visibleG 기준으로 처리한다
  }

  // 방문/선택 시각 상태
  let selectedIdx = -1;
  const warmWhite = new THREE.Color(0xffffff);
  function writeStar(i) {
    const c = concepts[i];
    const on = visibleG.has(c.galaxy);
    const sel = i === selectedIdx;
    aSize[i] = on ? baseScale[i] * (sel ? 1.3 : 1) : 0;
    // 읽은 별은 크기가 아니라 온도로 표시한다. 흰빛으로 식으면서 조금 더 밝아진다.
    const seen = visitedSet.has(c.id);
    aGain[i] = baseGain[i] * (sel ? 1.7 : seen ? 1.15 : 1);
    const col = galaxyColor.get(c.galaxy).clone();
    if (seen) col.lerp(warmWhite, 0.45);
    aColor[i * 3] = col.r; aColor[i * 3 + 1] = col.g; aColor[i * 3 + 2] = col.b;
  }
  function flushStars() {
    attrSize.needsUpdate = true;
    attrGain.needsUpdate = true;
    attrColor.needsUpdate = true;
  }
  function refreshStar(i) { writeStar(i); flushStars(); }
  function setVisited(id) {
    visitedSet.add(id);
    const i = idx.get(id);
    if (i !== undefined) refreshStar(i);
  }
  function setSelected(id) {
    const prev = selectedIdx;
    selectedIdx = id ? idx.get(id) : -1;
    if (prev >= 0) refreshStar(prev);
    if (selectedIdx >= 0) refreshStar(selectedIdx);
  }

  // 카메라 트윈 (비행 중 새 클릭 → 즉시 파기, 대기열 없음)
  let tween = null;
  function flyTo(worldPos, dist, dur = 800, onDone) {
    const start = camera.position.clone();
    const startT = controls.target.clone();
    const dir = camera.position.clone().sub(worldPos).normalize();
    const end = worldPos.clone().add(dir.multiplyScalar(dist));
    tween = { start, startT, end, endT: worldPos.clone(), t0: performance.now(), dur, onDone };
    controls.enabled = false;
  }
  function flyToStar(id) {
    const c = concepts[idx.get(id)];
    const world = new THREE.Vector3(...c.position);
    group.localToWorld(world);
    flyTo(world, Math.max(15 * (0.35 + 0.22 * c.importance), 21));
  }
  function flyHome() {
    flyTo(new THREE.Vector3(0, 0, 0), 0, 900);
    tween.end = new THREE.Vector3(0, 0.6 * R_HOME, 1.8 * R_HOME);
  }

  // 레이캐스트 (호버는 rAF당 1회)
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerMoved = false, pointerOnScreen = false;
  let hoverIdx = -1;
  canvas.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    pointerMoved = true;
    pointerOnScreen = true;
  });
  canvas.addEventListener('pointerleave', () => { pointerOnScreen = false; hoverObj.visible = false; });

  let downPos = null;
  canvas.addEventListener('pointerdown', (e) => { downPos = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
    downPos = null;
    if (moved > 6) return; // 드래그였다
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObject(picker, false).find(h => visibleG.has(concepts[h.instanceId].galaxy));

    // 보이는 광구 안을 눌렀으면 언제나 태양이 이긴다.
    // 별의 판정 구체는 보이는 것보다 넉넉하고, 홈 시점에서 세 개가 태양 앞을 지난다.
    // 그대로 두면 책 자체를 누를 방법이 없어진다. 그 별들은 광구 바깥에서 여전히 눌린다.
    const sunAt = group.localToWorld(new THREE.Vector3(0, 0, 0));
    if (ray.ray.distanceToPoint(sunAt) < SUN_R * 1.15) { onSelect('__sun__'); return; }

    if (hit) { onSelect(concepts[hit.instanceId].id); return; }
    if (ray.intersectObject(sunPicker, false).length) onSelect('__sun__');
  });

  function doHover() {
    if (!pointerMoved || !pointerOnScreen) return;
    pointerMoved = false;
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObject(picker, false);
    const i = hit.length ? hit[0].instanceId : -1;
    if (i === hoverIdx) return;
    hoverIdx = i;
    if (i < 0 || !visibleG.has(concepts[i].galaxy)) {
      hoverObj.visible = false;
      canvas.style.cursor = '';
      return;
    }
    const c = concepts[i];
    hoverDiv.textContent = c.name;
    hoverObj.visible = true;
    const world = new THREE.Vector3(...c.position);
    group.localToWorld(world);
    hoverObj.position.copy(world);
    canvas.style.cursor = 'pointer';
  }

  // 루프
  let motion = true, rotationPaused = false, glowOn = true;
  const deltas = [];
  let last = performance.now();
  let introPlaying = false;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    deltas.push(now - last);
    if (deltas.length > 120) deltas.shift();
    last = now;

    if (motion && !rotationPaused && !introPlaying) {
      group.rotation.y += dt * (Math.PI * 2 / ROT_PERIOD);
    }
    if (motion) {
      starUniforms.uTime.value += dt;
      sunMat.uniforms.uTime.value += dt;
      coronaMat.uniforms.uTime.value += dt;
    }
    // 태양의 겉보기 반경(CSS px)으로 글레어 양을 정한다
    {
      const K = (0.5 * innerHeight) / Math.tan((camera.fov * Math.PI / 180) / 2);
      const px = SUN_R * K / Math.max(camera.position.length(), 0.001);
      const glare = 1 - Math.min(Math.max((px - 26) / 110, 0), 1);
      sunMat.uniforms.uGlare.value = glare;
      coronaMat.uniforms.uGlare.value = glare;
    }

    if (tween) {
      const k = Math.min((now - tween.t0) / tween.dur, 1);
      const e = easeInOutCubic(k);
      camera.position.lerpVectors(tween.start, tween.end, e);
      controls.target.lerpVectors(tween.startT, tween.endT, e);
      if (k >= 1) { const cb = tween.onDone; tween = null; controls.enabled = true; cb && cb(); }
    } else if (!introPlaying) {
      controls.update();
    }

    doHover();
    for (const o of labelObjs) o.visible = visibleG.has(o.userData.galaxy);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 인트로: 태양 근접 → 홈으로 줌아웃
  function playIntro(onDone) {
    introPlaying = true;
    camera.position.set(0, 4, 14);
    controls.target.set(0, 0, 0);
    flyTo(new THREE.Vector3(0, 0, 0), 0, 3200, () => { introPlaying = false; onDone && onDone(); });
    tween.end = new THREE.Vector3(0, 0.6 * R_HOME, 1.8 * R_HOME);
  }
  // 스크롤 진행도로 카메라를 태양 근처에서 홈까지 끌어낸다.
  // 표지에서 빠져나오는 동작과 은하로 나오는 동작이 하나로 이어진다.
  const INTRO_FROM = new THREE.Vector3(0, 1.4, 8.6);
  const INTRO_TO = new THREE.Vector3(0, 0.6 * R_HOME, 1.8 * R_HOME);
  function setIntroProgress(p) {
    const k = Math.min(Math.max(p, 0), 1);
    introPlaying = k < 1;
    controls.enabled = !introPlaying;
    controls.target.set(0, 0, 0);
    camera.position.lerpVectors(INTRO_FROM, INTRO_TO, easeInOutCubic(k));
    camera.lookAt(0, 0, 0);
    if (!introPlaying) controls.update(); // 현재 위치를 컨트롤에 넘긴다
  }

  function skipIntro() {
    if (tween) { tween = null; controls.enabled = true; }
    introPlaying = false;
    camera.position.set(0, 0.6 * R_HOME, 1.8 * R_HOME);
    controls.target.set(0, 0, 0);
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    labelRenderer.setSize(innerWidth, innerHeight);
    starUniforms.uViewportH.value = innerHeight * renderer.getPixelRatio();
  }
  addEventListener('resize', onResize);
  // 임베디드 뷰 등에서 초기 innerWidth가 틀린 채 부팅되는 경우의 안전망
  setInterval(() => {
    if (Math.abs(canvas.clientWidth - innerWidth) > 2) onResize();
  }, 1000);

  return {
    flyToStar, flyHome, showEdgesFor, setFilter, setVisited, setSelected,
    playIntro, skipIntro, setIntroProgress,
    setMotion(v) { motion = v; starUniforms.uTwinkle.value = v ? 1 : 0; },
    pauseRotation(v) { rotationPaused = v; },
    avgFrame() { return deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0; },
    isIntro() { return introPlaying; },
    degrade(step) {
      if (step === 1 && dprCap !== 1) {
        dprCap = 1; renderer.setPixelRatio(1);
        starUniforms.uViewportH.value = innerHeight;
        return 'DPR 1로 하향';
      }
      if (step === 2 && glowOn) {
        glowOn = false;
        starUniforms.uSpike.value = 0;
        starUniforms.uTwinkle.value = 0;
        coronaMat.uniforms.uSize.value = 22;
        return '회절·섬광 제거';
      }
      if (step === 3 && motion) { motion = false; return '회전 정지'; }
      return null;
    },
  };
}
