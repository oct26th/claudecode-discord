# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

모바일 Discord에서 여러 프로젝트의 Claude Code 세션을 관리하는 봇. Discord 채널마다 독립적인 Claude Agent SDK 세션을 프로젝트 디렉토리에 매핑하여 실행. 쓰기 도구(Edit, Write, Bash)는 Discord 버튼으로 승인/거절 처리하고, 읽기 전용 도구는 자동 승인. 이미지 첨부 시 프로젝트 내 `.claude-uploads/`에 다운로드 후 Read 도구로 전달. macOS, Linux, Windows(네이티브/WSL) 지원.

## 명령어

```bash
npm run dev          # 개발 실행 (tsx)
npm run build        # 프로덕션 빌드 (tsup, ESM)
npm start            # 빌드된 파일 실행
npm test             # 테스트 실행 (vitest)
npm run test:watch   # 테스트 watch 모드
npx tsc --noEmit     # 타입 체크만 수행
./install.sh         # macOS/Linux 자동 설치 (Node.js, Claude Code, npm)
install.bat          # Windows 자동 설치
```

## 아키텍처

```
[모바일 Discord] ←→ [Discord Bot (discord.js v14)] ←→ [SessionManager] ←→ [Claude Agent SDK]
                              ↕
                        [SQLite (better-sqlite3)]
```

**핵심 데이터 흐름:** 등록된 채널에 메시지 전송 → `message.ts` 핸들러에서 인증/레이트리밋 검증 → 이미지 첨부 시 다운로드 후 프롬프트에 경로 추가 → `SessionManager.sendMessage()`가 Agent SDK `query()` 생성/재개 → 스트리밍 응답을 1.5초 간격으로 Discord 메시지 edit → 텍스트 출력 전에는 15초마다 heartbeat로 진행 상황 표시 (도구명, 경과시간, 도구 사용 횟수) → tool use 발생 시 `canUseTool` 콜백이 읽기 전용이면 자동 승인, 아니면 Discord 버튼 embed 전송 → 사용자 승인/거절 → promise resolve → 결과 embed(비용/소요시간) 전송.

### 파일 구조

```
claudecode-discord/
├── install.sh              # macOS/Linux 자동 설치 스크립트
├── install.bat             # Windows 자동 설치 스크립트
├── .env.example            # 환경변수 템플릿
├── src/
│   ├── index.ts            # 엔트리포인트
│   ├── bot/
│   │   ├── client.ts       # Discord 봇 초기화 & 이벤트 라우팅
│   │   ├── commands/       # 슬래시 명령어 (6개)
│   │   │   ├── register.ts
│   │   │   ├── unregister.ts
│   │   │   ├── status.ts
│   │   │   ├── stop.ts
│   │   │   ├── auto-approve.ts
│   │   │   └── sessions.ts
│   │   └── handlers/
│   │       ├── message.ts      # 메시지 처리, 이미지 다운로드
│   │       └── interaction.ts  # 버튼/셀렉트메뉴 처리
│   ├── claude/
│   │   ├── session-manager.ts  # 세션 생명주기, 진행 상황 표시
│   │   └── output-formatter.ts # Discord 출력 포맷
│   ├── db/
│   │   ├── database.ts     # SQLite 초기화 & 쿼리
│   │   └── types.ts
│   ├── security/
│   │   └── guard.ts        # 인증, rate limit, 경로 검증
│   └── utils/
│       └── config.ts       # 환경변수 검증 (zod v4)
├── SETUP.md                # 상세 셋업 가이드
├── package.json
└── tsconfig.json
```

### 주요 모듈

- **`src/bot/client.ts`** — Discord.js 클라이언트 초기화, 이벤트 라우팅, 길드별 슬래시 커맨드 등록
- **`src/bot/commands/`** — 슬래시 커맨드 6개: register, unregister, status, stop, auto-approve, sessions
- **`src/bot/handlers/message.ts`** — 채널 메시지를 보안 검증 후 SessionManager로 전달. Discord 이미지 첨부 감지 시 `.claude-uploads/`에 다운로드하여 프롬프트에 파일 경로 추가
- **`src/bot/handlers/interaction.ts`** — 버튼 인터랙션(approve/deny/approve-all) 및 StringSelectMenu(세션 선택) 처리
- **`src/claude/session-manager.ts`** — 채널별 활성 세션을 관리하는 싱글톤. Agent SDK의 `query()`와 `canUseTool` 콜백으로 승인 워크플로우 구현. requestId 기반 Map으로 pending approval 관리 (5분 타임아웃). SDK session ID로 세션 재개 지원. 봇 재시작 시 DB에서 session_id 로드하여 자동 재개. 텍스트 출력 전 heartbeat(15초 간격)로 진행 상황 표시
- **`src/bot/commands/sessions.ts`** — `~/.claude/projects/`의 JSONL 세션 파일을 스캔하여 기존 세션 목록 표시. Discord StringSelectMenu로 세션 선택 후 재개
- **`src/claude/output-formatter.ts`** — Discord 2000자 제한에 맞춘 메시지 분할, tool 승인 요청 및 결과 embed 생성
- **`src/db/database.ts`** — SQLite WAL 모드. data.db 자동 생성. 테이블 2개: `projects`(채널→프로젝트 경로 매핑, auto_approve 플래그), `sessions`(세션 상태 추적, SDK session_id 저장)
- **`src/security/guard.ts`** — 유저 화이트리스트(ALLOWED_USER_IDS), 인메모리 슬라이딩 윈도우 레이트리밋, 경로 순회(`..`) 차단
- **`src/utils/config.ts`** — Zod v4 스키마로 환경변수 검증, 싱글톤 패턴

### Tool 승인 로직 (`canUseTool`)

1. 읽기 전용 도구 (Read, Glob, Grep, WebSearch, WebFetch, TodoWrite) → 항상 자동 승인
2. 채널의 `auto_approve`가 활성화된 경우 → 자동 승인
3. 그 외 → Discord 버튼 embed 전송, 사용자 응답 대기 (5분 타임아웃, 미응답 시 거부)

### 세션 상태

- **🟢 online** — Claude가 작업 중
- **🟡 waiting** — tool use 승인 대기
- **⚪ idle** — 작업 완료, 다음 입력 대기
- **🔴 offline** — 세션 없음

### 멀티 PC 지원

PC별로 별도 Discord 봇을 생성하여 같은 길드에 초대. 각 봇은 서로 다른 채널에 프로젝트를 등록하여 독립 운영.

## TypeScript 컨벤션

- ESM 모듈 (`"type": "module"`), 로컬 import에 `.js` 확장자 사용
- strict 모드, `noUnusedLocals`와 `noUnusedParameters` 활성화
- Target: ES2022, moduleResolution: bundler
- Zod v4 사용 (v3과 API 다름에 주의)
- 경로 처리 시 `path.join()`, `path.resolve()` 사용 (Windows 호환)
- 파일명 추출 시 `split(/[\\/]/)` 사용 (macOS/Windows 경로 구분자 모두 지원)

## 환경 설정

`.env.example`을 `.env`로 복사 후 값 설정. 필수: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `ALLOWED_USER_IDS`, `BASE_PROJECT_DIR`. 선택: `RATE_LIMIT_PER_MINUTE` (기본값 10). data.db는 첫 실행 시 자동 생성.
