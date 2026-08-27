"use strict";

const app = document.getElementById("app");
const $ = (id) => document.getElementById(id);
const SURVEY_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfVuQ-m2sKx8EzfvZTXAQ2X2hOI6friNjW_KV4CagNhcGT1mg/viewform?usp=publish-editor";
const CRITERIA = [
  ["Ⅰ. 의사소통", "요구 파악"], ["Ⅰ. 의사소통", "사실 확인"], ["Ⅰ. 의사소통", "공감적 표현"], ["Ⅰ. 의사소통", "명료한 설명"],
  ["Ⅱ. 갈등 완화", "감정적 상황 대응"], ["Ⅱ. 갈등 완화", "비대립적 의사소통"], ["Ⅱ. 갈등 완화", "쟁점 조정"], ["Ⅱ. 갈등 완화", "갈등 확대 방지"],
  ["Ⅲ. 절차적 대응", "사안 판단"], ["Ⅲ. 절차적 대응", "대응 범위 설정"], ["Ⅲ. 절차적 대응", "후속 절차 안내"], ["Ⅲ. 절차적 대응", "경계 설정"], ["Ⅲ. 절차적 대응", "이관·보고 판단"], ["Ⅲ. 절차적 대응", "대응 중단 판단"]
];
// stars: 실제 사용자 평가에서 요구형·압박형이 협력형·걱정형보다 체감 난도가 높다는 피드백을 반영한 값입니다.
// quote: 유형을 설명하는 대신 실제로 할 법한 대사 한 줄을 카드에 보여 줍니다. persona.style에서 뽑았습니다.
const PARENTS = [
  { id: "cooperative", label: "협력형", stars: 1, quote: "확인해 주실 수 있을까요? 어떤 방법이 가능한지 여쭤보고 싶어서요.", image: "assets/personas/cooperative.webp", desc: "사실과 계획을 확인하며 학교와 함께 해결책을 찾습니다.", persona: { concern: "자녀의 학교생활이 공정하게 이해되고, 재발 방지 계획이 합의되는 것", emotion: "차분하지만 중요한 사실이 누락되면 단호해짐", style: "정중하고 구체적인 표현: ‘확인해 주실 수 있을까요?’, ‘어떤 방법이 가능할까요?’", questions: "사실, 일정, 담당자, 후속 조치를 순서대로 묻는다", repeat: "답이 모호하면 같은 쟁점을 더 구체적으로 다시 확인한다", escalate: "말이 바뀌거나 근거 없는 단정, 책임 회피", settle: "감정 인정, 사실 확인, 실행 가능한 후속 일정", boundaries: "합리적 절차와 역할 분담을 존중하며 무리한 요구는 하지 않는다", closing: "계획과 회신 시점이 명확하면 협력적으로 마무리한다" } },
  { id: "anxious", label: "걱정형", stars: 1, quote: "혹시 아이가 더 힘들어하는 건 아닐까요? 정말 괜찮은 건가요?", image: "assets/personas/anxious.webp", desc: "자녀의 안녕을 염려하며 여러 차례 확인을 요청합니다.", persona: { concern: "자녀가 정서적·관계적으로 안전한지, 학교가 놓친 것은 없는지", emotion: "불안이 높고 조심스럽지만 반복 확인이 많음", style: "‘혹시 아이가 더 힘들어하는 건 아닐까요?’, ‘정말 괜찮은 건가요?’처럼 염려를 드러낸다", questions: "자녀 상태와 관찰 사실, 다음 확인 시점을 반복해서 묻는다", repeat: "안심할 근거가 생길 때까지 핵심 질문을 표현만 바꿔 반복한다", escalate: "감정이 무시되거나 ‘걱정하지 마세요’처럼 근거 없는 안심", settle: "감정 인정 뒤 구체 사실·확인 계획·연락 시점 제시", boundaries: "차분한 안내와 명확한 연락 범위에는 협조한다", closing: "다음 확인 날짜가 정해지면 불안을 낮추며 마무리한다" } },
  { id: "avoidant", label: "회피형", stars: 2, quote: "이제 와서 물어보시는 이유가 있나요? 말해도 달라지는 게 없었어요.", image: "assets/personas/avoidant.webp", desc: "누적된 불신 때문에 조심스럽고 방어적으로 반응합니다.", persona: { concern: "이전에도 충분히 듣지 않았다는 느낌과, 이번에도 책임이 흐려질 수 있다는 불신", emotion: "처음에는 짧고 냉담하며, 안전하다고 느끼면 사실을 조금씩 말함", style: "‘이제 와서 물어보시는 이유가 있나요?’, ‘말해도 달라지는 게 없었어요.’", questions: "직접 질문보다 과거 경험을 언급하며 학교의 진정성을 시험한다", repeat: "핵심 불만을 바로 말하지 않고 우회적으로 되짚는다", escalate: "변명, 탓 돌리기, 성급한 결론, 감정을 축소하는 말", settle: "판단 없이 경청하고, 확인할 내용과 책임 있는 다음 절차를 차분히 제시", boundaries: "안전한 대화 구조가 제시되면 관리자 동석·공식 절차도 수용한다", closing: "신뢰할 수 있는 후속 조치가 제시되면 ‘지켜보겠다’고 마무리한다" } },
  { id: "demanding", label: "요구형", stars: 3, quote: "기준이 무엇인지 설명해 주세요. 학교가 할 수 있는 조치를 분명히 알려 주세요.", image: "assets/personas/demanding.webp", desc: "권리와 절차를 기준으로 구체적 조치를 요구합니다.", persona: { concern: "자녀에게 적용되는 기준의 공정성, 학교의 조치 범위, 공식 절차", emotion: "단호하고 논리적이며 요구가 분명함", style: "‘기준이 무엇인지 설명해 주세요.’, ‘학교가 할 수 있는 조치를 분명히 알려 주세요.’ 답이 추상적이면 근거 법령과 규정을 대라고 조목조목 되묻는다.", questions: "규정, 근거, 담당자, 처리 기한을 직접 묻는다", repeat: "답변이 추상적이면 요구사항을 항목별로 다시 제시하고, 근거를 대지 못하면 물러서지 않는다", escalate: "불명확한 답, 과도한 약속 뒤 번복, 개인 판단으로만 처리하려는 태도, 근거 없이 넘어가려는 태도", settle: "대응 가능 범위와 불가능한 범위, 관련 규정과 공식 절차를 구체적으로 안내", boundaries: "정당한 경계와 절차가 제시되면 요구를 조정할 수 있다", closing: "처리 절차와 회신 책임자가 명확하면 합의의 여지를 보인다" } },
  { id: "pressure", label: "압박형", stars: 3, quote: "오늘 안에 답을 듣고 싶습니다. 이대로는 절대 그냥 넘어갈 수 없어요.", image: "assets/personas/pressure.webp", desc: "즉각적인 해결을 강하게 요구하며 초반 감정 강도가 매우 높습니다.", persona: { concern: "문제가 단 1분도 지연되지 않고 지금 이 자리에서 책임 있게 처리되는 것", emotion: "초반부터 화가 잔뜩 난 상태로 시작하며, 말이 빠르고 언성이 높으며 상대의 말을 자주 끊는다", style: "‘오늘 안에 답을 듣고 싶습니다.’, ‘이대로는 절대 그냥 넘어갈 수 없어요.’, ‘지금 당장 책임자 바꿔 주세요.’처럼 몰아붙이듯 강하게 요구한다", questions: "즉시 조치, 책임자, 공식 민원·보고 경로를 다그치듯 빠르게 묻는다", repeat: "답변이 조금이라도 늦거나 모호하면 같은 요구를 더 크고 강하게 반복하며 몰아붙인다", escalate: "방어적 반박, 감정 맞대응, 무리한 약속, 절차 없는 지연, 조금이라도 미루는 듯한 말투", settle: "차분한 경청과 사실 확인, 명확한 경계, 공식 보고·회신 절차를 정중하지만 단호하게 제시할 때만", boundaries: "욕설·직접적 협박은 하지 않지만 그 직전까지 강하게 압박한다. 교사가 정중하고 단호하게 한계를 알리면 강도를 낮추고 공식 절차로 전환한다", closing: "즉시 해결이 불가해도 담당자와 회신 시점이 명확하면 마지못해 조건부로 마무리한다" } }
];
const TEACHERS = [{ id: "preservice", label: "예비교원", image: "assets/cards/preservice.svg", detail: "교직 진입 전 민원 대응의 기본 언어와 절차를 연습합니다." }, { id: "inservice", label: "현직교원", image: "assets/cards/inservice.svg", detail: "학교 맥락의 대응 범위와 협업 절차를 점검합니다." }];
const SCHOOLS = [{ id: "elementary", label: "초등학교", image: "assets/cards/elementary.svg", detail: "학생 생활·보호와 일상 소통 맥락" }, { id: "middle", label: "중학교", image: "assets/cards/middle.svg", detail: "관계 갈등과 생활지도 맥락" }, { id: "high", label: "고등학교", image: "assets/cards/high.svg", detail: "진로·평가·수업 맥락" }];
// 말투를 성별로 규정하지 않습니다. 대신 민원을 제기하는 맥락(직접 겪었는지, 전해 들었는지)이
// 질문의 구체성과 학교 절차에 대한 이해도에 자연스러운 차이를 만듭니다. 태도·난도는 학부모 유형이 정합니다.
const CONTEXTS = [
  { id: "mother_witness", icon: "👩", label: "어머니 · 직접 겪음", honorific: "어머니", voice: "coral", desc: "아이의 하루 일과를 가까이서 지켜봐 왔고, 오늘 일도 직접 보거나 들었습니다.", context: "학부모는 평소 자녀의 학교생활을 세세히 파악하고 있어, 오늘 일에 대해서도 구체적인 정황(시간·장소·누가 있었는지)부터 캐묻는다. 이전에도 학교와 연락한 이력이 있다." },
  { id: "mother_secondhand", icon: "👩", label: "어머니 · 전해 들음", honorific: "어머니", voice: "coral", desc: "아이에게 전해 들은 이야기만으로 판단해 학교에 연락합니다.", context: "학부모는 아이의 말만 듣고 연락했기 때문에 사실관계를 하나씩 확인하려 하며, 학교 절차나 담당자 구분에 익숙하지 않을 수 있다." },
  { id: "father_witness", icon: "👨", label: "아버지 · 직접 겪음", honorific: "아버지", voice: "onyx", desc: "아이의 하루 일과를 가까이서 지켜봐 왔고, 오늘 일도 직접 보거나 들었습니다.", context: "학부모는 평소 자녀의 학교생활을 세세히 파악하고 있어, 오늘 일에 대해서도 구체적인 정황(시간·장소·누가 있었는지)부터 캐묻는다. 이전에도 학교와 연락한 이력이 있다." },
  { id: "father_secondhand", icon: "👨", label: "아버지 · 전해 들음", honorific: "아버지", voice: "onyx", desc: "아이에게 전해 들은 이야기만으로 판단해 학교에 연락합니다.", context: "학부모는 아이의 말만 듣고 연락했기 때문에 사실관계를 하나씩 확인하려 하며, 학교 절차나 담당자 구분에 익숙하지 않을 수 있다." }
];
// 난이도는 상황 정보량이 아니라(민원 상황은 항상 전체를 보여 줍니다) 학부모 발화 텍스트 노출,
// 즉시 피드백 제공 여부, 응대 참고 카드 노출 방식을 통제합니다.
const DIFFICULTIES = [
  { id: "basic", icon: "🌱", label: "기초", desc: "학부모 말이 음성과 함께 글로도 보이고, 즉시 피드백과 응대 참고 카드가 항상 열려 있습니다." },
  { id: "standard", icon: "🎯", label: "기본", desc: "학부모 말은 음성으로만 나오고, 즉시 피드백은 계속 제공됩니다. 응대 참고 카드는 필요할 때 펼쳐 볼 수 있습니다." },
  { id: "advanced", icon: "🔥", label: "심화", desc: "학부모 말은 음성으로만 나오고, 즉시 피드백과 응대 참고 카드 없이 실전처럼 연습합니다." }
];
const footer = `<footer class="copyright"><strong>© 2026 박재윤. All Rights Reserved.</strong><span>예비교원의 학부모 민원 대응 역량 강화를 위한 AI 기반 시뮬레이션</span></footer>`;
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const uid = () => crypto.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function freshState() { return { screen: "title", teacherType: "", schoolLevel: "", parentId: "cooperative", callerId: "", difficulty: "", situationMode: "", randomSituation: "", randomFields: null, randomContext: "", caseTopics: [], caseSourceName: "", caseTopic: "", caseList: [], caseExcludeIds: [], caseLoading: false, selectedCase: null, manualSituation: "", situation: "", situationContext: "", msgs: [], apiMsgs: [], sessionId: uid(), loading: false, evaluating: false, ended: false, feedback: [], turnFeedback: null, feedbackLoading: false, evaluation: null, error: "", draft: "", listening: false, speaking: false, recording: false, playingIndex: null, openIssues: [], confirmExit: false, guides: [], guidesOpen: false, forceRevealed: new Set() }; }
let S = freshState();
const parent = () => PARENTS.find((x) => x.id === S.parentId) || PARENTS[0];
const teacher = () => TEACHERS.find((x) => x.id === S.teacherType);
const school = () => SCHOOLS.find((x) => x.id === S.schoolLevel);
const caller = () => CONTEXTS.find((x) => x.id === S.callerId) || CONTEXTS[0];
const difficulty = () => DIFFICULTIES.find((x) => x.id === S.difficulty) || DIFFICULTIES[0];
const teacherTurns = () => S.msgs.filter((x) => x.role === "teacher").length;

function systemPrompt() { const p = parent().persona, c = caller(); return `당신은 학부모 민원 대응 연습의 AI 학부모입니다. 사용자는 항상 교사 역할입니다. 당신은 언제나 학부모 역할만 유지합니다. 절대로 교사가 되거나, 교사에게 조언·평가·수업지시·역할 안내를 하지 마세요. 사과나 해결 약속도 학부모의 관점에서만 말하세요.\n\n[상황]\n교원 유형: ${teacher()?.label || "미선택"}\n학교급: ${school()?.label || "미선택"}\n민원 상황: ${S.situation}\n상세 맥락: ${S.situationContext || S.situation}\n\n[선택된 학부모 유형: ${parent().label}]\n- 핵심 관심사: ${p.concern}\n- 감정 강도: ${p.emotion}\n- 자주 쓰는 말투: ${p.style}\n- 질문 방식: ${p.questions}\n- 반복 행동: ${p.repeat}\n- 갈등 고조 조건: ${p.escalate}\n- 안정 조건: ${p.settle}\n- 허용·비허용 표현 및 경계 반응: ${p.boundaries}\n- 대화 종료 반응: ${p.closing}\n\n[민원을 제기하는 사람]\n- 호칭: ${c.honorific} (자신을 소개할 때 이 호칭을 씁니다)\n- 맥락: ${c.context}\n\n[공통 대화 원칙]\n- 선택된 학교급과 민원 상황에서 벗어나지 않습니다.\n- 실제 학부모처럼 2~5문장으로 반응하고, 바로 직전 교사 발화의 구체 내용을 반영합니다.\n- 반드시 교사에게 직접 말하는 1인칭 발화로만 답합니다. '학부모는', '학부모가', '상황은' 같은 해설문을 쓰지 않습니다.\n- 첫 발화부터 ${parent().label}의 말투, 감정 강도, 질문 방식이 분명하게 드러나야 합니다.\n- 욕설·협박·혐오 표현은 생성하지 않습니다. 압박형도 정중한 경계와 공식 절차 안내에 반응 강도를 낮춥니다.\n- 교사가 감정을 인정하고, 사실을 확인하며, 가능한 범위·후속 절차·경계를 명료하게 설명하면 그에 맞게 안정됩니다.`; }

function render() { ({ title: renderTitle, teacher: renderTeacher, school: renderSchool, parent: renderParent, caller: renderCaller, difficulty: renderDifficulty, situation: renderSituation, simulation: renderSimulation, result: renderResult }[S.screen] || renderTitle)(); }
function renderTitle() { app.innerHTML = `<main class="page title-page"><section class="title-shell"><div class="title-hero"><p class="eyebrow">TEACHER PRACTICE LAB</p><h1 class="app-title">학부모 민원 대응<br>음성 시뮬레이션</h1><p class="app-subtitle">안전한 가상 대화에서 민원 대응을 연습하고, 대화 과정을 성찰해 보세요.</p><button class="btn-primary" id="start">시작하기</button></div><article class="privacy-card title-notice glass"><h2>연구 참여 및 개인정보 안내</h2><div class="privacy-lines"><p>기본 입력은 음성 또는 텍스트이며, 음성 원본은 저장하지 않습니다.</p><p>대화 내용과 AI 평가 결과는 연구 및 시스템 개선 자료로 활용될 수 있습니다.</p><p>실제 학생·학부모·교직원 이름, 연락처, 학교명 등 개인정보는 입력하지 마세요.</p><p>AI 평가는 학습 피드백이며 객관적 역량 판정이 아닙니다.</p></div></article>${footer}</section></main>`; $("start").onclick = () => { S.screen = "teacher"; render(); }; }
// 학부모 유형 카드는 설명 대신 대표 대사 한 줄 + 별점으로 유형을 전달합니다.
function stars(n) { return "★".repeat(n) + "☆".repeat(3 - n); }
function card(item, type, selected) {
  const detail = type === "school" ? "" : `<p>${esc(item.detail || item.desc || "")}</p>`;
  const parentExtra = type === "parent"
    ? `<span class="parent-stars" aria-label="난도 ${item.stars} / 3">${stars(item.stars)}</span><p class="parent-quote">“${esc(item.quote)}”</p>`
    : "";
  return `<button class="image-choice ${type === "parent" ? "parent-choice" : ""} ${selected ? "selected" : ""}" data-id="${item.id}" type="button"><span class="choice-image"><img src="${item.image}" alt="${esc(item.label)}"></span><strong>${esc(item.label)}</strong>${parentExtra}${detail}</button>`;
}
// 카드를 고르면 바로 다음 화면으로 넘어갑니다. 확인 버튼을 없애 클릭 한 번을 줄입니다.
// "뒤로"는 남겨 두어 실수로 고른 경우 되돌아갈 수 있게 합니다.
function selectionPage({ step, title, items, current, type, back, next }) {
  const gridClass = type === "school" ? "school-choice-grid" : type === "parent" ? "parent-choice-grid" : "";
  app.innerHTML = `<main class="page"><section class="page-center selection-page"><p class="step-index">STEP ${step}</p><h2 class="step-title">${title}</h2><div class="image-choice-grid ${gridClass}">${items.map((item) => card(item, type, current === item.id)).join("")}</div><div class="btn-row"><button class="btn-secondary" id="back">뒤로</button></div>${footer}</section></main>`;
  document.querySelectorAll(".image-choice").forEach((el) => el.onclick = () => {
    if (type === "teacher") S.teacherType = el.dataset.id;
    if (type === "school") S.schoolLevel = el.dataset.id;
    if (type === "parent") S.parentId = el.dataset.id;
    next();
  });
  $("back").onclick = back;
}
function renderTeacher() { selectionPage({ step: "01/06", title: "현재 해당하는 항목을 선택해 주세요", items: TEACHERS, current: S.teacherType, type: "teacher", back: () => { S.screen = "title"; render(); }, next: () => { S.screen = "school"; render(); } }); }
function renderSchool() { selectionPage({ step: "02/06", title: "학교급을 선택해 주세요", items: SCHOOLS, current: S.schoolLevel, type: "school", back: () => { S.screen = "teacher"; render(); }, next: () => { S.screen = "parent"; render(); } }); }
function renderParent() { selectionPage({ step: "03/06", title: "학부모 유형을 선택해 주세요", items: PARENTS, current: S.parentId, type: "parent", back: () => { S.screen = "school"; render(); }, next: () => { S.screen = "caller"; render(); } }); }

// 텍스트 카드용 선택 화면입니다. selectionPage()는 이미지 카드 전용이라
// 성별·난이도처럼 사진이 없는 선택지에는 이 함수를 씁니다. 클릭 즉시 다음 화면으로 넘어갑니다.
function textChoicePage({ step, title, help, items, current, onPick, back, next }) {
  app.innerHTML = `<main class="page"><section class="page-center selection-page"><p class="step-index">STEP ${step}</p><h2 class="step-title">${title}</h2>${help ? `<p class="step-copy">${help}</p>` : ""}<div class="text-choice-grid">${items.map((item) => `<button class="text-choice ${current === item.id ? "selected" : ""}" data-id="${item.id}" type="button"><span class="text-choice-icon">${item.icon}</span><strong>${esc(item.label)}</strong><p>${esc(item.desc)}</p></button>`).join("")}</div><div class="btn-row"><button class="btn-secondary" id="back">뒤로</button></div>${footer}</section></main>`;
  document.querySelectorAll(".text-choice").forEach((el) => el.onclick = () => { onPick(el.dataset.id); next(); });
  $("back").onclick = back;
}

function renderCaller() {
  textChoicePage({
    step: "04/06",
    title: "민원을 제기하는 학부모는 누구인가요?",
    help: "말투나 태도가 아니라, 얼마나 직접 겪은 일인지가 대화의 구체성에 영향을 줍니다.",
    items: CONTEXTS,
    current: S.callerId,
    onPick: (id) => { S.callerId = id; },
    back: () => { S.screen = "parent"; render(); },
    next: () => { S.screen = "difficulty"; render(); }
  });
}

function renderDifficulty() {
  textChoicePage({
    step: "05/06",
    title: "연습 난이도를 선택해 주세요",
    help: "민원 상황은 어떤 난이도에서도 항상 전체가 보입니다. 난이도는 학부모 말이 글로도 보이는지, 즉시 피드백과 응대 참고 카드를 함께 볼 수 있는지를 정합니다.",
    items: DIFFICULTIES,
    current: S.difficulty,
    onPick: (id) => { S.difficulty = id; },
    back: () => { S.screen = "caller"; render(); },
    next: () => { S.screen = "situation"; render(); }
  });
}
// 사례 선택 모드는 실제 민원 사례 코퍼스(_complaint_cases.js)가 초등학교 자료만 있어 그 학교급에서만 씁니다.
const CASE_LABELS = { when: "시점", where: "장소", who: "관련 인물", whatHappened: "있었던 일", teacherAction: "교사의 기존 대응", parentDemand: "학부모의 요구" };
function situationFieldsCard(fields) {
  if (!fields) return "";
  const rows = Object.entries(CASE_LABELS).filter(([key]) => fields[key]).map(([key, label]) => `<div class="situation-field-row"><span class="situation-field-label">${label}</span><span>${esc(fields[key])}</span></div>`).join("");
  return rows ? `<div class="situation-fields">${rows}</div>` : "";
}
function caseSituationText() { const c = S.selectedCase; return c ? `${c.title}. ${c.excerpt}` : ""; }
function caseSituationContext() {
  const c = S.selectedCase;
  if (!c) return "";
  return `[실제 민원 사례 원문 — 출처: ${S.caseSourceName || "학부모 민원 사례집"} ${c.page}쪽]\n아래는 실제 학부모 민원의 원문입니다. 표현과 어조를 각색하지 말고 이 사례에 담긴 태도와 요구를 최대한 가깝게 재현하세요.\n\n${c.excerpt}`;
}
function currentSituationText() {
  if (S.situationMode === "random") return S.randomSituation;
  if (S.situationMode === "case") return caseSituationText();
  return S.manualSituation;
}
function renderSituation() {
  const mode = S.situationMode;
  const caseAllowed = school()?.label === "초등학교";
  const current = currentSituationText();
  const casePanel = `<section class="choice-panel glass ${mode === "case" ? "selected" : ""} ${caseAllowed ? "" : "choice-panel-disabled"}"><div class="choice-head"><h3>사례 선택하기</h3><button class="mode-button" id="caseMode" ${caseAllowed ? "" : "disabled"}>선택</button></div><p class="choice-help">${caseAllowed ? "실제 학부모 민원 사례집에서 원문 그대로 가져옵니다. 표현이 거칠 수 있습니다." : "실제 사례 코퍼스는 초등학교 자료만 있어 이 학교급에서는 사용할 수 없습니다."}</p>${mode === "case" ? renderCaseBrowser() : ""}</section>`;
  app.innerHTML = `<main class="page"><section class="page-center situation-page"><p class="step-index">STEP 06/06</p><h2 class="step-title">민원 상황을 선택해 주세요</h2><p class="step-copy">기존 사례 기반 상황을 자동생성하거나, 실제 사례를 고르거나, 연습할 상황을 직접 입력할 수 있습니다.</p><div class="choice-grid choice-grid-3"><section class="choice-panel glass ${mode === "random" ? "selected" : ""}"><div class="choice-head"><h3>상황 생성하기</h3><button class="mode-button" id="randomMode">선택</button></div><p class="choice-help">선택한 학교급의 맥락을 반영한 가상 민원 상황을 만듭니다.</p><button class="dice-button" id="generate" type="button">✦ 자동생성</button>${situationFieldsCard(S.randomFields)}<textarea id="randomInput" class="situation-textarea" placeholder="생성된 민원 상황이 표시됩니다.">${esc(S.randomSituation)}</textarea></section>${casePanel}<section class="choice-panel glass ${mode === "manual" ? "selected" : ""}"><div class="choice-head"><h3>직접 입력하기</h3><button class="mode-button" id="manualMode">선택</button></div><p class="choice-help">개인정보를 제외한 가상 상황만 입력해 주세요.</p><textarea id="manualInput" class="situation-textarea" placeholder="연습할 민원 상황을 입력해 주세요. (개인정보는 절대 입력하지 마세요)">${esc(S.manualSituation)}</textarea></section></div><div class="btn-row"><button class="btn-secondary" id="back">뒤로</button><button class="btn-primary" id="next" ${current.trim() ? "" : "disabled"}>대화 시작</button></div>${footer}</section></main>`;
  $("randomMode").onclick = () => { S.situationMode = "random"; renderSituation(); };
  $("manualMode").onclick = () => { S.situationMode = "manual"; renderSituation(); };
  if (caseAllowed) $("caseMode").onclick = () => { S.situationMode = "case"; if (!S.caseTopics.length) loadCaseTopics(); else renderSituation(); };
  $("randomInput").oninput = (e) => { S.situationMode = "random"; S.randomSituation = e.target.value; $("next").disabled = !e.target.value.trim(); };
  $("manualInput").oninput = (e) => { S.situationMode = "manual"; S.manualSituation = e.target.value; $("next").disabled = !e.target.value.trim(); };
  $("generate").onclick = generateSituation;
  wireCaseBrowser();
  $("back").onclick = () => { S.screen = "difficulty"; render(); };
  $("next").onclick = startSimulation;
}
function renderCaseBrowser() {
  if (S.caseLoading) return `<p class="case-status">사례를 불러오는 중입니다…</p>`;
  if (!S.caseTopics.length) return `<p class="case-status">주제를 불러오지 못했습니다.</p><button class="mode-button" id="caseRetryTopics" type="button">다시 시도</button>`;
  if (!S.caseTopic) {
    return `<div class="case-topic-grid">${S.caseTopics.map((t) => `<button class="case-topic-btn" data-topic="${esc(t.topic)}" type="button">${esc(t.topic)}<small>${t.count}건</small></button>`).join("")}</div>`;
  }
  if (S.selectedCase) {
    return `<div class="case-selected"><p class="case-page">${esc(S.caseTopic)} · ${S.caseSourceName || ""} ${S.selectedCase.page}쪽</p><blockquote>${esc(S.selectedCase.excerpt)}</blockquote><button class="mode-button" id="caseChangeTopic" type="button">다른 주제 선택</button></div>`;
  }
  const cards = S.caseList.map((c, i) => `<button class="case-card" data-index="${i}" type="button"><strong>${esc(c.title)}</strong><p>${esc(c.excerpt)}</p><span class="case-page">${c.page}쪽</span></button>`).join("");
  return `<p class="case-topic-current">주제: ${esc(S.caseTopic)} <button class="mode-button" id="caseChangeTopic" type="button">주제 변경</button></p><div class="case-list">${cards || "<p class=\"case-status\">이 주제의 사례를 모두 살펴봤습니다.</p>"}</div><button class="mode-button" id="caseReroll" type="button">다른 사례 더 보기</button>`;
}
function wireCaseBrowser() {
  if ($("caseRetryTopics")) $("caseRetryTopics").onclick = loadCaseTopics;
  document.querySelectorAll(".case-topic-btn").forEach((el) => el.onclick = () => pickCaseTopic(el.dataset.topic));
  if ($("caseChangeTopic")) $("caseChangeTopic").onclick = () => { S.caseTopic = ""; S.caseList = []; S.caseExcludeIds = []; S.selectedCase = null; renderSituation(); };
  if ($("caseReroll")) $("caseReroll").onclick = () => loadCaseSamples();
  document.querySelectorAll(".case-card").forEach((el) => el.onclick = () => selectCase(S.caseList[Number(el.dataset.index)]));
}
async function loadCaseTopics() {
  S.caseLoading = true; renderSituation();
  try {
    const data = await apiFetchJson("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    S.caseTopics = Array.isArray(data.topics) ? data.topics : [];
    S.caseSourceName = data.sourceName || "";
  } catch (e) { S.caseTopics = []; }
  S.caseLoading = false; renderSituation();
}
async function pickCaseTopic(topic) { S.caseTopic = topic; S.caseList = []; S.caseExcludeIds = []; S.selectedCase = null; await loadCaseSamples(); }
async function loadCaseSamples() {
  S.caseLoading = true; renderSituation();
  try {
    const data = await apiFetchJson("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: S.caseTopic, excludeIds: S.caseExcludeIds }) });
    S.caseList = Array.isArray(data.cases) ? data.cases : [];
    S.caseExcludeIds = [...S.caseExcludeIds, ...S.caseList.map((c) => c.id)];
  } catch (e) { S.caseList = []; }
  S.caseLoading = false; renderSituation();
}
function selectCase(item) { if (!item) return; S.selectedCase = item; S.situationMode = "case"; renderSituation(); }
async function generateSituation() { S.situationMode = "random"; const button = $("generate"); button.disabled = true; try { const res = await fetch("/api/random-situation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacherType: teacher()?.label, schoolLevel: school()?.label }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); S.randomSituation = data.situation || ""; S.randomContext = data.situationContext || data.context || S.randomSituation; S.randomFields = data.fields || null; } catch (e) { S.randomSituation = `${school()?.label || "학교"}에서 학생 생활과 관련해 학부모가 사실 확인과 후속 조치를 요청하는 상황입니다.`; S.randomContext = S.randomSituation; S.randomFields = null; } renderSituation(); }
// 기본·심화 난이도는 학부모 말을 음성으로만 듣게 합니다(글로 미리 읽지 않고 듣기 연습).
// 다만 재생이 완전히 실패한 발화(S.forceRevealed)는 난이도와 무관하게 글로 보여 줍니다.
function parentTextVisible(index) { return difficulty().id === "basic" || S.forceRevealed.has(index); }
// 응대 참고 카드는 심화가 아닐 때만 필요하므로 시뮬레이션 시작 시 한 번만 불러옵니다.
async function loadGuides() {
  try {
    const res = await fetch("/api/guides");
    const data = await res.json();
    S.guides = Array.isArray(data.guides) ? data.guides : [];
  } catch (error) {
    S.guides = [];
  }
  syncSim();
}
function renderMessages() {
  if (!S.msgs.length) return `<div class="msg msg-system">AI 학부모가 대화를 시작하는 중입니다.</div>`;
  return S.msgs.map((m, index) => {
    if (m.role !== "parent" && m.role !== "teacher") return `<div class="msg msg-${m.role}">${esc(m.content)}</div>`;
    const label = `<span class="speaker-label">${m.role === "parent" ? "학부모" : "교사"}</span>`;
    if (m.role === "teacher") return `<div class="msg msg-teacher">${label}${esc(m.content)}</div>`;
    const hidden = !parentTextVisible(index);
    const body = hidden ? `<span class="msg-audio-only">🔊 음성으로 들어보세요</span>` : esc(m.content);
    return `<div class="msg msg-parent ${hidden ? "msg-hidden-text" : ""}">${label}${body}${replayButton(index)}</div>`;
  }).join("");
}
function renderSimulation() { const turns = teacherTurns(), locked = S.loading || S.evaluating || S.ended; app.innerHTML = `<main class="page"><section class="sim-page"><div class="sim-layout"><section class="chat-panel glass"><div class="chat-panel-head"><div class="box-label">대화 연습</div><span class="state-badge ${S.recording || S.speaking || S.ended ? "" : "muted"}">${simStateLabel()}</span></div><div class="chat-history" id="history">${renderMessages()}${S.loading ? `<div class="msg msg-system">학부모가 응답을 준비하고 있습니다…</div>` : ""}</div><div class="input-strip"><textarea id="teacherInput" class="teacher-input" placeholder="${S.listening ? "말씀하시면 자동으로 입력됩니다." : "교사 역할로 답변해 주세요."}" ${locked ? "disabled" : ""}></textarea><div class="input-actions"><button id="voice" class="voice-button ${S.recording ? "listening" : ""}" aria-pressed="${S.recording}" ${voiceButtonDisabled() ? "disabled" : ""}>${voiceButtonLabel()}</button><button id="send" class="send-button" ${locked ? "disabled" : ""}>전송</button></div></div></section><aside class="right-panel glass"><section class="side-section"><div class="box-label">연습 정보</div><dl class="simulation-info"><div><dt>교원 유형</dt><dd>${esc(teacher()?.label)}</dd></div><div><dt>학교급</dt><dd>${esc(school()?.label)}</dd></div><div><dt>학부모 유형</dt><dd>${esc(parent().label)}</dd></div></dl><h3 class="parent-name">${esc(parent().label)}</h3><p>${esc(parent().desc)}</p><div class="scenario-copy"><span>민원 상황</span><p>${esc(S.situation)}</p></div></section>${difficulty().id !== "advanced" ? `<section class="side-section"><div class="box-label">즉시 피드백</div><div id="turnFeedback">${renderTurnFeedback()}</div></section>` : ""}${difficulty().id !== "advanced" ? renderGuidePanel() : ""}</aside></div>${S.confirmExit ? `<div class="inline-error inline-confirm" role="alert"><strong>학부모의 요구 ${S.openIssues.length}건이 아직 해결되지 않았습니다.</strong><span>${S.openIssues.map(esc).join(" · ")}</span><span class="inline-error-note">그래도 대화를 마치고 평가로 넘어갈까요? 이 경우 결과에 중도 종료로 표시됩니다.</span><div class="inline-confirm-actions"><button class="btn-outline" id="cancelExit" type="button">계속 대화하기</button><button class="btn-primary" id="confirmExit" type="button">그래도 종료</button></div></div>` : ""}${S.error ? `<div class="inline-error" role="alert"><strong>평가를 완료하지 못했습니다.</strong><span>${esc(S.error)}</span><span class="inline-error-note">대화 기록은 그대로 남아 있습니다.</span><button class="btn-outline" id="retryEvaluate" type="button">평가 다시 시도</button></div>` : ""}<div class="action-row"><button class="btn-secondary" id="home">처음으로</button><button class="btn-outline" id="retry">같은 조건 재도전</button><button class="btn-primary" id="evaluate" ${turns >= 4 && !S.loading && !S.evaluating ? "" : "disabled"}>대화 종료 및 평가</button></div>${footer}</section></main>${S.evaluating ? `<div class="analysis-overlay" role="status"><div class="analysis-card"><span class="analysis-spinner"></span><strong>결과 분석 중입니다.</strong><p>조금만 기다려주세요.</p></div></div>` : ""}`; $("home").onclick = () => { stopVoice(); S = freshState(); render(); }; $("retry").onclick = restart; $("evaluate").onclick = evaluate; if ($("retryEvaluate")) $("retryEvaluate").onclick = evaluate; if ($("cancelExit")) $("cancelExit").onclick = cancelExitConfirm; if ($("confirmExit")) $("confirmExit").onclick = evaluate; if ($("guideToggle")) $("guideToggle").onclick = () => { S.guidesOpen = !S.guidesOpen; syncSim(); }; const input = $("teacherInput"); if (input) { input.value = S.draft; input.oninput = (e) => { S.draft = e.target.value; if (S.recording) { committedText = e.target.value.trim(); consumedFinal = sessionFinal; carryOver = true; } }; } if ($("send")) $("send").onclick = send; if ($("voice")) $("voice").onclick = toggleVoiceInput; document.querySelectorAll(".replay-button").forEach((el) => { el.onclick = () => { const index = Number(el.dataset.index), message = S.msgs[index]; if (!message) return; if (S.playingIndex === index) { stopPlayback(); S.speaking = false; paintVoiceState(); syncSim(); return; } unlockAudio(); speakParent(message.content, index); }; }); requestAnimationFrame(() => { if ($("history")) $("history").scrollTop = $("history").scrollHeight; }); }
// ── 음성 대화 ─────────────────────────────────────────────────────────────
// 학부모 발화는 TTS로 재생하고, 교사 발화는 마이크로 받습니다.
// 녹음은 버튼으로만 시작·중지하며 저절로 전송되지 않습니다. 중지하면 인식 결과가 입력창에 남고,
// 사용자가 확인·수정한 뒤 직접 전송합니다. 다시 녹음하면 그 뒤에 이어서 붙습니다.
// 모바일 웹뷰는 continuous를 사실상 무시하고 한 문장이나 몇 초 무음마다 세션을 끝내므로,
// 녹음 중 세션이 끊기면 조용히 다시 열어 사용자에게는 한 번의 녹음처럼 보이게 합니다.
const RESTART_DELAY_MS = 200;
const RESTART_DELAY_MAX_MS = 1500;
const RESTART_NOTICE_AT = 8;
const RESTART_GIVEUP = 40;
const SILENT_CLIP = "data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
let recognition = null;
let restartTimer = null;
let sessionEpoch = 0;   // 세션 일련번호. 버린 세션에서 늦게 오는 이벤트를 걸러냅니다.
let starting = false;   // start() 호출 후 onstart 도착 전까지 true
let committedText = ""; // 확정 본문. 사용자가 손으로 고친 내용까지 포함하며 미확정 텍스트는 넣지 않습니다.
let sessionFinal = "";  // 현재 세션의 확정 문장 전체. 매 이벤트마다 통째로 다시 계산해 대입합니다.
let consumedFinal = ""; // 녹음 중 직접 편집한 시점까지 이미 반영된 확정분
let carryOver = false;  // 세션이 이어진 직후 → 이미 확정한 말이 다시 들어올 수 있습니다.
let restartBurst = 0;   // 말을 못 들은 채 반복 재시작한 횟수
let parentAudio = null;
let playbackFinish = null; // 재생 중인 약속을 정지 버튼이 끝낼 수 있게 걸어 두는 마무리 함수
let feedbackSeq = 0;
const noticeShown = new Set();

function simStateLabel() { return S.speaking ? "학부모 발화 중" : S.recording ? "🔴 녹음 중" : S.ended ? "대화 마무리" : "진행 중"; }
// 표시는 사용자가 누른 녹음 의도(S.recording)를 따릅니다.
// 모바일에서는 인식 세션이 문장마다 끊겼다 열리므로, 세션 상태(S.listening)로 칠하면
// 말하는 도중에 버튼이 깜빡여 사용자가 꺼진 줄 알고 다시 누르게 됩니다.
function voiceButtonLabel() { return S.recording ? "■ 녹음 중지" : "🎙 음성 입력"; }
function voiceButtonDisabled() { return S.evaluating || S.ended || S.loading || S.speaking; }
function canListen() { return S.screen === "simulation" && !S.loading && !S.speaking && !S.ended && !S.evaluating; }
function syncSim() { if (S.screen === "simulation") renderSimulation(); }
function notify(key, message) { if (noticeShown.has(key)) return; noticeShown.add(key); S.msgs.push({ role: "system", content: message }); syncSim(); }

// 전체 재렌더링 없이 음성 상태만 반영합니다. 녹음 중 화면이 튀거나 입력이 사라지지 않게 합니다.
function paintVoiceState() {
  const button = $("voice");
  if (button) { button.textContent = voiceButtonLabel(); button.classList.toggle("listening", S.recording); button.setAttribute("aria-pressed", String(S.recording)); button.disabled = voiceButtonDisabled(); }
  const badge = document.querySelector(".state-badge");
  if (badge) { badge.textContent = simStateLabel(); badge.classList.toggle("muted", !(S.recording || S.speaking || S.ended)); }
  const input = $("teacherInput");
  if (input) { if (input.value !== S.draft) input.value = S.draft; input.placeholder = S.recording ? "말씀하시면 여기에 입력됩니다. 다 말한 뒤 버튼을 눌러 멈추고 전송해 주세요." : "교사 역할로 답변해 주세요."; }
}

// 즉시 피드백은 방금 교사 발화에 대한 것이라 학부모 응답과 따로 도착합니다.
// 전체 재렌더링을 하면 녹음 중 입력이 흔들리므로 이 패널만 갱신합니다.
// 응대 참고 패널: _response_guides.js 코퍼스를 /api/guides로 받아 학부모 유형에 맞는 조각만 보여 줍니다.
// 기초는 항상 펼침, 기본은 접었다 펼 수 있게, 심화는 패널 자체를 렌더링하지 않습니다(호출부에서 걸러짐).
function guideTagsFor(parentId) {
  const common = ["공감적 표현", "비대립적 의사소통"];
  const byType = {
    cooperative: ["후속 절차 안내"],
    anxious: ["공감적 표현", "후속 절차 안내"],
    avoidant: ["이관·보고 판단"],
    demanding: ["사안 판단", "이관·보고 판단"],
    pressure: ["경계 설정", "대응 중단 판단"]
  };
  return [...new Set([...common, ...(byType[parentId] || [])])];
}
function relevantGuides() {
  const tags = guideTagsFor(parent().id);
  const matched = S.guides.filter((g) => g.tags.some((t) => tags.includes(t)));
  return (matched.length ? matched : S.guides).slice(0, 4);
}
function formatGuideCitation(source) {
  const label = source?.doc === "A" ? "학교민원 처리 매뉴얼" : "학교 민원 응대 안내자료";
  return `${label} p.${source?.page ?? "?"}`;
}
function renderGuidePanel() {
  const open = difficulty().id === "basic" || S.guidesOpen;
  const toggle = difficulty().id === "standard" ? `<button class="guide-toggle" id="guideToggle" type="button">${open ? "접기" : "펼치기"}</button>` : "";
  const items = relevantGuides();
  const body = !open ? "" : (items.length
    ? `<ul class="guide-list">${items.map((g) => `<li><strong>${esc(g.title)}</strong><p>${esc(g.body)}</p><span class="guide-source">${esc(formatGuideCitation(g.source))}</span></li>`).join("")}</ul>`
    : `<p class="feedback-idle">참고 자료를 불러오는 중입니다…</p>`);
  return `<section class="side-section guide-panel"><div class="box-label">응대 참고${toggle}</div>${body}</section>`;
}

function renderTurnFeedback() {
  if (S.feedbackLoading) return `<p class="feedback-idle">방금 하신 말씀을 살펴보는 중입니다…</p>`;
  const fb = S.turnFeedback;
  const met = fb?.met?.length ? fb.met : S.feedback;
  const blocks = [];
  if (met.length) blocks.push(`<p class="feedback-line"><span class="feedback-tag">드러난 요소</span>${met.map(esc).join(" · ")}</p>`);
  if (fb?.message) blocks.push(`<p class="feedback-message">${esc(fb.message)}</p>`);
  if (fb?.next?.length) blocks.push(`<p class="feedback-line"><span class="feedback-tag">다음에 이어가기</span>${fb.next.map(esc).join(" · ")}</p>`);
  return blocks.join("") || `<p class="feedback-idle">교사 발화 후 핵심 수행 요소를 짧게 안내합니다.</p>`;
}

function paintFeedback() { const panel = $("turnFeedback"); if (panel) panel.innerHTML = renderTurnFeedback(); }

// 재생 중인 발화만 정지로 바뀝니다. 자동 재생되는 응답도 같은 상태를 쓰므로
// 학부모가 말하는 동안 그 발화의 버튼이 정지로 보입니다.
function replayButton(index) {
  const playing = S.playingIndex === index;
  const label = playing ? "재생 정지" : "이 발화 듣기";
  return `<button class="replay-button ${playing ? "playing" : ""}" type="button" data-index="${index}" title="${label}" aria-label="${label}">${playing ? "■" : "▶"}</button>`;
}

// 학부모 응답과 나란히 요청해 대기 시간을 늘리지 않습니다.
// 연달아 전송하면 이전 요청의 응답이 뒤늦게 덮어쓸 수 있어 순번으로 걸러냅니다.
async function requestTurnFeedback(teacherText, history) {
  const seq = (feedbackSeq += 1);
  S.turnFeedback = null; S.feedbackLoading = true; paintFeedback();
  try {
    const data = await apiFetchJson("/api/turn-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacherText, messages: history, parentType: parent().label, situation: S.situation }) }, 0);
    if (seq !== feedbackSeq) return;
    if (data && !data.degraded) S.turnFeedback = data;
  } catch (error) {
    // 피드백이 실패해도 대화 연습은 그대로 이어집니다.
  } finally {
    if (seq === feedbackSeq) { S.feedbackLoading = false; paintFeedback(); }
  }
}

function setDraft(value) { S.draft = value; const input = $("teacherInput"); if (input) input.value = value; }
function joinDraft(...parts) { return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" ").trim(); }

// 한 인스턴스를 수십 번 재사용하면 웹뷰에서 이전 세션의 결과가 새 세션에 섞여 나오는 일이 있습니다.
// 그 증상은 지금 고치는 중복과 구분이 되지 않으므로, 세션마다 새로 만들어 아예 가능성을 없앱니다.
function ensureRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  if (recognition) return recognition;
  recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition; // 핸들러는 세션마다 openSession에서 다시 답니다.
}

// event.results는 세션 전체의 누적 목록입니다. 여기에 대고 모듈 변수에 덧붙이면
// 같은 확정 결과가 다시 전달될 때마다 문장이 한 번씩 더 쌓입니다.
// 그래서 resultIndex를 쓰지 않고 매번 목록 전체로 문장을 다시 만듭니다.
// 같은 이벤트가 몇 번 오든 결과가 같으므로 중복이 생길 수 없습니다.
// event.results의 항목들이 서로 다른 구간인지(데스크톱에서 알려진 형태),
// 앞말을 통째로 다시 읊는 재진술인지(안드로이드 웹뷰)는 엔진마다 다르고 한 세션 안에서 섞이기도 합니다.
// 명세는 확정 결과들이 서로 겹치지 않는다고 보장한 적이 없습니다.
// 그래서 왼쪽부터 접으면서 두 모양을 함께 처리하되, 재진술이 얼마나 뚜렷했는지(span·hits)를
// 함께 돌려줘 이 결과를 믿을지 호출한 쪽이 정하게 합니다.
function foldChunks(chunks) {
  let acc = [], span = 0, hits = 0, restated = false;
  for (const raw of chunks) {
    const next = words(raw);
    if (!next.length) continue;
    if (!acc.length) { acc = next; continue; }
    // 지금까지의 말을 그대로 앞에 달고 뒤를 늘린 조각이면 통째로 갈아끼웁니다.
    if (next.length > acc.length && headMatch(next, acc)) { span = Math.max(span, acc.length); hits += 1; acc = next; restated = true; continue; }
    // 이미 끝에 들어 있는 조각이 또 오면 버립니다.
    if (tailMatch(acc, next)) { restated = false; continue; }
    // 이어지는 조각은 겹친 꼬리만 잘라 붙입니다. 한 어절만 겹치는 것은 "네 네"처럼
    // 실제로 반복한 말일 수 있어, 직전 조각이 재진술이었을 때만 자릅니다.
    const cut = overlapWords(acc, next);
    acc = acc.concat(next.slice(cut >= RESTATE_MIN_WORDS || (cut === 1 && restated) ? cut : 0));
    restated = false;
  }
  return { text: acc.join(" "), span, hits };
}

// 증거가 약하면 접은 결과를 쓰지 않고 예전처럼 그냥 이어 붙입니다.
// 지우는 것이 남기는 것보다 나쁩니다. 중복은 눈에 보여 고칠 수 있지만
// 사라진 말은 보이지 않고 평가 기록까지 조용히 훼손합니다.
const trustFold = (fold) => fold.span >= RESTATE_MIN_WORDS || fold.hits >= RESTATE_MIN_HITS;

function readTranscript(event) {
  const finals = [], interims = [];
  for (let i = 0; i < event.results.length; i += 1) {
    const result = event.results[i], chunk = result[0]?.transcript || "";
    if (!chunk.trim()) continue;
    (result.isFinal ? finals : interims).push(chunk);
  }
  const folded = foldChunks(finals);
  const restating = trustFold(folded);
  const final = restating ? folded.text : joinDraft(...finals);
  const interim = restating ? foldChunks(interims).text : joinDraft(...interims);
  // 미확정 조각이 확정분까지 다시 읊는 엔진이 있어, 화면에 뿌릴 문장은 한 번 더 접습니다.
  // 말하는 도중에 화면이 중복돼 보이던 것도 여기서 잡힙니다.
  const spoken = restating ? foldChunks([final, interim]).text : joinDraft(final, interim);
  return { final, spoken };
}

// 브라우저가 결과를 어떤 모양으로 주는지는 기기마다 달라 이 환경에서는 실측할 수 없습니다.
// 주소 뒤에 ?voicedebug=1 을 붙이면 실제 방출 형태가 화면에 그대로 뜹니다.
// 중복이 다시 보고되면 이 화면을 캡처해 주시면 추측 없이 원인을 짚을 수 있습니다.
const VOICE_DEBUG = /[?&]voicedebug=1/.test(location.search);

function paintVoiceDebug(event) {
  if (!VOICE_DEBUG) return;
  let box = $("voiceDebug");
  if (!box) { box = document.createElement("div"); box.id = "voiceDebug"; box.className = "voice-debug"; document.body.appendChild(box); }
  const shape = [];
  for (let i = 0; i < event.results.length; i += 1) shape.push(`${event.results[i].isFinal ? "F" : "i"} ${event.results[i][0]?.transcript || ""}`);
  box.textContent = `resultIndex=${event.resultIndex} / ${event.results.length}개\n${shape.join("\n")}`;
}

function handleRecognitionResult(event) {
  paintVoiceDebug(event);
  const { final, spoken } = readTranscript(event);
  sessionFinal = final; // 누적(+=)이 아니라 대입입니다. 같은 이벤트가 다시 와도 결과가 같습니다.
  if (spoken) restartBurst = 0;
  setDraft(joinDraft(committedText, newSpeech(spoken)));
}

// 새 세션이 직전 세션에서 이미 확정한 말을 한 번 더 내보내는 일이 있습니다.
// 본문 끝과 겹치는 만큼을 어절 단위로 잘라 냅니다.
const RESTATE_MIN_WORDS = 2; // 재진술로 단정하려면 두 어절 이상이 그대로 되풀이돼야 합니다.
const RESTATE_MIN_HITS = 2;  // 한 어절짜리 겹침도 한 세션에 두 번 이상이면 엔진 습관으로 봅니다.

function words(text) { return String(text || "").trim().split(/\s+/).filter(Boolean); }
const headMatch = (whole, head) => head.length <= whole.length && head.every((w, i) => w === whole[i]);
const tailMatch = (whole, tail) => tail.length <= whole.length && tail.every((w, i) => w === whole[whole.length - tail.length + i]);
function overlapWords(base, next) {
  for (let n = Math.min(base.length, next.length); n >= 1; n -= 1) if (tailMatch(base, next.slice(0, n))) return n;
  return 0;
}

function stripOverlap(base, addition) {
  const tail = words(base), next = words(addition);
  if (!tail.length || !next.length) return next.join(" ");
  return next.slice(overlapWords(tail, next)).join(" ");
}

function newSpeech(heard) {
  if (consumedFinal && heard.startsWith(consumedFinal)) return heard.slice(consumedFinal.length).trim();
  return carryOver ? stripOverlap(committedText, heard) : heard;
}

// 세션이 닫힐 때 확정분만 본문에 넘기고 미확정 텍스트는 버립니다.
// 반쪽짜리 단어를 본문에 굳혀 두면 다음 세션에서 같은 말이 또 들어와 중복됩니다.
function commitSession() {
  committedText = joinDraft(committedText, newSpeech(sessionFinal));
  sessionFinal = ""; consumedFinal = "";
  setDraft(committedText);
}

function handleRecognitionError(code) {
  if (code === "no-speech" || code === "aborted") return;
  if (code === "not-allowed" || code === "service-not-allowed") { S.recording = false; paintVoiceState(); notify("mic-denied", "마이크 권한이 차단되어 음성 입력을 사용할 수 없습니다. 브라우저 주소창의 마이크 아이콘에서 권한을 허용한 뒤 다시 시도해 주세요."); return; }
  if (code === "audio-capture") { S.recording = false; paintVoiceState(); notify("mic-missing", "마이크 장치를 찾지 못했습니다. 장치 연결을 확인하거나 텍스트로 입력해 주세요."); return; }
  notify("mic-network", "음성 인식이 일시적으로 중단되었습니다. 마이크 버튼을 다시 누르거나 텍스트로 입력해 주세요.");
}

// 핸들러를 세션마다 다시 답니다. 버린 세션에서 늦게 도착한 이벤트는 일련번호로 걸러집니다.
function openSession() {
  const active = ensureRecognition();
  if (!active || S.listening || starting) return;
  const epoch = (sessionEpoch += 1);
  const mine = (fn) => (arg) => { if (epoch === sessionEpoch) fn(arg); };
  active.onstart = mine(() => { starting = false; S.listening = true; paintVoiceState(); });
  active.onresult = mine(handleRecognitionResult);
  active.onerror = mine((event) => handleRecognitionError(event.error));
  active.onend = mine(handleRecognitionEnd);
  sessionFinal = ""; consumedFinal = "";
  starting = true;
  try {
    active.start();
  } catch (error) {
    // 직전 세션이 아직 닫히는 중입니다. 잠시 뒤 한 번 더 엽니다.
    starting = false;
    scheduleRestart();
  }
}

function scheduleRestart() {
  restartBurst += 1;
  if (restartBurst === RESTART_NOTICE_AT) notify("mic-idle", "마이크는 계속 켜져 있습니다. 말씀하시면 이어서 입력되고, 다 말한 뒤 버튼을 눌러 멈추고 전송해 주세요.");
  if (restartBurst >= RESTART_GIVEUP) { S.recording = false; paintVoiceState(); notify("mic-stalled", "마이크가 계속 열리지 않아 녹음을 멈췄습니다. 버튼을 다시 눌러 주세요."); return; }
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (S.recording && canListen() && !document.hidden) openSession();
  }, Math.min(RESTART_DELAY_MS * restartBurst, RESTART_DELAY_MAX_MS));
}

function handleRecognitionEnd() {
  starting = false;
  S.listening = false;
  commitSession();
  // 세션을 닫은 뒤 늦게 도착하는 onresult가 방금 본문에 넘긴 말을 되살리지 못하게 무효화합니다.
  sessionEpoch += 1;
  recognition = null; // 다음 세션은 새 인스턴스로 엽니다.
  paintVoiceState();
  if (!S.recording) return; // 사용자가 멈췄습니다.
  if (!canListen() || document.hidden) { S.recording = false; paintVoiceState(); return; }
  // 브라우저가 스스로 끊었을 뿐 녹음은 계속입니다. 조용히 다시 엽니다.
  carryOver = true;
  scheduleRestart();
}

function startRecording() {
  if (!ensureRecognition()) { notify("voice-unsupported", "이 브라우저는 음성 인식을 지원하지 않습니다. 아래 입력창에 텍스트로 답변해 주세요."); return; }
  if (!canListen()) return;
  clearTimeout(restartTimer); restartTimer = null;
  restartBurst = 0;
  // 입력창이 원본입니다. 직접 고친 내용까지 그대로 두고 그 뒤에 이어 씁니다.
  committedText = ($("teacherInput")?.value ?? S.draft ?? "").trim();
  sessionFinal = ""; consumedFinal = "";
  const inFlight = S.listening || starting;
  carryOver = inFlight; // 닫히는 중인 세션이 방금 들은 말을 다시 낼 수 있습니다.
  S.recording = true;
  paintVoiceState();
  if (inFlight) return; // 진행 중인 onend가 이어서 열어 줍니다.
  openSession();
}

// keepTail=true  : stop() — 멈춘 뒤 도착하는 마지막 확정 결과까지 본문에 넣습니다(버튼으로 중지).
// keepTail=false : abort() — 남은 결과를 통째로 버립니다(전송·학부모 발화·화면 이탈).
function stopRecording(keepTail = true) {
  S.recording = false;
  clearTimeout(restartTimer); restartTimer = null;
  restartBurst = 0;
  if (keepTail) {
    // 멈춘 뒤 도착하는 마지막 확정 결과까지 본문에 넣습니다(버튼으로 중지).
    if (!recognition || (!S.listening && !starting)) { commitSession(); paintVoiceState(); return; }
    paintVoiceState();
    try { recognition.stop(); } catch (error) { S.listening = false; starting = false; commitSession(); paintVoiceState(); }
    return;
  }
  // 남은 결과를 통째로 버립니다(전송·학부모 발화·화면 이탈).
  // 본문 버퍼까지 비워야 합니다. 남겨 두면 다음 commitSession이 방금 전송해 비운 입력창에
  // 예전 문장을 도로 써 넣습니다.
  sessionEpoch += 1; // 이 세션의 남은 이벤트를 전부 무효화합니다.
  S.listening = false; starting = false;
  committedText = ""; sessionFinal = ""; consumedFinal = ""; carryOver = false;
  if (recognition) { try { recognition.abort(); } catch (error) { /* 무시합니다. */ } recognition = null; }
  paintVoiceState();
}

function toggleVoiceInput() {
  unlockAudio();
  if (S.recording) stopRecording(true); else startRecording();
}

// 재생 중인 학부모 음성을 끊습니다. 오디오와 브라우저 음성 합성 양쪽을 모두 멈춰야
// 어느 경로로 재생 중이든 정지 버튼이 실제로 통합니다.
function stopPlayback() {
  try { window.speechSynthesis?.cancel(); } catch (error) { /* 무시합니다. */ }
  if (parentAudio) { try { parentAudio.pause(); } catch (error) { /* 무시합니다. */ } }
  const finish = playbackFinish; playbackFinish = null;
  if (finish) finish(); // 매달린 재생 약속을 여기서 끝냅니다.
  S.playingIndex = null;
}

function stopVoice() {
  stopPlayback();
  S.recording = false; S.speaking = false;
  clearTimeout(restartTimer); restartTimer = null;
  sessionEpoch += 1;
  S.listening = false; starting = false;
  committedText = ""; sessionFinal = ""; consumedFinal = ""; carryOver = false; restartBurst = 0;
  if (recognition) { try { recognition.abort(); } catch (error) { /* 무시합니다. */ } recognition = null; }
  try { window.speechSynthesis?.cancel(); } catch (error) { /* 무시합니다. */ }
  if (parentAudio) { try { parentAudio.pause(); } catch (error) { /* 무시합니다. */ } }
}

// 브라우저 자동 재생 정책 때문에, 첫 발화 오디오는 사용자의 클릭 시점에 미리 열어 두어야 합니다.
// fetch를 기다린 뒤 play()를 호출하면 제스처 컨텍스트가 만료되어 iOS에서 재생이 막힙니다.
function unlockAudio() {
  if (!parentAudio) { parentAudio = new Audio(); parentAudio.preload = "auto"; }
  if (parentAudio.dataset?.unlocked) return;
  try {
    parentAudio.src = SILENT_CLIP;
    const played = parentAudio.play();
    if (played?.catch) played.catch(() => {});
    parentAudio.dataset.unlocked = "1";
  } catch (error) { /* 재생 실패 시에도 텍스트 대화는 계속됩니다. */ }
}

function playClip(src) {
  return new Promise((resolve, reject) => {
    if (!parentAudio) parentAudio = new Audio();
    let settled = false;
    // pause()는 onended도 onerror도 부르지 않습니다. 정지 버튼이 이 약속을 직접 끝낼 수 있도록
    // 마무리 함수를 밖에 걸어 두지 않으면 S.speaking이 true로 남아 버튼이 잠긴 채 멈춥니다.
    const finish = (ok) => {
      if (settled) return;
      settled = true; playbackFinish = null;
      parentAudio.onended = null; parentAudio.onerror = null;
      ok ? resolve() : reject(new Error("audio playback failed"));
    };
    playbackFinish = () => finish(true);
    parentAudio.onended = () => finish(true);
    parentAudio.onerror = () => finish(false);
    parentAudio.src = src;
    const played = parentAudio.play();
    if (played?.catch) played.catch(() => finish(false));
  });
}

// 크롬은 음성 목록을 비동기로 채웁니다. 목록이 비어 있는 동안 speak를 부르면
// 한국어 음성이 선택되지 않아 아무 소리도 나지 않은 채 끝나는 일이 생깁니다.
function koreanVoice() {
  const synth = window.speechSynthesis;
  const voices = synth?.getVoices?.() || [];
  if (!voices.length) return null;
  return voices.find((v) => v.lang === "ko-KR") || voices.find((v) => (v.lang || "").startsWith("ko")) || null;
}

function waitForVoices(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (koreanVoice() || (window.speechSynthesis?.getVoices?.() || []).length) { resolve(); return; }
    const done = () => { clearTimeout(timer); window.speechSynthesis.onvoiceschanged = null; resolve(); };
    const timer = setTimeout(done, timeoutMs);
    try { window.speechSynthesis.onvoiceschanged = done; } catch (error) { done(); }
  });
}

async function speakWithBrowser(text) {
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) throw new Error("speech synthesis unavailable");
  await waitForVoices();
  return new Promise((resolve, reject) => {
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = koreanVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "ko-KR";
      // 일부 브라우저는 onend를 끝내 부르지 않습니다. 그러면 마이크가 영원히 열리지 않으므로
      // 글자 수에 맞춘 상한을 두고 그때는 끝난 것으로 처리합니다.
      const guard = setTimeout(() => { finish(true); }, Math.min(30000, 4000 + text.length * 110));
      let settled = false;
      const finish = (ok) => { if (settled) return; settled = true; playbackFinish = null; clearTimeout(guard); utterance.onend = null; utterance.onerror = null; ok ? resolve() : reject(new Error("speech synthesis failed")); };
      playbackFinish = () => finish(true);
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      synth.speak(utterance);
    } catch (error) { reject(error); }
  });
}

// index를 넘기면 그 발화의 버튼이 재생 중(정지)으로 표시됩니다.
// 재생 중 다른 발화를 누르거나 정지를 누르면 stopPlayback이 이 재생을 끊습니다.
async function speakParent(text, index = null) {
  if (!text) return;
  stopPlayback();
  // 스피커로 나가는 학부모 목소리를 마이크가 교사 발화로 받아 적지 않도록 완전히 끊습니다.
  stopRecording(false);
  S.speaking = true; S.playingIndex = index; paintVoiceState(); syncSim();
  try {
    const data = await apiFetchJson("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, parentId: parent().id, voice: caller().voice }) }, 1);
    await playClip(`data:${data.mime || "audio/mpeg"};base64,${data.audio}`);
  } catch (error) {
    try { await speakWithBrowser(text); } catch (fallbackError) {
      // 안전장치: 음성이 전혀 안 나오면 난이도가 텍스트를 숨기고 있어도 이 발화만은 강제로 보여 줍니다.
      // 텍스트도 숨고 소리도 안 나면 연습 자체가 막힙니다.
      if (index !== null) S.forceRevealed.add(index);
      notify("audio-blocked", "학부모 음성을 재생하지 못했습니다. 대화 내용은 위에 글로 표시되며 연습은 그대로 이어갈 수 있습니다.");
    }
  } finally {
    S.speaking = false; S.playingIndex = null; paintVoiceState(); syncSim();
  }
}
// 키가 거부됐거나 요청이 잘못된 경우는 다시 보내도 결과가 같으므로 즉시 포기합니다.
// 연결이 끊기거나 서버가 일시적으로 실패한 경우에만 재시도합니다.
function isFatalApiError(status, code) { if (code === "auth") return true; return status >= 400 && status < 500 && status !== 429; }
// 함수가 실행 제한을 넘겨 강제 종료되면 서버가 아니라 플랫폼이 HTML 오류 페이지를 돌려줍니다.
// 그대로 JSON.parse하면 "Unexpected token '<'"가 화면에 그대로 노출되므로 여기서 걸러 냅니다.
function describeNonJson(status) {
  if (status === 504 || status === 502 || status === 0) return "서버가 제한 시간 안에 응답을 끝내지 못했습니다. 잠시 후 다시 시도해 주세요.";
  if (status === 404) return "요청한 기능을 서버에서 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.";
  return `서버가 예상치 못한 응답을 보냈습니다. (HTTP ${status})`;
}
async function apiFetchJson(url, options, retries = 2) { let lastError; for (let attempt = 0; attempt <= retries; attempt += 1) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000); try { const res = await fetch(url, { ...options, signal: controller.signal }); clearTimeout(timer); const raw = await res.text(); let data = null; try { data = raw ? JSON.parse(raw) : {}; } catch (parseError) { data = null; } if (data === null) { const error = new Error(describeNonJson(res.status)); error.fatal = res.status === 404; throw error; } if (!res.ok) { const error = new Error(data.error || "요청을 처리하지 못했습니다."); error.code = data.code; error.fatal = isFatalApiError(res.status, data.code); throw error; } return data; } catch (error) { clearTimeout(timer); lastError = error; if (error?.fatal || attempt >= retries) break; await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1))); } } throw lastError || new Error("네트워크 요청에 실패했습니다."); }
async function chat(initial = false) { return apiFetchJson("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: S.sessionId, teacherType: teacher()?.label, schoolLevel: school()?.label, parentId: parent().id, parentType: parent().label, callerHonorific: caller().honorific, situation: S.situation, situationContext: S.situationContext, system: systemPrompt(), messages: S.apiMsgs, initial, teacherTurns: teacherTurns(), openIssues: S.openIssues }) }); }
// 서버에 아예 닿지 못했을 때만 쓰는 대사입니다. 상황 설명문은 3인칭 서술이라 낭독하면 지문처럼 들리므로 인용하지 않습니다.
function fallbackParentOpening() { const p = parent(); if (p.id === "pressure") return "선생님, 금쪽이 학부모입니다. 아이한테 이야기를 듣고 바로 전화드렸습니다. 이건 그냥 넘어갈 일이 아닌 것 같은데요, 지금 확인되는 게 뭔지부터 말씀해 주세요."; if (p.id === "anxious") return "선생님, 금쪽이 엄마입니다. 어제 아이가 집에 와서 학교 이야기를 하는데 표정이 너무 안 좋아서요. 무슨 일이 있었던 건지, 아이는 지금 괜찮은 건지 여쭤보고 싶어서 연락드렸어요."; if (p.id === "avoidant") return "선생님, 금쪽이 학부모입니다. 아이한테 이야기를 좀 들었는데요. 전에도 말씀드린 적이 있었지만 그때 별로 달라진 게 없어서, 솔직히 이번에는 어떨지 잘 모르겠습니다."; if (p.id === "demanding") return "선생님, 금쪽이 학부모입니다. 아이한테 들은 이야기가 있어서 연락드렸습니다. 학교에서 확인하신 내용이 무엇인지, 그리고 어떤 기준으로 처리되는지 분명하게 알려 주시면 좋겠습니다."; return "선생님, 금쪽이 학부모입니다. 아이한테 들은 이야기가 있어서 연락드렸어요. 학교에서 확인된 내용이 있는지, 앞으로 어떻게 살펴봐 주실 수 있는지 여쭤보고 싶습니다."; }
async function startSimulation() { unlockAudio(); stopVoice(); noticeShown.clear(); S.situation = currentSituationText().trim(); S.situationContext = S.situationMode === "random" ? (S.randomContext || S.situation) : S.situationMode === "case" ? (caseSituationContext() || S.situation) : S.situation; S.msgs = []; S.apiMsgs = []; S.draft = ""; S.evaluation = null; S.ended = false; S.feedback = []; S.turnFeedback = null; S.feedbackLoading = false; S.openIssues = []; S.confirmExit = false; S.guides = []; S.guidesOpen = false; S.forceRevealed = new Set(); feedbackSeq += 1; S.loading = true; S.screen = "simulation"; render(); if (difficulty().id !== "advanced") loadGuides(); let opening = ""; try { const data = await chat(true); opening = data.text; S.apiMsgs.push({ role: "assistant", content: opening }); S.msgs.push({ role: "parent", content: opening }); if (data.degraded) S.msgs.push({ role: "system", content: "AI 발화 생성에 실패해 기본 대사로 시작했습니다. 상황에 맞춘 발화가 아니므로, 오른쪽 '민원 상황'을 기준으로 연습해 주세요. 반복되면 사이트 환경변수의 OPENAI_API_KEY를 확인해 주세요." }); } catch (e) { opening = fallbackParentOpening(); S.apiMsgs.push({ role: "assistant", content: opening }); S.msgs.push({ role: "parent", content: opening }); S.msgs.push({ role: "system", content: "일시적인 네트워크 문제로 기본 학부모 발화로 시작했습니다. 이후에도 오류가 반복되면 새로고침 후 다시 시도해 주세요." }); } finally { S.loading = false; render(); } await speakParent(opening, S.msgs.findIndex((m) => m.role === "parent")); }
async function send() { const text = (S.draft || $("teacherInput")?.value || "").trim(); if (!text || S.loading || S.ended) return; stopRecording(false); setDraft(""); S.msgs.push({ role: "teacher", content: text }); S.apiMsgs.push({ role: "user", content: text }); S.loading = true; render(); requestTurnFeedback(text, S.msgs.slice()); let reply = ""; try { const data = await chat(); reply = data.text; S.apiMsgs.push({ role: "assistant", content: reply }); S.msgs.push({ role: "parent", content: reply }); S.ended = Boolean(data.ended); S.feedback = Array.isArray(data.metCriteria) ? data.metCriteria : []; S.openIssues = Array.isArray(data.openIssues) ? data.openIssues : []; } catch (e) { S.msgs.push({ role: "system", content: `AI 응답 오류: ${e.message}${e.fatal ? " 문제가 계속되면 /api/health 를 열어 어떤 항목이 실패하는지 확인해 주세요." : ""}` }); } finally { S.loading = false; render(); } if (reply) await speakParent(reply, S.msgs.length - 1); }
async function restart() { stopVoice(); S.sessionId = uid(); await startSimulation(); }
// 학부모의 요구가 아직 남아 있는데 평가를 누르면, 먼저 인라인 배너로 의사를 한 번 더 묻습니다.
// window.confirm은 카카오톡 등 인앱 브라우저에서 조용히 억제되는 경우가 있어(과거 alert()가 그랬듯)
// 쓰지 않고, 기존 오류 배너와 같은 방식의 화면 안 배너로 처리합니다.
function cancelExitConfirm() { S.confirmExit = false; render(); }
async function evaluate() {
  if (teacherTurns() < 4 || S.evaluating) return;
  if (!S.ended && S.openIssues.length && !S.confirmExit) { S.confirmExit = true; render(); return; }
  const endedEarly = !S.ended && S.openIssues.length > 0;
  stopVoice(); S.evaluating = true; S.error = ""; S.confirmExit = false; render();
  try {
    const data = await apiFetchJson("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: S.sessionId, teacherType: teacher()?.label, schoolLevel: school()?.label, parentType: parent().label, situation: S.situation, situationContext: S.situationContext, messages: S.msgs, endedEarly, openIssuesAtExit: S.openIssues }) });
    S.evaluation = { ...normalizeEvaluation(data), endedEarly };
    S.screen = "result";
  } catch (e) { S.error = e.message || "평가 중 오류가 발생했습니다."; } finally { S.evaluating = false; render(); }
}
function normalizeEvaluation(data) { const source = new Map((data.criteria || []).map((x) => [x.name, x])); const criteria = CRITERIA.map(([domain, name]) => ({ domain, name, score: Math.max(1, Math.min(4, Number(source.get(name)?.score) || 1)), applicable: Boolean(source.get(name)?.applicable), evidence: source.get(name)?.evidence || "구체적 근거가 확인되지 않았습니다." })); const applicable = criteria.filter((x) => x.applicable); const score = Number(data.score) || (applicable.length ? Math.round(applicable.reduce((sum, x) => sum + x.score, 0) / applicable.length * 140) / 10 : 0); return { ...data, score, criteria, applicableCount: applicable.length }; }
function renderResult() { const e = S.evaluation, domainHTML = ["Ⅰ. 의사소통", "Ⅱ. 갈등 완화", "Ⅲ. 절차적 대응"].map((domain) => { const items = e.criteria.filter((x) => x.domain === domain && x.applicable); const avg = items.length ? (items.reduce((s, x) => s + x.score, 0) / items.length).toFixed(1) : "해당 없음"; return `<article class="domain-score"><span>${domain}</span><strong>${avg}${items.length ? " / 4" : ""}</strong><small>${items.length}개 관찰</small></article>`; }).join(""); const rows = e.criteria.map((x) => `<tr><td>${x.domain}</td><td>${x.name}</td><td>${x.applicable ? `${x.score}점` : "해당 없음"}</td><td>${esc(x.evidence)}</td></tr>`).join(""); app.innerHTML = `<main class="page"><section class="result-page" id="resultCapture"><header class="result-hero"><p class="eyebrow">SIMULATION RESULT</p><h1>종합 평가 결과</h1>${e.endedEarly ? `<p class="result-endnote">⚠ 학부모의 요구가 해결되지 않은 채 교사가 대화를 중도 종료했습니다.</p>` : ""}<p>${esc(e.summary)}</p><div class="result-score"><span>환산 총점</span><strong>${e.score.toFixed(1)}</strong><em>/ 56점</em><small>관찰 요소 ${e.applicableCount}개 기준</small></div></header><section class="domain-grid">${domainHTML}</section><section class="result-section glass"><h2>종합 의견</h2><p>${esc(e.overallFeedback)}</p><div class="feedback-columns"><div><h3>강점</h3><ul>${(e.strengths || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>대화 기록을 바탕으로 다음 시도에서 확인해 보세요.</li>"}</ul></div><div><h3>보완점</h3><ul>${(e.improvements || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>사실 확인과 후속 절차 안내를 구체화해 보세요.</li>"}</ul></div></div></section><section class="result-section glass"><h2>14개 요소별 근거</h2><div class="table-wrap"><table class="result-table"><thead><tr><th>영역</th><th>요소</th><th>점수</th><th>근거</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="result-section glass conversation-export"><h2>대화 기록</h2>${S.msgs.map((m) => `<p><strong>${m.role === "teacher" ? "교사" : m.role === "parent" ? "학부모" : "안내"}</strong> ${esc(m.content)}</p>`).join("")}</section></section><div class="result-actions"><button class="btn-primary" id="retry">동일 조건 재도전</button><button class="btn-secondary" id="home">처음으로</button><button class="btn-outline" id="survey">설문 참여하기</button><button class="btn-outline" id="pdf">PDF 결과 저장</button></div>${footer}</main>`; $("retry").onclick = restart; $("home").onclick = () => { stopVoice(); S = freshState(); render(); }; $("survey").onclick = () => window.open(SURVEY_URL, "_blank", "noopener"); $("pdf").onclick = savePdf; }
async function savePdf() { if (!window.html2canvas || !window.jspdf?.jsPDF) { alert("PDF 저장 도구를 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요."); return; } const target = $("resultCapture"); try { const canvas = await window.html2canvas(target, { backgroundColor: "#f6fbfb", scale: 2, useCORS: true, windowWidth: target.scrollWidth, windowHeight: target.scrollHeight }); const { jsPDF } = window.jspdf; const pdf = new jsPDF("p", "mm", "a4"); const width = 190, pageHeight = 277.2, scaledHeight = canvas.height * width / canvas.width; for (let y = 0, page = 0; y < scaledHeight; y += pageHeight, page += 1) { if (page) pdf.addPage(); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, 10 - y, width, scaledHeight); } pdf.save(`학부모민원대응_평가결과_${new Date().toISOString().slice(0, 10)}.pdf`); } catch (e) { console.error(e); alert("PDF 저장 중 오류가 발생했습니다."); } }
render();

