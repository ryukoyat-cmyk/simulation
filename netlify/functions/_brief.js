import { createWithFallback, getEnv } from "./_shared.js";

// 대화 시작 때 민원 상황에서 "학부모 시점의 핵심 정리"를 뽑습니다.
// 특히 학부모의 구체적 요구(1~3개)를 사건에서 직접 뽑아 두어, 요구형이 사건과 무관한 절차 질문을
// 늘어놓지 않고 이 사건에서 실제로 원하는 것을 요구하게 합니다. 실패하면 빈 문자열(대화는 그대로 진행).
const format = {
  type: "json_schema",
  json_schema: {
    name: "situation_brief",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        facts: { type: "string" },
        grievance: { type: "string" },
        demands: { type: "array", items: { type: "string" } }
      },
      required: ["facts", "grievance", "demands"]
    }
  }
};

export async function extractBrief({ situation, situationContext, parentType }) {
  const text = String(situation || "").trim();
  if (!text) return "";
  try {
    const raw = await createWithFallback({
      model: getEnv("OPENAI_META_MODEL") || "gpt-4.1-mini",
      system: `민원 상황을 학부모 시점으로 짧게 정리합니다. 원문은 교사나 제3자가 쓴 기록일 수 있습니다("저/제가"는 교사일 수 있음). 원문에 없는 사실은 만들지 않습니다.
- facts: 학부모 입장에서 일어난 일(한두 문장)
- grievance: 학부모가 문제 삼는 점(한 문장)
- demands: 학부모가 이 사건에서 학교·교사에게 실제로 원하는 구체적 조치 1~3개. 원문에 드러난 요구를 우선하고, 드러나지 않았다면 이 사건에서 학부모가 바랄 법한 조치를 사건에 맞게 씁니다. "규정을 알려 달라" 같은 일반적인 절차 질문은 넣지 않습니다.
학부모 유형: ${parentType || "학부모"}`,
      input: `${text}${situationContext && situationContext !== text ? `\n\n${situationContext}` : ""}`.slice(0, 6000),
      maxOutputTokens: 400,
      responseFormat: format,
      timeoutMs: Number(getEnv("BRIEF_TIMEOUT_MS")) || 6000
    }, "gpt-4.1-mini");
    const b = JSON.parse(raw);
    const demands = (Array.isArray(b.demands) ? b.demands : []).map(String).filter(Boolean).slice(0, 3);
    return [`- 일어난 일: ${b.facts}`, `- 학부모가 문제 삼는 점: ${b.grievance}`, demands.length ? `- 학부모의 구체적 요구: ${demands.map((d, i) => `${i + 1}) ${d}`).join(" ")}` : ""].filter(Boolean).join("\n");
  } catch (error) {
    console.warn("Brief extraction failed; continuing without it.", error?.message);
    return "";
  }
}
