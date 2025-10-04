# Speed 아파트 통신 환경 개선 신청서 홈페이지 작성

웹 기반 아파트 통신 환경 개선 신청서 시스템입니다. Supabase 데이터베이스, EmailJS 알림, QR 코드 생성, 카카오톡 공유 기능을 제공합니다.

**GitHub 저장소:** https://github.com/Leebyeongsu/speed_apartmant21

## 🚀 주요 기능

### 관리자 모드 (기본)
- 📧 **이메일/전화번호 관리**: 최대 3개까지 등록 가능
- 🏢 **아파트 정보 설정**: 아파트명, 진입테마, 영업KC 이름
- 📱 **QR 코드 생성**: PNG/JPG 다운로드 지원
- 💬 **카카오톡 공유**: 소셜 미디어 배포
- 📊 **신청서 관리**: Supabase 실시간 데이터 저장

### 고객 모드 (`?mode=customer`)
- ✍️ **간단한 신청서 작성**: 관리 기능 숨김 처리
- 📱 **모바일 최적화**: 반응형 디자인
- 🔔 **자동 알림**: 제출 시 관리자에게 이메일/SMS 발송

## 📋 시스템 요구사항

- 웹 브라우저 (Chrome, Safari, Firefox 등)
- 인터넷 연결
- Supabase 계정 (데이터베이스)
- EmailJS 계정 (이메일 알림)
- 카카오 개발자 계정 (선택사항, 공유 기능용)

## 🛠️ 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd speed-apartment-이것으로 계속 영업자 생성
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
speed-apartment-이것으로 계속 영업자 생성/
├── index.html              # 메인 웹 페이지
├── script.js               # 핵심 JavaScript 로직 (2197줄)
├── style.css               # 반응형 스타일시트
├── supabase-config.js      # Supabase 클라이언트 설정
├── CLAUDE.md               # 개발 문서
├── README.md               # 프로젝트 안내서
├── apartment_ehwa.jpg      # 아파트 이미지
├── promotion-flyer.jpg     # 프로모션 이미지
└── char.jpg                # 캐릭터 이미지
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

3. **고객 링크 공유**
   - 카카오톡 공유 버튼 클릭
   - 또는 `?mode=customer` URL 직접 배포

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
const APARTMENT_ID = 'speed_apartment5';
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

## 📚 추가 문서

- [CLAUDE.md](./CLAUDE.md) - 상세 기술 문서 및 아키텍처
- [apartment_name_수정.md](./apartment_name_수정.md) - 아파트명 수정 기록
- [이미지추가.md](./이미지추가.md) - 이미지 추가 기록
