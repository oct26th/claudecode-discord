# 셋업 가이드

Discord에서 Claude Code 세션을 관리하는 봇을 설치하고 실행하는 방법.

## 1. 사전 요구사항

- **Node.js 20 이상** (`node -v`로 확인)
- **Claude Code CLI** 설치 및 로그인 완료 (`claude --version`으로 확인)
- **Discord 계정** (이메일 인증 완료)

## 2. Discord 봇 생성

### 2-1. Discord Application 생성

1. https://discord.com/developers/applications 접속
2. **"New Application"** 클릭
3. 이름 입력 (예: "My Claude Code") → **Create**

### 2-2. Bot 설정

1. 왼쪽 메뉴 **"Bot"** 클릭
2. **"Reset Token"** 클릭 → 토큰 복사 (이 토큰은 한 번만 표시됨!)
   - 이 값이 `DISCORD_BOT_TOKEN`
3. 아래로 스크롤하여 **Privileged Gateway Intents** 섹션:
   - **MESSAGE CONTENT INTENT** → 활성화 (필수!)
   - Save Changes

### 2-3. 봇을 서버에 초대

1. 왼쪽 메뉴 **"OAuth2"** 클릭
2. **"OAuth2 URL Generator"** 섹션에서:
   - **SCOPES**: `bot`, `applications.commands` 체크
   - **BOT PERMISSIONS**: `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands` 체크
3. 생성된 URL을 복사하여 브라우저에 붙여넣기
4. 초대할 서버 선택 → **Authorize**

## 3. Discord 서버 ID 확인

1. Discord 앱 (데스크톱/모바일) → **사용자 설정** (톱니바퀴)
2. **앱 설정 > 고급** → **개발자 모드** 활성화
3. 서버 이름 우클릭(데스크톱) 또는 길게 누르기(모바일) → **"서버 ID 복사"**
   - 이 값이 `DISCORD_GUILD_ID`

## 4. 사용자 ID 확인

1. 개발자 모드가 활성화된 상태에서
2. 자신의 프로필 클릭 → **"사용자 ID 복사"**
   - 이 값이 `ALLOWED_USER_IDS`
   - 여러 명이면 쉼표로 구분: `123456789,987654321`

## 5. 프로젝트 설치

```bash
git clone <repository-url>
cd claude_thirdparty
npm install
```

## 6. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어서 값을 입력:

```env
DISCORD_BOT_TOKEN=여기에_봇_토큰_붙여넣기
DISCORD_GUILD_ID=여기에_서버_ID_붙여넣기
ALLOWED_USER_IDS=여기에_사용자_ID_붙여넣기
BASE_PROJECT_DIR=/Users/yourname/projects
RATE_LIMIT_PER_MINUTE=10
```

| 변수 | 설명 | 예시 |
|---|---|---|
| `DISCORD_BOT_TOKEN` | 2-2단계에서 복사한 봇 토큰 | `MTQ3MDc...` |
| `DISCORD_GUILD_ID` | 3단계에서 복사한 서버 ID | `1470730378955456578` |
| `ALLOWED_USER_IDS` | 4단계에서 복사한 사용자 ID | `942037337519575091` |
| `BASE_PROJECT_DIR` | 프로젝트들이 있는 상위 디렉토리 | `/Users/you/projects` |
| `RATE_LIMIT_PER_MINUTE` | 분당 메시지 제한 (기본 10) | `10` |

`BASE_PROJECT_DIR`은 `/register` 명령에서 폴더 이름만 입력할 때 기준 경로가 됩니다.
예: `BASE_PROJECT_DIR=/Users/you/projects`이면 `/register my-app` → `/Users/you/projects/my-app`

## 7. 실행

```bash
# 개발 모드 (hot reload)
npm run dev

# 또는 프로덕션 빌드 후 실행
npm run build
npm start
```

정상 실행 시 콘솔에 표시:
```
Logged in as MyClaudeCode#1234
Registered commands for guild: 1470730378955456578
```

## 8. 사용법

### 채널에 프로젝트 등록

Discord에서 원하는 채널로 이동 후:
```
/register path:my-project-folder
```
- 폴더 이름만 입력하면 `BASE_PROJECT_DIR` 하위에서 찾음
- 절대 경로도 가능: `/register path:/Users/you/other/project`

### Claude에게 메시지 보내기

등록된 채널에서 일반 메시지를 보내면 Claude Code가 응답합니다:
```
이 프로젝트의 구조를 설명해줘
```

### 도구 승인

Claude가 파일 수정/생성/명령 실행 등을 요청하면 버튼이 표시됩니다:
- **Approve** — 이번 한 번만 승인
- **Deny** — 거부
- **Auto-approve All** — 이 채널에서 앞으로 자동 승인

### 슬래시 명령어

| 명령어 | 설명 |
|---|---|
| `/register path:<폴더명>` | 현재 채널에 프로젝트 등록 |
| `/unregister` | 프로젝트 등록 해제 |
| `/status` | 전체 프로젝트/세션 상태 확인 |
| `/stop` | 현재 채널의 Claude 세션 중지 |
| `/auto-approve mode:on\|off` | 자동 승인 토글 |

## 9. 서버 보안

- Discord 서버는 기본적으로 **비공개**입니다 (초대 링크 없이는 접근 불가)
- `ALLOWED_USER_IDS`에 등록된 사용자만 봇과 대화할 수 있습니다
- 봇 토큰은 절대 외부에 노출하지 마세요. 노출된 경우 Discord Developer Portal에서 즉시 **Reset Token**

## 10. 트러블슈팅

### 봇이 메시지에 반응하지 않음
- MESSAGE CONTENT INTENT가 활성화되어 있는지 확인 (2-2단계)
- `ALLOWED_USER_IDS`에 본인 ID가 포함되어 있는지 확인

### "Unknown interaction" 에러
- 봇이 3초 내에 응답하지 못한 경우 발생 → 보통 자동으로 해결됨

### 슬래시 명령어가 안 보임
- 봇을 서버에 초대할 때 `applications.commands` 스코프를 체크했는지 확인
- 봇 재시작 후 최대 1시간 소요될 수 있음 (Discord 캐시)

### 세션 이어하기
- 봇을 재시작해도 이전 세션을 이어갈 수 있습니다 (session ID가 DB에 저장됨)
- `/stop` 후에도 세션 기록은 유지됩니다 (다음 메시지 시 자동 재개)
- `/unregister`를 하면 세션이 완전히 삭제됩니다
