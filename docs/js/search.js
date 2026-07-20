// search.js — 검색(방향키 탐색)과 은하팔 필터 칩.

export function createSearch({ input, resultsEl, data, onPick }) {
  const galaxyOf = new Map(data.galaxies.map(g => [g.id, g]));
  let items = [], active = -1;

  function rank(q) {
    const lq = q.toLowerCase();
    const scored = [];
    for (const c of data.concepts) {
      const name = c.name.toLowerCase();
      const alias = (c.aliases || []).join(' ').toLowerCase();
      let s = -1;
      if (name.startsWith(lq)) s = 0;
      else if (name.includes(lq)) s = 1;
      else if (alias.includes(lq)) s = 2;
      else if (c.searchText.includes(lq)) s = 3;
      if (s >= 0) scored.push([s, -c.importance, c]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return scored.map(x => x[2]);
  }

  function nearMiss() {
    // 결과 0건: importance 높은 별 3개를 제안한다
    return [...data.concepts].sort((a, b) => b.importance - a.importance).slice(0, 3);
  }

  function renderResults(list, hint) {
    items = list.slice(0, 8);
    active = -1;
    if (!items.length) { hide(); return; }
    resultsEl.innerHTML =
      (hint ? `<li class="sr-hint" role="presentation">${hint}</li>` : '') +
      items.map((c) => {
        const g = galaxyOf.get(c.galaxy);
        return `<li role="option"><button type="button" data-id="${c.id}">
          <span class="sr-dot" style="background:${g.color}"></span>
          <span>${c.name}</span><span class="sr-type">${c.type}</span></button></li>`;
      }).join('');
    resultsEl.hidden = false;
    input.closest('.search').setAttribute('aria-expanded', 'true');
    resultsEl.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => { pick(b.dataset.id); }));
  }

  function pick(id) { hide(); input.blur(); onPick(id); }

  function hide() {
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
    items = []; active = -1;
    input.closest('.search').setAttribute('aria-expanded', 'false');
  }

  function setActive(i) {
    const lis = [...resultsEl.querySelectorAll('li[role="option"]')];
    lis.forEach(li => li.classList.remove('active'));
    if (i >= 0 && lis[i]) { lis[i].classList.add('active'); lis[i].scrollIntoView({ block: 'nearest' }); }
    active = i;
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 1) { hide(); return; }
    const list = rank(q);
    if (list.length) renderResults(list);
    else renderResults(nearMiss(), '찾는 별이 없네요. 이 별들은 어떠세요');
  });

  input.addEventListener('keydown', (e) => {
    if (resultsEl.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      pick(items[Math.max(active, 0)].id);
    }
    else if (e.key === 'Escape') { hide(); input.blur(); }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!resultsEl.hidden && !e.target.closest('.search')) hide();
  });

  return { hide };
}

export function createLegend({ el, data, onChange }) {
  const on = new Set(data.galaxies.map(g => g.id));
  const counts = {};
  for (const c of data.concepts) counts[c.galaxy] = (counts[c.galaxy] || 0) + 1;

  el.innerHTML = data.galaxies.map(g => `
    <button class="legend-chip" data-g="${g.id}" aria-pressed="true"
            aria-label="${g.name} 표시 전환">
      <span class="dot" style="background:${g.color};color:${g.color}"></span>
      <span>${g.id === 6 ? g.name : g.id + '부 ' + g.name.split(':')[0]}</span>
      <span class="cnt">${counts[g.id] || 0}</span>
    </button>`).join('');

  el.querySelectorAll('.legend-chip').forEach(b => {
    b.addEventListener('click', () => {
      const g = Number(b.dataset.g);
      if (on.has(g)) on.delete(g); else on.add(g);
      if (!on.size) { data.galaxies.forEach(x => on.add(x.id)); } // 전부 끄면 전부 켠다
      el.querySelectorAll('.legend-chip').forEach(x =>
        x.setAttribute('aria-pressed', String(on.has(Number(x.dataset.g)))));
      onChange(new Set(on));
    });
  });

  return { visible: () => new Set(on) };
}
