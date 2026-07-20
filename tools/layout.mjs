// layout.mjs — 결정론적 은하 좌표 계산 (Plan.md 6.2)
// 모델: 태양 중심 단일 은하 + 부별 나선팔 5개, 부록은 외곽 소행성대(도넛).
// 시드 고정(mulberry32)이라 같은 입력이면 언제나 같은 은하가 나온다.

export const PARAMS = {
  R_INNER: 9,
  R_OUTER: 44,
  ARM_WIND: 2.2,      // θ = θg + ARM_WIND·ln(r/R_INNER), 팔 감김 정도
  H: 3,               // 수직 두께
  MARGIN: 1.7,        // 별 간 최소 여백
  BELT_IN: 48,        // 부록 도넛 안쪽 반지름
  BELT_OUT: 53,       // 부록 도넛 바깥 반지름
  ARM_SPREAD: 0.30,   // 팔 방향 각도 지터
};

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
        const falloff = 1 - 0.5 * t; // 외곽으로 갈수록 얇게
        const y = (rand() - 0.5) * 2 * P.H * falloff;
        const cand = [rr * Math.cos(theta), y, rr * Math.sin(theta)];
        if (!collides(cand, s)) { pos = cand; break; }
        if (attempt === 9) r += P.MARGIN * 2; // 재샘플 실패 시 바깥으로 민다
      }
      if (!pos) { // 최후: 반지름을 키워 강제 배치
        const theta = thetaG + P.ARM_WIND * Math.log((r + 4) / P.R_INNER);
        pos = [(r + 4) * Math.cos(theta), (rand() - 0.5) * P.H, (r + 4) * Math.sin(theta)];
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
      const y = (rand() - 0.5) * 1.6;
      const cand = [rr * Math.cos(theta), y, rr * Math.sin(theta)];
      if (!collides(cand, s)) { pos = cand; break; }
    }
    if (!pos) pos = [(P.BELT_OUT + 2) * Math.cos(i * GOLDEN), 0, (P.BELT_OUT + 2) * Math.sin(i * GOLDEN)];
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
