// gate.mjs — Phase 4 데이터 게이트 자동 검사 (Plan.md 7절)
// 실행: node tools/gate.mjs  → 전 항목 PASS면 exit 0, 아니면 exit 1

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const src = JSON.parse(readFileSync(join(ROOT, 'data', 'concepts.json'), 'utf8'));
const built = JSON.parse(readFileSync(join(ROOT, 'docs', 'data', 'concepts.json'), 'utf8'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const cs = built.concepts;
const ids = new Set(cs.map(c => c.id));

check('개념 수 ≥ 200', cs.length >= 200, `${cs.length}`);
check('body 전부 존재(≥50자)', cs.every(c => c.body && c.body.length >= 50));
check('summary 전부 존재', cs.every(c => !!c.summary));
check('quote 전부 존재(text+bookPage)', cs.every(c => c.quote?.text && c.quote?.bookPage));

const relCounts = cs.map(c => (c.related || []).length);
const relAvg = relCounts.reduce((a, b) => a + b, 0) / cs.length;
check('related 평균 ≥ 3', relAvg >= 3, relAvg.toFixed(2));
check('노드당 related ≤ 8', relCounts.every(n => n <= 8), `max ${Math.max(...relCounts)}`);
check('깨진 related id 0', cs.every(c => (c.related || []).every(r => ids.has(r))));
check('고아 노드 0', cs.every(c => (c.related || []).length > 0),
  cs.filter(c => !(c.related || []).length).map(c => c.id).slice(0, 5).join(','));

// bookPages가 책 범위(4~349) 안인가
check('bookPages 책 범위 내(4~349)',
  cs.every(c => c.bookPages.every(p => p >= 4 && p <= 349)));

// importance 분포 (5등급 ≤ 10, ≥4 합계 ≤ 25)
const i5 = cs.filter(c => c.importance === 5).length;
const i45 = cs.filter(c => c.importance >= 4).length;
check('importance 5등급 ≤ 10', i5 <= 10, `${i5}`);
check('importance ≥4 합계 ≤ 25', i45 <= 25, `${i45}`);

// tour: 유효 id, 15~20개, 1~5부 각 2개 이상
const tour = built.meta.tour || [];
check('tour 15~20개', tour.length >= 15 && tour.length <= 20, `${tour.length}`);
check('tour id 전부 유효', tour.every(t => ids.has(t)));
const tourByG = {};
for (const t of tour) { const g = cs.find(c => c.id === t)?.galaxy; tourByG[g] = (tourByG[g] || 0) + 1; }
check('tour 부별 균형(1~5부 각 ≥2)', [1, 2, 3, 4, 5].every(g => (tourByG[g] || 0) >= 2), JSON.stringify(tourByG));

// galaxies intro
check('galaxies intro 전부 존재', built.galaxies.filter(g => g.id <= 5).every(g => !!g.intro));

// edges 파생 정합: related로부터 유도한 무향 간선 == edges
const expect = new Set();
for (const c of cs) for (const r of c.related || []) expect.add(c.id < r ? `${c.id}|${r}` : `${r}|${c.id}`);
const actual = new Set(built.edges.map(e => `${e.a}|${e.b}`));
check('edges == related 파생', expect.size === actual.size && [...expect].every(k => actual.has(k)),
  `expect ${expect.size} / actual ${actual.size}`);

// position/searchText 존재
check('position 전부 존재', cs.every(c => Array.isArray(c.position) && c.position.length === 3));
check('searchText 전부 존재', cs.every(c => !!c.searchText));

// OG 스텁 수 = 개념 수
const stubDir = join(ROOT, 'docs', 'c');
const stubCount = existsSync(stubDir) ? readdirSync(stubDir).filter(f => f.endsWith('.html')).length : 0;
check('OG 스텁 수 = 개념 수', stubCount === cs.length, `${stubCount}`);

// 정본-빌드 신선도: 정본 개념 수와 id 집합이 빌드와 일치
const srcIds = new Set(src.concepts.map(c => c.id));
check('정본-빌드 id 일치', srcIds.size === ids.size && [...srcIds].every(i => ids.has(i)));

const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
console.log(failed.length ? `\n게이트 실패 ${failed.length}건` : '\n데이터 게이트 전 항목 통과');
process.exit(failed.length ? 1 : 0);
