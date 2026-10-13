import { normalizeGender, normalizePersona, normalizeTone, openaiInstructions, openaiVoiceFor } from "./_voice_profiles.js";
import { tryGemini } from "./_tts.js";
import { getEnv, json, readJson } from "./_shared.js";

// 시뮬레이션 화면 전용 학부모 음성.
// 1) 빠르게: OpenAI 음성 합성 응답을 다 기다리지 않고 만들어지는 대로 브라우저로 흘려보냅니다.
//    브라우저는 첫 조각이 도착하는 즉시 재생을 시작합니다(예전에는 전체 합성 + base64 JSON 변환 뒤에 재생).
// 2) 일관되게: 한 서버는 한 공급자만 씁니다(TTS_PROVIDER, 기본 openai). 실패해도 다른 공급자나
//    다른 음성으로 대체하지 않습니다. 음성 이름과 연기 지시는 유형 × 성별로 고정입니다.
//    대화 중 바뀌는 것은 tone(같은 인물의 감정 강도)뿐이고, TTS_TONE=off이면 그것도 고정합니다.
const MAX_INPUT_CHARS = 800;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  const text = String(body?.text || "").trim().slice(0, MAX_INPUT_CHARS);
  if (!text) return json({ error: "text is required" }, 400);

  const persona = normalizePersona(String(body?.parentId || ""));
  const gender = normalizeGender(body?.gender);
  // 대화 중 강도 변화는 기본으로 끕니다(같은 인물이 같은 톤으로 들리게). TTS_TONE=on이면 켭니다.
  const tone = String(getEnv("TTS_TONE") || "off").toLowerCase() === "on" ? normalizeTone(body?.tone) : "steady";
  const provider = String(getEnv("TTS_PROVIDER") || "openai").toLowerCase() === "gemini" ? "gemini" : "openai";

  if (provider === "gemini") {
    // Gemini 음성은 스트리밍을 지원하지 않아 다 만든 뒤 한 번에 보냅니다(느림). 실패해도 OpenAI로 넘기지 않습니다.
    const gemini = await tryGemini({ text, body: { ...body, parentId: persona, gender, tone }, timeoutMs: Number(getEnv("GEMINI_TIMEOUT_MS")) || 9000 });
    if (!gemini?.audio) return json({ error: "학부모 음성 합성이 지연되고 있습니다. 잠시 뒤 다시 재생해 주세요.", provider: "gemini", retryable: true }, 503);
    return new Response(Buffer.from(gemini.audio, "base64"), { headers: audioHeaders("audio/wav", "gemini", gemini.voice) });
  }

  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY is not configured.", provider: "openai" }, 500);
  const voice = openaiVoiceFor(gender, persona);
  const instructions = openaiInstructions({ gender, persona, tone });
  const model = getEnv("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts";

  // 첫 응답(헤더)이 늦으면 끊습니다. 소리가 흘러나오기 시작한 뒤에는 끝까지 둡니다.
  const firstByteMs = Number(getEnv("TTS_FIRST_BYTE_MS")) || 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), firstByteMs);
  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input: text, instructions, response_format: "mp3" }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    const timedOut = error?.name === "AbortError";
    return json({ error: timedOut ? "음성 합성 서비스 응답이 늦습니다. 잠시 뒤 다시 시도해 주세요." : "음성 합성 서비스에 연결하지 못했습니다.", provider: "openai", retryable: true }, timedOut ? 504 : 502);
  }
  clearTimeout(timer);
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    let message = detail;
    try { message = JSON.parse(detail).error?.message || detail; } catch { /* 원문 유지 */ }
    console.error("OpenAI TTS failed:", upstream.status, String(message).slice(0, 300));
    const retryable = upstream.status >= 500 || upstream.status === 429;
    return json({ error: upstream.status === 401 ? "OPENAI_API_KEY가 올바르지 않습니다." : "학부모 음성을 합성하지 못했습니다.", provider: "openai", retryable }, upstream.status === 401 ? 401 : 502);
  }
  // 받은 조각을 그대로 흘려보냅니다(Netlify Functions 응답 스트리밍).
  return new Response(upstream.body, { headers: audioHeaders("audio/mpeg", "openai", voice) });
};

function audioHeaders(type, provider, voice) {
  return { "Content-Type": type, "Cache-Control": "no-store", "X-TTS-Provider": provider, "X-TTS-Voice": String(voice || "") };
}

export const config = { path: "/api/speak-stream", method: ["POST"] };
