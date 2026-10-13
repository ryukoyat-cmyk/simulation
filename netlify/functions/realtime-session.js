import { SITUATION_RULES, briefBlock, demandingTurnRules } from "./_prompts.js";
import { PROFILES, normalizeGender, normalizePersona } from "./_voice_profiles.js";
import { getEnv, json, readJson } from "./_shared.js";

// 학부모 음성을 OpenAI Realtime(음성 대화 모델)으로 만들기 위한 임시 세션 키를 발급합니다.
// 한 모델이 상황과 페르소나를 이해한 채 직접 말하므로
//  - 유형별 감정·말투가 목소리에 실리고(글을 읽기만 하는 음성 합성과 다름),
//  - 한 통화 동안 같은 세션·같은 목소리로 이어지며,
//  - 대사 생성과 음성 합성을 따로 기다리지 않아 첫 소리가 빠릅니다.
// 교사 쪽은 글(또는 브라우저 음성 인식)로만 보내므로 마이크 오디오를 OpenAI로 보내지 않습니다.
const recentStarts = new Map();
const WINDOW_MS = 60 * 60 * 1000;
// 목소리는 성별당 하나입니다. 유형은 목소리 종류가 아니라 연기(감정·말투)로 구분합니다.
const DEFAULT_VOICE = { female: "marin", male: "cedar" };

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.system) return json({ error: "system is required" }, 400);
  if (String(getEnv("PARENT_VOICE_MODE") || "realtime").toLowerCase() === "pipeline") {
    return json({ error: "Realtime is disabled.", disabled: true }, 409);
  }

  // 같은 학교(같은 IP)에서 여러 명이 쓰므로 한도를 넉넉히 두고 환경변수로 조절합니다.
  const limit = Number(getEnv("REALTIME_MAX_PER_HOUR")) || 120;
  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const now = Date.now();
  const starts = (recentStarts.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (starts.length >= limit) return json({ error: "시간당 시뮬레이션 시작 횟수를 초과했습니다. 잠시 후 다시 시도하세요." }, 429);
  starts.push(now);
  recentStarts.set(ip, starts);

  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY is not configured." }, 500);

  const gender = normalizeGender(body.gender);
  const persona = normalizePersona(String(body.parentId || ""));
  const parentType = String(body.parentType || "학부모");
  const voice = getEnv(gender === "male" ? "REALTIME_VOICE_MALE" : "REALTIME_VOICE_FEMALE") || DEFAULT_VOICE[gender];
  const model = getEnv("OPENAI_REALTIME_MODEL") || "gpt-realtime";
  const instructions = buildInstructions({ system: String(body.system), gender, persona, parentType, brief: body.brief });

  const session = {
    type: "realtime",
    model,
    instructions: instructions.slice(0, 16000),
    // 오디오로 답하면 같은 내용의 자막(transcript)이 함께 옵니다.
    output_modalities: ["audio"],
    audio: { output: { voice } }
  };

  let response, data;
  try {
    response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session })
    });
    data = await response.json().catch(() => ({}));
  } catch (error) {
    return json({ error: "Realtime 서비스에 연결하지 못했습니다." }, 502);
  }
  if (!response.ok) {
    console.error("Realtime session creation failed:", response.status, data?.error?.message);
    return json({ error: data?.error?.message || "Realtime session creation failed" }, response.status);
  }
  return json({
    clientSecret: data.client_secret?.value || data.value,
    expiresAt: data.client_secret?.expires_at || data.expires_at || null,
    model,
    voice,
    instructions: session.instructions
  });
};

// 클라이언트의 페르소나 설명(body.system)에 상황 읽는 법, 유형별 반응 규칙, 목소리 연기 지시를 더합니다.
export function buildInstructions({ system, gender, persona, parentType, brief }) {
  const p = PROFILES[persona];
  const who = gender === "male" ? "40대 초반의 아버지" : "40대 초반의 어머니";
  return `${system}

${SITUATION_RULES}
${briefBlock(brief)}${demandingTurnRules(persona, parentType)}

[목소리 연기 — 당신은 지금 교사와 실제로 전화 통화를 하며 직접 말하고 있습니다]
- 당신은 ${who}이고 표준 서울말을 씁니다. 글을 읽는 것이 아니라 실제 통화처럼 감정을 실어 말합니다.
- ${parentType}의 목소리: ${p.ko}
- 감정: ${p.emotion}
- 음높이: ${p.pitch}
- 속도: ${p.pace}
- 크기: ${p.volume}
- 쉼: ${p.pauses}
- 말끝: ${p.endings}
- 통화가 끝날 때까지 같은 사람의 목소리와 ${parentType}의 말투·감정을 유지합니다. 교사의 응대에 따라 감정이 조금 누그러지거나 격해질 수는 있지만, 성격과 말투가 다른 사람처럼 바뀌지 않습니다.

[말하기 규칙]
- 한국어로만 말합니다. 한 번에 2~4문장, 길어도 20초 안쪽으로 말합니다.
- 지문, 괄호, 해설, "학부모:" 같은 표기, 상황 설명을 소리 내어 읽지 않습니다. 학부모가 실제로 하는 말만 합니다.
- 교사 역할을 하거나 조언·평가·점수를 말하지 않습니다.
- 욕설, 실제 위협, 혐오 표현은 하지 않습니다.`;
}

export const config = { path: "/api/realtime-session", method: ["POST"] };
