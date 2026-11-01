// Play Well 위젯의 AI 추천을 서버에서 대신 불러 주는 주소 (/api/gemini).
// Gemini API 키는 Vercel 환경 변수에만 있고 팀원 브라우저에는 보내지 않습니다.
// 로그인한 팀원만 쓸 수 있도록, 요청마다 Supabase 로그인 토큰을 확인합니다.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 받습니다' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(503).json({ error: '서버에 GEMINI_API_KEY 환경 변수가 없습니다' });
    return;
  }

  // 1) 로그인한 팀원인지 확인
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || !url || !anon) {
    res.status(401).json({ error: '로그인이 필요합니다' });
    return;
  }
  try {
    const who = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', { headers: { Authorization: auth, apikey: anon } });
    if (!who.ok) {
      res.status(401).json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' });
      return;
    }
  } catch (e) {
    res.status(502).json({ error: '로그인 확인 서버에 연결하지 못했습니다' });
    return;
  }

  // 2) 요청 내용
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const prompt = String((body && body.prompt) || '').slice(0, 8000);
  if (!prompt) {
    res.status(400).json({ error: '요청 내용이 비었습니다' });
    return;
  }

  // 3) Gemini 호출
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
        }),
      }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(502).json({ error: 'Gemini 오류: ' + ((data.error && data.error.message) || 'HTTP ' + r.status) });
      return;
    }
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map((p) => p.text || '').join('');
    if (!text) {
      res.status(502).json({ error: 'Gemini가 빈 답을 보냈어요. 요청을 바꿔 다시 시도해 주세요.' });
      return;
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: 'Gemini 서버에 연결하지 못했습니다' });
  }
};
