import { GEMINI_VOICE_CHOICES, geminiPrompt, geminiVoiceFor, normalizeGender, normalizePersona, normalizeTone, openaiInstructions, openaiVoiceFor } from "./_voice_profiles.js";
import { describeNetworkError, errorResponse, getEnv, json, readJson, toUserFacingError } from "./_shared.js";

const MAX_INPUT_CHARS = 800;
const FALLBACK_VOICE = "alloy";

// 목소리·연기 설계는 _voice_profiles.js에 있습니다(유형 × 성별 음성, 연기 프로필, 턴별 강도).
export { GEMINI_VOICE_CHOICES as GEMINI_VOICES_BY_GENDER } from "./_voice_profiles.js";
export const GEMINI_VOICES = [...new Set(Object.values(GEMINI_VOICE_CHOICES).flat())];

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

  // Gemini 키가 있으면 먼저 시도하고, 없거나 실패하면 아래 OpenAI 경로로 넘어갑니다.
  // 클라이언트가 openai로 고정했다면(같은 통화에서 목소리가 바뀌지 않게) Gemini를 건너뜁니다.
  // Gemini가 일시 오류로 실패하면 다른 목소리로 바꾸기 전에 한 번 더 시도합니다.
  let geminiError;
  if (String(body?.provider || "") !== "openai") {
    let gemini = await tryGemini({ text, body });
    if (!gemini?.audio && gemini?.retryable) gemini = await tryGemini({ text, body });
    if (gemini?.audio) return json(gemini);
    geminiError = gemini?.error;
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

// 모델 이름은 자주 바뀌므로 환경변수를 먼저 쓰고, 없는 모델(404)이면 알려진 후보를 차례로 시도합니다.
const GEMINI_MODEL_CANDIDATES = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts"];
let workingGeminiModel = "";

async function tryGemini({ text, body }) {
  const key = getEnv("GEMINI_API_KEY");
  if (!key) return null;
  const gender = normalizeGender(body?.gender);
  const persona = normalizePersona(String(body?.parentId || ""));
  const tone = normalizeTone(body?.tone);
  const variant = body?.promptVariant === "legacy" ? "legacy" : "rich";
  const requested = String(body?.audition ? (body?.geminiVoice || "") : "");
  const voiceName = GEMINI_VOICES.includes(requested) ? requested : geminiVoiceFor(gender, persona);
  const prompt = geminiPrompt({ gender, persona, tone, text, variant });
  const models = [...new Set([getEnv("GEMINI_TTS_MODEL"), workingGeminiModel, ...GEMINI_MODEL_CANDIDATES].filter(Boolean))];
  const timeoutMs = Number(getEnv("GEMINI_TIMEOUT_MS")) || 8000;
  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } }
        }),
        signal: controller.signal
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        lastError = `${model}: HTTP ${res.status} ${detail}`;
        console.error("Gemini TTS failed:", lastError);
        // 모델 이름 문제(404)만 다음 후보로 넘어가고, 키·할당량·형식 문제는 바로 중단합니다.
        if (res.status === 404) continue;
        return { error: lastError, retryable: res.status >= 500 };
      }
      const data = await res.json();
      const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) { lastError = `${model}: no audio in response`; console.error("Gemini TTS returned no audio"); continue; }
      workingGeminiModel = model;
      const wav = pcmToWav(Buffer.from(part.inlineData.data, "base64"), 24000);
      return { audio: wav.toString("base64"), mime: "audio/wav", provider: "gemini", voice: voiceName, model, ...(body?.debug ? { prompt } : {}) };
    } catch (error) {
      lastError = `${model}: ${error?.name === "AbortError" ? "timeout" : error?.message}`;
      console.error("Gemini TTS error:", lastError);
      return { error: lastError, retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }
  return { error: lastError || "no Gemini model available" };
}

// Gemini는 헤더 없는 16비트 모노 PCM을 돌려주므로 브라우저가 재생할 수 있게 WAV 헤더를 붙입니다.
export function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

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
