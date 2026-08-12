const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8"
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

// 실패 원문은 서버 로그에만 남기고, 화면에는 교사가 바로 판단할 수 있는 문장만 내보냅니다.
// code를 함께 실어 보내 프런트엔드가 재시도 여부를 구분할 수 있게 합니다.
export function errorResponse(error, fallback = "요청을 처리하지 못했습니다.") {
  console.error(error?.detail || error?.message || error);
  if (error?.stack) console.error(error.stack);
  const status = { auth: 503, rate: 429, network: 504, upstream: 502 }[error?.code] || 500;
  return json({ error: error?.message || fallback, code: error?.code || "unknown" }, status);
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function getEnv(name) {
  if (globalThis.Netlify?.env?.get) return Netlify.env.get(name);
  return process.env[name];
}

const DEFAULT_TIMEOUT_MS = 25000;
const REASONING_HEADROOM_TOKENS = 1200;

// fetch 자체가 실패하면 undici는 message로 "fetch failed"만 남기고
// 실제 사유(DNS, 연결 거부, TLS, 타임아웃)는 error.cause에 숨깁니다.
// 어느 목적지가 왜 끊겼는지 로그와 화면 양쪽에서 알 수 있게 여기서 풀어 씁니다.
export function describeNetworkError(error, label, timeoutMs) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    const timeout = new Error(`${label} 응답이 ${Math.max(1, Math.round(timeoutMs / 1000))}초 안에 오지 않았습니다.`);
    timeout.code = "network";
    timeout.detail = `${label} timed out after ${timeoutMs}ms`;
    return timeout;
  }
  const cause = error?.cause?.code || error?.cause?.message || error?.message || "unknown";
  const failure = new Error(`${label} 연결에 실패했습니다. (${cause})`);
  failure.code = "network";
  // 연결 단계에서 즉시 끊긴 경우는 재시도할 가치가 있습니다. 타임아웃은 다시 걸어도 같습니다.
  failure.retryable = true;
  failure.detail = `${label} fetch failed: ${cause}`;
  return failure;
}

async function fetchWithTimeout(url, options, { label, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    throw describeNetworkError(error, label, timeoutMs);
  } finally {
    clearTimeout(timer);
  }
}

export async function createOpenAIResponse({ system, input, maxOutputTokens = 600, responseFormat, model, reasoningEffort, timeoutMs }) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    const missing = new Error("AI 서비스 키가 설정되지 않았습니다. 사이트 환경변수의 OPENAI_API_KEY를 등록해 주세요.");
    missing.code = "auth";
    missing.detail = "OPENAI_API_KEY is not configured.";
    throw missing;
  }

  const selectedModel = model || getEnv("OPENAI_MODEL") || "gpt-5-mini";
  const isReasoningModel = /^(gpt-5|o[134])/i.test(selectedModel);

  // 추론 모델은 내부 추론 토큰도 max_completion_tokens에서 함께 차감합니다.
  // 짧은 발화를 만들려고 예산을 작게 잡으면 추론만 하다 끝나 content가 빈 문자열로 돌아옵니다.
  // 짧은 대사를 요구하는 호출일수록 이 함정에 걸리므로 여유분을 따로 얹습니다.
  const body = {
    model: selectedModel,
    messages: [
      { role: "system", content: system },
      ...normalizeMessages(input)
    ],
    max_completion_tokens: isReasoningModel ? maxOutputTokens + REASONING_HEADROOM_TOKENS : maxOutputTokens
  };

  if (responseFormat) body.response_format = responseFormat;
  if (isReasoningModel && reasoningEffort) body.reasoning_effort = reasoningEffort;

  const budget = timeoutMs || Number(getEnv("OPENAI_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS;
  const res = await withRetry(() => fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, { label: "AI 서비스", timeoutMs }));

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw toUserFacingError(res.status, data.error?.message);
  }

  const choice = data.choices?.[0];
  const content = choice?.message?.content?.trim() || "";
  if (!content) {
    // finish_reason이 length면 토큰이 모자란 것이고, 그 외에는 모델이 응답을 거절한 경우입니다.
    // 어느 쪽인지 로그에 남겨야 예산 문제와 프롬프트 문제를 구분할 수 있습니다.
    const empty = new Error("AI 서비스가 빈 응답을 반환했습니다.");
    empty.code = "upstream";
    empty.detail = `Empty completion from ${selectedModel} (finish_reason=${choice?.finish_reason || "unknown"}, `
      + `reasoning_tokens=${data.usage?.completion_tokens_details?.reasoning_tokens ?? "n/a"}, `
      + `budget=${body.max_completion_tokens}).`;
    throw empty;
  }
  return content;
}

// 연결이 즉시 끊기는 실패는 한 번 더 시도하면 대부분 통과합니다.
// 인증 실패나 타임아웃처럼 다시 걸어도 결과가 같은 경우는 즉시 포기합니다.
async function withRetry(run, attempts = 2, delayMs = 400) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!error?.retryable || attempt === attempts) break;
      console.warn(`${error.detail || error.message} — 재시도 ${attempt}/${attempts - 1}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}

// 업스트림 오류 원문은 서버 로그에만 남기고, 화면에는 조치 가능한 안내만 내보냅니다.
export function toUserFacingError(status, detail) {
  const raw = detail || `OpenAI request failed with ${status}`;
  if (status === 401 || status === 403) {
    console.error("OpenAI authentication rejected. Check the OPENAI_API_KEY site environment variable:", raw);
    const error = new Error("AI 서비스 인증에 실패했습니다. 사이트 환경변수의 OPENAI_API_KEY를 확인해 주세요.");
    error.code = "auth";
    return error;
  }
  if (status === 429) {
    console.warn("OpenAI rate limit or quota reached:", raw);
    const error = new Error("AI 서비스 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.");
    error.code = "rate";
    error.detail = raw;
    return error;
  }
  if (status >= 500) {
    console.error(`OpenAI upstream error ${status}:`, raw);
    const error = new Error("AI 서비스가 일시적으로 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    error.code = "upstream";
    error.retryable = true;
    error.detail = raw;
    return error;
  }
  console.error(`OpenAI request failed with ${status}:`, raw);
  const error = new Error("AI 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  error.code = "upstream";
  error.detail = raw;
  return error;
}

export async function createWithFallback(options, fallbackModel) {
  try {
    return await createOpenAIResponse(options);
  } catch (error) {
    // 키가 거부된 경우에는 모델을 바꿔도 결과가 같으므로 재시도하지 않습니다.
    if (error.code === "auth") throw error;
    // 이미 타임아웃으로 시간을 다 썼다면 폴백 모델을 부를 여유가 없습니다.
    // 여기서 한 번 더 기다리면 함수 실행 제한에 걸려 플랫폼 오류로 끝납니다.
    if (error.code === "network" && !error.retryable) throw error;
    if (!fallbackModel || options.model === fallbackModel) throw error;
    console.warn(`Primary model failed; retrying with ${fallbackModel}.`, error.message);
    return createOpenAIResponse({ ...options, model: fallbackModel, reasoningEffort: undefined });
  }
}

// 기록 저장은 부가 기능입니다. 저장이 실패해도 진행 중인 대화나 평가는 그대로 이어져야 하므로
// 여기서 모든 예외를 삼키고 false만 돌려줍니다. 호출부가 try로 감싸지 않아도 안전합니다.
export async function saveToSupabase(table, row) {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Supabase env vars are not fully configured.");
    return false;
  }

  try {
    const res = await fetchWithTimeout(`${url.replace(/\/$/, "")}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(row)
    }, { label: "기록 저장소", timeoutMs: 8000 });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Supabase insert failed for ${table} (${res.status}):`, detail);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Supabase insert failed for ${table}:`, error.detail || error.message);
    return false;
  }
}

function normalizeMessages(input) {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return [];
  return input.map(message => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "")
  }));
}
