import { complaintCases, complaintCaseStats } from "./_complaint_cases.js";
import { json, readJson } from "./_shared.js";

// 실제 학부모 민원 사례집(2077건, 초등학교 대상)에서 무작위로 사례를 뽑아 줍니다.
// 주제 분류는 쓰지 않습니다. query가 있으면 원문에 그 글자가 들어 있는 사례만 대상으로 합니다.
// 원문은 재구성하지 않습니다. PDF 추출 때 생긴 구두점 앞 공백만 정리하고, 단어 내부의
// 띄어쓰기 오류는 원문 손상을 피하려고 손대지 않습니다.
const DRAW_SIZE = 3;
const MAX_EXCLUDE = 200;
const MAX_QUERY = 30;
// 실제 폭언·협박 표현이 들어 있다는 안내 배지를 붙이는 기준입니다(원문은 바꾸지 않습니다).
const ABUSE = /씨발|시발|새끼|죽이|죽여|죽고\s*싶|죽어|패\s*죽|밤길|\*\*|ㅅㅂ|ㅂㅅ|개\s*같/;

const squash = (text) => String(text || "").replace(/\s+/g, "");
const corpus = complaintCases.map((item) => {
  const title = cleanExtractSpacing(item.title);
  const excerpt = cleanExtractSpacing(item.excerpt);
  return { id: item.id, page: item.page, title, excerpt, hasAbuse: ABUSE.test(`${title} ${excerpt}`), haystack: squash(`${title}${excerpt}`) };
});

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = (await readJson(req)) || {};
  const needle = squash(String(body.query || "").slice(0, MAX_QUERY));
  const excludeIds = new Set(Array.isArray(body.excludeIds) ? body.excludeIds.slice(0, MAX_EXCLUDE) : []);

  const matches = needle ? corpus.filter((item) => item.haystack.includes(needle)) : corpus;
  let pool = matches.filter((item) => !excludeIds.has(item.id));
  // 다 보았으면 처음부터 다시 뽑을 수 있게 제외 목록을 무시합니다.
  if (!pool.length) pool = matches;

  const cases = pickRandom(pool, DRAW_SIZE).map(({ id, page, title, excerpt, hasAbuse }) => ({ id, page, title, excerpt, hasAbuse }));
  return json({ cases, total: matches.length, sourceName: complaintCaseStats.sourceName });
};

export const config = {
  path: "/api/cases",
  method: ["POST"]
};

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
