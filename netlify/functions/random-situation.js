import { createOpenAIResponse, getEnv, json, readJson } from "./_shared.js";
import { complaintCases, complaintCaseStats } from "./_complaint_cases.js";

const scenarioAngles = [
  "사실 확인 요구",
  "즉각 조치 요구",
  "교사의 설명 방식에 대한 불만",
  "가정과 학교의 책임 경계 논의",
  "친구 관계 갈등 중재 요구",
  "생활지도 결과에 대한 이의",
  "연락 시각과 응답 속도에 대한 불만",
  "학습 또는 평가 결과에 대한 이의",
  "안전 또는 보건 조치에 대한 문제 제기",
  "학교 절차를 잘 모르는 상태에서의 강한 요구"
];

const schoolContext = {
  "초등학교": "쉬는 시간, 급식, 준비물, 친구 관계, 돌봄·방과후, 담임교사와의 일상 소통",
  "중학교": "단체 채팅방, 수행평가, 생활지도, 친구 관계 갈등, 동아리·체육활동, 담임·교과교사 간 확인",
  "고등학교": "내신 평가, 진로·진학, 출결, 수행평가 공정성, 수업 태도 지도, 학교생활기록부 관련 민감성"
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
  const schoolLevel = body.schoolLevel || "중학교";
  const rawExcludeIds = Array.isArray(body.excludeCaseIds) ? body.excludeCaseIds : body.excludeIds;
  const rawExcludeTopics = Array.isArray(body.recentTopics) ? body.recentTopics : body.excludeTopics;
  const excludeIds = new Set(Array.isArray(rawExcludeIds) ? rawExcludeIds.slice(0, 120) : []);
  const excludeTopics = new Set(Array.isArray(rawExcludeTopics) ? rawExcludeTopics.slice(0, 8) : []);
  const selected = selectSourceCases(excludeIds, excludeTopics);
  const sourceTopic = selected[0]?.topic || "기타 민원";
  const angle = scenarioAngles[randomInt(scenarioAngles.length)];

  try {
    const raw = await createOpenAIResponse({
      model: getEnv("OPENAI_SCENARIO_MODEL") || getEnv("OPENAI_MODEL") || "gpt-4.1-mini",
      system: [
        "당신은 교사 민원 대응 시뮬레이션을 위한 현실적인 민원 상황 생성자입니다.",
        "실제 사례 조각을 직접 복사하지 말고, 개인정보와 고유 사건 정보를 제거한 새 가상 상황으로 재구성하세요.",
        "학생 이름은 반드시 '금쪽이'로만 쓰세요.",
        "학교명, 지역명, 실제 교직원 이름, 연락처, 병명 등 개인정보는 쓰지 마세요.",
        "너무 추상적인 표현을 피하고, 교사가 바로 응대 연습을 시작할 수 있도록 사건의 시간·장소·행동·학부모 요구를 구체화하세요.",
        "욕설, 협박, 폭력 표현은 교육적으로 순화해 쓰세요.",
        "응답은 JSON 스키마만 따르세요."
      ].join("\n"),
      input: [
        `학교급: ${schoolLevel}`,
        `학교급 맥락: ${schoolContext[schoolLevel] || schoolContext["중학교"]}`,
        `생성 관점: ${angle}`,
        "",
        "자료 기반 사례 조각:",
        selected.map(formatCase).join("\n\n"),
        "",
        "situation은 사용자 화면에 보일 2문장입니다.",
        "1문장에는 언제/어디서/금쪽이가 무엇을 했거나 겪었는지 넣으세요.",
        "2문장에는 학부모가 교사에게 무엇을 확인하거나 요구하는지 넣으세요.",
        "예: '오늘 3교시 체육 수업 뒤 탈의실 앞에서 금쪽이가 친구 두 명에게 놀림을 받았다고 말했습니다. 학부모는 당시 지도 상황과 재발 방지 조치를 오늘 중으로 설명해 달라고 요구하고 있습니다.'",
        "",
        "situationContext는 AI 학부모가 대화를 풍부하게 이어가기 위한 내부 참고 맥락입니다. 4~6문장으로 사건 배경, 학부모가 들은 정보, 교사가 확인해야 할 쟁점, 가능한 절차를 포함하세요."
      ].join("\n"),
      maxOutputTokens: 650,
      responseFormat: situationSchema
    });

    const parsed = JSON.parse(raw);
    const situationContext = normalizeContext(parsed.situationContext || parsed.situation);
    const situation = toDisplaySituation(parsed.situation, situationContext);
    if (!situation) throw new Error("Generated situation was empty.");

    return json({
      situation: ensureChildName(situation),
      situationContext: ensureChildName(situationContext),
      topic: String(parsed.topic || sourceTopic || angle),
      sourceTopic,
      angle,
      sourceIds: sourceIdsFrom(parsed.sourceIds, selected),
      stats: complaintCaseStats,
      generatedBy: "openai-case-corpus"
    });
  } catch (error) {
    console.error("random-situation fallback:", error);
    const fallback = buildFallbackScenario(schoolLevel, sourceTopic, angle);
    return json({
      ...fallback,
      topic: sourceTopic || angle,
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
  const selected = [];
  const shuffled = shuffle(pool);

  for (const item of shuffled) {
    if (selected.length >= 4) break;
    if (!selected.some(existing => existing.topic === item.topic) || selected.length < 2) selected.push(item);
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
    `요약: ${item.excerpt}`
  ].join("\n");
}

function toDisplaySituation(value, fallbackValue = "") {
  const normalized = normalizeSituation(value);
  const fallback = normalizeContext(fallbackValue);
  const sentences = splitSentences(`${normalized} ${fallback}`);
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
  return uniqueSentences.join(" ").trim().slice(0, 360);
}

function normalizeSituation(value) {
  return String(value || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, " ")
    .trim()
    .slice(0, 360);
}

function normalizeContext(value) {
  return String(value || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1100);
}

function splitSentences(value) {
  return String(value || "").match(/[^.!?。！？\n]+[.!?。！？]?/g) || [];
}

function ensureChildName(situation) {
  if (!situation) return situation;
  const replaced = situation.replace(/자녀|아이|우리 애|학생/g, "금쪽이");
  return replaced.includes("금쪽이") ? replaced : `금쪽이에 관해 ${replaced}`;
}

function sourceIdsFrom(ids, selected) {
  const allowed = new Set(selected.map(item => item.id));
  const cleaned = Array.isArray(ids) ? ids.filter(id => allowed.has(id)) : [];
  return [...new Set([...cleaned, ...selected.map(item => item.id)])];
}

function buildFallbackScenario(schoolLevel, topic, angle) {
  const templates = {
    "초등학교": [
      "오늘 점심시간 뒤 교실에서 금쪽이의 필통이 바닥에 떨어졌고, 금쪽이는 옆자리 친구가 일부러 밀었다고 말했습니다. 학부모는 담임교사가 당시 상황을 확인했는지와 친구에게 어떤 지도를 했는지 설명해 달라고 요구하고 있습니다.",
      "방과후 수업 이동 중 금쪽이가 운동장 쪽에서 친구와 말다툼을 한 뒤 울면서 귀가했습니다. 학부모는 아이가 왜 혼자 남겨졌는지, 학교가 안전하게 귀가를 확인했는지 묻고 있습니다."
    ],
    "중학교": [
      "어제 6교시 후 학급 단체 채팅방에서 금쪽이를 놀리는 별명이 반복적으로 올라왔고, 오늘 아침 금쪽이가 등교를 망설였다고 합니다. 학부모는 담임교사가 채팅 내용을 확인하고 관련 학생 지도와 재발 방지 절차를 안내해 달라고 요구하고 있습니다.",
      "오늘 체육 수업 뒤 탈의실 앞에서 금쪽이가 친구 두 명과 언성을 높였고, 이후 생활지도 기록이 남았습니다. 학부모는 금쪽이만 지적받은 이유와 다른 학생 진술 확인 여부를 설명해 달라고 요구하고 있습니다."
    ],
    "고등학교": [
      "지난주 수행평가 발표 후 금쪽이가 받은 점수가 예상보다 낮았고, 같은 조 학생과 평가 기여도 문제로 갈등이 생겼습니다. 학부모는 평가 기준과 조별 기여도 확인 방식, 이의 제기 절차를 구체적으로 안내해 달라고 요구하고 있습니다.",
      "오늘 아침 조회 전 금쪽이가 지각 처리된 사실을 알게 되었지만, 금쪽이는 버스 지연 때문에 담임에게 메시지를 보냈다고 주장합니다. 학부모는 출결 처리 근거와 정정 가능 여부를 확인해 달라고 요구하고 있습니다."
    ]
  };
  const pool = templates[schoolLevel] || templates["중학교"];
  const situation = pool[randomInt(pool.length)];
  return {
    situation,
    situationContext: `${situation} 학부모는 ${angle || topic} 관점에서 대화를 시작하며, 교사가 감정만 달래기보다 당시 사실관계와 확인 절차를 분명히 말해 주기를 기대합니다. 교사는 학생 진술, 주변 학생 확인, 관련 교사 확인, 후속 회신 시점을 차분히 정리해야 합니다.`
  };
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomInt(max) {
  if (max <= 0) return 0;
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(values);
  return values[0] ? values[0] % max : Math.floor(Math.random() * max);
}
