import { createWithFallback, json, readJson, saveToSupabase } from "./_shared.js";

const criteria = [
  ["요구 파악", "Ⅰ. 의사소통"], ["사실 확인", "Ⅰ. 의사소통"], ["공감적 표현", "Ⅰ. 의사소통"], ["명료한 설명", "Ⅰ. 의사소통"],
  ["감정적 상황 대응", "Ⅱ. 갈등 완화"], ["비대립적 의사소통", "Ⅱ. 갈등 완화"], ["쟁점 조정", "Ⅱ. 갈등 완화"], ["갈등 확대 방지", "Ⅱ. 갈등 완화"],
  ["사안 판단", "Ⅲ. 절차적 대응"], ["대응 범위 설정", "Ⅲ. 절차적 대응"], ["후속 절차 안내", "Ⅲ. 절차적 대응"], ["경계 설정", "Ⅲ. 절차적 대응"], ["이관·보고 판단", "Ⅲ. 절차적 대응"], ["대응 중단 판단", "Ⅲ. 절차적 대응"]
];
const names = criteria.map(([name]) => name);
const rubricSchema = {
  type: "json_schema",
  json_schema: {
    name: "complaint_response_evaluation", strict: true,
    schema: {
      type: "object", additionalProperties: false,
      properties: {
        criteria: { type: "array", items: { type: "object", additionalProperties: false, properties: {
          name: { type: "string", enum: names }, status: { type: "string", enum: ["scored", "not_applicable"] }, score: { type: "integer", minimum: 0, maximum: 4 }, evidence: { type: "string" }, comment: { type: "string" }
        }, required: ["name", "status", "score", "evidence", "comment"] } },
        strengths: { type: "array", items: { type: "string" } }, improvements: { type: "array", items: { type: "string" } }, alternatives: { type: "array", items: { type: "string" } }, summary: { type: "string" }
      }, required: ["criteria", "strengths", "improvements", "alternatives", "summary"]
    }
  }
};

const rubricPrompt = `당신은 예비교원의 학부모 민원 대응 연습을 평가하는 교육 컨설턴트입니다. 반드시 JSON 스키마만 반환합니다.
14개 요소 각각을 평가하세요. 실제 대화에서 판단할 근거가 전혀 필요 없는 요소만 status=not_applicable, score=0으로 하세요. 그렇지 않으면 status=scored와 1~4점을 사용하세요.
4점은 수행이 구체적이고 적절함, 3점은 대체로 적절하나 일부 불명확함, 2점은 부분 인식이나 불충분함, 1점은 수행하지 않거나 부적절함입니다.
evidence에는 실제 발화 또는 대화 사실을 짧게 연결하고, comment는 개선 방향을 씁니다. 강점·개선점은 각각 최대 3개, alternatives에는 실제로 사용할 수 있는 대안 발화를 2~3개 작성하세요.`;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!Array.isArray(body?.messages) || !body.parentType || !body.situation) return json({ error: "messages, parentType, and situation are required" }, 400);
  const teacherTurns = body.messages.filter((m) => m.role === "teacher").length;
  if (teacherTurns < 4) return json({ error: "교사 응답이 4회 이상이어야 평가할 수 있습니다." }, 400);

  const conversation = body.messages.map((m) => `${m.role === "teacher" ? "교사" : "학부모"}: ${m.content}`).join("\n\n");
  const context = [
    `교원 유형: ${body.teacherType || "예비교원"}`,
    `학교급: ${body.schoolLevel || "초등학교"}`,
    `학부모 유형: ${body.parentType}`,
    `민원 상황: ${body.situation}`,
    body.situationContext ? `상세 맥락: ${body.situationContext}` : "",
    "", `대화 기록:\n${conversation}`
  ].filter(Boolean).join("\n");

  try {
    const firstRaw = await createWithFallback({ model: process.env.OPENAI_PRIMARY_EVAL_MODEL || "gpt-5.6-luna", reasoningEffort: "none", system: rubricPrompt, input: context, maxOutputTokens: 2400, responseFormat: rubricSchema }, "gpt-5.4-mini");
    const first = normalize(JSON.parse(firstRaw));
    const secondRaw = await createWithFallback({
      model: process.env.OPENAI_SECONDARY_EVAL_MODEL || "gpt-5.6-sol", reasoningEffort: "low", maxOutputTokens: 2600, responseFormat: rubricSchema,
      system: `${rubricPrompt}\n당신은 2차 검토자입니다. 1차 평가가 대화 근거와 일치하는지 검토하고, 점수·근거·누락만 필요한 범위에서 조정해 최종 평가를 작성하세요.`,
      input: `${context}\n\n1차 평가 초안:\n${JSON.stringify(first)}`
    }, "gpt-5.4");
    const evaluation = calculate(normalize(JSON.parse(secondRaw)));
    if (body.sessionId) await saveToSupabase("simulation_evaluations", {
      session_id: body.sessionId, attempt_id: body.attemptId || body.sessionId, attempt_number: Number(body.attemptNumber || 1),
      teacher_type: body.teacherType || null, school_level: body.schoolLevel || null, parent_type: body.parentType, situation: body.situation,
      score: Math.round(evaluation.totalScore), scaled_score: evaluation.totalScore, summary: evaluation.summary, strengths: evaluation.strengths, improvements: evaluation.improvements,
      conversation: { messages: body.messages, criteria: evaluation.criteria, alternatives: evaluation.alternatives, primaryEvaluation: first, overallFeedback: evaluation.summary }
    });
    return json(evaluation);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Evaluation failed" }, 500);
  }
};

function normalize(value) {
  const byName = new Map((value.criteria || []).filter((item) => names.includes(item?.name)).map((item) => [item.name, item]));
  return {
    criteria: criteria.map(([name, domain]) => {
      const item = byName.get(name);
      const applicable = item?.status !== "not_applicable";
      return { name, domain, status: applicable ? "scored" : "not_applicable", score: applicable ? Math.max(1, Math.min(4, Number(item?.score || 1))) : 0, evidence: item?.evidence || "대화에서 직접적인 근거를 충분히 확인하지 못했습니다.", comment: item?.comment || "다음 발화에서 이 요소를 구체적으로 드러내 보세요." };
    }),
    strengths: Array.isArray(value.strengths) ? value.strengths.slice(0, 3) : [], improvements: Array.isArray(value.improvements) ? value.improvements.slice(0, 3) : [], alternatives: Array.isArray(value.alternatives) ? value.alternatives.slice(0, 3) : [], summary: String(value.summary || "대화의 근거를 바탕으로 민원 대응 방식을 점검해 보세요.")
  };
}

function calculate(evaluation) {
  const scored = evaluation.criteria.filter((item) => item.status === "scored");
  const average = scored.length ? scored.reduce((sum, item) => sum + item.score, 0) / scored.length : 0;
  const domains = ["Ⅰ. 의사소통", "Ⅱ. 갈등 완화", "Ⅲ. 절차적 대응"].map((name) => {
    const items = evaluation.criteria.filter((item) => item.domain === name && item.status === "scored");
    return { name, average: items.length ? Number((items.reduce((sum, item) => sum + item.score, 0) / items.length).toFixed(2)) : null, count: items.length };
  });
  return { ...evaluation, totalScore: Number((average * 14).toFixed(2)), averageScore: Number(average.toFixed(2)), domains };
}

export const config = { path: "/api/evaluate", method: ["POST"] };
