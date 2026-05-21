// auth.js — Supabase Auth + user_profiles 헬퍼
// 모든 로그인/가입/세션/권한 로직을 여기 모음
//
// 사용 전 supabase-js CDN과 supabase-config.js가 먼저 로드되어 있어야 함

(function () {
    'use strict';

    const SUPABASE_URL = 'https://boorsqnfkwglzvnhtwcx.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb3JzcW5ma3dnbHp2bmh0d2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDE3NDEsImV4cCI6MjA3MjExNzc0MX0.eU0BSY8u1b-qcx3OTgvGIW-EQHotI4SwNuWAg0eqed0';

    // supabase-config.js가 이미 클라이언트를 만들었으면 재사용, 없으면 직접 생성
    function getClient() {
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
            return window.supabaseClient;
        }
        if (window.supabase && typeof window.supabase.from === 'function') {
            return window.supabase;
        }
        // landing.html 등 supabase-config.js를 안 쓰는 페이지에서 직접 만들 수 있도록
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            window.supabaseClient = client;
            return client;
        }
        return null;
    }

    async function waitForClient(timeoutMs = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const c = getClient();
            if (c) return c;
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error('Supabase 클라이언트 로드 실패');
    }

    // ─────────── 가입 ───────────
    // payload: { email, password, agencyName, displayName, phone }
    // user_profiles 행은 auth.users INSERT 트리거(handle_new_user_signup)가 자동 생성한다.
    async function signUp(payload) {
        const client = await waitForClient();
        const { email, password, agencyName, displayName, phone } = payload;
        if (!email || !password || !agencyName || !displayName || !phone) {
            throw new Error('필수 항목을 모두 입력하세요');
        }

        // auth.users 생성 + 메타데이터 전달
        // 트리거가 raw_user_meta_data를 읽어 user_profiles에 pending 행을 만든다.
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    agency_name: agencyName,
                    display_name: displayName,
                    phone: phone
                }
            }
        });
        if (error) throw error;
        if (!data.user) throw new Error('가입 처리 중 오류');

        return { user: data.user };
    }

    // ─────────── 로그인 ───────────
    async function signIn(email, password) {
        const client = await waitForClient();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    }

    async function signOut() {
        const client = await waitForClient();
        const { error } = await client.auth.signOut();
        if (error) throw error;
        try { sessionStorage.clear(); } catch (e) {}
    }

    // ─────────── 세션/프로필 ───────────
    async function getSession() {
        const client = await waitForClient();
        const { data } = await client.auth.getSession();
        return data.session;
    }

    async function getProfile() {
        const client = await waitForClient();
        const session = await getSession();
        if (!session) return null;
        const { data, error } = await client
            .from('user_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
        if (error) {
            console.error('getProfile 실패:', error);
            return null;
        }
        return data;
    }

    // ─────────── 권한 가드 ───────────
    // allowed: ['super_admin','agency_admin'] 또는 단일 문자열
    // 사용처: 페이지 진입 직후 호출. 권한 없으면 자동 리다이렉트 후 null 반환
    async function requireAuth(allowed) {
        const session = await getSession();
        if (!session) {
            location.href = 'login.html?next=' + encodeURIComponent(location.pathname + location.search);
            return null;
        }
        const profile = await getProfile();
        if (!profile) {
            alert('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
            await signOut();
            location.href = 'login.html';
            return null;
        }
        if (profile.status === 'pending') {
            location.href = 'login.html?status=pending';
            return null;
        }
        if (profile.status === 'rejected') {
            location.href = 'login.html?status=rejected';
            return null;
        }
        if (allowed) {
            const roles = Array.isArray(allowed) ? allowed : [allowed];
            if (!roles.includes(profile.role)) {
                alert('접근 권한이 없습니다');
                location.href = profile.role === 'super_admin'
                    ? 'landing.html'
                    : 'index.html?apt=' + encodeURIComponent(profile.apartment_id || '');
                return null;
            }
        }
        return { session, profile };
    }

    // ─────────── 본사 전용 ───────────
    async function listPendingProfiles() {
        const client = await waitForClient();
        const { data, error } = await client
            .from('user_profiles')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async function approveProfile(userId) {
        const client = await waitForClient();
        const session = await getSession();
        const { error } = await client
            .from('user_profiles')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: session ? session.user.id : null
            })
            .eq('user_id', userId);
        if (error) throw error;
    }

    async function rejectProfile(userId) {
        const client = await waitForClient();
        const { error } = await client
            .from('user_profiles')
            .update({ status: 'rejected' })
            .eq('user_id', userId);
        if (error) throw error;
    }

    // 승인된 대리점 카드 목록 (landing.html이 super_admin 로그인 시 사용)
    async function listApprovedAgencies() {
        const client = await waitForClient();
        const { data, error } = await client
            .from('user_profiles')
            .select('apartment_id, agency_name, display_name, phone, email')
            .eq('status', 'approved')
            .eq('role', 'agency_admin')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    // 외부 노출
    window.Auth = {
        signUp,
        signIn,
        signOut,
        getSession,
        getProfile,
        requireAuth,
        listPendingProfiles,
        approveProfile,
        rejectProfile,
        listApprovedAgencies
    };
})();
