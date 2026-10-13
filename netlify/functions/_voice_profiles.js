// 학부모 유형별 목소리·연기 설계.
// 설계 원칙
//  - 유형마다 다른 사람이므로 음색(음성 이름)과 연기 지시를 유형 × 성별로 따로 둔다.
//  - 한 통화 안에서는 같은 유형·성별이면 항상 같은 음성과 같은 기본 연기를 쓴다(일관성).
//  - 대화가 달아오르거나 누그러지는 정도는 턴마다 tone으로만 조절한다(같은 인물의 강도 변화).
//  - 욕설·실제 위협은 표현하지 않는다.
import { getEnv } from "./_shared.js";

export const PERSONA_IDS = ["cooperative", "anxious", "avoidant", "demanding", "pressure"];
export const TONES = ["softened", "steady", "tense", "heated"];

// 음성 이름은 Gemini TTS 프리셋 이름입니다. 성격과의 대응은 이름의 일반적 인상에 따른 초기값이므로
// /voicetest.html에서 귀로 확인해 바꿉니다. 환경변수 GEMINI_VOICE_MAP(JSON)으로 덮어쓸 수 있습니다.
export const DEFAULT_GEMINI_VOICES = {
  female: { cooperative: "Sulafat", anxious: "Leda", avoidant: "Gacrux", demanding: "Kore", pressure: "Pulcherrima" },
  male: { cooperative: "Achird", anxious: "Enceladus", avoidant: "Schedar", demanding: "Orus", pressure: "Fenrir" }
};
// OpenAI 폴백 음성(gpt-4o-mini-tts 지원 이름). OPENAI_VOICE_MAP(JSON)으로 덮어쓸 수 있습니다.
export const DEFAULT_OPENAI_VOICES = {
  female: { cooperative: "coral", anxious: "shimmer", avoidant: "sage", demanding: "nova", pressure: "alloy" },
  male: { cooperative: "ash", anxious: "ballad", avoidant: "onyx", demanding: "echo", pressure: "verse" }
};
export const GEMINI_VOICE_CHOICES = {
  female: ["Sulafat", "Leda", "Gacrux", "Kore", "Pulcherrima", "Zephyr", "Aoede", "Callirrhoe", "Vindemiatrix", "Achernar", "Despina", "Autonoe"],
  male: ["Achird", "Enceladus", "Schedar", "Orus", "Fenrir", "Charon", "Puck", "Algieba", "Alnilam", "Algenib", "Umbriel", "Iapetus"]
};

// 유형별 연기 프로필. 소리를 가르는 요소(감정·음높이·속도·볼륨·쉼·말끝)를 구체적으로 적습니다.
export const PROFILES = {
  cooperative: {
    label: "cooperative parent",
    emotion: "warm, polite and genuinely open; mild concern, no hostility",
    pitch: "medium, gently varied, friendly rise on questions",
    pace: "steady and unhurried, clear articulation",
    volume: "soft to moderate, never raised",
    pauses: "short natural pauses between clauses",
    endings: "soft, polite endings that trail off kindly",
    ko: "정중하고 따뜻하게, 열린 태도로 또박또박 말합니다."
  },
  anxious: {
    label: "anxious parent",
    emotion: "worried and fragile, close to tearing up, seeking reassurance",
    pitch: "slightly high and unsteady, wavering on key words, rising at the end of questions",
    pace: "uneven: hesitant starts, quick when worried, then slows",
    volume: "quiet, sometimes almost a whisper, small breaths between phrases",
    pauses: "frequent short hesitations and audible breaths",
    endings: "trailing off, trembling, often ending as a worried question",
    ko: "걱정이 가득하고 위태롭게, 목소리가 살짝 떨리고 말끝을 흐리며 되묻듯 말합니다."
  },
  avoidant: {
    label: "avoidant, guarded parent",
    emotion: "tired, distrustful and withdrawn; emotions held down, a trace of bitterness",
    pitch: "low and flat with very little melody",
    pace: "slow and clipped, short phrases",
    volume: "low, subdued, a little muffled",
    pauses: "long flat pauses; sighs; unfinished sentences",
    endings: "falling, closed-off, giving up at the end of sentences",
    ko: "지치고 불신이 깔린 채 감정을 눌러 낮고 건조하게, 짧게 끊어 말합니다."
  },
  demanding: {
    label: "demanding, rights-conscious parent",
    emotion: "controlled, cold and exacting; firm irritation held under tight control",
    pitch: "medium-low, level and deliberate, stressing key words (standards, procedures, deadlines)",
    pace: "measured and precise, each demand delivered as a separate point",
    volume: "firm and clear, steady, never shouting",
    pauses: "deliberate stops after each demand, waiting for an answer",
    endings: "flat, definitive, falling like a statement of fact",
    ko: "차갑고 단호하게, 논리적으로 요구 사항을 하나씩 끊어 또렷이 말합니다."
  },
  pressure: {
    label: "pressuring, angry parent",
    emotion: "furious and impatient, pressing hard for an immediate answer; sharp, aggressive but never abusive",
    pitch: "high and tense, sharp rises on accusations, hard stress on key words",
    pace: "fast, clipped and driving; interrupts its own sentences",
    volume: "loud and forceful, raised voice, sharp consonants",
    pauses: "very few pauses; abrupt hard stops",
    endings: "hard, cut-off endings; rising challenging tone on rhetorical questions",
    ko: "화가 나 몰아붙이듯 빠르고 날카롭게, 언성을 높이고 말끝을 세게 끊어 말합니다. 욕설이나 실제 위협은 하지 않습니다."
  }
};

// 턴마다 달라지는 강도. 같은 인물이 달아오르거나 누그러지는 정도만 바꿉니다.
const INTENSITY = {
  softened: { en: "Noticeably softer than this caller's baseline: she or he has started to feel heard, less tense, slower, quieter.", ko: "상대 응대로 마음이 조금 풀려 평소보다 부드럽고 낮은 강도로 말합니다." },
  steady: { en: "This caller's baseline intensity.", ko: "기본 강도로 말합니다." },
  tense: { en: "Somewhat more strained than baseline: tighter, a little faster, more edge in the voice.", ko: "기본보다 조금 더 날이 서고 긴장된 강도로 말합니다." },
  heated: { en: "Clearly more upset than baseline within this caller's own character: louder, tighter, more pressing, but never abusive or screaming.", ko: "기본보다 분명히 더 격해졌지만 이 인물의 성격 안에서, 욕설이나 비명 없이 말합니다." }
};

export function normalizeTone(tone) { return TONES.includes(tone) ? tone : "steady"; }
export function normalizePersona(id) { return PERSONA_IDS.includes(id) ? id : "cooperative"; }
export function normalizeGender(g) { return g === "male" ? "male" : "female"; }

function mapFromEnv(name, defaults) {
  let override = {};
  try { override = JSON.parse(getEnv(name) || "{}") || {}; } catch { /* 잘못된 JSON은 무시 */ }
  return {
    female: { ...defaults.female, ...(override.female || {}) },
    male: { ...defaults.male, ...(override.male || {}) }
  };
}
export const geminiVoiceFor = (gender, persona) => mapFromEnv("GEMINI_VOICE_MAP", DEFAULT_GEMINI_VOICES)[gender][persona];
export const openaiVoiceFor = (gender, persona) => mapFromEnv("OPENAI_VOICE_MAP", DEFAULT_OPENAI_VOICES)[gender][persona];

// variant: "rich"(운영 기본) | "legacy"(한 줄 지시) — 오디션 페이지에서 비교용으로만 legacy를 씁니다.
export function geminiPrompt({ gender, persona, tone, text, variant = "rich" }) {
  const p = PROFILES[persona];
  const who = gender === "male" ? "a father in his early 40s" : "a mother in her early 40s";
  if (variant === "legacy") return `Say in Korean, ${p.emotion}: ${text}`;
  return `# AUDIO PROFILE
A ${p.label}: ${who}, native Seoul Korean speaker, on a phone call with his or her child's elementary school teacher.
## THE SCENE
A real phone call about a school complaint. The caller speaks naturally, as in real life, never like a narrator.
## DIRECTOR'S NOTES
Emotion: ${p.emotion}
Pitch: ${p.pitch}
Pace: ${p.pace}
Volume: ${p.volume}
Pauses: ${p.pauses}
Sentence endings: ${p.endings}
Intensity: ${INTENSITY[tone].en}
This caller sounds like the same person on every line of the call; only the intensity above changes. Perform the emotion strongly and audibly. Never read these notes aloud and never add words that are not in the transcript.
#### TRANSCRIPT
${text}`;
}

export function openaiInstructions({ gender, persona, tone, variant = "rich" }) {
  const p = PROFILES[persona];
  if (variant === "legacy") return p.ko;
  return `Voice: ${gender === "male" ? "a father" : "a mother"} in his or her early 40s, native Seoul Korean, on a phone call with a child's teacher.
Emotion: ${p.emotion}
Pitch: ${p.pitch}
Pacing: ${p.pace}
Volume: ${p.volume}
Pauses: ${p.pauses}
Endings: ${p.endings}
Intensity: ${INTENSITY[tone].en}
The caller sounds like the same person on every line; only the intensity changes. Perform the emotion clearly and audibly; never abusive.
(한국어 요약) ${p.ko} ${INTENSITY[tone].ko}`;
}
