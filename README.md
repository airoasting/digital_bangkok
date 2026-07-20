# 디지털 방콕 인사이트 — 위키 브레인 (Knowledge Base)

책 『디지털 방콕 인사이트』(173p PDF, 5부 20장 + 부록 4편)를 멀티 에이전트 파이프라인으로 추출해, 개념 200개를 3D 은하로 탐험하는 정적 위키다. 태양이 책, 나선팔 5개가 1~5부, 외곽 소행성대가 부록, 별 하나가 개념 하나다.

## 실행

```bash
cd docs
python3 -m http.server 8000
# http://localhost:8000
```

API 키, 서버, 빌드 도구가 필요 없다. GitHub Pages라면 저장소 설정에서 `/docs` 폴더 서빙을 켜면 끝이다.

- `?debug` 를 붙이면 좌상단에 프레임 타임 카운터가 뜬다.
- `#개념id` 해시로 특정 별에 딥링크된다 (예: `#promptpay`).
- 개념별 공유 링크는 `c/{id}.html` (OG 미리보기 스텁, 접속 시 그 별로 이동).

## 첫 화면

처음 열면 책 표지가 뜬다. 아래로 스크롤하면 표지의 하프톤 망점이 한가운데에서 바깥으로 흩어지고, 지면이 같은 자리부터 뚫리며 그 안에서 은하가 드러난다. 같은 스크롤이 카메라를 태양 근처에서 홈까지 끌어낸다.

- 진행도는 오직 스크롤에서 온다. 멈추면 그림도 멈춘다. 되감으면 되돌아간다.
- `바로 들어가기`, `Enter`, `Esc`로 건너뛴다. 건너뛰기도 전환을 잘라내지 않고 3초에 걸쳐 끝까지 재생한다.
- 은하에 막 도착해 아직 아무것도 건드리지 않았다면 위로 스크롤해 표지로 돌아간다. 한 번이라도 돌리거나 누르거나 축소하면 휠은 본래대로 확대·축소로 돌아간다.
- `#개념id` 딥링크로 들어오면 표지를 세우지 않는다. 개념을 보러 온 사람에게 문을 두 번 열게 하지 않는다.
- `prefers-reduced-motion`이면 망점을 만들지 않고 정적인 표지에 `들어가기` 버튼만 둔다.

표지 이미지는 `docs/assets/book01.jpeg`다. 다른 책으로 갈아끼울 때 이 파일만 바꾸면 망점은 이미지에서 다시 뽑는다.

## 조작

드래그 회전, 휠·핀치 줌, 별 클릭 → 개념 패널. `/` 검색 포커스, Esc 닫기. 상단 "투어"는 책의 목차 순서로 대표 별을 순회한다. "목록"은 3D 없이 전체 개념을 여는 경로(키보드/스크린리더/저사양 폴백)다.

## 구조

```
data/concepts.json      ← 단일 정본 (사람이 고치는 파일은 이것뿐)
tools/merge.mjs         ← Phase 2 산출물 병합 → 정본 생성
tools/layout.mjs        ← 결정론적 은하 좌표 (시드 고정)
tools/build.mjs         ← 검증 + 좌표 + searchText + edges 파생 + OG 스텁 → docs/
tools/gate.mjs          ← 데이터 게이트 자동 검사 (형식)
tools/verify-assignment.mjs ← 부·장 배정 재검증 + 중복 엔티티 탐지 (내용)
tools/make-og.py        ← SNS 미리보기 이미지 생성 (정본 좌표를 그대로 투영)
docs/                   ← 배포 폴더 (정적 사이트 전체)
```

정본을 고친 뒤에는 반드시 빌드와 게이트를 다시 돌린다.

```bash
node tools/build.mjs && node tools/gate.mjs
```

`position`, `searchText`, `edges`는 build.mjs가 파생 생성한다. 손으로 쓰지 않는다.

## 개념 추가/수정

`data/concepts.json`의 `concepts` 배열에 항목을 추가하거나 고친다. 필수 필드: `id`(영문 kebab-case), `name`, `type`(기술|기업|정책|인물|현상|용어), `galaxy`(1~6), `chapter`(ch01~ch20, prologue, epilogue, a1~a4), `importance`(1~5), `summary`, `quote{text,bookPage}`, `body`(마크다운, **굵게**/리스트/인용만 지원), `related`(다른 개념 id), `bookPages`. 그 뒤 build + gate.

## 다른 책으로 갈아끼우기 (book-to-galaxy 파이프라인)

1. `Plan.md`의 Phase 1~2 에이전트 프롬프트로 새 책을 추출·큐레이션·집필한다 (비전 기반, 2단 조판이면 page_map의 환산식만 갱신).
2. `tools/merge.mjs`의 `PALETTE`, `PART_NAMES`와 `data/page_map.json`의 units를 새 책의 부/장 구조로 바꾼다.
3. `node tools/merge.mjs && node tools/build.mjs && node tools/gate.mjs`.
4. `docs/index.html`의 제목/OG 문구를 바꾼다. 끝.

## 배포

Vercel에 붙어 있다. https://airoasting-bangkok.vercel.app

저장소 루트가 아니라 `docs/`를 서빙한다. Vercel 프로젝트 설정의 Root Directory가 `docs`, 프레임워크는 Other(빌드 명령 없음)다. GitHub Pages도 저장소 설정에서 `/docs` 폴더 서빙만 켜면 된다.

OG 태그의 이미지 주소는 절대 URL이어야 한다. SNS 크롤러는 상대 경로를 풀지 못한다. 주소는 `tools/build.mjs`의 `BASE_URL` 상수에 있고, 개념 스텁 200개는 빌드가 그 값으로 찍는다. 대표 태그는 `docs/index.html`에 직접 적혀 있다.

주소가 바뀌면 두 곳을 고치고 다시 빌드한다.

```bash
# 1. tools/build.mjs의 BASE_URL, 또는 환경변수로 덮어쓰기
BASE_URL=https://새주소 node tools/build.mjs
# 2. docs/index.html의 og:image, og:url, canonical
```

## Vendor (버전 고정)

Three.js r170 (0.170.0, unpkg에서 확보). 파일 해시(SHA-256):

- three.module.js `ce1fa418de16a19495a9f72495580e3015d7745c296d3ce0485897f902ddedfb`
- addons/controls/OrbitControls.js `80efaadea4f8a636a65fb0bd08bfef62f3d93a0bb94e2e7500f23176c5c07f4e`
- addons/renderers/CSS2DRenderer.js `7de0bb70e3c1d6da58416353ed7140a7a7743ece99d73b56eb62bc2dd79bfed5`

웹폰트는 둘이다. 우주(어둠)의 고딕은 Pretendard(jsDelivr), 종이(패널) 본문의 명조는 Hahmlet(Google Fonts)이다. 한국 책이 표지와 제목은 고딕, 본문은 명조로 짜는 문법을 그대로 옮긴 것이다. 오프라인에서는 각각 시스템 고딕과 세리프로 대체된다(기능에는 영향 없음).

## 품질 기록

검증 결과와 알려진 한계는 `QUALITY.md`에 있다. 설계 전문과 결정 근거는 `Plan.md`에 있다.

## SNS 미리보기 이미지

`docs/assets/og-image.png`(1200×630)는 손으로 그린 그림이 아니라 정본에서 만든다. `docs/data/concepts.json`의 실제 좌표를 3/4 각도로 투영하고, 별 색은 각 부의 벤자롱 색을 그대로 쓴다. 가운데 금색은 태양, 곧 책이다.

```bash
python3 tools/make-og.py
```

개념이 늘거나 줄면, 또는 좌표 시드가 바뀌면 다시 돌린다. 그림 속 별 개수가 실제 개념 수와 어긋나지 않게 하려는 것이다. 제목 활자는 사용자 폰트 폴더의 `Pretendard-Black.ttf`를 쓴다.
