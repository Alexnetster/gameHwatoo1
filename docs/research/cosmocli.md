네. 확인해보니 `Combos`는 단순한 “AI 게임 생성 사이트”라기보다 **게임 생성 + 에셋 생성 + 웹 배포 + 커뮤니티 공유**를 한 번에 묶은 플랫폼에 가깝습니다. [Converge.AI](http://Converge.AI)가 운영하고 있고, 공식 설명상 자연어로 아이디어를 주면 AI 에이전트 `Boo`가 게임 로직과 구조를 만들고, 2D/3D 게임을 브라우저에서 테스트한 뒤 바로 공개 링크로 배포할 수 있습니다. 최근 Gamescom 2026에서도 코딩 경험이 없는 제작자들이 만든 게임 10여 개를 전시했고, 회사 측은 110여 개국 30만 명 이상 제작자 커뮤니티를 언급했습니다. ([Combos Fun](https://combos.fun/features/ai-game-development?utm_source=chatgpt.com "AI Game Development: Create Smarter Games Faster and Easier"))

### Combos CLI가 무엇인가

`CLI`는 **Command Line Interface**, 즉 터미널에서 쓰는 도구입니다.

웹사이트의 Combos 에디터 대신,

> `Codex / Cursor → 게임 코드 작성 → Combos CLI → 에셋·멀티플레이·배포`

이런 개발 흐름을 만들려는 도구라고 보면 가장 정확합니다.

Combos 공식 계정이 오늘 공개한 설명도 상당히 명확합니다.

> “Generate assets. Spin up multiplayer. Ship a playable link.”

즉 현재 확인되는 핵심 기능은 **에셋 생성, 멀티플레이 구성, 플레이 가능한 링크 배포**입니다. 공식 게시물에는 Tripo, Meshy, Midjourney, Suno, ElevenLabs 등 여러 생성 서비스도 함께 언급돼 있습니다. ([TwStalker](https://ww.twstalker.com/search/Midjourney?utm_source=chatgpt.com "Top Tweets for Midjourney on Twitter. | TwStalker"))

쉽게 풀면 이런 구조입니다.

```text
Codex / Cursor / Claude Code
        ↓
게임 코드 작성
HTML / JS / Three.js 등
        ↓
Combos CLI
        ├─ 이미지 생성
        ├─ 3D 에셋 생성
        ├─ 음향/음악 생성
        ├─ 멀티플레이 구성
        └─ 게임 업로드
        ↓
Combos 서버
        ↓
https://.../게임주소
        ↓
친구에게 링크 전송 → 즉시 플레이
```

그래서 **Combos CLI 자체가 Codex나 Cursor를 대신하는 AI 코딩 도구는 아닙니다.**

Codex가 게임을 만드는 **개발자 역할**이라면, Combos CLI는 게임 제작에 필요한 외부 기능과 배포를 묶어주는 **게임 개발용 툴체인/배포 인터페이스** 쪽입니다.

### 기존 Combos와 CLI의 차이


| Combos 웹      | Combos CLI            |
| ------------- | --------------------- |
| 비개발자 중심       | 개발자 중심                |
| 프롬프트로 게임 생성   | 직접 코딩하면서 사용           |
| Boo가 코드/게임 생성 | Codex·Cursor 등이 코드 작성 |
| 브라우저 에디터      | 터미널                   |
| 클릭해서 Publish  | CLI로 배포               |
| 노코드/저코드       | 코드 기반                 |
| 빠른 프로토타입      | 좀 더 자유로운 커스텀 게임       |


웹 버전은 “**게임을 만들어줘**”에 가깝고, CLI는 “**내가 만든 게임에 Combos의 인프라를 붙여줘**”에 더 가깝습니다.

Combos 웹 자체도 이미 프롬프트 → 게임 로직 → 에셋 생성 → 실시간 미리보기 → 웹 링크 게시 구조를 제공합니다. 게시 후 수정하면 라이브 버전에 업데이트되는 방식도 공식 페이지에 설명돼 있습니다. ([Combos Fun](https://combos.converge.ai/ko/features/idle-games?utm_source=chatgpt.com "Combos AI 게임 메이커로 방치형 게임을 빠르게 만들기"))

### 왜 Roblox처럼 보이느냐

여기서 말씀하신 “스치듯 보면 Roblox 같다”는 인상이 꽤 중요한 부분입니다.

Combos가 노리는 것은 Unity 같은 **엔진 판매**보다는,

```text
Roblox
게임 제작
+ 게임 호스팅
+ 커뮤니티
+ 게임 발견
+ 즉시 플레이

Combos
AI 게임 제작
+ 생성형 에셋
+ 게임 호스팅
+ 커뮤니티
+ 즉시 플레이
```

에 가깝습니다.

Combos 공식 Creator Program도 사용자가 만든 게임을 게시하면 다른 사람이 **플레이하고, Remix하고, 제작자와 연결되는 구조**라고 설명합니다. ([Combos Fun](https://combos.converge.ai/creator-program?utm_source=chatgpt.com "Combos Fun | Creator Program · Make Games the World Plays"))

따라서 좀 과감하게 표현하면,

**“AI 시대의 Roblox Studio + [itch.io](http://itch.io) + 생성형 AI 툴”**

정도로 이해하면 구조를 잡기 쉽습니다.

다만 Roblox와 결정적인 차이가 있습니다. Roblox는 자체 런타임·Lua 생태계·경제 시스템·대규모 멀티플레이 인프라가 수년간 축적된 플랫폼이고, Combos는 아직 **AI를 이용한 빠른 웹게임 제작·공유 플랫폼**이라는 성격이 훨씬 강합니다.

### Codex와 붙였을 때가 오히려 재미있습니다

예를 들어 지금 만드시는 Three.js 게임 같은 경우라면 잠재적으로 이런 워크플로가 가능합니다.

```text
1. 프로젝트 생성

2. Codex
"Three.js로 레고 스타일 기차 디펜스 게임 만들어줘"

3. Codex가
- 코드 작성
- 게임 루프
- 적 AI
- UI
- 레벨 시스템 구현

4. Combos CLI
- 캐릭터 이미지 생성
- 배경 생성
- 3D 모델 생성
- BGM 생성

5. Codex
- 생성 에셋 연결
- 게임 수정

6. Combos CLI
- 멀티플레이 기능 연결
- 배포

7. URL 생성

8. 링크를 보내 바로 테스트
```

이게 잘 작동한다면 기존의

```text
Codex
→ GitHub
→ Vercel/Cloudflare
→ 이미지 생성 서비스
→ 3D 생성 서비스
→ 오디오 서비스
→ multiplayer backend
```

처럼 여러 서비스를 따로 관리하던 부분을 상당히 줄여줄 수 있습니다.

그리고 이게 **Combos CLI의 가장 흥미로운 부분**이라고 봅니다.

게임을 AI가 잘 만드는 것도 중요하지만, 실제 개인 개발에서 더 귀찮은 것은 그 다음 단계입니다.

**에셋 → 서버 → 멀티플레이 → 호스팅 → URL → 공유**

Combos는 이 “마지막 20%”를 게임 제작 플랫폼 안으로 흡수하려는 것으로 보입니다. 공식 홍보에서도 정확히 이 부분을 강조하고 있습니다. ([Instalker](https://www.instalker.org/ClubAiworld?utm_source=chatgpt.com "AI Club @ClubAiworld - Twitter Profile | Instalker"))

한 가지는 구분해 둘 필요가 있습니다. 현재 `Combos CLI`가 막 공개된 시점이라 **지원하는 게임 프레임워크, 프로젝트 구조, 멀티플레이 백엔드 구조, 소스 export 가능 범위, 배포 제한, 요금/크레딧 정책** 같은 개발자 관점의 핵심 정보는 검색 결과만으로 아직 충분히 확인되지 않습니다.

제가 다음으로 본다면 **① Combos CLI 실제 설치법과 명령어, ② Three.js 프로젝트를 그대로 올릴 수 있는지, ③ Codex에서 만드는 현재 게임에 실제로 붙일 가치가 있는지, ④ Roblox·Rosebud·Websim·Vercel과 무엇이 다른지** 이 네 가지를 확인하는 게 핵심입니다. 특히 ③을 보면 알렉스님이 지금 만들고 있는 Three.js 게임 프로토타입의 배포 파이프라인을 Combos로 대체할 수 있는지도 판단할 수 있습니다.