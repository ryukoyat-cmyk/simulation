import { createOpenAIResponse, json, readJson, saveToSupabase } from "./_shared.js";

const metCriteriaEnum = [
  "공감적 의사소통",
  "사실 확인",
  "교육적 설명",
  "갈등 완화",
  "절차 준수",
  "교육활동 보호",
  "절차적 판단"
];

const chatTurnSchema = {
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
    const input = body.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }));

    const system = `
${body.system}

[현재 대화 상태]
- 현재까지 교사 응답 횟수: ${teacherTurns}회
- 교사 응답이 4회 미만이면 ended는 반드시 false입니다.
- 교사 응답이 4회 이상이어도 평가 영역 중 최소 4개 이상이 충분히 드러나지 않았으면 ended는 false입니다.
- ended가 true이면 text 안에 반드시 "대화가 마무리되었습니다."라는 문장을 자연스럽게 포함합니다.
- metCriteria에는 현재 대화에서 교사의 응답으로 의미 있게 충족된 평가 영역만 넣습니다.
- text에는 학부모가 실제로 말하는 내용만 넣습니다. JSON 외부에 어떤 설명도 쓰지 않습니다.
`.trim();

    const raw = await createOpenAIResponse({
      system,
      input,
      maxOutputTokens: body.maxTokens || 650,
      responseFormat: chatTurnSchema
    });

    const turn = JSON.parse(raw);
    const text = String(turn.text || "").trim();
    const ended = teacherTurns >= 4 && Boolean(turn.ended);
    const metCriteria = Array.isArray(turn.metCriteria)
      ? turn.metCriteria.filter((item) => metCriteriaEnum.includes(item))
      : [];

    const session_id = body.sessionId;
    if (session_id) {
      const latestUser = [...body.messages]
        .reverse()
        .find((m) => m.role === "user" && !String(m.content || "").startsWith("[대화를 시작합니다."));
      if (latestUser) {
        await saveToSupabase("simulation_messages", {
          session_id,
          parent_type: body.parentType || null,
          situation: body.situation || null,
          role: "user",
          content: String(latestUser.content || "")
        });
      }
      await saveToSupabase("simulation_messages", {
        session_id,
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
