# Design vs code comparison

> 최신 아키텍처 산출물은 이 문서와 함께 갱신되었습니다. 게임 규칙과 화면 의도는 [docs/rearch/design.md](../rearch/design.md)를 기준으로 확인하세요.

검토일: 2026-09-08  
검토 범위: `docs/rearch/design.md`, `src/`, `index.html`, `package.json`

## Confirmed aligned areas

| Design intent | Current implementation | Status |
|---|---|---|
| 48-card Hwatu deck, four cards per month | `HWATU_CARDS`, `getCardFamily`, `GameState.validateInvariants` | Confirmed |
| 10 player / 10 CPU / 8 floor / 20 deck opening layout | `GameState.initNewGame` | Confirmed |
| Play a hand card, then reveal one deck card | `Game.executeTurn` → `executeDeckDraw` | Confirmed |
| One matching floor card is captured | `evaluateCardMatch` returns `single` with two cards | Confirmed |
| Two matching floor cards require a choice | `MatchResult.type === 'choice'`, DOM choice modal | Confirmed |
| Three matching floor cards capture all four | `MatchResult.type === 'triple'` | Confirmed |
| Responsive layout for phone/tablet/web | `SceneManager.layoutScale`, responsive CSS, hand/floor position helpers | Partially confirmed; needs device matrix QA |
| Captured cards remain distinguishable from hand/floor | dedicated captured tray, 55% mesh scale, capture notice | Partially confirmed; needs dense-capture QA |
| Go/Stop interaction after reaching the threshold | `finishTurn` emits `GO_STOP_REQUIRED` at score 3+ | Confirmed for basic flow |

## Gaps and follow-up work

1. **Automated rule coverage** — Vitest now covers no-match, single, choice, triple, malformed-result rejection, initial 48-card conservation and basic scoring. Deck-draw/Go-Stop flow tests remain.
2. **Deck-draw choice path** — verify with a deterministic fixture that a two-match on the revealed deck card pauses, shows two distinct cards and captures exactly the selected pair after resolution.
3. **Special draw events** — Seolsa detection is now deferred until the deck reveal; Ttadak, Jjok and optional Pi transfers still need their full state-flow tests.
4. **Physical card identity in UI** — the family is correctly derived from card IDs, but the atlas and card labels need visual regression checks so a 6-month junk card and 6-month animal card cannot appear identical.
4. **Scoring completeness** — current scoring covers basic gwang, animal, godori, ribbon and junk thresholds; regional variants, bomb/three-player rules and special-pi rules are not represented.
5. **Responsive density** — test at 390×844, 768×1024 and desktop widths with large captured collections. The current thumbnail tray is a mitigation, not a complete overflow policy.
6. **Encoding cleanup** — some user-facing Korean strings are visibly corrupted in the current source snapshot. Normalize them before final UX review.
7. **Visual feedback** — keep the capture notice and Go/Stop modal prominent long enough to explain the score and its reasons, then verify keyboard/focus behavior.

## Duplicate / missing-code review

자세한 구조체·함수 호출 분석은 [usage-and-unused-analysis.md](./usage-and-unused-analysis.md)를 참고한다.

### Confirmed duplicates avoided

- Matching uses `getCardFamily(card)` in one shared rule function; it does not independently compare the unreliable display month field in multiple callers.
- Score calculation has one canonical implementation (`calculateScoreBreakdown`), with `calculateScore` as a small compatibility wrapper.
- DOM event subscriptions are centralized in `src/main.ts`; `Game` emits events rather than directly mutating overlay elements.

### Potentially missing or unverified

- Vitest now verifies the core rule functions, but asynchronous deck-draw and Go/Stop paths are not yet covered.
- No static dead-code report is available; unused exports are therefore not classified as dead.
- No screenshot baseline or automated device viewport matrix is checked into the repository.
- No persisted replay/seed mechanism is exposed through the UI, although the deck initializer accepts an injectable random source for tests.

## Priority recommendation

1. Add deterministic rule/game-flow tests.
2. Fix the visible Korean string encoding corruption.
3. Verify choice and deck-draw paths with screenshots at phone/tablet/desktop sizes.
4. Refine scoring and special rules only after the basic flow is covered.
