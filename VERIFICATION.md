# 개념 배정 재검증 (부·장)

검증 2026-07-20. 대상은 당시 `data/concepts.json`의 개념 202개였다. 물음은 하나였다. **202개가 각 부에 맞게 잡혔는가.**

> **조치 완료 (2026-07-20).** 4절의 중복 10쌍을 병합하고 별칭 오염 6건을 정리했다(202 → 192). 그 뒤 미사용 후보 8개를 편입해 **최종 200개**가 됐다. 상세는 8절에 있다. 아래 1절부터 7절까지는 조치 전 시점의 검증 기록이며, 그대로 둔다.

갱신 기준: `data/concepts.json`의 개념이 추가·삭제·이동될 때마다 `node tools/verify-assignment.mjs`를 다시 돌리고 이 문서의 3절과 4절을 갱신한다.

## 왜 이 문서가 따로 있는가

`QUALITY.md`가 기록하는 `tools/gate.mjs`는 형식을 본다. 필드가 있는지, related가 끊기지 않았는지, 좌표가 파생됐는지. 배정이 내용상 맞는지는 보지 않는다. `tools/gate.mjs`를 전부 통과해도 핀테크 개념이 5부에 앉아 있을 수 있다. 실제로 그랬다.

## 1. 검증 방법

두 갈래를 병행하고 결과를 합쳤다.

**결정론적 전수 검사** (`tools/verify-assignment.mjs`). galaxy와 chapter의 정합, quote 페이지 이탈, bookPages의 장 범위 이탈, 이름·별칭 정규화 충돌, extracted 원본에서의 등장 빈도 역전. 202개 전수.

**멀티 에이전트 의미 검사.** 부별 검증자 6명이 담당 부의 개념을 전수로 보고, 부 경계 감사자 5명이 인접한 두 부 사이에서 자리가 바뀐 개념을 찾았다. 검사 연인원 553회. 나온 지적은 개념 하나당 독립 반박자 3명이 서로 다른 각도(현재 배정이 옳을 근거, 제안 장이 정말 최심층인지, 제3의 장 가능성)로 반박을 시도했고, 2명 이상이 반박하면 탈락시켰다. 에이전트 27명, 토큰 200만.

판정 기준은 하나로 통일했다. **개념의 chapter는 그 개념이 책에서 가장 깊게 설명된 장이다.** 단순 언급은 근거가 되지 않는다. 주장하려면 `data/extracted/*.json`의 원문과 책 페이지를 제시해야 한다.

## 2. 판정

**부별 배정 자체는 신뢰할 만하다.** galaxy와 chapter의 매핑은 202개 전수 일치, quote 페이지 이탈 0건이다. 의미 검사에서 반박을 통과한 오배정은 3건, 1.5%다.

**다만 진짜 문제는 배정이 아니라 중복이었다.** 같은 실체가 서로 다른 부에 두 개의 별로 존재하는 쌍이 15개 있고, 그중 8쌍은 상호 링크조차 없다. 부별 개념 수는 이만큼 부풀려져 있다.

| 부 | 장 구성 | 개념 수 |
|---|---|---|
| 1부 | ch01 4, ch02 8, ch03 10, ch04 7 | 29 |
| 2부 | ch05 9, ch06 9, ch07 13, ch08 8 | 39 |
| 3부 | prologue 1, ch09 5, ch10 9, ch11 13, ch12 7 | 35 |
| 4부 | ch13 14, ch14 11, ch15 9, ch16 6 | 40 |
| 5부 | ch17 8, ch18 9, ch19 7, ch20 9, epilogue 2 | 35 |
| 부록 | a1 6, a2 8, a3 9, a4 1 | 24 |
| 합계 | | 202 |

## 3. 확정 오배정 3건

반박자 3명 전원이 반박에 실패한 건이다.

### 3-1. `fintech` 핀테크, 중대

5부 epilogue → 2부 ch07.

에필로그에서 핀테크가 나오는 문장은 301쪽 한 줄이고 extracted 후보에도 `mentions: 1`로 기록돼 있다. 그 한 줄에서 개념 하나가 태어나 5부에 앉았다. 반면 ch07은 장 제목 자체가 「대형 은행이 주도하는 핀테크 혁신」이고 extracted 안에서 핀테크가 10회 등장한다. 2부에는 프롬프트페이, 트루머니, 가상은행 등 하위 개념 13개가 있는데 정작 이들을 묶는 상위 개념 `핀테크`가 없다. 옮겨도 5부에 공백이 생기지 않고, 2부의 빈자리가 채워진다.

현재 body는 에필로그의 수사를 옮겨 적었을 뿐이라 이동만으로는 부족하다. summary, body, quote를 ch07 원문 기준으로 다시 써야 한다.

### 3-2. `bumrungrad-international` 범룬그라드 국제 병원, 중대

5부 ch17 → 삭제 후 2부 `bumrungrad-hospital`에 병합.

같은 병원이 이미 `bumrungrad-hospital`로 2부 ch08에 있다. 1980년 개원, JCI 아시아 최초 인증, 연간 해외 환자 70만 명까지 실려 있다. ch17판은 261쪽 단문 하나에서 파생된 껍데기다(importance 1, related 1). 이동이 아니라 삭제가 맞다.

### 3-3. `seekster` 시크스터, 경미

4부 ch14 → 3부 ch11. 또는 페이지 정리만.

ch11은 165쪽 B2B 마켓플레이스 표에 설립연도, 사업 모델, 투자 이력을 싣고 166쪽에 트루 디지털의 지분 68% 인수를 서술한다. ch14는 라인 스케일업 협업 사례로 한 문장뿐이다. 다만 현재 summary와 body가 라인 스케일업 서사로 쓰여 있어 큐레이터의 의도적 배치일 수 있다. importance 1이라 파급은 작다.

## 4. 중복 엔티티 15쌍

`tools/verify-assignment.mjs`의 이름·별칭 충돌 검사 결과다. 성격이 둘로 갈린다.

### 4-1. 같은 실체가 두 부로 갈린 것, 10쌍

부록 큐레이터와 본문 큐레이터가 같은 대상을 각각 별로 만들었다. 부록 쪽 복제본은 예외 없이 importance 1, related 3으로 본문 쪽보다 얇다.

| 본문 쪽 (유지) | 부록·타부 쪽 (병합 대상) | 상호 링크 |
|---|---|---|
| `thailand-4-0` 3부/ch11 imp5 | `thailand-4-0-industrial-strategy` 부록/a2 imp1 | 없음 |
| `smart-visa` 3부/ch09 imp3 | `smart-visa-program` 부록/a3 imp1 | 없음 |
| `ltr-visa` 3부/ch09 imp2 | `ltr-visa-program` 부록/a3 imp1 | 있음 |
| `dtv-visa` 3부/ch10 imp3 | `destination-thailand-visa` 부록/a3 imp1 | 없음 |
| `cloud-first-policy` 3부/ch12 imp2 | `cloud-first-gov-policy` 부록/a1 imp1 | 있음 |
| `depa` 4부/ch14 imp3 | `digital-economy-promotion-agency` 부록/a3 imp1 | 없음 |
| `kreng-jai` 4부/ch16 imp2 | `kreng-jai-culture` 부록/a2 imp1 | 있음 |
| `medical-tourism` 2부/ch08 imp4 | `thailand-medical-tourism` 5부/ch17 imp2 | 있음 |
| `bumrungrad-hospital` 2부/ch08 imp3 | `bumrungrad-international` 5부/ch17 imp1 | 있음 |
| `asean-digital-hub` 3부/prologue imp4 | `asean-digital-heart` 5부/epilogue imp2 | 없음 |

부록 복제본에는 본문에 없는 실무 수치가 들어 있다(예: SMART S 비자의 60만 바트 예금 요건, LTR의 연소득 8만 달러). 삭제할 때 이 수치를 본문 개념의 body로 흡수시켜야 정보가 사라지지 않는다.

### 4-2. 별개 개념인데 별칭이 오염된 것, 5쌍

병합 대상이 아니다. 한쪽이 다른 쪽의 이름을 별칭으로 흡수해 검색에서 충돌한다. 별칭만 정리하면 된다.

| 개념 | 빼야 할 별칭 | 그 별칭의 주인 |
|---|---|---|
| `true-corporation` | TrueMoveH, TrueMove H, 트루무브 H | `truemove-h` (5부/ch19 광고 사례) |
| `dtac` | dtac accelerate | `dtac-accelerate` (4부/ch13) |
| `tiktok-thailand-investment` | TikTok | `tiktok` (1부/ch04) |
| `line-man-youtube-ad` | LINE MAN | `line-man-wongnai` (2부/ch05) |
| `ascend-money` | 트루머니, True Money Wallet | `truemoney` (2부/ch07) |

`techsauce` ↔ `techsauce-global-summit`은 같은 부, 같은 장이라 은하에서 겹치지 않는다. `techsauce`에서 별칭 `Techsauce Global Summit`만 빼면 된다.

## 5. 정상으로 판정한 것

**bookPages 장 범위 이탈 8건 중 5건은 교차 언급이다.** 한 개념이 여러 장에 걸쳐 언급되는 자연스러운 결과이고, 각각 소속 장 안에 실질 근거가 남아 있다. 수정하지 않는다.

`line`(ch03, 52~54쪽은 ch04), `siriraj-hospital`(ch08, 145쪽은 ch09), `tech-talent-shortage`(ch15, 244쪽은 ch16), `foreign-business-license`(a2, 339쪽은 a3), `vat`(a2, 340쪽은 a3).

**등장 빈도 역전 4건 중 3건도 정상이다.** `boi`는 a3에서 31회로 최다지만 그건 Q&A 표의 나열이고, 정의적 서술(1966년 설립, 해외 지점 14개, 100% 외국인 투자 허용)은 ch14 212쪽에 있다. `pomelo`의 a4 4회는 「태국 스타트업 120」 목록 항목이다. `fintech`의 a3 11회도 표 나열이며, 실제 정답은 3-1에서 확인한 ch07이다.

## 6. 수정 실행안

근거가 확정된 순서다. 1~3은 바로 실행 가능하고, 4는 큐레이터 확인이 필요하다.

1. `fintech`를 ch07/galaxy 2로 옮기고 summary, body, quote, bookPages를 `data/extracted/ch07.json` 기준으로 다시 쓴다. importance도 1에서 상향 검토한다.
2. 4-2의 별칭 오염 6건을 제거한다. 개념 수가 변하지 않아 가장 안전하다.
3. 4-1의 중복 10쌍을 병합한다. 부록 쪽 복제본의 실무 수치를 본문 개념 body로 옮긴 뒤 삭제하고, 삭제된 id를 참조하는 related를 남는 id로 바꾼다. 개념 수는 202에서 192로 줄고, `README.md`의 "개념 200여 개", `QUALITY.md`의 수치, OG 스텁 수가 함께 바뀐다.
4. `seekster`는 ch11 이동과 bookPages 정리(`[208]`만 남김) 중 하나를 고른다. 라인 스케일업 서사를 유지할 의도였다면 후자로 충분하다.

수정 후에는 반드시 다음을 순서대로 돌린다.

```bash
node tools/verify-assignment.mjs   # 배정·중복
node tools/build.mjs               # 파생 재생성
node tools/gate.mjs                # 형식 게이트
```

## 7. 이 검증이 보지 못한 것

- 근거는 전적으로 `data/extracted/*.json`이다. 추출 단계에서 누락된 서술은 여기서도 보이지 않는다. 어떤 장에 실제로는 깊은 설명이 있는데 추출되지 않았다면 그 개념은 "언급 1회"로 잘못 평가됐을 수 있다.
- 원본 PDF를 직접 대조하지 않았다. 페이지 번호는 `page_map.json`과 extracted의 bookPage를 신뢰한 결과다.
- 검사한 것은 배정과 중복이다. 나머지 199개의 summary와 body가 사실에 부합하는지, 숫자와 고유명사가 정확한지는 범위 밖이다. `QUALITY.md`가 기록한 대로 콘텐츠 검증은 여전히 52개 표본에 머물러 있다.
- 책에는 있으나 `concepts.json`에 없는 개념, 즉 누락은 이 검증이 잡아내지 못한다. 중복 10쌍을 병합해 192개가 되면 그 빈자리를 채울 후보를 `data/curated/*.json`에서 다시 볼 여지가 있다.

## 8. 조치 결과 (2026-07-20)

`node tools/apply-merge.mjs`로 실행했다. 스크립트는 기록으로 남겨 둔다.

### 8-1. 중복 10쌍 병합

삭제되는 쪽에만 있던 실무 수치는 남는 개념의 body에 흡수시켰다. 삭제된 id를 가리키던 `related`는 남는 id로 돌렸다.

| 남긴 것 | 지운 것 | 흡수한 내용 |
|---|---|---|
| `thailand-4-0` | `thailand-4-0-industrial-strategy` | 12대 육성 산업 전체 목록, First/New S-curve 구분, EEC 투자 유치 목표 |
| `smart-visa` | `smart-visa-program` | S/E/I/T 네 유형과 유형별 요건(예금, 소득, 투자 기준) |
| `ltr-visa` | `ltr-visa-program` | 대상별 소득 요건(연 8만 달러 등), 고용주 요건 |
| `dtv-visa` | `destination-thailand-visa` | 계좌 잔액 50만 바트, 방문 목적 증명 등 서류 요건 |
| `cloud-first-policy` | `cloud-first-gov-policy` | 220개 정부 부처 제공, 인프라 비용 30~50% 절감, 민간 파트너 |
| `depa` | `digital-economy-promotion-agency` | D-startup 펀드 지원 대상과 8개 분야, 스마트 시티 엑셀러레이터 |
| `kreng-jai` | `kreng-jai-culture` | 문화 리스크 해소 권고(소통 방식, 합의 기반 의사결정) |
| `medical-tourism` | `thailand-medical-tourism` | 2024년 153.7억 달러, 2034년까지 CAGR 15.7%, 산업지수 순위 |
| `bumrungrad-hospital` | `bumrungrad-international` | 한 문장뿐이라 첫 문단에 한 줄만 추가 |
| `asean-digital-hub` | `asean-digital-heart` | 에필로그의 "아세안의 디지털 심장" 규정. 프롤로그에서 열려 에필로그에서 닫히는 구조 |

### 8-2. 별칭 오염 6건 정리

`true-corporation`에서 TrueMoveH 계열 3개, `dtac`에서 dtac accelerate, `tiktok-thailand-investment`에서 TikTok, `line-man-youtube-ad`에서 LINE MAN, `ascend-money`에서 트루머니 계열 2개, `techsauce`에서 Techsauce Global Summit을 뺐다. 개념 수는 변하지 않는다.

### 8-3. 신규 개념 8개 편입

`data/extracted/*.json`의 candidates 중 아직 별이 되지 못한 97개에서, 인용할 원문 문장이 실제로 있는 것만 골랐다.

| id | 이름 | 부/장 |
|---|---|---|
| `dbd` | 상무부 기업개발국 | 부록 / a2 |
| `us-thai-amity-treaty` | 미국-태국 우호통상조약 | 부록 / a2 |
| `one-stop-service-center` | 원스톱 서비스 센터 | 부록 / a2 |
| `sandbox-88` | 88 SANDBOX | 부록 / a3 |
| `global-digital-talent-visa` | Global Digital Talent Visa | 부록 / a1 |
| `thai-home-furnishing` | 태국 홈퍼니싱 시장 | 5부 / ch17 |
| `mond-nissin-waffle-ad` | 몬드 닛신 보이즈 와플 광고 | 5부 / ch19 |
| `bangkok-startup-ecosystem` | 방콕 스타트업 생태계 | 5부 / epilogue |

후보로 올렸던 `KBTG Kampus`는 뺐다. 근거가 345쪽 표의 한 행뿐이고 facts에 인용할 문장이 없어, quote를 표에서 재구성해야 했기 때문이다. a3의 기존 개념 9개는 모두 quote가 원문과 정확히 일치하므로 그 규칙을 깨지 않기로 했다. 대신 실제 인용 문장이 있는 `one-stop-service-center`로 바꿨다.

### 8-4. 결과

| 부 | 병합 전 | 병합 후 | 신규 편입 후 |
|---|---|---|---|
| 1부 | 29 | 29 | 29 |
| 2부 | 39 | 39 | 39 |
| 3부 | 35 | 35 | 35 |
| 4부 | 40 | 40 | 40 |
| 5부 | 35 | 32 | 35 |
| 부록 | 24 | 17 | 22 |
| 합계 | 202 | 192 | **200** |

검증 재실행 결과다.

- `tools/verify-assignment.mjs`: 치명 0건, **중복 후보 15건 → 0건**
- `tools/gate.mjs`: 20개 항목 전부 PASS. related 평균 5.33, 고아 0, 깨진 id 0, edges 540, OG 스텁 200
- 신규 8개 전수 자체 검증: quote가 extracted facts 원문과 일치, 인용 페이지가 장 범위 안, related 전부 실재, 줄표 0

### 8-5. 남은 것

- **`fintech` 이동 미조치.** epilogue(5부)에서 ch07(2부)로 옮기고 본문을 다시 써야 한다. 3-1에 근거가 있다. 개념 수는 변하지 않는다.
- **`seekster` 판단 보류.** ch14 유지와 ch11 이동 중 결정이 필요하다. 3-3 참조.
- **병합된 개념의 bookPages는 남는 쪽 장 범위로 유지했다.** 흡수한 사실의 출처 페이지(부록 쪽)는 넣지 않았다. 장 범위 검사를 깨뜨리기 때문인데, 그만큼 body의 일부 수치는 bookPages가 가리키는 쪽에 없다. 출처 추적이 필요해지면 별도 필드를 두는 편이 낫다.
