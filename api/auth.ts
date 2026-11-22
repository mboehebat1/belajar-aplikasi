import { ensureSchema, randomCode, sha256Password } from "./_lib/db.js";
import {
  readJsonBody,
  sendJson,
  setCors,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http.js";
import type { Pool } from "pg";

const PACKAGES: Record<string, { name: string; prefix: string; days: number }> = {
  trial: { name: "Trial Pro (30 Hari)", prefix: "TRL", days: 30 },
  semester: { name: "Pro Semester (6 Bulan)", prefix: "SEM", days: 180 },
  yearly: { name: "Pro Tahunan (1 Tahun)", prefix: "PRO", days: 365 },
  school: { name: "Pro Sekolah (2 Tahun)", prefix: "SCH", days: 730 },
};

function mapUser(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    institution: String(r.institution ?? "Sekolah / Umum"),
    role: String(r.role) as "admin" | "guru",
    passwordHash: "",
    salt: "",
    plan: String(r.plan) as "free" | "pro",
    licenseKey: r.license_key ? String(r.license_key) : null,
    licenseActivatedAt: r.license_activated_at
      ? new Date(String(r.license_activated_at)).toISOString()
      : null,
    licenseExpiresAt: r.license_expires_at
      ? new Date(String(r.license_expires_at)).toISOString()
      : null,
    createdAt: r.created_at
      ? new Date(String(r.created_at)).toISOString()
      : new Date().toISOString(),
  };
}

function mapLicense(r: Record<string, unknown>) {
  return {
    key: String(r.key),
    planName: String(r.plan_name),
    durationDays: Number(r.duration_days),
    status: String(r.status) as "available" | "active" | "revoked",
    createdAt: r.created_at
      ? new Date(String(r.created_at)).toISOString()
      : new Date().toISOString(),
    createdBy: String(r.created_by),
    note: String(r.note ?? ""),
    activatedByEmail: r.activated_by_email ? String(r.activated_by_email) : null,
    activatedAt: r.activated_at ? new Date(String(r.activated_at)).toISOString() : null,
    expiresAt: r.expires_at ? new Date(String(r.expires_at)).toISOString() : null,
  };
}

function mapLicenseRequest(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    userEmail: String(r.user_email),
    userName: String(r.user_name),
    institution: String(r.institution ?? ""),
    packageId: String(r.package_id),
    packageName: String(r.package_name),
    durationDays: Number(r.duration_days),
    note: String(r.note ?? ""),
    status: String(r.status) as "pending" | "approved" | "rejected",
    adminNote: String(r.admin_note ?? ""),
    approvedLicenseKey: r.approved_license_key ? String(r.approved_license_key) : null,
    reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
    reviewedAt: r.reviewed_at ? new Date(String(r.reviewed_at)).toISOString() : null,
    createdAt: r.created_at
      ? new Date(String(r.created_at)).toISOString()
      : new Date().toISOString(),
  };
}

async function verifyAdmin(pool: Pool, adminEmail: string): Promise<boolean> {
  const email = adminEmail.trim().toLowerCase();
  if (!email) return false;
  const { rows } = await pool.query("SELECT role FROM zf_users WHERE email = $1", [email]);
  return rows.length > 0 && rows[0].role === "admin";
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
    const body = await readJsonBody<Record<string, unknown>>(req);
    const action = String(body.action ?? "");

    if (action === "login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const { rows } = await pool.query("SELECT * FROM zf_users WHERE email = $1", [email]);
      if (rows.length === 0) {
        sendJson(res, 200, {
          ok: false,
          error: "Email belum terdaftar. Silakan daftar akun baru terlebih dahulu.",
        });
        return;
      }
      const userRow = rows[0];
      const hash = sha256Password(password, String(userRow.salt));
      if (hash !== String(userRow.password_hash)) {
        sendJson(res, 200, { ok: false, error: "Password salah. Silakan periksa kembali." });
        return;
      }
      sendJson(res, 200, { ok: true, user: mapUser(userRow) });
      return;
    }

    if (action === "register") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const institution = String(body.institution ?? "").trim() || "Sekolah / Umum";
      const password = String(body.password ?? "");
      let role: "admin" | "guru" = "guru";
      if (body.role === "admin") {
        const requester = String(body.adminEmail ?? "");
        if (await verifyAdmin(pool, requester)) {
          role = "admin";
        }
      }

      if (name.length < 2) {
        sendJson(res, 200, { ok: false, error: "Nama lengkap minimal 2 karakter." });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(res, 200, { ok: false, error: "Format email tidak valid." });
        return;
      }
      if (password.length < 6) {
        sendJson(res, 200, { ok: false, error: "Password minimal 6 karakter." });
        return;
      }

      const dup = await pool.query("SELECT 1 FROM zf_users WHERE email = $1", [email]);
      if (dup.rows.length > 0) {
        sendJson(res, 200, { ok: false, error: "Email tersebut sudah terdaftar. Silakan masuk." });
        return;
      }

      const id = `usr_${Date.now().toString(36)}_${randomCode(5).toLowerCase()}`;
      const salt = randomCode(12);
      const passwordHash = sha256Password(password, salt);

      const { rows } = await pool.query(
        `INSERT INTO zf_users (id, name, email, institution, role, password_hash, salt, plan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'free')
         RETURNING *`,
        [id, name, email, institution, role, passwordHash, salt]
      );
      sendJson(res, 200, { ok: true, user: mapUser(rows[0]) });
      return;
    }

    if (action === "me") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) {
        sendJson(res, 200, { ok: true, user: null });
        return;
      }
      const { rows } = await pool.query("SELECT * FROM zf_users WHERE email = $1", [email]);
      sendJson(res, 200, { ok: true, user: rows[0] ? mapUser(rows[0]) : null });
      return;
    }

    if (action === "profile") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      const institution = String(body.institution ?? "").trim() || "Sekolah / Umum";
      if (name.length < 2) {
        sendJson(res, 200, { ok: false, error: "Nama lengkap minimal 2 karakter." });
        return;
      }
      const { rows } = await pool.query(
        `UPDATE zf_users SET name = $1, institution = $2 WHERE email = $3 RETURNING *`,
        [name, institution, email]
      );
      if (rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Akun tidak ditemukan." });
        return;
      }
      sendJson(res, 200, { ok: true, user: mapUser(rows[0]) });
      return;
    }

    // ==================== LICENSE REQUESTS (APPROVAL FLOW) ====================

    if (action === "submit_license_request") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const packageId = String(body.packageId ?? "yearly");
      const note = String(body.note ?? "").trim().slice(0, 300);
      const pkg = PACKAGES[packageId] ?? PACKAGES.yearly;

      const uRes = await pool.query("SELECT * FROM zf_users WHERE email = $1", [email]);
      if (uRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Silakan masuk akun guru terlebih dahulu." });
        return;
      }

      const pendingRes = await pool.query(
        `SELECT 1 FROM zf_license_requests WHERE user_email = $1 AND status = 'pending'`,
        [email]
      );
      if (pendingRes.rows.length > 0) {
        sendJson(res, 200, {
          ok: false,
          error: "Anda masih memiliki pengajuan lisensi yang menunggu persetujuan Admin.",
        });
        return;
      }

      const u = uRes.rows[0];
      const id = `req_${Date.now().toString(36)}_${randomCode(4).toLowerCase()}`;
      const { rows } = await pool.query(
        `INSERT INTO zf_license_requests (id, user_email, user_name, institution, package_id, package_name, duration_days, note, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
         RETURNING *`,
        [id, email, String(u.name), String(u.institution ?? ""), packageId, pkg.name, pkg.days, note]
      );
      sendJson(res, 200, { ok: true, request: mapLicenseRequest(rows[0]) });
      return;
    }

    if (action === "my_license_requests") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) {
        sendJson(res, 200, { ok: true, requests: [] });
        return;
      }
      const { rows } = await pool.query(
        `SELECT * FROM zf_license_requests WHERE user_email = $1 ORDER BY created_at DESC LIMIT 20`,
        [email]
      );
      sendJson(res, 200, { ok: true, requests: rows.map(mapLicenseRequest) });
      return;
    }

    if (action === "activate_license") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const key = String(body.licenseKey ?? "").trim().toUpperCase().replace(/\s+/g, "");
      if (!key) {
        sendJson(res, 200, { ok: false, error: "Masukkan kode lisensi resmi dari Admin." });
        return;
      }
      const userRes = await pool.query("SELECT * FROM zf_users WHERE email = $1", [email]);
      if (userRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Akun pengguna tidak ditemukan." });
        return;
      }
      const licRes = await pool.query("SELECT * FROM zf_licenses WHERE key = $1", [key]);
      if (licRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: `Kode lisensi "${key}" tidak valid atau belum diterbitkan Admin.` });
        return;
      }
      const lic = licRes.rows[0];
      if (lic.status === "revoked") {
        sendJson(res, 200, { ok: false, error: "Kode lisensi ini telah dicabut oleh Admin." });
        return;
      }
      if (lic.status === "active" && lic.activated_by_email !== email) {
        sendJson(res, 200, { ok: false, error: "Kode lisensi ini sudah digunakan oleh akun lain." });
        return;
      }
      if (lic.status === "active" && lic.activated_by_email === email) {
        sendJson(res, 200, { ok: false, error: "Kode lisensi ini sudah aktif pada akun Anda." });
        return;
      }

      const now = new Date();
      const currentExp = userRes.rows[0].license_expires_at
        ? new Date(String(userRes.rows[0].license_expires_at))
        : null;
      const baseDate = currentExp && currentExp.getTime() > now.getTime() ? currentExp : now;
      const expiresAt = new Date(baseDate.getTime() + Number(lic.duration_days) * 86400 * 1000);

      const updatedLic = await pool.query(
        `UPDATE zf_licenses
         SET status = 'active', activated_by_email = $1, activated_at = $2, expires_at = $3
         WHERE key = $4
         RETURNING *`,
        [email, now.toISOString(), expiresAt.toISOString(), key]
      );
      const updatedUser = await pool.query(
        `UPDATE zf_users
         SET plan = 'pro', license_key = $1, license_activated_at = $2, license_expires_at = $3
         WHERE email = $4
         RETURNING *`,
        [key, now.toISOString(), expiresAt.toISOString(), email]
      );

      sendJson(res, 200, {
        ok: true,
        user: mapUser(updatedUser.rows[0]),
        license: mapLicense(updatedLic.rows[0]),
      });
      return;
    }

    // ==================== ADMIN-ONLY ACTIONS ====================

    const adminEmail = String(body.adminEmail ?? body.createdBy ?? "").trim().toLowerCase();
    if (!(await verifyAdmin(pool, adminEmail))) {
      sendJson(res, 403, { ok: false, error: "Akses ditolak: hanya Admin yang berwenang." });
      return;
    }

    if (action === "admin_data") {
      const [uRes, lRes, rRes] = await Promise.all([
        pool.query("SELECT * FROM zf_users ORDER BY created_at DESC"),
        pool.query("SELECT * FROM zf_licenses ORDER BY created_at DESC"),
        pool.query(
          `SELECT * FROM zf_license_requests
           ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC`
        ),
      ]);
      sendJson(res, 200, {
        ok: true,
        users: uRes.rows.map(mapUser),
        licenses: lRes.rows.map(mapLicense),
        requests: rRes.rows.map(mapLicenseRequest),
      });
      return;
    }

    if (action === "admin_approve_request") {
      const requestId = String(body.requestId ?? "");
      const adminNote = String(body.adminNote ?? "").trim().slice(0, 250);
      const reqRes = await pool.query("SELECT * FROM zf_license_requests WHERE id = $1", [
        requestId,
      ]);
      if (reqRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Permintaan lisensi tidak ditemukan." });
        return;
      }
      const reqRow = reqRes.rows[0];
      if (reqRow.status !== "pending") {
        sendJson(res, 200, { ok: false, error: "Permintaan ini sudah diproses sebelumnya." });
        return;
      }

      const pkg = PACKAGES[String(reqRow.package_id)] ?? PACKAGES.yearly;
      const year = new Date().getFullYear();
      const key = `ZFARM-${pkg.prefix}-${year}-${randomCode(4)}`;
      const now = new Date();
      const targetEmail = String(reqRow.user_email);

      const uRes = await pool.query("SELECT * FROM zf_users WHERE email = $1", [targetEmail]);
      const currentExp = uRes.rows[0]?.license_expires_at
        ? new Date(String(uRes.rows[0].license_expires_at))
        : null;
      const baseDate = currentExp && currentExp.getTime() > now.getTime() ? currentExp : now;
      const expiresAt = new Date(baseDate.getTime() + Number(reqRow.duration_days) * 86400 * 1000);

      await pool.query(
        `INSERT INTO zf_licenses (key, plan_name, duration_days, status, created_by, note, activated_by_email, activated_at, expires_at)
         VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)`,
        [
          key,
          String(reqRow.package_name),
          Number(reqRow.duration_days),
          adminEmail,
          `Disetujui Admin dari permintaan #${requestId}`,
          targetEmail,
          now.toISOString(),
          expiresAt.toISOString(),
        ]
      );

      await pool.query(
        `UPDATE zf_users
         SET plan = 'pro', license_key = $1, license_activated_at = $2, license_expires_at = $3
         WHERE email = $4`,
        [key, now.toISOString(), expiresAt.toISOString(), targetEmail]
      );

      const updReq = await pool.query(
        `UPDATE zf_license_requests
         SET status = 'approved', admin_note = $1, approved_license_key = $2, reviewed_by = $3, reviewed_at = $4
         WHERE id = $5
         RETURNING *`,
        [adminNote || "Disetujui oleh Admin", key, adminEmail, now.toISOString(), requestId]
      );

      sendJson(res, 200, { ok: true, request: mapLicenseRequest(updReq.rows[0]), licenseKey: key });
      return;
    }

    if (action === "admin_reject_request") {
      const requestId = String(body.requestId ?? "");
      const adminNote = String(body.adminNote ?? "").trim().slice(0, 250) || "Ditolak oleh Admin";
      const updReq = await pool.query(
        `UPDATE zf_license_requests
         SET status = 'rejected', admin_note = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3 AND status = 'pending'
         RETURNING *`,
        [adminNote, adminEmail, requestId]
      );
      if (updReq.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Permintaan tidak ditemukan atau sudah diproses." });
        return;
      }
      sendJson(res, 200, { ok: true, request: mapLicenseRequest(updReq.rows[0]) });
      return;
    }

    if (action === "admin_generate_licenses") {
      const pkgId = String(body.packageId ?? "yearly");
      const pkg = PACKAGES[pkgId] ?? PACKAGES.yearly;
      const count = Math.min(20, Math.max(1, Number(body.count ?? 1) || 1));
      const note = String(body.note ?? "").trim() || "Dibuat oleh Admin";
      const year = new Date().getFullYear();

      const created = [];
      for (let i = 0; i < count; i++) {
        const key = `ZFARM-${pkg.prefix}-${year}-${randomCode(4)}`;
        const { rows } = await pool.query(
          `INSERT INTO zf_licenses (key, plan_name, duration_days, status, created_by, note)
           VALUES ($1, $2, $3, 'available', $4, $5)
           ON CONFLICT (key) DO NOTHING
           RETURNING *`,
          [key, pkg.name, pkg.days, adminEmail, note]
        );
        if (rows[0]) created.push(mapLicense(rows[0]));
      }
      sendJson(res, 200, { ok: true, licenses: created });
      return;
    }

    if (action === "admin_revoke_license") {
      const key = String(body.key ?? "").trim().toUpperCase();
      if (key === "ZFARM-PRO-ADMIN-0001") {
        sendJson(res, 200, { ok: false, error: "Lisensi Admin utama tidak dapat dicabut." });
        return;
      }
      const licRes = await pool.query(
        `UPDATE zf_licenses SET status = 'revoked' WHERE key = $1 RETURNING *`,
        [key]
      );
      if (licRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Lisensi tidak ditemukan." });
        return;
      }
      const targetEmail = licRes.rows[0].activated_by_email;
      if (targetEmail) {
        await pool.query(
          `UPDATE zf_users
           SET plan = 'free', license_key = NULL, license_activated_at = NULL, license_expires_at = NULL
           WHERE email = $1 AND license_key = $2`,
          [targetEmail, key]
        );
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (action === "admin_assign_pro") {
      const targetEmail = String(body.targetEmail ?? "").trim().toLowerCase();
      const pkg = PACKAGES[String(body.packageId ?? "yearly")] ?? PACKAGES.yearly;
      const year = new Date().getFullYear();
      const key = `ZFARM-${pkg.prefix}-${year}-${randomCode(4)}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + pkg.days * 86400 * 1000);

      const licRes = await pool.query(
        `INSERT INTO zf_licenses (key, plan_name, duration_days, status, created_by, note, activated_by_email, activated_at, expires_at)
         VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          key,
          pkg.name,
          pkg.days,
          adminEmail,
          `Aktivasi langsung oleh Admin untuk ${targetEmail}`,
          targetEmail,
          now.toISOString(),
          expiresAt.toISOString(),
        ]
      );
      await pool.query(
        `UPDATE zf_users
         SET plan = 'pro', license_key = $1, license_activated_at = $2, license_expires_at = $3
         WHERE email = $4`,
        [key, now.toISOString(), expiresAt.toISOString(), targetEmail]
      );
      sendJson(res, 200, { ok: true, license: mapLicense(licRes.rows[0]) });
      return;
    }

    if (action === "admin_downgrade_user") {
      const targetEmail = String(body.targetEmail ?? "").trim().toLowerCase();
      const uRes = await pool.query("SELECT * FROM zf_users WHERE email = $1", [targetEmail]);
      if (uRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Akun tidak ditemukan." });
        return;
      }
      if (uRes.rows[0].role === "admin") {
        sendJson(res, 200, { ok: false, error: "Akun Admin tidak dapat diturunkan ke paket Gratis." });
        return;
      }
      const key = uRes.rows[0].license_key;
      if (key) {
        await pool.query(`UPDATE zf_licenses SET status = 'revoked' WHERE key = $1`, [key]);
      }
      await pool.query(
        `UPDATE zf_users
         SET plan = 'free', license_key = NULL, license_activated_at = NULL, license_expires_at = NULL
         WHERE email = $1`,
        [targetEmail]
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 400, { ok: false, error: `Aksi auth tidak dikenal: ${action}` });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan server.",
    });
  }
}
