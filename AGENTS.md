# AGENTS.md

- Vite + TypeScript + Three.js 프로젝트입니다.
- 게임 규칙과 턴 흐름은 `src/game/`, 화면 UI는 `src/main.ts`에 있습니다.
- 변경 후 `npm test`와 `npm run build`를 실행합니다.
- 플레이어와 CPU 흐름을 함께 검증하고, 48장 고유 카드 invariant를 유지합니다.
- `package-lock.json`은 의존성 변경이 필요할 때만 수정합니다.
- 기존 작업 중인 변경사항을 덮어쓰지 말고 변경 범위를 작게 유지합니다.
- 룰과 작업 우선순위의 상세 내용은 `docs/rearch/`를 참고합니다.
