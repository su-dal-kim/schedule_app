// Vercel Serverless Function
// 클라이언트에서 이미지(base64)를 받아 Google Gemini Vision API로 분석하고
// 구조화된 JSON 스케줄 데이터를 반환합니다. API 키는 서버 환경변수에만 존재하며
// 브라우저로 절대 노출되지 않습니다.

const PROMPT = `첨부된 이미지는 한국어 근무 스케줄 앱 화면 캡처야. 화면에 보이는 월요일부터 일요일까지의 표를 한 글자도 빠짐없이 정확하게 읽어서 아래 JSON 스키마 그대로, 오직 JSON 하나만 출력해줘. 코드블록(백틱)이나 설명 문장, 인사말은 절대 넣지 마. JSON 앞뒤에 아무 글자도 붙이지 마.

주의사항:
- "P"와 "R" 아이콘은 각각 계획/실적 표시일 뿐이니 무시하고, 시간과 텍스트 값만 정확히 옮겨 적어.
- 출근/퇴근 시간은 화면에 보이는 숫자 그대로 (예: 08:30) 적어. 임의로 반올림하거나 추측하지 마.
- 화면 상단의 기간 텍스트(예: 08.31~09.06)를 공백 없이 그대로 weekRange에 적어.
- days 배열은 화면에 보이는 요일 행을 위에서부터 순서대로, 개수도 정확히 일치시켜서 전부 포함해.
- 정규휴일처럼 시간이 없는 날은 checkIn/checkOut을 null로, holiday를 true로 표시해.

스키마:
{
  "weekRange": string,
  "days": [
    {
      "date": "MM/DD",
      "dayOfWeek": "월|화|수|목|금|토|일",
      "checkIn": "HH:MM" 또는 null,
      "checkOut": "HH:MM" 또는 null,
      "status": string 또는 null,
      "holiday": boolean,
      "holidayLabel": string 또는 null
    }
  ]
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원해요." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버에 GEMINI_API_KEY가 설정되지 않았어요." });
    return;
  }

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) {
    res.status(400).json({ error: "이미지 데이터(base64, mediaType)가 필요해요." });
    return;
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mediaType, data: base64 } },
              ],
            },
          ],
        }),
      }
    );

    const geminiJson = await geminiRes.json();

    if (!geminiRes.ok) {
      const detail = geminiJson?.error?.message || JSON.stringify(geminiJson);
      res.status(geminiRes.status).json({ error: `Gemini API 오류: ${detail}` });
      return;
    }

    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: "Gemini 응답에서 텍스트를 찾을 수 없어요." });
      return;
    }

    let cleaned = text.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      res.status(502).json({ error: "이미지에서 근무표를 읽어내지 못했어요. 더 선명한 캡처로 다시 시도해줄래요?" });
      return;
    }

    res.status(200).json({ data: parsed });
  } catch (err) {
    res.status(500).json({ error: `서버 오류: ${err.message || err}` });
  }
}
