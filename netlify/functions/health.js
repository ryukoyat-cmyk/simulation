import { getEnv, json } from "./_shared.js";

// /api/health 는 배포된 사이트에서 무엇이 끊겼는지 바로 확인하기 위한 진단 엔드포인트입니다.
// 500이 났을 때 Netlify 로그를 열지 않고도 원인이 키인지, 네트워크인지, 저장소인지 구분할 수 있습니다.
// 키 값 자체는 어떤 경우에도 응답에 담지 않습니다.
const PROBE_TIMEOUT_MS = 6000;

export default async () => {
  const openaiKey = getEnv("OPENAI_API_KEY");
  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const [openai, supabase] = await Promise.all([
    probeOpenAI(openaiKey),
    probeSupabase(supabaseUrl, supabaseKey)
  ]);

  const env = {
    OPENAI_API_KEY: describeKey(openaiKey),
    SUPABASE_URL: describeUrl(supabaseUrl),
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? "설정됨" : "없음",
    OPENAI_CHAT_MODEL: getEnv("OPENAI_CHAT_MODEL") || "미설정",
    OPENAI_MODEL: getEnv("OPENAI_MODEL") || "미설정"
  };

  // 대화는 OpenAI만 있으면 동작합니다. Supabase는 기록 저장 전용이라 끊겨도 연습은 가능합니다.
  const ok = openai.ok;
  return json({ ok, checkedAt: new Date().toISOString(), env, openai, supabase }, ok ? 200 : 503);
};

export const config = {
  path: "/api/health",
  method: ["GET"]
};

function describeKey(key) {
  if (!key) return "없음";
  if (!/^sk-/.test(key.trim())) return "설정됨 (형식이 sk-로 시작하지 않음)";
  if (key !== key.trim()) return "설정됨 (앞뒤 공백 있음 — 붙여넣기 오류 가능)";
  return "설정됨";
}

function describeUrl(url) {
  if (!url) return "없음";
  if (!/^https:\/\//.test(url.trim())) return "설정됨 (https:// 로 시작하지 않음 — 연결 실패 원인)";
  if (url !== url.trim()) return "설정됨 (앞뒤 공백 있음 — 붙여넣기 오류 가능)";
  return "설정됨";
}

async function probeOpenAI(apiKey) {
  if (!apiKey) return { ok: false, reason: "OPENAI_API_KEY가 설정되지 않았습니다." };
  return probe("https://api.openai.com/v1/models", { Authorization: `Bearer ${apiKey}` }, {
    401: "API 키가 거부되었습니다. 키를 재발급해 등록해 주세요.",
    403: "API 키에 이 모델을 쓸 권한이 없습니다.",
    429: "사용량 한도에 도달했습니다. 결제 상태와 잔여 크레딧을 확인해 주세요."
  });
}

async function probeSupabase(url, key) {
  if (!url || !key) return { ok: false, reason: "Supabase 환경변수가 설정되지 않아 기록이 저장되지 않습니다." };
  return probe(`${url.replace(/\/$/, "")}/rest/v1/`, { apikey: key, Authorization: `Bearer ${key}` }, {
    401: "service role 키가 거부되었습니다.",
    404: "프로젝트 URL이 올바르지 않습니다."
  });
}

async function probe(url, headers, messagesByStatus) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const ms = Date.now() - startedAt;
    if (res.ok) return { ok: true, status: res.status, ms };
    return { ok: false, status: res.status, ms, reason: messagesByStatus[res.status] || `요청이 ${res.status}로 거부되었습니다.` };
  } catch (error) {
    const ms = Date.now() - startedAt;
    if (error?.name === "AbortError") {
      return { ok: false, ms, reason: `${PROBE_TIMEOUT_MS / 1000}초 안에 응답이 없습니다. 서버에서 외부 연결이 막혀 있을 수 있습니다.` };
    }
    const cause = error?.cause?.code || error?.cause?.message || error?.message || "unknown";
    return { ok: false, ms, reason: `연결 자체가 실패했습니다. (${cause})` };
  } finally {
    clearTimeout(timer);
  }
}
