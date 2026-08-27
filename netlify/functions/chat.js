import { createWithFallback, errorResponse, getEnv, json, readJson, saveToSupabase } from "./_shared.js";

// 학부모 대사는 자연스러운 구어체가 핵심이라 추론 모델보다 대화형 모델이 잘 맞습니다.
// 사이트에서 OPENAI_CHAT_MODEL로 따로 지정하면 그 값이 우선합니다.
// process.env 대신 getEnv를 쓰는 이유: Netlify Functions v2에서는 Netlify.env가 정본이라
// process.env만 읽으면 사이트에 등록한 모델이 조용히 무시되고 기본값으로 되돌아갑니다.
function chatModel() {
  return getEnv("OPENAI_CHAT_MODEL") || getEnv("OPENAI_MODEL") || "gpt-4.1";
}

// 자연 종료(ended)는 최소 턴 수 + settle 조건 + 미해결 요구 없음을 모두 요구합니다.
// 조건이 하나 늘었으니 최소 턴도 4 -> 5로 올려, 대화가 너무 이르게 끝나 보이지 않게 합니다.
const MIN_ENDING_TURNS = 5;

const metCriteriaEnum = [
  "요구 파악",
  "사실 확인",
  "공감적 표현",
  "명료한 설명",
  "감정적 상황 대응",
  "비대립적 의사소통",
  "쟁점 조정",
  "갈등 확대 방지",
  "사안 판단",
  "대응 범위 설정",
  "후속 절차 안내",
  "경계 설정",
  "이관·보고 판단",
  "대응 중단 판단"
];

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "parent_simulation_turn",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
        ended: { type: "boolean" },
        metCriteria: {
          type: "array",
          items: { type: "string", enum: metCriteriaEnum }
        },
        openIssues: {
          type: "array",
          items: { type: "string" },
          description: "학부모가 아직 받지 못한 요구·확인을 짧은 구로 나열. 모두 해결되었으면 빈 배열."
        }
      },
      required: ["text", "ended", "metCriteria", "openIssues"]
    }
  }
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.system || !Array.isArray(body.messages)) {
    return json({ error: "system and messages are required" }, 400);
  }

  try {
    const teacherTurns = Number(body.teacherTurns || 0);
    const isInitial = Boolean(body.initial);
    const parentType = String(body.parentType || "학부모");
    const parentKey = String(body.parentId || parentType);
    const situation = String(body.situation || "").trim();
    const situationContext = String(body.situationContext || situation).trim();
    const priorOpenIssues = Array.isArray(body.openIssues) ? body.openIssues.map(String).filter(Boolean) : [];
    const input = body.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }));

    if (isInitial) {
      const { text, degraded } = await createInitialParentText({
        system: body.system,
        parentKey,
        parentType,
        situation,
        situationContext,
        teacherType: String(body.teacherType || ""),
        schoolLevel: String(body.schoolLevel || "")
      });
      if (body.sessionId) {
        await saveToSupabase("simulation_messages", {
          session_id: body.sessionId,
          parent_type: parentType || null,
          situation: situation || null,
          role: "assistant",
          content: text
        });
      }
      return json({ text, ended: false, metCriteria: [], openIssues: [], degraded });
    }

    const system = `
${body.system}

[응답 제어]
- 현재까지 교사 발화 횟수: ${teacherTurns}회
- 현재 민원 상황: ${situation || "제공된 상황 없음"}
- 내부 참고 맥락: ${situationContext || "제공된 참고 맥락 없음"}
- 이전까지 미해결 상태였던 학부모의 요구: ${priorOpenIssues.length ? priorOpenIssues.join(" / ") : "없음"}
- 당신은 항상 학부모 역할입니다. 교사처럼 조언, 평가, 수업 지시, 사과문 작성, 상담자 해설을 하지 마세요.
- 사용자는 항상 교사 역할입니다. 사용자의 발화를 학부모 발화로 오해하지 마세요.
- text는 반드시 학부모가 교사에게 직접 말하는 1인칭 발화여야 합니다.
- "학부모는", "학부모가", "사용자는", "교사는", "상황은"처럼 제3자 해설이나 시뮬레이션 설명을 쓰지 마세요.
- 현재 민원 상황을 바꾸거나 새 사건을 만들지 마세요. 성적, 시험, 수학, 친구관계 등 상황에 없는 쟁점을 새로 만들지 마세요.
- 첫 발화에서는 선택된 학부모 유형(${parentType})의 성향이 드러나야 합니다.
- openIssues: 위 [선택된 학부모 유형]의 "핵심 관심사"에 비추어, 학부모가 아직 답을 받지 못했거나
  만족하지 못한 요구·질문을 짧은 구로 나열하세요. 이전 미해결 요구 중 방금 교사 발화로 해결된 것은
  제거하고, 이번 턴에서 새로 생긴 요구가 있으면 추가합니다. 모두 해결됐으면 빈 배열로 둡니다.
  가벼운 유형(협력형·걱정형)은 교사가 사실을 확인하고 공감하면 쉽게 해소되지만, 까다로운 유형
  (요구형·압박형)은 구체적인 근거·기준·절차를 실제로 받기 전까지는 openIssues를 비우지 마세요.
- 교사 발화가 ${MIN_ENDING_TURNS}회 미만이면 ended는 반드시 false입니다.
- 교사 발화가 ${MIN_ENDING_TURNS}회 이상이어도, openIssues가 비어 있지 않거나 위 [선택된 학부모 유형]의
  "안정 조건"이 실제로 충족되지 않았으면 ended는 false입니다. 최소 턴을 채웠다는 이유만으로 종료하지 마세요.
- ended가 true이면 text에 "대화가 마무리되었습니다."라는 문장을 자연스럽게 포함합니다.
- metCriteria에는 바로 직전 교사 발화에서 관찰된 수행요소만 넣습니다. 점수는 절대 말하지 않습니다.
- text에는 학부모가 실제로 말하는 내용만 2~5문장으로 넣습니다. JSON 외 설명을 덧붙이지 마세요.
`.trim();

    const raw = await createWithFallback({
      model: chatModel(),
      reasoningEffort: "low",
      system,
      input,
      maxOutputTokens: body.maxTokens || 1200,
      responseFormat
    }, "gpt-4.1-mini");

    const turn = JSON.parse(raw);
    const text = String(turn.text || "").trim();
    const openIssues = Array.isArray(turn.openIssues) ? turn.openIssues.map(String).filter(Boolean) : [];
    // 서버가 최종 결정권을 가집니다. 모델이 ended:true를 내도 최소 턴이나 미해결 요구 조건을 만족하지
    // 못하면 무시합니다 — 모델의 판단 실수가 대화를 너무 이르게 끝내지 않도록 하는 안전장치입니다.
    const ended = teacherTurns >= MIN_ENDING_TURNS && Boolean(turn.ended) && openIssues.length === 0;
    const metCriteria = Array.isArray(turn.metCriteria)
      ? turn.metCriteria.filter((item) => metCriteriaEnum.includes(item))
      : [];

    if (body.sessionId) {
      const latestTeacher = [...body.messages].reverse().find((m) => m.role === "user");
      if (latestTeacher && !isInitial) {
        await saveToSupabase("simulation_messages", {
          session_id: body.sessionId,
          parent_type: body.parentType || null,
          situation: body.situation || null,
          role: "user",
          content: String(latestTeacher.content || "")
        });
      }
      await saveToSupabase("simulation_messages", {
        session_id: body.sessionId,
        parent_type: body.parentType || null,
        situation: body.situation || null,
        role: "assistant",
        content: text
      });
    }

    return json({ text, ended, metCriteria, openIssues });
  } catch (error) {
    return errorResponse(error, "학부모 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
};

export const config = {
  path: "/api/chat",
  method: ["POST"]
};

const openingFormat = {
  type: "json_schema",
  json_schema: {
    name: "parent_opening_line",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { text: { type: "string" } },
      required: ["text"]
    }
  }
};

// 첫 발화는 화면에 표시되는 동시에 TTS로 낭독됩니다.
// 상황 서술문을 그대로 읽으면 대사와 지문이 섞여 들리므로, 학부모 자신의 말로 다시 말하게 합니다.
//
// 페르소나는 클라이언트(body.system, assets/app.js의 systemPrompt())가 유일한 출처입니다.
// 예전에는 여기서 parentProfiles라는 한 줄 요약을 따로 두고 있었는데, 그 요약이 클라이언트의
// 9개 필드짜리 상세 페르소나보다 뒤에 프롬프트에 다시 들어가 유형 특성을 희석시켰습니다.
// 이제는 body.system을 그대로 기반 삼고, 첫 발화에만 필요한 낭독 지침을 그 위에 덧붙입니다.
async function createInitialParentText({ system: personaSystem, parentKey, parentType, situation, situationContext, teacherType, schoolLevel }) {
  const fallback = { text: buildInitialParentText(parentKey, parentType), degraded: true };
  if (!situation || !personaSystem) return fallback;

  const system = `
${personaSystem}

지금은 위 상황에서 학부모가 교사에게 처음 연락해 민원을 꺼내는 순간입니다.

[말하기 방식]
지금은 학부모가 교사에게 전화를 걸어 첫 마디를 꺼내는 순간입니다. 이 발화는 음성으로 재생되므로,
글로 읽을 때가 아니라 귀로 들을 때 실제 통화처럼 들려야 합니다.

- 짧은 인사와 자기소개로 시작한 뒤 곧바로 용건을 꺼냅니다.
- 상황 설명문을 요약하지 말고, 자기가 겪은 일 중 지금 가장 마음에 걸리는 것 하나만 꺼내세요.
  민원 내용을 처음부터 빠짐없이 늘어놓는 사람은 없습니다.
- 말하듯 씁니다. 문장 길이가 들쭉날쭉해도 좋고, 완결된 문어체보다 실제 통화 말투가 낫습니다.
- 2~3문장으로 짧게 말합니다. 한 문장을 길게 늘이지 마세요.
- 교사에게 직접 말하는 1인칭으로만 씁니다. 자녀는 "금쪽이"로 부릅니다.
- 첫 문장부터 ${parentType}의 감정과 말투가 드러나야 합니다.

[좋은 예 - 걱정형]
선생님, 안녕하세요. 금쪽이 엄마입니다. 다름이 아니라 어제 아이가 집에 와서는 말도 없이 방에만 있어서요. 혹시 학교에서 무슨 일 있었는지 여쭤보려고 전화드렸어요.

[나쁜 예 - 이렇게 쓰지 마세요]
학부모는 자녀가 교실에서 겪은 일에 대해 사실 확인과 후속 조치를 요청하고 있습니다. (제3자 해설)
선생님, 저는 금쪽이의 학부모로서 어제 발생한 교실 내 갈등 상황에 관하여 사실관계 확인 및 향후 조치 계획에 대해 문의드리고자 연락드렸습니다. (문어체 낭독문)

[금지]
- "학부모는", "학부모가", "상황은", "교사는" 같은 제3자 해설이나 시뮬레이션 설명
- 괄호, 따옴표, 목록 기호, 이모지, 영문 약어, 항목 나열
- 욕설, 협박, 혐오 표현
- 상황에 없는 새 사건이나 쟁점
`.trim();

  try {
    const raw = await createWithFallback({
      model: chatModel(),
      reasoningEffort: "low",
      system,
      input: "지금 교사에게 건네는 첫 민원 발화를 작성하세요.",
      maxOutputTokens: 900,
      responseFormat: openingFormat
    }, "gpt-4.1-mini");
    const text = String(JSON.parse(raw).text || "").trim();
    return text ? { text, degraded: false } : fallback;
  } catch (error) {
    console.warn("Initial parent utterance generation failed; using template.", error.message);
    return fallback;
  }
}

// 생성이 실패했을 때만 쓰는 대사입니다.
// 상황 설명문은 3인칭 서술이라 그대로 끼워 넣으면 지문을 낭독하는 것처럼 들리므로,
// 여기서는 상황을 인용하지 않고 학부모가 실제로 꺼낼 법한 말로만 시작합니다.
// 구체적인 상황은 화면 오른쪽 '민원 상황' 패널에 그대로 표시됩니다.
function buildInitialParentText(parentKey, parentType) {
  if (parentKey === "anxious" || parentType === "걱정형") {
    return "선생님, 금쪽이 엄마입니다. 어제 아이가 집에 와서 학교 이야기를 하는데 표정이 너무 안 좋아서요. 무슨 일이 있었던 건지, 아이는 지금 괜찮은 건지 여쭤보고 싶어서 연락드렸어요.";
  }
  if (parentKey === "avoidant" || parentType === "회피형") {
    return "선생님, 금쪽이 학부모입니다. 아이한테 이야기를 좀 들었는데요. 전에도 말씀드린 적이 있었지만 그때 별로 달라진 게 없어서, 솔직히 이번에는 어떨지 잘 모르겠습니다.";
  }
  if (parentKey === "demanding" || parentType === "요구형") {
    return "선생님, 금쪽이 학부모입니다. 아이한테 들은 이야기가 있어서 연락드렸습니다. 학교에서 확인하신 내용이 무엇인지, 그리고 어떤 기준으로 처리되는지 분명하게 알려 주시면 좋겠습니다.";
  }
  if (parentKey === "pressure" || parentType === "압박형") {
    return "선생님, 금쪽이 학부모입니다. 아이한테 이야기를 듣고 바로 전화드렸습니다. 이건 그냥 넘어갈 일이 아닌 것 같은데요, 지금 확인되는 게 뭔지부터 말씀해 주세요.";
  }
  return "선생님, 금쪽이 학부모입니다. 아이한테 들은 이야기가 있어서 연락드렸어요. 학교에서 확인된 내용이 있는지, 앞으로 어떻게 살펴봐 주실 수 있는지 여쭤보고 싶습니다.";
}
