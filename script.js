// Supabase 설정은 supabase-config.js에서 전역 변수로 제공됨

// 아파트 ID 설정 (고유 식별자) - 배포할 리포지토리/프로젝트에 맞게 변경
// 변경: speed_apartment21 (원격 리포지토리 및 Supabase 설정과 일치)
const APARTMENT_ID = 'speed_apartment21';

// 현재 QR ID 저장 (고객 모드에서 URL 파라미터로부터 추출)
let currentQrId = null;

// 카카오 SDK 초기화 (실제 앱키로 변경 필요)
try {
    if (typeof Kakao !== 'undefined' && Kakao && !Kakao.isInitialized()) {
        Kakao.init('YOUR_KAKAO_APP_KEY'); // 실제 카카오 개발자센터에서 발급받은 JavaScript 키로 변경하세요
    }
} catch (e) {
    console.warn('Kakao 초기화 건너뜀:', e && e.message ? e.message : e);
}

// EmailJS 초기화 상태
let emailJSInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// EmailJS 초기화 함수 (모바일 환경 강화)
async function initializeEmailJS() {
    return new Promise((resolve, reject) => {
        // 이미 초기화되었다면 바로 성공 반환
        if (emailJSInitialized && typeof emailjs !== 'undefined') {
            resolve(true);
            return;
        }

        // 최대 시도 횟수 체크
        if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
            reject(new Error('EmailJS 초기화 최대 시도 횟수 초과'));
            return;
        }

        initializationAttempts++;

        const initializeWithRetry = () => {
            try {
                // EmailJS 스크립트 로드 확인
                if (typeof emailjs === 'undefined') {
                    const waitTime = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 3000 : 1500;
                    console.log(`📱 EmailJS 스크립트 로딩 대기... (시도: ${initializationAttempts}/${MAX_INIT_ATTEMPTS}, 대기: ${waitTime}ms)`);
                    
                    setTimeout(() => {
                        if (initializationAttempts < MAX_INIT_ATTEMPTS) {
                            initializeWithRetry();
                        } else {
                            reject(new Error('EmailJS 스크립트 로드 시간 초과'));
                        }
                    }, waitTime);
                    return;
                }

                // EmailJS 초기화 시도
                console.log('🔧 EmailJS 초기화 시작...');
                emailjs.init('8-CeAZsTwQwNl4yE2');
                
                // 초기화 검증
                if (typeof emailjs.send === 'function') {
                    console.log('✅ EmailJS 초기화 및 검증 완료');
                    emailJSInitialized = true;
                    resolve(true);
                } else {
                    throw new Error('EmailJS send 함수를 찾을 수 없습니다');
                }
            } catch (e) {
                console.error(`❌ EmailJS 초기화 실패 (시도 ${initializationAttempts}):`, e);
                if (initializationAttempts < MAX_INIT_ATTEMPTS) {
                    const retryWaitTime = 2000;
                    setTimeout(initializeWithRetry, retryWaitTime);
                } else {
                    reject(e);
                }
            }
        };

        // 네트워크 상태 확인
        if (!navigator.onLine) {
            reject(new Error('네트워크 연결이 필요합니다.'));
            return;
        }

        // 초기화 시작
        initializeWithRetry();
    });
}

// 페이지 로드시 초기화 시도
window.addEventListener('load', () => {
    initializeEmailJS().catch(error => {
        console.warn('EmailJS 초기화 실패:', error.message);
    });
});

// 온라인 상태가 되면 재시도
window.addEventListener('online', () => {
    if (!emailJSInitialized) {
        initializeEmailJS().catch(error => {
            console.warn('EmailJS 재초기화 실패:', error.message);
        });
    }
});

let formData = {};
let currentQRDataURL = null;
let adminSettings = null; // 관리자 설정 캐시
let currentApartmentName = 'Speed 아파트'; // 아파트명 캐시 (기본값)

// 안전한 logEmailAttempt 전역 래퍼 (notification-service 모듈이 로드되지 않은 환경 방어)
if (typeof window !== 'undefined' && typeof window.logEmailAttempt !== 'function') {
    window.logEmailAttempt = async function(applicationId, provider, status, error = null) {
        try {
            // Supabase가 있으면 저장 시도
            if (typeof supabase !== 'undefined' && supabase) {
                try {
                    await supabase.from('notification_logs').insert([{
                        application_id: applicationId,
                        provider: provider,
                        status: status,
                        error: error,
                        timestamp: new Date().toISOString()
                    }]);
                    console.log('logEmailAttempt: Supabase에 로그 저장 완료');
                    return true;
                } catch (e) {
                    console.warn('logEmailAttempt: Supabase 저장 실패(무시):', e);
                }
            }

            // 최후의 수단: 콘솔에 로그 출력
            console.log('logEmailAttempt(Fallback):', { applicationId, provider, status, error, timestamp: new Date().toISOString() });
            return true;
        } catch (e) {
            console.warn('logEmailAttempt 예외(무시):', e);
            return false;
        }
    };
}

// 관리자 설정 저장 (Supabase)
async function saveAdminSettingsToCloud() {
    try {
        if (!supabase) {
            console.warn('Supabase가 초기화되지 않았습니다.');
            return;
        }

        const settings = {
            id: APARTMENT_ID,  // id도 speed_apartment21로 설정
            apartment_id: APARTMENT_ID,  // speed_apartment21 사용
            title: localStorage.getItem('mainTitle') || '',
            phones: JSON.parse(localStorage.getItem('savedPhoneNumbers') || '[]'),
            emails: JSON.parse(localStorage.getItem('savedEmailAddresses') || '[]'),
            apartment_name: localStorage.getItem('apartmentName') || '',
            entry_issue: localStorage.getItem('entryIssue') || '',
            agency_name: localStorage.getItem('agencyName') || '',
            updated_at: new Date().toISOString()
        };

        // 현재 apartment_id로 기존 데이터 확인
        const { data: existingData, error: checkError } = await supabase
            .from('admin_settings')
            .select('*')
            .eq('apartment_id', APARTMENT_ID)
            .single();

        if (checkError && checkError.code === 'PGRST116') {
            // 데이터가 없으면 새로 삽입
            console.log('🆕 speed_apartment21 데이터 새로 생성 중...');
            const { data, error } = await supabase
                .from('admin_settings')
                .insert(settings);

            if (error) {
                console.error('❌ speed_apartment21 데이터 생성 실패:', error);
                return;
            }

            console.log('✅ speed_apartment21 데이터가 성공적으로 생성되었습니다!', settings);
        } else if (!checkError) {
            // 데이터가 이미 있으면 업데이트
            console.log('🔄 기존 speed_apartment21 데이터 업데이트 중...');
            const { data, error } = await supabase
                .from('admin_settings')
                .update({
                    title: settings.title,
                    phones: settings.phones,
                    emails: settings.emails,
                    apartment_name: settings.apartment_name,
                    entry_issue: settings.entry_issue,
                    agency_name: settings.agency_name,
                    updated_at: settings.updated_at
                })
                .eq('apartment_id', APARTMENT_ID);

            if (error) {
                console.error('❌ speed_apartment21 데이터 업데이트 실패:', error);
                return;
            }

            console.log('✅ speed_apartment21 데이터가 성공적으로 업데이트되었습니다!', settings);
        } else {
            console.error('❌ 데이터 확인 중 오류:', checkError);
            return;
        }

        adminSettings = settings;
    } catch (error) {
        console.error('관리자 설정 저장 중 오류:', error);
    }
}

// 관리자 설정 로드 (Supabase)
async function loadAdminSettingsFromCloud() {
    try {
        if (!supabase) {
            console.warn('Supabase가 초기화되지 않았습니다. 로컬 설정을 사용합니다.');
            loadAdminSettingsLocal();
            return;
        }

        const { data, error } = await supabase
            .from('admin_settings')
            .select('*')
            .eq('apartment_id', APARTMENT_ID)  // speed_apartment21 조건으로 검색
            .single();
        
        if (error && error.code !== 'PGRST116') { // 데이터가 없는 경우가 아닌 실제 오류
            console.error('Supabase 로드 오류:', error);
            loadAdminSettingsLocal(); // 실패시 로컬 로드
            return;
        }
        
        if (data) {
            // Supabase에서 가져온 데이터를 localStorage에 동기화
            if (data.title) localStorage.setItem('mainTitle', data.title);
            if (data.phones) localStorage.setItem('savedPhoneNumbers', JSON.stringify(data.phones));
            if (data.emails) localStorage.setItem('savedEmailAddresses', JSON.stringify(data.emails));

            // 아파트명 캐시 업데이트 (고객 모드에서는 QR별 아파트명을 유지)
            const urlParams = new URLSearchParams(window.location.search);
            const isCustomerMode = urlParams.has('customer') || urlParams.has('apply') || urlParams.get('mode') === 'customer';
            
            if (!isCustomerMode) {
                // 관리자 모드에서만 admin_settings의 아파트명 사용
                currentApartmentName = data.apartment_name || 'Speed 아파트';
                console.log('현재 아파트명 (관리자):', currentApartmentName);
            } else {
                console.log('고객 모드: currentApartmentName 유지 (QR별 설정):', currentApartmentName);
            }

            adminSettings = data;
            console.log('Supabase에서 관리자 설정을 로드했습니다.');
        } else {
            console.log('Supabase에 저장된 관리자 설정이 없습니다. 로컬 설정을 사용합니다.');
            loadAdminSettingsLocal();
        }
        
        // 화면 업데이트
        loadSavedTitles();
        displaySavedInputs();
    } catch (error) {
        console.error('관리자 설정 로드 중 오류:', error);
        loadAdminSettingsLocal(); // 실패시 로컬 로드
    }
}

// 로컬 관리자 설정 로드 (백업용)
function loadAdminSettingsLocal() {
    try {
        const settings = {
            apartment_id: APARTMENT_ID,
            title: localStorage.getItem('mainTitle') || '',
            phones: JSON.parse(localStorage.getItem('savedPhoneNumbers') || '[]'),
            emails: JSON.parse(localStorage.getItem('savedEmailAddresses') || '[]'),
            apartment_name: 'Speed 아파트' // 로컬 백업 시 기본값
        };

        // 아파트명 캐시 업데이트 (고객 모드에서는 QR별 아파트명을 유지)
        const urlParams = new URLSearchParams(window.location.search);
        const isCustomerMode = urlParams.has('customer') || urlParams.has('apply') || urlParams.get('mode') === 'customer';
        
        if (!isCustomerMode) {
            currentApartmentName = settings.apartment_name;
            console.log('현재 아파트명 (로컬):', currentApartmentName);
        } else {
            console.log('고객 모드: currentApartmentName 유지 (QR별 설정):', currentApartmentName);
        }

        adminSettings = settings;
        console.log('로컬에서 관리자 설정을 로드했습니다.');
        
        // 화면 업데이트
        loadSavedTitles();
        displaySavedInputs();
    } catch (error) {
        console.error('로컬 관리자 설정 로드 중 오류:', error);
    }
}

// 로컬 저장 백업 (Supabase 실패 시)
async function saveApplicationLocally(applicationData) {
    try {
        // 신청번호 생성
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const applicationNumber = `LOCAL-${dateStr}-${randomNum}`;

        // 통신사 이름 변환
        const providerNames = {
            'interior': 'KT',
            'exterior': 'SKT', 
            'plumbing': 'LGU+',
            'electrical': '기타(지역방송)'
        };

        const localApplication = {
            id: applicationNumber, // 로컬 ID로 사용
            name: applicationData.name, // 동/호수 정보
            phone: applicationData.phone,
            workType: applicationData.workType, // Supabase 컬럼명과 일치
            work_type_display: providerNames[applicationData.workType] || applicationData.workType,
            startDate: applicationData.startDate || null,
            description: applicationData.description || null,
            privacy: true, // 개인정보 동의
            submitted_at: applicationData.submittedAt,
            status: 'local_backup' // 로컬 백업 표시
        };

        // localStorage에 저장
        const existingApplications = JSON.parse(localStorage.getItem('localApplications') || '[]');
        existingApplications.push(localApplication);
        localStorage.setItem('localApplications', JSON.stringify(existingApplications));

        console.log('신청서를 로컬에 백업했습니다:', localApplication);

        // 로컬 알림 처리 + 실제 이메일 발송 시도
        await handleLocalNotification(localApplication);
        
        // 로컬 백업이어도 실제 이메일 발송 시도 (Edge Function은 application.id가 필요해서 EmailJS 사용)
        const emailResult = await sendEmailToAdmins(localApplication);
        if (emailResult) {
            console.log('로컬 백업에서 이메일 발송 성공');
            localApplication.email_sent = true;
        }

        return localApplication;
    } catch (error) {
        console.error('로컬 저장 중 오류:', error);
        return false;
    }
}

// 로컬 알림 처리 (이메일 주소를 콘솔에 출력)
async function handleLocalNotification(applicationData) {
    try {
        const savedEmails = JSON.parse(localStorage.getItem('savedEmailAddresses') || '[]');
        const savedPhones = JSON.parse(localStorage.getItem('savedPhoneNumbers') || '[]');

        const submittedDate = new Date(applicationData.submitted_at);
        const formattedDate = submittedDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const notificationMessage = `
[Speed 아파트] 새로운 통신환경개선 신청서 (로컬 백업)

■ 신청번호: ${applicationData.id}
■ 신청자: ${applicationData.name}
■ 연락처: ${applicationData.phone}
■ 동/호수: ${applicationData.name}
■ 현재 통신사: ${applicationData.work_type_display}
■ 희망일: ${applicationData.startDate || '미지정'}
■ 상세내용: ${applicationData.description || '없음'}
■ 접수일시: ${formattedDate}

⚠️ 네트워크 오류로 로컬에 저장되었습니다.

📞 긴급 연락처: ${savedPhones.length > 0 ? savedPhones[0] : '관리자 연락처 미설정'}
📧 관리자 이메일: ${savedEmails.length > 0 ? savedEmails[0] : '관리자 이메일 미설정'}

💡 해결방법:
1. 네트워크 연결을 확인해주세요
2. WiFi 또는 데이터 연결 상태를 점검해주세요
3. 위 연락처로 직접 연락주시면 신속히 처리해드립니다
        `;

        console.log('=== 관리자 알림 ===');
        console.log(notificationMessage);

        if (savedEmails.length > 0) {
            console.log('알림받을 이메일 주소:', savedEmails.join(', '));
        }
        if (savedPhones.length > 0) {
            console.log('알림받을 전화번호:', savedPhones.join(', '));
        }

        return true;
    } catch (error) {
        console.error('로컬 알림 처리 중 오류:', error);
        return false;
    }
}

// 신청서를 Supabase에 저장하고 관리자에게 알림 발송
async function saveApplicationToSupabase(applicationData) {
    try {
        console.log('Supabase 연결 상태 확인:', supabase);
        
        if (!supabase) {
            console.warn('Supabase가 초기화되지 않았습니다. 로컬 저장으로 대체합니다.');
            return await saveApplicationLocally(applicationData);
        }

    // 신청번호 생성 (현재 날짜 + 랜덤 4자리)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const applicationNumber = `APP-${dateStr}-${randomNum}`;

        // 통신사 이름 변환
        const providerNames = {
            'interior': 'KT',
            'exterior': 'SKT', 
            'plumbing': 'LGU+',
            'electrical': '기타(지역방송)'
        };

        // 안전한 방식: 클라이언트 필드명을 DB 컬럼명으로 매핑하는 헬퍼 사용
        function mapToDbRecord(app) {
            // 최소 매핑 규칙: camelCase -> snake_case와 일부 이름 일치 처리
            const map = {
                name: 'name',
                phone: 'phone',
                address: 'address',
                workType: 'work_type',
                work_type_display: 'work_type_display',
                budget: 'budget',
                budget_display: 'budget_display',
                startDate: 'start_date',
                description: 'description',
                submittedAt: 'submitted_at',
                submitted_at: 'submitted_at',
                application_number: 'application_number',
                privacy: 'privacy',
                qr_id: 'qr_id'  // QR ID 매핑 추가
            };

            const out = {};
            Object.keys(app).forEach(k => {
                const dbKey = map[k] || k.replace(/([A-Z])/g, '_$1').toLowerCase();
                out[dbKey] = app[k];
            });

            // 보장된 필드
            if (!out.application_number) out.application_number = applicationNumber;
            if (!out.submitted_at && app.submittedAt) out.submitted_at = app.submittedAt;

            return out;
        }

        const applicationRecord = mapToDbRecord(applicationData);

        // QR ID 추가 (고객이 QR 코드를 통해 접속한 경우)
        if (currentQrId) {
            applicationRecord.qr_id = currentQrId;
            console.log('📱 신청서에 QR ID 포함:', currentQrId);
        }

        // privacy는 항상 true로 표시
        applicationRecord.privacy = true;

        console.log('🔍 Supabase에 신청서 저장 시도 - 상세 정보:', {
            timestamp: new Date().toISOString(),
            data: applicationRecord,
            keys: Object.keys(applicationRecord),
            values: Object.values(applicationRecord)
        });

        // applications 테이블에 신청서 저장
        const { data: insertedApplication, error: insertError } = await supabase
            .from('applications')
            .insert([applicationRecord])
            .select()
            .single();

        if (insertError) {
            console.error('💥 Supabase 신청서 저장 오류 - 상세 정보:', {
                error: insertError,
                code: insertError.code,
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                sentData: applicationRecord
            });
            console.log('📦 로컬 저장으로 대체합니다.');
            return await saveApplicationLocally(applicationData);
        }

        console.log('신청서가 Supabase에 저장되었습니다:', insertedApplication);

        // Supabase Edge Function으로 관리자에게 이메일 발송
        const emailResult = await sendNotificationsViaEdgeFunction(insertedApplication);
        insertedApplication.email_sent = emailResult;

        return insertedApplication;

    } catch (error) {
        console.error('신청서 저장 중 오류:', error);
        console.log('로컬 저장으로 대체합니다.');
        return await saveApplicationLocally(applicationData);
    }
}

// 이메일 발송 로그 관리
async function logEmailAttempt(applicationId, provider, status, error = null) {
    try {
        console.log(`📋 이메일 발송 로그:`, {
            applicationId,
            provider,
            status,
            error,
            timestamp: new Date().toISOString()
        });
        
        // Supabase 로그 저장 (선택사항)
        if (supabase) {
            await supabase.from('notification_logs').insert([{
                application_id: applicationId,
                provider: provider,
                status: status,
                error: error,
                timestamp: new Date().toISOString()
            }]);
        }
    } catch (err) {
        console.warn('로그 저장 실패:', err);
    }
}

// SendGrid 백업 발송 함수 (임시 구현)
async function sendViaSendGrid(applicationData) {
    try {
        console.log('📨 SendGrid 백업 발송 시도 (현재 미구현)');
        console.log('📧 대신 로컬 백업으로 처리합니다.');
        
        // 실제 SendGrid 구현이 없으므로 로컬 백업 방식 사용
        return {
            success: false,
            message: 'SendGrid 미구현 - 로컬 백업 사용'
        };
    } catch (error) {
        console.error('SendGrid 백업 발송 실패:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 관리자에게 실제 이메일 발송 (강화된 오류 처리)
async function sendEmailToAdmins(applicationData) {
    try {
        console.log('📧 이메일 발송 시도 - 상세 정보:', {
            timestamp: new Date().toISOString(),
            applicationId: applicationData.id || 'ID 없음',
            deviceType: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            emailJSState: {
                available: typeof emailjs !== 'undefined',
                initialized: emailJSInitialized,
                sendFunction: typeof emailjs?.send === 'function'
            }
        });
        

    // 저장된 관리자 이메일 주소 가져오기
    const savedEmailsRaw = JSON.parse(localStorage.getItem('savedEmailAddresses') || '[]');
    // 중복 제거, 공백 제거, 최대 3개 제한
    const savedEmails = Array.from(new Set((savedEmailsRaw || []).map(e => (e || '').toString().trim()))).filter(Boolean).slice(0, 3);
    console.log('DEBUG sendEmailToAdmins - savedEmailsRaw:', savedEmailsRaw, '=> filtered:', savedEmails);

        if (savedEmails.length === 0) {
            console.warn('⚠️ 저장된 관리자 이메일 주소가 없습니다.');
            return false;
        }

        // EmailJS 완전성 검사
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS 라이브러리가 로드되지 않았습니다.');
            throw new Error('EmailJS 라이브러리 로드 실패');
        }

        if (typeof emailjs.send !== 'function') {
            console.error('❌ EmailJS send 함수를 사용할 수 없습니다.');
            throw new Error('EmailJS send 함수 사용 불가');
        }

        if (!emailJSInitialized) {
            console.warn('⚠️ EmailJS가 초기화되지 않았습니다. 재초기화 시도...');
            try {
                await initializeEmailJS();
            } catch (initError) {
                console.error('❌ EmailJS 재초기화 실패:', initError);
                throw new Error('EmailJS 초기화 실패: ' + initError.message);
            }
        }

        // 제출일시 포맷팅
        const submittedDate = new Date(applicationData.submitted_at);
        const formattedDate = submittedDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'long'
        });

        let emailsSent = 0;

        // 각 관리자 이메일로 EmailJS 발송
        console.log('📧 EmailJS로 관리자에게 이메일 발송을 시도합니다.');
        
        // 브라우저 알림 권한 요청 (모바일에서 Notification 생성이 에러를 던지는 브라우저가 있어 방어적으로 래핑)
        try {
            if (typeof window !== 'undefined' && 'Notification' in window && typeof Notification === 'function') {
                if (Notification.permission === 'default') {
                    try {
                        await Notification.requestPermission();
                    } catch (permErr) {
                        console.warn('Notification 권한 요청 중 오류:', permErr);
                    }
                }

                if (Notification.permission === 'granted') {
                    try {
                        new Notification('🏢 새로운 신청서 접수', {
                            body: `신청자: ${applicationData.name}\n연락처: ${applicationData.phone}\n동/호수: ${applicationData.name}`,
                            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIwIDRIM0MxLjg5IDQgMS4wMSA0Ljg5IDEuMDEgNkwxIDE4QzEgMTkuMTEgMS44OSAyMCAzIDIwSDIwQzIxLjExIDIwIDIyIDE5LjExIDIyIDE4VjZDMjIgNC44OSAyMS4xMSA0IDIwIDRaTTIwIDhMMTEuNSAxMy41TDMgOFY2TDExLjUgMTEuNUwyMCA2VjhaIiBmaWxsPSIjNENBRjUwIi8+Cjwvc3ZnPgo='
                        });
                    } catch (notificationErr) {
                        // 일부 모바일 브라우저(특히 Eruda 내장 환경)에서 Illegal constructor 오류 발생 -> 무시
                        console.warn('Notification 생성 불가(무시):', notificationErr && notificationErr.message ? notificationErr.message : notificationErr);
                    }
                }
            }
        } catch (e) {
            console.warn('Notification 처리 중 예외 발생(무시):', e && e.message ? e.message : e);
        }

        // 실제 EmailJS로 이메일 발송
        for (const adminEmail of savedEmails) {
            try {
                console.log(`📧 ${adminEmail}로 EmailJS 이메일 발송 시도...`);

                // EmailJS 템플릿 파라미터 (이메일 전용: 신청번호을 YYYYMMDDHHmm으로 전달하고, 제출일시 라벨을 접수일시로 제공)
                const _submittedIso = applicationData.submittedAt || applicationData.submitted_at || new Date().toISOString();
                const _submittedDate = new Date(_submittedIso);
                const _formattedDate = _submittedDate.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    weekday: 'long'
                });

                // YYYYMMDDHHmm 형식으로 신청번호 생성 (이메일용)
                const pad2 = (n) => n.toString().padStart(2, '0');
                const y = _submittedDate.getFullYear();
                const m = pad2(_submittedDate.getMonth() + 1);
                const d = pad2(_submittedDate.getDate());
                const hh = pad2(_submittedDate.getHours());
                const min = pad2(_submittedDate.getMinutes());
                const emailAppNumber = applicationData.application_number || `${y}${m}${d}${hh}${min}`;

                // work_type_display가 없을 경우 안전한 폴백을 계산
                const providerNamesFallback_local = {
                    'interior': 'KT',
                    'exterior': 'SKT', 
                    'plumbing': 'LGU+',
                    'electrical': '기타(지역방송)'
                };
                const resolvedWorkTypeDisplay_local = applicationData.work_type_display || providerNamesFallback_local[applicationData.workType] || applicationData.workType || '미상';

                const templateParams = {
                    to_email: adminEmail,
                    apartment_name: currentApartmentName || 'Speed 아파트',
                    application_number: emailAppNumber,
                    name: applicationData.name,
                    phone: applicationData.phone,
                    // 템플릿에서는 {{work_type_display}}를 사용하므로 이 키로 항상 전송
                    work_type_display: resolvedWorkTypeDisplay_local,
                    start_date: applicationData.startDate || '미지정',
                    description: applicationData.description || '특별한 요청사항 없음',
                    // 템플릿에서 어느 키를 사용하는지 다를 수 있어 안전하게 둘 다 보냄
                    submittedAt: _formattedDate,
                    submitted_at: _formattedDate,
                    // 템플릿에서 라벨을 변수로 받아 사용한다면 이 값을 사용하도록 함(없어도 무해)
                    submission_label: '접수일시:'
                };

                // EmailJS로 이메일 발송 (강화된 오류 처리)
                console.log('📤 EmailJS 발송 파라미터:', templateParams);
                
                const response = await Promise.race([
                    emailjs.send('service_v90gm26', 'template_pxi385c', templateParams),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('EmailJS 발송 시간 초과 (30초)')), 30000)
                    )
                ]);

                console.log(`✅ ${adminEmail}로 이메일 발송 성공:`, response);
                emailsSent++;
                
                // 발송 성공 검증
                if (response.status !== 200) {
                    console.warn(`⚠️ ${adminEmail} 발송 응답 상태가 비정상: ${response.status}`);
                }

            } catch (error) {
                console.error(`❌ ${adminEmail}로 이메일 발송 실패:`, error);
                console.error('📋 실패한 이메일 파라미터:', templateParams);
                console.error('🔍 오류 상세정보:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    cause: error.cause
                });
                
                // 모바일 디버그 환경에서 오류 표시
                if (typeof window.logError === 'function') {
                    window.logError(new Error(`EmailJS 발송 실패 (${adminEmail}): ${error.message}`));
                }
            }

            // 다음 이메일 발송 전 잠시 대기 (스팸 방지)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`총 ${emailsSent}개의 이메일이 성공적으로 발송되었습니다.`);
        return emailsSent > 0;

    } catch (error) {
        console.error('💥 이메일 발송 중 전체 오류:', error);
        
        // 모바일 환경에서 친절한 오류 안내
        if (/Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            console.log(`
📱 모바일 환경에서 메일 발송 실패 안내:

🔧 해결 방법:
1. WiFi 또는 데이터 연결 상태 확인
2. 브라우저 새로고침 후 재시도  
3. 다른 브라우저(Chrome, Safari)에서 시도
4. 관리자에게 직접 연락

⚠️ 신청서는 로컬에 안전하게 저장되었습니다.
            `);
        }
        
        return false;
    }
}

// EmailJS를 통한 이메일 발송 (주 시스템)
async function sendNotificationsViaEdgeFunction(applicationData) {
    try {
        console.log('📱 메일 발송 시작 - 디버그 정보:', {
            deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
            },
            networkState: {
                isOnline: navigator.onLine,
                connection: navigator.connection ? {
                    type: navigator.connection.type,
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink
                } : 'Connection API not supported'
            },
            emailJSState: {
                initialized: emailJSInitialized,
                attempts: initializationAttempts
            }
        });

        // 네트워크 상태 확인
        if (!navigator.onLine) {
            console.error('🔴 네트워크 오프라인 상태');
            throw new Error('네트워크 연결이 필요합니다.');
        }

        // EmailJS 초기화 상태 확인 및 재시도
        if (!emailJSInitialized || typeof emailjs === 'undefined') {
            console.log('📨 EmailJS 초기화 시도 중...');
            try {
                // 모바일에서 더 오래 대기
                const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                if (isMobile) {
                    console.log('📱 모바일 환경에서 EmailJS 재초기화 시도...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                await initializeEmailJS();
                console.log('✅ EmailJS 초기화 성공');
            } catch (initError) {
                console.error('❌ EmailJS 초기화 실패:', initError);
                console.warn('🚫 EmailJS 초기화 실패 — 로컬 알림으로 폴백합니다.');
                await handleLocalNotification(applicationData);
                return { success: false, error: 'EmailJS 초기화 실패 - 로컬 폴백' };
            }
        }

        if (!emailjs) {
            console.warn('🚫 EmailJS 사용 불가 — 로컬 알림으로 폴백합니다.');
            await handleLocalNotification(applicationData);
            return { success: false, error: 'EmailJS 라이브러리 없음 - 로컬 폴백' };
        }

        console.log('📨 이메일 발송 시작');
        console.log('📋 신청서 데이터:', applicationData);
        console.log('🔑 신청서 ID:', applicationData.id);
        
        // 모바일 환경 로깅
        console.log('📱 사용자 환경:', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            vendor: navigator.vendor,
            isMobile: /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)
        });

        // 관리자 설정 확인
        console.log('👑 현재 관리자 설정 확인...');
        const { data: adminCheck, error: adminError } = await supabase
            .from('admin_settings')
            .select('emails')
            .eq('apartment_id', APARTMENT_ID)  // speed_apartment521로 검색
            .single();

        if (adminError || !adminCheck?.emails || adminCheck.emails.length === 0) {
            console.error('❌ 관리자 이메일 설정 문제:', adminError?.message);
            throw new Error('관리자 이메일 설정을 찾을 수 없습니다.');
        }

        // 관리자 이메일 목록 정리: 중복 제거, 공백 제거, 최대 3개 제한
        const adminEmails = Array.isArray(adminCheck.emails)
            ? Array.from(new Set(adminCheck.emails.map(e => (e || '').toString().trim()))).filter(Boolean).slice(0, 3)
            : [];

    console.log('DEBUG sendNotificationsViaEdgeFunction - adminCheck.emails (raw):', adminCheck.emails, '=> filtered adminEmails:', adminEmails);

        // EmailJS로 메일 발송
        const results = await Promise.all(adminEmails.map(async (email) => {
            try {
                // 이메일용 파라미터 재구성: 신청번호를 YYYYMMDDHHmm으로 전달하고, 제출일시 라벨을 '접수일시:'로 전달
                const _iso = applicationData.submittedAt || applicationData.submitted_at || new Date().toISOString();
                const _d = new Date(_iso);
                const pad = (n) => n.toString().padStart(2, '0');
                const yy = _d.getFullYear();
                const mm = pad(_d.getMonth() + 1);
                const dd = pad(_d.getDate());
                const hh2 = pad(_d.getHours());
                const min2 = pad(_d.getMinutes());
                const emailAppNum = applicationData.application_number || `${yy}${mm}${dd}${hh2}${min2}`;
                const formattedForEmail = _d.toLocaleString('ko-KR');

                // work_type_display가 없을 경우 안전한 폴백을 계산
                const providerNamesFallback = {
                    'interior': 'KT',
                    'exterior': 'SKT',
                    'plumbing': 'LGU+',
                    'electrical': '기타(지역방송)'
                };
                const resolvedWorkTypeDisplay = applicationData.work_type_display || providerNamesFallback[applicationData.workType] || applicationData.workType || '미상';

                const result = await emailjs.send(
                    'service_v90gm26',
                    'template_pxi385c',
                    {
                        to_email: email,
                        apartment_name: currentApartmentName || 'Speed 아파트',
                        application_number: emailAppNum,
                        name: applicationData.name,
                        phone: applicationData.phone,
                        // 템플릿에서 {{work_type_display}}를 사용하므로 해당 키도 항상 전송
                        work_type_display: resolvedWorkTypeDisplay,
                        work_type: resolvedWorkTypeDisplay,
                        start_date: applicationData.startDate || '미지정',
                        description: applicationData.description || '없음',
                        submitted_at: formattedForEmail,
                        submittedAt: formattedForEmail,
                        submission_label: '접수일시:'
                    }
                );
                if (typeof logEmailAttempt === 'function') {
                    try { await logEmailAttempt(applicationData.id, 'emailjs', 'sent'); } catch(e){ console.warn('logEmailAttempt 실패(무시):', e); }
                }
                return { email, success: true, result };
            } catch (error) {
                console.error(`❌ ${email}로 EmailJS 개별 발송 실패:`, error);
                console.error('📋 실패한 이메일 파라미터:', {
                    to_email: email,
                    apartment_name: currentApartmentName || 'Speed 아파트',
                    application_number: emailAppNum,
                    name: applicationData.name,
                    phone: applicationData.phone,
                    work_type_display: resolvedWorkTypeDisplay,
                    start_date: applicationData.startDate || '미지정',
                    description: applicationData.description || '없음'
                });
                console.error('🔍 오류 상세정보:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
                
                // 모바일 디버그 환경에서 오류 표시
                if (typeof window.logError === 'function') {
                    window.logError(new Error(`EmailJS 개별 발송 실패 (${email}): ${error.message}`));
                }
                
                if (typeof logEmailAttempt === 'function') {
                    try { await logEmailAttempt(applicationData.id, 'emailjs', 'failed', error.message); } catch(e){ console.warn('logEmailAttempt 실패(무시):', e); }
                }
                return { email, success: false, error };
            }
        }));

        // 발송 결과 처리
        const successfulSends = results.filter(r => r.success).length;
        const totalAttempts = results.length;

        // 모든 이메일 발송이 실패한 경우 로컬 알림으로 폴백
        if (successfulSends === 0) {
            console.warn('⚠️ EmailJS 발송 실패. 로컬 알림으로 대체...');
            
            // 로컬 알림 처리 (SendGrid 대신)
            const localNotification = await handleLocalNotification(applicationData);
            return {
                success: localNotification,
                sent: 0,
                total: totalAttempts,
                fallback: 'local_notification'
            };
        }

        return {
            success: true,
            sent: successfulSends,
            total: totalAttempts
        };

    } catch (error) {
        console.error('💥 EmailJS 발송 중 오류:', error);
        console.warn('EmailJS 발송 오류 — 로컬 알림으로 폴백합니다.');
        await handleLocalNotification(applicationData);
        return { success: false, error: error.message };
    }
}

// 관리자에게 알림 발송 (기존 EmailJS 방식 - 백업용)
async function sendNotificationsToAdmins(applicationData) {
    try {
        // 저장된 관리자 연락처 가져오기
        const savedEmails = JSON.parse(localStorage.getItem('savedEmailAddresses') || '[]');
        const savedPhones = JSON.parse(localStorage.getItem('savedPhoneNumbers') || '[]');
        
        // 실제 이메일 발송
        const emailResult = await sendEmailToAdmins(applicationData);
        
        // Supabase 알림 로그 저장 (있는 경우)
        if (supabase && applicationData.id) {
            const submittedDate = new Date(applicationData.submitted_at);
            const formattedDate = submittedDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const emailMessage = `
[Speed 아파트] 새로운 통신환경개선 신청서

■ 신청번호: ${applicationData.id}
■ 신청자: ${applicationData.name}
■ 연락처: ${applicationData.phone}
■ 동/호수: ${applicationData.name}
■ 현재 통신사: ${applicationData.work_type_display}
■ 희망일: ${applicationData.startDate || '미지정'}
■ 상세내용: ${applicationData.description || '없음'}
■ 접수일시: ${formattedDate}

관리자님께서 확인하시고 적절한 조치를 취해주시기 바랍니다.
            `;

            const notifications = [];

            // 이메일 알림 로그 생성
            savedEmails.forEach(email => {
                notifications.push({
                    application_id: applicationData.id,
                    notification_type: 'email',
                    recipient: email,
                    message: emailMessage,
                    status: emailResult ? 'sent' : 'failed'
                });
            });

            if (notifications.length > 0) {
                const { error: notificationError } = await supabase
                    .from('notification_logs')
                    .insert(notifications);

                if (notificationError) {
                    console.error('알림 로그 저장 오류:', notificationError);
                } else {
                    console.log(`${notifications.length}개의 알림 로그가 저장되었습니다.`);
                }
            }
        }

        return emailResult;

    } catch (error) {
        console.error('알림 발송 중 오류:', error);
        return false;
    }
}

// 고객용 신청서 제출 처리 (Supabase 저장 및 알림 발송)
async function processCustomerFormSubmission(event) {
    event.preventDefault();
    console.log('📝 신청서 제출 시작 - 환경 정보:', {
        시간: new Date().toISOString(),
        브라우저: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            onLine: navigator.onLine,
            platform: navigator.platform
        },
        화면: {
            width: window.innerWidth,
            height: window.innerHeight,
            pixelRatio: window.devicePixelRatio
        },
        이메일상태: {
            EmailJS초기화: emailJSInitialized,
            시도횟수: initializationAttempts
        }
    });

    const formDataObj = new FormData(event.target);
    const applicationData = {};
    
    // 폼 데이터 수집
    for (let [key, value] of formDataObj.entries()) {
        applicationData[key] = value;
    }
    
    // 유효성 검증
    if (!applicationData.name || !applicationData.phone || !applicationData.startDate) {
        alert('필수 항목을 모두 입력해주세요.\n(공사요청, 연락처, 공사 희망일)');
        return;
    }
    
    // 공사 희망일 날짜 검증
    const selectedDate = new Date(applicationData.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 시간 정보 제거
    
    if (selectedDate < today) {
        alert('공사 희망일은 오늘 날짜 이후로 선택해주세요.');
        return;
    }
    
    if (!applicationData.privacy) {
        alert('개인정보 수집 및 이용에 동의해주세요.');
        return;
    }
    
    // 추가 정보 설정
    applicationData.submittedAt = new Date().toISOString();
    
    console.log('신청서 제출:', applicationData);
    
    // 제출 버튼 비활성화 (중복 제출 방지)
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '제출 중...';
    }
    
    try {
        // Supabase에 신청서 저장 및 관리자 알림
        const savedApplication = await saveApplicationToSupabase(applicationData);
        
        if (savedApplication) {
            // 이메일 발송 여부에 따른 메시지 생성
            let successMessage = `✅ 신청서가 성공적으로 제출되었습니다!\n신청번호: ${savedApplication.id}`;
            
            if (savedApplication.email_sent || savedApplication.id) {
                successMessage += '\n✉️ 관리자에게 이메일로 자동 전달되었습니다.';
            } else {
                successMessage += '\n📋 신청서가 저장되었으며, 관리자가 확인할 예정입니다.';
            }
            
            alert(successMessage);
            
            // 폼 초기화
            event.target.reset();
            
            // 결과 페이지로 이동
            showResult(savedApplication);
        } else {
            throw new Error('신청서 저장에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('신청서 제출 중 오류:', error);
        alert('❌ 신청서 제출 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.');
    } finally {
        // 제출 버튼 활성화
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '신청서 제출';
        }
    }
}

// 제목 편집 모드로 전환
function editTitle() {
    const titleElement = document.getElementById('mainTitle');
    const currentTitle = titleElement.textContent;
    
    titleElement.innerHTML = `
        <input type="text" id="titleInput" value="${currentTitle}" style="width: 100%; padding: 8px; border: 2px solid #4CAF50; border-radius: 4px; font-size: 18px; font-weight: bold;">
    `;
    
    const titleInput = document.getElementById('titleInput');
    titleInput.focus();
    titleInput.select();
    
    // Enter 키로 저장, Esc 키로 취소
    titleInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveTitle();
        } else if (e.key === 'Escape') {
            cancelTitleEdit();
        }
    });
    
    // 입력란에서 포커스가 벗어나면 자동 저장
    titleInput.addEventListener('blur', function() {
        saveTitle();
    });
}

// 제목 저장
function saveTitle() {
    const titleInput = document.getElementById('titleInput');
    const newTitle = titleInput.value.trim();
    
    if (!newTitle) {
        alert('제목을 입력해주세요.');
        return;
    }
    
    // localStorage에 저장
    localStorage.setItem('mainTitle', newTitle);
    
    // 제목 업데이트 및 편집 모드 해제
    const titleElement = document.getElementById('mainTitle');
    titleElement.innerHTML = newTitle;
    titleElement.onclick = editTitle;
    
    // Supabase에 저장
    saveAdminSettingsToCloud();
    
    alert('제목이 저장되었습니다!');
}

// 제목 편집 취소
function cancelTitleEdit() {
    const titleElement = document.getElementById('mainTitle');
    const savedTitle = localStorage.getItem('mainTitle') || 'Speed 아파트 통신 환경 개선 신청서';
    
    // 편집 모드 해제하고 원래 상태로 복원
    titleElement.innerHTML = savedTitle;
    titleElement.onclick = editTitle;
}

// 부제목은 고정 텍스트로 변경됨 - 편집 기능 제거

// 메일 입력 모달 표시
function showEmailInputModal() {
    const modal = document.getElementById('emailInputModal');
    modal.style.display = 'block';
    
    // 기존 입력란 초기화
    const emailInputs = document.getElementById('emailInputs');
    emailInputs.innerHTML = `
        <div class="email-input-row">
            <input type="email" class="email-input" placeholder="example1@email.com">
            <button type="button" class="remove-btn" onclick="removeEmailInput(this)" style="display: none;">삭제</button>
        </div>
    `;
    
    // 저장된 메일 주소 불러오기
    const savedEmails = JSON.parse(localStorage.getItem('savedEmailAddresses') || '[]');
    savedEmails.forEach((email, index) => {
        if (index > 0) {
            addEmailInput();
        }
        const inputs = emailInputs.querySelectorAll('.email-input');
        if (inputs[index]) {
            inputs[index].value = email;
        }
    });
}

// 메일 입력란 추가
function addEmailInput() {
    const emailInputs = document.getElementById('emailInputs');
    const emailRows = emailInputs.querySelectorAll('.email-input-row');
    
    if (emailRows.length >= 3) {
        alert('메일 주소는 최대 3개까지 입력할 수 있습니다.');
        return;
    }
    
    const newRow = document.createElement('div');
    newRow.className = 'email-input-row';
    newRow.innerHTML = `
        <input type="email" class="email-input" placeholder="example${emailRows.length + 1}@email.com">
        <button type="button" class="remove-btn" onclick="removeEmailInput(this)">삭제</button>
    `;
    
    emailInputs.appendChild(newRow);
    
    // 삭제 버튼 표시/숨김 조정
    if (emailRows.length === 0) {
        emailInputs.querySelector('.remove-btn').style.display = 'none';
    }
}

// 메일 입력란 삭제
function removeEmailInput(button) {
    const emailInputs = document.getElementById('emailInputs');
    const emailRows = emailInputs.querySelectorAll('.email-input-row');
    
    if (emailRows.length > 1) {
        button.parentElement.remove();
        
        // 삭제 버튼 표시/숨김 조정
        if (emailRows.length === 2) {
            emailInputs.querySelector('.remove-btn').style.display = 'none';
        }
    }
}

// 메일 주소 저장
function saveEmailAddresses() {
    const emailInputs = document.querySelectorAll('.email-input');
    const emails = [];
    
    emailInputs.forEach(input => {
        const email = input.value.trim();
        if (email && email.includes('@')) {
            emails.push(email);
        }
    });
    
    if (emails.length === 0) {
        alert('유효한 메일 주소를 입력해주세요.');
        return;
    }
    
    // localStorage에 저장
    localStorage.setItem('savedEmailAddresses', JSON.stringify(emails));
    
    // 화면 업데이트
    displaySavedInputs();
    
    // Supabase에 저장
    saveAdminSettingsToCloud();
    
    // 모달 닫기
    closeEmailInputModal();
    
    alert('메일 주소가 저장되었습니다!');
}

// 메일 입력 모달 닫기
function closeEmailInputModal() {
    const modal = document.getElementById('emailInputModal');
    modal.style.display = 'none';
}

// 폰번호 입력 모달 표시
function showPhoneInputModal() {
    const modal = document.getElementById('phoneInputModal');
    modal.style.display = 'block';
    
    // 기존 입력란 초기화
    const phoneInputs = document.getElementById('phoneInputs');
    phoneInputs.innerHTML = `
        <div class="phone-input-row">
            <input type="tel" class="phone-input" placeholder="010-1234-5678">
            <button type="button" class="remove-btn" onclick="removePhoneInput(this)" style="display: none;">삭제</button>
        </div>
    `;
    
    // 저장된 폰번호 불러오기
    const savedPhones = JSON.parse(localStorage.getItem('savedPhoneNumbers') || '[]');
    savedPhones.forEach((phone, index) => {
        if (index > 0) {
            addPhoneInput();
        }
        const inputs = phoneInputs.querySelectorAll('.phone-input');
        if (inputs[index]) {
            inputs[index].value = phone;
        }
    });
}

// 폰번호 입력란 추가
function addPhoneInput() {
    const phoneInputs = document.getElementById('phoneInputs');
    const phoneRows = phoneInputs.querySelectorAll('.phone-input-row');
    
    if (phoneRows.length >= 3) {
        alert('폰번호는 최대 3개까지 입력할 수 있습니다.');
        return;
    }
    
    const newRow = document.createElement('div');
    newRow.className = 'phone-input-row';
    newRow.innerHTML = `
        <input type="tel" class="phone-input" placeholder="010-1234-5678">
        <button type="button" class="remove-btn" onclick="removePhoneInput(this)">삭제</button>
    `;
    
    phoneInputs.appendChild(newRow);
    
    // 삭제 버튼 표시/숨김 조정
    if (phoneRows.length === 0) {
        phoneInputs.querySelector('.remove-btn').style.display = 'none';
    }
}

// 폰번호 입력란 삭제
function removePhoneInput(button) {
    const phoneInputs = document.getElementById('phoneInputs');
    const phoneRows = phoneInputs.querySelectorAll('.phone-input-row');
    
    if (phoneRows.length > 1) {
        button.parentElement.remove();
        
        // 삭제 버튼 표시/숨김 조정
        if (phoneRows.length === 2) {
            phoneInputs.querySelector('.remove-btn').style.display = 'none';
        }
    }
}

// 폰번호 저장
function savePhoneNumbers() {
    const phoneInputs = document.querySelectorAll('.phone-input');
    const phones = [];
    
    phoneInputs.forEach(input => {
        const phone = input.value.trim();
        if (phone && phone.length >= 10) {
            phones.push(phone);
        }
    });
    
    if (phones.length === 0) {
        alert('유효한 폰번호를 입력해주세요.');
        return;
    }
    
    // localStorage에 저장
    localStorage.setItem('savedPhoneNumbers', JSON.stringify(phones));
    
    // 화면 업데이트
    displaySavedInputs();
    
    // Supabase에 저장
    saveAdminSettingsToCloud();
    
    // 모달 닫기
    closePhoneInputModal();
    
    alert('폰번호가 저장되었습니다!');
}

// 폰번호 입력 모달 닫기
function closePhoneInputModal() {
    const modal = document.getElementById('phoneInputModal');
    modal.style.display = 'none';
}

// QR 코드 생성
function generatePageQR() {
    console.log('QR 코드 생성 시작');

    const qrCodeContainer = document.getElementById('qrCodeContainer');
    const qrCodeDiv = document.getElementById('qrcode');
    const qrActionButtons = document.getElementById('qrActionButtons');
    const qrGenerateBtn = document.getElementById('qrGenerateBtn');

    console.log('DOM 요소 확인:', {
        qrCodeContainer: qrCodeContainer,
        qrCodeDiv: qrCodeDiv,
        qrActionButtons: qrActionButtons,
        qrGenerateBtn: qrGenerateBtn
    });

    // DOM 요소 존재 확인
    if (!qrCodeContainer) {
        console.error('qrCodeContainer를 찾을 수 없습니다');
        alert('QR 코드 컨테이너를 찾을 수 없습니다.');
        return;
    }

    if (!qrCodeDiv) {
        console.error('qrCodeDiv를 찾을 수 없습니다');
        alert('QR 코드 div를 찾을 수 없습니다.');
        return;
    }

    // QRCode 라이브러리 확인
    if (typeof QRCode === 'undefined') {
        console.error('QRCode 라이브러리가 로드되지 않았습니다.');
        alert('QR 코드 라이브러리를 불러올 수 없습니다.\n\n페이지를 새로고침하고 다시 시도해주세요.');
        return;
    }

    // 고객용 URL 생성 (간단하게)
    const currentUrl = window.location.origin + window.location.pathname;
    // 현재 debug 모드인지 확인
    const isDebugMode = new URLSearchParams(window.location.search).get('debug') === 'true';
    const customerUrl = isDebugMode ?
        `${currentUrl}?debug=true&mode=customer` :
        `${currentUrl}?mode=customer`;

    console.log('QR 코드용 단순화된 URL:', customerUrl);
    console.log('URL 길이:', customerUrl.length, '자');

    try {
        console.log('QR 코드 생성 시작');
        qrCodeDiv.innerHTML = '';

        new QRCode(qrCodeDiv, {
            text: customerUrl,
            width: 250,
            height: 250,
            colorDark: "#000000",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.H,
            margin: 2
        });

        console.log('QR 코드 생성 완료');

        // QR 컨테이너 표시
        qrCodeContainer.style.display = 'block';

        // QR 액션 버튼들 표시
        if (qrActionButtons) {
            qrActionButtons.style.display = 'flex';
        }

        // QR 생성 버튼 숨기기
        if (qrGenerateBtn) {
            qrGenerateBtn.style.display = 'none';
        }

        // Supabase에 관리자 설정 저장
        saveAdminSettingsToCloud();

        console.log('QR 코드 생성 완료:', customerUrl);

    } catch (error) {
        console.error('QR 코드 생성 중 오류:', error);
        alert('QR 코드 생성 중 오류가 발생했습니다: ' + error.message);
    }
}

// 짧은 URL로 QR 생성
function generateQRWithShortUrl(shortUrl, qrCodeDiv, qrSection, qrDeleteBtn) {
    try {
        console.log('짧은 URL로 QR 코드 생성:', shortUrl);
        qrCodeDiv.innerHTML = '';
        
        new QRCode(qrCodeDiv, {
            text: shortUrl,
            width: 250,
            height: 250,
            colorDark: "#000000",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.L, // 낮은 오류 수정 레벨로 변경
            margin: 2
        });
        
        console.log('짧은 URL QR 코드 생성 완료');
        
        // QR 섹션 표시
        qrSection.style.display = 'block';
        
        // QR 삭제 버튼 표시
        if (qrDeleteBtn) {
            qrDeleteBtn.style.display = 'inline-block';
        }
        
        // Supabase에 관리자 설정 저장
        saveAdminSettingsToCloud();
        
        console.log('짧은 URL QR 코드 생성 완료:', shortUrl);
        
    } catch (error) {
        console.error('짧은 URL QR 코드 생성 중 오류:', error);
        
        // 최후의 수단: 더 간단한 URL
        const isDebugMode = new URLSearchParams(window.location.search).get('debug') === 'true';
        const simpleUrl = isDebugMode ? 
            `${window.location.protocol}//${window.location.hostname}?debug=true&mode=customer` :
            `${window.location.protocol}//${window.location.hostname}?mode=customer`;
        console.log('최종 단순 URL 시도:', simpleUrl);
        
        try {
            qrCodeDiv.innerHTML = '';
            new QRCode(qrCodeDiv, {
                text: simpleUrl,
                width: 200,
                height: 200,
                correctLevel: QRCode.CorrectLevel.L
            });
            
            qrSection.style.display = 'block';
            if (qrDeleteBtn) qrDeleteBtn.style.display = 'inline-block';
            
        } catch (finalError) {
            console.error('최종 QR 생성 실패:', finalError);
            alert('QR 코드 생성에 실패했습니다. URL이 너무 긴 것 같습니다.');
        }
    }
}

// QR 코드 삭제
function deleteQR() {
    const qrCodeContainer = document.getElementById('qrCodeContainer');
    const qrCodeDiv = document.getElementById('qrcode');
    const qrActionButtons = document.getElementById('qrActionButtons');
    const qrGenerateBtn = document.getElementById('qrGenerateBtn');

    qrCodeDiv.innerHTML = '';
    qrCodeContainer.style.display = 'none';

    if (qrActionButtons) {
        qrActionButtons.style.display = 'none';
    }

    // QR 생성 버튼 다시 표시
    if (qrGenerateBtn) {
        qrGenerateBtn.style.display = 'flex';
    }

    console.log('QR 코드 삭제 완료');
}

// QR 코드 다운로드
function downloadQR(format) {
    const qrCodeDiv = document.getElementById('qrcode');
    const originalCanvas = qrCodeDiv.querySelector('canvas');

    if (!originalCanvas) {
        alert('QR 코드를 먼저 생성해주세요.');
        return;
    }

    // 새 캔버스 생성 (테두리 공간 추가)
    const borderWidth = 10; // 테두리 두께 (20 → 10으로 축소)
    const newCanvas = document.createElement('canvas');
    const ctx = newCanvas.getContext('2d');

    // 원본 QR 코드 크기
    const qrWidth = originalCanvas.width;
    const qrHeight = originalCanvas.height;

    // 테두리를 포함한 새 캔버스 크기
    newCanvas.width = qrWidth + (borderWidth * 2);
    newCanvas.height = qrHeight + (borderWidth * 2);

    // 흰색 배경
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

    // 연한 녹색 테두리 그리기 (사각형)
    ctx.strokeStyle = '#90EE90';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth / 2, borderWidth / 2,
                   newCanvas.width - borderWidth,
                   newCanvas.height - borderWidth);

    // 원본 QR 코드를 중앙에 그리기
    ctx.drawImage(originalCanvas, borderWidth, borderWidth);

    // 다운로드
    const link = document.createElement('a');
    link.download = `qrcode.${format}`;

    if (format === 'png') {
        link.href = newCanvas.toDataURL('image/png');
    } else if (format === 'jpg') {
        // JPG는 흰색 배경 추가
        const jpgCanvas = document.createElement('canvas');
        const jpgCtx = jpgCanvas.getContext('2d');
        jpgCanvas.width = newCanvas.width;
        jpgCanvas.height = newCanvas.height;

        // 흰색 배경
        jpgCtx.fillStyle = '#FFFFFF';
        jpgCtx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);

        // QR 코드 그리기
        jpgCtx.drawImage(newCanvas, 0, 0);

        link.href = jpgCanvas.toDataURL('image/jpeg', 0.95);
    }

    link.click();
}

// 페이지 로드시 저장된 제목 불러오기 (부제목은 고정)
function loadSavedTitles() {
    const savedTitle = localStorage.getItem('mainTitle');
    
    if (savedTitle) {
        const titleElement = document.getElementById('mainTitle');
        titleElement.textContent = savedTitle;
    }
    
    // 부제목은 항상 고정 텍스트로 설정
    const subtitleElement = document.getElementById('mainSubtitle');
    subtitleElement.textContent = '신청서를 작성하여 제출해 주세요';
}

// 저장된 메일/폰번호 표시
function displaySavedInputs() {
    const savedEmails = JSON.parse(localStorage.getItem('savedEmailAddresses') || '[]');
    const savedPhones = JSON.parse(localStorage.getItem('savedPhoneNumbers') || '[]');
    
    const emailDisplay = document.getElementById('emailDisplay');
    const phoneDisplay = document.getElementById('phoneDisplay');
    
    // 메일 주소 표시
    if (savedEmails.length > 0) {
        if (savedEmails.length === 1) {
            emailDisplay.textContent = savedEmails[0];
        } else {
            emailDisplay.textContent = `${savedEmails[0]} 외 ${savedEmails.length - 1}개`;
        }
        emailDisplay.classList.add('has-content');
        emailDisplay.title = `저장된 메일 주소:\n${savedEmails.join('\n')}`;
    } else {
        emailDisplay.textContent = '';
        emailDisplay.classList.remove('has-content');
        emailDisplay.title = '';
    }
    
    // 폰번호 표시
    if (savedPhones.length > 0) {
        if (savedPhones.length === 1) {
            phoneDisplay.textContent = savedPhones[0];
        } else {
            phoneDisplay.textContent = `${savedPhones[0]} 외 ${savedPhones.length - 1}개`;
        }
        phoneDisplay.classList.add('has-content');
        phoneDisplay.title = `저장된 폰번호:\n${savedPhones.join('\n')}`;
    } else {
        phoneDisplay.textContent = '';
        phoneDisplay.classList.remove('has-content');
        phoneDisplay.title = '';
    }
}

// 결과 페이지 표시
function showResult(applicationData = null) {
    const resultSection = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');

    // 조건부 UI 제어를 위한 요소 참조
    const promotionFlyer = document.getElementById('promotionFlyer');
    const resultActions = document.getElementById('resultActions');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 showResult 함수 실행 (v=20251019)');
    console.log('🔍 promotionFlyer 요소 존재:', !!promotionFlyer);
    console.log('🔍 resultActions 요소 존재:', !!resultActions);
    if (promotionFlyer) {
        console.log('🔍 promotionFlyer HTML:', promotionFlyer.innerHTML.substring(0, 100));
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (applicationData) {
        // Supabase 컬럼명 submittedAt 우선 사용
        const submittedIso = applicationData.submittedAt || applicationData.submitted_at || new Date().toISOString();
        const submittedDate = new Date(submittedIso);
        const formattedDate = submittedDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // 신청번호를 년월일시분(YYYYMMDDHHmm) 형식으로 표현 (application_number가 있으면 우선 사용)
        const appNum = applicationData.application_number || (
            `${submittedDate.getFullYear()}${String(submittedDate.getMonth()+1).padStart(2,'0')}${String(submittedDate.getDate()).padStart(2,'0')}${String(submittedDate.getHours()).padStart(2,'0')}${String(submittedDate.getMinutes()).padStart(2,'0')}`
        );

        resultContent.innerHTML = `
            <div class="result-info">
                <h3>📋 접수 완료</h3>
                <p><strong>신청번호:</strong> ${appNum}</p>
                <p><strong>신청자:</strong> ${applicationData.name}</p>
                <p><strong>연락처:</strong> ${applicationData.phone}</p>
                <p><strong>접수일시:</strong> ${formattedDate}</p>
                <p><strong>처리상태:</strong> 접수 완료 (관리자 검토 중)</p>
                <div class="notice">
                    <p>💡 관리자가 신청 내용을 검토한 후 연락드릴 예정입니다.</p>
                    <p>문의사항이 있으시면 게시판 공사팀 연락처로 연락 주세요.</p>
                </div>
            </div>
        `;

        // workType에 따른 조건부 UI 표시 로직
        const workType = applicationData.workType || applicationData.work_type;
        console.log('🔍 WorkType 확인:', workType);
        console.log('🔍 promotionFlyer 요소:', promotionFlyer);
        console.log('🔍 resultActions 요소:', resultActions);

        if (workType === 'interior') { // KT 선택
            // KT 선택 시: 버튼들 표시, 전단지 숨김
            if (resultActions) resultActions.style.display = 'flex';
            if (promotionFlyer) promotionFlyer.style.display = 'none';
            console.log('✅ KT 선택 - 버튼 표시, 이미지 숨김');

        } else if (workType === 'exterior' ||   // SKT
                   workType === 'plumbing' ||   // LGU+
                   workType === 'electrical') { // 기타(지역방송)
            // SKT/LGU+/기타 선택 시: 버튼들 숨김, 전단지 표시
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎯 조건 만족: KT가 아닌 통신사 (' + workType + ')');
            
            if (resultActions) {
                resultActions.style.display = 'none';
                console.log('✅ resultActions 숨김 완료');
            }
            
            if (promotionFlyer) {
                promotionFlyer.style.display = 'block';
                promotionFlyer.style.visibility = 'visible';
                promotionFlyer.style.opacity = '1';
                console.log('✅ promotionFlyer 표시 설정 완료');
                console.log('   - display:', promotionFlyer.style.display);
                console.log('   - visibility:', promotionFlyer.style.visibility);
                console.log('📷 이미지 1: m_evt2685_genieTV_vis.jpg');
                console.log('📷 이미지 2: m_evt2685_genieTV_cont02.jpg');
                
                // 이미지 요소들도 확인
                const images = promotionFlyer.querySelectorAll('img');
                console.log('🖼️ 찾은 이미지 개수:', images.length);
                images.forEach((img, idx) => {
                    console.log(`   이미지 ${idx + 1}: ${img.src}`);
                });
            } else {
                console.error('❌ promotionFlyer 요소를 찾을 수 없습니다!');
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        } else {
            // 기본값: 버튼들 표시 (이전 동작 유지)
            if (resultActions) resultActions.style.display = 'flex';
            if (promotionFlyer) promotionFlyer.style.display = 'none';
            console.log('⚠️ 기본값 - 버튼 표시');
        }
    } else {
        resultContent.innerHTML = `
            <div class="result-info">
                <h3>📋 신청 완료</h3>
                <p>신청서가 성공적으로 제출되었습니다.</p>
                <p>관리자가 검토 후 연락드리겠습니다.</p>
            </div>
        `;

        // 데이터가 없는 경우 기본값으로 버튼 표시
        if (resultActions) resultActions.style.display = 'flex';
        if (promotionFlyer) promotionFlyer.style.display = 'none';
    }

    // 폼과 헤더 숨기고 결과만 표시 (!important로 강제)
    const appForm = document.getElementById('applicationForm');
    if (appForm) {
        appForm.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0 !important; overflow: hidden !important; position: absolute !important; left: -9999px !important;';
        console.log('✅ 신청서 폼 완전히 숨김 (!important)');
    }
    
    // 헤더도 숨김 (신청 완료 후에는 필요 없음)
    const header = document.querySelector('header');
    if (header) {
        header.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0 !important; overflow: hidden !important; position: absolute !important; left: -9999px !important;';
        console.log('✅ 헤더 영역 완전히 숨김 (!important)');
    }
    
    // body에 result-shown 클래스 추가 (CSS 규칙 활성화)
    document.body.classList.add('result-shown');
    console.log('✅ body에 result-shown 클래스 추가');
    
    resultSection.style.display = 'block';
    console.log('✅ 결과 화면 표시');
    
    // ★★★ 화면을 맨 위로 스크롤 (3가지 방법 동시 적용) ★★★
    // 방법 1: 즉시 스크롤
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    console.log('✅ 즉시 스크롤 (top = 0)');
    
    // 방법 2: result 섹션으로 스크롤
    setTimeout(() => {
        resultSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
        });
        console.log('✅ resultSection으로 스크롤');
    }, 50);
    
    // 방법 3: 다시 한번 맨 위로 (확실하게)
    setTimeout(() => {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth'
        });
        // container도 스크롤
        const container = document.querySelector('.container');
        if (container) {
            container.scrollTop = 0;
        }
        console.log('✅ 최종 맨 위로 스크롤 완료');
    }, 200);

    console.log('결과 페이지 표시:', applicationData);
}

// 모바일 환경 최적화 함수
function optimizeForMobile() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        // 입력 필드 포커스 시 자동 스크롤 처리
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        });

        // 가상 키보드 표시 시 스크롤 조정
        const container = document.querySelector('.container');
        window.addEventListener('resize', () => {
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA') {
                window.scrollTo(0, 0);
                document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        // 터치 이벤트 최적화
        document.addEventListener('touchstart', function() {}, {passive: true});
    }
}

// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('applicationForm');
    const workTypeSelect = document.getElementById('workType');
    const otherWorkTypeDiv = document.getElementById('otherWorkType');
    
    // 모바일 최적화 실행
    optimizeForMobile();
    
    // URL 파라미터 확인하여 고객용/관리자용 모드 결정
    const urlParams = new URLSearchParams(window.location.search);
    const isCustomerMode = urlParams.has('customer') || urlParams.has('apply') || urlParams.get('mode') === 'customer';

    // 관리자 모드 설정 (PC 레이아웃)
    if (!isCustomerMode) {
        const setupAdminMode = () => {
            console.log('관리자 모드 설정 시작');

            // Container에 admin-mode 클래스 추가 (PC 레이아웃 활성화)
            const container = document.querySelector('.container');
            if (container) {
                container.classList.add('admin-mode');
            }

            // 관리자 제어판 표시
            const adminPanel = document.getElementById('adminControlPanel');
            if (adminPanel) {
                adminPanel.style.display = 'block';
            }

            // 고객용 폼 숨김
            const applicationForm = document.getElementById('applicationForm');
            if (applicationForm) {
                applicationForm.style.display = 'none';
            }

            // 관리자 정보 표시 초기화
            initializeAdminInfoDisplay();

            // 기존 QR 코드 마이그레이션 (한 번만 실행)
            const migrationKey = `qr_migration_done_${APARTMENT_ID}`;
            if (!localStorage.getItem(migrationKey)) {
                console.log('🔄 QR 코드 마이그레이션 실행 중...');
                migrateOldQRCodes().then(() => {
                    localStorage.setItem(migrationKey, 'true');
                    // 마이그레이션 후 QR 목록 다시 불러오기
                    loadQRList();
                });
            } else {
                // 마이그레이션 이미 완료됨
                loadQRList();
            }

            console.log('관리자 모드 UI 설정 완료');
        };

        // DOM이 준비되었는지 확인 후 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupAdminMode);
        } else {
            setupAdminMode();
        }
    }

    // 고객용 모드인 경우 QR 생성 버튼과 카카오톡 공유 버튼, 문자 버튼 숨기고 제출 버튼 텍스트 변경
    else if (isCustomerMode) {
        // URL 파라미터로 전달된 관리자 데이터(제목만)를 localStorage에 주입하여
        // 다른 기기(고객 폰)에서도 관리자 설정이 반영되도록 동기화
        (function syncAdminDataFromURL() {
            try {
                const titleParam = urlParams.get('title');

                if (titleParam) {
                    localStorage.setItem('mainTitle', decodeURIComponent(titleParam));
                }

                // QR ID 추출 및 저장
                const qrIdParam = urlParams.get('qr_id');
                if (qrIdParam) {
                    // URL에는 짧은 코드만 있지만, 내부적으로는 전체 ID 저장
                    const shortCode = decodeURIComponent(qrIdParam);
                    currentQrId = `${APARTMENT_ID}_${shortCode}`;
                    console.log('📱 QR ID 추출 성공:', currentQrId, '(짧은 코드:', shortCode, ')');
                    
                    // ★ 고객 모드 전용: QR 데이터 조회 및 currentApartmentName 설정
                    (async () => {
                        try {
                            if (!window.supabase) {
                                console.warn('⚠️ Supabase 미초기화, 기본값 사용');
                                return;
                            }

                            const { data: qrData, error } = await window.supabase
                                .from('qr_codes')
                                .select('apartment_name, emails, phones')
                                .eq('id', currentQrId)
                                .single();

                            if (error) {
                                console.error('❌ QR 데이터 조회 실패:', error);
                                return;
                            }

                            if (qrData && qrData.apartment_name) {
                                currentApartmentName = qrData.apartment_name;
                                console.log('✅ 고객 모드: currentApartmentName 설정 완료:', currentApartmentName);
                                console.log('📧 이메일 수신자:', qrData.emails);
                                console.log('📱 SMS 수신자:', qrData.phones);
                            } else {
                                console.warn('⚠️ QR 데이터에 apartment_name 없음');
                            }
                        } catch (error) {
                            console.error('❌ QR 데이터 로드 오류:', error);
                        }
                    })();
                } else {
                    console.log('ℹ️ QR ID 없음 (일반 고객 모드)');
                }
            } catch (e) {
                console.warn('URL 기반 관리자 데이터 동기화 실패:', e);
            }
        })();
        
        // DOM 준비 완료 후 UI 요소들 처리
        const setupCustomerMode = () => {
            console.log('고객 모드 설정 시작');

            // 관리자 제어판 숨김
            const adminPanel = document.getElementById('adminControlPanel');
            if (adminPanel) {
                adminPanel.style.display = 'none';
            }

            // 고객용 폼 표시
            const applicationForm = document.getElementById('applicationForm');
            if (applicationForm) {
                applicationForm.style.display = 'block';
            }

            // 관리자 버튼들을 더 적극적으로 찾아서 숨기기
            const adminSelectors = [
                '#adminInputSection',
                '#adminActionSection',
                '#adminTopSection',
                '.admin-top-section',
                '.admin-info-buttons',
                '.input-section',
                '.action-section',
                '.admin-control-panel',
                '#qrSection'
            ];

            adminSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element) {
                        element.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                        element.classList.add('customer-mode-hidden');
                        console.log('숨김 처리:', selector, element);
                    }
                });
            });

            // 고객용 제출 버튼 강제 표시
            const customerSubmitSection = document.getElementById('customerSubmitSection');
            if (customerSubmitSection) {
                customerSubmitSection.style.cssText = 'display: block !important; visibility: visible !important;';
                customerSubmitSection.classList.remove('customer-mode-hidden');
                console.log('고객 제출 버튼 표시됨');
            }

            // 제목 클릭 편집 기능 비활성화
            const titleElement = document.getElementById('mainTitle');
            if (titleElement) {
                titleElement.onclick = null;
                titleElement.style.cursor = 'default';
                titleElement.removeAttribute('title');
            }

            // 강력한 CSS 규칙 추가
            const style = document.createElement('style');
            style.textContent = `
                .customer-mode-hidden,
                #adminInputSection,
                #adminActionSection,
                #adminTopSection,
                .admin-top-section,
                .admin-info-buttons,
                .input-section,
                .action-section,
                .admin-control-panel,
                #adminControlPanel,
                #qrSection {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    height: 0 !important;
                    overflow: hidden !important;
                }
                #customerSubmitSection,
                #applicationForm {
                    display: block !important;
                    visibility: visible !important;
                }
                body.customer-mode .form-actions > *:not(#customerSubmitSection) {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);

            // body에 customer-mode 클래스 추가
            document.body.classList.add('customer-mode');

            console.log('고객용 모드 UI 설정 완료');
        };
        
        // DOM이 준비되었는지 확인 후 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupCustomerMode);
        } else {
            setupCustomerMode();
        }
        
        // 추가로 페이지 로드 완료 후에도 한번 더 실행
        setTimeout(setupCustomerMode, 100);
        
        // 저장된 제목이 있으면 우선 사용, 부제목은 고정
        const headerTitle = document.querySelector('header h1');
        const headerSubtext = document.querySelector('header p');
        const savedTitle = localStorage.getItem('mainTitle');
        if (headerTitle) headerTitle.textContent = savedTitle || '📡 Speed 아파트 통신 환경 개선 신청서';
        if (headerSubtext) headerSubtext.textContent = '신청서를 작성하여 제출해 주세요';
        
        console.log('고객용 모드로 실행됨');
    } else {
        // 관리자용 모드일 때 고객용 제출 버튼 숨기기
        const customerSubmitSection = document.getElementById('customerSubmitSection');
        if (customerSubmitSection) customerSubmitSection.style.display = 'none';

        // 관리자 전용 3개 버튼 섹션 표시
        const adminTopSection = document.getElementById('adminTopSection');
        if (adminTopSection) {
            adminTopSection.style.display = 'block';
        }

        // 관리자 정보 표시 초기화
        setTimeout(() => {
            initializeAdminInfoDisplay();
        }, 100);

        console.log('관리자용 모드로 실행됨');
    }
    
    // 저장된 제목/부제목 불러오기 (모든 모드에서 공통)
    loadSavedTitles();
    
    // 저장된 메일/폰번호 표시 (관리자 모드에서만)
    if (!isCustomerMode) {
        displaySavedInputs();
    }

    // Supabase에서 관리자 설정 로드 시도
    loadAdminSettingsFromCloud();

    // 기타 공사 선택시 추가 입력란 표시
    if (workTypeSelect) {
        workTypeSelect.addEventListener('change', function() {
            if (this.value === 'other') {
                if (otherWorkTypeDiv) otherWorkTypeDiv.style.display = 'block';
                const otherWork = document.getElementById('otherWork');
                if (otherWork) otherWork.required = true;
            } else {
                if (otherWorkTypeDiv) otherWorkTypeDiv.style.display = 'none';
                const otherWork = document.getElementById('otherWork');
                if (otherWork) otherWork.required = false;
            }
        });
    }
    
    // 공사 희망일 날짜 제한 설정 (오늘 이후만 선택 가능)
    const startDateInput = document.getElementById('startDate');
    if (startDateInput) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // 최소 선택 가능 날짜를 내일로 설정
        const minDate = tomorrow.toISOString().split('T')[0];
        startDateInput.setAttribute('min', minDate);
        
        console.log('공사 희망일 최소 선택 날짜 설정:', minDate);
    }
    
    // 폼 제출 처리
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // 고객 모드인 경우 신청서 제출 로직 실행
            if (isCustomerMode) {
                processCustomerFormSubmission(e);
                return;
            }
            
            // 관리자 모드인 경우 메일 공유 모달 표시 (관리자가 빈 설문지 공유할 때)
            // showEmailModal();
        });
    }
});

// 모든 함수를 전역 스코프에 노출 (onclick 속성에서 사용하기 위해)
window.editTitle = editTitle;
window.saveTitle = saveTitle;
window.cancelTitleEdit = cancelTitleEdit;
window.showEmailInputModal = showEmailInputModal;
window.addEmailInput = addEmailInput;
window.removeEmailInput = removeEmailInput;
window.saveEmailAddresses = saveEmailAddresses;
window.closeEmailInputModal = closeEmailInputModal;
window.showPhoneInputModal = showPhoneInputModal;
window.addPhoneInput = addPhoneInput;
window.removePhoneInput = removePhoneInput;
window.savePhoneNumbers = savePhoneNumbers;
window.closePhoneInputModal = closePhoneInputModal;
window.generatePageQR = generatePageQR;
window.deleteQR = deleteQR;
window.downloadQR = downloadQR;
window.shareToKakao = function() {
    // 카카오톡 공유 기능
    if (typeof Kakao !== 'undefined' && Kakao.Share) {
        const title = localStorage.getItem('mainTitle') || 'Speed 아파트 통신 환경 개선 신청서';
        const subtitle = localStorage.getItem('mainSubtitle') || '통신 환경 개선을 위한 신청서를 작성해주세요';
        const isDebugMode = new URLSearchParams(window.location.search).get('debug') === 'true';
        const customerUrl = isDebugMode ? 
            `${window.location.origin}${window.location.pathname}?debug=true&mode=customer` :
            `${window.location.origin}${window.location.pathname}?mode=customer`;
        
        Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
                title: title,
                description: subtitle,
                imageUrl: 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=신청서',
                link: {
                    mobileWebUrl: customerUrl,
                    webUrl: customerUrl,
                },
            },
            buttons: [
                {
                    title: '신청서 작성하기',
                    link: {
                        mobileWebUrl: customerUrl,
                        webUrl: customerUrl,
                    },
                },
            ],
        });
    } else {
        alert('카카오톡 공유 기능을 사용할 수 없습니다.');
    }
};

// 관리자 전용 3개 입력 버튼 함수들

// 아파트 이름 관련 함수들
function showApartmentNameModal() {
    const modal = document.getElementById('apartmentNameModal');
    const input = document.getElementById('apartmentNameInput');

    // 현재 저장된 값 불러오기
    const savedValue = localStorage.getItem('apartmentName') || '';
    input.value = savedValue;

    modal.style.display = 'block';
    input.focus();
}

function closeApartmentNameModal() {
    const modal = document.getElementById('apartmentNameModal');
    modal.style.display = 'none';
}

function saveApartmentName() {
    const input = document.getElementById('apartmentNameInput');
    const value = input.value.trim();

    if (!value) {
        alert('아파트 이름을 입력해주세요.');
        return;
    }

    // localStorage에 저장
    localStorage.setItem('apartmentName', value);

    // 화면 표시 업데이트
    updateApartmentNameDisplay();

    // Supabase에 저장
    saveAdminSettingsToCloud();

    // 모달 닫기
    closeApartmentNameModal();

    alert('아파트 이름이 저장되었습니다!');
}

function updateApartmentNameDisplay() {
    const display = document.getElementById('apartmentNameDisplay');
    const savedValue = localStorage.getItem('apartmentName') || '';

    if (savedValue) {
        display.textContent = savedValue;
        display.classList.add('has-content');
        display.title = `저장된 아파트 이름: ${savedValue}`;
    } else {
        display.textContent = '';
        display.classList.remove('has-content');
        display.title = '';
    }
}

// 진입 테마 관련 함수들
function showEntryIssueModal() {
    const modal = document.getElementById('entryIssueModal');
    const input = document.getElementById('entryIssueInput');

    // 현재 저장된 값 불러오기
    const savedValue = localStorage.getItem('entryIssue') || '';
    input.value = savedValue;

    modal.style.display = 'block';
    input.focus();
}

function closeEntryIssueModal() {
    const modal = document.getElementById('entryIssueModal');
    modal.style.display = 'none';
}

function saveEntryIssue() {
    const input = document.getElementById('entryIssueInput');
    const value = input.value.trim();

    if (!value) {
        alert('진입 테마를 입력해주세요.');
        return;
    }

    // localStorage에 저장
    localStorage.setItem('entryIssue', value);

    // 화면 표시 업데이트
    updateEntryIssueDisplay();

    // Supabase에 저장
    saveAdminSettingsToCloud();

    // 모달 닫기
    closeEntryIssueModal();

    alert('진입 테마가 저장되었습니다!');
}

function updateEntryIssueDisplay() {
    const display = document.getElementById('entryIssueDisplay');
    const savedValue = localStorage.getItem('entryIssue') || '';

    if (savedValue) {
        display.textContent = savedValue.length > 20 ? savedValue.substring(0, 20) + '...' : savedValue;
        display.classList.add('has-content');
        display.title = `저장된 진입 테마: ${savedValue}`;
    } else {
        display.textContent = '';
        display.classList.remove('has-content');
        display.title = '';
    }
}

// 영업KC 이름 관련 함수들
function showAgencyNameModal() {
    const modal = document.getElementById('agencyNameModal');
    const input = document.getElementById('agencyNameInput');

    // 현재 저장된 값 불러오기
    const savedValue = localStorage.getItem('agencyName') || '';
    input.value = savedValue;

    modal.style.display = 'block';
    input.focus();
}

function closeAgencyNameModal() {
    const modal = document.getElementById('agencyNameModal');
    modal.style.display = 'none';
}

function saveAgencyName() {
    const input = document.getElementById('agencyNameInput');
    const value = input.value.trim();

    if (!value) {
        alert('영업KC 이름을 입력해주세요.');
        return;
    }

    // localStorage에 저장
    localStorage.setItem('agencyName', value);

    // 화면 표시 업데이트
    updateAgencyNameDisplay();

    // Supabase에 저장
    saveAdminSettingsToCloud();

    // 모달 닫기
    closeAgencyNameModal();

    alert('영업KC 이름이 저장되었습니다!');
}

function updateAgencyNameDisplay() {
    const display = document.getElementById('agencyNameDisplay');
    const savedValue = localStorage.getItem('agencyName') || '';

    if (savedValue) {
        display.textContent = savedValue;
        display.classList.add('has-content');
        display.title = `저장된 영업KC 이름: ${savedValue}`;
    } else {
        display.textContent = '';
        display.classList.remove('has-content');
        display.title = '';
    }
}

// 관리자 정보 표시 초기화 함수
function initializeAdminInfoDisplay() {
    updateApartmentNameDisplay();
    updateEntryIssueDisplay();
    updateAgencyNameDisplay();
}

// 전역 함수로 노출
window.showApartmentNameModal = showApartmentNameModal;
window.closeApartmentNameModal = closeApartmentNameModal;
window.saveApartmentName = saveApartmentName;
window.showEntryIssueModal = showEntryIssueModal;
window.closeEntryIssueModal = closeEntryIssueModal;
window.saveEntryIssue = saveEntryIssue;
window.showAgencyNameModal = showAgencyNameModal;
window.closeAgencyNameModal = closeAgencyNameModal;
window.saveAgencyName = saveAgencyName;

// ========================================
// QR 코드 다중 생성 및 관리 시스템
// ========================================

// QR 이름 입력 모달 열기
function showQRNameModal() {
    console.log('🔍 showQRNameModal 함수 호출됨!');

    const modal = document.getElementById('qrNameInputModal');
    const input = document.getElementById('qrNameInput');

    console.log('📋 DOM 요소 확인:', {
        modal: modal,
        input: input,
        modalExists: !!modal,
        inputExists: !!input
    });

    if (modal && input) {
        console.log('✅ 모달 요소 찾음 - 모달 표시 중...');
        input.value = '';
        modal.style.display = 'block';
        input.focus();
        console.log('✅ 모달 표시 완료!');
    } else {
        console.error('❌ QR 이름 입력 모달 요소를 찾을 수 없습니다.');
        console.error('modal:', modal);
        console.error('input:', input);
        alert('QR 모달 요소를 찾을 수 없습니다. 콘솔(F12)을 확인하세요.');
    }
}

// QR 이름 입력 모달 닫기
function closeQRNameModal() {
    const modal = document.getElementById('qrNameInputModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 설정 화면으로 이동
function goToSettings() {
    console.log('⚙️ 설정 화면으로 이동');

    // STEP 1 카드(기본 설정)로 스크롤
    const featuresSection = document.querySelector('.features-section');
    if (featuresSection) {
        // 부드러운 스크롤 애니메이션
        featuresSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        // STEP 1 카드 하이라이트 효과 (1.5초간)
        const step1Card = document.querySelector('.feature-card.step-card');
        if (step1Card) {
            step1Card.style.transition = 'all 0.3s ease';
            step1Card.style.boxShadow = '0 0 30px rgba(76, 175, 80, 0.6)';
            step1Card.style.transform = 'scale(1.02)';

            setTimeout(() => {
                step1Card.style.boxShadow = '';
                step1Card.style.transform = '';
            }, 1500);
        }
    } else {
        console.warn('설정 섹션을 찾을 수 없습니다.');
    }
}

// 신규 영업 KC 등록 시작 (편집 모드 체크 추가)
function startNewKcRegistration() {
    // ★ 편집 모드인지 확인
    const currentEditingQRId = localStorage.getItem('currentEditingQRId');

    if (currentEditingQRId) {
        // 편집 모드: 저장 함수 호출
        console.log('💾 편집 모드: saveAdminSettingsFromEdit 호출');
        saveAdminSettingsFromEdit();
        return;
    }

    // 신규 등록 모드
    console.log('✨ 신규 영업 KC 등록 시작');

    // 확인 메시지
    const confirmed = confirm('신규 영업 KC를 등록하시겠습니까?\n\n초기화 항목:\n• STEP 1: 아파트 이름, 진입 테마, 영업KC 이름\n• STEP 2: 이메일/SMS 알림 설정\n\n※ 입력 필드만 비워집니다.\n※ Supabase 데이터는 그대로 유지됩니다.');

    if (!confirmed) {
        console.log('❌ 등록 취소됨');
        return;
    }

    // UI 상태 변경: 힌트 텍스트 숨기고 취소 버튼 표시
    const newKcHint = document.getElementById('newKcHint');
    const newKcCancelBtn = document.getElementById('newKcCancelBtn');

    if (newKcHint) {
        newKcHint.style.display = 'none';
        console.log('  ✅ 힌트 텍스트 숨김');
    }

    if (newKcCancelBtn) {
        newKcCancelBtn.style.display = 'flex';
        console.log('  ✅ 등록 취소 버튼 표시');
    }

    // 실제 초기화 진행
    resetAllSettings();
}

// 신규 영업 KC 등록 취소
function cancelNewKcRegistration() {
    console.log('❌ 신규 영업 KC 등록 취소');

    const confirmed = confirm('등록을 취소하시겠습니까?\n\n이미 입력한 내용은 유지되지 않습니다.');

    if (!confirmed) {
        return;
    }

    // UI 상태 복원: 취소 버튼 숨기고 힌트 텍스트 표시
    const newKcHint = document.getElementById('newKcHint');
    const newKcCancelBtn = document.getElementById('newKcCancelBtn');

    if (newKcHint) {
        newKcHint.style.display = 'inline';
        console.log('  ✅ 힌트 텍스트 표시');
    }

    if (newKcCancelBtn) {
        newKcCancelBtn.style.display = 'none';
        console.log('  ✅ 등록 취소 버튼 숨김');
    }

    // localStorage에서 기존 데이터 다시 로드하여 복원
    loadAdminSettingsFromCloud();

    alert('등록이 취소되었습니다.');
    console.log('✅ 등록 취소 완료');
}

// 모든 설정 초기화 (신규 영업 KC 등록) - 내부 로직만 수행
function resetAllSettings() {
    console.log('🔄 모든 설정 초기화 시작');

    try {
        // STEP 1: 기본 설정 초기화
        localStorage.removeItem('apartmentName');
        localStorage.removeItem('entryIssue');
        localStorage.removeItem('agencyName');

        // STEP 2: 알림 설정 초기화
        localStorage.removeItem('savedEmailAddresses');
        localStorage.removeItem('savedPhoneNumbers');

        // STEP 3: QR 코드 카드 내부만 초기화 (생성된 QR 관리 섹션은 절대 건드리지 않음)
        console.log('🗑️ STEP 3 카드 내부 QR 초기화 중...');

        const qrListInCard = document.getElementById('qrListInCard');
        if (qrListInCard) {
            qrListInCard.innerHTML = '';
            console.log('  ✅ STEP 3 카드 QR 목록 비움');
        }

        const qrListContainer = document.getElementById('qrListContainer');
        if (qrListContainer) {
            qrListContainer.style.display = 'none';
            console.log('  ✅ STEP 3 카드 QR 컨테이너 숨김');
        }

        console.log('✅ STEP 3 카드 초기화 완료 (하단 "생성된 QR 코드 관리"는 유지)');

        // 화면 표시 초기화
        const apartmentNameDisplay = document.getElementById('apartmentNameDisplay');
        const entryIssueDisplay = document.getElementById('entryIssueDisplay');
        const agencyNameDisplay = document.getElementById('agencyNameDisplay');
        const emailDisplay = document.getElementById('emailDisplay');
        const phoneDisplay = document.getElementById('phoneDisplay');

        if (apartmentNameDisplay) {
            apartmentNameDisplay.textContent = '';
            apartmentNameDisplay.classList.remove('has-content');
        }

        if (entryIssueDisplay) {
            entryIssueDisplay.textContent = '';
            entryIssueDisplay.classList.remove('has-content');
        }

        if (agencyNameDisplay) {
            agencyNameDisplay.textContent = '';
            agencyNameDisplay.classList.remove('has-content');
        }

        if (emailDisplay) {
            emailDisplay.textContent = '';
            emailDisplay.classList.remove('has-content');
        }

        if (phoneDisplay) {
            phoneDisplay.textContent = '';
            phoneDisplay.classList.remove('has-content');
        }

        console.log('✅ 모든 설정이 초기화되었습니다');
        alert('✅ 초기화 완료!\n\n새로운 영업 KC 정보를 입력하세요.\n\nSTEP 1 → STEP 2 → STEP 3 순서로 진행');

        // STEP 1 카드로 스크롤
        goToSettings();

    } catch (error) {
        console.error('❌ 설정 초기화 중 오류:', error);
        alert('설정 초기화 중 오류가 발생했습니다.');
    }
}

// 새 QR 코드 생성
async function createNewQR() {
    const input = document.getElementById('qrNameInput');
    const qrName = input.value.trim();

    if (!qrName) {
        alert('담당자 이름을 입력해주세요.');
        return;
    }

    try {
        console.log('🔍 QR 코드 생성 시작:', qrName);

        // Supabase 연결 확인
        if (!window.supabase) {
            throw new Error('Supabase 클라이언트를 찾을 수 없습니다.');
        }

        // 중복 확인 (qr_name으로)
        const { data: existingQR, error: checkError } = await window.supabase
            .from('qr_codes')
            .select('*')
            .eq('apartment_id', APARTMENT_ID)
            .eq('qr_name', qrName)
            .maybeSingle();

        if (existingQR) {
            alert(`"${qrName}" 이름의 QR 코드가 이미 존재합니다.\n다른 이름을 사용해주세요.`);
            return;
        }

        // 짧은 랜덤 코드 생성 (6자리: 영문 소문자 + 숫자)
        const generateShortCode = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        // 중복되지 않는 short_code 생성
        let shortCode;
        let attempts = 0;
        while (attempts < 10) {
            shortCode = generateShortCode();
            const { data: existingCode } = await window.supabase
                .from('qr_codes')
                .select('id')
                .eq('id', `${APARTMENT_ID}_${shortCode}`)
                .maybeSingle();

            if (!existingCode) break;
            attempts++;
        }

        if (attempts >= 10) {
            throw new Error('고유 코드 생성 실패. 다시 시도해주세요.');
        }

        // QR ID 생성 (아파트ID_짧은코드)
        const qrId = `${APARTMENT_ID}_${shortCode}`;

        // QR URL 생성 (짧은 코드만 사용)
        const currentUrl = window.location.origin + window.location.pathname;
        const isDebugMode = new URLSearchParams(window.location.search).get('debug') === 'true';
        const qrUrl = isDebugMode ?
            `${currentUrl}?debug=true&mode=customer&qr_id=${shortCode}` :
            `${currentUrl}?mode=customer&qr_id=${shortCode}`;

        console.log('📱 짧은 코드로 QR URL 생성:', qrUrl, '(코드:', shortCode, ')');

        // admin_settings에서 기본 설정 가져오기
        const { data: adminSettings, error: adminError } = await window.supabase
            .from('admin_settings')
            .select('*')
            .eq('apartment_id', APARTMENT_ID)
            .single();

        if (adminError) {
            console.warn('관리자 설정을 불러올 수 없습니다:', adminError);
        }

        // QR 데이터 객체 생성
        const qrData = {
            id: qrId,
            apartment_id: APARTMENT_ID,
            qr_name: qrName,
            phones: adminSettings?.phones || [],
            emails: adminSettings?.emails || [],
            apartment_name: adminSettings?.apartment_name || '',
            entry_issue: adminSettings?.entry_issue || '',
            agency_name: adminSettings?.agency_name || '',
            qr_url: qrUrl,
            is_active: true,
            scan_count: 0,
            created_at: new Date().toISOString()
        };

        console.log('💾 Supabase에 저장할 데이터:', qrData);

        // Supabase에 저장
        const { data, error } = await window.supabase
            .from('qr_codes')
            .insert(qrData)
            .select()
            .single();

        if (error) {
            throw new Error(`QR 저장 실패: ${error.message}`);
        }

        console.log('✅ QR 코드 저장 성공 (코드:', shortCode, '):', data);

        // 모달 닫기
        closeQRNameModal();

        // QR 목록 새로고침
        await loadQRList();

        alert(`"${qrName}" QR 코드가 생성되었습니다!`);

    } catch (error) {
        console.error('❌ QR 코드 생성 중 오류:', error);
        alert(`QR 코드 생성 중 오류가 발생했습니다:\n${error.message}`);
    }
}

// 기존 QR 코드를 짧은 코드로 마이그레이션
async function migrateOldQRCodes() {
    try {
        console.log('🔄 기존 QR 코드 마이그레이션 시작...');

        // 기존 QR 목록 조회 (한글 이름이 URL에 포함된 것들)
        const { data: oldQRs, error: fetchError } = await window.supabase
            .from('qr_codes')
            .select('*')
            .eq('apartment_id', APARTMENT_ID);

        if (fetchError) {
            console.warn('기존 QR 조회 실패:', fetchError);
            return;
        }

        if (!oldQRs || oldQRs.length === 0) {
            console.log('마이그레이션할 QR 코드 없음');
            return;
        }

        // 한글이 URL 인코딩된 QR만 필터링
        const qrsToMigrate = oldQRs.filter(qr => {
            return qr.qr_url && (qr.qr_url.includes('%') || qr.id.includes(qr.qr_name));
        });

        if (qrsToMigrate.length === 0) {
            console.log('✅ 모든 QR 코드가 이미 최신 형식입니다');
            return;
        }

        console.log(`📋 마이그레이션 대상: ${qrsToMigrate.length}개`);

        // 짧은 코드 생성 함수
        const generateShortCode = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        // 각 QR 코드를 변환
        for (const oldQR of qrsToMigrate) {
            try {
                // 중복되지 않는 짧은 코드 생성
                let shortCode;
                let attempts = 0;
                while (attempts < 10) {
                    shortCode = generateShortCode();
                    const { data: existingCode } = await window.supabase
                        .from('qr_codes')
                        .select('id')
                        .eq('id', `${APARTMENT_ID}_${shortCode}`)
                        .maybeSingle();

                    if (!existingCode) break;
                    attempts++;
                }

                if (attempts >= 10) {
                    console.warn(`⚠️ ${oldQR.qr_name} 코드 생성 실패 - 건너뜀`);
                    continue;
                }

                // 새 ID와 URL 생성
                const newId = `${APARTMENT_ID}_${shortCode}`;
                const currentUrl = window.location.origin + window.location.pathname;
                const newUrl = `${currentUrl}?mode=customer&qr_id=${shortCode}`;

                // 새 QR 데이터 생성
                const newQRData = {
                    id: newId,
                    apartment_id: oldQR.apartment_id,
                    qr_name: oldQR.qr_name,
                    phones: oldQR.phones,
                    emails: oldQR.emails,
                    apartment_name: oldQR.apartment_name,
                    entry_issue: oldQR.entry_issue,
                    agency_name: oldQR.agency_name,
                    qr_url: newUrl,
                    is_active: oldQR.is_active,
                    scan_count: oldQR.scan_count || 0,
                    created_at: oldQR.created_at || new Date().toISOString()
                };

                // 새 레코드 삽입
                const { error: insertError } = await window.supabase
                    .from('qr_codes')
                    .insert(newQRData);

                if (insertError) {
                    console.warn(`⚠️ ${oldQR.qr_name} 삽입 실패:`, insertError.message);
                    continue;
                }

                // 기존 레코드 삭제
                const { error: deleteError } = await window.supabase
                    .from('qr_codes')
                    .delete()
                    .eq('id', oldQR.id);

                if (deleteError) {
                    console.warn(`⚠️ ${oldQR.qr_name} 기존 레코드 삭제 실패:`, deleteError.message);
                } else {
                    console.log(`✅ ${oldQR.qr_name}: ${oldQR.id} → ${newId} (코드: ${shortCode})`);
                }

            } catch (error) {
                console.error(`❌ ${oldQR.qr_name} 마이그레이션 실패:`, error);
            }
        }

        console.log('🎉 QR 코드 마이그레이션 완료!');

    } catch (error) {
        console.error('❌ 마이그레이션 중 오류:', error);
    }
}

// QR 목록 불러오기
async function loadQRList() {
    try {
        console.log('🔍 QR 목록 불러오기 시작');

        if (!window.supabase) {
            throw new Error('Supabase 클라이언트를 찾을 수 없습니다.');
        }

        // Supabase에서 QR 목록 조회
        const { data, error } = await window.supabase
            .from('qr_codes')
            .select('*')
            .eq('apartment_id', APARTMENT_ID)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`QR 목록 조회 실패: ${error.message}`);
        }

        console.log('✅ QR 목록 조회 성공:', data);

        // QR 목록 렌더링
        renderQRList(data || []);

    } catch (error) {
        console.error('❌ QR 목록 불러오기 중 오류:', error);
        // 사용자에게는 조용히 처리 (초기 로드 시 테이블이 없을 수 있음)
    }
}

// QR 목록 UI 렌더링 (두 곳에 표시: STEP 3 카드 내부 + 페이지 하단 갤러리)
function renderQRList(qrList) {
    // 1. STEP 3 카드 내부 요소들
    const qrListContainer = document.getElementById('qrListContainer');
    const qrListInCard = document.getElementById('qrListInCard');

    // 2. 페이지 하단 갤러리 요소들
    const qrGallerySection = document.getElementById('qrGallerySection');
    const qrListGallery = document.getElementById('qrList');

    if (!qrListContainer || !qrListInCard || !qrGallerySection || !qrListGallery) {
        console.warn('QR 목록 컨테이너를 찾을 수 없습니다.');
        return;
    }

    // 목록이 비어있으면 모두 숨김
    if (qrList.length === 0) {
        qrListContainer.style.display = 'none';
        qrGallerySection.style.display = 'none';
        return;
    }

    // ===== 1. STEP 3 카드 내부: 최신 1개만 표시 =====
    qrListContainer.style.display = 'block';
    const latestQR = qrList[0]; // 최신 1개만
    renderQRCard(qrListInCard, [latestQR], 'card');

    // ===== 2. 페이지 하단 갤러리: 전체 목록 표시 =====
    qrGallerySection.style.display = 'block';
    renderQRCard(qrListGallery, qrList, 'gallery');
}

// QR 카드 HTML 생성 및 렌더링 (공통 함수)
function renderQRCard(container, qrList, prefix) {
    if (!container) return;

    // QR 카드 HTML 생성
    container.innerHTML = qrList.map(qr => `
        <div class="qr-card ${!qr.is_active ? 'inactive' : ''}" data-qr-id="${qr.id}">
            <div class="qr-card-header">
                <div class="qr-card-title">
                    <span class="qr-name">${qr.qr_name}</span>
                    <span class="qr-status ${qr.is_active ? 'active' : 'inactive'}">
                        ${qr.is_active ? '활성' : '비활성'}
                    </span>
                </div>
            </div>
            <div class="qr-code-preview" id="qr-preview-${prefix}-${qr.id}"></div>
            <div class="qr-card-actions">
                <button type="button" class="qr-action-btn download" onclick="downloadQRCode('${prefix}-${qr.id}', '${qr.qr_name}', 'png')">
                    <span>💾 PNG</span>
                </button>
                <button type="button" class="qr-action-btn download" onclick="downloadQRCode('${prefix}-${qr.id}', '${qr.qr_name}', 'jpg')">
                    <span>💾 JPG</span>
                </button>
                <button type="button" class="qr-action-btn edit" onclick="loadQRForEdit('${qr.id}')">
                    <span>⚙️ 기본 설정 수정</span>
                </button>
                <button type="button" class="qr-action-btn delete" onclick="deleteQRCode('${qr.id}', '${qr.qr_name}')">
                    <span>🗑️ 삭제</span>
                </button>
            </div>
        </div>
    `).join('');

    // 각 QR 코드 생성
    qrList.forEach(qr => {
        const previewDiv = document.getElementById(`qr-preview-${prefix}-${qr.id}`);
        if (previewDiv && qr.qr_url) {
            try {
                // QR 코드 미리보기 생성
                new QRCode(previewDiv, {
                    text: qr.qr_url,
                    width: 150,
                    height: 150,
                    colorDark: "#000000",
                    colorLight: "#FFFFFF",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } catch (error) {
                console.error(`QR 미리보기 생성 실패 (${prefix}-${qr.id}):`, error);
                previewDiv.innerHTML = '<p style="color: #999;">미리보기 생성 실패</p>';
            }
        }
    });
}

// QR 코드 다운로드
async function downloadQRCode(qrId, qrName, format) {
    try {
        console.log(`📥 QR 다운로드 시작: ${qrName} (${format})`);

        // QR 미리보기에서 캔버스 가져오기
        const previewDiv = document.getElementById(`qr-preview-${qrId}`);
        const originalCanvas = previewDiv?.querySelector('canvas');

        if (!originalCanvas) {
            alert('QR 코드를 찾을 수 없습니다.');
            return;
        }

        // 테두리 추가된 새 캔버스 생성
        const borderWidth = 10;
        const newCanvas = document.createElement('canvas');
        const ctx = newCanvas.getContext('2d');

        const qrWidth = originalCanvas.width;
        const qrHeight = originalCanvas.height;

        newCanvas.width = qrWidth + (borderWidth * 2);
        newCanvas.height = qrHeight + (borderWidth * 2);

        // 흰색 배경
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

        // 연한 녹색 테두리
        ctx.strokeStyle = '#90EE90';
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(borderWidth / 2, borderWidth / 2,
            qrWidth + borderWidth, qrHeight + borderWidth);

        // 원본 QR 코드 그리기
        ctx.drawImage(originalCanvas, borderWidth, borderWidth);

        // 다운로드
        const link = document.createElement('a');
        link.download = `qrcode_${qrName}.${format}`;
        link.href = newCanvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`);
        link.click();

        console.log(`✅ QR 다운로드 완료: ${qrName}.${format}`);

    } catch (error) {
        console.error('❌ QR 다운로드 중 오류:', error);
        alert(`QR 다운로드 중 오류가 발생했습니다:\n${error.message}`);
    }
}

// QR 코드 삭제
async function deleteQRCode(qrId, qrName) {
    if (!confirm(`"${qrName}" QR 코드를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    try {
        console.log(`🗑️ QR 삭제 시작: ${qrId}`);

        if (!window.supabase) {
            throw new Error('Supabase 클라이언트를 찾을 수 없습니다.');
        }

        // Supabase에서 삭제
        const { error } = await window.supabase
            .from('qr_codes')
            .delete()
            .eq('id', qrId);

        if (error) {
            throw new Error(`QR 삭제 실패: ${error.message}`);
        }

        console.log(`✅ QR 삭제 완료: ${qrId}`);

        // QR 목록 새로고침
        await loadQRList();

        alert(`"${qrName}" QR 코드가 삭제되었습니다.`);

    } catch (error) {
        console.error('❌ QR 삭제 중 오류:', error);
        alert(`QR 삭제 중 오류가 발생했습니다:\n${error.message}`);
    }
}

// QR 코드 활성화/비활성화 토글
async function toggleQRActive(qrId, newState) {
    try {
        console.log(`🔄 QR 상태 변경 시작: ${qrId} → ${newState ? '활성' : '비활성'}`);

        if (!window.supabase) {
            throw new Error('Supabase 클라이언트를 찾을 수 없습니다.');
        }

        // Supabase에서 상태 업데이트
        const { error } = await window.supabase
            .from('qr_codes')
            .update({ is_active: newState })
            .eq('id', qrId);

        if (error) {
            throw new Error(`QR 상태 변경 실패: ${error.message}`);
        }

        console.log(`✅ QR 상태 변경 완료: ${qrId}`);

        // QR 목록 새로고침
        await loadQRList();

    } catch (error) {
        console.error('❌ QR 상태 변경 중 오류:', error);
        alert(`QR 상태 변경 중 오류가 발생했습니다:\n${error.message}`);
    }
}

// QR 기본 설정 불러오기 및 수정 모드 (버튼 텍스트 동적 변경)
async function loadQRForEdit(qrId) {
    try {
        console.log(`⚙️ QR 설정 불러오기 시작: ${qrId}`);

        // Supabase에서 QR 데이터 조회
        if (!supabase) {
            console.error('❌ Supabase가 초기화되지 않았습니다.');
            alert('데이터베이스 연결이 필요합니다.');
            return;
        }

        const { data: qrData, error } = await supabase
            .from('qr_codes')
            .select('*')
            .eq('id', qrId)
            .single();

        if (error) {
            console.error('❌ QR 데이터 조회 실패:', error);
            alert(`QR 데이터를 불러오는데 실패했습니다:\n${error.message}`);
            return;
        }

        if (!qrData) {
            console.error('❌ QR 데이터를 찾을 수 없습니다.');
            alert('QR 데이터를 찾을 수 없습니다.');
            return;
        }

        console.log('✅ QR 데이터 로드 성공:', qrData);

        // ★ 버튼 텍스트를 동적으로 변경 (HTML 수정 없이 JavaScript로만)
        const newKcRegisterBtn = document.getElementById('newKcRegisterBtn');
        if (newKcRegisterBtn) {
            const btnText = newKcRegisterBtn.querySelector('.btn-text');
            const btnIcon = newKcRegisterBtn.querySelector('.btn-icon');
            if (btnText) {
                btnText.textContent = '영업KC 기본/알림 설정 수정';
            }
            if (btnIcon) {
                btnIcon.textContent = '💾';
            }
            console.log('✅ 버튼 텍스트를 "영업KC 기본/알림 설정 수정"으로 변경');
        }

        // 힌트 텍스트도 변경
        const newKcHint = document.getElementById('newKcHint');
        if (newKcHint) {
            newKcHint.textContent = '수정된 설정을 Supabase에 저장합니다';
        }

        // localStorage 초기화 (기존 데이터 제거)
        localStorage.removeItem('apartmentName');
        localStorage.removeItem('entryIssue');
        localStorage.removeItem('agencyName');
        localStorage.removeItem('savedEmailAddresses');
        localStorage.removeItem('savedPhoneNumbers');

        // QR 데이터를 localStorage에 저장
        if (qrData.apartment_name) {
            localStorage.setItem('apartmentName', qrData.apartment_name);
            currentApartmentName = qrData.apartment_name;
            console.log('✅ QR 로드 시 currentApartmentName 업데이트:', currentApartmentName);
        }
        if (qrData.entry_issue) {
            localStorage.setItem('entryIssue', qrData.entry_issue);
        }
        if (qrData.agency_name) {
            localStorage.setItem('agencyName', qrData.agency_name);
        }
        if (qrData.emails && Array.isArray(qrData.emails)) {
            localStorage.setItem('savedEmailAddresses', JSON.stringify(qrData.emails));
        }
        if (qrData.phones && Array.isArray(qrData.phones)) {
            localStorage.setItem('savedPhoneNumbers', JSON.stringify(qrData.phones));
        }

        // STEP 1 화면 업데이트
        const apartmentNameDisplay = document.getElementById('apartmentNameDisplay');
        const entryIssueDisplay = document.getElementById('entryIssueDisplay');
        const agencyNameDisplay = document.getElementById('agencyNameDisplay');

        if (apartmentNameDisplay) {
            apartmentNameDisplay.textContent = qrData.apartment_name || '';
            if (qrData.apartment_name) {
                apartmentNameDisplay.classList.add('has-content');
            } else {
                apartmentNameDisplay.classList.remove('has-content');
            }
        }

        if (entryIssueDisplay) {
            entryIssueDisplay.textContent = qrData.entry_issue || '';
            if (qrData.entry_issue) {
                entryIssueDisplay.classList.add('has-content');
            } else {
                entryIssueDisplay.classList.remove('has-content');
            }
        }

        if (agencyNameDisplay) {
            agencyNameDisplay.textContent = qrData.agency_name || '';
            if (qrData.agency_name) {
                agencyNameDisplay.classList.add('has-content');
            } else {
                agencyNameDisplay.classList.remove('has-content');
            }
        }

        // STEP 2 화면 업데이트
        displaySavedInputs();

        // STEP 3에 QR 이미지 복사
        const qrListInCard = document.getElementById('qrListInCard');
        if (qrListInCard && qrData.qr_url) {
            // 기존 QR 제거
            qrListInCard.innerHTML = '';

            // QR 카드 생성
            const qrCardHtml = `
                <div class="qr-card" data-qr-id="${qrData.id}">
                    <div class="qr-card-header">
                        <div class="qr-card-title">
                            <span class="qr-name">${qrData.qr_name}</span>
                            <span class="qr-status ${qrData.is_active ? 'active' : 'inactive'}">
                                ${qrData.is_active ? '활성' : '비활성'}
                            </span>
                        </div>
                    </div>
                    <div class="qr-code-preview" id="qr-preview-step3-${qrData.id}"></div>
                </div>
            `;
            qrListInCard.innerHTML = qrCardHtml;

            // QR 컨테이너 표시
            const qrListContainer = document.getElementById('qrListContainer');
            if (qrListContainer) {
                qrListContainer.style.display = 'block';
            }

            // QR 코드 생성
            const previewDiv = document.getElementById(`qr-preview-step3-${qrData.id}`);
            if (previewDiv) {
                try {
                    new QRCode(previewDiv, {
                        text: qrData.qr_url,
                        width: 200,
                        height: 200,
                        colorDark: "#000000",
                        colorLight: "#FFFFFF",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    console.log('✅ STEP 3에 QR 코드 복사 완료');
                } catch (error) {
                    console.error('❌ QR 미리보기 생성 실패:', error);
                    previewDiv.innerHTML = '<p style="color: #999;">미리보기 생성 실패</p>';
                }
            }
        }

        // 현재 편집 중인 QR ID를 저장 (나중에 저장할 때 사용)
        localStorage.setItem('currentEditingQRId', qrId);

        // STEP 1 카드로 스크롤
        const featuresSection = document.querySelector('.features-section');
        if (featuresSection) {
            featuresSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            // STEP 1 카드 하이라이트 효과
            const step1Card = document.querySelector('.feature-card.step-card');
            if (step1Card) {
                step1Card.style.transition = 'all 0.3s ease';
                step1Card.style.boxShadow = '0 0 30px rgba(76, 175, 80, 0.6)';
                step1Card.style.transform = 'scale(1.02)';

                setTimeout(() => {
                    step1Card.style.boxShadow = '';
                    step1Card.style.transform = '';
                }, 1500);
            }
        }

        console.log('✅ QR 설정 불러오기 완료');

    } catch (error) {
        console.error('❌ QR 설정 불러오기 중 오류:', error);
        alert(`QR 설정을 불러오는데 실패했습니다:\n${error.message}`);
    }
}

// 수정된 관리자 설정 저장 (편집 모드 전용)
async function saveAdminSettingsFromEdit() {
    try {
        console.log('💾 수정된 관리자 설정 저장 시작');

        // 현재 편집 중인 QR ID 확인
        const currentEditingQRId = localStorage.getItem('currentEditingQRId');

        if (!currentEditingQRId) {
            console.error('❌ 편집 중인 QR ID가 없습니다.');
            alert('편집 중인 QR 코드 정보를 찾을 수 없습니다.');
            return;
        }

        // localStorage에서 데이터 수집
        const apartmentName = localStorage.getItem('apartmentName') || '';
        const entryIssue = localStorage.getItem('entryIssue') || '';
        const agencyName = localStorage.getItem('agencyName') || '';
        const emails = JSON.parse(localStorage.getItem('savedEmailAddresses') || '[]');
        const phones = JSON.parse(localStorage.getItem('savedPhoneNumbers') || '[]');

        // 확인 다이얼로그
        const confirmMessage = `다음 내용으로 저장하시겠습니까?\n\n` +
            `아파트명: ${apartmentName || '(없음)'}\n` +
            `진입 테마: ${entryIssue || '(없음)'}\n` +
            `영업 KC: ${agencyName || '(없음)'}\n` +
            `이메일: ${emails.length}개\n` +
            `전화번호: ${phones.length}개`;

        if (!confirm(confirmMessage)) {
            console.log('💡 사용자가 저장을 취소했습니다.');
            return;
        }

        // Supabase에 저장 (기존 saveAdminSettingsToCloud 함수 활용)
        await saveAdminSettingsToCloud();

        // QR 코드 테이블도 업데이트 (해당 QR의 정보 동기화)
        if (supabase) {
            console.log(`🔄 QR 코드 테이블 업데이트 중... ID: ${currentEditingQRId}`);
            console.log('📝 업데이트할 데이터:', {
                apartment_name: apartmentName,
                entry_issue: entryIssue,
                agency_name: agencyName,
                emails: emails,
                phones: phones
            });

            const { error: qrUpdateError } = await supabase
                .from('qr_codes')
                .update({
                    apartment_name: apartmentName,
                    entry_issue: entryIssue,
                    agency_name: agencyName,
                    emails: emails,
                    phones: phones
                })
                .eq('id', currentEditingQRId);

            if (qrUpdateError) {
                console.error('❌ QR 코드 정보 업데이트 실패:', qrUpdateError);
                alert(`QR 코드 정보 업데이트 실패:\n${qrUpdateError.message}\n\n관리자 설정은 저장되었습니다.`);
            } else {
                console.log('✅ QR 코드 정보 업데이트 성공');
            }
        }

        // 성공 메시지
        alert('✅ 설정이 성공적으로 저장되었습니다!');

        // 편집 모드 종료 - 버튼 텍스트 원래대로 복원
        localStorage.removeItem('currentEditingQRId');

        const newKcRegisterBtn = document.getElementById('newKcRegisterBtn');
        if (newKcRegisterBtn) {
            const btnText = newKcRegisterBtn.querySelector('.btn-text');
            const btnIcon = newKcRegisterBtn.querySelector('.btn-icon');
            if (btnText) {
                btnText.textContent = '신규 영업 KC 등록';
            }
            if (btnIcon) {
                btnIcon.textContent = '✨';
            }
            console.log('✅ 버튼 텍스트를 "신규 영업 KC 등록"으로 복원');
        }

        // 힌트 텍스트도 복원
        const newKcHint = document.getElementById('newKcHint');
        if (newKcHint) {
            newKcHint.textContent = '새로운 QR을 만드세요';
        }

        // QR 목록 새로고침
        await loadQRList();

        // 랜딩 페이지 상단으로 스크롤
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        console.log('✅ 관리자 설정 저장 완료');

    } catch (error) {
        console.error('❌ 관리자 설정 저장 중 오류:', error);
        alert(`설정 저장 중 오류가 발생했습니다:\n${error.message}`);
    }
}

// 전역 함수로 노출
window.showQRNameModal = showQRNameModal;
window.closeQRNameModal = closeQRNameModal;
window.createNewQR = createNewQR;
window.loadQRList = loadQRList;
window.downloadQRCode = downloadQRCode;
window.deleteQRCode = deleteQRCode;
window.toggleQRActive = toggleQRActive;
window.loadQRForEdit = loadQRForEdit;
window.saveAdminSettingsFromEdit = saveAdminSettingsFromEdit;