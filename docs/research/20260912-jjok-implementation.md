# 2026-09-12 쪽 이벤트 구현 및 검증

손패를 내기 전 해당 월 바닥패가 없고 손패·더미 공개 카드가 같은 월이면 쪽으로 판정한다. 두 카드는 한 번에 획득하며, 선택한 피 회수량을 적용한 뒤 점수와 턴 종료를 판단한다.

## 판정과 옵션

| 같은 월 바닥패 수 | 더미 공개 카드 | 처리 |
| --- | --- | --- |
| 0장 | 손패와 같은 월 | 쪽: 손패와 더미패 2장 획득 |
| 0장 | 다른 월 | 기존 일반 매칭 |
| 1장 | 손패와 같은 월 | 기존 설사 옵션 적용 |
| 2장 | 손패와 같은 월 | 기존 따닥: 4장 획득 |
| 2장 | 다른 월 | 기존 후보 선택 후 더미 매칭 |
| 3장 | 다른 월 | 기존 4장 획득 후 더미 매칭 |

- 월 판정은 기존 `getCardFamily()`의 카드 ID를 사용한다.
- `RuleOptions`는 기존 `SpecialRuleOptions`를 확장하며 `jjokPiReward: 0 | 1 | 2`를 제공한다.
- 기본값은 0장이다. 기존 설사 옵션과 기본 점수 계산은 유지한다.
- `Game`과 `GameState` 생성자에서 부분 옵션을 전달할 수 있다. `GameState.specialRuleOptions`에서도 조정할 수 있고 새 라운드에 유지된다.
- 피는 기존 `transferPi()` 기준으로 상대 획득패 순서에서 가져온다. 쌍피도 회수량에서는 물리적 카드 1장으로 계산하고, 점수 계산에서는 기존 피 2장 값을 유지한다.
- 상대 피가 부족하면 가진 만큼만 회수하며 다른 종류의 카드를 대신 가져오지 않는다.

```ts
const game = new Game(container, { jjokPiReward: 1 });
const state = new GameState({ jjokPiReward: 2, seolsaPiReward: 0 });
```

## 변경 범위

- `src/game/rules.ts`: `evaluateJjokMatch()`와 `jjok` 결과, 정확한 두 장·손패/더미 출처 검증, `RuleOptions`.
- `src/game/GameState.ts`: 기본 옵션 병합과 옵션 주입 API.
- `src/game/Game.ts`: 더미 공개 후 기존 바닥 기준 판정, 단일 더미 소비, 두 장 원자 획득, 피 회수, 양쪽 획득 트레이 재배치, 상태 안내.
- `src/main.ts`: 쪽으로 피를 잃은 쪽도 `CAPTURE_UPDATED`를 통해 점수·획득 수·플레이어 점수 패널 갱신.
- `src/game/rules.test.ts`, `src/game/GameState.test.ts`, `src/game/turn-flow.test.ts`: 결정적 규칙·옵션·실제 턴 경로 검증.
- `docs/rearch/20260908-session-log-and-next-tasks.md`: 완료 항목과 후속 작업 갱신.

`JJOK` 이벤트는 한 번 발생하며 `{ playerId, captured, transferredPi }`를 전달한다. `captured`는 손패와 더미패 두 장이고, 기존 `CARD_CAPTURED`에는 회수한 피까지 포함한 실제 획득 내역을 전달한다. 피를 잃은 쪽에는 새 획득 알림 없이 `CAPTURE_UPDATED`로 최종 획득패를 전달한다.

## 검증 결과

- `npm test`: 3개 파일, 46개 테스트 통과.
- `npx tsc --noEmit`: 성공, 종료 코드 0.
- `npm run build`: 성공, 종료 코드 0. 기존 500KB 초과 청크 경고 유지 (JS 약 559.63KB).
- `git diff --check`: 통과.
- `package-lock.json`: 변경 없음.

턴 테스트는 렌더링·입력 장치·애니메이션 시간만 대체하고 실제 `Game`의 플레이어 클릭, CPU 카드 선택, 더미 공개, 매칭, 보상, 턴 종료를 실행한다. 양쪽 0/1/2장 회수, 피 없음·부족·쌍피, 한 번의 더미 소비/보상/쪽 이벤트, 양쪽 점수 재계산, GO/STOP·마지막 턴, 빈 더미, 설사·따닥·일반/선택/3장 매칭을 검증한다. 각 완료 흐름에서 48개 고유 카드와 월별 4장 invariant를 확인한다.

브라우저에서의 쪽 시각 재현과 옵션 선택 UI는 이번 범위에 포함하지 않았다. 기존 설사 피 회수의 UI 갱신 문제와 애니메이션/선택 대기 중 임시 카드 영역 모델은 별도 후속 검토 대상이다.
