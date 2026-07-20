// intro.js — 표지에서 은하로.
//
// 표지는 방콕 스카이라인을 파란 하프톤 망점으로 인쇄한 것이고, 은하는 점광원의 집합이다.
// 그래서 전환은 페이드가 아니라, 인쇄된 잉크가 떨어져 나와 별이 되는 것이다.
// 표지 이미지를 격자로 샘플링해 잉크 칸만 점으로 남기고, 스크롤 진행도에 따라
// 아래에서부터 떠올려 흩는다. 같은 스크롤이 카메라도 태양 근처에서 홈까지 끌어낸다.
//
// 진행도 p는 오직 스크롤에서만 온다. 시간 기반 애니메이션을 섞지 않는다.
// 사용자가 멈추면 그림도 멈춘다.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p, a, b) => clamp01((p - a) / (b - a));

// 잉크가 떠오르며 식는 램프. 표지의 코발트에서 시작해 별빛으로 간다.
const RAMP = ['#013C96', '#1B54B8', '#3E75D8', '#6E9BEE', '#A8C4F7', '#E4EDFF'];
const SPRITES = 6;

// 지면이 식어 가는 경로. 세 색 모두 표지와 씬에서 그대로 가져왔다.
const PAPER = [245, 241, 232];
const INK_DEEP = [1, 36, 92];   // 표지 코발트의 그늘
const SPACE = [5, 6, 13];
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

function makeSprites(dpr) {
  return RAMP.map((hex) => {
    const size = Math.round(26 * dpr);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, hex);
    grad.addColorStop(0.42, hex + 'cc');
    grad.addColorStop(1, hex + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  });
}

// 표지를 격자로 훑어 잉크 칸만 남긴다. 밝은 종이 칸은 버린다.
function sampleInk(img, gx) {
  const gy = Math.round(gx * (img.naturalHeight / img.naturalWidth));
  const c = document.createElement('canvas');
  c.width = gx; c.height = gy;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, gx, gy);
  const px = g.getImageData(0, 0, gx, gy).data;

  const dots = [];
  let s = 20260718;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  for (let y = 0; y < gy; y++) {
    for (let x = 0; x < gx; x++) {
      const i = (y * gx + x) * 4;
      const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
      if (lum > 0.55) continue;                 // 종이
      const u = (x + 0.5) / gx, v = (y + 0.5) / gy;
      // 표지 한가운데에서 바깥으로 열린다. 태양이 뜨는 자리와 같은 지점이다.
      const dx = (u - 0.5) / 0.5, dy = (v - 0.5) / 0.5;
      const nd = Math.min(Math.hypot(dx, dy) / Math.SQRT2, 1);   // 중심 0, 모서리 1
      const len = Math.hypot(dx, dy) || 0.001;
      const spread = 1.0 + rnd() * 1.4;
      dots.push({
        u, v,
        // 중심이 먼저 풀리고 가장자리가 마지막에 놓인다
        delay: 0.10 + 0.30 * nd + 0.08 * rnd(),
        vx: (dx / len) * spread + (rnd() - 0.5) * 0.35,
        vy: (dy / len) * spread * 0.78 + (rnd() - 0.5) * 0.35,
        size: 0.7 + rnd() * 0.8,
        dark: 1 - lum,
      });
    }
  }
  return dots;
}

export function createIntro({ onProgress, onDone }) {
  const root = document.getElementById('intro');
  const paper = document.getElementById('intro-paper');
  const stage = document.getElementById('intro-stage');
  const scroller = document.getElementById('intro-scroll');
  const img = document.getElementById('cover-img');
  const canvas = document.getElementById('cover-dots');
  const meta = document.getElementById('intro-meta');
  const line = document.getElementById('intro-line');
  const cue = document.getElementById('intro-cue');
  const skip = document.getElementById('intro-skip');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);

  let dots = [];
  let sprites = [];
  let box = { cx: 0, cy: 0, w: 0, h: 0 };   // 배율 1일 때의 표지 사각형
  let view = { w: 0, h: 0 };
  let stageScale = 1;
  let lastP = 0;
  let raf = 0, pending = false, finished = false;

  function resize() {
    const r = img.getBoundingClientRect();
    const s = stageScale || 1;
    box = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width / s, h: r.height / s };
    view = { w: innerWidth, h: innerHeight };
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';
  }

  function draw(p, scale) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    if (p <= 0.06 || !dots.length) return;
    const bw = box.w * scale, bh = box.h * scale;

    // 잉크가 인쇄면에서 분리되는 순간
    const emerge = seg(p, 0.06, 0.15);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const lift = clamp01((p - d.delay) / 0.38);
      if (lift <= 0 && emerge <= 0) continue;

      // 빠르게 흩어졌다가 잦아든다
      const e = 1 - (1 - lift) * (1 - lift) * (1 - lift);
      const x = box.cx + (d.u - 0.5) * bw + d.vx * e * bh * 0.72;
      const y = box.cy + (d.v - 0.5) * bh + d.vy * e * bh * 0.72;

      // 뜬 만큼 식으면서 옅어진다
      const alpha = emerge * d.dark * (1 - lift * lift * 0.96);
      if (alpha < 0.012) continue;
      const r = (2.2 + d.size * 2.0 + lift * 2.4);
      const spr = sprites[Math.min(SPRITES - 1, (lift * SPRITES) | 0)];

      ctx.globalAlpha = alpha;
      ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function apply(fromScroll) {
    pending = false;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const p = max > 0 ? clamp01(scroller.scrollTop / max) : 0;
    lastP = p;

    // 종이가 우주로 식는다. 크림에서 검정으로 곧장 가면 중간이 회색으로 탁해지므로
    // 표지의 코발트를 경유한다. 지면이 제 잉크색으로 어두워진 뒤 우주가 된다.
    // 지면이 한가운데부터 뚫린다. 구멍 안에는 곧바로 진짜 우주가 있다.
    const hole = seg(p, 0.11, 0.74) * 150;
    const paperMask = `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) ${hole - 14}%, rgba(0,0,0,1) ${hole + 20}%)`;
    paper.style.webkitMaskImage = paperMask;
    paper.style.maskImage = paperMask;
    // 지면은 끝까지 종이색으로 남는다. 중간에 식히면 화면 전체가 연한 청색으로 떠서
    // 표지도 망점도 대비를 잃는다. 마지막 테두리만 잉크의 그늘을 거쳐 우주로 넘긴다.
    const cool = seg(p, 0.52, 0.76);
    const [r0, g0, b0] = cool < 0.5
      ? mix(PAPER, INK_DEEP, cool / 0.5)
      : mix(INK_DEEP, SPACE, (cool - 0.5) / 0.5);
    paper.style.background = `rgb(${r0}, ${g0}, ${b0})`;
    // 안내 문구는 일찍 빠진다. 전환 자체가 설명이 된다.
    meta.style.opacity = String(1 - seg(p, 0.03, 0.20));
    // 인쇄면은 잉크가 떠난 자리부터, 한가운데에서 바깥으로 지워진다.
    // 통째로 흐려지면 반투명 직사각형이 떠 있어 전환이 둘로 갈라져 보인다.
    const front = seg(p, 0.09, 0.44) * 108;
    const mask = `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) ${front - 10}%, rgba(0,0,0,1) ${front + 22}%)`;
    img.style.webkitMaskImage = mask;
    img.style.maskImage = mask;
    img.style.opacity = String(1 - seg(p, 0.46, 0.56));
    // 반쯤 먹힌 지면에 그림자가 남아 있으면 종이처럼 보이지 않는다
    img.style.boxShadow = seg(p, 0.04, 0.22) > 0.98 ? 'none' : '';
    stageScale = 1 + 0.07 * seg(p, 0, 0.6);
    stage.style.transform = `scale(${stageScale})`;
    skip.style.opacity = String(1 - seg(p, 0.05, 0.3));
    skip.style.pointerEvents = p > 0.3 ? 'none' : 'auto';

    draw(p, stageScale);
    onProgress(p);

    // 완주 판정은 스크롤에서만 한다. 화면 크기가 바뀌며 튄 값으로 끝내지 않는다.
    if (fromScroll && p > 0.995) finish();
  }

  function onScroll() {
    if (pending || finished) return;
    pending = true;
    raf = requestAnimationFrame(() => apply(true));
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    scroller.removeEventListener('scroll', onScroll);
    root.classList.add('done');
    document.body.classList.remove('intro-on');
    onProgress(1);
    onDone();
    setTimeout(() => root.remove(), 600);
  }

  function enter() {
    if (finished) return;
    const max = scroller.scrollHeight - scroller.clientHeight;
    if (reduced) { scroller.scrollTop = max; apply(false); finish(); return; }
    scroller.scrollTo({ top: max, behavior: 'smooth' });
  }

  document.body.classList.add('intro-on');
  scroller.addEventListener('scroll', onScroll, { passive: true });
  skip.addEventListener('click', enter);
  // 화면이 바뀌어도 보고 있던 지점을 지킨다. 그러지 않으면 회전 한 번에 전환이 건너뛴다.
  addEventListener('resize', () => {
    resize();
    const max = scroller.scrollHeight - scroller.clientHeight;
    if (max > 0) scroller.scrollTop = lastP * max;
    apply(false);
  });
  addEventListener('keydown', (e) => {
    if (finished) return;
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); enter(); }
  });

  return {
    // 은하가 준비되면 표지에 손잡이를 준다
    async open(total) {
      try { await img.decode(); } catch { /* 이미지가 없어도 인트로는 진행된다 */ }
      resize();
      sprites = makeSprites(dpr);
      // 작은 화면에서는 격자를 성기게 잡는다. 점 하나가 곧 드로우콜 하나다.
      if (!reduced) dots = sampleInk(img, innerWidth < 720 ? 56 : 76);
      line.textContent = `책 한 권이 별 ${total}개가 됩니다`;
      cue.hidden = reduced;
      skip.hidden = false;
      if (reduced) skip.textContent = '들어가기';
      apply(false);
    },
  };
}
