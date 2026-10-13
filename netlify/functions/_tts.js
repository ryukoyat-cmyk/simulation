// 음성 합성 공용 코드(Gemini 호출, PCM→WAV). /api/speak와 /api/speak-stream이 함께 씁니다.
import { GEMINI_VOICE_CHOICES, geminiPrompt, geminiVoiceFor, normalizeGender, normalizePersona, normalizeTone } from "./_voice_profiles.js";
import { getEnv } from "./_shared.js";

export const GEMINI_VOICES = [...new Set(Object.values(GEMINI_VOICE_CHOICES).flat())];

// 모델 이름은 자주 바뀌므로 환경변수를 먼저 쓰고, 없는 모델(404)이면 알려진 후보를 차례로 시도합니다.
const GEMINI_MODEL_CANDIDATES = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts"];
let workingGeminiModel = "";

export async function tryGemini({ text, body, timeoutMs: timeoutOverride }) {
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
  const timeoutMs = timeoutOverride || Number(getEnv("GEMINI_TIMEOUT_MS")) || 8000;
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

