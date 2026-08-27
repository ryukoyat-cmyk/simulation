import { createWithFallback, errorResponse, getEnv, json, readJson, saveToSupabase } from "./_shared.js";
import { GUIDES, formatCitation } from "./_response_guides.js";

// 플랫폼이 함수를 강제 종료하기 전에 우리가 먼저 포기해야 JSON 오류로 응답할 수 있습니다.
// 강제 종료되면 브라우저는 JSON 대신 HTML 오류 페이지를 받고 파싱 오류를 띄웁니다.
// 환경변수는 요청 시점에 읽습니다. 모듈 로드 시점에는 Netlify 환경이 아직 준비되지 않을 수 있습니다.
const evalTimeout = () => Number(getEnv("OPENAI_EVAL_TIMEOUT_MS")) || 22000;

const criteria = [
  ["요구 파악", "학부모의 핵심 요구와 쟁점을 경청하고 확인한다."], ["사실 확인", "추측 전에 필요한 사실관계를 질문하고 확인한다."], ["공감적 표현", "감정을 인정하되 성급히 동의하지 않는다."], ["명료한 설명", "상황·판단·가능한 조치를 이해하기 쉽게 설명한다."],
  ["감정적 상황 대응", "감정이 고조되어도 안정적인 태도를 유지한다."], ["비대립적 의사소통", "반박보다 문제 해결에 초점을 둔다."], ["쟁점 조정", "감정과 해결 사안을 구분해 해결 가능한 쟁점으로 전환한다."], ["갈등 확대 방지", "갈등을 자극하는 표현을 피하고 악화를 조절한다."],
  ["사안 판단", "교사가 직접 대응할 수 있는 사안인지 판단한다."], ["대응 범위 설정", "무리한 약속 없이 대응 가능한 범위를 설명한다."], ["후속 절차 안내", "확인·보고·회신 등 이후 절차를 안내한다."], ["경계 설정", "부당 요구·폭언 등의 허용 범위를 분명히 설정한다."], ["이관·보고 판단", "관리자 또는 학교 민원대응체계 이관을 적절히 판단한다."], ["대응 중단 판단", "정상 응대가 불가능할 때 적절히 대응을 종료한다."]
];
const names = criteria.map(([name]) => name);
const guideIndex = new Map(GUIDES.map((g) => [g.id, g]));
const guideIdEnum = [...guideIndex.keys(), ""];
// 참고자료 조각을 모델에게 통째로 보여 주고, 대안 문장은 여기 실린 표현에서 가져오게 합니다.
// id로만 인용하게 하면(자유 서술 대신) 모델이 쪽수를 지어낼 수 없습니다 — 서버가 실제 출처로 치환합니다.
const guidesBlock = GUIDES.map((g) => `- id:${g.id} [${g.tags.join(", ")}] ${g.title}: ${g.body} (${formatCitation(g.source)})`).join("\n");

// 평가는 서버리스 함수의 실행 제한 안에서 끝나야 합니다.
// 예전에는 1차 평가와 2차 검토를 순서대로 호출했는데, 추론 모델 두 번을 이어 붙이면
// 제한 시간을 넘겨 함수가 강제 종료되고 브라우저에는 JSON 대신 플랫폼 오류 페이지가 도착합니다.
// 지금은 요소 채점과 발화별 복기·서술 피드백을 한 스키마에 담아 한 번만 호출합니다.
// 실패 지점이 하나로 줄고 호출 비용도 절반입니다. 발화별 항목이 늘면서 출력이 커진 만큼
// reason·alternative는 1문장으로 짧게 요구해 응답 시간을 통제합니다.
function buildResponseFormat(teacherCount) {
  return {
    type: "json_schema", json_schema: { name: "teacher_response_evaluation", strict: true,
      schema: { type: "object", additionalProperties: false, properties: {
        summary: { type: "string" },
        overallReview: { type: "string" },
        strategy: { type: "string" },
        strategyGuideIds: { type: "array", items: { type: "string", enum: guideIdEnum.filter(Boolean) }, minItems: 1, maxItems: 3 },
        perTurn: { type: "array", minItems: teacherCount, maxItems: teacherCount, items: { type: "object", additionalProperties: false, properties: {
          signal: { type: "string", enum: ["green", "yellow", "red"] }, reason: { type: "string" }, alternative: { type: "string" }, guideId: { type: "string", enum: guideIdEnum }
        }, required: ["signal", "reason", "alternative", "guideId"] } },
        criteria: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string", enum: names }, score: { type: "integer", minimum: 1, maximum: 4 }, applicable: { type: "boolean" }, evidence: { type: "string" } }, required: ["name", "score", "applicable", "evidence"] } }
      }, required: ["summary", "overallReview", "strategy", "strategyGuideIds", "perTurn", "criteria"] }
    }
  };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!Array.isArray(body?.messages) || !body.parentType || !body.situation) return json({ error: "messages, parentType, and situation are required" }, 400);
  const teacherTurns = body.messages.filter((m) => m.role === "teacher");
  if (teacherTurns.length < 4) return json({ error: "교사 발화가 4회 이상이어야 평가할 수 있습니다." }, 400);
  try {
    // 시스템 안내 메시지("AI 발화 생성에 실패해…" 등)는 교사·학부모 발화가 아니므로
    // 대화 기록에서 빼야 합니다. 섞이면 모델이 세는 교사 발화 수가 실제와 달라져
    // perTurn 배열 길이(스키마로 강제한 값)와 어긋납니다.
    const dialogue = body.messages.filter((m) => m.role === "teacher" || m.role === "parent");
    const convo = dialogue.map((m) => `${m.role === "parent" ? "학부모" : "교사"}: ${m.content}`).join("\n");
    const system = `당신은 예비·현직교원의 학부모 민원 대응 연습을 평가하는 교육 전문가입니다. 반드시 JSON 스키마만 반환합니다.\n\n[평가 원칙 — 14개 요소]\n- 아래 14개 요소 각각을 대화의 실제 교사 발화에 근거해 1~4점으로 평가합니다.\n- 상황상 관찰할 기회가 없거나 해당하지 않는 요소만 applicable:false로 처리합니다. 그 경우에도 score는 1~4 정수로 채우되 총점 계산에서 제외됩니다.\n- 해당 없음은 편의상 주지 마세요. 대화에서 기대 가능한 요소인데 드러나지 않았다면 applicable:true, 1점으로 평가하세요.\n- evidence는 해당 점수의 구체적 대화 근거 또는 미흡 사유를 한 문장으로 씁니다.\n- 점수: 4=일관되고 적절한 수행, 3=대체로 적절하나 일부 불명확, 2=부분 인식·수행, 1=수행되지 않음 또는 부적절.\n\n[14개 요소]\n${criteria.map(([name, detail], i) => `${i + 1}. ${name}: ${detail}`).join("\n")}\n\n[대화 복기 — perTurn]\n- 아래 대화에서 "교사:"로 표시된 발화는 정확히 ${teacherTurns.length}개입니다. perTurn 배열도 정확히 ${teacherTurns.length}개이며, i번째 항목은 등장 순서 그대로 i번째 "교사:" 발화에 대한 평가입니다.\n- signal: 그 발화 하나만 놓고 판단합니다. green=그 상황에서 적절했다, yellow=방향은 맞지만 아쉬운 지점이 있다, red=부적절하거나 상황을 악화시킬 수 있다.\n- reason: 1문장. green이어도 반드시 "왜 적절했는지" 구체적으로 씁니다(대화의 어떤 부분 덕분인지). 그냥 "잘했다"처럼 근거 없이 쓰지 않습니다.\n- alternative: green이면 빈 문자열("")로 둡니다. yellow·red면 "이렇게 말했다면" 형태로 그 자리에서 바로 쓸 수 있는 대안 대사 1문장을 씁니다. 아래 참고자료에 맞는 권장 표현이 있으면 그 표현을 상황에 맞게 가져와 씁니다. 새로 지어내는 것보다 참고자료 표현을 우선합니다.\n- guideId: 이 발화 평가와 가장 관련 있는 참고자료 조각의 id 하나. 마땅한 것이 없으면 빈 문자열("")로 둡니다. id를 지어내지 말고 아래 목록에 있는 것만 씁니다.\n\n[총평 — summary / overallReview / strategy]\n- summary: 이번 대화를 한두 문장으로 요약합니다.\n- overallReview: 총평입니다. 대화의 전체 흐름, 잘 작동한 접근, 아쉬웠던 지점을 성장 지향적인 어조로 상세히 씁니다. 잘못을 지적하는 글이 아니라 다음 연습에 도움이 되는 글로 씁니다. 2~4문장 이상, 구체적으로.\n- strategy: 추후 민원 대응 전략입니다. 이 학부모 유형과 이 상황이라면 다음에 실제로 쓸 수 있는 전략을 구체적으로 제시합니다. 반드시 아래 참고자료 내용에 근거해서 쓰고, 지어내지 않습니다.\n- strategyGuideIds: strategy에서 실제로 근거로 삼은 참고자료 id 1~3개.\n\n[참고자료 — 아래 id만 guideId·strategyGuideIds에 쓸 수 있습니다]\n${guidesBlock}`;
    const endedEarly = Boolean(body.endedEarly);
    const openIssuesAtExit = Array.isArray(body.openIssuesAtExit) ? body.openIssuesAtExit.map(String).filter(Boolean) : [];
    const exitNote = endedEarly
      ? `[대화 종료 방식] 학부모의 요구가 해결되지 않은 채 교사가 대화를 종료했습니다(중도 종료). 미해결 요구: ${openIssuesAtExit.length ? openIssuesAtExit.join("; ") : "기록 없음"}. 이 점을 총평에 반영하세요.`
      : `[대화 종료 방식] 대화가 자연스럽게 마무리되었습니다.`;
    const context = `교원 유형: ${body.teacherType || "미선택"}\n학교급: ${body.schoolLevel || "미선택"}\n학부모 유형: ${body.parentType}\n상황: ${body.situation}\n${body.situationContext ? `상황 상세: ${body.situationContext}\n` : ""}${exitNote}\n\n대화 기록:\n${convo}`;
    const model = getEnv("OPENAI_PRIMARY_EVAL_MODEL") || "gpt-4.1-mini";
    const raw = await createWithFallback({ model, reasoningEffort: "low", system, input: context, maxOutputTokens: 3400, responseFormat: buildResponseFormat(teacherTurns.length), timeoutMs: evalTimeout() }, "gpt-4.1-mini");
    const evaluation = JSON.parse(raw);
    evaluation.criteria = normalizeCriteria(evaluation.criteria);
    const applicable = evaluation.criteria.filter((item) => item.applicable);
    evaluation.score = applicable.length ? Math.round((applicable.reduce((sum, item) => sum + item.score, 0) / applicable.length) * 14 * 10) / 10 : 0;
    evaluation.applicableCount = applicable.length;
    evaluation.perTurn = normalizePerTurn(evaluation.perTurn, teacherTurns.length);
    evaluation.strategyCitations = normalizeStrategyCitations(evaluation.strategyGuideIds);
    delete evaluation.strategyGuideIds;
    if (body.sessionId) {
      const strengths = evaluation.perTurn.filter((t) => t.signal === "green").map((t) => t.reason).slice(0, 5);
      const improvements = evaluation.perTurn.filter((t) => t.signal !== "green").map((t) => t.alternative || t.reason).slice(0, 5);
      await saveToSupabase("simulation_evaluations", { session_id: body.sessionId, parent_type: body.parentType, situation: body.situation, score: evaluation.score, summary: evaluation.summary, strengths, improvements, conversation: { messages: body.messages, teacherType: body.teacherType, schoolLevel: body.schoolLevel, situationContext: body.situationContext || null, criteria: evaluation.criteria, overallReview: evaluation.overallReview, strategy: evaluation.strategy, perTurn: evaluation.perTurn } });
    }
    return json(evaluation);
  } catch (error) { return errorResponse(error, "평가를 완료하지 못했습니다. 대화 기록은 그대로 남아 있으니 잠시 후 다시 시도해 주세요."); }
};
function normalizeCriteria(items) { const byName = new Map((Array.isArray(items) ? items : []).filter((item) => names.includes(item?.name)).map((item) => [item.name, item])); return names.map((name) => { const item = byName.get(name); return { name, score: Math.max(1, Math.min(4, Number(item?.score) || 1)), applicable: Boolean(item?.applicable), evidence: String(item?.evidence || "대화에서 이 요소에 관한 구체적 수행 근거가 확인되지 않았습니다.") }; }); }
// 스키마가 배열 길이·enum을 강제하지만, 폴백 모델 응답까지 방어적으로 한 번 더 다듬습니다.
function normalizePerTurn(raw, teacherCount) {
  const items = Array.isArray(raw) ? raw : [];
  const signals = new Set(["green", "yellow", "red"]);
  return Array.from({ length: teacherCount }, (_, i) => {
    const item = items[i] || {};
    const signal = signals.has(item.signal) ? item.signal : "yellow";
    const guide = guideIndex.get(item.guideId) || null;
    return {
      signal,
      reason: String(item.reason || "").trim() || "이 발화에 대한 구체적 근거가 확인되지 않았습니다.",
      alternative: signal === "green" ? "" : String(item.alternative || "").trim(),
      citation: guide ? { id: guide.id, title: guide.title, label: formatCitation(guide.source) } : null
    };
  });
}
function normalizeStrategyCitations(raw) {
  const ids = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const guide = guideIndex.get(id);
    if (!guide || seen.has(guide.id)) continue;
    seen.add(guide.id);
    out.push({ id: guide.id, title: guide.title, label: formatCitation(guide.source) });
  }
  return out;
}
export const config = { path: "/api/evaluate", method: ["POST"] };
