import { createWithFallback, json, readJson, saveToSupabase } from "./_shared.js";

const criteria = [
  ["요구 파악", "학부모의 핵심 요구와 쟁점을 경청하고 확인한다."], ["사실 확인", "추측 전에 필요한 사실관계를 질문하고 확인한다."], ["공감적 표현", "감정을 인정하되 성급히 동의하지 않는다."], ["명료한 설명", "상황·판단·가능한 조치를 이해하기 쉽게 설명한다."],
  ["감정적 상황 대응", "감정이 고조되어도 안정적인 태도를 유지한다."], ["비대립적 의사소통", "반박보다 문제 해결에 초점을 둔다."], ["쟁점 조정", "감정과 해결 사안을 구분해 해결 가능한 쟁점으로 전환한다."], ["갈등 확대 방지", "갈등을 자극하는 표현을 피하고 악화를 조절한다."],
  ["사안 판단", "교사가 직접 대응할 수 있는 사안인지 판단한다."], ["대응 범위 설정", "무리한 약속 없이 대응 가능한 범위를 설명한다."], ["후속 절차 안내", "확인·보고·회신 등 이후 절차를 안내한다."], ["경계 설정", "부당 요구·폭언 등의 허용 범위를 분명히 설정한다."], ["이관·보고 판단", "관리자 또는 학교 민원대응체계 이관을 적절히 판단한다."], ["대응 중단 판단", "정상 응대가 불가능할 때 적절히 대응을 종료한다."]
];
const names = criteria.map(([name]) => name);
const responseFormat = {
  type: "json_schema", json_schema: { name: "teacher_response_evaluation", strict: true,
    schema: { type: "object", additionalProperties: false, properties: {
      summary: { type: "string" }, overallFeedback: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, improvements: { type: "array", items: { type: "string" } },
      criteria: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string", enum: names }, score: { type: "integer", minimum: 1, maximum: 4 }, applicable: { type: "boolean" }, evidence: { type: "string" } }, required: ["name", "score", "applicable", "evidence"] } }
    }, required: ["summary", "overallFeedback", "strengths", "improvements", "criteria"] }
  }
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!Array.isArray(body?.messages) || !body.parentType || !body.situation) return json({ error: "messages, parentType, and situation are required" }, 400);
  if (body.messages.filter((m) => m.role === "teacher").length < 4) return json({ error: "교사 발화가 4회 이상이어야 평가할 수 있습니다." }, 400);
  try {
    const convo = body.messages.map((m) => `${m.role === "parent" ? "학부모" : "교사"}: ${m.content}`).join("\n");
    const system = `당신은 예비·현직교원의 학부모 민원 대응 연습을 평가하는 교육 전문가입니다. 반드시 JSON 스키마만 반환합니다.\n\n[평가 원칙]\n- 아래 14개 요소 각각을 대화의 실제 교사 발화에 근거해 1~4점으로 평가합니다.\n- 상황상 관찰할 기회가 없거나 해당하지 않는 요소만 applicable:false로 처리합니다. 그 경우에도 score는 1~4 정수로 채우되 총점 계산에서 제외됩니다.\n- 해당 없음은 편의상 주지 마세요. 대화에서 기대 가능한 요소인데 드러나지 않았다면 applicable:true, 1점으로 평가하세요.\n- evidence는 해당 점수의 구체적 대화 근거 또는 미흡 사유를 한 문장으로 씁니다.\n- 점수: 4=일관되고 적절한 수행, 3=대체로 적절하나 일부 불명확, 2=부분 인식·수행, 1=수행되지 않음 또는 부적절.\n- 강점·개선점은 2~4개, 종합 의견은 학습 피드백으로 간결히 씁니다.\n\n[14개 요소]\n${criteria.map(([name, detail], i) => `${i + 1}. ${name}: ${detail}`).join("\n")}`;
    const context = `교원 유형: ${body.teacherType || "미선택"}\n학교급: ${body.schoolLevel || "미선택"}\n학부모 유형: ${body.parentType}\n상황: ${body.situation}\n${body.situationContext ? `상황 상세: ${body.situationContext}\n` : ""}\n대화 기록:\n${convo}`;
    const firstRaw = await createWithFallback({ model: process.env.OPENAI_PRIMARY_EVAL_MODEL || "gpt-5-mini", reasoningEffort: "none", system, input: context, maxOutputTokens: 2400, responseFormat }, "gpt-4.1-mini");
    const first = JSON.parse(firstRaw);
    const reviewSystem = `${system}\n\n당신은 2차 검토자입니다. 아래 1차 평가의 점수·근거·누락이 실제 교사 발화와 일치하는지 검토하고, 필요한 항목만 조정하여 같은 JSON 스키마로 최종 평가를 작성하세요.`;
    const secondRaw = await createWithFallback({ model: process.env.OPENAI_SECONDARY_EVAL_MODEL || "gpt-5", reasoningEffort: "low", system: reviewSystem, input: `${context}\n\n1차 평가 초안:\n${JSON.stringify(first)}`, maxOutputTokens: 2600, responseFormat }, "gpt-4.1");
    const evaluation = JSON.parse(secondRaw);
    evaluation.criteria = normalizeCriteria(evaluation.criteria);
    const applicable = evaluation.criteria.filter((item) => item.applicable);
    evaluation.score = applicable.length ? Math.round((applicable.reduce((sum, item) => sum + item.score, 0) / applicable.length) * 14 * 10) / 10 : 0;
    evaluation.applicableCount = applicable.length;
    if (body.sessionId) await saveToSupabase("simulation_evaluations", { session_id: body.sessionId, parent_type: body.parentType, situation: body.situation, score: evaluation.score, summary: evaluation.summary, strengths: evaluation.strengths, improvements: evaluation.improvements, conversation: { messages: body.messages, teacherType: body.teacherType, schoolLevel: body.schoolLevel, situationContext: body.situationContext || null, criteria: evaluation.criteria, overallFeedback: evaluation.overallFeedback } });
    return json(evaluation);
  } catch (error) { console.error(error); return json({ error: error.message || "Evaluation failed" }, 500); }
};
function normalizeCriteria(items) { const byName = new Map((Array.isArray(items) ? items : []).filter((item) => names.includes(item?.name)).map((item) => [item.name, item])); return names.map((name) => { const item = byName.get(name); return { name, score: Math.max(1, Math.min(4, Number(item?.score) || 1)), applicable: Boolean(item?.applicable), evidence: String(item?.evidence || "대화에서 이 요소에 관한 구체적 수행 근거가 확인되지 않았습니다.") }; }); }
export const config = { path: "/api/evaluate", method: ["POST"] };

