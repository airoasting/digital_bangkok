// tour.js — 책의 목차 순서로 대표 별을 순회하는 투어 모드.
// 부가 바뀔 때 galaxies[].intro 소개 카드, 진행 표시, 일시정지/이전/다음/종료.

const AUTO_MS = 9000;

export function createTour({ card, partEl, stepEl, introEl, btns, data, onVisit, onExit, autoAllowed }) {
  const byId = new Map(data.concepts.map(c => [c.id, c]));
  const galaxyOf = new Map(data.galaxies.map(g => [g.id, g]));
  const order = (data.meta.tour || []).filter(id => byId.has(id));
  let i = -1, timer = null, paused = false, running = false, lastGalaxy = null;

  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function schedule() {
    clearTimer();
    if (paused || !autoAllowed()) return;
    timer = setTimeout(() => next(), AUTO_MS);
  }

  function show(idx) {
    i = (idx + order.length) % order.length;
    const c = byId.get(order[i]);
    const g = galaxyOf.get(c.galaxy);
    const partName = c.galaxy === 6 ? '부록' : `${c.galaxy}부 · ${g.name}`;
    partEl.textContent = partName;
    stepEl.textContent = `${i + 1} / ${order.length}`;
    introEl.textContent = (c.galaxy !== lastGalaxy && g.intro) ? g.intro : c.summary;
    lastGalaxy = c.galaxy;
    onVisit(c.id);
    schedule();
  }

  function next() { show(i + 1); }
  function prev() { show(i - 1); }

  function start() {
    if (!order.length) return;
    running = true;
    paused = false;
    lastGalaxy = null;
    btns.pause.setAttribute('aria-pressed', 'false');
    btns.pause.textContent = '일시정지';
    card.hidden = false;
    show(0);
  }

  function stop() {
    running = false;
    clearTimer();
    card.hidden = true;
    onExit();
  }

  btns.next.addEventListener('click', () => next());
  btns.prev.addEventListener('click', () => prev());
  btns.exit.addEventListener('click', () => stop());
  btns.pause.addEventListener('click', () => {
    paused = !paused;
    btns.pause.setAttribute('aria-pressed', String(paused));
    btns.pause.textContent = paused ? '이어서' : '일시정지';
    if (paused) clearTimer(); else schedule();
  });

  return { start, stop, isRunning: () => running };
}
