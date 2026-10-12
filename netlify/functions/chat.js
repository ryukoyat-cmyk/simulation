import { createWithFallback, errorResponse, getEnv, json, partialJsonString, readJson, saveToSupabase, streamOpenAIChat } from "./_shared.js";

// 학부모 대사는 자연스러운 구어체가 핵심이라 추론 모델보다 대화형 모델이 잘 맞습니다.
// 사이트에서 OPENAI_CHAT_MODEL로 따로 지정하면 그 값이 우선합니다.
// process.env 대신 getEnv를 쓰는 이유: Netlify Functions v2에서는 Netlify.env가 정본이라
// process.env만 읽으면 사이트에 등록한 모델이 조용히 무시되고 기본값으로 되돌아갑니다.
function chatModel() {
  return getEnv("OPENAI_CHAT_MODEL") || getEnv("OPENAI_MODEL") || "gpt-4.1";
}

// 자연 종료(ended)는 최소 턴 수 + settle 조건 + 미해결 요구 없음을 모두 요구합니다.
// 조건이 하나 늘었으니 최소 턴도 4 -> 5로 올려, 대화가 너무 이르게 끝나 보이지 않게 합니다.
const MIN_ENDING_TURNS = 5;

const metCriteriaEnum = [
  "요구 파악",
  "사실 확인",
  "공감적 표현",
  "명료한 설명",
  "감정적 상황 대응",
  "비대립적 의사소통",
  "쟁점 조정",
  "갈등 확대 방지",
  "사안 판단",
  "대응 범위 설정",
  "후속 절차 안내",
  "경계 설정",
  "이관·보고 판단",
  "대응 중단 판단"
];


// 사례집 원문은 교사가 쓴 기록(“제가 전화를 못 받았더니…”)이거나 3인칭 요약인 경우가 많습니다.
// 그대로 넣으면 모델이 화자를 혼동하거나 사건을 놓치므로, 읽는 법을 명시하고 핵심 정리(brief)를 함께 씁니다.
const SITUATION_RULES = `[상황을 읽는 법]
- 아래 민원 상황은 학부모가 아니라 교사나 제3자가 쓴 기록일 수 있습니다. 원문의 "저/제가/우리"는 교사일 수 있고, "아버님·어머님·학부모"로 불린 사람이 지금 당신이 연기하는 학부모입니다.
- 당신은 이 사건의 당사자인 학부모입니다. 원문에 적힌 학부모의 행동·요구·불만을 자신의 말로 직접 겪은 일처럼 말합니다.
- 모든 발화에 상황에 나오는 구체적 사실(누가, 무엇을, 언제, 어떻게) 중 최소 하나를 근거로 삼습니다. 상황과 무관한 일반적인 인사나 추상적 불만만 말하지 않습니다.
- 교사가 상황과 무관한 말을 하면 당황하거나 되묻고, 곧 원래 쟁점으로 돌아옵니다. 교사가 모르는 사실을 물으면 당신이 알 만한 범위에서만 답합니다.
- 상황에 없는 새 사건·인물·수치를 만들지 않습니다.`;

function briefBlock(brief) {
  const b = String(brief || "").trim();
  return b ? `\n[상황 핵심 정리 — 이 정리를 기준으로 계속 말합니다]\n${b}\n` : "";
}


// 요구형이 매 턴 기계적으로 새 요구를 만들지 않고, 교사의 답에 따라 수긍하거나 좁혀 가며 합의 쪽으로 움직이게 합니다.
function demandingTurnRules(parentKey, parentType) {
  if (parentKey !== "demanding" && parentType !== "요구형") return "";
  return `
[요구형 반응 규칙 — 직전 교사 발화를 먼저 평가한 뒤 말합니다]
- 미해결 요구 목록의 각 항목마다 직전 교사 발화가 (a) 구체적이고 타당하게 답했는지, (b) 일부만 답했는지, (c) 모호하거나 회피·번복했는지를 판단합니다.
- (a)이면 그 항목은 해결된 것으로 보고 짧게 수긍합니다. 예: "그 부분은 알겠습니다.", "그건 이해했습니다." 해결된 항목을 다시 꺼내거나 같은 요구를 반복하지 않습니다. openIssues에서도 즉시 제거합니다.
- (b)이면 받아들인 부분을 인정하고, 남은 부분만 구체적으로 되묻습니다.
- (c)일 때만 단호하게 근거·기준·절차를 다시 요구합니다. 감정적으로 몰아붙이지 않고 논리적으로 짚습니다.
- 발화 구조: [수긍 한 문장(해당할 때)] + [남은 쟁점 한두 개]. 한 번에 요구는 최대 두 개입니다.
- 새 요구는 원래 민원 상황이나 교사의 직전 답변에서 실제로 드러난 빈틈에서만 만듭니다. 요구를 늘리기 위해 새 쟁점을 만들지 마세요.
- 대화가 진행될수록 요구는 줄어듭니다. 남은 쟁점이 모두 해소되면 "그럼 그렇게 진행해 주세요" 식으로 합의·마무리 방향으로 말하고, 수긍할 때는 tone을 softened로 둡니다.`;
}

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "parent_simulation_turn",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        tone: {
          type: "string",
          enum: ["softened", "steady", "tense", "heated"],
          description: "이번 발화를 말할 때의 감정 강도. 같은 학부모 유형 안에서의 변화만 나타낸다. 교사 응대로 마음이 풀렸으면 softened, 변화 없으면 steady, 불만이 쌓이거나 답을 못 받아 날이 서면 tense, 크게 격해졌으면 heated."
        },
        text: { type: "string" },
        ended: { type: "boolean" },
        metCriteria: {
          type: "array",
          items: { type: "string", enum: metCriteriaEnum }
        },
        openIssues: {
          type: "array",
          items: { type: "string" },
          description: "학부모가 아직 받지 못한 요구·확인을 짧은 구로 나열. 모두 해결되었으면 빈 배열."
        }
      },
      required: ["tone", "text", "ended", "metCriteria", "openIssues"]
    }
  }
};

// 대사를 만들어지는 대로 한 줄씩(JSON) 흘려보냅니다.
//   {"t":"tone","tone":"tense"}  감정 강도가 정해지면 한 번
//   {"t":"text","text":"지금까지의 대사"}  대사가 늘어날 때마다
//   {"t":"done", ...최종 응답}  끝(비스트리밍 응답과 같은 모양)
//   {"t":"error","error":"..."}  실패
function ndjson(run) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try { await run(send); } catch (error) {
        console.error("Streaming chat failed:", error?.detail || error?.message);
        send({ t: "error", error: error?.code === "auth" ? error.message : "학부모 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요." });
      }
      controller.close();
    }
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.system || !Array.isArray(body.messages)) {
    return json({ error: "system and messages are required" }, 400);
  }

  try {
    const teacherTurns = Number(body.teacherTurns || 0);
    const isInitial = Boolean(body.initial);
    const parentType = String(body.parentType || "학부모");
    const parentKey = String(body.parentId || parentType);
    const situation = String(body.situation || "").trim();
    const situationContext = String(body.situationContext || situation).trim();
    const priorOpenIssues = Array.isArray(body.openIssues) ? body.openIssues.map(String).filter(Boolean) : [];
    const input = body.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }));

    if (isInitial) {
      const openingArgs = {
        system: body.system,
        parentKey,
        parentType,
        situation,
        situationContext,
        teacherType: String(body.teacherType || ""),
        schoolLevel: String(body.schoolLevel || ""),
        callerHonorific: String(body.callerSelf || body.callerHonorific || "")
      };
      const finishOpening = async ({ text, brief, degraded }) => {
        if (body.sessionId) {
          await saveToSupabase("simulation_messages", {
            session_id: body.sessionId,
            parent_type: parentType || null,
            situation: situation || null,
            role: "assistant",
            content: text
          });
        }
        return { text, brief: brief || "", ended: false, metCriteria: [], openIssues: [], tone: "steady", degraded };
      };
      if (body.stream) {
        return ndjson(async (send) => {
          const result = await createInitialParentText({ ...openingArgs, onText: (text) => send({ t: "text", text }) });
          send({ t: "done", ...(await finishOpening(result)) });
        });
      }
      return json(await finishOpening(await createInitialParentText(openingArgs)));
    }

    const system = `
${body.system}

${SITUATION_RULES}
${briefBlock(body.brief)}${demandingTurnRules(parentKey, parentType)}
[응답 제어]
- 현재까지 교사 발화 횟수: ${teacherTurns}회
- 현재 민원 상황: ${situation || "제공된 상황 없음"}
- 내부 참고 맥락: ${situationContext && situationContext !== situation ? situationContext : "위 민원 상황과 같음"}
- 이전까지 미해결 상태였던 학부모의 요구: ${priorOpenIssues.length ? priorOpenIssues.join(" / ") : "없음"}
- 당신은 항상 학부모 역할입니다. 교사처럼 조언, 평가, 수업 지시, 사과문 작성, 상담자 해설을 하지 마세요.
- 사용자는 항상 교사 역할입니다. 사용자의 발화를 학부모 발화로 오해하지 마세요.
- text는 반드시 학부모가 교사에게 직접 말하는 1인칭 발화여야 합니다.
- "학부모는", "학부모가", "사용자는", "교사는", "상황은"처럼 제3자 해설이나 시뮬레이션 설명을 쓰지 마세요.
- 현재 민원 상황을 바꾸거나 새 사건을 만들지 마세요. 성적, 시험, 수학, 친구관계 등 상황에 없는 쟁점을 새로 만들지 마세요.
- 첫 발화에서는 선택된 학부모 유형(${parentType})의 성향이 드러나야 합니다.
- openIssues: 위 [선택된 학부모 유형]의 "핵심 관심사"에 비추어, 학부모가 아직 답을 받지 못했거나
  만족하지 못한 요구·질문을 짧은 구로 나열하세요. 이전 미해결 요구 중 방금 교사 발화로 해결된 것은
  제거하고, 이번 턴에서 새로 생긴 요구가 있으면 추가합니다. 모두 해결됐으면 빈 배열로 둡니다.
  가벼운 유형(협력형·걱정형)은 교사가 사실을 확인하고 공감하면 쉽게 해소되지만, 까다로운 유형
  (요구형·압박형)은 구체적인 근거·기준·절차를 실제로 받기 전까지는 해당 항목을 남겨 두세요.
  구체적인 근거·기준·절차를 실제로 받은 항목은 즉시 제거합니다.
- 교사 발화가 ${MIN_ENDING_TURNS}회 미만이면 ended는 반드시 false입니다.
- 교사 발화가 ${MIN_ENDING_TURNS}회 이상이어도, openIssues가 비어 있지 않거나 위 [선택된 학부모 유형]의
  "안정 조건"이 실제로 충족되지 않았으면 ended는 false입니다. 최소 턴을 채웠다는 이유만으로 종료하지 마세요.
- ended가 true이면 text에 "대화가 마무리되었습니다."라는 문장을 자연스럽게 포함합니다.
- metCriteria에는 바로 직전 교사 발화에서 관찰된 수행요소만 넣습니다. 점수는 절대 말하지 않습니다.
- tone: 이번 발화의 감정 강도입니다. 직전 교사 응대가 학부모의 요구를 풀어 주면 softened, 평소 수준이면 steady, 답을 못 받아 불만이 쌓이면 tense, 크게 격해졌으면 heated입니다. 유형의 성격 범위 안에서만 변화시키고 text의 어조와 반드시 일치시키세요.
- text에는 학부모가 실제로 말하는 내용만 2~5문장으로 넣습니다. JSON 외 설명을 덧붙이지 마세요.
`.trim();

    const callOptions = { model: chatModel(), reasoningEffort: "low", system, input, maxOutputTokens: body.maxTokens || 1200, responseFormat };
    const finalize = async (raw) => {
      const turn = JSON.parse(raw);
      const text = String(turn.text || "").trim();
      const openIssues = Array.isArray(turn.openIssues) ? turn.openIssues.map(String).filter(Boolean) : [];
      // 서버가 최종 결정권을 가집니다. 모델이 ended:true를 내도 최소 턴이나 미해결 요구 조건을 만족하지
      // 못하면 무시합니다 — 모델의 판단 실수가 대화를 너무 이르게 끝내지 않도록 하는 안전장치입니다.
      const ended = teacherTurns >= MIN_ENDING_TURNS && Boolean(turn.ended) && openIssues.length === 0;
      const metCriteria = Array.isArray(turn.metCriteria)
        ? turn.metCriteria.filter((item) => metCriteriaEnum.includes(item))
        : [];

      // 기록 저장은 응답을 보낸 뒤에 해도 됩니다(스트리밍에서는 완료 신호를 먼저 보냅니다).
      const persist = async () => {
      if (body.sessionId) {
        const latestTeacher = [...body.messages].reverse().find((m) => m.role === "user");
        if (latestTeacher && !isInitial) {
          await saveToSupabase("simulation_messages", {
            session_id: body.sessionId,
            parent_type: body.parentType || null,
            situation: body.situation || null,
            role: "user",
            content: String(latestTeacher.content || "")
          });
        }
        await saveToSupabase("simulation_messages", {
          session_id: body.sessionId,
          parent_type: body.parentType || null,
          situation: body.situation || null,
          role: "assistant",
          content: text
        });
      }

      };
      const tone = ["softened", "steady", "tense", "heated"].includes(turn.tone) ? turn.tone : "steady";
      return { payload: { text, ended, metCriteria, openIssues, tone }, persist };
    };

    if (body.stream) {
      return ndjson(async (send) => {
        let sentText = "", toneSent = false, raw;
        try {
          raw = await streamOpenAIChat({
            ...callOptions,
            onContent: (content) => {
              const tone = partialJsonString(content, "tone");
              if (!toneSent && tone?.complete) { toneSent = true; send({ t: "tone", tone: tone.value }); }
              const text = partialJsonString(content, "text");
              if (text && text.value.length > sentText.length) { sentText = text.value; send({ t: "text", text: text.value }); }
            }
          });
        } catch (error) {
          if (sentText) throw error; // 이미 일부를 보냈으면 오류로 알립니다.
          raw = await createWithFallback(callOptions, "gpt-4.1-mini"); // 첫 조각 전 실패는 일반 호출로 대체합니다.
        }
        const { payload, persist } = await finalize(raw);
        send({ t: "done", ...payload });
        await persist();
      });
    }
    const { payload, persist } = await finalize(await createWithFallback(callOptions, "gpt-4.1-mini"));
    await persist();
    return json(payload);
  } catch (error) {
    return errorResponse(error, "학부모 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
};

export const config = {
  path: "/api/chat",
  method: ["POST"]
};

const openingFormat = {
  type: "json_schema",
  json_schema: {
    name: "parent_opening_line",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        brief: { type: "string", description: "상황 핵심 정리 2~3줄(짧게): 학부모가 겪은 구체적 사실, 학부모가 문제 삼는 점, 학부모의 요구. 학부모 시점의 평서문." },
        text: { type: "string" }
      },
      required: ["brief", "text"]
    }
  }
};

// 첫 발화는 화면에 표시되는 동시에 TTS로 낭독됩니다.
// 상황 서술문을 그대로 읽으면 대사와 지문이 섞여 들리므로, 학부모 자신의 말로 다시 말하게 합니다.
//
// 페르소나는 클라이언트(body.system, assets/app.js의 systemPrompt())가 유일한 출처입니다.
// 예전에는 여기서 parentProfiles라는 한 줄 요약을 따로 두고 있었는데, 그 요약이 클라이언트의
// 9개 필드짜리 상세 페르소나보다 뒤에 프롬프트에 다시 들어가 유형 특성을 희석시켰습니다.
// 이제는 body.system을 그대로 기반 삼고, 첫 발화에만 필요한 낭독 지침을 그 위에 덧붙입니다.
async function createInitialParentText({ system: personaSystem, parentKey, parentType, situation, situationContext, teacherType, schoolLevel, callerHonorific, onText }) {
  const fallback = { text: buildInitialParentText(parentKey, parentType, callerHonorific), degraded: true };
  if (!situation || !personaSystem) return fallback;

  const system = `
${personaSystem}

${SITUATION_RULES}

지금은 위 상황에서 학부모가 교사에게 처음 연락해 민원을 꺼내는 순간입니다.

[작성 순서]
1) brief: 먼저 위 상황을 학부모 시점으로 2~3줄로 짧게 정리합니다. (누가 / 무엇이 있었고 / 학부모가 무엇을 문제 삼으며 / 무엇을 요구하는지)
2) text: 그 정리를 바탕으로 첫 발화를 작성합니다. 첫 발화에는 상황의 구체 사실이 최소 하나 들어가야 합니다.

[말하기 방식]
지금은 학부모가 교사에게 전화를 걸어 첫 마디를 꺼내는 순간입니다. 이 발화는 음성으로 재생되므로,
글로 읽을 때가 아니라 귀로 들을 때 실제 통화처럼 들려야 합니다.

- 짧은 인사와 자기소개로 시작한 뒤 곧바로 용건을 꺼냅니다.
- 상황 설명문을 그대로 읽거나 요약하지 말고, 이 상황에서 지금 가장 문제 삼고 싶은 구체적 사실 하나를 자기 말로 꺼내세요.
  민원 내용을 처음부터 빠짐없이 늘어놓는 사람은 없지만, 상황과 상관없는 말로 시작해서도 안 됩니다.
- 말하듯 씁니다. 문장 길이가 들쭉날쭉해도 좋고, 완결된 문어체보다 실제 통화 말투가 낫습니다.
- 2~3문장으로 짧게 말합니다. 한 문장을 길게 늘이지 마세요.
- 교사에게 직접 말하는 1인칭으로만 씁니다. 자녀는 "금쪽이"로 부릅니다.
- 첫 문장부터 ${parentType}의 감정과 말투가 드러나야 합니다.

[자기소개] 자신을 "금쪽이 엄마/아빠"로 소개합니다. "금쪽이 어머니/아버지"라고 하지 마세요. 위 [민원을 제기하는 사람]의 자기소개 규칙을 따릅니다.

[좋은 예 - 걱정형 (말투와 길이만 참고하세요. 예시의 사건은 이 상황과 무관하니 절대 따라 쓰지 마세요)]
선생님, 안녕하세요. 금쪽이 엄마입니다. 다름이 아니라 어제 아이가 집에 와서는 말도 없이 방에만 있어서요. 혹시 학교에서 무슨 일 있었는지 여쭤보려고 전화드렸어요.

[나쁜 예 - 이렇게 쓰지 마세요 (형식 예시)]
학부모는 자녀가 교실에서 겪은 일에 대해 사실 확인과 후속 조치를 요청하고 있습니다. (제3자 해설)
선생님, 저는 금쪽이의 학부모로서 어제 발생한 교실 내 갈등 상황에 관하여 사실관계 확인 및 향후 조치 계획에 대해 문의드리고자 연락드렸습니다. (문어체 낭독문)

[금지]
- "학부모는", "학부모가", "상황은", "교사는" 같은 제3자 해설이나 시뮬레이션 설명
- 괄호, 따옴표, 목록 기호, 이모지, 영문 약어, 항목 나열
- 욕설, 협박, 혐오 표현
- 상황에 없는 새 사건이나 쟁점
`.trim();

  const options = {
    model: chatModel(),
    reasoningEffort: "low",
    system,
    input: "지금 교사에게 건네는 첫 민원 발화를 작성하세요.",
    maxOutputTokens: 1200,
    responseFormat: openingFormat
  };
  let partial = "";
  try {
    let raw;
    if (onText) {
      try {
        raw = await streamOpenAIChat({
          ...options,
          onContent: (content) => {
            const text = partialJsonString(content, "text");
            if (text && text.value.length > partial.length) { partial = text.value; onText(partial); }
          }
        });
      } catch (error) {
        if (partial) throw error;
        raw = await createWithFallback(options, "gpt-4.1-mini");
      }
    } else {
      raw = await createWithFallback(options, "gpt-4.1-mini");
    }
    const parsed = JSON.parse(raw);
    const text = String(parsed.text || "").trim();
    return text ? { text, brief: String(parsed.brief || "").trim(), degraded: false } : fallback;
  } catch (error) {
    console.warn("Initial parent utterance generation failed; using template.", error.message);
    // 이미 화면·음성으로 일부가 나갔다면 그 대사를 살립니다(다른 대사로 바꾸면 더 어색합니다).
    if (partial.trim()) return { text: partial.trim(), brief: "", degraded: false };
    return fallback;
  }
}

// 생성이 실패했을 때만 쓰는 대사입니다.
// 상황 설명문은 3인칭 서술이라 그대로 끼워 넣으면 지문을 낭독하는 것처럼 들리므로,
// 여기서는 상황을 인용하지 않고 학부모가 실제로 꺼낼 법한 말로만 시작합니다.
// 구체적인 상황은 화면 오른쪽 '민원 상황' 패널에 그대로 표시됩니다.
function buildInitialParentText(parentKey, parentType, callerHonorific) {
  // 클라이언트가 호칭(어머니/아버지)을 보내지 않은 경우에만 중립적인 "학부모"로 대체합니다.
  const who = String(callerHonorific || "").trim() || "학부모";
  if (parentKey === "anxious" || parentType === "걱정형") {
    return `선생님, 금쪽이 ${who}입니다. 어제 아이가 집에 와서 학교 이야기를 하는데 표정이 너무 안 좋아서요. 무슨 일이 있었던 건지, 아이는 지금 괜찮은 건지 여쭤보고 싶어서 연락드렸어요.`;
  }
  if (parentKey === "avoidant" || parentType === "회피형") {
    return `선생님, 금쪽이 ${who}입니다. 아이한테 이야기를 좀 들었는데요. 전에도 말씀드린 적이 있었지만 그때 별로 달라진 게 없어서, 솔직히 이번에는 어떨지 잘 모르겠습니다.`;
  }
  if (parentKey === "demanding" || parentType === "요구형") {
    return `선생님, 금쪽이 ${who}입니다. 아이한테 들은 이야기가 있어서 연락드렸습니다. 학교에서 확인하신 내용이 무엇인지, 그리고 어떤 기준으로 처리되는지 분명하게 알려 주시면 좋겠습니다.`;
  }
  if (parentKey === "pressure" || parentType === "압박형") {
    return `선생님, 금쪽이 ${who}입니다. 아이한테 이야기를 듣고 바로 전화드렸습니다. 이건 그냥 넘어갈 일이 아닌 것 같은데요, 지금 확인되는 게 뭔지부터 말씀해 주세요.`;
  }
  return `선생님, 금쪽이 ${who}입니다. 아이한테 들은 이야기가 있어서 연락드렸어요. 학교에서 확인된 내용이 있는지, 앞으로 어떻게 살펴봐 주실 수 있는지 여쭤보고 싶습니다.`;
}
