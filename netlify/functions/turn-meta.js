import { MIN_ENDING_TURNS, briefBlock, metCriteriaEnum } from "./_prompts.js";
import { createWithFallback, errorResponse, getEnv, json, readJson, saveToSupabase } from "./_shared.js";

// Realtime 학부모가 말한 뒤, 그 턴의 판정(미해결 요구·수행 요소·자연 종료)만 따로 계산합니다.
// 음성은 이 판정을 기다리지 않으므로 학부모 목소리가 늦어지지 않습니다.
const format = {
  type: "json_schema",
  json_schema: {
    name: "parent_turn_meta",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ended: { type: "boolean" },
        metCriteria: { type: "array", items: { type: "string", enum: metCriteriaEnum } },
        openIssues: { type: "array", items: { type: "string" } }
      },
      required: ["ended", "metCriteria", "openIssues"]
    }
  }
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.system || !Array.isArray(body.messages)) return json({ error: "system and messages are required" }, 400);
  try {
    const teacherTurns = Number(body.teacherTurns || 0);
    const parentType = String(body.parentType || "학부모");
    const prior = Array.isArray(body.openIssues) ? body.openIssues.map(String).filter(Boolean) : [];
    const convo = body.messages.map((m) => `${m.role === "assistant" ? "학부모" : "교사"}: ${String(m.content || "")}`).join("\n");
    const system = `${body.system}
${briefBlock(body.brief)}
[판정 작업]
위 설정의 학부모(${parentType})와 교사의 통화 기록을 보고, 마지막 학부모 발화 시점의 상태를 판정합니다. 대사는 쓰지 않습니다.
- openIssues: 위 [선택된 학부모 유형]의 "핵심 관심사"와 [상황 핵심 정리]의 "학부모의 구체적 요구"에 비추어, 학부모가 아직 답을 받지 못했거나 만족하지 못한 요구·질문을 짧은 구로 나열합니다.
  이전 미해결 요구(${prior.length ? prior.join(" / ") : "없음"}) 중 교사 발화로 해결된 것은 제거하고, 새로 생긴 요구는 추가합니다. 모두 해결됐으면 빈 배열입니다.
  가벼운 유형(협력형·걱정형)은 교사가 사실을 확인하고 공감하면 쉽게 해소되지만, 까다로운 유형(요구형·압박형)은 구체적인 근거·기준·절차를 실제로 받기 전까지 해당 항목을 남겨 둡니다. 실제로 받은 항목은 즉시 제거합니다.
- metCriteria: 마지막 교사 발화에서 관찰된 수행요소만 넣습니다.
- ended: 학부모가 마지막 발화에서 실제로 대화를 마무리했고, 위 유형의 "안정 조건"이 충족됐으며 openIssues가 비어 있을 때만 true입니다.
- 교사 발화가 ${MIN_ENDING_TURNS}회 미만이면 ended는 false입니다. (현재 ${teacherTurns}회)`;
    const raw = await createWithFallback({
      model: getEnv("OPENAI_META_MODEL") || "gpt-4.1-mini",
      system,
      input: `통화 기록:\n${convo}`,
      maxOutputTokens: 400,
      responseFormat: format
    }, "gpt-4.1-mini");
    const turn = JSON.parse(raw);
    const openIssues = Array.isArray(turn.openIssues) ? turn.openIssues.map(String).filter(Boolean) : [];
    const ended = teacherTurns >= MIN_ENDING_TURNS && Boolean(turn.ended) && openIssues.length === 0;
    const metCriteria = Array.isArray(turn.metCriteria) ? turn.metCriteria.filter((item) => metCriteriaEnum.includes(item)) : [];

    // 기록 저장(채팅 경로와 같은 테이블). 마지막 교사·학부모 발화를 남깁니다.
    if (body.sessionId) {
      const lastTeacher = [...body.messages].reverse().find((m) => m.role === "user");
      const lastParent = [...body.messages].reverse().find((m) => m.role === "assistant");
      if (lastTeacher && teacherTurns > 0) await saveToSupabase("simulation_messages", { session_id: body.sessionId, parent_type: parentType, situation: body.situation || null, role: "user", content: String(lastTeacher.content || "") });
      if (lastParent) await saveToSupabase("simulation_messages", { session_id: body.sessionId, parent_type: parentType, situation: body.situation || null, role: "assistant", content: String(lastParent.content || "") });
    }
    return json({ ended, metCriteria, openIssues });
  } catch (error) {
    return errorResponse(error, "턴 판정을 하지 못했습니다.");
  }
};

export const config = { path: "/api/turn-meta", method: ["POST"] };
