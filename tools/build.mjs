// build.mjs — 데이터 빌드 (Plan.md 6.2)
// data/concepts.json(정본) → 검증, 좌표, searchText, edges 파생, OG 스텁, docs/data 출력.
// 파생 필드(position, searchText, edges)는 여기서만 만들어진다. 손으로 쓰지 않는다.
// 실행: node tools/build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutConcepts, previewSVG } from './layout.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'data', 'concepts.json');
const OUT_DIR = join(ROOT, 'docs', 'data');
const STUB_DIR = join(ROOT, 'docs', 'c');

// OG 태그의 이미지 주소는 절대 경로여야 한다. SNS 크롤러는 상대 경로를 풀지 못한다.
// 배포 주소가 바뀌면 여기만 고치고 다시 빌드한다. 환경변수로도 덮을 수 있다.
const BASE_URL = (process.env.BASE_URL || 'https://airoasting-bangkok.vercel.app').replace(/\/$/, '');

const stripMd = (s) => (s || '')
  .replace(/[#>*_`~\[\]()]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function build() {
  const data = JSON.parse(readFileSync(SRC, 'utf8'));
  const errors = [];
  const ids = new Set(data.concepts.map(c => c.id));

  // 기본 검증 (스키마 위반은 여기서 즉사시켜 게이트 이전에 잡는다)
  for (const c of data.concepts) {
    if (!/^[a-z0-9-]+$/.test(c.id)) errors.push(`${c.id}: id 형식 위반`);
    if (!c.name) errors.push(`${c.id}: name 없음`);
    if (!c.body || c.body.length < 50) errors.push(`${c.id}: body 부실(${(c.body || '').length}자)`);
    if (!c.summary) errors.push(`${c.id}: summary 없음`);
    if (!c.quote || !c.quote.text || !c.quote.bookPage) errors.push(`${c.id}: quote 불완전`);
    if (!Array.isArray(c.bookPages) || c.bookPages.length === 0) errors.push(`${c.id}: bookPages 없음`);
    if (![1, 2, 3, 4, 5, 6].includes(c.galaxy)) errors.push(`${c.id}: galaxy 위반`);
    if (![1, 2, 3, 4, 5].includes(c.importance)) errors.push(`${c.id}: importance 위반`);
    for (const r of c.related || []) if (!ids.has(r)) errors.push(`${c.id}: 깨진 related "${r}"`);
  }
  if (errors.length) {
    console.error(`빌드 실패: ${errors.length}건`);
    errors.slice(0, 40).forEach(e => console.error('  - ' + e));
    process.exit(1);
  }

  // related 대칭화 + 상한 8 (정본을 고치지 않고 빌드 산출물에서 보정하되, 위반은 게이트가 잡는다)
  const relMap = new Map(data.concepts.map(c => [c.id, new Set(c.related || [])]));
  for (const [id, set] of relMap) for (const r of set) relMap.get(r).add(id);

  // edges 파생 (무향, cross 자동)
  const galaxyOf = new Map(data.concepts.map(c => [c.id, c.galaxy]));
  const seen = new Set();
  const edges = [];
  for (const [a, set] of relMap) for (const b of set) {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ a: a < b ? a : b, b: a < b ? b : a, cross: galaxyOf.get(a) !== galaxyOf.get(b) });
  }

  // 좌표
  const positions = layoutConcepts(data.concepts, data.meta.seed || 20260718);

  const outConcepts = data.concepts.map(c => ({
    ...c,
    related: [...relMap.get(c.id)].slice(0, 8),
    searchText: stripMd([c.name, ...(c.aliases || []), c.summary, c.body, c.quote?.text].join(' ')).toLowerCase(),
    position: positions.get(c.id),
  }));

  const out = {
    meta: { ...data.meta, conceptCount: outConcepts.length },
    galaxies: data.galaxies,
    chapters: data.chapters,
    edges,
    concepts: outConcepts,
  };

  // 출력
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'concepts.json'), JSON.stringify(out));

  // SVG 프리뷰 (점검 3-a)
  writeFileSync(join(ROOT, 'data', 'layout_preview.svg'),
    previewSVG(data.concepts, positions, data.galaxies));

  // OG 스텁 (개념별 미리보기, 해시 딥링크의 OG 한계 해소)
  if (existsSync(STUB_DIR)) for (const f of readdirSync(STUB_DIR)) rmSync(join(STUB_DIR, f));
  mkdirSync(STUB_DIR, { recursive: true });
  for (const c of outConcepts) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    writeFileSync(join(STUB_DIR, `${c.id}.html`),
`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(c.name)} — 디지털 방콕 인사이트</title>
<meta property="og:title" content="${esc(c.name)}">
<meta property="og:description" content="${esc(c.summary)}">
<meta property="og:image" content="${BASE_URL}/assets/og-image.png">
<meta property="og:url" content="${BASE_URL}/c/${c.id}.html">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary">
<meta http-equiv="refresh" content="0; url=../#${c.id}">
<script>location.replace('../#' + ${JSON.stringify(c.id)});</script>
</head><body><p><a href="../#${c.id}">${esc(c.name)} 별로 이동</a></p></body></html>`);
  }

  console.log(`빌드 완료: 개념 ${outConcepts.length}, 간선 ${edges.length}, 스텁 ${outConcepts.length}, 프리뷰 SVG 갱신`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
