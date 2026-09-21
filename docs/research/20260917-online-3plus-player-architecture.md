# 온라인 3인 이상 고스톱 구조

## 목표

서로 다른 기기에서 최소 3명이 하나의 방에 입장해 고스톱을 진행한다. 4명 이상이 입장한 경우에는 실제 플레이어 3명을 유지하고, 나머지 참가자는 광팔기 또는 빠지기 상태로 처리할 수 있는 확장 구조를 사용한다.

현재 Vite + Three.js 앱은 브라우저 한 곳의 `player`와 `cpu`만 지원하므로, 온라인 멀티플레이를 위해 게임 엔진·방 서버·렌더링 클라이언트를 분리한다.

## 플레이 모드

### 3인 고스톱

```text
room
├─ seat 0: human
├─ seat 1: human
└─ seat 2: human
```

- 3명 모두 다른 기기에서 입장한다.
- 기본 배분 후보: 각 손패 7장, 바닥 6장, 더미 21장.
- 선과 진행 방향은 방 생성 시 고정한다.
- 서버가 덱·손패·바닥·획득패·턴·점수를 권위 있게 소유한다.

### 4명 이상 참가

```text
room
├─ active seat 0
├─ active seat 1
├─ active seat 2
└─ extra participant: spectator / 광팔기 / 빠지기
```

- 먼저 방에 입장한 인원과 실제 플레이 인원을 분리한다.
- 실제 게임은 3개의 active seat만 사용한다.
- extra participant의 광팔기 카드, 대상, 정산 시점은 룰 프리셋으로 분리한다.
- 광팔기를 현금·현물 정산으로 연결하지 않고 게임 내 점수/가상 정산으로 먼저 구현한다.

## 서버 권위 상태

클라이언트는 카드 결과를 결정하지 않고 action만 요청한다.

```ts
type SeatStatus = 'empty' | 'connected' | 'ready' | 'active' | 'spectator' | 'sold' | 'left';

interface RoomPlayer {
  playerId: string;
  seat: number;
  status: SeatStatus;
  displayName: string;
}

interface RoomState {
  roomId: string;
  phase: 'LOBBY' | 'READY' | 'PLAYING' | 'GO_STOP' | 'ROUND_OVER';
  players: RoomPlayer[];
  activeSeats: number[];
  turnSeat: number;
  sequence: number;
  rulePreset: string;
}
```

서버만 보유해야 하는 데이터:

- 전체 덱과 셔플 seed
- 각 플레이어의 비공개 손패
- 바닥패·더미·획득패
- pending 선택 카드
- 점수·GO 횟수·배수·특수 룰 상태
- 광팔기 대상과 정산 상태

## 통신 계약 초안

클라이언트 → 서버:

- `room.create`
- `room.join`
- `room.ready`
- `room.chooseSeat`
- `game.playCard`
- `game.chooseMatch`
- `game.goStop`
- `game.sellGwang`
- `game.leave`
- `game.reconnect`

서버 → 클라이언트:

- `room.snapshot`
- `room.playerJoined`
- `room.playerReady`
- `game.started`
- `game.turnChanged`
- `game.cardPlayed`
- `game.cardDrawn`
- `game.choiceRequired`
- `game.captureUpdated`
- `game.scoreUpdated`
- `game.specialEvent`
- `game.goStopRequired`
- `game.roundOver`
- `room.error`

모든 이벤트에는 `roomId`, `roundId`, `sequence`, `actorSeat`를 포함한다. 클라이언트는 sequence가 이전인 이벤트를 버리고, 재접속 시 서버 snapshot을 기준으로 화면을 재구성한다.

## 구현 순서

1. `GameState`에서 `player/cpu` 고정을 제거하고 `players[]`·`activeSeats` 기반 상태 모델을 만든다.
2. Three.js와 DOM을 사용하지 않는 headless 규칙 엔진을 분리한다.
3. 3인 배분·턴 순환·양측이 아닌 3자 점수·게임 종료 판정을 테스트한다.
4. WebSocket 서버의 방·준비·입장·재접속 프로토콜을 만든다.
5. 서버 엔진과 클라이언트의 action/event adapter를 연결한다.
6. 4번째 참가자의 spectator·광팔기·빠지기 상태를 추가한다.
7. 실제 기기 3개와 4개로 방 입장부터 결과까지 E2E 검증한다.

## 확인이 필요한 결정

- 백엔드 배포 위치와 WebSocket 서비스 선택
- 로그인/익명 참가 및 초대 코드 정책
- 3인 고스톱의 정확한 룰 프리셋
- 4인 이상에서 광을 파는 카드·대상·정산 규칙
- 광팔기 정산이 게임 내 가상 점수인지 외부 재화인지
- 재접속·방장 이탈·시간 초과 처리
