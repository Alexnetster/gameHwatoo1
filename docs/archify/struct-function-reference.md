# Structure and function reference

> Generated from direct source inspection on 2026-09-08. File and line references are anchors into the current working tree; re-check them after large edits.

## Confirmed exported structures and functions

### `src/game/types.ts`

- `CardCategory`, `SubType`, `PlayerId`: domain unions.
- `CardDef`: card identity, month family, atlas coordinates, category and scoring metadata.
- `PlayerState`: hand, captured cards, score and go count.

### `src/game/deck.ts`

- `HWATU_CARDS` (line 4): canonical 48-card definition list.
- `createShuffledDeck` (line 78): Fisher-Yates-style shuffle with injectable random source.

### `src/game/rules.ts`

- `MatchResultType`, `MatchResult` (lines 3-11): match result contract.
- `validateMatchResult` (line 13): prevents invalid capture cardinality.
- `getCardFamily` (line 29): derives the authoritative four-card family from the first two ID digits.
- `findFloorMatches` (line 33): returns floor cards in the same family.
- `evaluateCardMatch` (line 38): resolves no match, one match, two-card choice or four-card triple capture.
- `calculateScore` (line 105): public score total.
- `ScoreBreakdown`, `calculateScoreBreakdown` (lines 109-114): score total plus reason strings.

### `src/game/GameState.ts`

- `GamePhase` (line 5): explicit turn and modal phases.
- `GameState` (line 16): owns the player/CPU hands, floor, deck, pending choice cards and invariants.
- `initNewGame` (line 38): deals 10/10/8/20 cards and resets state.
- `validateInvariants` (line 91): confirms 48 unique cards, 12 families and four cards per family.
- `addCaptured` (line 143): moves captures into a player zone and recalculates score.

### `src/game/Game.ts`

- `Game` (line 12): coordinates input, rule evaluation, animation and turn progression.
- `start`, `startNewRound` (lines 30-41): asset loading and initial dealing animation.
- `resolveUserChoice` (line 215): resumes a paused floor/deck choice.
- `resolveGoStop` (line 335): handles player Go or Stop.
- `applyMatchResult` (line 258): validates and applies a match, then moves cards to floor/capture tray.
- `finishTurn` (line 309): checks game over, Go/Stop threshold and turn switching.

### `src/game/cpu.ts`, `src/game/EventBus.ts`

- `CpuAI`: selects a hand card and a candidate floor card.
- `EventBus`: singleton event transport between game domain and DOM UI.
- `EventCallback`: event callback type.

### `src/three/`

- `CardMesh` and `CARD_WIDTH/HEIGHT/DEPTH`: renderable card dimensions and face/back state.
- `SceneManager`: Three.js scene, camera, renderer and `layoutScale`.
- `CardAnimator`: movement/tween helper.
- `InteractionManager`: pointer raycasting and card click callbacks.

### `src/utils/AssetManager.ts`

- `AssetManager`: loads the SVG atlas, maps all 12 month families × 4 cards and exposes texture/image URL lookup.

## Confirmed call relationships

```text
main.ts
  -> Game.start()
  -> EventBus subscriptions
Game
  -> GameState.initNewGame()
  -> evaluateCardMatch()
  -> GameState.addCaptured()
  -> SceneManager / CardMesh / CardAnimator / InteractionManager
  -> EventBus emissions
main.ts
  <- EventBus status, capture, choice, Go/Stop and game-over events
```

## Static-analysis limitations / inference

- No `archify`, `staticcheck`, dead-code analyzer or test runner is installed/configured in `package.json`.
- The reference above lists exported declarations found with source inspection. “Unused” cannot be conclusively claimed without a compiler/dead-code pass.
- `main.ts` is an application entrypoint and therefore has no exported API; it is still a required runtime module.
- `GameState.validateInvariants` is confirmed to run after dealing and capture mutations. Full mutation coverage across every asynchronous animation path is an inference and should be covered by tests.
