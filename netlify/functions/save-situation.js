import { json, readJson, saveToSupabase } from "./_shared.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  if (!body?.sessionId || !body?.situation) {
    return json({ error: "sessionId and situation are required" }, 400);
  }

  const saved = await saveToSupabase("simulation_situations", {
    session_id: body.sessionId,
    parent_type: body.parentType || null,
    situation_mode: body.situationMode || null,
    situation: body.situation,
    privacy_acknowledged_at: body.privacyAcknowledgedAt || null
  });

  return json({ saved });
};

export const config = {
  path: "/api/save-situation",
  method: ["POST"]
};
