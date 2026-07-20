// panel.js — 우주에 떠 있는 책의 한 쪽. 개념 문서와 책 소개 패널 렌더링.

const TYPE_ORDER = ['기술', '기업', '정책', '인물', '현상', '용어'];

// 초경량 마크다운: 문단, **굵게**, - 리스트, > 인용만 지원 (Plan.md 6.1)
export function mdToHtml(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bold = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = src.split(/\r?\n/);
  let html = '', para = [], list = [], quote = [];
  const flushP = () => { if (para.length) { html += `<p>${bold(esc(para.join(' ')))}</p>`; para = []; } };
  const flushL = () => { if (list.length) { html += `<ul>${list.map(i => `<li>${bold(esc(i))}</li>`).join('')}</ul>`; list = []; } };
  const flushQ = () => { if (quote.length) { html += `<blockquote>${bold(esc(quote.join(' ')))}</blockquote>`; quote = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushP(); flushL(); flushQ(); continue; }
    if (line.startsWith('- ')) { flushP(); flushQ(); list.push(line.slice(2)); continue; }
    if (line.startsWith('> ')) { flushP(); flushL(); quote.push(line.slice(2)); continue; }
    flushL(); flushQ(); para.push(line);
  }
  flushP(); flushL(); flushQ();
  return html;
}

export function createPanel({ el, body, closeBtn, grip, data, onPick, onClose, onShare }) {
  const galaxyOf = new Map(data.galaxies.map(g => [g.id, g]));
  const chapterOf = new Map(data.chapters.map(c => [c.no, c]));
  const byId = new Map(data.concepts.map(c => [c.id, c]));
  let openId = null;

  const partLabel = (g) => (g === 6 ? '부록' : `${g}부`);

  function chapterTitle(c) {
    const ch = chapterOf.get(c.chapter);
    return ch ? ch.title : '';
  }

  function render(c, { nextRec, visited }) {
    const gal = galaxyOf.get(c.galaxy);
    const relChips = (c.related || []).map(rid => {
      const r = byId.get(rid);
      if (!r) return '';
      const rg = galaxyOf.get(r.galaxy);
      return `<button class="chip${visited.has(rid) ? ' visited' : ''}" data-id="${rid}">
        <span class="dot" style="background:${rg.color}"></span>${r.name}</button>`;
    }).join('');

    const pages = c.bookPages.length > 1
      ? `${Math.min(...c.bookPages)}~${Math.max(...c.bookPages)}`
      : `${c.bookPages[0]}`;

    body.innerHTML = `
      <div class="doc-eyebrow"><span class="dot" style="background:${gal.color}"></span>
        ${partLabel(c.galaxy)} · ${gal.name}</div>
      <h2 class="doc-title" id="doc-title" tabindex="-1">${c.name}</h2>
      <p class="doc-sub"><span class="type-badge">${c.type}</span>${chapterTitle(c)}</p>
      <hr class="doc-rule">
      <blockquote class="doc-quote">“${c.quote.text}”<cite>책 ${c.quote.bookPage}쪽</cite></blockquote>
      <div class="doc-body">${mdToHtml(c.body)}</div>
      ${relChips ? `<div class="doc-related"><h3>유관 개념</h3><div class="chip-row">${relChips}</div></div>` : ''}
      ${nextRec ? `<div class="doc-next"><h3>다음 별</h3>
        <button class="next-btn" data-id="${nextRec.id}">
          <span>${nextRec.name}</span><span class="arrow">→</span></button></div>` : ''}
      <div class="doc-foot">
        <span class="pageref">이 내용은 책 ${pages}쪽에 있습니다</span>
        <button class="share-btn" data-share="${c.id}">이 별 공유하기</button>
      </div>`;
    wire();
  }

  function renderBook() {
    body.innerHTML = `
      <div class="doc-eyebrow"><span class="dot" style="background:#E8A33D"></span>이 은하에 대하여</div>
      <h2 class="doc-title" id="doc-title" tabindex="-1">디지털 방콕 인사이트</h2>
      <p class="doc-sub">한 권의 책, ${data.concepts.length}개의 별</p>
      <hr class="doc-rule">
      <div class="doc-body">
        <p>이 은하는 책 <strong>디지털 방콕 인사이트</strong>의 개념 지도입니다. 태양을 중심으로 다섯 개의 나선팔이 책의 1부부터 5부까지를, 바깥 소행성대가 부록을 담고 있습니다.</p>
        <p>별의 크기는 책에서 차지하는 비중, 색은 소속된 부를 뜻합니다. 별을 클릭하면 그 개념의 문서가 열리고, 문서 속 유관 개념을 따라 은하를 여행할 수 있습니다.</p>
        <p>상단의 <strong>투어</strong>는 책의 목차 순서로 대표 개념들을 안내하는 길입니다.</p>
      </div>`;
    body.querySelector('#doc-title')?.focus({ preventScroll: true });
  }

  function wire() {
    body.querySelectorAll('[data-id]').forEach(b =>
      b.addEventListener('click', () => onPick(b.dataset.id)));
    body.querySelector('[data-share]')?.addEventListener('click', (e) =>
      onShare(e.currentTarget.dataset.share));
    body.querySelector('#doc-title')?.focus({ preventScroll: true });
  }

  function open(id, ctx) {
    openId = id;
    el.hidden = false;
    el.offsetHeight; // 강제 리플로우로 트랜지션 보장 (rAF는 탭 스로틀링 시 멈춘다)
    el.classList.add('open');
    el.classList.remove('full');
    if (id === '__sun__') renderBook();
    else render(byId.get(id), ctx);
    body.scrollTop = 0;
  }

  function close() {
    openId = null;
    el.classList.remove('open', 'full');
    setTimeout(() => { if (!openId) el.hidden = true; }, 400);
    onClose();
  }

  closeBtn.addEventListener('click', close);

  // 모바일 바텀시트: 그립 드래그로 peek ↔ full ↔ 닫기
  let dragY = null;
  grip.addEventListener('pointerdown', (e) => { dragY = e.clientY; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointerup', (e) => {
    if (dragY === null) return;
    const dy = e.clientY - dragY;
    dragY = null;
    if (dy < -40) el.classList.add('full');
    else if (dy > 60) (el.classList.contains('full') ? el.classList.remove('full') : close());
    else el.classList.toggle('full');
  });

  return { open, close, isOpen: () => openId !== null, current: () => openId };
}
