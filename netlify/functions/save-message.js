import { json, readJson, saveToSupabase } from "./_shared.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readJson(req);
  if (!body?.sessionId || !body?.content || !["teacher", "parent"].includes(body.role)) {
    return json({ error: "sessionId, role, and content are required" }, 400);
  }
  const saved = await saveToSupabase("simulation_messages", {
    session_id: body.sessionId,
    attempt_id: body.attemptId || body.sessionId,
    attempt_number: Number(body.attemptNumber || 1),
    teacher_type: body.teacherType || null,
    school_level: body.schoolLevel || null,
    parent_type: body.parentType || null,
    situation: body.situation || null,
    role: body.role,
    input_mode: body.inputMode || null,
    content: String(body.content).slice(0, 12000)
  });
  return json({ saved });
};

export const config = { path: "/api/save-message", method: ["POST"] };
