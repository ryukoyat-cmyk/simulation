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
    throw new Error(data.error?.message || `OpenAI request failed with ${res.status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("OpenAI returned an empty response.");
  return content;
}

export async function createWithFallback(options, fallbackModel) {
  try {
    return await createOpenAIResponse(options);
  } catch (error) {
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
