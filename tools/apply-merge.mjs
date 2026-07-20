// apply-merge.mjs — 중복 개념 병합 + 신규 개념 편입 (1회성 마이그레이션, 2026-07-20)
// 실행: node tools/apply-merge.mjs [--dry]
//
// VERIFICATION.md 4절에서 확정한 중복 10쌍을 병합한다.
// 살아남는 쪽의 summary/body/aliases/bookPages는 집필 에이전트 산출물로 교체하고,
// 삭제되는 id를 가리키던 related는 살아남는 id로 돌린다.
// 그 뒤 신규 개념 8개를 편입해 총 200개를 만든다.
//
// 이 스크립트는 한 번 쓰고 기록으로 남기는 것이다. 재실행하면 이미 병합된 상태라
// "삭제 대상 없음"으로 조용히 끝난다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DRY = process.argv.includes('--dry');
const SCRATCH = '/private/tmp/claude-501/-Users-jaydenkang-Desktop-New-Projects-20260718------------/5dee2c79-ddb8-4c5c-9755-7dda46a5b530/scratchpad/verify';

// 삭제되는 id → 살아남는 id
const MERGE = {
  'thailand-4-0-industrial-strategy': 'thailand-4-0',
  'smart-visa-program': 'smart-visa',
  'ltr-visa-program': 'ltr-visa',
  'destination-thailand-visa': 'dtv-visa',
  'cloud-first-gov-policy': 'cloud-first-policy',
  'digital-economy-promotion-agency': 'depa',
  'kreng-jai-culture': 'kreng-jai',
  'thailand-medical-tourism': 'medical-tourism',
  'bumrungrad-international': 'bumrungrad-hospital',
  'asean-digital-heart': 'asean-digital-hub',
};

// 다른 개념의 고유 이름을 별칭으로 흡수해 검색에서 충돌하던 것들
const ALIAS_STRIP = {
  'true-corporation': ['TrueMoveH', 'TrueMove H', '트루무브 H'],
  'dtac': ['dtac accelerate'],
  'tiktok-thailand-investment': ['TikTok'],
  'line-man-youtube-ad': ['LINE MAN'],
  'ascend-money': ['트루머니', 'True Money Wallet'],
  'techsauce': ['Techsauce Global Summit'],
};

const REL_MAX = 8; // gate.mjs 상한

const src = JSON.parse(readFileSync(join(ROOT, 'data', 'concepts.json'), 'utf8'));
const before = src.concepts.length;
const log = [];

// ── 1. 집필 산출물 읽기 ────────────────────────────────
const rewrites = {};
for (const f of ['merge_A.json', 'merge_B.json']) {
  const p = join(SCRATCH, f);
  if (!existsSync(p)) { log.push(`! ${f} 없음, 해당 본문은 기존 값 유지`); continue; }
  Object.assign(rewrites, JSON.parse(readFileSync(p, 'utf8')));
}
const additions = [];
for (const f of ['new_appendix.json', 'new_part5.json']) {
  const p = join(SCRATCH, f);
  if (!existsSync(p)) { log.push(`! ${f} 없음, 신규 개념 편입 건너뜀`); continue; }
  additions.push(...JSON.parse(readFileSync(p, 'utf8')));
}

// ── 2. 병합 ────────────────────────────────────────────
const byId = Object.fromEntries(src.concepts.map(c => [c.id, c]));
const dead = new Set(Object.keys(MERGE).filter(id => byId[id]));

for (const deadId of dead) {
  const keepId = MERGE[deadId];
  const keep = byId[keepId];
  if (!keep) throw new Error(`살아남을 개념이 없다: ${keepId}`);
  const gone = byId[deadId];

  // 삭제되는 쪽이 가리키던 related를 살아남는 쪽으로 넘긴다. 상한을 넘기면 넘기지 않는다.
  for (const r of gone.related || []) {
    const t = MERGE[r] || r;
    if (t === keepId || dead.has(t)) continue;
    if (!keep.related.includes(t) && keep.related.length < REL_MAX) keep.related.push(t);
  }
  log.push(`병합 ${deadId} → ${keepId}`);
}

// 집필 산출물 반영
for (const [id, patch] of Object.entries(rewrites)) {
  const c = byId[id];
  if (!c) { log.push(`! 재작성 대상 없음: ${id}`); continue; }
  if (patch.summary) c.summary = patch.summary;
  if (patch.body) c.body = patch.body;
  if (patch.aliases) c.aliases = patch.aliases;
  if (patch.bookPages) c.bookPages = patch.bookPages;
  log.push(`본문 갱신 ${id}`);
}

// 삭제
src.concepts = src.concepts.filter(c => !dead.has(c.id));

// 남은 전체에서 죽은 id를 가리키는 related를 살아남는 id로 돌린다
for (const c of src.concepts) {
  const next = [];
  for (const r of c.related || []) {
    const t = MERGE[r] || r;
    if (t === c.id || next.includes(t)) continue;
    next.push(t);
  }
  c.related = next.slice(0, REL_MAX);
}

// ── 3. 별칭 오염 제거 ──────────────────────────────────
for (const [id, strip] of Object.entries(ALIAS_STRIP)) {
  const c = src.concepts.find(x => x.id === id);
  if (!c?.aliases) continue;
  const n = c.aliases.length;
  c.aliases = c.aliases.filter(a => !strip.includes(a));
  if (c.aliases.length !== n) log.push(`별칭 정리 ${id} (${n} → ${c.aliases.length})`);
}

// ── 4. 신규 개념 편입 ──────────────────────────────────
const ids = new Set(src.concepts.map(c => c.id));
for (const a of additions) {
  if (ids.has(a.id)) { log.push(`! 이미 있는 id 건너뜀: ${a.id}`); continue; }
  const bad = (a.related || []).filter(r => !ids.has(r));
  if (bad.length) {
    a.related = (a.related || []).filter(r => ids.has(r));
    log.push(`! ${a.id} related에 없는 id 제거: ${bad.join(', ')}`);
  }
  src.concepts.push(a);
  ids.add(a.id);
  log.push(`추가 ${a.id} (${a.galaxy}부 / ${a.chapter})`);
}

// 신규 개념은 아무도 가리키지 않으면 고아가 된다. 상대 쪽에 역링크를 심는다.
for (const a of additions) {
  const me = src.concepts.find(c => c.id === a.id);
  if (!me) continue;
  for (const r of me.related) {
    const t = src.concepts.find(c => c.id === r);
    if (t && !t.related.includes(a.id) && t.related.length < REL_MAX) t.related.push(a.id);
  }
}

// ── 5. 정합 확인 ───────────────────────────────────────
const finalIds = new Set(src.concepts.map(c => c.id));
const broken = [];
for (const c of src.concepts)
  for (const r of c.related) if (!finalIds.has(r)) broken.push(`${c.id} → ${r}`);
const orphans = src.concepts.filter(c => !c.related.length).map(c => c.id);
const over = src.concepts.filter(c => c.related.length > REL_MAX).map(c => c.id);

src.meta.conceptCount = src.concepts.length;
src.meta.tour = src.meta.tour.map(t => MERGE[t] || t).filter(t => finalIds.has(t));

for (const l of log) console.log(l);
console.log(`\n개념 ${before} → ${src.concepts.length}`);
const dist = {};
for (const c of src.concepts) dist[c.galaxy] = (dist[c.galaxy] || 0) + 1;
console.log('부별:', JSON.stringify(dist));
console.log(`깨진 related ${broken.length}${broken.length ? ': ' + broken.join(', ') : ''}`);
console.log(`고아 ${orphans.length}${orphans.length ? ': ' + orphans.join(', ') : ''}`);
console.log(`related 상한 초과 ${over.length}${over.length ? ': ' + over.join(', ') : ''}`);

if (broken.length || orphans.length || over.length) {
  console.log('\n정합 문제가 있다. 쓰지 않고 중단한다.');
  process.exit(1);
}
if (DRY) { console.log('\n--dry, 파일을 쓰지 않았다.'); process.exit(0); }

writeFileSync(join(ROOT, 'data', 'concepts.json'), JSON.stringify(src, null, 2) + '\n');
console.log('\ndata/concepts.json 갱신. 이어서 build.mjs, gate.mjs, verify-assignment.mjs를 돌린다.');
