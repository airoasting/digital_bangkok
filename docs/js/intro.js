// intro.js — 표지에서 영상으로, 영상에서 은하로.
//
// 세 막으로 간다. 표지(cover) → 책 소개 영상(film) → 우주(warp).
// 표지에서 아래로 스크롤하면 영상이 재생되고, 영상이 끝나면 마지막 프레임이
// 망점째로 흩어져 별이 된다. 영상의 마지막 장면은 검은 바탕에 파란 하프톤 스카이라인이고,
// 은하는 점광원의 집합이다. 그래서 전환은 페이드가 아니라 망점이 떨어져 나와 별이 되는 것이다.
//
// 표지에서 '바로 들어가기'를 누르면 영상을 건너뛰고 표지의 인쇄 잉크가 그대로 흩어진다.
// 영상 도중의 '건너뛰기'는 그 순간의 프레임을 흩는다. 어느 길이든 전환은 같은 문법이다.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p, a, b) => clamp01((p - a) / (b - a));

// 망점이 떠오르며 식는 램프. 표지의 코발트에서 시작해 별빛으로 간다.
const RAMP = ['#013C96', '#1B54B8', '#3E75D8', '#6E9BEE', '#A8C4F7', '#E4EDFF'];
const SPRITES = 6;

// 지면이 식어 가는 경로. 색은 모두 표지, 영상, 씬에서 그대로 가져왔다.
const PAPER = [245, 241, 232];
const INK_DEEP = [1, 36, 92];   // 표지 코발트의 그늘
const FILM_BG = [10, 10, 10];   // 영상의 검은 레지스터
const SPACE = [5, 6, 13];

const WARP_MS = 2400;     // 영상에서 우주로. 사용자가 손을 뗀 상태라 시간으로 굴린다
const COVER_MS = 2600;    // 표지에서 곧장 우주로
const RETURN_MS = 1400;   // 은하에서 표지로

// 구멍이 아직 없으면 마스크를 걸지 않는다. 반지름 0짜리 그라디언트도 중심을 흐린다.
function setMask(el, r, feather, tail) {
  const v = r < 0 ? 'none'
    : `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) ${r - feather}%, rgba(0,0,0,1) ${r + tail}%)`;
  el.style.webkitMaskImage = v;
  el.style.maskImage = v;
}

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

// 그림을 격자로 훑어 바탕과 다른 칸만 점으로 남긴다.
// 표지는 밝은 종이에 잉크라 어두운 칸을, 영상은 검은 바탕에 빛이라 밝은 칸을 줍는다.
// 영상을 도중에 건너뛰면 밝은 장면일 수도 있으니 프레임 평균으로 판단한다.
function sampleDots(src, sw, sh, gx) {
  const gy = Math.max(1, Math.round(gx * (sh / sw)));
  const c = document.createElement('canvas');
  c.width = gx; c.height = gy;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, gx, gy);
  const px = g.getImageData(0, 0, gx, gy).data;

  const lums = new Float32Array(gx * gy);
  let sum = 0;
  for (let i = 0; i < lums.length; i++) {
    const l = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
    lums[i] = l; sum += l;
  }
  const lightGround = sum / lums.length > 0.45;

  const dots = [];
  let s = 20260718;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  for (let y = 0; y < gy; y++) {
    for (let x = 0; x < gx; x++) {
      const lum = lums[y * gx + x];
      let weight;
      if (lightGround) {
        if (lum > 0.55) continue;                     // 종이
        weight = 1 - lum;
      } else {
        if (lum < 0.12) continue;                     // 검은 바탕
        weight = 0.45 + 0.55 * clamp01((lum - 0.12) / 0.6);
      }
      const u = (x + 0.5) / gx, v = (y + 0.5) / gy;
      // 한가운데에서 바깥으로 열린다. 태양이 뜨는 자리와 같은 지점이다.
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
        dark: weight,
      });
    }
  }
  return dots;
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createIntro({ onProgress, onDone, onSleep = () => {} }) {
  const root = document.getElementById('intro');
  const paper = document.getElementById('intro-paper');
  const stage = document.getElementById('intro-stage');
  const img = document.getElementById('cover-img');
  const canvas = document.getElementById('cover-dots');
  const meta = document.getElementById('intro-meta');
  const line = document.getElementById('intro-line');
  const cue = document.getElementById('intro-cue');
  const skip = document.getElementById('intro-skip');
  const film = document.getElementById('intro-film');
  const video = document.getElementById('intro-video');
  const filmCanvas = document.getElementById('film-canvas');
  const fctx = filmCanvas.getContext('2d', { alpha: false });
  const filmBar = document.getElementById('film-bar');
  const soundBtn = document.getElementById('film-sound');
  const filmSkip = document.getElementById('film-skip');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  // 망점은 흐린 광점이라 고해상도가 필요 없다. 화면 전체 캔버스라 배율이 곧 비용이다.
  const dpr = Math.min(devicePixelRatio || 1, 1.5);

  // cover: 표지 / film: 영상 재생 / warp: 우주로 흩어지는 중 / done: 은하 / return: 표지로 돌아오는 중
  let phase = 'cover';
  let ready = false;          // 은하가 준비되기 전에는 표지가 로딩 화면이다
  let source = 'cover';       // 지금 흩고 있는 것. 'cover' 또는 'film'
  let dots = [];
  let sprites = [];
  let box = { cx: 0, cy: 0, w: 0, h: 0 };   // 흩을 그림의 사각형 (표지는 배율 1 기준)
  let view = { w: 0, h: 0 };
  let stageScale = 1;
  let filmOk = true;          // 영상이 깨졌으면 표지에서 곧장 흩는다
  let armed = false, doneAt = 0, upDelta = 0;
  let gestureAt = 0;          // 막이 바뀐 직후 관성 스크롤의 여진을 흘려보낸다
  let wheelDown = 0, wheelUp = 0;
  let tween = 0;

  // 영상 프레임을 캔버스에 contain으로 옮겨 그린다. 새 프레임이 나올 때만 그린다.
  let filmLoop = 0;
  function sizeFilm() {
    filmCanvas.width = Math.round(innerWidth * dpr);
    filmCanvas.height = Math.round(innerHeight * dpr);
  }
  function paintFilm() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return;
    const W = filmCanvas.width, H = filmCanvas.height;
    const k = Math.min(W / vw, H / vh);
    const dw = vw * k, dh = vh * k;
    fctx.fillStyle = '#0A0A0A';
    fctx.fillRect(0, 0, W, H);
    fctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  function startFilmLoop() {
    stopFilmLoop();
    if (video.requestVideoFrameCallback) {
      const tick = () => { paintFilm(); filmLoop = video.requestVideoFrameCallback(tick); };
      filmLoop = video.requestVideoFrameCallback(tick);
    } else {
      const tick = () => { paintFilm(); filmLoop = requestAnimationFrame(tick); };
      filmLoop = requestAnimationFrame(tick);
    }
  }
  function stopFilmLoop() {
    if (!filmLoop) return;
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(filmLoop);
    else cancelAnimationFrame(filmLoop);
    filmLoop = 0;
  }

  function measure() {
    view = { w: innerWidth, h: innerHeight };
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';
    if (source === 'cover') {
      const r = img.getBoundingClientRect();
      const s = stageScale || 1;
      box = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width / s, h: r.height / s };
    } else {
      // object-fit: contain 이 실제로 그린 영역
      const vw = video.videoWidth || 1920, vh = video.videoHeight || 1080;
      const k = Math.min(view.w / vw, view.h / vh);
      box = { cx: view.w / 2, cy: view.h / 2, w: vw * k, h: vh * k };
    }
  }

  function draw(p, scale) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    if (p <= 0.06 || !dots.length) return;
    const bw = box.w * scale, bh = box.h * scale;

    // 망점이 화면에서 분리되는 순간
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

  // 전환 한 프레임. p는 0(표지 또는 영상)에서 1(은하)까지.
  function apply(p) {
    if (source === 'cover') {
      // 종이가 우주로 식는다. 크림에서 검정으로 곧장 가면 중간이 회색으로 탁해지므로
      // 표지의 코발트를 경유한다. 지면은 한가운데부터 뚫리고 구멍 안에는 진짜 우주가 있다.
      const hole = seg(p, 0.11, 0.74);
      setMask(paper, hole > 0 ? hole * 150 : -1, 14, 20);
      const cool = seg(p, 0.52, 0.76);
      const [r0, g0, b0] = cool < 0.5
        ? mix(PAPER, INK_DEEP, cool / 0.5)
        : mix(INK_DEEP, SPACE, (cool - 0.5) / 0.5);
      paper.style.background = `rgb(${r0}, ${g0}, ${b0})`;
      // 인쇄면은 잉크가 떠난 자리부터, 한가운데에서 바깥으로 지워진다.
      const front = seg(p, 0.09, 0.44);
      setMask(img, front > 0 ? front * 108 : -1, 10, 22);
      img.style.opacity = String(1 - seg(p, 0.46, 0.56));
      img.style.boxShadow = seg(p, 0.04, 0.22) > 0.98 ? 'none' : '';
      stageScale = 1 + 0.07 * seg(p, 0, 0.6);
      stage.style.transform = `scale(${stageScale})`;
      meta.style.opacity = String(1 - seg(p, 0.03, 0.20));
      skip.style.opacity = String(1 - seg(p, 0.05, 0.3));
      draw(p, stageScale);
    } else {
      // 영상의 검은 바탕은 이미 우주에 가깝다. 그래서 마스크로 구멍을 뚫지 않고 투명도만 쓴다.
      // 화면 전체에 매 프레임 마스크를 다시 그리는 것이 전환을 무겁게 하던 주범이었다.
      // 마지막 프레임은 망점이 떠오르는 동안 재빨리 빠지고, 지면은 그 뒤를 따라 걷힌다.
      filmCanvas.style.opacity = String(1 - seg(p, 0.06, 0.24));
      paper.style.opacity = String(1 - seg(p, 0.15, 0.6));
      draw(p, 1);
    }
    onProgress(p);
  }

  function run(from, to, dur, onEnd) {
    cancelAnimationFrame(tween);
    if (reduced || dur <= 0) { apply(to); onEnd && onEnd(); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      apply(from + (to - from) * easeInOutCubic(k));
      if (k < 1) tween = requestAnimationFrame(step);
      else onEnd && onEnd();
    };
    tween = requestAnimationFrame(step);
  }

  // ── 1막 → 2막: 영상 ─────────────────
  function setSoundLabel() {
    soundBtn.textContent = video.muted ? '소리 켜기' : '소리 끄기';
    soundBtn.setAttribute('aria-pressed', String(!video.muted));
  }

  async function playFilm() {
    if (phase !== 'cover' || !ready) return;
    if (!filmOk || reduced) { warp('cover'); return; }
    phase = 'film';
    gestureAt = performance.now();
    sizeFilm();
    fctx.fillStyle = '#0A0A0A';
    fctx.fillRect(0, 0, filmCanvas.width, filmCanvas.height);
    film.hidden = false;
    startFilmLoop();
    filmBar.hidden = false;
    // 다음 프레임에 켜야 투명도 전환이 걸린다
    requestAnimationFrame(() => { film.classList.add('on'); filmBar.classList.add('on'); });
    meta.style.opacity = '0';
    skip.style.opacity = '0';
    skip.style.pointerEvents = 'none';

    // 소리와 함께 재생한다. 휠 스크롤은 브라우저가 사용자 동작으로 쳐 주지 않아
    // 소리 재생이 막힐 수 있다. 그때는 음소거로 이어 가고 '소리 켜기'를 띄운다.
    video.muted = false;
    try {
      await video.play();
    } catch (err) {
      if (phase !== 'film') return;
      video.muted = true;
      try { await video.play(); } catch { if (phase === 'film') warp('film'); return; }
    }
    setSoundLabel();
  }

  // 영상 도중 위로 스크롤하면 표지로 물러난다
  function backToCover() {
    if (phase !== 'film') return;
    phase = 'cover';
    gestureAt = performance.now();
    video.pause();
    stopFilmLoop();
    film.classList.remove('on');
    filmBar.classList.remove('on');
    setTimeout(() => {
      if (phase !== 'cover') return;
      film.hidden = true;
      filmBar.hidden = true;
      video.currentTime = 0;
    }, 500);
    meta.style.opacity = '1';
    skip.style.opacity = '1';
    skip.style.pointerEvents = 'auto';
  }

  // ── 2막 → 3막: 우주 ─────────────────
  function warp(from) {
    if (phase === 'warp' || phase === 'done' || phase === 'return') return;
    phase = 'warp';
    source = from;
    gestureAt = performance.now();
    cancelAnimationFrame(tween);
    filmBar.classList.remove('on');
    skip.style.pointerEvents = 'none';

    if (from === 'film') {
      video.pause();
      stopFilmLoop();
      paintFilm();   // 멈춘 그 프레임이 화면에 남아 있어야 망점과 겹친다
      // 영상 판 뒤의 지면을 영상 바탕색으로 바꿔 두고, 판은 투명하게 연다
      paper.style.background = `rgb(${FILM_BG.join(', ')})`;
      film.classList.add('warp');
      stage.style.visibility = 'hidden';
    }
    onSleep(false);
    measure();
    if (!reduced) {
      try {
        dots = from === 'film'
          ? sampleDots(video, video.videoWidth || 1920, video.videoHeight || 1080, innerWidth < 720 ? 56 : 80)
          : sampleDots(img, img.naturalWidth, img.naturalHeight, innerWidth < 720 ? 56 : 76);
      } catch { dots = []; }   // 프레임을 못 읽어도 전환은 이어 간다
    }
    run(0, 1, from === 'film' ? WARP_MS : COVER_MS, finish);
  }

  function finish() {
    phase = 'done';
    root.classList.add('done');
    document.body.classList.remove('intro-on');
    film.hidden = true;
    filmBar.hidden = true;
    onProgress(1);
    onDone();
    // 지우지 않는다. 위로 스크롤하거나 로고를 누르면 표지로 돌아와야 한다.
    doneAt = performance.now();
    armed = true;
    upDelta = 0;
  }

  // ── 은하 → 표지 ─────────────────────
  // 망점을 거꾸로 모으지 않는다. 마지막 장면은 영상이었으니 되감으면 영상이 나와야 하는데,
  // 그건 다시 볼 사람이 고를 일이다. 표지를 그대로 다시 세우고 손잡이를 돌려준다.
  function resetCover() {
    source = 'cover';
    dots = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setMask(paper, -1);
    paper.style.background = '';
    paper.style.opacity = '';
    setMask(img, -1);
    img.style.opacity = '';
    img.style.boxShadow = '';
    stageScale = 1;
    stage.style.transform = '';
    stage.style.visibility = '';
    meta.style.opacity = '1';
    skip.style.opacity = '1';
    skip.style.pointerEvents = 'auto';
    video.pause();
    stopFilmLoop();
    video.currentTime = 0;
    filmCanvas.style.opacity = '';
    film.classList.remove('on', 'warp');
    filmBar.classList.remove('on');
    film.hidden = true;
    filmBar.hidden = true;
    measure();
  }

  function reopen() {
    if (phase !== 'done') return;
    phase = 'return';
    armed = false;
    resetCover();
    root.style.transition = 'opacity 0.9s ease';
    root.style.opacity = '0';
    root.classList.remove('done');
    document.body.classList.add('intro-on');
    void root.offsetWidth;
    root.style.opacity = '1';
    // 표지가 덮는 동안 카메라도 출발점으로 돌려 둔다. 다음 진입이 같은 동선을 타도록.
    cancelAnimationFrame(tween);
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min((now - t0) / RETURN_MS, 1);
      onProgress(1 - easeInOutCubic(k));
      if (k < 1) tween = requestAnimationFrame(step);
      else {
        root.style.transition = '';
        phase = 'cover';
        onSleep(true);
        gestureAt = performance.now();
      }
    };
    tween = requestAnimationFrame(step);
  }

  // ── 입력 ──────────────────────────
  const settled = () => performance.now() - gestureAt > 600;

  // 표지에서 아래로 스크롤하면 영상, 영상에서 위로 스크롤하면 표지.
  // 영상 도중 아래로 스크롤은 무시한다. 관성 한 번에 영상이 잘려 나가지 않게.
  root.addEventListener('wheel', (e) => {
    if (phase === 'done') return;
    e.preventDefault();
    if (!settled()) { wheelDown = wheelUp = 0; return; }
    if (e.deltaY > 0) { wheelDown += e.deltaY; wheelUp = 0; }
    else { wheelUp -= e.deltaY; wheelDown = 0; }
    if (phase === 'cover' && wheelDown > 40) { wheelDown = 0; playFilm(); }
    else if (phase === 'film' && wheelUp > 80) { wheelUp = 0; backToCover(); }
  }, { passive: false });

  // 터치는 손을 떼는 순간 판정한다. touchend는 사용자 동작이라 소리도 함께 열린다.
  let touchY = null;
  root.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  root.addEventListener('touchmove', (e) => { if (phase !== 'done') e.preventDefault(); }, { passive: false });
  root.addEventListener('touchend', (e) => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (!settled()) return;
    if (phase === 'cover' && dy > 40) playFilm();
    else if (phase === 'film' && dy < -60) backToCover();
  });

  // 표지를 누르는 것도 진입이다. 클릭은 소리가 막히지 않는다.
  root.addEventListener('click', (e) => {
    if (phase !== 'cover' || e.target.closest('button')) return;
    playFilm();
  });

  skip.addEventListener('click', () => { if (phase === 'cover' && ready) warp('cover'); });
  filmSkip.addEventListener('click', () => { if (phase === 'film') warp('film'); });
  soundBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    if (video.paused && phase === 'film') video.play().catch(() => {});
    setSoundLabel();
  });
  video.addEventListener('ended', () => { if (phase === 'film') warp('film'); });
  video.addEventListener('error', () => {
    filmOk = false;
    if (phase === 'film') warp('cover');
  });

  addEventListener('keydown', (e) => {
    if (phase === 'cover' && ready) {
      if (e.key === 'Escape') { e.preventDefault(); warp('cover'); }
      else if (['Enter', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); playFilm(); }
    } else if (phase === 'film') {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); warp('film'); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); backToCover(); }
    }
  });

  addEventListener('resize', () => {
    measure();
    if (phase === 'film') { sizeFilm(); paintFilm(); }
    if (phase === 'cover') apply(0);
  });

  // 은하에 막 도착해 아직 아무것도 건드리지 않았다면, 위로 스크롤은 표지로 돌아간다.
  // 한 번이라도 돌리거나 누르거나 줌아웃하면 휠은 본래대로 확대/축소로 돌아간다.
  addEventListener('wheel', (e) => {
    if (phase !== 'done' || !armed) return;
    if (performance.now() - doneAt < 500) return;   // 관성 스크롤의 여진
    if (e.deltaY > 0) { armed = false; upDelta = 0; return; }
    upDelta += -e.deltaY;
    if (upDelta < 60) return;
    e.preventDefault();
    reopen();
  }, { passive: false });
  addEventListener('pointerdown', () => { if (phase === 'done') armed = false; });

  document.body.classList.add('intro-on');
  onSleep(true);

  return {
    // 헤더 로고를 누르면 표지로 되돌아간다
    reopen,
    // 은하가 준비되면 표지에 손잡이를 준다
    async open(total) {
      try { await img.decode(); } catch { /* 이미지가 없어도 인트로는 진행된다 */ }
      measure();
      sprites = makeSprites(dpr);
      line.textContent = `책 한 권이 별 ${total}개가 됩니다`;
      cue.hidden = reduced;
      skip.hidden = false;
      if (reduced) skip.textContent = '들어가기';
      ready = true;
      apply(0);
    },
  };
}
