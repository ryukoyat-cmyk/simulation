const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8"
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
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

export async function createOpenAIResponse({ system, input, maxOutputTokens = 600, responseFormat, model, reasoningEffort }) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const selectedModel = model || getEnv("OPENAI_MODEL") || "gpt-5-mini";
  const body = {
    model: selectedModel,
    messages: [
      { role: "system", content: system },
      ...normalizeMessages(input)
    ],
    max_completion_tokens: maxOutputTokens
  };

  if (responseFormat) body.response_format = responseFormat;
  if (/^gpt-5/i.test(selectedModel) && reasoningEffort) body.reasoning_effort = reasoningEffort;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw toUserFacingError(res.status, data.error?.message);
  }

  const content = data.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("OpenAI returned an empty response.");
  return content;
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
    return error;
  }
  console.error(`OpenAI request failed with ${status}:`, raw);
  return new Error(raw);
}

export async function createWithFallback(options, fallbackModel) {
  try {
    return await createOpenAIResponse(options);
  } catch (error) {
    // 키가 거부된 경우에는 모델을 바꿔도 결과가 같으므로 재시도하지 않습니다.
    if (error.code === "auth") throw error;
    if (!fallbackModel || options.model === fallbackModel) throw error;
    console.warn(`Primary model failed; retrying with ${fallbackModel}.`, error.message);
    return createOpenAIResponse({ ...options, model: fallbackModel, reasoningEffort: undefined });
  }
}

export async function saveToSupabase(table, row) {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Supabase env vars are not fully configured.");
    return false;
  }

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(row)
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`Supabase insert failed for ${table}:`, detail);
    return false;
  }

  return true;
}

function normalizeMessages(input) {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return [];
  return input.map(message => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "")
  }));
}
