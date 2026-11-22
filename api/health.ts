import { ensureSchema, getDatabaseUrl } from "./_lib/db.js";
import { sendJson, setCors, type ApiRequest, type ApiResponse } from "./_lib/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  const configured = Boolean(getDatabaseUrl());
  if (!configured) {
    sendJson(res, 200, {
      ok: true,
      dbConfigured: false,
      dbConnected: false,
      mode: "local",
      message: "DATABASE_URL belum diatur di Environment Variables Vercel.",
    });
    return;
  }

  try {
    const pool = await ensureSchema();
    await pool.query("SELECT 1");
    sendJson(res, 200, {
      ok: true,
      dbConfigured: true,
      dbConnected: true,
      mode: "postgres",
      message: "PostgreSQL terhubung dan siap untuk 30+ pemain bersamaan.",
    });
  } catch (err) {
    sendJson(res, 200, {
      ok: false,
      dbConfigured: true,
      dbConnected: false,
      mode: "local",
      error: err instanceof Error ? err.message : "Gagal terhubung ke PostgreSQL.",
    });
  }
}
