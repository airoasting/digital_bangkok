// merge.mjs — Phase 2 산출물 병합 → data/concepts.json (정본 생성)
// concept_list.json + written/batch*.json + curated/g*.json(intro) + page_map.json(장 제목)
// 그래프 정합: 실존 id만, 양방향, 노드당 상한 8, 고아 0 (Plan.md P2-3).
// 실행: node tools/merge.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const D = (p) => join(ROOT, 'data', p);

const list = JSON.parse(readFileSync(D('concept_list.json'), 'utf8'));
const pageMap = JSON.parse(readFileSync(D('page_map.json'), 'utf8'));

const PALETTE = {
  // 벤자롱(태국 오색 도자기) 보석 팔레트. 금색은 태양(책)에만 남긴다.
  1: '#4FA8FF', 2: '#FF6A45', 3: '#18C98C', 4: '#B072FF', 5: '#FF4F8B', 6: '#8B90A2',
};
const PART_NAMES = {
  1: '디지털 혁명의 시작', 2: '태국 디지털 이코노미의 부상', 3: '아세안 비즈니스 허브로의 도약',
  4: '태국 스타트업 생태계', 5: '태국인의 디지털 문화 코드', 6: '부록',
};

// 집필 문서
const docs = new Map();
for (const f of readdirSync(D('written')).filter(f => f.endsWith('.json'))) {
  const b = JSON.parse(readFileSync(D(join('written', f)), 'utf8'));
  for (const d of b.docs) docs.set(d.id, d);
}

// 부 소개문
const intros = {};
for (const f of readdirSync(D('curated')).filter(f => f.endsWith('.json'))) {
  const g = JSON.parse(readFileSync(D(join('curated', f)), 'utf8'));
  intros[g.galaxy] = g.intro;
}

const missing = [];
const concepts = [];
for (const c of list.concepts) {
  const d = docs.get(c.id);
  if (!d) { missing.push(c.id); continue; }
  concepts.push({
    id: c.id,
    name: c.name,
    aliases: c.aliases || [],
    type: c.type,
    galaxy: c.galaxy,
    chapter: c.chapter,
    importance: c.importance,
    summary: d.summary,
    quote: d.quote,
    body: d.body,
    related: d.related || [],
    bookPages: (d.bookPages && d.bookPages.length ? d.bookPages : c.bookPages) || [],
  });
}
if (missing.length) console.warn(`문서 누락 ${missing.length}건: ${missing.join(', ')}`);

// ── 그래프 정합 ─────────────────────
const ids = new Set(concepts.map(c => c.id));
const impOf = new Map(concepts.map(c => [c.id, c.importance]));
const chapterOf = new Map(concepts.map(c => [c.id, c.chapter]));
const adj = new Map(concepts.map(c => [c.id, new Set()]));

for (const c of concepts) {
  for (const r of c.related) {
    if (!ids.has(r) || r === c.id) continue;
    adj.get(c.id).add(r);
    adj.get(r).add(c.id); // 양방향
  }
}

// 고아 구제: 같은 장의 중요도 높은 개념 2개와 연결
for (const c of concepts) {
  if (adj.get(c.id).size > 0) continue;
  const peers = concepts
    .filter(x => x.id !== c.id && x.chapter === c.chapter)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 2);
  for (const p of peers) { adj.get(c.id).add(p.id); adj.get(p.id).add(c.id); }
  console.warn(`고아 구제: ${c.id} → ${peers.map(p => p.id).join(', ')}`);
}

// 상한 8: 초과 노드에서 이웃 중요도가 낮고, 끊어도 이웃이 3개 이상 유지되는 간선부터 제거
let trimmed = 0;
let changedFlag = true;
while (changedFlag) {
  changedFlag = false;
  for (const [id, set] of adj) {
    if (set.size <= 8) continue;
    const candidates = [...set]
      .filter(n => adj.get(n).size > 3)
      .sort((a, b) => impOf.get(a) - impOf.get(b));
    if (!candidates.length) break;
    const drop = candidates[0];
    set.delete(drop);
    adj.get(drop).delete(id);
    trimmed++;
    changedFlag = true;
  }
}
if (trimmed) console.log(`링크 상한 조정: ${trimmed}개 간선 제거`);

for (const c of concepts) c.related = [...adj.get(c.id)];

// ── chapters 테이블 ─────────────────
const chapters = pageMap.units.map(u => ({
  no: u.id, title: u.title, galaxy: u.galaxy, bookPages: u.book,
}));

// 투어 검증
const tour = (list.tour || []).filter(t => ids.has(t));

const out = {
  meta: {
    title: '디지털 방콕 인사이트',
    generated: '2026-07-18',
    conceptCount: concepts.length,
    seed: 20260718,
    tour,
  },
  galaxies: [1, 2, 3, 4, 5, 6].map(g => ({
    id: g, name: PART_NAMES[g], color: PALETTE[g], intro: intros[g] || '',
  })),
  chapters,
  concepts,
};

writeFileSync(D('concepts.json'), JSON.stringify(out, null, 1));
const avg = concepts.reduce((s, c) => s + c.related.length, 0) / concepts.length;
console.log(`정본 생성: 개념 ${concepts.length}, related 평균 ${avg.toFixed(2)}, 투어 ${tour.length}, 누락 ${missing.length}`);
