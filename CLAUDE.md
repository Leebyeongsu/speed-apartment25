# CLAUDE.md

이 파일은 클로드 코드(claude.ai/code)가 이 저장소의 코드를 작업할 때 지침을 제공합니다.

## 🏗️ 아키텍처 개요

아파트 통신 환경 개선 신청서를 관리하는 정적 웹 애플리케이션입니다. 순수 JavaScript, HTML5, CSS3로 구축되었으며 **빌드 과정이 필요 없습니다**. 백엔드 데이터 저장을 위해 Supabase를, 이메일 알림을 위해 EmailJS를 활용합니다.

### 핵심 시스템 구성요소

**기술 스택:**
1. **프론트엔드** ([index.html](index.html)) - 모바일 우선 반응형 디자인의 단일 페이지 애플리케이션
2. **JavaScript 코어** ([script.js](script.js)) - 폼 처리, API 통합, UI 상호작용을 처리하는 약 2200줄의 코드
3. **Supabase 통합** ([supabase-config.js](supabase-config.js)) - 연결 테스트를 포함한 데이터베이스 클라이언트 초기화
4. **스타일링** ([style.css](style.css)) - 그라디언트 테마와 애니메이션을 포함한 현대적 반응형 CSS
5. **이미지 자산** - apartment_ehwa.jpg, promotion-flyer.jpg, char.jpg

**주요 기능:**
- **관리자 랜딩 페이지** - 3단계 워크플로우 (STEP 1: 기본 설정, STEP 2: 알림 설정, STEP 3: QR 생성)
- **QR 코드 관리** - 담당자별 고유 QR 코드 생성, 녹색 테두리 포함 다운로드
- **이중 모드 시스템** - 관리자 모드(기본값)와 고객 모드(`?mode=customer`)
- **다채널 알림** - 이메일(EmailJS) 및 SMS 통합 계획
- **카카오톡 연동** - 소셜 공유 기능
- **모바일 디버그 모드** - 모바일 테스트를 위한 Eruda 개발자 도구(`?debug=true`)

### 데이터베이스 스키마 (Supabase)

```sql
-- 관리자 설정 테이블
CREATE TABLE admin_settings (
    id TEXT PRIMARY KEY,              -- apartment_id와 동일 (예: 'speed_apartment21')
    apartment_id TEXT UNIQUE NOT NULL,
    title TEXT,
    phones TEXT[],                    -- 최대 3개의 전화번호
    emails TEXT[],                    -- 최대 3개의 이메일 주소
    apartment_name TEXT,              -- 관리자 전용 필드
    entry_issue TEXT,                 -- 관리자 전용 필드 (진입 테마)
    agency_name TEXT,                 -- 관리자 전용 필드 (KC 이름)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 신청서 테이블
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    application_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    work_type TEXT,
    work_type_display TEXT,
    budget TEXT,
    budget_display TEXT,
    start_date DATE,
    description TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 알림 로그 테이블
CREATE TABLE notification_logs (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES applications(id),
    notification_type TEXT NOT NULL,   -- 'sms' 또는 'email'
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',     -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🚀 개발 명령어

### 로컬 개발
```bash
# 빌드 과정 불필요 - 정적 파일을 직접 서빙
python -m http.server 8000
# 또는
npx serve .

# 접속 모드:
# 관리자 모드:    http://localhost:8000/
# 고객 모드:      http://localhost:8000/?mode=customer
# 디버그 모드:    http://localhost:8000/?debug=true
```

### 설정
- **Supabase URL**: `https://boorsqnfkwglzvnhtwcx.supabase.co`
- **EmailJS User ID**: `8-CeAZsTwQwNl4yE2`
- **Apartment ID**: `speed_apartment21` ([script.js:5](script.js#L5)에 정의)

### 파일 구조
```
speed-apartment-이것으로 계속 영업자 생성_홈페이지/
├── index.html              # 메인 애플리케이션 (492줄)
├── script.js               # 핵심 로직 (2197줄)
├── style.css               # 반응형 스타일 (1968줄)
├── supabase-config.js      # 데이터베이스 클라이언트 설정 (154줄)
├── CLAUDE.md               # 이 파일
├── README.md               # 사용자 문서
└── *.jpg                   # 이미지 자산
```

## 🎯 핵심 기술 개념

### APARTMENT_ID 데이터 흐름

`APARTMENT_ID` 상수([script.js:5](script.js#L5))는 모든 데이터베이스 작업의 **중앙 식별자**입니다:

```javascript
const APARTMENT_ID = 'speed_apartment21';
```

**중요 패턴:**
- 데이터 격리를 위해 `id`와 `apartment_id` 필드 모두 동일한 값으로 설정
- 모든 데이터베이스 쿼리는 `apartment_id`로 필터링하여 멀티 테넌트 데이터 분리 보장
- 이 상수를 변경하면 새로운 격리된 환경 생성

**UPSERT 로직:**
1. 레코드 존재 확인: `.eq('apartment_id', APARTMENT_ID).single()`
2. 에러 코드 `PGRST116` (없음): INSERT 새 레코드
3. 발견됨: `.eq('apartment_id', APARTMENT_ID)`로 UPDATE 기존 레코드

### 애플리케이션 모드

**관리자 모드 (기본값):**
- 랜딩 페이지 디자인의 완전한 관리 인터페이스
- 3단계 워크플로우 카드 (기본 설정 → 알림 → QR 생성)
- 페이지 하단에 갤러리 뷰가 있는 QR 코드 관리
- 데스크톱에서 컨테이너가 `max-width: 1400px`로 확장

**고객 모드 (`?mode=customer`):**
- CSS 클래스 `customer-mode`로 모든 `.admin-only` 요소 숨김
- 신청서 폼과 헤더만 표시
- 최종 사용자 QR 코드 접근용으로 설계
- 컨테이너는 `max-width: 600px` 유지

**토글 메커니즘 ([script.js:103-131](script.js#L103-L131)):**
```javascript
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');
if (mode === 'customer') {
    document.body.classList.add('customer-mode');
    // 관리자 패널 숨김, 고객 폼 표시
}
```

### QR 코드 시스템

**생성 흐름:**
1. 사용자가 "QR 코드 생성" 클릭 → 모달에서 담당자 이름 입력
2. QR에 포함된 URL: `${currentPageUrl}?mode=customer&qr=${encodeURIComponent(qrName)}`
3. qrcode.js 라이브러리를 사용하여 캔버스에 QR 렌더링
4. 다운로드 시 10px 연한 녹색 테두리(#90EE90) 자동 추가

**테두리 포함 다운로드 ([script.js:1850-1890](script.js#L1850-L1890)):**
```javascript
const borderSize = 10;
const borderColor = '#90EE90';
// 테두리가 있는 새 캔버스 생성, 중앙에 QR 그리기, PNG/JPG로 다운로드
```

**갤러리 표시:**
- STEP 3 카드에 최신 QR 표시 (최대 1개)
- 페이지 하단 가로 갤러리에 모든 QR 코드 표시
- localStorage에 다음 구조로 저장:
```javascript
{
    id: timestamp,
    name: staffName,
    url: qrUrl,
    createdAt: new Date().toISOString(),
    isActive: true
}
```

### 데이터 지속성 전략

**localStorage (클라이언트 측):**
- 관리자 설정: 이메일, 전화번호, 아파트 세부정보
- QR 코드 목록
- 사용자 편의를 위한 폼 자동 저장

**Supabase (서버 측):**
- 영구 신청서 제출
- 여러 기기에서 관리자 설정 동기화
- 알림 감사 추적

**동기화 패턴:**
- UX를 위해 로컬 설정을 즉시 저장
- `saveAdminSettingsToCloud()`를 통한 백그라운드 Supabase 동기화
- 로드 시: `loadAdminSettingsFromCloud()`가 클라우드를 먼저 확인하고, 로컬로 폴백

## ⚙️ 설정 관리

### 중요 설정 포인트

**1. 아파트 식별자 ([script.js:5](script.js#L5))**
```javascript
const APARTMENT_ID = 'speed_apartment21';
```

**2. EmailJS 초기화 ([script.js:60](script.js#L60))**
```javascript
emailjs.init('8-CeAZsTwQwNl4yE2');
```

**3. Supabase 연결 ([supabase-config.js:38-39](supabase-config.js#L38-L39))**
```javascript
const supabaseUrl = 'https://boorsqnfkwglzvnhtwcx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**4. Kakao SDK ([script.js:13](script.js#L13))**
```javascript
Kakao.init('YOUR_KAKAO_APP_KEY'); // 실제 키로 교체
```

### UI 커스터마이징

**색상 스키마 ([style.css:47](style.css#L47)):**
- 기본 그라디언트: `#4CAF50`에서 `#45a049`
- 보라색 강조: `#667eea`에서 `#764ba2`
- 유형별로 정의된 기능 버튼 그라디언트

**반응형 중단점:**
- 데스크톱: `max-width: 1400px` (관리자 모드)
- 태블릿: `@media (max-width: 1024px)`
- 모바일: `@media (max-width: 768px)` - 관리자 패널 숨김
- 소형 모바일: `@media (max-width: 480px)`

## 🔧 개발 가이드라인

### 새 기능 추가 시

**폼 필드의 경우:**
1. [index.html](index.html)의 `.application-form` 내에 HTML 입력 추가
2. [script.js](script.js)의 `handleSubmit()` 폼 제출 핸들러 업데이트
3. 모바일 친화적 확인: iOS 줌 방지를 위해 `font-size: 16px`
4. 영구 저장이 필요한 경우 데이터베이스 스키마에 추가

**관리자 설정의 경우:**
1. 기존 모달 패턴을 따라 [index.html](index.html)에 모달 생성
2. [script.js](script.js)에 localStorage 저장/로드 추가
3. 새 필드를 포함하도록 `saveAdminSettingsToCloud()` 업데이트
4. Supabase의 `admin_settings` 테이블 스키마에 추가

**QR 기능의 경우:**
1. `createNewQR()` 함수에서 QR URL 생성 수정
2. `renderQRList()`에서 QR 카드 렌더링 업데이트
3. localStorage 구조: id, name, url, createdAt, isActive가 있는 `qrCodes` 배열

### 모바일 개발 모범 사례

**뷰포트 설정 ([index.html:5](index.html#L5)):**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

**터치 대상 크기:**
- 모든 상호작용 요소에 대해 최소 44px × 44px
- 모바일에서 버튼은 `min-height: 44px` 사용

**디버그 모드:**
- `?debug=true` 또는 `#eruda`를 통해 접근
- 기기 정보가 포함된 복사 가능한 오류 로그 제공
- 모든 JS 오류를 포착하는 전역 오류 핸들러

### 데이터베이스 통합 패턴

**항상 연결 확인:**
```javascript
if (!supabase || !window.supabaseClient) {
    console.error('Supabase가 초기화되지 않음');
    return;
}
```

**표준 CRUD 패턴:**
```javascript
// 읽기
const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .eq('apartment_id', APARTMENT_ID);

// 생성/업데이트 (UPSERT)
const { data: existing, error: checkError } = await supabase
    .from('table_name')
    .select('*')
    .eq('apartment_id', APARTMENT_ID)
    .single();

if (checkError && checkError.code === 'PGRST116') {
    // INSERT
    await supabase.from('table_name').insert(record);
} else {
    // UPDATE
    await supabase.from('table_name')
        .update(record)
        .eq('apartment_id', APARTMENT_ID);
}
```

### 오류 처리 전략

**사용자 대면 오류:**
- 항상 한글로 표시
- 실행 가능한 다음 단계 제공
- 디버깅을 위해 콘솔에 로그

**네트워크 복원력:**
- EmailJS 초기화는 최대 3회 재시도 ([script.js:22](script.js#L22))
- 모바일 기기는 더 긴 대기 시간 (3000ms vs 1500ms)
- 재연결을 위한 온라인/오프라인 이벤트 리스너

**디버그 정보:**
- 모바일 디버깅을 위한 Eruda 콘솔
- 스택 추적이 있는 복사 가능한 오류 로그
- 네트워크 상태 모니터링

## 📊 데이터 흐름 아키텍처

### 신청서 제출 흐름

1. **고객이 폼 작성** → 폼 검증 (HTML5 + JS)
2. **제출 버튼 클릭** → [script.js](script.js)의 `handleSubmit(event)`
3. **신청 번호 생성** → `APP-${timestamp}-${random}`
4. **Supabase에 저장** → `applications` 테이블
5. **알림 전송** → 등록된 모든 관리자 이메일로 EmailJS
6. **확인 표시** → 신청 번호 및 결과 표시

### 관리자 설정 동기화

1. **관리자가 설정 수정** → 즉시 localStorage에 저장
2. **백그라운드 동기화** → `saveAdminSettingsToCloud()` 호출
3. **기존 레코드 확인** → `apartment_id`로 쿼리
4. **UPSERT 작업** → 새 레코드면 삽입, 기존이면 업데이트
5. **확인** → 콘솔에 성공/실패 로그

### QR 코드 라이프사이클

1. **생성** → 사용자가 담당자 이름 입력 → 고유 URL 생성
2. **저장** → localStorage의 `qrCodes` 배열에 추가
3. **렌더링** → qrcode.js 라이브러리로 캔버스 생성
4. **표시** → STEP 3 카드 + 하단 갤러리에 표시
5. **다운로드** → 녹색 테두리 추가 → PNG/JPG로 내보내기
6. **삭제** → localStorage에서 제거 → 목록 재렌더링

## ⚡ 성능 고려사항

**빌드 과정 없음:**
- 즉각적인 개발 반복
- 직접 파일 서빙
- 트랜스파일 불필요

**CDN 의존성:**
- Kakao SDK: developers.kakao.com
- QR Code: cdnjs.cloudflare.com/ajax/libs/qrcodejs
- Supabase: cdn.jsdelivr.net/npm/@supabase/supabase-js@2
- EmailJS: cdn.jsdelivr.net/npm/@emailjs/browser@3
- Eruda: cdn.jsdelivr.net/npm/eruda

**모바일 최적화:**
- 최소한의 JavaScript 실행
- 지연된 스크립트 로딩 (body 끝)
- 터치 최적화된 이벤트 핸들러
- 3G/4G 네트워크에 최적화

## 🐛 디버깅 및 모니터링

### 모바일 디버깅
```javascript
// Eruda 콘솔 활성화
window.location.href = "?debug=true";
// 또는
window.location.hash = "eruda";
```

### 연결 테스트
```javascript
// Supabase 연결 테스트 (로드 시 자동)
testSupabaseConnection();

// EmailJS 초기화 (재시도 포함 자동)
initializeEmailJS();
```

### 일반적인 문제

**Supabase 연결 실패:**
- [supabase-config.js:39](supabase-config.js#L39)에서 API 키 확인
- Supabase 대시보드에 테이블 존재 확인
- 특정 오류 코드에 대한 브라우저 콘솔 확인

**EmailJS 전송 안됨:**
- 사용자 ID 확인: `8-CeAZsTwQwNl4yE2`
- 네트워크 연결 확인
- EmailJS 대시보드에 이메일 템플릿 존재 확인

**QR 코드 생성 안됨:**
- qrcode.js 라이브러리 로드 확인 (CDN)
- localStorage가 가득 차지 않았는지 확인
- 캔버스 오류에 대한 콘솔 확인

## 🔒 보안 고려사항

**클라이언트 측 노출:**
- Supabase anon 키는 공개 (설계상)
- EmailJS 사용자 ID는 공개
- Supabase에서 행 수준 보안(RLS) 구현

**입력 검증:**
- 모든 필수 필드에 HTML5 검증
- Supabase RLS 정책을 통한 서버 측 검증
- XSS 방지: innerHTML 피하고 textContent 사용

**데이터 프라이버시:**
- localStorage에 민감한 데이터 없음
- 프로덕션에서 HTTPS 필수
- apartment_id로 고객 데이터 격리

## 📦 배포

### 정적 호스팅 옵션

**GitHub Pages:**
```bash
git checkout -b gh-pages
git push origin gh-pages
```

**Netlify/Vercel:**
- 루트 디렉토리 업로드
- 빌드 명령 불필요
- 게시 디렉토리: `.` (루트)

**커스텀 서버:**
```bash
# 간단한 HTTP 서버
python -m http.server 8000

# 또는 Node.js 사용
npx serve .
```

### 환경별 설정

**새 아파트 배포의 경우:**
1. [script.js:5](script.js#L5)에서 `APARTMENT_ID` 변경
2. [index.html:12](index.html#L12)에서 페이지 제목 업데이트
3. 이미지 자산 교체 (apartment_ehwa.jpg 등)
4. 소셜 공유를 사용하는 경우 Kakao 앱 키 설정
5. 고객 흐름 확인을 위해 `?mode=customer`로 테스트

## 📚 중요 패턴

### 모달 관리
모든 모달은 다음 패턴을 따릅니다:
```javascript
function showModalName() {
    document.getElementById('modalNameModal').style.display = 'flex';
}

function closeModalName() {
    document.getElementById('modalNameModal').style.display = 'none';
}
```

### 상태 표시 업데이트
```javascript
const displayElement = document.getElementById('statusDisplay');
if (hasValue) {
    displayElement.classList.add('has-content');
    displayElement.textContent = value;
} else {
    displayElement.classList.remove('has-content');
    displayElement.textContent = '';
}
```

### 모드별 렌더링
```javascript
const isCustomerMode = document.body.classList.contains('customer-mode');
if (isCustomerMode) {
    // 관리자 기능 숨김
    document.getElementById('adminControlPanel').style.display = 'none';
} else {
    // 관리자 기능 표시
    document.getElementById('adminControlPanel').style.display = 'block';
}
```

## 🔄 인수인계 지침

사용자가 Claude Code CLI 세션을 종료한다는 표시를 하면, 상위 디렉토리에 인수인계 문서(`[인수인계.md]`)를 자동으로 생성하여 다음을 요약합니다:
- 이 세션에서 완료된 작업
- 보류 중인 작업 또는 문제
- 중요한 설정 변경사항
- 향후 작업을 위한 다음 단계

이 애플리케이션은 아파트 관리팀이 거주자로부터 통신 서비스 업그레이드 요청을 수집하고 관리할 수 있도록 설계되었으며, 모바일 사용성과 관리 효율성에 중점을 두고 있습니다.
