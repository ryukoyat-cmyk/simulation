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

// 육하원칙 + 교사가 이미 한 대응 + 학부모의 요구를 별도 필드로 받습니다.
// "사건 내용이 육하원칙으로 제시되지 않아서 어떤 일이 있었고 나는 어떤 대응을 했는지
// 알 수 없어 시작하기 어려웠다"는 지적에 대응합니다. situation/situationContext는
// 이 필드들을 서버에서 조합해 만들므로, 이 문자열만 쓰는 chat.js·evaluate.js는 그대로 둡니다.
const situationSchema = {
  type: "json_schema",
  json_schema: {
    name: "complaint_situation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        when: { type: "string", description: "예: 오늘 3교시 체육 수업 직후" },
        where: { type: "string", description: "예: 운동장 탈의실 앞" },
        who: { type: "string", description: "금쪽이와 관련된 다른 학생을 구체적으로. 예: 금쪽이와 같은 반 친구 두 명" },
        whatHappened: { type: "string", description: "실제 있었던 일을 한두 문장으로 구체적으로" },
        teacherAction: { type: "string", description: "교사가 사건 이후 이미 취한 대응. 없었다면 그 사실을 명시" },
        parentDemand: { type: "string", description: "학부모가 지금 이 통화에서 교사에게 확인·요구하는 것" },
        topic: { type: "string" },
        sourceIds: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["when", "where", "who", "whatHappened", "teacherAction", "parentDemand", "topic", "sourceIds"]
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
        "아래 6개 필드를 채우세요. 각 필드는 화면에 항목별로 따로 표시되므로, 다른 필드의 내용을 반복하지 마세요.",
        "- when: 시점을 구체적으로. '오늘 3교시 체육 수업 직후'처럼.",
        "- where: 장소를 구체적으로.",
        "- who: 금쪽이 외에 관련된 사람을 구체적으로(같은 반 친구, 다른 교사 등). 실명 대신 역할로.",
        "- whatHappened: 실제 있었던 일을 한두 문장으로. 추상적으로 뭉뚱그리지 말고 행동을 구체적으로 쓰세요.",
        "- teacherAction: 교사가 사건 이후 지금까지 이미 한 대응. 아직 아무 조치도 없었다면 '아직 특별한 조치를 하지 않았다'처럼 그 사실 자체를 씁니다. 이 필드가 비어 있으면 교사가 무엇을 했는지 알 수 없어 연습을 시작하기 어렵습니다.",
        "- parentDemand: 학부모가 지금 이 통화·대화에서 교사에게 구체적으로 확인하거나 요구하는 것 한 가지.",
        "- topic, sourceIds는 기존과 동일합니다."
      ].join("\n"),
      maxOutputTokens: 900,
      responseFormat: situationSchema
    });

    const parsed = JSON.parse(raw);
    const fields = normalizeFields(parsed);
    if (!fields.whatHappened) throw new Error("Generated situation was empty.");
    const { situation, situationContext } = renderSituationText(fields);

    return json({
      fields,
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

// 육하원칙 필드 각각을 화면에 항목별로 보여주면서, 동시에 chat.js·evaluate.js가 쓰는
// situation(짧은 요약)/situationContext(AI 학부모용 내부 맥락) 문자열도 여기서 조합합니다.
// 두 함수를 건드리지 않아도 되게 하려는 의도이므로, 필드가 바뀌어도 이 조합만 갱신하면 됩니다.
function normalizeField(value, max = 200) {
  return String(value || "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, " ").trim().slice(0, max);
}

function normalizeFields(parsed) {
  return {
    when: normalizeField(parsed?.when, 80),
    where: normalizeField(parsed?.where, 80),
    who: normalizeField(parsed?.who, 100),
    whatHappened: normalizeField(parsed?.whatHappened, 300),
    teacherAction: normalizeField(parsed?.teacherAction, 240),
    parentDemand: normalizeField(parsed?.parentDemand, 200)
  };
}

function renderSituationText(fields) {
  const situation = [
    `${fields.when || "최근"} ${fields.where ? fields.where + "에서" : ""} ${fields.whatHappened}`.replace(/\s+/g, " ").trim(),
    fields.parentDemand ? `학부모는 ${fields.parentDemand}` : ""
  ].filter(Boolean).join(" ");
  const situationContext = [
    fields.who ? `관련 인물: ${fields.who}` : "",
    `사건: ${fields.whatHappened}`,
    `교사의 기존 대응: ${fields.teacherAction || "아직 특별한 조치를 하지 않았다"}`,
    `학부모의 요구: ${fields.parentDemand}`
  ].filter(Boolean).join("\n");
  return { situation: situation.slice(0, 360), situationContext: situationContext.slice(0, 1100) };
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

// 생성이 실패했을 때만 쓰는 대체 시나리오입니다. 육하원칙 필드를 직접 채워 두어,
// 정상 생성 경로와 화면 표시 형태가 같습니다.
function buildFallbackScenario(schoolLevel, topic, angle) {
  const templates = {
    "초등학교": [
      { when: "오늘 점심시간 직후", where: "교실 안", who: "금쪽이와 옆자리 친구", whatHappened: "금쪽이의 필통이 바닥에 떨어졌고, 금쪽이는 옆자리 친구가 일부러 밀었다고 말했다.", teacherAction: "아직 특별한 조치를 하지 않았다.", parentDemand: "담임교사가 당시 상황을 확인했는지와 친구에게 어떤 지도를 했는지 설명해 달라고 요구한다." },
      { when: "방과후 수업 이동 시간", where: "운동장 쪽 이동 경로", who: "금쪽이와 같은 반 친구", whatHappened: "금쪽이가 친구와 말다툼을 한 뒤 울면서 혼자 귀가했다.", teacherAction: "이동 중 상황을 교사가 직접 보지 못해 아직 확인하지 못했다.", parentDemand: "아이가 왜 혼자 남겨졌는지, 학교가 안전하게 귀가를 확인했는지 묻는다." }
    ],
    "중학교": [
      { when: "어제 6교시 이후부터", where: "학급 단체 채팅방", who: "금쪽이와 같은 반 학생 여럿", whatHappened: "금쪽이를 놀리는 별명이 채팅방에 반복적으로 올라왔고, 오늘 아침 금쪽이가 등교를 망설였다.", teacherAction: "담임교사는 오늘 아침 이야기를 듣고 채팅 캡처를 확보해 둔 상태다.", parentDemand: "채팅 내용을 확인하고 관련 학생 지도와 재발 방지 절차를 안내해 달라고 요구한다." },
      { when: "오늘 체육 수업 직후", where: "탈의실 앞", who: "금쪽이와 친구 두 명", whatHappened: "금쪽이가 친구 두 명과 언성을 높였고, 이후 생활지도 기록이 남았다.", teacherAction: "담임교사가 당사자들을 불러 짧게 사실관계만 확인한 상태다.", parentDemand: "금쪽이만 지적받은 이유와 다른 학생 진술 확인 여부를 설명해 달라고 요구한다." }
    ],
    "고등학교": [
      { when: "지난주 수행평가 발표 이후", where: "교실(수업 시간)", who: "금쪽이와 같은 조 학생", whatHappened: "금쪽이가 받은 점수가 예상보다 낮았고, 같은 조 학생과 평가 기여도 문제로 갈등이 생겼다.", teacherAction: "아직 채점 기준을 개별적으로 설명하지 않았다.", parentDemand: "평가 기준과 조별 기여도 확인 방식, 이의 제기 절차를 구체적으로 안내해 달라고 요구한다." },
      { when: "오늘 아침 조회 전", where: "담임 확인 절차 상", who: "금쪽이", whatHappened: "금쪽이가 지각 처리된 사실을 알게 되었지만, 금쪽이는 버스 지연 때문에 담임에게 메시지를 보냈다고 주장한다.", teacherAction: "담임교사는 아직 메시지 수신 여부를 확인하지 못했다.", parentDemand: "출결 처리 근거와 정정 가능 여부를 확인해 달라고 요구한다." }
    ]
  };
  const pool = templates[schoolLevel] || templates["중학교"];
  const fields = pool[randomInt(pool.length)];
  const { situation, situationContext } = renderSituationText(fields);
  return { fields, situation, situationContext };
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
