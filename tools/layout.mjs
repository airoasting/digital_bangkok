// layout.mjs — 결정론적 은하 좌표 계산 (Plan.md 6.2)
// 모델: 태양 중심 단일 은하 + 부별 나선팔 5개, 부록은 외곽 소행성대(도넛).
// 시드 고정(mulberry32)이라 같은 입력이면 언제나 같은 은하가 나온다.

export const PARAMS = {
  R_INNER: 9,
  R_OUTER: 44,
  ARM_WIND: 2.2,      // θ = θg + ARM_WIND·ln(r/R_INNER), 팔 감김 정도
  H_BULGE: 12,        // 중심 팽대부의 수직 두께
  H_DISC: 3.6,        // 원반 바깥의 수직 두께
  MARGIN: 1.7,        // 별 간 최소 여백
  BELT_IN: 48,        // 부록 도넛 안쪽 반지름
  BELT_OUT: 53,       // 부록 도넛 바깥 반지름
  BELT_H: 4.2,        // 부록 도넛 굵기
  BELT_TILT: 0.26,    // 부록 도넛 기울기(rad)
  ARM_SPREAD: 0.30,   // 팔 방향 각도 지터
  // 팔마다 원반면에서 조금씩 기운다. 위에서 봐도 옆에서 봐도 서로 겹치지 않는다.
  ARM_TILT: [-0.44, 0.26, -0.15, 0.41, -0.32],
  WARP: 0.22,         // 바깥으로 갈수록 원반이 휘는 정도
};

// 중심은 두껍고 바깥은 얇다. 실제 은하의 팽대부와 원반.
function thickness(P, t) {
  return P.H_DISC + (P.H_BULGE - P.H_DISC) * Math.pow(1 - t, 2.2);
}

// 균일 난수를 겹쳐 종 모양으로 만든다. 대부분 원반면 근처, 일부만 멀리.
function bell(rand) {
  return (rand() + rand() + rand() - 1.5) / 1.5;
}

// x축 기준 회전. 팔을 원반면에서 기울일 때 쓴다.
function tiltX(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function starRadius(importance) {
  return 0.35 + 0.22 * importance;
}

function dist3(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * concepts: [{ id, galaxy(1..6), importance(1..5) }] — 원본 배열을 변형하지 않는다.
 * 반환: Map<id, [x,y,z]>
 */
export function layoutConcepts(concepts, seed = 20260718) {
  const P = PARAMS;
  const rand = mulberry32(seed);
  const placed = []; // { pos, s }
  const out = new Map();

  const place = (pos, s) => { placed.push({ pos, s }); };
  const collides = (pos, s) =>
    placed.some(p => dist3(p.pos, pos) < p.s + s + P.MARGIN);

  // 팔(1~5부): importance 내림차순, 큰 별이 태양 가까이
  for (let g = 1; g <= 5; g++) {
    const arm = concepts
      .filter(c => c.galaxy === g)
      .sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));
    const N = Math.max(arm.length, 1);
    const thetaG = (g - 1) * (2 * Math.PI / 5);
    const tilt = P.ARM_TILT[(g - 1) % P.ARM_TILT.length];

    arm.forEach((c, i) => {
      const s = starRadius(c.importance);
      const t = N === 1 ? 0.5 : i / (N - 1);
      let r = P.R_INNER + t * (P.R_OUTER - P.R_INNER);
      let pos = null;
      for (let attempt = 0; attempt < 14; attempt++) {
        const jTheta = (rand() - 0.5) * 2 * P.ARM_SPREAD;
        const jR = (rand() - 0.5) * 2.5;
        const rr = Math.max(P.R_INNER * 0.9, r + jR);
        const theta = thetaG + P.ARM_WIND * Math.log(rr / P.R_INNER) + jTheta;
        // 팽대부에서 두껍고 바깥에서 얇다. 여기에 바깥일수록 커지는 휨을 더한다.
        const y = bell(rand) * thickness(P, t)
          + P.WARP * rr * Math.pow(rr / P.R_OUTER, 2) * Math.sin(theta - 0.7) / 3;
        const cand = tiltX([rr * Math.cos(theta), y, rr * Math.sin(theta)], tilt);
        if (!collides(cand, s)) { pos = cand; break; }
        if (attempt === 9) r += P.MARGIN * 2; // 재샘플 실패 시 바깥으로 민다
      }
      if (!pos) { // 최후: 반지름을 키워 강제 배치
        const theta = thetaG + P.ARM_WIND * Math.log((r + 4) / P.R_INNER);
        pos = tiltX([(r + 4) * Math.cos(theta), bell(rand) * thickness(P, t), (r + 4) * Math.sin(theta)], tilt);
      }
      place(pos, s);
      out.set(c.id, pos.map(v => Math.round(v * 100) / 100));
    });
  }

  // 부록(6): 소행성대 도넛
  const belt = concepts
    .filter(c => c.galaxy === 6)
    .sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  belt.forEach((c, i) => {
    const s = starRadius(c.importance);
    let pos = null;
    for (let attempt = 0; attempt < 14; attempt++) {
      const theta = i * GOLDEN + (rand() - 0.5) * 0.25;
      const rr = P.BELT_IN + rand() * (P.BELT_OUT - P.BELT_IN);
      const y = bell(rand) * P.BELT_H;
      const cand = tiltX([rr * Math.cos(theta), y, rr * Math.sin(theta)], P.BELT_TILT);
      if (!collides(cand, s)) { pos = cand; break; }
    }
    if (!pos) pos = tiltX([(P.BELT_OUT + 2) * Math.cos(i * GOLDEN), bell(rand) * P.BELT_H, (P.BELT_OUT + 2) * Math.sin(i * GOLDEN)], P.BELT_TILT);
    place(pos, s);
    out.set(c.id, pos.map(v => Math.round(v * 100) / 100));
  });

  return out;
}

/** 위에서 내려다본 2D 산점도 SVG (점검 3-a용) */
export function previewSVG(concepts, positions, galaxies) {
  const W = 900, C = W / 2, SC = W / 2 / (PARAMS.BELT_OUT + 6);
  const colorOf = Object.fromEntries(galaxies.map(g => [g.id, g.color]));
  const dots = concepts.map(c => {
    const p = positions.get(c.id);
    if (!p) return '';
    const x = C + p[0] * SC, y = C + p[2] * SC;
    const r = starRadius(c.importance) * SC;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${colorOf[c.galaxy] || '#888'}" opacity="0.9"><title>${c.id} (g${c.galaxy}, i${c.importance})</title></circle>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" style="background:#070A14">
<circle cx="${C}" cy="${C}" r="${4 * SC}" fill="#E8A33D"/>
${dots}
</svg>`;
}
