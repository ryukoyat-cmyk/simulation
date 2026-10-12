import { GEMINI_VOICE_CHOICES, geminiVoiceFor, normalizeGender, normalizePersona, normalizeTone, openaiInstructions, openaiVoiceFor } from "./_voice_profiles.js";
import { tryGemini } from "./_tts.js";
import { describeNetworkError, errorResponse, getEnv, json, readJson, toUserFacingError } from "./_shared.js";

const MAX_INPUT_CHARS = 800;
const FALLBACK_VOICE = "alloy";

// 목소리·연기 설계는 _voice_profiles.js에 있습니다(유형 × 성별 음성, 연기 프로필, 턴별 강도).
export { GEMINI_VOICE_CHOICES as GEMINI_VOICES_BY_GENDER } from "./_voice_profiles.js";
export { GEMINI_VOICES, pcmToWav } from "./_tts.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  // 오디션 페이지가 현재 유형별 음성 배정과 후보 목록을 읽어 가는 용도입니다(키 값은 노출하지 않음).
  if (body?.describe) {
    const types = ["cooperative", "anxious", "avoidant", "demanding", "pressure"];
    const pick = (fn) => Object.fromEntries(["female", "male"].map((g) => [g, Object.fromEntries(types.map((t) => [t, fn(g, t)]))]));
    return json({ gemini: pick(geminiVoiceFor), openai: pick(openaiVoiceFor), choices: GEMINI_VOICE_CHOICES, geminiConfigured: Boolean(getEnv("GEMINI_API_KEY")) });
  }
  const text = String(body?.text || "").trim().slice(0, MAX_INPUT_CHARS);
  if (!text) return json({ error: "text is required" }, 400);

  // 목소리가 섞이지 않게 공급자를 "고정"합니다.
  //  - TTS_PROVIDER=gemini|openai 이면 서버 전체가 그 공급자만 씁니다(권장: 오디션 뒤에 하나로 확정).
  //  - 설정하지 않으면(auto) 한 통화의 첫 발화에서 성공한 공급자로 클라이언트가 고정해 보냅니다(body.provider).
  //  - 고정된 공급자가 실패해도 다른 공급자로 넘기지 않고 같은 공급자로 다시 시도한 뒤 오류를 돌려줍니다.
  //    (넘기면 한 통화 안에서 다른 사람 목소리가 섞여 들립니다.)
  const policy = String(getEnv("TTS_PROVIDER") || "auto").toLowerCase();
  const clientPin = ["gemini", "openai"].includes(String(body?.provider || "")) ? String(body.provider) : "";
  const pinned = ["gemini", "openai"].includes(policy) ? policy : clientPin;
  const started = Date.now();
  const budgetMs = Number(getEnv("TTS_BUDGET_MS")) || 9000; // 서버리스 함수 제한 시간 안에 끝내기 위한 총 예산
  let geminiError;
  if (pinned !== "openai") {
    if (!getEnv("GEMINI_API_KEY")) {
      if (pinned === "gemini") return json({ error: "GEMINI_API_KEY is not configured.", provider: "gemini", pinned: true }, 500);
    } else {
      let gemini;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const remaining = budgetMs - (Date.now() - started);
        if (attempt > 0 && remaining < 2500) break; // 남은 시간이 없으면 더 시도하지 않습니다.
        gemini = await tryGemini({ text, body, timeoutMs: Math.min(Number(getEnv("GEMINI_TIMEOUT_MS")) || 8000, remaining) });
        if (gemini?.audio || !gemini?.retryable) break;
      }
      if (gemini?.audio) return json(gemini);
      geminiError = gemini?.error;
      if (pinned === "gemini") {
        return json({ error: "학부모 음성 합성이 지연되고 있습니다. 같은 목소리를 유지하려고 다른 음성으로 바꾸지 않았습니다. 잠시 뒤 다시 재생해 주세요.", provider: "gemini", pinned: true, geminiError }, 503);
      }
    }
  }

  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY is not configured." }, 500);

  const persona = normalizePersona(String(body?.parentId || ""));
  const gender = normalizeGender(body?.gender);
  const tone = normalizeTone(body?.tone);
  const variant = body?.promptVariant === "legacy" ? "legacy" : "rich";
  const model = getEnv("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts";
  // 음성은 유형 × 성별로 서버가 정합니다. body.voice는 오디션 페이지에서 직접 고를 때만 씁니다.
  const voice = String(body?.audition ? (body?.openaiVoice || "") : "") || openaiVoiceFor(gender, persona);
  const instructions = openaiInstructions({ gender, persona, tone, variant });

  try {
    let result = await requestSpeech({ apiKey, model, voice, text, instructions });
    // 배포 환경마다 지원 음색이 달라 400이 날 수 있으므로 기본 음색으로 한 번 더 시도합니다.
    if (!result.ok && result.status === 400 && voice !== FALLBACK_VOICE) {
      result = await requestSpeech({ apiKey, model, voice: FALLBACK_VOICE, text, instructions });
    }
    if (!result.ok) return json({ error: toUserFacingError(result.status, result.error).message }, result.status || 502);
    return json({ audio: result.audio, mime: "audio/mpeg", provider: "openai", voice, ...(geminiError ? { geminiError } : {}), ...(body?.debug ? { prompt: instructions } : {}) });
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
