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
  pressure: "화가 잔뜩 난 채 빠르고 날카롭게 몰아붙이는 말투로, 언성이 높고 말끝을 세게 끊어 말합니다. " +
    "다만 욕설이나 실제 위협이 되는 말은 하지 않습니다."
};

// Gemini TTS는 말투를 영어 지시문으로 주는 쪽이 안정적이라 유형별 연기 지시를 따로 둡니다.
const geminiStyleByPersona = {
  cooperative: "politely and calmly, like a courteous middle-aged parent, speaking clearly",
  anxious: "in a worried, hesitant, slightly trembling voice, a bit slowly",
  avoidant: "in a low, flat, guarded tone with short phrases and emotional distance",
  demanding: "firmly and crisply, in a logical tone, pausing between each demand",
  pressure: "angrily, fast and sharp, with a raised voice and hard stops at the end of sentences"
};
// 오디션 페이지에서 고를 수 있는 Gemini 음성 이름입니다. 최종 기본값은 환경변수로 정합니다.
export const GEMINI_VOICES = ["Kore", "Aoede", "Leda", "Zephyr", "Callirrhoe", "Charon", "Orus", "Fenrir", "Puck", "Algieba"];
const GEMINI_DEFAULT_VOICE = { female: "Kore", male: "Orus" };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  const text = String(body?.text || "").trim().slice(0, MAX_INPUT_CHARS);
  if (!text) return json({ error: "text is required" }, 400);

  // Gemini 키가 있으면 먼저 시도하고, 없거나 실패하면 아래 OpenAI 경로로 넘어갑니다.
  const gemini = await tryGemini({ text, body });
  if (gemini) return json(gemini);

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

async function tryGemini({ text, body }) {
  const key = getEnv("GEMINI_API_KEY");
  if (!key) return null;
  const gender = body?.gender === "male" ? "male" : "female";
  const requested = String(body?.geminiVoice || "");
  const voiceName = GEMINI_VOICES.includes(requested) ? requested : (getEnv(gender === "male" ? "GEMINI_TTS_VOICE_MALE" : "GEMINI_TTS_VOICE_FEMALE") || GEMINI_DEFAULT_VOICE[gender]);
  const style = geminiStyleByPersona[String(body?.parentId || "")] || geminiStyleByPersona.cooperative;
  const model = getEnv("GEMINI_TTS_MODEL") || "gemini-2.5-flash-preview-tts";
  const timeoutMs = Number(getEnv("GEMINI_TIMEOUT_MS")) || 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say in Korean, ${style}: ${text}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } }
      }),
      signal: controller.signal
    });
    if (!res.ok) { console.error("Gemini TTS failed:", res.status, (await res.text()).slice(0, 300)); return null; }
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) { console.error("Gemini TTS returned no audio"); return null; }
    const wav = pcmToWav(Buffer.from(part.inlineData.data, "base64"), 24000);
    return { audio: wav.toString("base64"), mime: "audio/wav", provider: "gemini", voice: voiceName };
  } catch (error) {
    console.error("Gemini TTS error:", error?.name === "AbortError" ? "timeout" : error?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
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
