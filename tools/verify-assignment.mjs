// verify-assignment.mjs — 부(galaxy)·장(chapter) 배정 재검증 + 중복 엔티티 탐지
// 실행: node tools/verify-assignment.mjs
// gate.mjs가 "형식이 맞는가"를 보는 반면, 이 검사기는 "내용이 제자리인가"를 본다.
// 판정 불가한 의미 판단은 하지 않는다. 사람이나 에이전트가 확인할 후보만 뽑아 준다.
// 등급은 기계가 판정할 수 있는 만큼만 나눈다.
//   치명 = 정본끼리 어긋난 것. 사람 판단이 필요 없다.
//   경고 = 오배정일 가능성이 높은 후보. 원본을 열어 확인해야 한다.
//   참고 = 정상일 수도 있는 신호. 대개는 교차 언급이다.
// 종료 코드: 치명이 있으면 1, 아니면 0.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const pageMap = JSON.parse(readFileSync(join(ROOT, 'data', 'page_map.json'), 'utf8'));
const cs = JSON.parse(readFileSync(join(ROOT, 'data', 'concepts.json'), 'utf8')).concepts;

const U = Object.fromEntries(pageMap.units.map(u => [u.id, u]));
const byId = Object.fromEntries(cs.map(c => [c.id, c]));
const GALAXY_NAME = { 1: '1부', 2: '2부', 3: '3부', 4: '4부', 5: '5부', 6: '부록' };

const fatal = [];
const warn = [];
const info = [];

// ─────────────────────────────────────────────────────────────
// 1. galaxy ↔ chapter 정합. page_map이 정본이다.
// ─────────────────────────────────────────────────────────────
for (const c of cs) {
  const u = U[c.chapter];
  if (!u) { fatal.push(`알 수 없는 chapter: ${c.id} → ${c.chapter}`); continue; }
  if (c.galaxy !== u.galaxy) {
    fatal.push(`galaxy 불일치: ${c.id} (chapter ${c.chapter}는 galaxy ${u.galaxy}인데 ${c.galaxy}로 배정)`);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. bookPages / quote.bookPage가 소속 장 범위 안인가
//    범위 밖 페이지는 교차 언급일 수 있으므로 경고로만 남긴다.
//    다만 범위 안 페이지가 절반 미만이면 배정 자체를 의심한다.
// ─────────────────────────────────────────────────────────────
const ownerOf = p => pageMap.units.filter(u => p >= u.book[0] && p <= u.book[1]).map(u => u.id).join('/') || '?';

for (const c of cs) {
  const u = U[c.chapter];
  if (!u) continue;
  const [lo, hi] = u.book;
  const pages = c.bookPages || [];
  const inside = pages.filter(p => p >= lo && p <= hi);
  const outside = pages.filter(p => p < lo || p > hi);

  if (c.quote?.bookPage != null && (c.quote.bookPage < lo || c.quote.bookPage > hi)) {
    fatal.push(`quote 페이지 이탈: ${c.id} (${c.chapter} 범위 ${lo}~${hi}, quote는 ${c.quote.bookPage} = ${ownerOf(c.quote.bookPage)})`);
  }
  if (!pages.length) { warn.push(`bookPages 없음: ${c.id}`); continue; }
  if (outside.length) {
    const detail = outside.map(p => `${p}→${ownerOf(p)}`).join(', ');
    if (inside.length / pages.length <= 0.5) {
      warn.push(`배정 의심(범위 내 근거 ${inside.length}/${pages.length}): ${c.id} ${c.chapter}(${lo}~${hi}) 이탈 ${detail}`);
    } else {
      info.push(`교차 언급: ${c.id} ${c.chapter} 이탈 ${detail} (범위 내 ${inside.length}/${pages.length})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 3. 중복 엔티티. 이름·별칭을 정규화해 충돌하는 개념 쌍을 찾는다.
//    같은 실체가 두 부에 각각 별로 존재하면 은하에 쌍둥이 별이 생긴다.
// ─────────────────────────────────────────────────────────────
const norm = s => s.toLowerCase().replace(/[^가-힣a-z0-9]/g, '');
const keyOwners = new Map();
for (const c of cs) {
  for (const n of [c.name, ...(c.aliases || [])]) {
    const k = norm(n);
    if (k.length < 3) continue; // 태국어 등 정규화 후 소실되는 표기는 건너뛴다
    if (!keyOwners.has(k)) keyOwners.set(k, new Set());
    keyOwners.get(k).add(c.id);
  }
}
const pairs = new Map();
for (const [k, owners] of keyOwners) {
  if (owners.size < 2) continue;
  const list = [...owners].sort();
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const pk = `${list[i]}|${list[j]}`;
      if (!pairs.has(pk)) pairs.set(pk, []);
      pairs.get(pk).push(k);
    }
}
for (const [pk, keys] of pairs) {
  const [a, b] = pk.split('|');
  const A = byId[a], B = byId[b];
  const linked = (A.related || []).includes(b) || (B.related || []).includes(a);
  const where = `${a} [${GALAXY_NAME[A.galaxy]}/${A.chapter}] ↔ ${b} [${GALAXY_NAME[B.galaxy]}/${B.chapter}]`;
  // 별개 개념인데 별칭만 겹친 경우와 같은 실체가 둘로 갈린 경우를 기계가 가르지 못한다.
  // 부를 넘고 상호 링크까지 없으면 은하에 무관한 쌍둥이 별이 뜨므로 우선순위를 올린다.
  const tail = `충돌표기 ${keys.join(', ')}${linked ? '' : ', 상호 링크 없음'}`;
  if (A.galaxy !== B.galaxy && !linked) warn.push(`중복 후보(부를 넘고 링크 없음): ${where} (${tail})`);
  else if (A.galaxy !== B.galaxy) warn.push(`중복 후보(부를 넘음): ${where} (${tail})`);
  else info.push(`중복 후보(같은 부): ${where} (${tail})`);
}

// ─────────────────────────────────────────────────────────────
// 4. 최다 등장 장 vs 배정 장. extracted 원본에서 이름 등장 횟수를 센다.
//    a3(Q&A 표), a4(스타트업 120 목록)는 나열이라 횟수가 부풀려진다. 참고용이다.
// ─────────────────────────────────────────────────────────────
const corpus = {};
for (const u of pageMap.units) {
  const p = join(ROOT, 'data', 'extracted', `${u.id}.json`);
  if (existsSync(p)) corpus[u.id] = readFileSync(p, 'utf8');
}
for (const c of cs) {
  const terms = [c.name, ...(c.aliases || [])].filter(t => t.length >= 3);
  if (!terms.length) continue;
  const count = {};
  for (const [uid, txt] of Object.entries(corpus)) {
    const n = terms.reduce((s, t) => s + txt.split(t).length - 1, 0);
    if (n) count[uid] = n;
  }
  const best = Object.entries(count).sort((x, y) => y[1] - x[1])[0];
  if (!best) continue;
  const mine = count[c.chapter] || 0;
  if (best[0] !== c.chapter && best[1] >= Math.max(3, mine * 2)) {
    info.push(`등장 빈도 역전: ${c.id} 배정 ${c.chapter} ${mine}회 vs 최다 ${best[0]} ${best[1]}회`);
  }
}

// ─────────────────────────────────────────────────────────────
// 출력
// ─────────────────────────────────────────────────────────────
const counts = {};
for (const c of cs) counts[c.galaxy] = (counts[c.galaxy] || 0) + 1;
console.log(`개념 ${cs.length}개 · ` + Object.entries(counts).map(([g, n]) => `${GALAXY_NAME[g]} ${n}`).join(', '));
console.log();

const dump = (label, arr) => {
  console.log(`${label} ${arr.length}건`);
  for (const x of arr) console.log(`  ${x}`);
  console.log();
};
dump('[치명]', fatal);
dump('[경고]', warn);
dump('[참고]', info);

console.log(fatal.length ? `치명 ${fatal.length}건. 정본을 고치고 다시 돌린다.` : '치명 항목 없음.');
console.log('경고와 참고는 자동 판정이 불가능하다. 해당 장의 data/extracted/*.json을 열어 실제 설명 깊이를 확인한다.');
process.exit(fatal.length ? 1 : 0);
