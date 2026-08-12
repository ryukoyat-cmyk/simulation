import { createWithFallback, json, readJson, saveToSupabase } from "./_shared.js";

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
        }
      },
      required: ["text", "ended", "metCriteria"]
    }
  }
};

const parentProfiles = {
  cooperative: "정중하고 차분하다. 사실, 일정, 후속 조치를 순서대로 확인하며 학교와 함께 해결하려는 태도를 보인다. 모호하면 더 구체적으로 묻는다.",
  anxious: "불안과 염려가 높다. 금쪽이의 정서적 안전과 실제 상태를 반복해서 확인하고, 근거 있는 안심과 다음 확인 시점을 원한다.",
  avoidant: "이전 경험 때문에 조심스럽고 방어적이다. 처음에는 냉담하거나 짧게 말하지만, 판단 없이 들어 주면 사실을 조금씩 꺼낸다.",
  demanding: "권리, 기준, 절차를 중시한다. 학교가 할 수 있는 조치와 할 수 없는 조치, 담당자, 처리 기한을 명확히 요구한다.",
  pressure: "감정 강도가 높고 즉각적인 확인을 요구한다. 답이 모호하면 강하게 재요구하지만 욕설이나 협박은 하지 않는다. 공식 절차와 회신 시점이 분명하면 강도가 낮아진다.",
  "협력형": "정중하고 차분하다. 사실, 일정, 후속 조치를 순서대로 확인하며 학교와 함께 해결하려는 태도를 보인다. 모호하면 더 구체적으로 묻는다.",
  "걱정형": "불안과 염려가 높다. 금쪽이의 정서적 안전과 실제 상태를 반복해서 확인하고, 근거 있는 안심과 다음 확인 시점을 원한다.",
  "회피형": "이전 경험 때문에 조심스럽고 방어적이다. 처음에는 냉담하거나 짧게 말하지만, 판단 없이 들어 주면 사실을 조금씩 꺼낸다.",
  "요구형": "권리, 기준, 절차를 중시한다. 학교가 할 수 있는 조치와 할 수 없는 조치, 담당자, 처리 기한을 명확히 요구한다.",
  "압박형": "감정 강도가 높고 즉각적인 확인을 요구한다. 답이 모호하면 강하게 재요구하지만 욕설이나 협박은 하지 않는다. 공식 절차와 회신 시점이 분명하면 강도가 낮아진다."
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
    const input = body.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }));

    if (isInitial) {
      const text = buildInitialParentText(parentKey, parentType, situation);
      if (body.sessionId) {
        await saveToSupabase("simulation_messages", {
          session_id: body.sessionId,
          parent_type: parentType || null,
          situation: situation || null,
          role: "assistant",
          content: text
        });
      }
      return json({ text, ended: false, metCriteria: [] });
    }

    const system = `
${body.system}

[응답 제어]
- 현재까지 교사 발화 횟수: ${teacherTurns}회
- 선택된 학부모 유형: ${parentType}
- 유형별 말투 지침: ${parentProfiles[parentKey] || parentProfiles[parentType] || "선택된 학부모 유형의 설명을 따르세요."}
- 현재 민원 상황: ${situation || "제공된 상황 없음"}
- 내부 참고 맥락: ${situationContext || "제공된 참고 맥락 없음"}
- 당신은 항상 학부모 역할입니다. 교사처럼 조언, 평가, 수업 지시, 사과문 작성, 상담자 해설을 하지 마세요.
- 사용자는 항상 교사 역할입니다. 사용자의 발화를 학부모 발화로 오해하지 마세요.
- text는 반드시 학부모가 교사에게 직접 말하는 1인칭 발화여야 합니다.
- "학부모는", "학부모가", "사용자는", "교사는", "상황은"처럼 제3자 해설이나 시뮬레이션 설명을 쓰지 마세요.
- 현재 민원 상황을 바꾸거나 새 사건을 만들지 마세요. 성적, 시험, 수학, 친구관계 등 상황에 없는 쟁점을 새로 만들지 마세요.
- 첫 발화에서는 선택된 학부모 유형(${parentType})의 성향이 드러나야 합니다.
- 교사 발화가 4회 미만이면 ended는 반드시 false입니다.
- 교사 발화가 4회 이상이어도 대화가 자연스럽게 마무리되지 않았으면 ended는 false입니다.
- ended가 true이면 text에 "대화가 마무리되었습니다."라는 문장을 자연스럽게 포함합니다.
- metCriteria에는 바로 직전 교사 발화에서 관찰된 수행요소만 넣습니다. 점수는 절대 말하지 않습니다.
- text에는 학부모가 실제로 말하는 내용만 2~5문장으로 넣습니다. JSON 외 설명을 덧붙이지 마세요.
`.trim();

    const raw = await createWithFallback({
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      system,
      input,
      maxOutputTokens: body.maxTokens || 1200,
      responseFormat
    }, "gpt-4.1-mini");

    const turn = JSON.parse(raw);
    const text = String(turn.text || "").trim();
    const ended = teacherTurns >= 4 && Boolean(turn.ended);
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

    return json({ text, ended, metCriteria });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Chat failed" }, 500);
  }
};

export const config = {
  path: "/api/chat",
  method: ["POST"]
};

function buildInitialParentText(parentKey, parentType, situation) {
  const topic = cleanSituation(situation);
  const base = topic || "금쪽이와 관련해 학교에서 있었던 일을 확인하고 싶어 연락드렸습니다.";
  if (parentKey === "anxious" || parentType === "걱정형") {
    return `선생님, 저는 금쪽이 학부모입니다. ${base} 금쪽이가 집에 와서 많이 신경 쓰는 것 같아 걱정돼서요. 학교에서 실제로 어떤 일이 있었는지, 그리고 아이 상태를 어떻게 살펴봐 주실 수 있는지 확인하고 싶습니다.`;
  }
  if (parentKey === "avoidant" || parentType === "회피형") {
    return `선생님, 저는 금쪽이 학부모입니다. ${base} 예전에도 비슷한 이야기를 했을 때 명확히 정리되지 않았던 기억이 있어서 조금 조심스럽습니다. 이번에는 확인된 내용과 앞으로의 절차를 분명히 들을 수 있을까요?`;
  }
  if (parentKey === "demanding" || parentType === "요구형") {
    return `선생님, 저는 금쪽이 학부모입니다. ${base} 이 사안에 대해 학교가 확인한 사실, 교사가 대응할 수 있는 범위, 그리고 공식적인 처리 절차를 구체적으로 안내해 주세요. 언제까지 회신받을 수 있는지도 알고 싶습니다.`;
  }
  if (parentKey === "pressure" || parentType === "압박형") {
    return `선생님, 저는 금쪽이 학부모입니다. ${base} 이 부분은 그냥 넘어가기 어렵습니다. 지금 확인된 내용이 무엇인지, 누가 어떻게 확인할 건지, 언제까지 답을 주실 건지 바로 말씀해 주세요.`;
  }
  return `선생님, 저는 금쪽이 학부모입니다. ${base} 우선 학교에서 확인된 내용이 있는지 알고 싶습니다. 가능하면 사실관계와 앞으로의 확인 절차를 함께 정리해 주시면 좋겠습니다.`;
}

function cleanSituation(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^학부모는\s*/, "")
    .trim()
    .slice(0, 260);
}
