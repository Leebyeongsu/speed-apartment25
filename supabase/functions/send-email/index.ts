import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_H7vyH8SR_CrDDHFWsrHAzKyizxYRDWibb'

    const body = await req.json()
    const { applicationData, recipientEmails, apartmentName } = body

    if (!applicationData || !recipientEmails || recipientEmails.length === 0) {
      throw new Error('필수 파라미터가 누락되었습니다.')
    }

    const emails = recipientEmails.slice(0, 5)

    const submittedRaw = applicationData.submitted_at || applicationData.submittedAt || new Date().toISOString()
    const submittedDate = new Date(submittedRaw)
    const formattedDate = submittedDate.toLocaleString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', weekday: 'long',
      timeZone: 'Asia/Seoul'
    })

    const appName = apartmentName || 'Speed 아파트'
    const appNumber = applicationData.application_number || submittedRaw.slice(0, 16).replace(/[-T:]/g, '')

    const providerMap: Record<string, string> = {
      interior: 'KT',
      exterior: 'SKT',
      plumbing: 'LGU+',
      electrical: '기타(지역방송)',
    }
    const telecom = applicationData.work_type_display
      || providerMap[applicationData.workType]
      || providerMap[applicationData.work_type]
      || applicationData.workType
      || '미상'

    const hopeDate = applicationData.startDate || applicationData.start_date || '미지정'
    const description = applicationData.description || '없음'

    const htmlBody = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:8px;background:#f4f4f4;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <h2 style="margin:0 0 2px;font-size:15px;color:#2e7d32;">안녕하세요, 매니저님</h2>
    <p style="margin:0 0 10px;font-size:12px;color:#555;">새로운 통신환경개선 신청서가 접수되었습니다.</p>

    <div style="background:#f9f9f9;border-left:3px solid #4CAF50;border-radius:4px;padding:10px 12px;margin-bottom:12px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#333;">■ 신청 정보</p>
      <ul style="margin:0;padding-left:0;list-style:none;font-size:12px;color:#333;line-height:1.7;">
        <li>• <strong>신청번호:</strong> ${appNumber}</li>
        <li>• <strong>동/호수:</strong> ${applicationData.name || '미입력'}</li>
        <li>• <strong>연락처:</strong> ${applicationData.phone || '미입력'}</li>
        <li>• <strong>통신사:</strong> ${telecom}</li>
        <li style="color:#c62828;">• <strong>공사 희망일:</strong> <strong>${hopeDate}</strong></li>
        <li>• <strong>요청사항:</strong> ${description}</li>
        <li>• <strong>접수일시:</strong> ${formattedDate}</li>
      </ul>
    </div>

    <p style="margin:0 0 2px;font-size:12px;color:#333;">매니저님 빠른 연락바랍니다. 감사합니다.</p>

    <p style="margin:8px 0 0;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:8px;">
      이 메일은 ${appName} 신청 시스템에서 자동 발송되었습니다.
    </p>
  </div>
</body>
</html>`

    // Resend API 레이트 제한 회피: 순차 발송 (1초 간격)
    const results = []
    for (const email of emails) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: '신청알림 <noreply@mail.hhofutures.store>',
            to: [email],
            subject: `[${appName}] 새 통신환경 개선 신청 - ${applicationData.name || ''} (${appNumber})`,
            html: htmlBody,
          }),
        })

        const result = await res.json()
        if (!res.ok) {
          console.error(`발송 실패 (${email}):`, result)
          results.push({ email, success: false, error: result })
        } else {
          console.log(`발송 성공 (${email}):`, result.id)
          results.push({ email, success: true, id: result.id })
        }
      } catch (error) {
        console.error(`발송 예외 (${email}):`, error)
        results.push({ email, success: false, error: error.message })
      }

      // Resend 레이트 제한 회피: 다음 요청 전 1.5초 대기
      if (email !== emails[emails.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }

    const successCount = results.filter(r => r.success).length

    return new Response(
      JSON.stringify({ success: true, sent: successCount, total: emails.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Edge Function 오류:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
