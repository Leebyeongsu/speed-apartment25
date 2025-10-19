# Speed 아파트 통신 환경 개선 신청서 홈페이지 작성

웹 기반 아파트 통신 환경 개선 신청서 시스템입니다. Supabase 데이터베이스, EmailJS 알림, QR 코드 생성, 카카오톡 공유 기능을 제공합니다.

**GitHub 저장소:** https://github.com/Leebyeongsu/speed-apartment25

## 🚀 주요 기능

### 관리자 모드 (기본)
- 📧 **이메일/전화번호 관리**: 최대 3개까지 등록 가능
- 🏢 **아파트 정보 설정**: 아파트명, 진입테마, 영업KC 이름
- 📱 **QR 코드 생성**: PNG/JPG 다운로드 지원, 6자리 짧은 코드로 QR 복잡도 50% 감소
- 🎯 **QR별 데이터 격리**: 각 QR 코드마다 고유한 아파트 정보 저장 및 관리
- 💬 **카카오톡 공유**: 소셜 미디어 배포
- 📊 **신청서 관리**: Supabase 실시간 데이터 저장

### 고객 모드 (`?mode=customer&qr_id=xxx`)
- ✍️ **간단한 신청서 작성**: 관리 기능 숨김 처리
- 📱 **모바일 최적화**: 반응형 디자인
- 🔔 **자동 알림**: 제출 시 관리자에게 이메일/SMS 발송
- 🎯 **QR별 데이터 자동 로드**: URL 파라미터로 전달된 QR ID로 해당 아파트 정보 자동 조회
- 📧 **맞춤형 이메일**: 스캔한 QR 코드의 고유한 아파트 이름이 이메일 제목에 표시

## 📋 시스템 요구사항

- 웹 브라우저 (Chrome, Safari, Firefox 등)
- 인터넷 연결
- Supabase 계정 (데이터베이스)
- EmailJS 계정 (이메일 알림)
- 카카오 개발자 계정 (선택사항, 공유 기능용)

## 🛠️ 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone https://github.com/Leebyeongsu/speed-apartment25
cd speed-apartment-이것으로 계속 영업자 생성_홈페이지
```

### 2. 로컬 서버 실행
```bash
# Python 사용
python -m http.server 8000

# 또는 Node.js 사용
npx serve .
```

### 3. 브라우저 접속
```
관리자 모드: http://localhost:8000/
고객 모드: http://localhost:8000/?mode=customer
디버그 모드: http://localhost:8000/?debug=true
```

## ⚙️ 환경 설정

### Supabase 설정

#### 1. 데이터베이스 테이블 생성
```sql
-- 관리자 설정 테이블
CREATE TABLE admin_settings (
    id TEXT PRIMARY KEY,
    apartment_id TEXT UNIQUE NOT NULL,
    title TEXT,
    phones TEXT[],
    emails TEXT[],
    apartment_name TEXT,
    entry_issue TEXT,
    agency_name TEXT,
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
    notification_type TEXT NOT NULL,
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QR 코드 테이블
CREATE TABLE qr_codes (
    id TEXT PRIMARY KEY,              -- speed_apartment21_abc123
    apartment_id TEXT NOT NULL,       -- speed_apartment21
    qr_name TEXT NOT NULL,            -- 담당자 이름
    qr_url TEXT NOT NULL,             -- ?mode=customer&qr_id=abc123
    apartment_name TEXT,              -- 아파트 이름 (QR별)
    entry_issue TEXT,                 -- 진입 테마
    agency_name TEXT,                 -- 영업KC 이름
    emails TEXT[],                    -- 알림 이메일 (최대 3개)
    phones TEXT[],                    -- 알림 전화번호 (최대 3개)
    is_active BOOLEAN DEFAULT true,
    scan_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. supabase-config.js 수정
```javascript
const supabaseUrl = 'https://YOUR_PROJECT.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY';
```

### EmailJS 설정

#### 1. EmailJS 사용자 ID 설정 (script.js)
```javascript
emailjs.init('YOUR_EMAILJS_USER_ID');
```

#### 2. 이메일 템플릿 생성
EmailJS 대시보드에서 템플릿 생성 후 템플릿 ID 확인

### 카카오톡 공유 설정 (선택사항)

#### script.js 수정
```javascript
Kakao.init('YOUR_KAKAO_APP_KEY');
```

## 🏗️ 프로젝트 구조

```
speed-apartment-이것으로 계속 영업자 생성_홈페이지/
├── index.html                    # 메인 웹 페이지 (v8)
├── script.js                     # 핵심 JavaScript 로직 (3,300+ 줄, v8)
├── style.css                     # 반응형 스타일시트 (v8)
├── supabase-config.js            # Supabase 클라이언트 설정 (v8)
├── CLAUDE.md                     # 개발 문서
├── README.md                     # 프로젝트 안내서 (이 파일)
├── 개발_작업_상세_내역.md         # 개발 작업 상세 기록
├── apartment_name_수정.md        # 아파트명 수정 기록
├── 이미지추가.md                  # 이미지 추가 기록
├── apartment_ehwa.jpg            # 아파트 이미지
├── promotion-flyer.jpg           # 프로모션 이미지
└── char.jpg                      # 캐릭터 이미지
```

## 📱 사용 방법

### 관리자 작업 흐름

1. **초기 설정**
   - 🏢 아파트 이름 입력
   - 🎨 진입 테마 설정
   - 👥 영업KC 이름 입력
   - 📧 관리자 이메일 등록 (최대 3개)
   - 📱 관리자 전화번호 등록 (최대 3개)

2. **QR 코드 생성**
   - "QR 코드 생성" 버튼 클릭
   - PNG 또는 JPG 다운로드
   - 홍보물에 부착

3. **QR 설정 수정 (필요시)**
   - 생성된 QR 카드에서 "⚙️ 기본 설정 수정" 버튼 클릭
   - 아파트 정보, 알림 설정 수정
   - 수정 내용이 즉시 반영됨 (QR URL 변경 없음)

4. **고객 링크 공유**
   - 카카오톡 공유 버튼 클릭
   - 또는 `?mode=customer&qr_id=xxx` URL 직접 배포

### 고객 작업 흐름

1. **신청서 작성**
   - 동/호수 입력
   - 연락처 입력
   - 현재 통신사 선택
   - 공사 희망일 선택
   - 상세 요청사항 입력 (선택)

2. **개인정보 동의 체크**

3. **신청서 제출**
   - 자동으로 관리자에게 알림 발송
   - 신청 번호 생성 및 표시

## 🔧 커스터마이징

### 아파트 ID 변경
각 아파트별로 고유 ID 설정 (script.js:5)
```javascript
const APARTMENT_ID = 'speed_apartment21';
```

### 제목 수정
관리자 모드에서 제목 클릭하여 직접 수정 가능

### 통신사 옵션 변경
index.html의 select 옵션 수정
```html
<option value="kt">KT</option>
<option value="skt">SKT</option>
<option value="lgu">LGU+</option>
```

## 🐛 디버깅

### 모바일 디버그 모드
```
http://localhost:8000/?debug=true
또는
http://localhost:8000/#eruda
```

Eruda 개발자 도구가 활성화되어 모바일에서 콘솔 확인 가능

### 일반적인 문제 해결

**Supabase 연결 실패**
- API 키 확인
- 테이블 생성 여부 확인
- 브라우저 콘솔에서 연결 테스트 결과 확인

**EmailJS 전송 실패**
- 사용자 ID 확인
- 템플릿 ID 확인
- 네트워크 연결 확인

**카카오톡 공유 안됨**
- 앱키 설정 확인
- 도메인 등록 여부 확인

**QR별 아파트 이름이 이메일에 올바르게 전송되지 않음**
- **증상**: 모든 QR 코드에서 동일한 아파트 이름이 이메일로 전송됨
- **원인**: localStorage 전역 저장소 특성 또는 currentApartmentName 덮어쓰기
- **해결**:
  1. 브라우저 강력 새로고침 (`Ctrl+Shift+R` 또는 `Cmd+Shift+R`)
  2. 캐시 버전 확인 (현재 v=8 필요)
  3. 콘솔에서 `✅ 고객 모드: currentApartmentName 설정 완료` 메시지 확인
  4. Supabase qr_codes 테이블에 각 QR의 apartment_name이 올바르게 저장되었는지 확인

## 🔒 보안 고려사항

- Supabase RLS(Row Level Security) 정책 설정 권장
- 프로덕션 환경에서는 API 키 환경변수 관리
- 고객 모드에서 관리자 API 호출 차단
- HTTPS 사용 필수

## 📊 데이터베이스 스키마

### admin_settings
- `id`: 아파트 고유 ID (PRIMARY KEY)
- `apartment_id`: 아파트 식별자 (UNIQUE)
- `title`: 페이지 제목
- `phones`: 관리자 전화번호 배열
- `emails`: 관리자 이메일 배열
- `apartment_name`: 아파트 이름
- `entry_issue`: 진입 테마
- `agency_name`: 영업KC 이름

### applications
- `id`: 신청서 ID (AUTO INCREMENT)
- `application_number`: 신청 번호 (UNIQUE)
- `name`: 신청자 동/호수
- `phone`: 연락처
- `work_type`: 통신사 코드
- `start_date`: 공사 희망일
- `description`: 상세 요청사항

### notification_logs
- `id`: 로그 ID
- `application_id`: 신청서 참조
- `notification_type`: 'email' 또는 'sms'
- `recipient`: 수신자
- `status`: 'pending', 'sent', 'failed'

### qr_codes
- `id`: QR 코드 고유 ID (예: speed_apartment21_abc123)
- `apartment_id`: 아파트 식별자
- `qr_name`: QR 담당자 이름
- `qr_url`: QR URL (?mode=customer&qr_id=xxx)
- `apartment_name`: 아파트 이름 (QR별 고유)
- `entry_issue`: 진입 테마
- `agency_name`: 영업KC 이름
- `emails`: 알림 이메일 배열 (최대 3개)
- `phones`: 알림 전화번호 배열 (최대 3개)
- `is_active`: 활성화 상태
- `scan_count`: 스캔 횟수
- `created_at`: 생성일시

## 🚀 배포

### GitHub Pages
```bash
# gh-pages 브랜치로 배포
git checkout -b gh-pages
git push origin gh-pages
```

### Netlify/Vercel
- 루트 디렉토리 업로드
- 빌드 과정 불필요 (정적 파일)

## 📝 라이선스

이 프로젝트는 개인 및 상업적 용도로 자유롭게 사용 가능합니다.

## 🙋 문의 및 지원

이슈 등록 또는 개발자에게 직접 문의하세요.

## 🎯 QR 코드 시스템

### QR 생성 흐름

1. **관리자가 QR 생성**
   ```
   담당자 이름 입력 → 6자리 짧은 코드 생성 (예: abc123)
   → Supabase qr_codes 테이블에 저장
   → QR URL: ?mode=customer&qr_id=abc123
   ```

2. **QR 데이터 구조**
   - **ID**: `speed_apartment21_abc123` (전체 ID, DB 저장용)
   - **URL**: `?mode=customer&qr_id=abc123` (짧은 코드만 사용)
   - **아파트 정보**: 각 QR마다 고유한 apartment_name, emails, phones 저장

3. **고객이 QR 스캔**
   ```
   QR 스캔 → URL 파라미터 추출 (qr_id=abc123)
   → Supabase에서 해당 QR 데이터 조회
   → currentApartmentName 변수에 저장
   → 신청서 제출 시 해당 QR의 아파트 이름 사용
   ```

### 중요 사항

- ✅ **QR URL은 고정**: 생성 후 변경되지 않음
- ✅ **데이터는 동적**: Supabase에서 실시간 조회
- ✅ **QR별 격리**: 각 QR 코드마다 독립적인 아파트 정보
- ✅ **즉시 반영**: 관리자가 QR 설정 수정 시 즉시 반영

### 작동 예시

```javascript
// QR A 스캔
URL: ?mode=customer&qr_id=abc123
→ Supabase: SELECT * FROM qr_codes WHERE id='speed_apartment21_abc123'
→ apartment_name: "강남아파트"
→ 이메일 제목: [강남아파트] 새 통신환경개선 신청서

// QR B 스캔
URL: ?mode=customer&qr_id=xyz789
→ Supabase: SELECT * FROM qr_codes WHERE id='speed_apartment21_xyz789'
→ apartment_name: "서초아파트"
→ 이메일 제목: [서초아파트] 새 통신환경개선 신청서
```

---

## 📅 버전 히스토리

### v8.0 (2025-10-19) - 현재 버전 ⭐
**주요 업데이트: QR별 아파트 이름 이메일 전송 완벽 수정**

#### 해결한 문제
- ❌ **문제**: 모든 QR 코드에서 동일한 아파트 이름이 이메일로 전송됨
- ✅ **원인**: localStorage 전역 저장소 특성, currentApartmentName 덮어쓰기
- ✅ **해결**: 고객 모드 전용 QR 데이터 조회 로직 추가

#### 변경 사항
1. **script.js (Line 1901-1931)**: 고객 모드 전용 QR 데이터 조회
   - Supabase에서 qr_codes 직접 조회
   - currentApartmentName 변수에 저장 (localStorage 사용 안 함)
   - 각 QR의 apartment_name, emails, phones 실시간 로드

2. **script.js (Line 244-254, 283-292)**: loadAdminSettings 보호
   - 고객 모드에서 currentApartmentName 덮어쓰기 방지
   - 관리자 모드에서만 admin_settings의 아파트명 사용

3. **index.html**: 캐시 버스팅 v7 → v8
   - 브라우저 캐시 강제 새로고침
   - style.css, supabase-config.js, script.js 모두 업데이트

#### 테스트 완료
- ✅ 각 QR 스캔 시 해당 QR의 고유한 아파트 이름이 이메일에 전송
- ✅ 관리자가 QR 설정 수정 시 즉시 반영
- ✅ localStorage 문제 해결
- ✅ 브라우저 캐시 문제 해결

---

### v7.0 (2025-10-12) - 이전 버전
- ✨ 신규 영업 KC 등록 버튼 추가
- 🔧 전체 설정 초기화 기능
- 🎨 UI 개선 (QR 카드 정리)
- 🔄 캐시 버스팅 v7 업데이트

---

## 📚 추가 문서

- [CLAUDE.md](./CLAUDE.md) - 상세 기술 문서 및 아키텍처
- [개발_작업_상세_내역.md](./개발_작업_상세_내역.md) - 개발 작업 상세 기록
- [apartment_name_수정.md](./apartment_name_수정.md) - 아파트명 수정 기록
- [이미지추가.md](./이미지추가.md) - 이미지 추가 기록
