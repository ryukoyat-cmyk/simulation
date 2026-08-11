"use strict";

const app = document.getElementById("app");
const $ = (id) => document.getElementById(id);
const SURVEY_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfVuQ-m2sKx8EzfvZTXAQ2X2hOI6friNjW_KV4CagNhcGT1mg/viewform?usp=publish-editor";
const LEVELS = ["초등학교", "중학교", "고등학교"];
const ROLES = ["예비교원", "현직교원"];
const VOICES = { cooperative: ["marin", "cedar"], anxious: ["coral", "sage"], avoidant: ["marin", "verse"], demanding: ["cedar", "coral"], pressure: ["sage", "verse"] };
const CRITERIA = ["요구 파악", "사실 확인", "공감적 표현", "명료한 설명", "감정적 상황 대응", "비대립적 의사소통", "쟁점 조정", "갈등 확대 방지", "사안 판단", "대응 범위 설정", "후속 절차 안내", "경계 설정", "이관·보고 판단", "대응 중단 판단"];
const PARENTS = [
  { id: "cooperative", label: "협력형", image: "assets/personas/cooperative.webp", desc: "사실 확인과 협의를 우선하며 학교와 함께 해결하려 합니다.", prompt: "차분하고 협력적입니다. 사실을 확인하고 협의를 요청합니다." },
  { id: "anxious", label: "걱정형", image: "assets/personas/anxious.webp", desc: "자녀에 대한 불안으로 반복적인 확인과 안심을 원합니다.", prompt: "불안과 확인 욕구가 큽니다. 감정 인정과 확인 계획이 있으면 점차 안정됩니다." },
  { id: "avoidant", label: "회피형", image: "assets/personas/avoidant.webp", desc: "낮은 신뢰와 누적된 불만으로 소통을 조심스러워합니다.", prompt: "체념과 낮은 신뢰가 있습니다. 안전한 상담 구조가 있으면 구체적으로 말합니다." },
  { id: "demanding", label: "요구형", image: "assets/personas/demanding.webp", desc: "권리와 규정을 근거로 예외와 즉각적 조치를 요구합니다.", prompt: "요구가 분명하고 단정적입니다. 근거와 가능한 범위를 명확히 설명하면 논리적으로 반응합니다." },
  { id: "pressure", label: "압박형", image: "assets/personas/pressure.webp", desc: "강한 압박과 즉각 해결 요구로 교사에게 부담을 줍니다.", prompt: "분노와 압박이 있으나 욕설은 하지 않습니다. 차분한 사실 확인·절차·경계 설정에 반응합니다." }
];

function uuid() { return crypto.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function initialState() { return { page: 1, teacherType: "", schoolLevel: "", situationMode: "", randomSituation: "", randomContext: "", manualSituation: "", parentId: "", voice: "marin", sessionId: uuid(), attemptId: "", attemptNumber: 1, messages: [], feedback: null, evaluation: null, loading: false, recording: false, inputMode: "voice", realtime: null, dataChannel: null, localStream: null, audio: null, realtimeError: "", recentCaseIds: [], recentTopics: [] }; }
let S = initialState();
function parent() { return PARENTS.find((item) => item.id === S.parentId) || PARENTS[0]; }
function esc(value) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function footer() { return `<footer class="copyright"><strong>© 2026 박재윤. All Rights Reserved.</strong><span>예비교원의 학부모 민원 대응 역량 강화를 위한 AI 기반 시뮬레이션</span></footer>`; }
function selectedSituation() { return S.situationMode === "manual" ? S.manualSituation.trim() : S.randomSituation.trim(); }
function teacherTurns() { return S.messages.filter((m) => m.role === "teacher").length; }
function page(title, body, controls = "") { app.innerHTML = `<main class="page"><section class="page-center"><p class="step-kicker">교사숙려캠프 · ${S.page}/7</p><h1 class="step-title">${title}</h1>${body}<div class="btn-row">${controls}</div>${footer()}</section></main>`; }

function render() {
  if (S.page === 1) return renderIntro();
  if (S.page === 2) return renderTeacher();
  if (S.page === 3) return renderSchool();
  if (S.page === 4) return renderSituation();
  if (S.page === 5) return renderParent();
  if (S.page === 6) return renderChat();
  return renderResult();
}

function renderIntro() {
  page("학부모 민원 대응 음성 시뮬레이션", `<article class="privacy-card glass"><p>이 프로그램은 예비교원과 현직교원이 가상의 학부모 민원 상황을 안전하게 연습하고 대응 과정을 성찰하도록 돕는 연구용 도구입니다.</p><ul><li>기본 입력은 음성입니다. 필요하면 텍스트 입력으로 전환할 수 있습니다.</li><li>음성 원본은 저장하지 않으며, 음성 인식 결과·대화 내용·AI 평가가 연구 및 시스템 개선 자료로 저장될 수 있습니다.</li><li>실제 학생·학부모·교직원·학교명·연락처 등 개인정보는 입력하지 마세요.</li><li>AI 평가는 학습 피드백이며 객관적인 역량 판정이 아닙니다.</li></ul></article>`, `<button class="btn-primary" id="next">시작하기</button>`);
  $("next").onclick = () => { S.page = 2; render(); };
}

function renderTeacher() {
  const cards = ROLES.map((item) => `<button class="choice-card glass ${S.teacherType === item ? "selected" : ""}" data-value="${item}"><h3>${item}</h3><p>${item === "예비교원" ? "교직 진입 전 민원 대응을 연습합니다." : "현장 적합성을 검토하거나 실제 대응을 연습합니다."}</p></button>`).join("");
  page("교원 유형을 선택하세요", `<div class="choice-grid compact">${cards}</div>`, `<button class="btn-secondary" id="back">이전</button><button class="btn-primary" id="next" ${S.teacherType ? "" : "disabled"}>계속하기</button>`);
  document.querySelectorAll(".choice-card").forEach((card) => card.onclick = () => { S.teacherType = card.dataset.value; renderTeacher(); });
  $("back").onclick = () => { S.page = 1; render(); }; $("next").onclick = () => { S.page = 3; render(); };
}

function renderSchool() {
  const cards = LEVELS.map((item) => `<button class="choice-card glass ${S.schoolLevel === item ? "selected" : ""}" data-value="${item}"><h3>${item}</h3><p>학생 생활, 학부모 표현, 학교 절차를 ${item} 맥락으로 구성합니다.</p></button>`).join("");
  page("학교급을 선택하세요", `<div class="choice-grid compact">${cards}</div>`, `<button class="btn-secondary" id="back">이전</button><button class="btn-primary" id="next" ${S.schoolLevel ? "" : "disabled"}>계속하기</button>`);
  document.querySelectorAll(".choice-card").forEach((card) => card.onclick = () => { S.schoolLevel = card.dataset.value; renderSchool(); });
  $("back").onclick = () => { S.page = 2; render(); }; $("next").onclick = () => { S.page = 4; render(); };
}

function renderSituation() {
  const ready = selectedSituation().length > 0;
  page("민원 상황을 선택하세요", `<p class="step-copy">기존 사례를 바탕으로 상황을 생성하거나, 연습할 상황을 직접 입력하세요.</p><div class="choice-grid"><section class="choice-panel glass ${S.situationMode === "random" ? "selected" : ""}"><h3>사례 기반 랜덤 상황</h3><p>선택한 학교급에 맞게 비식별화하여 재구성합니다.</p><button class="dice-button" id="dice" ${S.loading ? "disabled" : ""}>${S.loading ? "생성 중" : "🎲 생성하기"}</button><textarea id="random" placeholder="생성된 상황이 표시됩니다.">${esc(S.randomSituation)}</textarea></section><section class="choice-panel glass ${S.situationMode === "manual" ? "selected" : ""}"><h3>직접 상황 입력</h3><p class="warning">실명·학교명·연락처 등 개인정보는 입력하지 마세요. 저장 전에 다시 확인합니다.</p><textarea id="manual" placeholder="연습하고 싶은 가상 민원 상황을 입력하세요.">${esc(S.manualSituation)}</textarea></section></div>`, `<button class="btn-secondary" id="back">이전</button><button class="btn-primary" id="next" ${ready ? "" : "disabled"}>계속하기</button>`);
  $("random").onfocus = () => { S.situationMode = "random"; }; $("manual").onfocus = () => { S.situationMode = "manual"; };
  $("random").oninput = (e) => { S.randomSituation = e.target.value; S.situationMode = "random"; $("next").disabled = !selectedSituation(); };
  $("manual").oninput = (e) => { S.manualSituation = e.target.value; S.situationMode = "manual"; $("next").disabled = !selectedSituation(); };
  $("dice").onclick = generateSituation;
  $("back").onclick = () => { S.page = 3; render(); };
  $("next").onclick = () => { if (S.situationMode === "manual" && !confirm("입력한 내용에 실제 개인정보가 없는지 확인했나요?")) return; S.page = 5; render(); };
}

async function generateSituation() {
  S.loading = true; S.situationMode = "random"; renderSituation();
  try {
    const data = await post("/api/random-situation", { schoolLevel: S.schoolLevel, excludeCaseIds: S.recentCaseIds, recentTopics: S.recentTopics });
    S.randomSituation = data.situation || ""; S.randomContext = data.situationContext || data.situation || "";
    S.recentCaseIds = [...(data.sourceIds || []), ...S.recentCaseIds].slice(0, 80); S.recentTopics = [data.topic, ...S.recentTopics].filter(Boolean).slice(0, 8);
  } catch (error) { alert(error.message || "상황을 생성하지 못했습니다."); } finally { S.loading = false; renderSituation(); }
}

function renderParent() {
  const cards = PARENTS.map((item) => `<button class="parent-card glass ${S.parentId === item.id ? "selected" : ""}" data-id="${item.id}"><img src="${item.image}" alt="${item.label}"><h3>${item.label}</h3><p>${item.desc}</p></button>`).join("");
  page("학부모 유형을 선택하세요", `<div class="card-grid">${cards}</div>`, `<button class="btn-secondary" id="back">이전</button><button class="btn-primary" id="next" ${S.parentId ? "" : "disabled"}>시뮬레이션 시작</button>`);
  document.querySelectorAll(".parent-card").forEach((card) => card.onclick = () => { S.parentId = card.dataset.id; const list = VOICES[S.parentId] || ["marin"]; S.voice = list[Math.floor(Math.random() * list.length)]; renderParent(); });
  $("back").onclick = () => { S.page = 4; render(); }; $("next").onclick = startSimulation;
}

function systemPrompt() {
  const p = parent(); const context = S.situationMode === "random" ? S.randomContext : S.manualSituation;
  return `당신은 ${S.schoolLevel} 학부모 민원 응대 연습을 위한 AI 학부모입니다. 사용자는 ${S.teacherType}이며 교사 역할입니다. 학부모 유형은 ${p.label}입니다. ${p.prompt}\n자녀 이름은 항상 금쪽이로 고정합니다. 상황: ${selectedSituation()}\n상세 맥락: ${context || selectedSituation()}\n한국어로 2~4문장씩 말하세요. 직접 욕설·혐오·노골적 협박은 사용하지 마세요. 첫 응답에서는 학부모가 민원의 핵심을 먼저 말하세요. 교사가 사실 확인·공감·절차 안내·경계 설정을 균형 있게 하면 반응을 조정하세요.`;
}

async function startSimulation() {
  S.page = 6; S.loading = true; renderChat();
  try { await post("/api/save-situation", sessionPayload({ situation: selectedSituation(), situationContext: S.situationMode === "random" ? S.randomContext : S.manualSituation })); } catch (error) { console.warn(error); }
  try { await connectRealtime(); await requestParentReply(true); } catch (error) { S.realtimeError = "음성 연결을 시작하지 못했습니다. 텍스트 입력으로 계속할 수 있습니다."; console.error(error); }
  S.loading = false; renderChat();
}

function renderChat() {
  const p = parent(); const turns = teacherTurns(); const ended = turns >= 4 && S.evaluation;
  const history = S.messages.length ? S.messages.map((m) => `<article class="bubble ${m.role}"><strong>${m.role === "teacher" ? "교사" : `${p.label} 학부모`}</strong><p>${esc(m.content)}</p><small>${m.inputMode === "voice" ? "음성 입력" : m.inputMode === "text" ? "텍스트 입력" : "AI 응답"}</small></article>`).join("") : `<p class="empty">AI 학부모가 대화를 시작합니다…</p>`;
  const mode = S.inputMode === "voice" ? `<div class="voice-box"><p>${S.recording ? "녹음 중입니다. 말하기가 끝나면 종료하세요." : "음성 입력이 기본입니다. 녹음을 시작해 교사 역할로 답변하세요."}</p><button class="btn-primary" id="record" ${S.loading || !!S.realtimeError ? "disabled" : ""}>${S.recording ? "녹음 종료" : "녹음 시작"}</button><button class="text-switch" id="switchText">텍스트로 입력</button></div>` : `<form id="textForm" class="text-box"><textarea id="textInput" placeholder="교사 역할로 답변을 입력하세요." ${S.loading ? "disabled" : ""}></textarea><button class="btn-primary" ${S.loading ? "disabled" : ""}>보내기</button><button class="text-switch" type="button" id="switchVoice">음성으로 전환</button></form>`;
  app.innerHTML = `<main class="page"><section class="sim-page"><div class="sim-summary-bar glass"><div><span>교원</span><strong>${S.teacherType}</strong></div><div><span>학교급</span><strong>${S.schoolLevel}</strong></div><div><span>학부모</span><strong>${p.label}</strong></div><div class="turn-chip">교사 발화 ${turns}회</div></div><section class="situation-chip glass"><strong>민원 상황</strong><p>${esc(selectedSituation())}</p></section><section class="chat-panel glass"><div class="chat-panel-head"><h2>대화 연습</h2><span>${S.inputMode === "voice" ? "음성 기본" : "텍스트 입력"}</span></div><div class="chat-history" id="history">${history}</div>${S.feedback ? `<aside class="feedback-card"><strong>즉시 피드백</strong><p>${esc(S.feedback.message)}</p><small>드러난 요소: ${(S.feedback.met || []).join(", ") || "확인 중"} · 다음에 보완: ${(S.feedback.next || []).join(", ") || "없음"}</small></aside>` : ""}${S.realtimeError ? `<p class="error-note">${esc(S.realtimeError)}</p>` : ""}${mode}</section><div class="btn-row"><button class="btn-secondary" id="end" ${turns < 4 || S.loading ? "disabled" : ""}>대화 종료 및 평가</button>${turns < 4 ? `<span class="min-note">종합 평가는 교사 발화 4회 이후 가능합니다.</span>` : ""}</div>${footer()}</section></main>`;
  const historyEl = $("history"); if (historyEl) historyEl.scrollTop = historyEl.scrollHeight;
  if (S.inputMode === "voice") { $("record").onclick = toggleRecording; $("switchText").onclick = () => { S.inputMode = "text"; renderChat(); }; } else { $("textForm").onsubmit = sendText; $("switchVoice").onclick = () => { S.inputMode = "voice"; renderChat(); }; }
  $("end").onclick = finishEvaluation;
}

async function connectRealtime() {
  const token = await post("/api/realtime-session", { instructions: systemPrompt(), voice: S.voice });
  const pc = new RTCPeerConnection(); const audio = new Audio(); audio.autoplay = true; S.audio = audio;
  pc.ontrack = (event) => { audio.srcObject = event.streams[0]; };
  const channel = pc.createDataChannel("oai-events"); channel.addEventListener("message", (event) => handleRealtimeEvent(JSON.parse(event.data)));
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getAudioTracks().forEach((track) => { track.enabled = false; pc.addTrack(track, stream); });
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  const response = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${token.clientSecret}`, "Content-Type": "application/sdp" }, body: offer.sdp });
  if (!response.ok) throw new Error("Realtime WebRTC 연결에 실패했습니다.");
  await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
  if (channel.readyState !== "open") await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Realtime data connection timed out.")), 10000); channel.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true }); });
  S.realtime = pc; S.dataChannel = channel; S.localStream = stream;
}

function sendRealtime(event) { if (S.dataChannel?.readyState === "open") S.dataChannel.send(JSON.stringify(event)); else throw new Error("음성 연결이 준비되지 않았습니다."); }
async function requestParentReply(initial = false) { if (S.realtimeError) return; sendRealtime({ type: "response.create", response: { modalities: ["audio", "text"], instructions: initial ? "지금 학부모로서 첫 민원 발화를 시작하세요." : "방금 교사 발화에 학부모로서 응답하세요." } }); }
async function toggleRecording() {
  if (!S.localStream) return; const track = S.localStream.getAudioTracks()[0]; if (!track) return;
  if (!S.recording) { sendRealtime({ type: "input_audio_buffer.clear" }); track.enabled = true; S.recording = true; } else { track.enabled = false; S.recording = false; try { sendRealtime({ type: "input_audio_buffer.commit" }); await requestParentReply(); } catch (error) { S.realtimeError = error.message; } }
  renderChat();
}

function handleRealtimeEvent(event) {
  if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) receiveTeacher(event.transcript, "voice");
  if (event.type === "response.output_audio_transcript.done" && event.transcript) receiveParent(event.transcript);
  if (event.type === "error") { S.realtimeError = event.error?.message || "음성 연결에 문제가 발생했습니다."; renderChat(); }
}

async function sendText(event) {
  event.preventDefault(); const input = $("textInput"); const text = input.value.trim(); if (!text) return; input.value = ""; await receiveTeacher(text, "text");
  try { sendRealtime({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } }); await requestParentReply(); } catch { await fallbackParentReply(text); }
}

async function receiveTeacher(text, inputMode) {
  if (!text || S.messages.at(-1)?.role === "teacher" && S.messages.at(-1)?.content === text) return;
  S.messages.push({ role: "teacher", content: text, inputMode }); renderChat();
  persistMessage("teacher", text, inputMode); getTurnFeedback(text);
}
async function receiveParent(text) { if (!text || S.messages.at(-1)?.role === "parent" && S.messages.at(-1)?.content === text) return; S.messages.push({ role: "parent", content: text, inputMode: "ai" }); renderChat(); persistMessage("parent", text, "ai"); }
async function fallbackParentReply(text) {
  try { const data = await post("/api/chat", { system: systemPrompt(), messages: S.messages.map((m) => ({ role: m.role === "parent" ? "assistant" : "user", content: m.content })), teacherTurns: teacherTurns(), sessionId: "", parentType: parent().label, situation: selectedSituation() }); await receiveParent(data.text); } catch (error) { S.realtimeError = "AI 응답을 가져오지 못했습니다. 잠시 후 텍스트 입력으로 다시 시도하세요."; renderChat(); }
}
async function getTurnFeedback(text) { try { S.feedback = await post("/api/turn-feedback", { teacherText: text, messages: S.messages }); renderChat(); } catch { /* feedback must not interrupt practice */ } }
function sessionPayload(extra = {}) { return { sessionId: S.sessionId, attemptId: S.attemptId || S.sessionId, attemptNumber: S.attemptNumber, teacherType: S.teacherType, schoolLevel: S.schoolLevel, parentType: parent().label, situationMode: S.situationMode, ...extra }; }
async function persistMessage(role, content, inputMode) { try { await post("/api/save-message", sessionPayload({ role, content, inputMode, situation: selectedSituation() })); } catch (error) { console.warn("Message save failed", error); } }

async function finishEvaluation() {
  if (teacherTurns() < 4) return; S.loading = true; renderChat();
  try { S.evaluation = await post("/api/evaluate", sessionPayload({ situation: selectedSituation(), situationContext: S.randomContext || S.manualSituation, messages: S.messages })); S.page = 7; closeRealtime(); render(); } catch (error) { S.realtimeError = error.message || "종합평가를 생성하지 못했습니다."; S.loading = false; renderChat(); }
}
function closeRealtime() { S.localStream?.getTracks().forEach((track) => track.stop()); S.realtime?.close(); S.realtime = null; S.dataChannel = null; }

function renderResult() {
  const e = S.evaluation; if (!e) { S.page = 6; return renderChat(); }
  const previousByName = Object.fromEntries((S.previousEvaluation?.criteria || []).map((item) => [item.name, item]));
  const totalDelta = S.previousEvaluation ? Number(e.totalScore || 0) - Number(S.previousEvaluation.totalScore || 0) : null;
  const domainRows = (e.domains || []).map((d) => `<div class="score-card"><strong>${d.name}</strong><b>${d.average === null ? "해당 없음" : `${d.average.toFixed(2)} / 4.00`}</b></div>`).join("");
  const criteriaRows = (e.criteria || []).map((c) => { const before = previousByName[c.name]; const delta = before && c.status !== "not_applicable" && before.status !== "not_applicable" ? c.score - before.score : null; const comparison = delta === null ? "" : `<small class="score-delta ${delta > 0 ? "up" : delta < 0 ? "down" : "same"}">${delta > 0 ? "+" : ""}${delta}점</small>`; return `<tr><th>${c.name}</th><td>${c.status === "not_applicable" ? "해당 없음" : `${c.score}점 ${comparison}`}</td><td>${esc(c.evidence)}</td><td>${esc(c.comment)}</td></tr>`; }).join("");
  const comparison = totalDelta === null ? "" : `<p class="comparison-note">직전 시도와 비교: <strong class="${totalDelta > 0 ? "up" : totalDelta < 0 ? "down" : "same"}">${totalDelta > 0 ? "+" : ""}${totalDelta.toFixed(2)}점</strong> (56점 만점)</p>`;
  app.innerHTML = `<main class="page"><section class="result-page"><p class="step-kicker">종합 평가 · ${S.attemptNumber}번째 시도</p><h1 class="step-title">민원 대응 종합평가</h1><section class="result-score glass"><div><span>환산 총점</span><strong>${Number(e.totalScore || 0).toFixed(2)} / 56</strong></div><div><span>관찰 항목 평균</span><strong>${Number(e.averageScore || 0).toFixed(2)} / 4.00</strong></div></section>${comparison}<div class="score-grid">${domainRows}</div><section class="glass result-summary"><h2>종합 의견</h2><p>${esc(e.summary)}</p><div class="result-columns"><div><h3>강점</h3><ul>${(e.strengths || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h3>개선이 필요한 점</h3><ul>${(e.improvements || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div><h3>대안 발화</h3><ul>${(e.alternatives || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section><section class="glass table-wrap"><h2>세부 평가 근거</h2><table><thead><tr><th>요소</th><th>점수</th><th>대화 근거</th><th>피드백</th></tr></thead><tbody>${criteriaRows}</tbody></table></section><section class="glass retry-card"><h2>같은 상황과 학부모로 다시 연습할까요?</h2><p>재도전하면 직전 시도와 결과를 비교할 수 있습니다.</p><div class="btn-row"><button class="btn-primary" id="retry">같은 조건으로 재도전</button><a class="btn-secondary survey-link" href="${SURVEY_URL}" target="_blank" rel="noopener">설문 참여하기</a><button class="btn-secondary" id="home">처음으로</button></div></section>${footer()}</section></main>`;
  $("retry").onclick = retry; $("home").onclick = () => { closeRealtime(); S = initialState(); render(); };
}

function retry() { const previous = S.evaluation; S.sessionId = uuid(); S.attemptId = S.attemptId || uuid(); S.attemptNumber += 1; S.messages = []; S.feedback = null; S.evaluation = null; S.realtimeError = ""; S.loading = false; S.page = 6; S.previousEvaluation = previous; startSimulation(); }
async function post(url, body) { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다."); return data; }

render();
