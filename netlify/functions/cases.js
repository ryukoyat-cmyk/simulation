import { complaintCases, complaintCaseStats } from "./_complaint_cases.js";
import { json, readJson } from "./_shared.js";

// 실제 학부모 민원 사례집(2077건, 초등학교 대상)을 그대로 보여 주는 엔드포인트입니다.
// 사용자 요청에 따라 사례 원문을 재구성하지 않고 그대로 노출합니다. 다만 PDF 추출 과정에서
// 생긴 구두점 앞 공백(예: "학생은 , 화가")은 실제 있었던 일의 표현을 바꾸지 않는 범위에서만
// 정리합니다. 단어 내부의 띄어쓰기 오류(줄바꿈 정렬로 생긴 것)는 원문 손상을 피하기 위해
// 손대지 않습니다.
const SAMPLE_SIZE = 6;
const MAX_EXCLUDE = 200;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = (await readJson(req)) || {};
  const topic = String(body.topic || "").trim();
  const excludeIds = new Set(Array.isArray(body.excludeIds) ? body.excludeIds.slice(0, MAX_EXCLUDE) : []);

  if (!topic) {
    const counts = new Map();
    for (const item of complaintCases) counts.set(item.topic, (counts.get(item.topic) || 0) + 1);
    const topics = [...counts.entries()]
      .map(([name, count]) => ({ topic: name, count }))
      .sort((a, b) => b.count - a.count);
    return json({ topics, total: complaintCases.length, sourceName: complaintCaseStats.sourceName, schoolLevelOnly: "초등학교" });
  }

  const pool = complaintCases.filter((item) => item.topic === topic && !excludeIds.has(item.id));
  if (!pool.length) return json({ topic, cases: [], total: 0, sourceName: complaintCaseStats.sourceName });

  const picked = pickRandom(pool, SAMPLE_SIZE).map((item) => ({
    id: item.id,
    page: item.page,
    title: cleanExtractSpacing(item.title),
    excerpt: cleanExtractSpacing(item.excerpt)
  }));

  return json({
    topic,
    cases: picked,
    total: complaintCases.filter((item) => item.topic === topic).length,
    sourceName: complaintCaseStats.sourceName
  });
};

export const config = {
  path: "/api/cases",
  method: ["POST"]
};

// 구두점 앞뒤로 붙은 추출 공백만 정리합니다. 단어를 새로 붙이거나 떼지 않으므로
// 원문의 실제 표현은 그대로 유지됩니다.
function cleanExtractSpacing(text) {
  return String(text || "")
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function pickRandom(pool, count) {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function randomInt(max) {
  if (max <= 0) return 0;
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(values);
  return values[0] ? values[0] % max : Math.floor(Math.random() * max);
}
