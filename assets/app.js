"use strict";

const app = document.getElementById("app");
const $ = (id) => document.getElementById(id);

const copyrightHTML = `
  <footer class="copyright">
    <strong>© 2026 박재윤. All Rights Reserved.</strong>
    <span>본 웹페이지는 「초등교사의 학부모 소통 역량 강화를 위한 생성형 AI 기반 시뮬레이션 챗봇 개발」 연구의 일환으로 제작되었습니다.</span>
  </footer>
`;

const EVAL_DOMAINS = [
  {
    name: "공감적 의사소통",
    description: "학부모의 감정을 인정하며 적극적으로 경청하였는가?"
  },
  {
    name: "사실 확인",
    description: "추측을 배제하고 충분한 질문을 통해 객관적 사실을 확인하였는가?"
  },
  {
    name: "교육적 설명",
    description: "교육과정 및 생활 지도라는 객관적 근거로 상황을 설명하였는가?"
  },
  {
    name: "갈등 완화",
    description: "감정을 자극하는 표현을 자제하고 협력적인 해결 방안을 제안하여 갈등을 완화하였는가?"
  },
  {
    name: "절차 준수",
    description: "학교의 공식적인 상담 및 민원 처리 절차를 안내하고 준수하였는가?"
  },
  {
    name: "교육활동 보호",
    description: "교사의 권한을 벗어난 요구를 배제하며 교육활동 보호 원칙을 유지하였는가?"
  },
  {
    name: "절차적 판단",
    description: "담임교사의 지속적인 대응 여부, 관리자 이관의 필요성, 교육활동 침해 가능성을 종합적으로 판단하였는가?"
  }
];

const PARENT_TYPES = [
  {
    id: "cooperative",
    label: "협력형",
    image: "assets/personas/cooperative.webp",
    desc: "교사와 교육관을 공유하며, 상호 신뢰를 바탕으로 문제를 해결하려는 학부모 유형. 불만이 있어도 사실 확인과 협의를 우선하며, 협력적 소통의 기준이 되는 유형이다.",
    prompt: `협력형 학부모로 행동한다. 기본 정서는 차분함과 신뢰이며, 교사를 적으로 보지 않고 함께 문제를 풀고 싶어 한다. 말투는 정중하고 사실 확인 중심이며 "제가 혹시 잘못 이해한 부분이 있을까요?", "학교에서도 확인해 주시면 좋겠습니다"처럼 협의를 요청한다. 교사가 감정을 인정하고 사실 확인 절차와 교육적 근거를 제시하면 빠르게 안정되지만, 답변이 모호하면 추가 확인을 요청한다.`
  },
  {
    id: "anxious",
    label: "걱정형",
    image: "assets/personas/anxious.webp",
    desc: "자녀에 대한 높은 불안으로 반복적인 확인과 잦은 연락을 하는 학부모 유형. 적대감보다는 안심을 원하는 경향이 강하며, 공감과 적절한 경계 설정이 요구된다.",
    prompt: `걱정형 학부모로 행동한다. 핵심 정서는 불안과 확인 욕구이며 적대감보다는 안심을 원한다. 말투는 조심스럽지만 반복적이고, "제가 너무 예민한 걸까요?", "금쪽이가 괜찮은지 계속 걱정돼서요"처럼 같은 지점을 여러 번 확인한다. 교사가 공감 없이 절차만 말하면 불안이 커지고, 교사가 감정 인정, 확인 계획, 연락 범위를 함께 제시하면 점차 안정된다.`
  },
  {
    id: "avoidant",
    label: "회피형",
    image: "assets/personas/avoidant.webp",
    desc: "학교에 대한 낮은 신뢰와 효능감으로 소통을 회피하는 학부모 유형. 평소에는 불만을 드러내지 않다가 누적된 불만을 갑작스럽게 표출하거나 상급자에게 직접 제기하는 특성이 나타난다.",
    prompt: `회피형 학부모로 행동한다. 핵심 정서는 체념, 낮은 신뢰, 누적된 불만이다. 처음에는 말을 아끼거나 "말씀드려도 달라지는 게 있나요"처럼 방어적으로 반응한다. 평소 소통을 피하다가 쌓인 불만을 갑작스럽게 꺼내며, 교사가 세부 사실을 묻고 안전한 상담 구조를 만들면 조금씩 구체적으로 말한다. 교사가 재촉하거나 책임을 돌리면 관리자나 외부 기관에 바로 말하겠다는 방향으로 이동한다.`
  },
  {
    id: "demanding",
    label: "요구형",
    image: "assets/personas/demanding.webp",
    desc: "교육을 서비스로 인식하며, 권리와 규정을 근거로 교사의 전문적 판단에 개입하려는 학부모 유형. 특별한 요구나 예외 적용을 요구함.",
    prompt: `요구형 학부모로 행동한다. 핵심 정서는 권리 주장과 예외 요구이며, 교육을 서비스처럼 인식한다. 말투는 단정적이고 요구가 분명하며 "규정상 안 된다는 근거가 뭔가요?", "우리 아이에게는 예외가 필요합니다"처럼 교사의 전문적 판단에 개입한다. 교사가 교육적 근거, 공식 절차, 가능한 대안과 불가능한 요구의 경계를 명확히 설명하면 논리적으로 반응하지만, 모호하게 양보하면 요구 수준을 높인다.`
  },
  {
    id: "pressure",
    label: "압박형",
    image: "assets/personas/pressure.webp",
    desc: "언어적 공격, 협박, 반복적인 민원, 법적 대응 언급 등 행동 규범을 벗어난 방식으로 교사와 학교에 압박을 가하는 학부모 유형.",
    prompt: `압박형 학부모로 행동한다. 핵심 정서는 분노, 압박, 즉각적 해결 요구이다. 직접적인 욕설은 사용하지 않지만, "교육청에 민원을 넣겠습니다", "이 문제 책임지셔야 합니다", "녹취하고 있습니다"처럼 부담을 주는 표현을 사용한다. 교사가 감정에 휘말리거나 즉흥적으로 약속하면 압박을 강화하고, 교사가 차분하게 경청, 사실 확인, 공식 절차, 교육활동 보호의 경계를 제시하면 서서히 대화 가능한 수준으로 낮춘다.`
  }
];

function makeSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeInitialState() {
  return {
    screen: "title",
    selectedId: PARENT_TYPES[0].id,
    sessionId: makeSessionId(),
    situationMode: "",
    randomSituation: "",
    randomSituationContext: "",
    manualSituation: "",
    situation: "",
    situationContext: "",
    recentCaseIds: [],
    recentTopics: [],
    generatingSituation: false,
    privacyAcknowledgedAt: "",
    msgs: [],
    apiMsgs: [],
    loading: false,
    ended: false,
    metCriteria: [],
    evaluation: null,
    evaluating: false,
    sharing: false
  };
}

let S = makeInitialState();

function currentParent() {
  return PARENT_TYPES.find((p) => p.id === S.selectedId) || PARENT_TYPES[0];
}

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function selectedSituationText() {
  if (S.situationMode === "random") return S.randomSituation.trim();
  if (S.situationMode === "manual") return S.manualSituation.trim();
  return "";
}

function selectedSituationContext() {
  if (S.situationMode === "random") {
    return (S.randomSituationContext || S.randomSituation).trim();
  }
  if (S.situationMode === "manual") return S.manualSituation.trim();
  return "";
}

function countTeacherTurns() {
  return S.msgs.filter((m) => m.role === "teacher").length;
}

function buildSystem(situation, situationContext = S.situationContext || situation) {
  const parent = currentParent();
  const criteriaText = EVAL_DOMAINS.map((d, i) => `${i + 1}. ${d.name}: ${d.description}`).join("\n");
  return `
당신은 초등학교 학부모 민원 응대 연습을 위한 AI 학부모입니다. 사용자는 담임교사 역할을 수행합니다.

[반드시 지킬 설정]
- 학부모 유형: ${parent.label}
- 자녀 이름은 항상 "금쪽이"로 고정합니다. 다른 이름을 만들지 않습니다.
- 아래 민원 상황을 대화의 핵심 사건으로 삼고, 추상적인 불만이 아니라 구체적 장면, 요구, 감정, 확인 질문으로 전개합니다.
- 직접적인 욕설, 혐오 표현, 노골적 협박은 사용하지 않습니다. 다만 유형에 맞는 불안, 요구, 압박, 회피, 협력적 태도는 현실감 있게 표현합니다.
- 한 번에 너무 길게 말하지 말고 실제 통화나 상담 장면처럼 2~5문장으로 응답합니다.
- 사용자가 교사로서 한 말을 반영하여 감정이 완화되거나, 더 구체적인 사실을 제시하거나, 절차를 묻거나, 요구 수준을 조정합니다.

[학부모 페르소나 적용]
${parent.prompt}

[사용자 화면에 표시된 민원 상황 요약]
${situation}

[AI 내부 참고 상세 맥락]
${situationContext || situation}

[대화 전개 규칙]
- 첫 발화에서는 학부모가 교사에게 먼저 연락하여 민원의 핵심을 꺼냅니다.
- 교사가 공감 없이 방어하거나 단정하면 학부모의 불안, 요구, 압박, 회피가 강화됩니다.
- 교사가 감정 인정, 사실 확인 질문, 교육적 근거, 공식 절차, 교육활동 보호의 경계를 균형 있게 제시하면 점차 진정하거나 협의 가능성이 커집니다.
- 매 응답은 이전 교사 발화의 장점과 빈틈에 반응해야 하며, 같은 말을 기계적으로 반복하지 않습니다.

[종료 규칙]
- 교사 응답이 최소 4회 이상 오가기 전에는 대화를 종료하지 않습니다.
- 교사 응답이 4회 이상이고, 아래 평가 영역 중 최소 4개 이상이 대화 속에서 의미 있게 드러났다고 판단될 때만 대화를 마무리할 수 있습니다.
${criteriaText}
- 종료할 때는 학부모 발화 안에 "대화가 마무리되었습니다."라는 문장을 자연스럽게 포함합니다.
`.trim();
}

function render() {
  if (S.screen === "title") renderTitle();
  if (S.screen === "step1") renderStep1();
  if (S.screen === "step2") renderStep2();
  if (S.screen === "simulation") renderSim();
}

function renderTitle() {
  app.innerHTML = `
    <main class="page title-page">
      <section class="title-shell">
        <div class="title-hero">
          <h1 class="app-title">학부모 민원 응대<br>시뮬레이션</h1>
          <p class="app-subtitle">초등교사의 학부모 소통 역량 강화를 위한 생성형 AI 기반 연습 도구</p>
          <button class="btn-primary" id="startBtn">시작하기</button>
        </div>
        <article class="privacy-card title-notice glass">
          <p>안녕하세요. 본 프로그램은 초등교사의 학부모 민원 대응 역량 향상을 지원하기 위해 개발된 생성형 AI 기반 시뮬레이션입니다. 실제 학교에서 경험할 수 있는 다양한 민원 상황을 AI와의 대화를 통해 연습하고, 자신의 대응 과정을 점검하며 피드백을 받을 수 있습니다.</p>
          <h3 class="privacy-title">참여 전 확인해 주세요.</h3>
          <div class="privacy-checks" aria-label="참여 전 확인 사항">
            <div class="privacy-check"><span>☑</span><span>본 프로그램은 교육 및 학술 연구 목적으로 운영됩니다.</span></div>
            <div class="privacy-check"><span>☑</span><span>실제 학생, 학부모, 교사, 학교명, 연락처 등 개인정보는 입력하지 마십시오.</span></div>
            <div class="privacy-check"><span>☑</span><span>입력한 대화 내용과 AI의 평가 결과는 개인정보를 제외한 형태로 연구 및 시스템 개선을 위한 분석 자료로 활용될 수 있습니다.</span></div>
            <div class="privacy-check"><span>☑</span><span>모든 시뮬레이션은 가상의 상황을 기반으로 진행됩니다.</span></div>
          </div>
          <p>감사합니다. 여러분의 참여는 초등교사의 교육활동 보호와 학부모 민원 대응 지원을 위한 연구에 소중한 자료가 됩니다.</p>
        </article>
        ${copyrightHTML}
      </section>
    </main>
  `;
  $("startBtn").onclick = () => {
    S.privacyAcknowledgedAt = new Date().toISOString();
    S.screen = "step1";
    render();
  };
}

function renderStep1() {
  const cards = PARENT_TYPES.map((p) => `
    <button class="parent-card glass ${S.selectedId === p.id ? "selected" : ""}" data-id="${p.id}" type="button">
      <img class="persona-thumb" src="${p.image}" alt="${p.label}">
      <h3>${escHtml(p.label)}</h3>
      <p>${escHtml(p.desc)}</p>
    </button>
  `).join("");

  app.innerHTML = `
    <main class="page">
      <section class="page-center">
        <h2 class="step-title">[STEP1] 학부모 유형을 선택하세요</h2>
        <div class="card-grid">${cards}</div>
        <div class="btn-row">
          <button class="btn-secondary" id="s1Back">처음으로</button>
          <button class="btn-primary" id="s1Next">계속하기</button>
        </div>
        ${copyrightHTML}
      </section>
    </main>
  `;

  document.querySelectorAll(".parent-card").forEach((card) => {
    card.onclick = () => {
      S.selectedId = card.dataset.id;
      renderStep1();
    };
  });
  $("s1Back").onclick = () => {
    S = makeInitialState();
    render();
  };
  $("s1Next").onclick = () => {
    S.screen = "step2";
    render();
  };
}

function renderStep2() {
  const randomSelected = S.situationMode === "random";
  const manualSelected = S.situationMode === "manual";
  const canContinue = selectedSituationText().length > 0;

  app.innerHTML = `
    <main class="page">
      <section class="page-center">
        <h2 class="step-title">[STEP2] 민원 상황을 선택하세요</h2>
        <p class="step-copy">둘 중 하나를 선택해주세요. 랜덤 상황을 생성한 뒤 수정하거나, 사용자가 직접 민원 상황을 서술할 수 있습니다.</p>
        <div class="choice-grid">
          <section class="choice-panel glass ${randomSelected ? "selected" : ""}">
            <div class="choice-head">
              <h3>랜덤 상황 선택</h3>
              <button class="mode-button ${randomSelected ? "active" : ""}" id="chooseRandom">선택</button>
            </div>
            <p class="choice-help">주사위를 누르면 사례 기반 민원 상황이 생성됩니다. 생성된 상황은 아래에서 필요한 만큼 수정할 수 있습니다.</p>
            <button class="dice-button" id="diceBtn" type="button" aria-label="랜덤 상황 생성">⚂</button>
            <textarea class="situation-textarea" id="randomInput" placeholder="랜덤으로 생성된 민원 상황이 여기에 표시됩니다.">${escHtml(S.randomSituation)}</textarea>
          </section>
          <section class="choice-panel glass ${manualSelected ? "selected" : ""}">
            <div class="choice-head">
              <h3>사용자 직접 서술</h3>
              <button class="mode-button ${manualSelected ? "active" : ""}" id="chooseManual">선택</button>
            </div>
            <p class="choice-help">연습하고 싶은 민원 상황을 직접 작성합니다. 실제 학생, 학부모, 교사, 학교명 등 개인정보는 입력하지 마세요.</p>
            <textarea class="situation-textarea" id="manualInput" placeholder="예: 금쪽이가 쉬는 시간에 친구와 갈등을 겪은 뒤, 학부모가 담임교사의 지도 방식과 학급 안내 절차에 대해 강하게 문제를 제기하는 상황">${escHtml(S.manualSituation)}</textarea>
          </section>
        </div>
        <div class="btn-row">
          <button class="btn-secondary" id="s2Back">이전</button>
          <button class="btn-primary" id="s2Next" ${canContinue ? "" : "disabled"}>계속하기</button>
        </div>
        ${copyrightHTML}
      </section>
    </main>
  `;

  $("chooseRandom").onclick = () => {
    S.situationMode = "random";
    renderStep2();
  };
  $("chooseManual").onclick = () => {
    S.situationMode = "manual";
    renderStep2();
  };
  $("randomInput").onfocus = () => {
    S.situationMode = "random";
  };
  $("manualInput").onfocus = () => {
    S.situationMode = "manual";
  };
  $("randomInput").oninput = (e) => {
    S.randomSituation = e.target.value;
    S.situationMode = "random";
    $("s2Next").disabled = !selectedSituationText();
  };
  $("manualInput").oninput = (e) => {
    S.manualSituation = e.target.value;
    S.situationMode = "manual";
    $("s2Next").disabled = !selectedSituationText();
  };
  $("diceBtn").onclick = async () => {
    S.situationMode = "random";
    S.generatingSituation = true;
    renderStep2();
    try {
      const data = await callSituationAPI();
      S.randomSituation = data.situation || "";
      S.randomSituationContext = data.situationContext || data.context || data.detail || S.randomSituation;
      if (data.caseId) S.recentCaseIds = [data.caseId, ...S.recentCaseIds].slice(0, 24);
      if (Array.isArray(data.sourceIds)) S.recentCaseIds = [...data.sourceIds, ...S.recentCaseIds].slice(0, 24);
      if (data.topic) S.recentTopics = [data.topic, ...S.recentTopics].slice(0, 16);
    } catch (error) {
      console.error(error);
      S.randomSituation = "금쪽이가 수업 중 친구와 갈등을 겪은 뒤, 학부모가 담임교사의 생활지도 방식과 사실 확인 절차가 충분했는지 문제를 제기하는 상황입니다. 학부모는 학교가 아이의 입장을 제대로 들어주지 않았다고 느끼며, 구체적인 사실 확인과 향후 지도 계획을 요구합니다.";
      S.randomSituationContext = S.randomSituation;
    } finally {
      S.generatingSituation = false;
      renderStep2();
    }
  };
  $("s2Back").onclick = () => {
    S.screen = "step1";
    render();
  };
  $("s2Next").onclick = () => {
    const finalSituation = selectedSituationText();
    if (!finalSituation) return;
    S.situation = finalSituation;
    S.situationContext = selectedSituationContext() || finalSituation;
    S.privacyAcknowledgedAt = S.privacyAcknowledgedAt || new Date().toISOString();
    startSim();
  };

  if (S.generatingSituation) {
    const randomInput = $("randomInput");
    randomInput.value = "사례를 바탕으로 구체적인 민원 상황을 생성하는 중입니다...";
    randomInput.disabled = true;
    $("diceBtn").disabled = true;
  }
}

function renderSim() {
  const parent = currentParent();
  const teacherTurns = countTeacherTurns();
  const canEvaluate = teacherTurns >= 4 && !S.evaluating;
  const canShare = !!S.evaluation && !S.sharing;
  const disabledInput = S.loading || S.ended;

  app.innerHTML = `
    <main class="page">
      <section class="sim-page">
        <div class="capture-area" id="captureArea">
          <div class="sim-summary-bar glass">
            <div>
              <span>학부모 유형</span>
              <strong>${escHtml(parent.label)}</strong>
            </div>
            <div class="summary-situation">
              <span>상황</span>
              <p>${escHtml(S.situation)}</p>
            </div>
            <div class="turn-chip">교사 응답 ${teacherTurns}회</div>
          </div>
          <div class="sim-layout">
            <section class="chat-panel glass">
              <div class="chat-panel-head">
                <div class="box-label">대화 연습</div>
                ${S.ended ? `<span class="state-badge">대화 마무리</span>` : `<span class="state-badge muted">진행 중</span>`}
              </div>
              <div class="chat-history" id="chatHistory">
                ${renderMessages()}
                ${S.loading ? `<div class="msg msg-system">학부모가 응답을 준비하고 있습니다...</div>` : ""}
              </div>
              ${S.ended ? `<div class="end-notice">AI 학부모가 대화를 마무리했습니다. 이제 평가하기를 눌러 대응 과정을 점검할 수 있습니다.</div>` : ""}
              <div class="input-strip">
                <textarea class="teacher-input" id="teacherInput" placeholder="선생님으로서 응대해보세요. Enter는 줄바꿈이며, 전송 버튼을 눌러야 전송됩니다." ${disabledInput ? "disabled" : ""}></textarea>
                <button class="send-button" id="sendBtn" ${disabledInput ? "disabled" : ""}>전송</button>
              </div>
            </section>
            <aside class="right-panel glass">
              ${S.evaluation ? renderEvaluationPanel() : renderPracticePanel(parent, teacherTurns)}
            </aside>
          </div>
        </div>
        <div class="action-row">
          <button class="btn-secondary" id="homeBtn">처음으로</button>
          <button class="btn-outline" id="retryBtn">다시 시도</button>
          <button class="btn-primary" id="evalBtn" ${canEvaluate ? "" : "disabled"}>${S.evaluating ? "평가 중..." : "평가하기"}</button>
          <button class="btn-outline" id="shareBtn" ${canShare ? "" : "disabled"}>${S.sharing ? "저장 중..." : "공유하기(PNG)"}</button>
        </div>
        ${teacherTurns < 4 ? `<p class="min-note">평가하기는 교사 응답이 4회 이상 오간 뒤 활성화됩니다.</p>` : ""}
        ${copyrightHTML}
      </section>
    </main>
  `;

  $("homeBtn").onclick = () => {
    S = makeInitialState();
    render();
  };
  $("retryBtn").onclick = () => restartPractice();
  $("evalBtn").onclick = () => doEvaluate();
  $("shareBtn").onclick = () => downloadResultPng();
  const sendButton = $("sendBtn");
  if (sendButton) sendButton.onclick = () => doSend();

  requestAnimationFrame(() => {
    const chatHistory = $("chatHistory");
    if (chatHistory && !document.body.classList.contains("capture-mode")) {
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }
  });
}

function renderPracticePanel(parent, teacherTurns) {
  return `
    <section class="side-section">
      <div class="box-label">학부모 정보</div>
      <div class="side-persona">
        <img src="${parent.image}" alt="${parent.label}">
        <div>
          <h3>${escHtml(parent.label)}</h3>
          <p>${escHtml(parent.desc)}</p>
        </div>
      </div>
    </section>
    <section class="side-section">
      <div class="box-label">상황 상세</div>
      <p class="situation-view">${escHtml(S.situation)}</p>
    </section>
    <section class="side-section quiet-section">
      <div class="box-label">평가 안내</div>
      <p>평가 결과는 교사 응답이 4회 이상 오간 뒤 평가하기 버튼을 누르면 이곳에 표시됩니다.</p>
      <p class="min-note">현재 교사 응답 ${teacherTurns}회</p>
    </section>
  `;
}

function renderEvaluationPanel() {
  return `
    <section class="side-section evaluation-section">
      <div class="box-label">평가 결과</div>
      ${renderScore()}
      ${renderDomainTable()}
    </section>
    <section class="side-section feedback-section">
      <div class="box-label">종합 피드백</div>
      ${renderFeedback()}
    </section>
  `;
}

function renderMessages() {
  if (!S.msgs.length && !S.loading) {
    return `<div class="msg msg-system">대화를 시작하는 중입니다.</div>`;
  }
  return S.msgs.map((m) => {
    if (m.role === "teacher") return `<div class="msg msg-teacher">${escHtml(m.content)}</div>`;
    if (m.role === "system") return `<div class="msg msg-system">${escHtml(m.content)}</div>`;
    return `<div class="msg msg-parent">${escHtml(m.content)}</div>`;
  }).join("");
}

function renderScore() {
  if (!S.evaluation) {
    return `
      <div class="score-placeholder">맨 아래의 평가하기 버튼을 누르면 평가점수를 볼 수 있습니다.</div>
      <p class="min-note">총점은 교사 응답 횟수가 아니라 전체 대화 맥락과 대응 역량을 기준으로 0점부터 100점까지 산정됩니다.</p>
    `;
  }
  return `
    <div class="score-number">${Number(S.evaluation.score) || 0}점</div>
    <p class="score-placeholder">${escHtml(S.evaluation.summary || "")}</p>
  `;
}

function renderDomainTable() {
  const criteria = normalizeCriteria(S.evaluation?.criteria);
  const rows = criteria.map((item) => `
    <tr>
      <td>${escHtml(item.name)}</td>
      <td><span class="rating ${ratingClass(item.rating)}">${escHtml(item.rating || "-")}</span></td>
      <td>${escHtml(item.comment || "")}</td>
    </tr>
  `).join("");
  return `
    <table class="domain-table">
      <thead>
        <tr>
          <th>평가 영역</th>
          <th>진단</th>
          <th>근거</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderFeedback() {
  if (!S.evaluation) {
    return `<div class="feedback-placeholder">맨 아래의 평가하기 버튼을 눌러야 상세 피드백을 볼 수 있습니다.</div>`;
  }
  const strengths = (S.evaluation.strengths || []).map((v) => `<li>${escHtml(v)}</li>`).join("");
  const improvements = (S.evaluation.improvements || []).map((v) => `<li>${escHtml(v)}</li>`).join("");
  return `
    <p>${escHtml(S.evaluation.overallFeedback || S.evaluation.summary || "")}</p>
    ${strengths ? `<h3 class="box-label">잘한 점</h3><ul>${strengths}</ul>` : ""}
    ${improvements ? `<h3 class="box-label">보완할 점</h3><ul>${improvements}</ul>` : ""}
  `;
}

function normalizeCriteria(criteria) {
  const byName = new Map();
  if (Array.isArray(criteria)) {
    for (const item of criteria) {
      if (item && item.name) byName.set(item.name, item);
    }
  }
  return EVAL_DOMAINS.map((domain) => {
    const found = byName.get(domain.name) || {};
    return {
      name: domain.name,
      rating: found.rating || "-",
      comment: found.comment || (S.evaluation ? "해당 영역에 대한 근거가 충분히 제시되지 않았습니다." : "-")
    };
  });
}

function ratingClass(rating) {
  if (rating === "우수") return "rating-good";
  if (rating === "보통") return "rating-mid";
  if (rating === "미흡") return "rating-low";
  return "rating-low";
}

async function callSituationAPI() {
  const res = await fetch("/api/random-situation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      excludeCaseIds: S.recentCaseIds,
      recentTopics: S.recentTopics
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "랜덤 상황 생성에 실패했습니다.");
  return data;
}

async function callChatAPI(system, messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: S.sessionId,
      parentType: currentParent().label,
      situation: S.situation,
      situationContext: S.situationContext,
      system,
      messages,
      structured: true,
      teacherTurns: countTeacherTurns()
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "응답 생성에 실패했습니다.");
  if (typeof data === "string") return { text: data, ended: false, metCriteria: [] };
  if (data.text) return data;
  return { text: data.message || "응답을 생성하지 못했습니다.", ended: false, metCriteria: [] };
}

async function saveSelectedSituation() {
  try {
    await fetch("/api/save-situation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: S.sessionId,
        parentType: currentParent().label,
        situationMode: S.situationMode,
        situation: S.situation,
        situationContext: S.situationContext,
        privacyAcknowledgedAt: S.privacyAcknowledgedAt
      })
    });
  } catch (error) {
    console.warn("상황 저장을 건너뜁니다.", error);
  }
}

async function startSim() {
  const situation = S.situation.trim();
  if (!situation) return;

  S.msgs = [];
  S.apiMsgs = [];
  S.evaluation = null;
  S.ended = false;
  S.metCriteria = [];
  S.loading = true;
  S.screen = "simulation";
  render();

  saveSelectedSituation();

  try {
    const trigger = {
      role: "user",
      content: "[대화를 시작합니다. 학부모 역할로, 담임교사에게 연락한 첫 장면에서 자녀 \"금쪽이\"와 관련한 민원을 자연스럽게 제기해주세요.]"
    };
    const result = await callChatAPI(buildSystem(situation, S.situationContext), [trigger]);
    S.apiMsgs = [trigger, { role: "assistant", content: result.text }];
    S.msgs = [{ role: "parent", content: result.text }];
    S.ended = Boolean(result.ended) || /대화가\s*마무리되었습니다/.test(result.text);
    S.metCriteria = Array.isArray(result.metCriteria) ? result.metCriteria : [];
  } catch (error) {
    console.error(error);
    S.msgs = [{ role: "system", content: "초기 대화를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }];
  } finally {
    S.loading = false;
    renderSim();
  }
}

async function restartPractice() {
  S.sessionId = makeSessionId();
  S.privacyAcknowledgedAt = S.privacyAcknowledgedAt || new Date().toISOString();
  await startSim();
}

async function doSend() {
  const input = $("teacherInput");
  const text = input ? input.value.trim() : "";
  if (!text || S.loading || S.ended) return;

  S.msgs.push({ role: "teacher", content: text });
  S.apiMsgs.push({ role: "user", content: text });
  S.loading = true;
  S.evaluation = null;
  renderSim();

  try {
    const result = await callChatAPI(buildSystem(S.situation, S.situationContext), S.apiMsgs);
    S.apiMsgs.push({ role: "assistant", content: result.text });
    S.msgs.push({ role: "parent", content: result.text });
    S.ended = Boolean(result.ended) || /대화가\s*마무리되었습니다/.test(result.text);
    S.metCriteria = Array.isArray(result.metCriteria) ? result.metCriteria : S.metCriteria;
  } catch (error) {
    console.error(error);
    S.msgs.push({ role: "system", content: "응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  } finally {
    S.loading = false;
    renderSim();
  }
}

async function doEvaluate() {
  if (countTeacherTurns() < 4) {
    alert("평가하기는 교사 응답이 4회 이상 오간 뒤 사용할 수 있습니다.");
    return;
  }
  S.evaluating = true;
  renderSim();
  try {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: S.sessionId,
        parentType: currentParent().label,
        situation: S.situation,
        situationContext: S.situationContext,
        messages: S.msgs
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "평가 생성에 실패했습니다.");
    S.evaluation = normalizeEvaluation(data);
  } catch (error) {
    console.error(error);
    alert(error.message || "평가 생성 중 오류가 발생했습니다.");
  } finally {
    S.evaluating = false;
    renderSim();
  }
}

function normalizeEvaluation(data) {
  const score = Math.max(0, Math.min(100, Number(data.score) || 0));
  return {
    score,
    summary: data.summary || "",
    criteria: normalizeCriteria(data.criteria).map((item) => ({
      ...item,
      rating: ["우수", "보통", "미흡"].includes(item.rating) ? item.rating : "미흡"
    })),
    strengths: Array.isArray(data.strengths) ? data.strengths.slice(0, 5) : [],
    improvements: Array.isArray(data.improvements) ? data.improvements.slice(0, 5) : [],
    overallFeedback: data.overallFeedback || data.feedback || data.summary || ""
  };
}

async function downloadResultPng() {
  if (!S.evaluation || S.sharing) return;
  if (typeof window.html2canvas !== "function") {
    alert("PNG 저장 도구를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
    return;
  }
  S.sharing = true;
  renderSim();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const target = $("captureArea");
  if (!target) {
    S.sharing = false;
    renderSim();
    return;
  }

  document.body.classList.add("capture-mode");
  await new Promise((resolve) => setTimeout(resolve, 80));

  try {
    const canvas = await window.html2canvas(target, {
      backgroundColor: "#edf6fb",
      scale: 2,
      useCORS: true,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight
    });
    const link = document.createElement("a");
    link.download = `${formatDateForFile()}_결과.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    console.error(error);
    alert("PNG 저장 중 오류가 발생했습니다.");
  } finally {
    document.body.classList.remove("capture-mode");
    S.sharing = false;
    renderSim();
  }
}

function formatDateForFile() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

render();
