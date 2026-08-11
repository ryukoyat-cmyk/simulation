import { createOpenAIResponse, json, readJson } from "./_shared.js";
import { complaintCases, complaintCaseStats } from "./_complaint_cases.js";

const scenarioAngles = [
  "사실 확인 요구",
  "즉각 조치 요구",
  "교사의 설명 방식에 대한 불만",
  "가정과 학교 책임 경계 혼동",
  "친구 관계 갈등 중재 요구",
  "생활지도 결과에 대한 항의",
  "연락 시간과 응답 속도에 대한 불만",
  "학습 또는 평가 결과에 대한 이의",
  "안전 또는 보건 조치에 대한 문제 제기",
  "학교 절차를 잘 모르는 상태에서의 강한 요구"
];

const topicAngles = {
  "학교폭력/교우관계": ["친구 관계 갈등 중재 요구", "사실 확인 요구", "즉각 조치 요구"],
  "연락/근무시간": ["연락 시간과 응답 속도에 대한 불만", "가정과 학교 책임 경계 혼동"],
  "수업방해/생활지도": ["생활지도 결과에 대한 항의", "교사의 설명 방식에 대한 불만"],
  "학습/평가": ["학습 또는 평가 결과에 대한 이의", "교사의 설명 방식에 대한 불만"],
  "안전/보건": ["안전 또는 보건 조치에 대한 문제 제기", "즉각 조치 요구"],
  "급식/물품": ["사실 확인 요구", "즉각 조치 요구"],
  "방과후/하교": ["가정과 학교 책임 경계 혼동", "즉각 조치 요구"],
  "특수/지원": ["학교 절차를 잘 모르는 상태에서의 강한 요구", "즉각 조치 요구"],
  "폭언/협박": ["교사의 설명 방식에 대한 불만", "학교 절차를 잘 모르는 상태에서의 강한 요구"]
};

const situationSchema = {
  type: "json_schema",
  json_schema: {
    name: "complaint_situation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        situation: { type: "string" },
        situationContext: { type: "string" },
        topic: { type: "string" },
        sourceIds: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["situation", "situationContext", "topic", "sourceIds"]
    }
  }
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = (await readJson(req)) || {};
  const rawExcludeIds = Array.isArray(body.excludeCaseIds) ? body.excludeCaseIds : body.excludeIds;
  const rawExcludeTopics = Array.isArray(body.recentTopics) ? body.recentTopics : body.excludeTopics;
  const excludeIds = new Set(Array.isArray(rawExcludeIds) ? rawExcludeIds.slice(0, 120) : []);
  const excludeTopics = new Set(Array.isArray(rawExcludeTopics) ? rawExcludeTopics.slice(0, 8) : []);
  const selected = selectSourceCases(excludeIds, excludeTopics);
  const sourceTopic = selected[0]?.topic || "기타 민원";
  const angle = selectAngle(sourceTopic);

  try {
    const raw = await createOpenAIResponse({
      system: [
        "당신은 초등교사의 학부모 민원 응대 시뮬레이션을 위한 연구용 민원 상황 생성자입니다.",
        "STEP1의 학부모 또는 교사 페르소나는 절대 고려하지 마세요. 페르소나와 민원 상황은 별개의 개념입니다.",
        "아래 실제 사례 조각을 직접 인용하지 말고, 개인정보와 고유 식별 정보를 제거하여 새로운 연습 상황으로 재구성하세요.",
        "자녀 이름은 반드시 \"금쪽이\"로 고정하세요.",
        "난이도 표현은 쓰지 마세요.",
        "폭언, 협박, 폭력 표현은 교육용으로 순화하고 선정적으로 쓰지 마세요.",
        "응답은 JSON 스키마만 따르세요."
      ].join("\n"),
      input: [
        `생성 관점: ${angle}`,
        "",
        "자료 기반 사례 조각:",
        selected.map(formatCase).join("\n\n"),
        "",
        "situation은 사용자 화면에 보일 2문장 요약입니다. 반드시 정확히 2문장으로 작성하세요.",
        "situation 1문장: 금쪽이에게 발생한 구체적 사건.",
        "situation 2문장: 학부모가 교사 또는 학교에 제기하는 핵심 문제.",
        "situationContext는 AI 학부모가 대화를 풍부하게 전개하기 위한 내부 참고 맥락입니다. 3~5문장으로 작성하고, 사건 배경, 학부모 요구, 교사가 확인할 쟁점을 포함하세요.",
        "교사가 바로 응대 연습을 시작할 수 있도록 구체적으로 쓰되, 원문 사례를 그대로 복제하거나 개인정보를 만들면 안 됩니다."
      ].join("\n"),
      maxOutputTokens: 450,
      responseFormat: situationSchema
    });

    const parsed = JSON.parse(raw);
    const situationContext = ensureChildName(normalizeContext(parsed.situationContext || parsed.situation));
    const situation = ensureChildName(toDisplaySituation(parsed.situation, situationContext));
    if (!situation) throw new Error("Generated situation was empty.");

    return json({
      situation,
      situationContext,
      topic: String(parsed.topic || selected[0]?.topic || angle),
      sourceTopic,
      angle,
      sourceIds: sourceIdsFrom(parsed.sourceIds, selected),
      stats: complaintCaseStats,
      generatedBy: "openai-case-corpus"
    });
  } catch (error) {
    console.error("random-situation fallback:", error);
    return json({
      situation: buildFallbackSituation(selected[0], angle),
      situationContext: buildFallbackContext(selected[0], angle),
      topic: selected[0]?.topic || angle,
      sourceTopic,
      angle,
      sourceIds: selected.map(item => item.id),
      stats: complaintCaseStats,
      generatedBy: "case-corpus-fallback"
    });
  }
};

export const config = {
  path: "/api/random-situation",
  method: ["POST"]
};

function selectSourceCases(excludeIds, excludeTopics) {
  const eligible = complaintCases.filter(item => !excludeIds.has(item.id));
  const topicFiltered = eligible.filter(item => !excludeTopics.has(item.topic));
  const pool = topicFiltered.length >= 20 ? topicFiltered : (eligible.length >= 20 ? eligible : complaintCases);
  const byTopic = new Map();

  for (const item of pool) {
    const topic = item.topic || "기타 민원";
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(item);
  }

  const topics = shuffle([...byTopic.keys()]);
  const selected = [];
  const primaryTopic = topics[0] || "기타 민원";
  const primaryCases = shuffle(byTopic.get(primaryTopic) || []);

  for (const item of primaryCases) {
    selected.push(item);
    if (selected.length >= 3) break;
  }

  for (const topic of topics.slice(1)) {
    const candidates = byTopic.get(topic);
    if (!candidates?.length) continue;
    selected.push(candidates[randomInt(candidates.length)]);
    if (selected.length >= 4) break;
  }

  while (selected.length < 4 && pool.length) {
    const candidate = pool[randomInt(pool.length)];
    if (!selected.some(item => item.id === candidate.id)) selected.push(candidate);
  }

  return selected;
}

function formatCase(item) {
  return [
    `[${item.id} | ${item.topic} | p.${item.page}]`,
    `제목: ${item.title}`,
    `요지: ${item.excerpt}`
  ].join("\n");
}

function normalizeSituation(value) {
  return String(value || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 320);
}

function toDisplaySituation(value, fallbackValue = "") {
  const normalized = normalizeSituation(value);
  const fallback = normalizeContext(fallbackValue);
  const sentences = [
    ...(normalized.match(/[^.!?。！？\n]+[.!?。！？]?/g) || [normalized]),
    ...(fallback.match(/[^.!?。！？\n]+[.!?。！？]?/g) || [])
  ];
  const uniqueSentences = [];
  const seen = new Set();
  for (const sentence of sentences) {
    const cleaned = sentence.trim();
    const key = cleaned.replace(/\s+/g, "");
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    uniqueSentences.push(cleaned);
    if (uniqueSentences.length >= 2) break;
  }
  return uniqueSentences
    .join(" ")
    .trim()
    .slice(0, 320);
}

function normalizeContext(value) {
  return String(value || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 900);
}

function ensureChildName(situation) {
  if (!situation || situation.includes("금쪽이")) return situation;
  const replaced = situation.replace(/자신의 자녀|자녀|우리 아이|아이|학생/, "금쪽이");
  return replaced.includes("금쪽이") ? replaced : `금쪽이와 관련해 ${replaced}`;
}

function sourceIdsFrom(ids, selected) {
  const allowed = new Set(selected.map(item => item.id));
  const cleaned = Array.isArray(ids) ? ids.filter(id => allowed.has(id)) : [];
  return [...new Set([...cleaned, ...selected.map(item => item.id)])];
}

function buildFallbackSituation(sourceCase, angle) {
  const topic = sourceCase?.topic || angle;
  return `금쪽이와 관련해 ${topic} 문제가 발생했다는 이유로 학부모가 담임교사에게 연락했습니다. 학부모는 학교가 사건을 충분히 확인하지 않았다고 느끼며 담임교사의 설명과 조치를 요구하고 있습니다.`;
}

function buildFallbackContext(sourceCase, angle) {
  const topic = sourceCase?.topic || angle;
  const title = sourceCase?.title ? ` 사례의 핵심은 "${sourceCase.title}"입니다.` : "";
  return `금쪽이와 관련해 ${topic} 문제가 발생했다는 이유로 학부모가 담임교사에게 연락했습니다.${title} 학부모는 학교가 사건을 충분히 확인하지 않았다고 느끼며, 친구 관계나 생활지도 과정에서 금쪽이가 불이익을 받았는지 설명을 요구합니다. 교사는 감정을 인정하면서도 실제 사실관계, 학교 절차, 향후 지도 계획을 차분히 확인해야 합니다.`;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function selectAngle(sourceTopic) {
  const candidates = topicAngles[sourceTopic] || scenarioAngles;
  return candidates[randomInt(candidates.length)];
}

function randomInt(max) {
  if (max <= 0) return 0;
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(values);
  return values[0] ? values[0] % max : Math.floor(Math.random() * max);
}
