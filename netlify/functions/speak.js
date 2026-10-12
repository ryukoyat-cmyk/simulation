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
// 한 통화의 모든 발화가 같은 사람처럼 들리도록, 발화마다 달라지는 것은 대사뿐이고 인물 설정·속도는 고정합니다.
const geminiPaceByPersona = { cooperative: "moderate and steady", anxious: "slightly slow with small hesitations", avoidant: "slow and flat with short pauses", demanding: "measured and crisp", pressure: "fast and clipped" };
function geminiPrompt({ gender, style, parentId, text }) {
  const who = gender === "male" ? "a father in his early 40s" : "a mother in her early 40s";
  const pace = geminiPaceByPersona[parentId] || geminiPaceByPersona.cooperative;
  return `# AUDIO PROFILE
${who}, speaking standard Seoul Korean on a phone call with his or her child's elementary school teacher. Keep exactly the same voice identity, pitch range, accent and speaking pace in every line of this call.
## DIRECTOR'S NOTES
Style: ${style}
Pace: ${pace}
Never read these notes aloud and never add words that are not in the transcript.
#### TRANSCRIPT
${text}`;
}
// 오디션 페이지에서 고를 수 있는 Gemini 음성 이름입니다. 최종 기본값은 환경변수로 정합니다.
export const GEMINI_VOICES = ["Kore", "Aoede", "Leda", "Zephyr", "Callirrhoe", "Charon", "Orus", "Fenrir", "Puck", "Algieba"];
const GEMINI_DEFAULT_VOICE = { female: "Kore", male: "Orus" };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
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

  const model = getEnv("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts";
  const voice = String(body?.voice || getEnv("OPENAI_TTS_VOICE") || "coral");
  const instructions = (deliveryByPersona[String(body?.parentId || "")] || deliveryByPersona.cooperative) + ` 40대 초반 ${body?.gender === "male" ? "아버지" : "어머니"}의 목소리이며, 한 통화 동안 같은 사람처럼 같은 음높이와 속도를 유지합니다.`;

  try {
    let result = await requestSpeech({ apiKey, model, voice, text, instructions });
    // 배포 환경마다 지원 음색이 달라 400이 날 수 있으므로 기본 음색으로 한 번 더 시도합니다.
    if (!result.ok && result.status === 400 && voice !== FALLBACK_VOICE) {
      result = await requestSpeech({ apiKey, model, voice: FALLBACK_VOICE, text, instructions });
    }
    if (!result.ok) return json({ error: toUserFacingError(result.status, result.error).message }, result.status || 502);
    return json({ audio: result.audio, mime: "audio/mpeg", provider: "openai", ...(geminiError ? { geminiError } : {}) });
  } catch (error) {
    return errorResponse(error, "학부모 음성을 합성하지 못했습니다.");
  }
};

// 모델 이름은 자주 바뀌므로 환경변수를 먼저 쓰고, 없는 모델(404)이면 알려진 후보를 차례로 시도합니다.
const GEMINI_MODEL_CANDIDATES = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts"];
let workingGeminiModel = "";

async function tryGemini({ text, body, timeoutMs: timeoutOverride }) {
  const key = getEnv("GEMINI_API_KEY");
  if (!key) return null;
  const gender = body?.gender === "male" ? "male" : "female";
  const requested = String(body?.geminiVoice || "");
  const voiceName = GEMINI_VOICES.includes(requested) ? requested : (getEnv(gender === "male" ? "GEMINI_TTS_VOICE_MALE" : "GEMINI_TTS_VOICE_FEMALE") || GEMINI_DEFAULT_VOICE[gender]);
  const style = geminiStyleByPersona[String(body?.parentId || "")] || geminiStyleByPersona.cooperative;
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
          contents: [{ parts: [{ text: geminiPrompt({ gender, style, parentId: String(body?.parentId || ""), text }) }] }],
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
      return { audio: wav.toString("base64"), mime: "audio/wav", provider: "gemini", voice: voiceName, model };
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
