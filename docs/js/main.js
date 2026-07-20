// main.js — 부팅, 상태, 라우팅, 성능 하향 사다리.

import { createGalaxy } from './galaxy.js';
import { createPanel } from './panel.js';
import { createSearch, createLegend } from './search.js';
import { createTour } from './tour.js';
import { createList } from './list.js';

const $ = (s) => document.querySelector(s);
const LS = { visited: 'dbi-visited', seen: 'dbi-seen', motion: 'dbi-motion' };

const state = {
  visited: new Set(JSON.parse(localStorage.getItem(LS.visited) || '[]')),
  returning: localStorage.getItem(LS.seen) === '1',
  motion: true,
};

const prefersStatic = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saved = localStorage.getItem(LS.motion);
state.motion = saved !== null ? saved === '1' : !prefersStatic;

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

async function boot() {
  const res = await fetch('./data/concepts.json');
  const data = await res.json();
  const byId = new Map(data.concepts.map(c => [c.id, c]));
  const total = data.concepts.length;

  $('#load-count').textContent = `별 ${total}개를 만드는 중`;

  const galaxy = createGalaxy({
    canvas: $('#stage'),
    data,
    onSelect: (id) => select(id, { fly: true }),
  });
  galaxy.setMotion(state.motion);
  syncMotionButton();

  // ── 진행/방문 ──────────────────────
  function saveVisited() { localStorage.setItem(LS.visited, JSON.stringify([...state.visited])); }
  function updateProgress() {
    $('#progress').innerHTML = `읽은 별 <b>${state.visited.size}</b> / ${total}`;
  }
  state.visited.forEach(id => galaxy.setVisited(id));
  updateProgress();

  // ── 패널 ─────────────────────────
  const panel = createPanel({
    el: $('#panel'), body: $('#panel-body'),
    closeBtn: $('#panel-close'), grip: $('#sheet-grip'),
    data,
    onPick: (id) => select(id, { fly: true }),
    onShare: (id) => {
      const url = new URL(`c/${id}.html`, location.href.split('#')[0]).href;
      navigator.clipboard?.writeText(url)
        .then(() => toast('별 링크를 복사했습니다'))
        .catch(() => toast(url));
    },
    onClose: () => {
      galaxy.showEdgesFor(null);
      galaxy.setSelected(null);
      galaxy.pauseRotation(false);
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    },
  });

  function nextRec(c) {
    const cand = (c.related || []).map(id => byId.get(id)).filter(Boolean);
    if (!cand.length) return null;
    const unvisited = cand.filter(r => !state.visited.has(r.id));
    const pool = unvisited.length ? unvisited : cand;
    return pool.sort((a, b) => b.importance - a.importance)[0];
  }

  function select(id, { fly = true, hash = true } = {}) {
    if (list.isOpen()) list.close();
    if (id !== '__sun__' && !byId.has(id)) return;
    galaxy.clearPulse();
    galaxy.pauseRotation(true);
    galaxy.setSelected(id === '__sun__' ? null : id);
    galaxy.showEdgesFor(id === '__sun__' ? null : id);
    if (fly) (id === '__sun__' ? galaxy.flyHome() : galaxy.flyToStar(id));
    const c = id === '__sun__' ? null : byId.get(id);
    panel.open(id, { nextRec: c ? nextRec(c) : null, visited: state.visited });
    if (c && !state.visited.has(id)) {
      state.visited.add(id);
      galaxy.setVisited(id);
      saveVisited();
      updateProgress();
    }
    if (hash) history.replaceState(null, '', id === '__sun__' ? '#about' : '#' + id);
  }

  // ── 검색, 범례, 목록 ───────────────
  createSearch({
    input: $('#search-input'), resultsEl: $('#search-results'), data,
    onPick: (id) => select(id),
  });
  createLegend({
    el: $('#legend'), data,
    onChange: (gs) => galaxy.setFilter(gs),
  });
  const list = createList({
    el: $('#list-view'), bodyEl: $('#list-body'), closeBtn: $('#list-close'),
    data, visited: state.visited,
    onPick: (id) => { list.close(); $('#btn-list').setAttribute('aria-pressed', 'false'); select(id); },
  });
  $('#btn-list').addEventListener('click', () => {
    if (list.isOpen()) { list.close(); $('#btn-list').setAttribute('aria-pressed', 'false'); }
    else { list.open(); $('#btn-list').setAttribute('aria-pressed', 'true'); }
  });

  // ── 투어 ─────────────────────────
  const tour = createTour({
    card: $('#tour-card'),
    partEl: $('#tour-part'), stepEl: $('#tour-step'), introEl: $('#tour-intro'),
    btns: { prev: $('#tour-prev'), next: $('#tour-next'), pause: $('#tour-pause'), exit: $('#tour-exit') },
    data,
    autoAllowed: () => state.motion,
    onVisit: (id) => select(id, { hash: false }),
    onExit: () => { $('#btn-tour').setAttribute('aria-pressed', 'false'); panel.close(); },
  });
  $('#btn-tour').addEventListener('click', () => {
    if (tour.isRunning()) tour.stop();
    else { $('#btn-tour').setAttribute('aria-pressed', 'true'); tour.start(); }
  });

  // ── 모션 토글 ─────────────────────
  function syncMotionButton() {
    const b = $('#btn-motion');
    b.setAttribute('aria-pressed', String(state.motion));
    b.setAttribute('aria-label', state.motion ? '움직임 켜짐, 누르면 정지' : '움직임 꺼짐, 누르면 재생');
    document.documentElement.classList.toggle('static-mode', !state.motion);
  }
  $('#btn-motion').addEventListener('click', () => {
    state.motion = !state.motion;
    localStorage.setItem(LS.motion, state.motion ? '1' : '0');
    galaxy.setMotion(state.motion);
    syncMotionButton();
    refreshPulse();
    toast(state.motion ? '움직임을 켰습니다' : '움직임을 정지했습니다');
  });

  // ── 시작 안내 펄스 (importance 5 상위 4개) ──
  function refreshPulse() {
    if (panel.isOpen()) return;
    const starters = data.concepts
      .filter(c => c.importance === 5)
      .sort((a, b) => a.galaxy - b.galaxy)
      .slice(0, 4)
      .map(c => c.id);
    galaxy.starterPulse(starters, !state.motion || prefersStatic);
  }

  // ── 키보드 ────────────────────────
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#search-results').hidden) return; // search가 처리
      if (list.isOpen()) { list.close(); $('#btn-list').setAttribute('aria-pressed', 'false'); }
      else if (tour.isRunning()) tour.stop();
      else if (panel.isOpen()) panel.close();
    }
    if (e.key === '/' && document.activeElement !== $('#search-input')) {
      e.preventDefault();
      $('#search-input').focus();
    }
  });

  // ── 부팅 시퀀스: 로딩 → 인트로(스킵 가능) → 코치마크 ──
  const loading = $('#loading');
  const skipBtn = $('#skip-intro');
  const deepLink = location.hash.replace('#', '');
  const validDeep = deepLink && (byId.has(deepLink) || deepLink === 'about');

  function finishBoot() {
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 700);
    if (!state.returning) localStorage.setItem(LS.seen, '1');
    refreshPulse();
    if (validDeep) select(deepLink === 'about' ? '__sun__' : deepLink);
  }

  const skipIntro = state.returning || validDeep || prefersStatic || !state.motion;
  if (skipIntro) {
    galaxy.skipIntro();
    finishBoot();
  } else {
    skipBtn.hidden = false;
    let done = false;
    const complete = () => { if (!done) { done = true; finishBoot(); } };
    skipBtn.addEventListener('click', () => { galaxy.skipIntro(); complete(); });
    $('#load-count').textContent = `별 ${total}개가 태어나는 중`;
    loading.classList.add('done'); // 씬이 보이는 상태에서 인트로 재생
    setTimeout(() => loading.remove(), 700);
    galaxy.playIntro(() => complete());
    setTimeout(complete, 4200); // 안전망
  }

  addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '');
    if (id && byId.has(id) && id !== panel.current()) select(id, { hash: false });
  });

  // ── 성능 하향 사다리 (6.5절): 이동 평균 33ms 초과 2초 연속 → 단방향 하향 ──
  let overSince = null, degradeStep = 0;
  const isMobileViewport = () => innerWidth <= 720;
  setInterval(() => {
    if (galaxy.isIntro()) { overSince = null; return; }
    const avg = galaxy.avgFrame();
    // 탭이 가려져 rAF가 스로틀링되면 측정이 무의미하다 (실제 성능 저하와 구분)
    if (document.hidden || avg > 120) { overSince = null; return; }
    const limit = 33; // 목표 17ms, 하향 발동선 33ms
    if (avg > limit) {
      overSince = overSince || performance.now();
      if (performance.now() - overSince > 2000 && degradeStep < 3) {
        degradeStep += 1;
        const what = galaxy.degrade(degradeStep);
        if (what) console.info('[degrade]', degradeStep, what);
        if (degradeStep === 3) { state.motion = false; syncMotionButton(); }
        overSince = null;
      }
    } else overSince = null;
  }, 500);

  // ── 디버그 ────────────────────────
  if (new URLSearchParams(location.search).has('debug')) {
    const d = $('#debug');
    d.hidden = false;
    setInterval(() => {
      d.textContent = `frame ${galaxy.avgFrame().toFixed(1)}ms · degrade ${degradeStep} · stars ${total}`;
    }, 500);
  }
}

boot().catch(err => {
  console.error(err);
  const l = $('#loading');
  if (l) l.innerHTML = `<p class="load-title">은하를 여는 데 실패했습니다</p>
    <p class="load-count">data/concepts.json을 불러오지 못했습니다. 로컬에서는 python3 -m http.server로 열어 주세요.</p>`;
});
