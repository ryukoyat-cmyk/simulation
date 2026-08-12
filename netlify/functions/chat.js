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

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.system || !Array.isArray(body.messages)) {
    return json({ error: "system and messages are required" }, 400);
  }

  try {
    const teacherTurns = Number(body.teacherTurns || 0);
    const isInitial = Boolean(body.initial);
    const input = body.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }));

    if (isInitial) {
      input.push({
        role: "user",
        content: "[시스템 진행 신호] 지금부터 대화를 시작합니다. 학부모 역할로만 첫 민원 발화를 하세요. 이 신호를 교사의 발화로 취급하지 마세요."
      });
    }

    const system = `
${body.system}

[응답 제어]
- 현재까지 교사 발화 횟수: ${teacherTurns}회
- 당신은 항상 학부모 역할입니다. 교사처럼 조언, 평가, 수업 지시, 사과문 작성, 상담자 해설을 하지 마세요.
- 사용자는 항상 교사 역할입니다. 사용자의 발화를 학부모 발화로 오해하지 마세요.
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
