"use strict";

const app = document.getElementById("app");
const $ = (id) => document.getElementById(id);
const SURVEY_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfVuQ-m2sKx8EzfvZTXAQ2X2hOI6friNjW_KV4CagNhcGT1mg/viewform?usp=publish-editor";
const CRITERIA = [
  ["Ⅰ. 의사소통", "요구 파악"], ["Ⅰ. 의사소통", "사실 확인"], ["Ⅰ. 의사소통", "공감적 표현"], ["Ⅰ. 의사소통", "명료한 설명"],
  ["Ⅱ. 갈등 완화", "감정적 상황 대응"], ["Ⅱ. 갈등 완화", "비대립적 의사소통"], ["Ⅱ. 갈등 완화", "쟁점 조정"], ["Ⅱ. 갈등 완화", "갈등 확대 방지"],
  ["Ⅲ. 절차적 대응", "사안 판단"], ["Ⅲ. 절차적 대응", "대응 범위 설정"], ["Ⅲ. 절차적 대응", "후속 절차 안내"], ["Ⅲ. 절차적 대응", "경계 설정"], ["Ⅲ. 절차적 대응", "이관·보고 판단"], ["Ⅲ. 절차적 대응", "대응 중단 판단"]
];
const PARENTS = [
  { id: "cooperative", label: "협력형", image: "assets/personas/cooperative.webp", desc: "사실과 계획을 확인하며 학교와 함께 해결책을 찾습니다.", persona: { concern: "자녀의 학교생활이 공정하게 이해되고, 재발 방지 계획이 합의되는 것", emotion: "차분하지만 중요한 사실이 누락되면 단호해짐", style: "정중하고 구체적인 표현: ‘확인해 주실 수 있을까요?’, ‘어떤 방법이 가능할까요?’", questions: "사실, 일정, 담당자, 후속 조치를 순서대로 묻는다", repeat: "답이 모호하면 같은 쟁점을 더 구체적으로 다시 확인한다", escalate: "말이 바뀌거나 근거 없는 단정, 책임 회피", settle: "감정 인정, 사실 확인, 실행 가능한 후속 일정", boundaries: "합리적 절차와 역할 분담을 존중하며 무리한 요구는 하지 않는다", closing: "계획과 회신 시점이 명확하면 협력적으로 마무리한다" } },
  { id: "anxious", label: "걱정형", image: "assets/personas/anxious.webp", desc: "자녀의 안녕을 염려하며 여러 차례 확인을 요청합니다.", persona: { concern: "자녀가 정서적·관계적으로 안전한지, 학교가 놓친 것은 없는지", emotion: "불안이 높고 조심스럽지만 반복 확인이 많음", style: "‘혹시 아이가 더 힘들어하는 건 아닐까요?’, ‘정말 괜찮은 건가요?’처럼 염려를 드러낸다", questions: "자녀 상태와 관찰 사실, 다음 확인 시점을 반복해서 묻는다", repeat: "안심할 근거가 생길 때까지 핵심 질문을 표현만 바꿔 반복한다", escalate: "감정이 무시되거나 ‘걱정하지 마세요’처럼 근거 없는 안심", settle: "감정 인정 뒤 구체 사실·확인 계획·연락 시점 제시", boundaries: "차분한 안내와 명확한 연락 범위에는 협조한다", closing: "다음 확인 날짜가 정해지면 불안을 낮추며 마무리한다" } },
  { id: "avoidant", label: "회피형", image: "assets/personas/avoidant.webp", desc: "누적된 불신 때문에 조심스럽고 방어적으로 반응합니다.", persona: { concern: "이전에도 충분히 듣지 않았다는 느낌과, 이번에도 책임이 흐려질 수 있다는 불신", emotion: "처음에는 짧고 냉담하며, 안전하다고 느끼면 사실을 조금씩 말함", style: "‘이제 와서 물어보시는 이유가 있나요?’, ‘말해도 달라지는 게 없었어요.’", questions: "직접 질문보다 과거 경험을 언급하며 학교의 진정성을 시험한다", repeat: "핵심 불만을 바로 말하지 않고 우회적으로 되짚는다", escalate: "변명, 탓 돌리기, 성급한 결론, 감정을 축소하는 말", settle: "판단 없이 경청하고, 확인할 내용과 책임 있는 다음 절차를 차분히 제시", boundaries: "안전한 대화 구조가 제시되면 관리자 동석·공식 절차도 수용한다", closing: "신뢰할 수 있는 후속 조치가 제시되면 ‘지켜보겠다’고 마무리한다" } },
  { id: "demanding", label: "요구형", image: "assets/personas/demanding.webp", desc: "권리와 절차를 기준으로 구체적 조치를 요구합니다.", persona: { concern: "자녀에게 적용되는 기준의 공정성, 학교의 조치 범위, 공식 절차", emotion: "단호하고 논리적이며 요구가 분명함", style: "‘기준이 무엇인지 설명해 주세요.’, ‘학교가 할 수 있는 조치를 분명히 알려 주세요.’", questions: "규정, 근거, 담당자, 처리 기한을 직접 묻는다", repeat: "답변이 추상적이면 요구사항을 항목별로 다시 제시한다", escalate: "불명확한 답, 과도한 약속 뒤 번복, 개인 판단으로만 처리하려는 태도", settle: "대응 가능 범위와 불가능한 범위, 공식 절차를 분명히 안내", boundaries: "정당한 경계와 절차가 제시되면 요구를 조정할 수 있다", closing: "처리 절차와 회신 책임자가 명확하면 합의의 여지를 보인다" } },
  { id: "pressure", label: "압박형", image: "assets/personas/pressure.webp", desc: "즉각적인 해결을 강하게 요구하지만 절차에 따라 조절될 수 있습니다.", persona: { concern: "문제가 지연되지 않고 지금 즉시 책임 있게 처리되는 것", emotion: "초반 감정 강도가 높고 긴박하며 말이 빨라질 수 있음", style: "‘오늘 안에 답을 듣고 싶습니다.’, ‘이대로는 그냥 넘어갈 수 없습니다.’처럼 강한 요구를 한다", questions: "즉시 조치, 책임자, 공식 민원·보고 경로를 빠르게 묻는다", repeat: "답변이 늦거나 모호하면 같은 요구를 더 강하게 반복한다", escalate: "방어적 반박, 감정 맞대응, 무리한 약속, 절차 없는 지연", settle: "차분한 경청과 사실 확인, 명확한 경계, 공식 보고·회신 절차", boundaries: "욕설·협박은 하지 않는다. 교사가 정중하게 한계를 알리면 강도를 낮추고 공식 절차로 전환한다", closing: "즉시 해결이 불가해도 담당자와 회신 시점이 명확하면 조건부로 마무리한다" } }
];
const TEACHERS = [{ id: "preservice", label: "예비교원", image: "assets/cards/preservice.svg", detail: "교직 진입 전 민원 대응의 기본 언어와 절차를 연습합니다." }, { id: "inservice", label: "현직교원", image: "assets/cards/inservice.svg", detail: "학교 맥락의 대응 범위와 협업 절차를 점검합니다." }];
const SCHOOLS = [{ id: "elementary", label: "초등학교", image: "assets/cards/elementary.svg", detail: "학생 생활·보호와 일상 소통 맥락" }, { id: "middle", label: "중학교", image: "assets/cards/middle.svg", detail: "관계 갈등과 생활지도 맥락" }, { id: "high", label: "고등학교", image: "assets/cards/high.svg", detail: "진로·평가·수업 맥락" }];
const footer = `<footer class="copyright"><strong>© 2026 박재윤. All Rights Reserved.</strong><span>예비교원의 학부모 민원 대응 역량 강화를 위한 AI 기반 시뮬레이션</span></footer>`;
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const uid = () => crypto.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function freshState() { return { screen: "title", teacherType: "", schoolLevel: "", parentId: "cooperative", situationMode: "", randomSituation: "", randomContext: "", manualSituation: "", situation: "", situationContext: "", msgs: [], apiMsgs: [], sessionId: uid(), loading: false, evaluating: false, ended: false, feedback: [], evaluation: null, error: "", draft: "", listening: false, speaking: false, autoVoice: false }; }
let S = freshState();
const parent = () => PARENTS.find((x) => x.id === S.parentId) || PARENTS[0];
const teacher = () => TEACHERS.find((x) => x.id === S.teacherType);
const school = () => SCHOOLS.find((x) => x.id === S.schoolLevel);
const teacherTurns = () => S.msgs.filter((x) => x.role === "teacher").length;

function systemPrompt() { const p = parent().persona; return `당신은 학부모 민원 대응 연습의 AI 학부모입니다. 사용자는 항상 교사 역할입니다. 당신은 언제나 학부모 역할만 유지합니다. 절대로 교사가 되거나, 교사에게 조언·평가·수업지시·역할 안내를 하지 마세요. 사과나 해결 약속도 학부모의 관점에서만 말하세요.\n\n[상황]\n교원 유형: ${teacher()?.label || "미선택"}\n학교급: ${school()?.label || "미선택"}\n민원 상황: ${S.situation}\n상세 맥락: ${S.situationContext || S.situation}\n\n[선택된 학부모 유형: ${parent().label}]\n- 핵심 관심사: ${p.concern}\n- 감정 강도: ${p.emotion}\n- 자주 쓰는 말투: ${p.style}\n- 질문 방식: ${p.questions}\n- 반복 행동: ${p.repeat}\n- 갈등 고조 조건: ${p.escalate}\n- 안정 조건: ${p.settle}\n- 허용·비허용 표현 및 경계 반응: ${p.boundaries}\n- 대화 종료 반응: ${p.closing}\n\n[공통 대화 원칙]\n- 선택된 학교급과 민원 상황에서 벗어나지 않습니다.\n- 실제 학부모처럼 2~5문장으로 반응하고, 바로 직전 교사 발화의 구체 내용을 반영합니다.\n- 반드시 교사에게 직접 말하는 1인칭 발화로만 답합니다. '학부모는', '학부모가', '상황은' 같은 해설문을 쓰지 않습니다.\n- 첫 발화부터 ${parent().label}의 말투, 감정 강도, 질문 방식이 분명하게 드러나야 합니다.\n- 욕설·협박·혐오 표현은 생성하지 않습니다. 압박형도 정중한 경계와 공식 절차 안내에 반응 강도를 낮춥니다.\n- 교사가 감정을 인정하고, 사실을 확인하며, 가능한 범위·후속 절차·경계를 명료하게 설명하면 그에 맞게 안정됩니다.`; }

function render() { ({ title: renderTitle, teacher: renderTeacher, school: renderSchool, parent: renderParent, situation: renderSituation, simulation: renderSimulation, result: renderResult }[S.screen] || renderTitle)(); }
function renderTitle() { app.innerHTML = `<main class="page title-page"><section class="title-shell"><div class="title-hero"><p class="eyebrow">TEACHER PRACTICE LAB</p><h1 class="app-title">학부모 민원 대응<br>음성 시뮬레이션</h1><p class="app-subtitle">안전한 가상 대화에서 민원 대응을 연습하고, 대화 과정을 성찰해 보세요.</p><button class="btn-primary" id="start">시작하기</button></div><article class="privacy-card title-notice glass"><h2>연구 참여 및 개인정보 안내</h2><div class="privacy-lines"><p>기본 입력은 음성 또는 텍스트이며, 음성 원본은 저장하지 않습니다.</p><p>대화 내용과 AI 평가 결과는 연구 및 시스템 개선 자료로 활용될 수 있습니다.</p><p>실제 학생·학부모·교직원 이름, 연락처, 학교명 등 개인정보는 입력하지 마세요.</p><p>AI 평가는 학습 피드백이며 객관적 역량 판정이 아닙니다.</p></div></article>${footer}</section></main>`; $("start").onclick = () => { S.screen = "teacher"; render(); }; }
function card(item, type, selected) { const detail = type === "school" ? "" : `<p>${esc(item.detail || item.desc || "")}</p>`; return `<button class="image-choice ${type === "parent" ? "parent-choice" : ""} ${selected ? "selected" : ""}" data-id="${item.id}" type="button"><span class="choice-image"><img src="${item.image}" alt="${esc(item.label)}"></span><strong>${esc(item.label)}</strong>${detail}</button>`; }
function selectionPage({ step, title, items, current, type, back, next }) { const gridClass = type === "school" ? "school-choice-grid" : type === "parent" ? "parent-choice-grid" : ""; app.innerHTML = `<main class="page"><section class="page-center selection-page"><p class="step-index">STEP ${step}</p><h2 class="step-title">${title}</h2><div class="image-choice-grid ${gridClass}">${items.map((item) => card(item, type, current === item.id)).join("")}</div><div class="btn-row"><button class="btn-secondary" id="back">뒤로</button><button class="btn-primary" id="next" ${current ? "" : "disabled"}>계속하기</button></div>${footer}</section></main>`; document.querySelectorAll(".image-choice").forEach((el) => el.onclick = () => { if (type === "teacher") S.teacherType = el.dataset.id; if (type === "school") S.schoolLevel = el.dataset.id; if (type === "parent") S.parentId = el.dataset.id; render(); }); $("back").onclick = back; $("next").onclick = next; }
function renderTeacher() { selectionPage({ step: "01", title: "현재 해당하는 항목을 선택해 주세요", items: TEACHERS, current: S.teacherType, type: "teacher", back: () => { S.screen = "title"; render(); }, next: () => { S.screen = "school"; render(); } }); }
function renderSchool() { selectionPage({ step: "02", title: "학교급을 선택해 주세요", items: SCHOOLS, current: S.schoolLevel, type: "school", back: () => { S.screen = "teacher"; render(); }, next: () => { S.screen = "parent"; render(); } }); }
function renderParent() { selectionPage({ step: "03", title: "학부모 유형을 선택해 주세요", items: PARENTS, current: S.parentId, type: "parent", back: () => { S.screen = "school"; render(); }, next: () => { S.screen = "situation"; render(); } }); }
function renderSituation() { const isRandom = S.situationMode === "random", isManual = S.situationMode === "manual", current = isRandom ? S.randomSituation : S.manualSituation; app.innerHTML = `<main class="page"><section class="page-center situation-page"><p class="step-index">STEP 04</p><h2 class="step-title">민원 상황을 선택해 주세요</h2><p class="step-copy">기존 사례 기반 상황을 생성하거나 연습할 상황을 직접 입력할 수 있습니다.</p><div class="choice-grid"><section class="choice-panel glass ${isRandom ? "selected" : ""}"><div class="choice-head"><h3>상황 생성하기</h3><button class="mode-button" id="randomMode">선택</button></div><p class="choice-help">선택한 학교급의 맥락을 반영한 가상 민원 상황을 만듭니다.</p><button class="dice-button" id="generate" type="button">✦</button><textarea id="randomInput" class="situation-textarea" placeholder="생성된 민원 상황이 표시됩니다.">${esc(S.randomSituation)}</textarea></section><section class="choice-panel glass ${isManual ? "selected" : ""}"><div class="choice-head"><h3>직접 입력하기</h3><button class="mode-button" id="manualMode">선택</button></div><p class="choice-help">개인정보를 제외한 가상 상황만 입력해 주세요.</p><textarea id="manualInput" class="situation-textarea" placeholder="연습할 민원 상황을 입력해 주세요. (개인정보는 절대 입력하지 마세요)">${esc(S.manualSituation)}</textarea></section></div><div class="btn-row"><button class="btn-secondary" id="back">뒤로</button><button class="btn-primary" id="next" ${current.trim() ? "" : "disabled"}>대화 시작</button></div>${footer}</section></main>`; const setMode = (mode) => { S.situationMode = mode; renderSituation(); }; $("randomMode").onclick = () => setMode("random"); $("manualMode").onclick = () => setMode("manual"); $("randomInput").oninput = (e) => { S.situationMode = "random"; S.randomSituation = e.target.value; $("next").disabled = !e.target.value.trim(); }; $("manualInput").oninput = (e) => { S.situationMode = "manual"; S.manualSituation = e.target.value; $("next").disabled = !e.target.value.trim(); }; $("generate").onclick = generateSituation; $("back").onclick = () => { S.screen = "parent"; render(); }; $("next").onclick = startSimulation; }
async function generateSituation() { S.situationMode = "random"; const button = $("generate"); button.disabled = true; try { const res = await fetch("/api/random-situation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacherType: teacher()?.label, schoolLevel: school()?.label }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); S.randomSituation = data.situation || ""; S.randomContext = data.situationContext || data.context || S.randomSituation; } catch (e) { S.randomSituation = `${school()?.label || "학교"}에서 학생 생활과 관련해 학부모가 사실 확인과 후속 조치를 요청하는 상황입니다.`; S.randomContext = S.randomSituation; } renderSituation(); }
function renderMessages() { if (!S.msgs.length) return `<div class="msg msg-system">AI 학부모가 대화를 시작하는 중입니다.</div>`; return S.msgs.map((m) => `<div class="msg msg-${m.role}">${m.role === "parent" || m.role === "teacher" ? `<span class="speaker-label">${m.role === "parent" ? "학부모" : "교사"}</span>` : ""}${esc(m.content)}</div>`).join(""); }
function renderSimulation() { const turns = teacherTurns(), locked = S.loading || S.evaluating || S.ended, voiceLocked = locked || S.speaking; app.innerHTML = `<main class="page"><section class="sim-page"><div class="sim-layout"><section class="chat-panel glass"><div class="chat-panel-head"><div class="box-label">대화 연습</div><span class="state-badge ${S.ended ? "" : "muted"}">${simStateLabel()}</span></div><div class="chat-history" id="history">${renderMessages()}${S.loading ? `<div class="msg msg-system">학부모가 응답을 준비하고 있습니다…</div>` : ""}</div><div class="input-strip"><textarea id="teacherInput" class="teacher-input" placeholder="${S.listening ? "말씀하시면 자동으로 입력됩니다." : "교사 역할로 답변해 주세요."}" ${locked ? "disabled" : ""}></textarea><div class="input-actions"><button id="voice" class="voice-button ${S.listening ? "listening" : ""}" ${voiceLocked ? "disabled" : ""}>${voiceButtonLabel()}</button><button id="send" class="send-button" ${locked ? "disabled" : ""}>전송</button></div></div></section><aside class="right-panel glass"><section class="side-section"><div class="box-label">연습 정보</div><dl class="simulation-info"><div><dt>교원 유형</dt><dd>${esc(teacher()?.label)}</dd></div><div><dt>학교급</dt><dd>${esc(school()?.label)}</dd></div><div><dt>학부모 유형</dt><dd>${esc(parent().label)}</dd></div></dl><h3 class="parent-name">${esc(parent().label)}</h3><p>${esc(parent().desc)}</p><div class="scenario-copy"><span>민원 상황</span><p>${esc(S.situation)}</p></div></section><section class="side-section"><div class="box-label">즉시 피드백</div><p>${S.feedback.length ? `드러난 요소: ${S.feedback.join(" · ")}` : "교사 발화 후 핵심 수행 요소를 짧게 안내합니다."}</p></section></aside></div><div class="action-row"><button class="btn-secondary" id="home">처음으로</button><button class="btn-outline" id="retry">같은 조건 재도전</button><button class="btn-primary" id="evaluate" ${turns >= 4 && !S.loading && !S.evaluating ? "" : "disabled"}>대화 종료 및 평가</button></div>${footer}</section></main>${S.evaluating ? `<div class="analysis-overlay" role="status"><div class="analysis-card"><span class="analysis-spinner"></span><strong>결과 분석 중입니다.</strong><p>조금만 기다려주세요.</p></div></div>` : ""}`; $("home").onclick = () => { stopVoice(); S = freshState(); render(); }; $("retry").onclick = restart; $("evaluate").onclick = evaluate; const input = $("teacherInput"); if (input) { input.value = S.draft; input.oninput = (e) => { S.draft = e.target.value; }; } if ($("send")) $("send").onclick = send; if ($("voice")) $("voice").onclick = toggleVoiceInput; requestAnimationFrame(() => { if ($("history")) $("history").scrollTop = $("history").scrollHeight; }); }
// ── 음성 대화 ─────────────────────────────────────────────────────────────
// 학부모 발화는 TTS로 재생하고, 교사 발화는 마이크로 받아 무음 1.8초에 자동 전송합니다.
// 학부모 음성 재생이 끝나면 마이크를 자동으로 다시 열어 대화가 끊기지 않게 합니다.
const SILENCE_COMMIT_MS = 1800;
const MAX_EMPTY_RESTARTS = 5;
const SILENT_CLIP = "data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
let recognition = null;
let silenceTimer = null;
let stopIntent = "";
let listenBase = "";
let listenFinal = "";
let emptyRestarts = 0;
let parentAudio = null;
const noticeShown = new Set();

function simStateLabel() { return S.speaking ? "학부모 발화 중" : S.listening ? "음성 입력 중" : S.ended ? "대화 마무리" : "진행 중"; }
function voiceButtonLabel() { return S.listening ? "■ 말하기 종료" : "🎙 음성"; }
function canListen() { return S.screen === "simulation" && !S.loading && !S.speaking && !S.ended && !S.evaluating; }
function syncSim() { if (S.screen === "simulation") renderSimulation(); }
function notify(key, message) { if (noticeShown.has(key)) return; noticeShown.add(key); S.msgs.push({ role: "system", content: message }); syncSim(); }

// 전체 재렌더링 없이 음성 상태만 반영합니다. 녹음 중 화면이 튀거나 입력이 사라지지 않게 합니다.
function paintVoiceState() {
  const button = $("voice");
  if (button) { button.textContent = voiceButtonLabel(); button.classList.toggle("listening", S.listening); button.disabled = S.loading || S.speaking || S.evaluating || S.ended; }
  const badge = document.querySelector(".state-badge");
  if (badge) badge.textContent = simStateLabel();
  const input = $("teacherInput");
  if (input) { if (input.value !== S.draft) input.value = S.draft; input.placeholder = S.listening ? "말씀하시면 자동으로 입력됩니다." : "교사 역할로 답변해 주세요."; }
}

function setDraft(value) { S.draft = value; const input = $("teacherInput"); if (input) input.value = value; }
function joinDraft(...parts) { return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" ").trim(); }

function ensureRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  if (recognition) return recognition;
  recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onstart = () => { S.listening = true; paintVoiceState(); };
  recognition.onresult = handleRecognitionResult;
  recognition.onerror = (event) => handleRecognitionError(event.error);
  recognition.onend = handleRecognitionEnd;
  return recognition;
}

function handleRecognitionResult(event) {
  let interim = "";
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i], chunk = result[0]?.transcript || "";
    if (result.isFinal) listenFinal = joinDraft(listenFinal, chunk); else interim = joinDraft(interim, chunk);
  }
  setDraft(joinDraft(listenBase, listenFinal, interim));
  if (S.draft.trim()) emptyRestarts = 0;
  scheduleSilenceCommit();
}

function scheduleSilenceCommit() {
  clearTimeout(silenceTimer);
  if (!S.draft.trim()) return;
  silenceTimer = setTimeout(() => stopListening("commit"), SILENCE_COMMIT_MS);
}

function handleRecognitionError(code) {
  if (code === "no-speech" || code === "aborted") return;
  if (code === "not-allowed" || code === "service-not-allowed") { S.autoVoice = false; notify("mic-denied", "마이크 권한이 차단되어 음성 입력을 사용할 수 없습니다. 브라우저 주소창의 마이크 아이콘에서 권한을 허용한 뒤 다시 시도해 주세요."); return; }
  if (code === "audio-capture") { S.autoVoice = false; notify("mic-missing", "마이크 장치를 찾지 못했습니다. 장치 연결을 확인하거나 텍스트로 입력해 주세요."); return; }
  notify("mic-network", "음성 인식이 일시적으로 중단되었습니다. 마이크 버튼을 다시 누르거나 텍스트로 입력해 주세요.");
}

function handleRecognitionEnd() {
  clearTimeout(silenceTimer); silenceTimer = null;
  S.listening = false;
  const intent = stopIntent, text = S.draft.trim();
  stopIntent = "";
  paintVoiceState();
  if (intent === "cancel") return;
  if (intent === "commit" && text) { send(); return; }
  if (!S.autoVoice) return;
  // 브라우저가 무음으로 스스로 종료한 경우입니다. 말한 내용이 있으면 보내고, 없으면 다시 엽니다.
  if (text) { send(); return; }
  emptyRestarts += 1;
  if (emptyRestarts > MAX_EMPTY_RESTARTS) { S.autoVoice = false; notify("mic-idle", "음성 입력이 잠시 멈췄습니다. 이어서 말하려면 마이크 버튼을 다시 눌러 주세요."); return; }
  if (canListen()) startListening();
}

function startListening() {
  const active = ensureRecognition();
  if (!active) { S.autoVoice = false; notify("voice-unsupported", "이 브라우저는 음성 인식을 지원하지 않습니다. 아래 입력창에 텍스트로 답변해 주세요."); return; }
  if (S.listening) return;
  listenBase = S.draft.trim();
  listenFinal = "";
  stopIntent = "";
  try { active.start(); } catch (error) { /* 이미 시작된 상태면 무시합니다. */ }
}

function stopListening(intent = "cancel") {
  clearTimeout(silenceTimer); silenceTimer = null;
  if (!recognition || !S.listening) { stopIntent = ""; return; }
  stopIntent = intent;
  try { recognition.stop(); } catch (error) { S.listening = false; paintVoiceState(); }
}

function toggleVoiceInput() {
  unlockAudio();
  if (S.listening) {
    // 말한 내용이 있으면 그대로 전송하고, 비어 있으면 음성 모드를 끕니다.
    if (S.draft.trim()) { stopListening("commit"); return; }
    S.autoVoice = false; stopListening("cancel"); return;
  }
  S.autoVoice = true;
  emptyRestarts = 0;
  startListening();
}

function maybeResumeVoice() { if (S.autoVoice && canListen() && !S.listening) { emptyRestarts = 0; startListening(); } }

function stopVoice() {
  S.autoVoice = false; S.speaking = false;
  clearTimeout(silenceTimer); silenceTimer = null;
  stopIntent = "cancel";
  if (recognition) { try { recognition.abort(); } catch (error) { /* 무시합니다. */ } }
  S.listening = false;
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
    const finish = (ok) => { parentAudio.onended = null; parentAudio.onerror = null; ok ? resolve() : reject(new Error("audio playback failed")); };
    parentAudio.onended = () => finish(true);
    parentAudio.onerror = () => finish(false);
    parentAudio.src = src;
    const played = parentAudio.play();
    if (played?.catch) played.catch(() => finish(false));
  });
}

function speakWithBrowser(text) {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) { reject(new Error("speech synthesis unavailable")); return; }
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("speech synthesis failed"));
      synth.speak(utterance);
    } catch (error) { reject(error); }
  });
}

async function speakParent(text) {
  if (!text) { maybeResumeVoice(); return; }
  stopListening("cancel");
  S.speaking = true; paintVoiceState();
  try {
    const data = await apiFetchJson("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, parentId: parent().id }) }, 1);
    await playClip(`data:${data.mime || "audio/mpeg"};base64,${data.audio}`);
  } catch (error) {
    try { await speakWithBrowser(text); } catch (fallbackError) { notify("audio-blocked", "학부모 음성을 재생하지 못했습니다. 대화 내용은 위에 글로 표시되며 연습은 그대로 이어갈 수 있습니다."); }
  } finally {
    S.speaking = false; paintVoiceState(); maybeResumeVoice();
  }
}
async function apiFetchJson(url, options, retries = 2) { let lastError; for (let attempt = 0; attempt <= retries; attempt += 1) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000); try { const res = await fetch(url, { ...options, signal: controller.signal }); clearTimeout(timer); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || "요청을 처리하지 못했습니다."); return data; } catch (error) { clearTimeout(timer); lastError = error; if (attempt >= retries) break; await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1))); } } throw lastError || new Error("네트워크 요청에 실패했습니다."); }
async function chat(initial = false) { return apiFetchJson("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: S.sessionId, teacherType: teacher()?.label, schoolLevel: school()?.label, parentId: parent().id, parentType: parent().label, situation: S.situation, situationContext: S.situationContext, system: systemPrompt(), messages: S.apiMsgs, initial, teacherTurns: teacherTurns() }) }); }
// 서버에 아예 닿지 못했을 때만 쓰는 대사입니다. 상황 설명문은 3인칭 서술이라 낭독하면 지문처럼 들리므로 인용하지 않습니다.
function fallbackParentOpening() { const p = parent(); if (p.id === "pressure") return "선생님, 금쪽이 학부모입니다. 아이한테 이야기를 듣고 바로 전화드렸습니다. 이건 그냥 넘어갈 일이 아닌 것 같은데요, 지금 확인되는 게 뭔지부터 말씀해 주세요."; if (p.id === "anxious") return "선생님, 금쪽이 엄마입니다. 어제 아이가 집에 와서 학교 이야기를 하는데 표정이 너무 안 좋아서요. 무슨 일이 있었던 건지, 아이는 지금 괜찮은 건지 여쭤보고 싶어서 연락드렸어요."; if (p.id === "avoidant") return "선생님, 금쪽이 학부모입니다. 아이한테 이야기를 좀 들었는데요. 전에도 말씀드린 적이 있었지만 그때 별로 달라진 게 없어서, 솔직히 이번에는 어떨지 잘 모르겠습니다."; if (p.id === "demanding") return "선생님, 금쪽이 학부모입니다. 아이한테 들은 이야기가 있어서 연락드렸습니다. 학교에서 확인하신 내용이 무엇인지, 그리고 어떤 기준으로 처리되는지 분명하게 알려 주시면 좋겠습니다."; return "선생님, 금쪽이 학부모입니다. 아이한테 들은 이야기가 있어서 연락드렸어요. 학교에서 확인된 내용이 있는지, 앞으로 어떻게 살펴봐 주실 수 있는지 여쭤보고 싶습니다."; }
async function startSimulation() { unlockAudio(); stopVoice(); noticeShown.clear(); S.situation = (S.situationMode === "random" ? S.randomSituation : S.manualSituation).trim(); S.situationContext = S.situationMode === "random" ? (S.randomContext || S.situation) : S.situation; S.msgs = []; S.apiMsgs = []; S.draft = ""; S.evaluation = null; S.ended = false; S.loading = true; S.screen = "simulation"; render(); let opening = ""; try { const data = await chat(true); opening = data.text; S.apiMsgs.push({ role: "assistant", content: opening }); S.msgs.push({ role: "parent", content: opening }); if (data.degraded) S.msgs.push({ role: "system", content: "AI 발화 생성에 실패해 기본 대사로 시작했습니다. 상황에 맞춘 발화가 아니므로, 오른쪽 '민원 상황'을 기준으로 연습해 주세요. 반복되면 사이트 환경변수의 OPENAI_API_KEY를 확인해 주세요." }); } catch (e) { opening = fallbackParentOpening(); S.apiMsgs.push({ role: "assistant", content: opening }); S.msgs.push({ role: "parent", content: opening }); S.msgs.push({ role: "system", content: "일시적인 네트워크 문제로 기본 학부모 발화로 시작했습니다. 이후에도 오류가 반복되면 새로고침 후 다시 시도해 주세요." }); } finally { S.loading = false; render(); } await speakParent(opening); }
async function send() { const text = (S.draft || $("teacherInput")?.value || "").trim(); if (!text || S.loading || S.ended) return; stopListening("cancel"); setDraft(""); S.msgs.push({ role: "teacher", content: text }); S.apiMsgs.push({ role: "user", content: text }); S.loading = true; render(); let reply = ""; try { const data = await chat(); reply = data.text; S.apiMsgs.push({ role: "assistant", content: reply }); S.msgs.push({ role: "parent", content: reply }); S.ended = Boolean(data.ended); S.feedback = Array.isArray(data.metCriteria) ? data.metCriteria : []; } catch (e) { S.msgs.push({ role: "system", content: `AI 응답 오류: ${e.message}. 잠시 후 다시 시도해 주세요.` }); } finally { S.loading = false; render(); } if (reply) await speakParent(reply); else maybeResumeVoice(); }
async function restart() { stopVoice(); S.sessionId = uid(); await startSimulation(); }
async function evaluate() { if (teacherTurns() < 4 || S.evaluating) return; stopVoice(); S.evaluating = true; S.error = ""; render(); try { const data = await apiFetchJson("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: S.sessionId, teacherType: teacher()?.label, schoolLevel: school()?.label, parentType: parent().label, situation: S.situation, situationContext: S.situationContext, messages: S.msgs }) }); S.evaluation = normalizeEvaluation(data); S.screen = "result"; } catch (e) { S.error = e.message || "평가 중 오류가 발생했습니다."; } finally { S.evaluating = false; render(); } if (S.error) alert(`평가를 완료하지 못했습니다: ${S.error}\n\n대화 기록은 보존되었습니다. 잠시 후 다시 시도해 주세요.`); }
function normalizeEvaluation(data) { const source = new Map((data.criteria || []).map((x) => [x.name, x])); const criteria = CRITERIA.map(([domain, name]) => ({ domain, name, score: Math.max(1, Math.min(4, Number(source.get(name)?.score) || 1)), applicable: Boolean(source.get(name)?.applicable), evidence: source.get(name)?.evidence || "구체적 근거가 확인되지 않았습니다." })); const applicable = criteria.filter((x) => x.applicable); const score = Number(data.score) || (applicable.length ? Math.round(applicable.reduce((sum, x) => sum + x.score, 0) / applicable.length * 140) / 10 : 0); return { ...data, score, criteria, applicableCount: applicable.length }; }
function renderResult() { const e = S.evaluation, domainHTML = ["Ⅰ. 의사소통", "Ⅱ. 갈등 완화", "Ⅲ. 절차적 대응"].map((domain) => { const items = e.criteria.filter((x) => x.domain === domain && x.applicable); const avg = items.length ? (items.reduce((s, x) => s + x.score, 0) / items.length).toFixed(1) : "해당 없음"; return `<article class="domain-score"><span>${domain}</span><strong>${avg}${items.length ? " / 4" : ""}</strong><small>${items.length}개 관찰</small></article>`; }).join(""); const rows = e.criteria.map((x) => `<tr><td>${x.domain}</td><td>${x.name}</td><td>${x.applicable ? `${x.score}점` : "해당 없음"}</td><td>${esc(x.evidence)}</td></tr>`).join(""); app.innerHTML = `<main class="page"><section class="result-page" id="resultCapture"><header class="result-hero"><p class="eyebrow">SIMULATION RESULT</p><h1>종합 평가 결과</h1><p>${esc(e.summary)}</p><div class="result-score"><span>환산 총점</span><strong>${e.score.toFixed(1)}</strong><em>/ 56점</em><small>관찰 요소 ${e.applicableCount}개 기준</small></div></header><section class="domain-grid">${domainHTML}</section><section class="result-section glass"><h2>종합 의견</h2><p>${esc(e.overallFeedback)}</p><div class="feedback-columns"><div><h3>강점</h3><ul>${(e.strengths || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>대화 기록을 바탕으로 다음 시도에서 확인해 보세요.</li>"}</ul></div><div><h3>보완점</h3><ul>${(e.improvements || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>사실 확인과 후속 절차 안내를 구체화해 보세요.</li>"}</ul></div></div></section><section class="result-section glass"><h2>14개 요소별 근거</h2><div class="table-wrap"><table class="result-table"><thead><tr><th>영역</th><th>요소</th><th>점수</th><th>근거</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="result-section glass conversation-export"><h2>대화 기록</h2>${S.msgs.map((m) => `<p><strong>${m.role === "teacher" ? "교사" : m.role === "parent" ? "학부모" : "안내"}</strong> ${esc(m.content)}</p>`).join("")}</section></section><div class="result-actions"><button class="btn-primary" id="retry">동일 조건 재도전</button><button class="btn-secondary" id="home">처음으로</button><button class="btn-outline" id="survey">설문 참여하기</button><button class="btn-outline" id="pdf">PDF 결과 저장</button></div>${footer}</main>`; $("retry").onclick = restart; $("home").onclick = () => { stopVoice(); S = freshState(); render(); }; $("survey").onclick = () => window.open(SURVEY_URL, "_blank", "noopener"); $("pdf").onclick = savePdf; }
async function savePdf() { if (!window.html2canvas || !window.jspdf?.jsPDF) { alert("PDF 저장 도구를 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요."); return; } const target = $("resultCapture"); try { const canvas = await window.html2canvas(target, { backgroundColor: "#f6fbfb", scale: 2, useCORS: true, windowWidth: target.scrollWidth, windowHeight: target.scrollHeight }); const { jsPDF } = window.jspdf; const pdf = new jsPDF("p", "mm", "a4"); const width = 190, pageHeight = 277.2, scaledHeight = canvas.height * width / canvas.width; for (let y = 0, page = 0; y < scaledHeight; y += pageHeight, page += 1) { if (page) pdf.addPage(); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, 10 - y, width, scaledHeight); } pdf.save(`학부모민원대응_평가결과_${new Date().toISOString().slice(0, 10)}.pdf`); } catch (e) { console.error(e); alert("PDF 저장 중 오류가 발생했습니다."); } }
render();

