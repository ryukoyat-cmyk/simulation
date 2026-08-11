import { createWithFallback, json, readJson, saveToSupabase } from "./_shared.js";

const metCriteriaEnum = ["요구 파악", "사실 확인", "공감적 표현", "명료한 설명", "감정적 상황 대응", "비대립적 의사소통", "쟁점 조정", "갈등 확대 방지", "사안 판단", "대응 범위 설정", "후속 절차 안내", "경계 설정", "이관·보고 판단", "대응 중단 판단"];

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "parent_simulation_turn",
    strict: true,
    schema: {
      type: "object", additionalProperties: false,
      properties: {
        text: { type: "string" },
        ended: { type: "boolean" },
        metCriteria: { type: "array", items: { type: "string", enum: metCriteriaEnum } }
      },
      required: ["text", "ended", "metCriteria"]
    }
  }
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.system || !Array.isArray(body.messages)) return json({ error: "system and messages are required" }, 400);

  try {
    const teacherTurns = Number(body.teacherTurns || 0);
    const isInitial = Boolean(body.initial);
    const input = body.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }));
    if (isInitial) input.push({ role: "user", content: "[시스템 진행 신호] 지금은 대화 시작입니다. 학부모 역할로만 첫 민원 발화를 하세요. 이 신호를 교사의 발화로 취급하지 마세요." });

    const system = `${body.system}\n\n[응답 제어]\n- 교사 발화는 현재 ${teacherTurns}회입니다. 4회 미만이면 ended는 반드시 false입니다.\n- 당신은 오직 학부모입니다. 교사의 조언, 평가, 수업 지시, 교사 역할의 사과를 하지 마세요.\n- text에는 학부모가 실제로 말할 문장만 2~5문장으로 씁니다.\n- metCriteria에는 바로 직전 교사 발화에서 분명히 드러난 항목만 담습니다.\n- 대화가 충분히 정리된 경우에만 ended를 true로 하고, 그때도 학부모의 자연스러운 마무리 발화만 제공합니다.`;
    const raw = await createWithFallback({ system, input, reasoningEffort: "none", maxOutputTokens: body.maxTokens || 1200, responseFormat }, "gpt-4.1-mini");
    const turn = JSON.parse(raw);
    const text = String(turn.text || "").trim();
    const ended = teacherTurns >= 4 && Boolean(turn.ended);
    const metCriteria = Array.isArray(turn.metCriteria) ? turn.metCriteria.filter((item) => metCriteriaEnum.includes(item)) : [];

    if (body.sessionId) {
      const latestTeacher = [...body.messages].reverse().find((m) => m.role === "user");
      if (latestTeacher && !isInitial) await saveToSupabase("simulation_messages", { session_id: body.sessionId, parent_type: body.parentType || null, situation: body.situation || null, role: "user", content: String(latestTeacher.content || "") });
      await saveToSupabase("simulation_messages", { session_id: body.sessionId, parent_type: body.parentType || null, situation: body.situation || null, role: "assistant", content: text });
    }
    return json({ text, ended, metCriteria });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Chat failed" }, 500);
  }
};

export const config = { path: "/api/chat", method: ["POST"] };

