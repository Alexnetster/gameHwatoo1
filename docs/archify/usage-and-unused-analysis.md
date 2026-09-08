# 구조체·함수 사용 분석

검토일: 2026-09-08  
검토 범위: `src/`, `index.html`, `package.json`

## 결론

핵심 게임 모듈 중 완전히 고립된 파일은 없다. 카드 데이터, 룰, 상태, 턴 진행, CPU, 렌더링, 에셋 모듈은 모두 런타임 경로에서 사용된다.

다만 TypeScript의 `noUnusedLocals`는 exported 선언과 public 메서드의 외부 호출 여부까지 판정하지 않으므로, 아래 항목은 별도로 확인했다.

## 사용 용도별 구조

### 카드·플레이어 데이터

- `CardDef`: 카드 식별자·월·분류·점수 메타데이터.
- `PlayerState`: 손패·획득패·점수·GO 횟수.
- `CardCategory`, `SubType`, `PlayerId`: 도메인 타입.
- `HWATU_CARDS`: 48장 원본 데이터.
- `createShuffledDeck()`: 원본 덱 복사 및 셔플.

### 룰·점수

- `getCardFamily()`: 카드 ID 기준 월 가족 판정.
- `findFloorMatches()`: 바닥의 같은 월 패 검색.
- `evaluateCardMatch()`: 없음·1장·선택·4장 매칭 결과 생성.
- `validateMatchResult()`: 결과별 획득 장수 검증.
- `calculateScore()`, `calculateScoreBreakdown()`: 점수 및 설명 계산.
- `MatchResult`, `ScoreBreakdown`: 룰 처리 결과 구조.

### 상태·턴

- `GamePhase`: 게임 진행 상태.
- `GameState`: 플레이어·CPU·바닥·더미·선택 대기 상태 보관.
- `initNewGame()`: 10/10/8/20 초기 배분.
- `validateInvariants()`: 48장 유실·중복·월별 4장 검증.
- `drawCardFromDeck()`, `removeCardFromHand()`, `addCaptured()`, `switchTurn()`, `isGameOver()`: 상태 변경 API.

### 게임 오케스트레이션

`Game`은 입력, 룰 호출, 애니메이션, CPU 턴, GO/STOP, 종료, 카드 배치까지 조정한다. 공개 진입점은 `start()`, `startNewRound()`, `resolveUserChoice()`, `resolveGoStop()`이다.

### 렌더링·입력·에셋

- `CardMesh`: 카드 앞뒷면, 선택, 매칭 강조, 표시 크기.
- `SceneManager`: Three.js 장면·카메라·반응형 스케일.
- `CardAnimator`: 카드 이동·뒤집기.
- `InteractionManager`: 포인터 좌표와 카드 클릭 변환.
- `AssetManager`: SVG 스프라이트 매핑과 카드 이미지 URL.
- `EventBus`: 게임 도메인과 DOM UI 사이 이벤트 전달.

## 호출 확인 결과

### 실제 사용 중인 항목

다음 계층은 현재 런타임 호출 경로가 확인됐다.

`main.ts` → `Game` → `GameState` / `rules.ts` / `CpuAI` / Three.js 계층 → `EventBus` → `main.ts` UI 갱신

특히 `getCardFamily()`와 `findFloorMatches()`는 손패 선택, CPU 선택, 실제 매칭에서 공통 사용된다. 점수는 `calculateScoreBreakdown()`이 기준이고 `calculateScore()`는 상태 갱신용 호환 래퍼다.

### 현재 직접 호출되지 않는 항목

| 항목 | 상태 | 판단 |
|---|---|---|
| `EventBus.clear()` | 호출부 없음 | 화면/게임 인스턴스 교체 시 사용할 수 있으므로 보류 |
| `InteractionManager.dispose()` | 호출부 없음 | `Game.dispose()` 생명주기 추가 시 연결 필요 |
| `GameState.turnCapturedCards` 읽기 | 쓰기·초기화만 있음 | 쓸·설사·폭탄 판정 예정이면 유지, 아니면 제거 후보 |
| `CardMesh.isFaceUp` 읽기 | 생성/애니메이션에서 설정만 함 | 회전값과 중복 상태. 디버깅 목적이 아니면 제거 후보 |
| `TweenItem.onComplete` | 타입과 실행 분기만 있음 | `moveTo()`에서 콜백을 받지 않으므로 현재 비활성 기능 |

`Game.clearSelection()`은 외부 호출이 없고 `Game` 내부에서만 사용되므로 `private`로 낮출 수 있다. `onCardClick()`이 반환하는 해제 함수도 현재 호출자는 반환값을 저장하지 않지만, 향후 dispose 경로에 필요하다.

## 중복·개선 후보

- 함수 인자의 `'player' | 'cpu'` 반복은 기존 `PlayerId` 타입으로 통일 가능.
- 이벤트 이름과 payload가 문자열 기반이라 오타를 컴파일 타임에 잡지 못한다. 이벤트 맵 타입이 필요하다.
- `Game.ts`는 기능이 집중되어 있으므로 룰 안정화 이후 턴 진행·레이아웃·획득패 표시를 분리할 수 있다.
- `validateMatchResult()`는 현재 장수 중심 검증이다. `triple`은 정확히 4장인지, captured와 remaining floor가 실제로 일치하는지도 테스트에서 검증해야 한다.

## 검증 한계

- `package.json`에 테스트 러너가 없다.
- `npm run build`와 TypeScript `noUnusedLocals`는 통과하지만 exported/public API의 미호출 여부는 보장하지 않는다.
- 따라서 위의 “직접 호출되지 않음”은 소스 검색 기준이며, 향후 테스트·화면 수명주기 추가에 따라 재평가해야 한다.
