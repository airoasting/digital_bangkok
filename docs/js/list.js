// list.js — 3D 비의존 경로: 은하팔별 개념 전체 인덱스 (접근성/저사양 폴백 겸용)

export function createList({ el, bodyEl, closeBtn, data, onPick, visited }) {
  const parts = data.galaxies.map(g => ({
    g,
    concepts: data.concepts
      .filter(c => c.galaxy === g.id)
      .sort((a, b) => b.importance - a.importance || a.name.localeCompare(b.name, 'ko')),
  }));

  function render() {
    bodyEl.innerHTML = parts.map(({ g, concepts }) => `
      <section class="list-part">
        <h3>${g.id === 6 ? '부록' : g.id + '부'} · ${g.name} <small>(${concepts.length})</small></h3>
        ${concepts.map(c => `
          <button class="list-row" data-id="${c.id}">
            <span class="dot" style="background:${g.color}"></span>
            <span>${c.name}</span>
            <span class="t">${c.type}</span>
            ${visited.has(c.id) ? '<span class="seen">읽음</span>' : ''}
            <span class="imp">${'●'.repeat(c.importance)}</span>
          </button>`).join('')}
      </section>`).join('');
    bodyEl.querySelectorAll('[data-id]').forEach(b =>
      b.addEventListener('click', () => onPick(b.dataset.id)));
  }

  function open() { render(); el.hidden = false; bodyEl.querySelector('.list-row')?.focus(); }
  function close() { el.hidden = true; }

  closeBtn.addEventListener('click', close);

  return { open, close, isOpen: () => !el.hidden };
}
