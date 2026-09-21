# json-render 검토 및 프로젝트 적용 범위

검토일: 2026-09-21

참고:

- [json-render 공식 문서](https://json-render.dev/docs)
- [Catalog 문서](https://json-render.dev/docs/catalog)
- [json-render GitHub](https://github.com/vercel-labs/json-render)

## 1. 결론

json-render를 게임 화면 전체에 도입하거나 Three.js 카드 렌더링을 대체하지 않는다.

현재 프로젝트는 Vite + TypeScript + Three.js 기반이며, `Game`과 `EventBus`가 게임 상태와 턴을 결정하고 Three.js가 카드 표현과 상호작용을 담당한다. 이 경계를 유지하는 것이 48장 카드 invariant, 플레이어·CPU 턴 흐름, 카드 애니메이션의 안정성에 중요하다.

json-render의 유효한 아이디어만 제한적으로 적용한다.

- 허용된 UI 블록 목록을 정의한다.
- 게임 이벤트에서 타입화된 UI 상태를 만든다.
- DOM UI는 UI 상태를 표시하고 사용자 입력을 게임 명령으로 전달한다.
- 디버그 패널·리플레이·스크린샷 테스트 화면처럼 게임성을 직접 결정하지 않는 영역에 선언적 UI 구조를 우선 적용한다.

## 2. 적용하지 않는 항목

다음은 현재 범위에서 적용하지 않는다.

- AI가 실시간 게임 화면 전체를 JSON으로 생성하도록 변경
- 카드 배치, 카드 선택, 카드 애니메이션을 JSON UI 렌더러로 대체
- React/Vue/Svelte 또는 shadcn 의존성 추가
- 외부 AI API와 JSONL streaming을 게임 진행 경로에 추가
- “에러 0%” 또는 “0.1초 반응”을 품질 보장으로 간주

json-render는 Catalog로 허용된 컴포넌트와 action을 제한하는 프레임워크이지, 임의의 UI 오류를 0으로 만드는 도구가 아니다. 또한 AI 생성과 streaming을 사용하려면 별도 모델·서버 경로가 필요하다.

## 3. 프로젝트에 적용할 최소 구조

### 3.1 타입화된 UI 상태

게임 상태를 직접 DOM에 흩어 쓰기보다 다음과 같은 표시용 상태 경계를 만든다.

```ts
type GameUiState = {
  turn: 'player' | 'cpu';
  status: string;
  score: { player: number; cpu: number };
  modal: 'none' | 'choice' | 'go-stop' | 'result';
};
```

이 상태는 게임의 권위 있는 상태가 아니다. `EventBus` 이벤트를 화면 표시용으로 투영한 값이며, 게임 규칙·점수·카드 소유권을 결정하지 않는다.

### 3.2 허용 UI 블록

초기 목록은 다음으로 제한한다.

```ts
type UiBlock =
  | 'StatusBanner'
  | 'ScorePanel'
  | 'ChoiceModal'
  | 'GoStopModal'
  | 'ResultModal';
```

카드 영역, 턴 판정, 점수 계산, CPU 의사결정은 UI 블록의 책임에 포함하지 않는다.

### 3.3 우선 적용 대상

1. 디버그 이벤트 로그
2. 상태별 UI 스냅샷·스크린샷 테스트 패널
3. 리플레이 요약 패널
4. 현재 `main.ts`의 상태 표시·모달 갱신 경계

실제 플레이 UI 리팩터링은 위 구조가 테스트로 고정된 뒤 진행한다.

## 4. 작업 순서

### P1 — UI 상태 경계

- [ ] `GameUiState` 타입과 초기 상태 정의
- [ ] `EventBus` 이벤트를 UI 상태로 변환하는 순수 함수 작성
- [ ] 상태 변환 테스트: 플레이어·CPU 턴, 점수, choice/go-stop/result 모달
- [ ] 기존 DOM 표시가 바뀌지 않는지 browser smoke 확인

### P1 — 제한된 UI 블록

- [ ] UI 블록별 입력·출력 계약 정의
- [ ] `ChoiceModal`, `GoStopModal`, `ResultModal`의 표시 책임 분리
- [ ] 게임 규칙·카드 상태가 UI 블록을 통해 변경되지 않는지 테스트

### P2 — 개발·검증 도구

- [ ] 이벤트 로그와 `GameUiState`를 이용한 디버그 패널
- [ ] 5개 기준 상태(배분 완료, 일반 턴, 먹을 패 선택, GO/STOP, 결과) 스냅샷 경로
- [ ] 필요할 때만 선언적 JSON 형태로 디버그 화면 저장

## 5. 완료 기준

- `npm test` 통과
- `npm run build` 통과
- UI 변경 시 `npm run test:browser`의 모바일·데스크톱 경로 통과
- 플레이어·CPU 턴 흐름 유지
- 모든 테스트 지점에서 48장 고유 카드 invariant 유지
- UI 상태 변경이 게임 권위 상태나 카드 소유권을 직접 변경하지 않음
- 새 UI 라이브러리나 AI 서버를 추가하지 않고도 기본 적용 가능

## 6. 판단

현재는 json-render 패키지를 설치하지 않는다. 이 프로젝트에 필요한 것은 AI가 화면을 생성하는 기능보다, 이미 존재하는 이벤트 기반 게임 구조를 더 명확한 UI 상태·블록 계약으로 정리하는 일이다. 이후 디버그·리플레이 요구가 실제로 생기면 해당 영역에 한해 json-render의 Catalog/Registry 개념을 검토한다.
