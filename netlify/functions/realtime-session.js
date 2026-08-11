import { getEnv, json, readJson } from "./_shared.js";

const recentStarts = new Map();
const MAX_SESSIONS_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000;

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.instructions) return json({ error: "instructions are required" }, 400);

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const now = Date.now();
  const starts = (recentStarts.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (starts.length >= MAX_SESSIONS_PER_HOUR) {
    return json({ error: "시간당 시뮬레이션 시작 횟수(10회)를 초과했습니다. 잠시 후 다시 시도하세요." }, 429);
  }
  starts.push(now);
  recentStarts.set(ip, starts);

  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY is not configured." }, 500);

  const voice = String(body.voice || "marin");
  const session = {
    type: "realtime",
    model: getEnv("OPENAI_REALTIME_MODEL") || "gpt-realtime-mini",
    instructions: String(body.instructions).slice(0, 12000),
    output_modalities: ["audio", "text"],
    audio: {
      input: { transcription: { model: "gpt-4o-mini-transcribe", language: "ko" }, turn_detection: { type: "server_vad", create_response: false } },
      output: { voice }
    }
  };

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ session })
  });
  const data = await response.json();
  if (!response.ok) return json({ error: data.error?.message || "Realtime session creation failed" }, response.status);
  return json({ clientSecret: data.client_secret?.value || data.value, expiresAt: data.client_secret?.expires_at || null, model: session.model });
};

export const config = { path: "/api/realtime-session", method: ["POST"] };
