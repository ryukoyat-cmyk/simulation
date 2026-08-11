import { createWithFallback, json, readJson } from "./_shared.js";

const items = ["요구 파악", "사실 확인", "공감적 표현", "명료한 설명", "감정적 상황 대응", "비대립적 의사소통", "쟁점 조정", "갈등 확대 방지", "사안 판단", "대응 범위 설정", "후속 절차 안내", "경계 설정", "이관·보고 판단", "대응 중단 판단"];
const schema = { type: "json_schema", json_schema: { name: "turn_feedback", strict: true, schema: { type: "object", additionalProperties: false, properties: { met: { type: "array", items: { type: "string", enum: items } }, next: { type: "array", items: { type: "string", enum: items } }, message: { type: "string" } }, required: ["met", "next", "message"] } } };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.teacherText || !Array.isArray(body?.messages)) return json({ error: "teacherText and messages are required" }, 400);
  try {
    const raw = await createWithFallback({
      model: process.env.OPENAI_TURN_FEEDBACK_MODEL || "gpt-5-mini",
      fallbackModel: "gpt-4.1-mini",
      reasoningEffort: "none",
      maxOutputTokens: 260,
      responseFormat: schema,
      system: "당신은 학부모 민원 대응 연습의 즉시 피드백 도우미입니다. 점수나 등급을 말하지 마세요. 방금 교사 발화에서 드러난 수행 요소(met)와 다음 발화에서 보완할 요소(next)를 각각 최대 2개 선택하고, 2문장 이내의 짧고 구체적인 메시지를 한국어로 작성하세요.",
      input: body.messages.map((m) => `${m.role === "teacher" ? "교사" : "학부모"}: ${m.content}`).join("\n")
    }, "gpt-4.1-mini");
    return json(JSON.parse(raw));
  } catch (error) {
    return json({ met: [], next: ["사실 확인"], message: "상대의 감정을 인정한 뒤, 구체적인 사실을 한 가지 더 확인해 보세요." });
  }
};

export const config = { path: "/api/turn-feedback", method: ["POST"] };
