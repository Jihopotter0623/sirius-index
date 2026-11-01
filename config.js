// 앱이 처음 열릴 때 부르는 설정 주소 (/api/config).
// Supabase 주소와 공개(anon) 키는 브라우저에 보여도 되는 값이고,
// 실제 권한은 Supabase의 행 수준 보안(RLS) 규칙이 막습니다.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(200).json({ ok: false, reason: 'SUPABASE_URL 또는 SUPABASE_ANON_KEY 환경 변수가 없습니다' });
    return;
  }
  res.status(200).json({
    ok: true,
    supabaseUrl,
    supabaseAnonKey,
    gemini: Boolean(process.env.GEMINI_API_KEY),
  });
};
