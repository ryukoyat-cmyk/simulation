import { describeNetworkError, errorResponse, getEnv, json, readJson, toUserFacingError } from "./_shared.js";

const MAX_INPUT_CHARS = 800;
const FALLBACK_VOICE = "alloy";

// gpt-4o-mini-tts는 instructions로 낭독 톤을 조절할 수 있습니다.
// 학부모 유형별 감정 강도를 첫 발화부터 음성으로 드러내기 위해 사용합니다.
const deliveryByPersona = {
  cooperative: "정중하고 차분한 중년 학부모의 목소리로, 또박또박 예의 있게 말합니다.",
  anxious: "걱정이 묻어나는 조심스러운 목소리로, 살짝 떨리듯 천천히 말합니다.",
  avoidant: "감정을 눌러 담은 낮고 짧은 말투로, 거리감 있게 담담히 말합니다.",
  demanding: "단호하고 또렷한 목소리로, 요구 사항을 분명하게 끊어 말합니다.",
  pressure: "감정이 격앙된 빠른 말투로, 강하게 압박하듯 말합니다. 다만 소리를 지르지는 않습니다."
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  const text = String(body?.text || "").trim().slice(0, MAX_INPUT_CHARS);
  if (!text) return json({ error: "text is required" }, 400);

  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY is not configured." }, 500);

  const model = getEnv("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts";
  const voice = String(body?.voice || getEnv("OPENAI_TTS_VOICE") || "coral");
  const instructions = deliveryByPersona[String(body?.parentId || "")] || deliveryByPersona.cooperative;

  try {
    let result = await requestSpeech({ apiKey, model, voice, text, instructions });
    // 배포 환경마다 지원 음색이 달라 400이 날 수 있으므로 기본 음색으로 한 번 더 시도합니다.
    if (!result.ok && result.status === 400 && voice !== FALLBACK_VOICE) {
      result = await requestSpeech({ apiKey, model, voice: FALLBACK_VOICE, text, instructions });
    }
    if (!result.ok) return json({ error: toUserFacingError(result.status, result.error).message }, result.status || 502);
    return json({ audio: result.audio, mime: "audio/mpeg" });
  } catch (error) {
    return errorResponse(error, "학부모 음성을 합성하지 못했습니다.");
  }
};

async function requestSpeech({ apiKey, model, voice, text, instructions }) {
  const timeoutMs = Number(getEnv("OPENAI_TIMEOUT_MS")) || 25000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input: text, instructions, response_format: "mp3" }),
      signal: controller.signal
    });
  } catch (error) {
    throw describeNetworkError(error, "음성 합성 서비스", timeoutMs);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text();
    let message = detail;
    try { message = JSON.parse(detail).error?.message || detail; } catch { /* 원문 유지 */ }
    return { ok: false, status: res.status, error: message };
  }

  const buffer = await res.arrayBuffer();
  return { ok: true, audio: Buffer.from(buffer).toString("base64") };
}

export const config = { path: "/api/speak", method: ["POST"] };
