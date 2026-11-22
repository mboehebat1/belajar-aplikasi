import { ensureSchema, randomCode, type QuestionItem } from "./_lib/db.js";
import {
  getQueryParam,
  readJsonBody,
  sendJson,
  setCors,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http.js";

interface PlayerAnswerRecord {
  qIndex: number;
  correct: boolean;
  answer: string;
  points: number;
  answeredAt: string;
}

function mapSession(r: Record<string, unknown>, hideAnswers: boolean) {
  const rawQuestions = (Array.isArray(r.questions_json) ? r.questions_json : []) as QuestionItem[];
  const questions = hideAnswers
    ? rawQuestions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options ?? [],
      }))
    : rawQuestions;

  return {
    code: String(r.code),
    ownerEmail: String(r.owner_email),
    classId: r.class_id ? String(r.class_id) : null,
    className: String(r.class_name ?? "Kelas Umum"),
    packId: String(r.pack_id),
    packTitle: String(r.pack_title),
    mode: String(r.mode) as "kebun" | "arena" | "asesmen",
    status: String(r.status) as "lobby" | "playing" | "paused" | "finished",
    durationSec: Number(r.duration_sec ?? 600),
    kkm: Number(r.kkm ?? 75),
    maxPlayers: Number(r.max_players ?? 40),
    broadcastMsg: String(r.broadcast_msg ?? ""),
    questions,
    totalQuestions: rawQuestions.length,
    startedAt: r.started_at ? new Date(String(r.started_at)).toISOString() : null,
    endedAt: r.ended_at ? new Date(String(r.ended_at)).toISOString() : null,
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : new Date().toISOString(),
  };
}

function mapPlayer(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    sessionCode: String(r.session_code),
    name: String(r.name),
    avatar: String(r.avatar ?? "🧑‍🌾"),
    score: Number(r.score ?? 0),
    correctCount: Number(r.correct_count ?? 0),
    wrongCount: Number(r.wrong_count ?? 0),
    harvests: Number(r.harvests ?? 0),
    currentQ: Number(r.current_q ?? 0),
    finished: Boolean(r.finished),
    posX: Number(r.pos_x ?? 50),
    posY: Number(r.pos_y ?? 50),
    answers: (Array.isArray(r.answers_json) ? r.answers_json : []) as PlayerAnswerRecord[],
    joinedAt: r.joined_at ? new Date(String(r.joined_at)).toISOString() : new Date().toISOString(),
    lastSeenAt: r.last_seen_at ? new Date(String(r.last_seen_at)).toISOString() : new Date().toISOString(),
  };
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function gradeAnswer(
  q: QuestionItem,
  selectedIndex: number | null,
  textAnswer: string
): { correct: boolean; normalizedAnswer: string } {
  if (q.type === "short") {
    const cleanUser = textAnswer.trim().toLowerCase().replace(/\s+/g, " ");
    const cleanExpected = String(q.correctText ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    return {
      correct: cleanExpected.length > 0 && cleanUser === cleanExpected,
      normalizedAnswer: textAnswer.trim(),
    };
  }
  const idx = typeof selectedIndex === "number" ? selectedIndex : -1;
  return {
    correct: idx === q.correctIndex,
    normalizedAnswer: q.options?.[idx] ?? String(idx),
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
      const code = getQueryParam(req, "code").trim();
      const ownerEmail = getQueryParam(req, "ownerEmail").trim().toLowerCase();
      const role = getQueryParam(req, "role").trim().toLowerCase();
      const playerId = getQueryParam(req, "playerId").trim();

      if (code) {
        const sRes = await pool.query("SELECT * FROM zf_sessions WHERE code = $1", [code]);
        if (sRes.rows.length === 0) {
          sendJson(res, 200, { ok: false, error: `Ruang dengan kode ${code} tidak ditemukan.` });
          return;
        }

        let sessionRow = sRes.rows[0];
        // Auto-finish if duration expired while playing
        if (sessionRow.status === "playing" && sessionRow.started_at) {
          const startedMs = new Date(String(sessionRow.started_at)).getTime();
          const durationMs = Number(sessionRow.duration_sec ?? 600) * 1000;
          if (Date.now() > startedMs + durationMs) {
            const upd = await pool.query(
              `UPDATE zf_sessions SET status = 'finished', ended_at = NOW() WHERE code = $1 RETURNING *`,
              [code]
            );
            sessionRow = upd.rows[0];
          }
        }

        if (playerId) {
          await pool.query("UPDATE zf_session_players SET last_seen_at = NOW() WHERE id = $1", [
            playerId,
          ]);
        }

        const pRes = await pool.query(
          `SELECT * FROM zf_session_players
           WHERE session_code = $1
           ORDER BY score DESC, correct_count DESC, joined_at ASC`,
          [code]
        );

        const hideAnswers = role === "student" && sessionRow.status !== "finished";
        const players = pRes.rows.map(mapPlayer);
        const rawQuestions = (Array.isArray(sessionRow.questions_json)
          ? sessionRow.questions_json
          : []) as QuestionItem[];

        // Compute item analysis for teacher
        const itemStats =
          role === "teacher"
            ? rawQuestions.map((q, idx) => {
                let attempts = 0;
                let correct = 0;
                for (const p of players) {
                  const found = p.answers.find((a) => a.qIndex === idx);
                  if (found) {
                    attempts++;
                    if (found.correct) correct++;
                  }
                }
                return {
                  qIndex: idx,
                  prompt: q.prompt,
                  attempts,
                  correct,
                  accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
                };
              })
            : undefined;

        sendJson(res, 200, {
          ok: true,
          session: mapSession(sessionRow, hideAnswers),
          players,
          itemStats,
          serverTime: new Date().toISOString(),
        });
        return;
      }

      if (ownerEmail) {
        const listRes = await pool.query(
          `SELECT s.*, (SELECT COUNT(*)::int FROM zf_session_players p WHERE p.session_code = s.code) AS player_count
           FROM zf_sessions s
           WHERE s.owner_email = $1
           ORDER BY s.created_at DESC
           LIMIT 25`,
          [ownerEmail]
        );
        sendJson(res, 200, {
          ok: true,
          sessions: listRes.rows.map((r) => ({
            ...mapSession(r, false),
            playerCount: Number(r.player_count ?? 0),
          })),
        });
        return;
      }

      sendJson(res, 400, { ok: false, error: "Parameter code atau ownerEmail diperlukan." });
      return;
    }

    const body = await readJsonBody<Record<string, unknown>>(req);
    const action = String(body.action ?? "");

    if (action === "create") {
      const ownerEmail = String(body.ownerEmail ?? "").trim().toLowerCase();
      const classId = body.classId ? String(body.classId) : null;
      const className = String(body.className ?? "Kelas Umum").trim();
      const packId = String(body.packId ?? "");
      const mode = ["kebun", "arena", "asesmen"].includes(String(body.mode))
        ? String(body.mode)
        : "kebun";
      const durationSec = Math.min(3600, Math.max(60, Number(body.durationSec ?? 600) || 600));
      const kkm = Math.min(100, Math.max(10, Number(body.kkm ?? 75) || 75));
      const maxPlayers = Math.min(120, Math.max(5, Number(body.maxPlayers ?? 40) || 40));

      if (!ownerEmail) {
        sendJson(res, 200, { ok: false, error: "Silakan masuk akun guru Pro terlebih dahulu." });
        return;
      }

      const userRes = await pool.query("SELECT * FROM zf_users WHERE email = $1", [ownerEmail]);
      if (userRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Akun guru tidak ditemukan." });
        return;
      }
      const u = userRes.rows[0];
      const expOk = !u.license_expires_at || new Date(String(u.license_expires_at)).getTime() > Date.now();
      if (u.plan !== "pro" || !expOk) {
        sendJson(res, 200, {
          ok: false,
          error: "Fitur Ruang Mabar & Buat Kelas memerlukan akun Pro aktif. Aktifkan lisensi Anda terlebih dahulu.",
        });
        return;
      }

      const packRes = await pool.query("SELECT * FROM zf_packs WHERE id = $1", [packId]);
      if (packRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Paket soal tidak ditemukan." });
        return;
      }
      const pack = packRes.rows[0];

      let code = generateSixDigitCode();
      for (let i = 0; i < 6; i++) {
        const exists = await pool.query("SELECT 1 FROM zf_sessions WHERE code = $1", [code]);
        if (exists.rows.length === 0) break;
        code = generateSixDigitCode();
      }

      const { rows } = await pool.query(
        `INSERT INTO zf_sessions (code, owner_email, class_id, class_name, pack_id, pack_title, mode, status, duration_sec, kkm, max_players, questions_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'lobby', $8, $9, $10, $11::jsonb)
         RETURNING *`,
        [
          code,
          ownerEmail,
          classId,
          className,
          pack.id,
          pack.title,
          mode,
          durationSec,
          kkm,
          maxPlayers,
          JSON.stringify(pack.questions_json ?? []),
        ]
      );

      sendJson(res, 200, { ok: true, session: mapSession(rows[0], false) });
      return;
    }

    if (action === "join") {
      const code = String(body.code ?? "").trim();
      const name = String(body.name ?? "").trim();
      const avatar = String(body.avatar ?? "🧑‍🌾").trim() || "🧑‍🌾";

      if (!/^\d{6}$/.test(code)) {
        sendJson(res, 200, { ok: false, error: "Kode ruang harus berupa 6 angka." });
        return;
      }
      if (name.length < 2) {
        sendJson(res, 200, { ok: false, error: "Masukkan nama lengkap atau nama panggilan (min. 2 huruf)." });
        return;
      }

      const sRes = await pool.query("SELECT * FROM zf_sessions WHERE code = $1", [code]);
      if (sRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: `Ruang dengan kode ${code} tidak ditemukan. Periksa kembali kode dari guru.` });
        return;
      }
      const session = sRes.rows[0];
      if (session.status === "finished") {
        sendJson(res, 200, { ok: false, error: "Sesi permainan ini sudah selesai." });
        return;
      }

      const countRes = await pool.query<{ n: string }>(
        "SELECT COUNT(*)::text AS n FROM zf_session_players WHERE session_code = $1",
        [code]
      );
      const currentCount = Number(countRes.rows[0]?.n ?? 0);
      if (currentCount >= Number(session.max_players ?? 40)) {
        sendJson(res, 200, {
          ok: false,
          error: `Ruang sudah penuh (${session.max_players} pemain).`,
        });
        return;
      }

      const playerId = `plr_${Date.now().toString(36)}_${randomCode(5).toLowerCase()}`;
      const posX = 12 + Math.floor(Math.random() * 76);
      const posY = 16 + Math.floor(Math.random() * 68);

      const { rows } = await pool.query(
        `INSERT INTO zf_session_players (id, session_code, name, avatar, pos_x, pos_y)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [playerId, code, name, avatar, posX, posY]
      );

      sendJson(res, 200, {
        ok: true,
        player: mapPlayer(rows[0]),
        session: mapSession(session, true),
      });
      return;
    }

    if (action === "start" || action === "pause" || action === "finish" || action === "broadcast") {
      const code = String(body.code ?? "").trim();
      const ownerEmail = String(body.ownerEmail ?? "").trim().toLowerCase();
      const sRes = await pool.query(
        "SELECT * FROM zf_sessions WHERE code = $1 AND owner_email = $2",
        [code, ownerEmail]
      );
      if (sRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Sesi tidak ditemukan atau bukan milik akun Anda." });
        return;
      }

      if (action === "start") {
        const upd = await pool.query(
          `UPDATE zf_sessions
           SET status = 'playing', started_at = COALESCE(started_at, NOW())
           WHERE code = $1 RETURNING *`,
          [code]
        );
        sendJson(res, 200, { ok: true, session: mapSession(upd.rows[0], false) });
        return;
      }

      if (action === "pause") {
        const nextStatus = sRes.rows[0].status === "paused" ? "playing" : "paused";
        const upd = await pool.query(
          `UPDATE zf_sessions SET status = $1 WHERE code = $2 RETURNING *`,
          [nextStatus, code]
        );
        sendJson(res, 200, { ok: true, session: mapSession(upd.rows[0], false) });
        return;
      }

      if (action === "finish") {
        const upd = await pool.query(
          `UPDATE zf_sessions SET status = 'finished', ended_at = NOW() WHERE code = $1 RETURNING *`,
          [code]
        );
        sendJson(res, 200, { ok: true, session: mapSession(upd.rows[0], false) });
        return;
      }

      if (action === "broadcast") {
        const message = String(body.message ?? "").trim().slice(0, 200);
        const upd = await pool.query(
          `UPDATE zf_sessions SET broadcast_msg = $1 WHERE code = $2 RETURNING *`,
          [message, code]
        );
        sendJson(res, 200, { ok: true, session: mapSession(upd.rows[0], false) });
        return;
      }
    }

    if (action === "answer") {
      const code = String(body.code ?? "").trim();
      const playerId = String(body.playerId ?? "").trim();
      const qIndex = Number(body.qIndex ?? 0);
      const selectedIndex =
        body.selectedIndex === null || body.selectedIndex === undefined
          ? null
          : Number(body.selectedIndex);
      const textAnswer = String(body.textAnswer ?? "");
      const speedBonus = Math.min(50, Math.max(0, Number(body.speedBonus ?? 0) || 0));

      const [sRes, pRes] = await Promise.all([
        pool.query("SELECT * FROM zf_sessions WHERE code = $1", [code]),
        pool.query("SELECT * FROM zf_session_players WHERE id = $1 AND session_code = $2", [
          playerId,
          code,
        ]),
      ]);

      if (sRes.rows.length === 0 || pRes.rows.length === 0) {
        sendJson(res, 200, { ok: false, error: "Sesi atau pemain tidak ditemukan." });
        return;
      }

      const session = sRes.rows[0];
      if (session.status !== "playing") {
        sendJson(res, 200, { ok: false, error: "Permainan sedang tidak aktif." });
        return;
      }

      const questions = (Array.isArray(session.questions_json)
        ? session.questions_json
        : []) as QuestionItem[];
      const q = questions[qIndex];
      if (!q) {
        sendJson(res, 200, { ok: false, error: "Nomor soal tidak valid." });
        return;
      }

      const player = pRes.rows[0];
      const existingAnswers = (Array.isArray(player.answers_json)
        ? player.answers_json
        : []) as PlayerAnswerRecord[];

      if (existingAnswers.some((a) => a.qIndex === qIndex)) {
        sendJson(res, 200, { ok: false, error: "Soal ini sudah dijawab." });
        return;
      }

      const { correct, normalizedAnswer } = gradeAnswer(q, selectedIndex, textAnswer);
      const nextCorrect = Number(player.correct_count) + (correct ? 1 : 0);
      const nextWrong = Number(player.wrong_count) + (correct ? 0 : 1);
      const nextHarvests = Math.floor(nextCorrect / 2);
      const harvestBonus = nextHarvests > Number(player.harvests) ? 50 : 0;
      const earned = correct
        ? session.mode === "asesmen"
          ? 100
          : 100 + speedBonus + harvestBonus
        : 0;

      const updatedAnswers: PlayerAnswerRecord[] = [
        ...existingAnswers,
        {
          qIndex,
          correct,
          answer: normalizedAnswer,
          points: earned,
          answeredAt: new Date().toISOString(),
        },
      ];

      const nextQ = Math.min(questions.length, updatedAnswers.length);
      const finished = updatedAnswers.length >= questions.length;
      const nextScore = Number(player.score) + earned;
      const posX =
        typeof body.posX === "number"
          ? Math.min(92, Math.max(8, Math.round(body.posX)))
          : 12 + Math.floor(Math.random() * 76);
      const posY =
        typeof body.posY === "number"
          ? Math.min(88, Math.max(12, Math.round(body.posY)))
          : 16 + Math.floor(Math.random() * 68);

      const upd = await pool.query(
        `UPDATE zf_session_players
         SET score = $1, correct_count = $2, wrong_count = $3, harvests = $4,
             current_q = $5, finished = $6, pos_x = $7, pos_y = $8,
             answers_json = $9::jsonb, last_seen_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
          nextScore,
          nextCorrect,
          nextWrong,
          nextHarvests,
          nextQ,
          finished,
          posX,
          posY,
          JSON.stringify(updatedAnswers),
          playerId,
        ]
      );

      sendJson(res, 200, {
        ok: true,
        correct: session.mode === "asesmen" ? null : correct,
        earned,
        explanation: session.mode === "asesmen" ? null : (q.explanation ?? null),
        player: mapPlayer(upd.rows[0]),
      });
      return;
    }

    if (action === "move") {
      const playerId = String(body.playerId ?? "").trim();
      const posX = Math.min(92, Math.max(8, Math.round(Number(body.posX ?? 50))));
      const posY = Math.min(88, Math.max(12, Math.round(Number(body.posY ?? 50))));
      await pool.query(
        `UPDATE zf_session_players SET pos_x = $1, pos_y = $2, last_seen_at = NOW() WHERE id = $3`,
        [posX, posY, playerId]
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 400, { ok: false, error: `Aksi sessions tidak dikenal: ${action}` });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan server.",
    });
  }
}
