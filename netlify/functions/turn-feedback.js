import { createWithFallback, getEnv, json, readJson } from "./_shared.js";
import { GUIDES, formatCitation } from "./_response_guides.js";

const items = ["요구 파악", "사실 확인", "공감적 표현", "명료한 설명", "감정적 상황 대응", "비대립적 의사소통", "쟁점 조정", "갈등 확대 방지", "사안 판단", "대응 범위 설정", "후속 절차 안내", "경계 설정", "이관·보고 판단", "대응 중단 판단"];
const guideIndex = new Map(GUIDES.map((g) => [g.id, g]));
const guideIdEnum = [...guideIndex.keys(), ""];
// 대안 문장을 모델이 새로 짓지 않고 여기 실린 표현에서 가져오게 합니다. evaluate.js와 같은 방식으로
// id로만 인용하게 해(자유 서술 대신) 쪽수를 지어낼 수 없게 만듭니다 — 서버가 실제 출처로 치환합니다.
const guidesBlock = GUIDES.map((g) => `- id:${g.id} [${g.tags.join(", ")}] ${g.title}: ${g.body} (${formatCitation(g.source)})`).join("\n");
const schema = { type: "json_schema", json_schema: { name: "turn_feedback", strict: true, schema: { type: "object", additionalProperties: false, properties: {
  met: { type: "array", items: { type: "string", enum: items } },
  next: { type: "array", items: { type: "string", enum: items } },
  message: { type: "string" },
  suggestion: { type: "string" },
  guideId: { type: "string", enum: guideIdEnum }
}, required: ["met", "next", "message", "suggestion", "guideId"] } } };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  const teacherText = String(body?.teacherText || "").trim();
  if (!teacherText || !Array.isArray(body?.messages)) return json({ error: "teacherText and messages are required" }, 400);

  const history = body.messages.slice(-8).map((m) => `${m.role === "teacher" ? "교사" : "학부모"}: ${m.content}`).join("\n");

  // 피드백은 대화 전체가 아니라 "방금 교사가 한 말"에 대한 것이어야 합니다.
  // 직전 발화를 프롬프트에서 따로 떼어 주지 않으면 매 턴 비슷한 일반론만 돌아옵니다.
  const system = `당신은 학부모 민원 대응 연습의 즉시 피드백 도우미입니다.

[피드백 대상]
아래 대화의 마지막 교사 발화 한 개만 평가합니다. 이전 발화나 대화 전체를 평가하지 마세요.

[작성 규칙]
- met: 방금 교사 발화에서 실제로 관찰된 요소만 최대 2개. 근거가 없으면 빈 배열로 둡니다. 추측으로 채우지 마세요.
- next: 지금 이 상황에서 바로 다음 발화에 이어가면 좋을 요소 최대 2개.
- message: 2문장 이내. 교사가 방금 한 말에서 실제로 쓴 표현을 짚어 주고, 다음에 무엇을 덧붙이면 좋을지 구체적으로 알려 줍니다.
- message는 일반론이 아니라 이 발화에만 해당하는 내용이어야 합니다. 교사가 쓴 말을 짧게 인용하거나 되짚어 주세요.
- 점수, 등급, 총평은 말하지 않습니다. 연습 중 짧게 읽는 안내이므로 담백하게 씁니다.
- suggestion: 지금 바로 다음 말에 쓸 수 있는 대사 1문장("이렇게 말해 보세요"에 들어갑니다). 아래 참고자료에 상황에 맞는 표현이 있으면 새로 짓지 말고 그 표현을 가져와 다듬어 씁니다. 방금 발화가 이미 충분히 적절해서 더할 게 없으면 빈 문자열("")로 둡니다.
- guideId: suggestion의 근거가 된 참고자료 조각의 id 하나. suggestion을 빈 문자열로 둔다면 guideId도 반드시 빈 문자열로 둡니다. 아래 목록에 없는 id를 지어내지 마세요.

[선택 가능한 요소]
${items.join(", ")}

[참고자료 — 아래 id만 guideId에 쓸 수 있습니다]
${guidesBlock}`;

  const input = `학부모 유형: ${body.parentType || "미선택"}
민원 상황: ${body.situation || "제공된 상황 없음"}

최근 대화:
${history || "(이전 대화 없음)"}

방금 교사가 한 말 (이 발화만 평가하세요):
${teacherText}`;

  try {
    const raw = await createWithFallback({
      model: getEnv("OPENAI_TURN_FEEDBACK_MODEL") || getEnv("OPENAI_CHAT_MODEL") || "gpt-4.1-mini",
      reasoningEffort: "low",
      maxOutputTokens: 650,
      responseFormat: schema,
      system,
      input
    }, "gpt-4.1-mini");
    const parsed = JSON.parse(raw);
    const guide = guideIndex.get(parsed.guideId) || null;
    return json({
      met: pick(parsed.met),
      next: pick(parsed.next),
      message: String(parsed.message || "").trim(),
      suggestion: guide ? String(parsed.suggestion || "").trim() : "",
      citation: guide ? { id: guide.id, title: guide.title, label: formatCitation(guide.source) } : null
    });
  } catch (error) {
    // 피드백은 연습을 막지 않아야 하므로 실패해도 200으로 안내만 바꿔 돌려줍니다.
    console.error("turn-feedback failed:", error.detail || error.message);
    return json({ met: [], next: [], message: "", degraded: true });
  }
};

function pick(value) {
  return Array.isArray(value) ? value.filter((item) => items.includes(item)).slice(0, 2) : [];
}

export const config = { path: "/api/turn-feedback", method: ["POST"] };
