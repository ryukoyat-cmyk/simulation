import { createOpenAIResponse, json, readJson, saveToSupabase } from "./_shared.js";

const domainNames = [
  "공감적 의사소통",
  "사실 확인",
  "교육적 설명",
  "갈등 완화",
  "절차 준수",
  "교육활동 보호",
  "절차적 판단"
];

const evaluationSchema = {
  type: "json_schema",
  json_schema: {
    name: "teacher_response_evaluation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "integer", minimum: 0, maximum: 100 },
        summary: { type: "string" },
        criteria: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string", enum: domainNames },
              rating: { type: "string", enum: ["우수", "보통", "미흡"] },
              comment: { type: "string" }
            },
            required: ["name", "rating", "comment"]
          }
        },
        strengths: {
          type: "array",
          items: { type: "string" }
        },
        improvements: {
          type: "array",
          items: { type: "string" }
        },
        overallFeedback: { type: "string" }
      },
      required: ["score", "summary", "criteria", "strengths", "improvements", "overallFeedback"]
    }
  }
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  if (!Array.isArray(body?.messages) || !body.parentType || !body.situation) {
    return json({ error: "messages, parentType, and situation are required" }, 400);
  }

  const teacherTurns = body.messages.filter((m) => m.role === "teacher").length;
  if (teacherTurns < 4) {
    return json({ error: "교사 응답이 4회 이상이어야 평가할 수 있습니다." }, 400);
  }

  try {
    const convo = body.messages
      .map((m) => `${m.role === "parent" ? `학부모(${body.parentType})` : "교사"}: ${m.content}`)
      .join("\n\n");

    const raw = await createOpenAIResponse({
      system: `
당신은 초등교사의 학부모 민원 대응 역량을 평가하는 교육 컨설턴트입니다. 반드시 지정된 JSON 스키마로만 응답합니다.

[평가 원칙]
- 점수는 교사 응답 횟수로 주지 않습니다. 전체 대화 맥락, 표현의 질, 사실 확인의 충분성, 절차 판단, 교육활동 보호의 균형을 기준으로 0~100점에서 탄력적으로 산정합니다.
- 단순 인사, 짧은 공감 표현, 형식적 사과만 있는 답변은 높은 점수를 줄 수 없습니다. 예를 들어 "안녕하세요" 수준의 대응은 0~15점 범위로 평가합니다.
- 80점 이상은 최소 5개 평가 영역에서 구체적 근거가 있고, 감정 인정과 사실 확인, 교육적 설명, 절차 안내, 경계 설정이 대화 맥락에 맞게 결합된 경우에만 부여합니다.
- 60점 이상은 적어도 4개 평가 영역에서 의미 있는 대응이 확인되어야 합니다.
- 압박형 상황에서도 교사가 즉흥적 약속, 과도한 사과, 비교육적 양보를 하면 교육활동 보호와 절차적 판단을 낮게 평가합니다.
- 각 평가 영역은 반드시 우수, 보통, 미흡 중 하나로 진단하고, comment에는 실제 대화 내용과 연결된 구체적 근거를 씁니다.

[평가 영역]
1. 공감적 의사소통: 학부모의 감정을 인정하며 적극적으로 경청하였는가?
2. 사실 확인: 추측을 배제하고 충분한 질문을 통해 객관적 사실을 확인하였는가?
3. 교육적 설명: 교육과정 및 생활 지도라는 객관적 근거로 상황을 설명하였는가?
4. 갈등 완화: 감정을 자극하는 표현을 자제하고 협력적인 해결 방안을 제안하여 갈등을 완화하였는가?
5. 절차 준수: 학교의 공식적인 상담 및 민원 처리 절차를 안내하고 준수하였는가?
6. 교육활동 보호: 교사의 권한을 벗어난 요구를 배제하며 교육활동 보호 원칙을 유지하였는가?
7. 절차적 판단: 담임교사의 지속적인 대응 여부, 관리자 이관의 필요성, 교육활동 침해 가능성을 종합적으로 판단하였는가?
`.trim(),
      input: [
        `학부모 유형: ${body.parentType}`,
        `사용자 화면에 표시된 민원 상황 요약: ${body.situation}`,
        body.situationContext ? `AI 내부 참고 상세 맥락: ${body.situationContext}` : "",
        "",
        `대화 기록:\n${convo}`
      ].filter(Boolean).join("\n"),
      maxOutputTokens: 1500,
      responseFormat: evaluationSchema
    });

    const evaluation = JSON.parse(raw);
    evaluation.criteria = normalizeCriteria(evaluation.criteria);

    if (body.sessionId) {
      await saveToSupabase("simulation_evaluations", {
        session_id: body.sessionId,
        parent_type: body.parentType,
        situation: body.situation,
        score: evaluation.score,
        summary: evaluation.summary,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        conversation: {
          messages: body.messages,
          situationContext: body.situationContext || null,
          criteria: evaluation.criteria,
          overallFeedback: evaluation.overallFeedback
        }
      });
    }

    return json(evaluation);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Evaluation failed" }, 500);
  }
};

function normalizeCriteria(criteria) {
  const byName = new Map();
  if (Array.isArray(criteria)) {
    for (const item of criteria) {
      if (item && domainNames.includes(item.name)) byName.set(item.name, item);
    }
  }
  return domainNames.map((name) => {
    const item = byName.get(name);
    return {
      name,
      rating: item?.rating || "미흡",
      comment: item?.comment || "해당 영역에 대한 구체적 근거가 대화에서 충분히 확인되지 않았습니다."
    };
  });
}

export const config = {
  path: "/api/evaluate",
  method: ["POST"]
};
