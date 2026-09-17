# 2026-09-17 실행 체크리스트

목적: 사용자 확인이 필요한 결정은 분리하고, 코드·자동 테스트로 확정할 수 있는 작업을 구현과 검증으로 나누어 진행한다.

## 진행 규칙

- 구현 작업과 검증 작업을 분리한다.
- 각 작업은 `npm test`, `npm run build`, 필요한 경우 `npm run test:browser`를 실행한다.
- 48장 고유 카드 invariant와 플레이어·CPU 턴 흐름을 함께 확인한다.
- 사용자 확인이 필요한 항목은 임의로 결정하지 않고 `BLOCKED: USER`로 남긴다.
- 현재 세션에는 실제 저비용 서브모델/병렬 에이전트 호출 도구가 없으므로, 모델 할당은 작업 카드로만 기록하고 구현·검증은 현재 세션에서 수행한다.

## 완료된 작업

- [x] 라운드 세대 가드와 GO/STOP continuation 차단
- [x] pending 손패·드로우 카드의 48장 invariant 포함
- [x] 설사·쪽 이후 양측 획득 상태 UI 동기화
- [x] 목표 점수별 힌트와 숫자형 localStorage 룰 복원
- [x] 카드·렌더러 반복 라운드 리소스 정리
- [x] 바닥패 반응형 배치 보완 및 시각 회전 결정성 확보
- [x] 백그라운드 전환 시 게임·오디오 일시정지/복귀
- [x] reduced-motion CSS 및 카드 tween 지원
- [x] 모달 ARIA와 키보드 포커스 처리
- [x] 모바일·데스크톱 browser smoke 검증 확장
- [x] 무승부 전용 오디오 분기
- [x] 플레이어·CPU 점수를 상세 패널에서도 함께 표시

## 자동 진행 작업 카드

### Worker A — 저비용 구현 검토

- [ ] A1. Game/EventBus 이벤트 payload와 구독 해제 경계 점검
- [x] A2. pending·재시작·GO/STOP 경합 회귀 테스트 추가
- [ ] A3. 카드 영역·획득 트레이 계산의 invariant 및 resize 테스트 보강
- [ ] A4. AudioManager fallback·mute·visibility 수명주기 테스트 보강

### Worker B — 저비용 검증 검토

- [x] B1. `npm test`, `npm run build`, `npm run test:browser` 반복 실행
- [x] B2. 390×844·1280×800 overflow, canvas 중복, 콘솔 오류 확인
- [x] B3. 룰 설정 저장·reload 복원과 reduced-motion DOM 상태 확인
- [ ] B4. 사용자 확인 필요 항목과 자동 처리 가능 항목 재분류

### 현재 세션 통합 작업

- [ ] C1. A/B 결과를 현재 코드와 대조
- [ ] C2. 결함 발견 시 작은 수정과 회귀 테스트 작성
- [ ] C3. 통과 단위별 중간 커밋·푸시
- [ ] C4. 체크리스트와 인계 문서 갱신

## 사용자 확인 전까지 보류

- [ ] U0. 서로 다른 기기 3인 온라인 방과 4인 이상 광팔기 모드 — 구조 초안은 `20260917-online-3plus-player-architecture.md`에 기록
- [ ] U1. 실제 BGM/SFX 파일 선정 및 라이선스 확인 — `BLOCKED: USER`
- [ ] U2. 기본 맞고 외 특수 룰의 출시 포함 범위 — `BLOCKED: USER`
- [ ] U3. 실기기에서 카드 겹침·터치 영역·safe-area 최종 판정 — `BLOCKED: DEVICE/USER`
- [ ] U4. 앱인토스 WebView SDK·패키징·출시 계정 연결 — `BLOCKED: USER/EXTERNAL`

## 완료 기준

- 자동 테스트와 브라우저 smoke가 모두 통과한다.
- 사용자 확인 항목을 임의로 결정하지 않는다.
- `main`과 `origin/main`이 일치하고, 미커밋 변경은 의도적으로 남긴 경우에만 존재한다.
