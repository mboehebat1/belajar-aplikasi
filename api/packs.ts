import { ensureSchema, randomCode } from "./_lib/db.js";
import {
  getQueryParam,
  readJsonBody,
  sendJson,
  setCors,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http.js";

function mapClass(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    ownerEmail: String(r.owner_email),
    name: String(r.name),
    grade: String(r.grade ?? "Umum"),
    subject: String(r.subject ?? "Semua Mapel"),
    description: String(r.description ?? ""),
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : new Date().toISOString(),
  };
}

function mapPack(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    ownerEmail: String(r.owner_email),
    title: String(r.title),
    subject: String(r.subject ?? "Umum"),
    grade: String(r.grade ?? "Umum"),
    materialText: String(r.material_text ?? ""),
    questions: Array.isArray(r.questions_json) ? r.questions_json : [],
    isPublic: Boolean(r.is_public),
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : new Date().toISOString(),
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const pool = await ensureSchema();

    if (req.method === "GET") {
      const ownerEmail = getQueryParam(req, "ownerEmail").trim().toLowerCase();
      const [classesRes, packsRes] = await Promise.all([
        ownerEmail
          ? pool.query(
              "SELECT * FROM zf_classes WHERE owner_email = $1 ORDER BY created_at DESC",
              [ownerEmail]
            )
          : pool.query("SELECT * FROM zf_classes ORDER BY created_at DESC LIMIT 20"),
        ownerEmail
          ? pool.query(
              "SELECT * FROM zf_packs WHERE is_public = TRUE OR owner_email = $1 ORDER BY created_at DESC",
              [ownerEmail]
            )
          : pool.query("SELECT * FROM zf_packs WHERE is_public = TRUE ORDER BY created_at DESC"),
      ]);
      sendJson(res, 200, {
        ok: true,
        classes: classesRes.rows.map(mapClass),
        packs: packsRes.rows.map(mapPack),
      });
      return;
    }

    const body = await readJsonBody<Record<string, unknown>>(req);
    const action = String(body.action ?? "");

    if (action === "create_class") {
      const ownerEmail = String(body.ownerEmail ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      const grade = String(body.grade ?? "Umum").trim();
      const subject = String(body.subject ?? "Semua Mapel").trim();
      const description = String(body.description ?? "").trim();
      if (!ownerEmail) {
        sendJson(res, 200, { ok: false, error: "Silakan masuk akun guru Pro terlebih dahulu." });
        return;
      }
      if (name.length < 2) {
        sendJson(res, 200, { ok: false, error: "Nama kelas minimal 2 karakter." });
        return;
      }
      const id = `cls_${Date.now().toString(36)}_${randomCode(4).toLowerCase()}`;
      const { rows } = await pool.query(
        `INSERT INTO zf_classes (id, owner_email, name, grade, subject, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, ownerEmail, name, grade, subject, description]
      );
      sendJson(res, 200, { ok: true, classroom: mapClass(rows[0]) });
      return;
    }

    if (action === "delete_class") {
      const id = String(body.id ?? "");
      const ownerEmail = String(body.ownerEmail ?? "").trim().toLowerCase();
      await pool.query("DELETE FROM zf_classes WHERE id = $1 AND owner_email = $2", [
        id,
        ownerEmail,
      ]);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (action === "save_pack") {
      const ownerEmail = String(body.ownerEmail ?? "guest@local").trim().toLowerCase();
      const title = String(body.title ?? "").trim();
      const subject = String(body.subject ?? "Umum").trim();
      const grade = String(body.grade ?? "Umum").trim();
      const materialText = String(body.materialText ?? "").trim();
      const questions = Array.isArray(body.questions) ? body.questions : [];
      if (title.length < 2) {
        sendJson(res, 200, { ok: false, error: "Judul paket soal minimal 2 karakter." });
        return;
      }
      if (questions.length === 0) {
        sendJson(res, 200, { ok: false, error: "Tambahkan minimal 1 soal ke dalam paket." });
        return;
      }
      const id = String(body.id ?? "") || `pack_${Date.now().toString(36)}_${randomCode(4).toLowerCase()}`;
      const { rows } = await pool.query(
        `INSERT INTO zf_packs (id, owner_email, title, subject, grade, material_text, questions_json, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, FALSE)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           subject = EXCLUDED.subject,
           grade = EXCLUDED.grade,
           material_text = EXCLUDED.material_text,
           questions_json = EXCLUDED.questions_json
         RETURNING *`,
        [id, ownerEmail, title, subject, grade, materialText, JSON.stringify(questions)]
      );
      sendJson(res, 200, { ok: true, pack: mapPack(rows[0]) });
      return;
    }

    if (action === "delete_pack") {
      const id = String(body.id ?? "");
      const ownerEmail = String(body.ownerEmail ?? "").trim().toLowerCase();
      await pool.query(
        "DELETE FROM zf_packs WHERE id = $1 AND owner_email = $2 AND is_public = FALSE",
        [id, ownerEmail]
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 400, { ok: false, error: `Aksi packs tidak dikenal: ${action}` });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan server.",
    });
  }
}
