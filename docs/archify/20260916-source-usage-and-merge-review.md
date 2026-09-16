# 현재 소스 구조·함수 용도·중복 검토

검토일: 2026-09-16

> 이 문서는 현재 소스 스냅샷을 직접 읽어 갱신한 보완 문서입니다. 2026-09-08 산출물은 역사적 스냅샷으로 남겨두며, 최신 갭·화면 우선 작업 순서는 [전체 검토 문서](../rearch/20260916-comprehensive-review-and-presentation-plan.md)를 참고하세요.

## 구조와 주요 용도

### 게임 도메인

- `src/game/types.ts`: `CardDef`(카드 ID·월·분류·메타데이터), `PlayerState`(손패·획득패·점수·GO 상태), `CardCategory`·`SubType`·`PlayerId` 도메인 타입.
- `src/game/deck.ts`: `HWATU_CARDS`가 48장 원본 목록을 제공하고 `createShuffledDeck(random)`이 주입된 난수로 복사·셔플한다.
- `src/game/rules.ts`: `getCardFamily`가 카드 ID에서 권위 있는 월을 계산하고, `findFloorMatches`·`evaluateCardMatch`가 0/1/2/3장 매칭을 만든다. `evaluateDadakMatch`·`evaluateJjokMatch`·`isSeolsa`가 특수 사건을 판정한다. `validateMatchResult`가 획득 장수와 출처를 검사한다. `calculateScoreBreakdown`이 점수와 이유를 계산하며 `calculateScore`는 상태 갱신용 래퍼다.
- `src/game/GameState.ts`: `GamePhase`와 `GameState`가 양측 손패·바닥·더미·획득패·pending 선택·룰 옵션을 소유한다. `initNewGame`은 10/10/8/20으로 초기화하고, `validateCardZoneInvariants`/`validateInvariants`는 48개 고유 ID·12개 월별 4장을 검사한다. `drawCardFromDeck`, `removeCardFromHand`, `addCaptured`, `transferPi`, `switchTurn`, `isGameOver`가 상태 전이를 담당한다.
- `src/game/Game.ts`: 게임 오케스트레이터다. `start`/`startNewRound`, `handleCardClick`, `executeTurn`/`executeDeckDraw`, `resolveUserChoice`, `resolveGoStop`, `finishTurn`이 입력·룰·애니메이션·CPU·이벤트를 연결한다. `get*Position`·`reposition*` 계열은 카드 배치와 획득 트레이를 담당한다.
- `src/game/cpu.ts`: `CpuAI.chooseHandCard`와 `chooseCandidate`가 현재 바닥 상태에서 CPU 선택을 만든다.
- `src/game/EventBus.ts`: 싱글턴 `EventBus`와 `EventCallback`이 게임 계층과 DOM 계층 사이의 문자열 이벤트 전달을 담당한다.

### 렌더링·입력·에셋·오디오

- `src/three/SceneManager.ts`: Three.js 장면·Perspective 카메라·renderer·조명·테이블·카드 컨테이너를 만들고 resize 때 카메라와 `layoutScale`을 갱신한다.
- `src/three/CardMesh.ts`: 카드 BoxGeometry와 앞·뒤 재질을 만들고 `setFaceUp`, `setDisplayScale`, `setSelectState`, `setMatchHighlight`로 표현 상태를 바꾼다.
- `src/three/CardAnimator.ts`: `moveTo`가 카드 위치·회전을 tween하고 singleton `requestAnimationFrame` 루프가 완료 Promise를 해결한다.
- `src/three/InteractionManager.ts`: pointer 이동량을 필터링하고 Raycaster로 최상위 `CardMesh`를 찾아 등록된 클릭 콜백을 호출한다. `dispose`는 listener와 callback을 정리한다.
- `src/utils/AssetManager.ts`: SVG atlas를 월별 4장 texture와 DOM용 data URL로 잘라내고 카드 뒷면을 생성한다.
- `src/utils/AudioManager.ts`: 사용자 제스처 이후 BGM 파일을 시도하고 실패하면 Web Audio fallback을 사용한다. 카드·뒤집기·획득·쪽·설사·GO·결과 이벤트에 합성음을 연결하고 mute/volume을 저장한다.
- `src/main.ts`: HTML modal·점수·획득 패널을 만들고 `EventBus`를 구독하며 룰 옵션·seed·오디오·재시작 버튼을 연결하는 애플리케이션 진입점이다.

## 호출·소유 관계

```text
main.ts -> Game.start/startNewRound
Game -> GameState + rules + CpuAI + SceneManager/CardMesh/CardAnimator/InteractionManager
Game -> EventBus.emit
main.ts <- EventBus.on -> DOM/UI + AudioManager
```

## 중복과 통합 가능성

아래는 “같은 로직이 이미 두 군데 있다”는 확정 중복과, 합치면 재작업을 줄일 수 있는 구조 후보를 구분한 것이다. 정적 dead-code 도구는 없으므로 호출부 판단은 `rg`와 직접 읽기 기준이다.

### 확정 중복 또는 단일화 가능한 계산

- `calculateScore`와 `calculateScoreBreakdown`은 점수 계산 본체와 래퍼 관계다(`rules.ts`). 점수 본체를 하나로 유지하고 래퍼는 외부 호환 API로 남기는 것이 안전하다.
- `Game.getPlayerHandPosition`·`getCpuHandPosition`·`getFloorPosition`·`getCapturedPosition`은 좌표 계산의 별도 정책이다. 즉시 하나로 합치면 플레이어/CPU·트레이 요구가 섞인다. 공통 `LayoutMetrics`를 계산한 뒤 정책별 함수가 읽는 방식으로 통합 가능하다.
- `main.ts`의 `updateCapturedUI`와 `updateScorePanel`은 같은 captured 배열에서 서로 다른 표시를 계산한다. 상태 이벤트가 최신 `captured`, `score`, `piValue` 스냅샷을 한 번 전달하고 두 renderer가 이를 소비하는 구조로 합칠 수 있다.
- `Game.applyMatchResult`의 `repositionCaptured`와 `applySeolsa`의 개별 mesh 이동은 “상태 변경 후 재배치” 공통 경계를 만들 수 있다. 이벤트 재생과 재배치를 분리해야 획득음 중복을 피할 수 있다.

### 미사용·죽은 코드 후보

- `EventBus.clear()`와 `InteractionManager.dispose()`는 현재 애플리케이션 종료/교체 경로에서 호출되지 않는다. `Game.dispose`를 만들 때 연결할 후보이지 즉시 삭제할 근거는 없다.
- `CardAnimator.TweenItem.onComplete` 필드는 있지만 `moveTo` 인자로 callback을 받지 않아 현재 외부 사용이 없다. Promise 완료 계약으로 대체하거나 callback API를 실제로 연결할 수 있다.
- `GameState.turnCapturedCards`는 쓰기·초기화는 있으나 읽기 호출이 확인되지 않는다. 쓸·폭탄 같은 후속 규칙 계획이 유지되면 보류하고, 룰 범위가 고정되면 제거를 검토한다.
- `CardMesh.isFaceUp`은 생성·애니메이션에서 설정되지만 읽기 호출이 없다. 디버그/접근성에 쓰지 않는다면 회전값을 단일 출처로 정리할 후보이다.
- `CardMesh.setSelectState(true)`는 정의되어 있으나 현재 1탭 즉시 제출 흐름에서 호출되지 않는다. 선택 UI를 2탭으로 바꿔야 한다는 뜻은 아니며, 제출 순간 짧은 강조를 연결할 후보이다.

### 통합 우선순위

1. 라운드 ID와 취소 가능한 tween/CPU 지연을 `Game`과 `CardAnimator` 경계에 추가한다.
2. `EventBus`를 이벤트 이름과 payload 타입 맵으로 감싸고, 쪽·설사·점수 변경을 양측 공통 snapshot 이벤트로 만든다.
3. DOM 안전 영역과 Three.js 월드 좌표를 `LayoutMetrics`로 공유한다. resize 때 기존 카드도 재배치한다.
4. BGM/SFX 파일 로더와 합성 fallback을 같은 `SoundName` 계약으로 유지하고, 시각효과는 사건 이벤트를 구독한다.
5. 위 경계가 고정된 뒤 `Game`의 턴 진행·레이아웃·획득 연출을 별도 모듈로 분리한다.

## 방법론과 한계

- `archify`·staticcheck·dead-code 분석기는 이 환경에 없었다. 따라서 미사용 판정은 `rg` 호출 검색과 소스 읽기의 후보 판정이며, 동적 호출·향후 확장 가능성은 배제하지 않았다.
- 현재 `npm test`는 3개 파일 49개가 통과하지만 Three.js 렌더링·DOM·실제 오디오를 통합 실행하지 않는다.
- `gameHwatoo1-architecture.json/html`은 2026-09-08 수동 산출물이다. 이번 보완 문서는 소스 용도·중복 검토를 갱신하지만, 새 archify CLI 검증을 통과한 산출물이라고 주장하지 않는다.
