import { useEffect, useMemo, useState, type FormEvent } from "react";
import { isProActive, type UserAccount } from "../lib/authLicenseStore";
import {
  AVATARS,
  apiAddDemoStudents,
  apiControlSession,
  apiCreateClass,
  apiCreateSession,
  apiDeleteClass,
  apiDeletePack,
  apiFetchClassesAndPacks,
  apiGetSessionState,
  apiJoinSession,
  apiListSessions,
  apiSavePack,
  apiSubmitAnswer,
  exportSessionCsv,
  type BackendHealth,
  type ClassroomItem,
  type GameSession,
  type ItemStat,
  type QuestionItem,
  type QuestionPack,
  type SessionPlayer,
} from "../lib/gameApi";

export type WorkspaceView = "classes" | "packs" | "student_join" | "solo";

interface GameWorkspaceProps {
  open: boolean;
  initialView: WorkspaceView;
  initialJoinCode?: string;
  user: UserAccount | null;
  health: BackendHealth | null;
  onClose: () => void;
  onOpenPortal: (tab: "akun" | "lisensi" | "admin") => void;
}

const CROP_ICONS = ["🌾", "🥕", "🌽", "🍅", "🌻", "🍓"];

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function GameWorkspace({
  open,
  initialView,
  initialJoinCode = "",
  user,
  health,
  onClose,
  onOpenPortal,
}: GameWorkspaceProps) {
  const [view, setView] = useState<WorkspaceView | "teacher_room" | "student_play">(initialView);
  const [classes, setClasses] = useState<ClassroomItem[]>([]);
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Create class form
  const [clsName, setClsName] = useState("");
  const [clsGrade, setClsGrade] = useState("SD Kelas 5");
  const [clsSubject, setClsSubject] = useState("Matematika");
  const [clsDesc, setClsDesc] = useState("");

  // Create live session form
  const [sessClassId, setSessClassId] = useState("");
  const [sessPackId, setSessPackId] = useState("pack_mtk_sd");
  const [sessMode, setSessMode] = useState<"kebun" | "arena" | "asesmen">("kebun");
  const [sessDurationMin, setSessDurationMin] = useState(10);
  const [sessKkm, setSessKkm] = useState(75);
  const [sessMaxPlayers, setSessMaxPlayers] = useState(40);

  // Active teacher room
  const [teacherCode, setTeacherCode] = useState("");
  const [liveSession, setLiveSession] = useState<GameSession | null>(null);
  const [livePlayers, setLivePlayers] = useState<SessionPlayer[]>([]);
  const [itemStats, setItemStats] = useState<ItemStat[]>([]);
  const [broadcastInput, setBroadcastInput] = useState("");

  // Student join & play
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [joinName, setJoinName] = useState("");
  const [joinAvatar, setJoinAvatar] = useState(AVATARS[0]);
  const [studentPlayer, setStudentPlayer] = useState<SessionPlayer | null>(null);
  const [studentSession, setStudentSession] = useState<GameSession | null>(null);
  const [studentPlayers, setStudentPlayers] = useState<SessionPlayer[]>([]);
  const [studentShortAns, setStudentShortAns] = useState("");
  const [lastFeedback, setLastFeedback] = useState<{
    correct: boolean | null;
    earned: number;
    explanation: string | null;
  } | null>(null);
  const [qOpenedAt, setQOpenedAt] = useState<number>(Date.now());

  // Solo game
  const [soloPackId, setSoloPackId] = useState("pack_mtk_sd");
  const [soloIndex, setSoloIndex] = useState(0);
  const [soloScore, setSoloScore] = useState(0);
  const [soloCorrect, setSoloCorrect] = useState(0);
  const [soloShort, setSoloShort] = useState("");
  const [soloFeedback, setSoloFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [soloFinished, setSoloFinished] = useState(false);

  // Pack builder
  const [packTitle, setPackTitle] = useState("");
  const [packSubject, setPackSubject] = useState("Matematika");
  const [packGrade, setPackGrade] = useState("SD / SMP");
  const [packMaterial, setPackMaterial] = useState("");
  const [draftQuestions, setDraftQuestions] = useState<QuestionItem[]>([]);
  const [qType, setQType] = useState<"mcq" | "tf" | "short">("mcq");
  const [qPrompt, setQPrompt] = useState("");
  const [qOptA, setQOptA] = useState("");
  const [qOptB, setQOptB] = useState("");
  const [qOptC, setQOptC] = useState("");
  const [qOptD, setQOptD] = useState("");
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qCorrectText, setQCorrectText] = useState("");
  const [qExplanation, setQExplanation] = useState("");

  // Clock ticker
  const [nowMs, setNowMs] = useState(Date.now());

  const proActive = isProActive(user);

  const loadWorkspaceData = async () => {
    const res = await apiFetchClassesAndPacks(user?.email);
    setClasses(res.classes);
    setPacks(res.packs);
    if (res.packs.length > 0 && !res.packs.some((p) => p.id === sessPackId)) {
      setSessPackId(res.packs[0].id);
      setSoloPackId(res.packs[0].id);
    }
    if (res.classes.length > 0 && !sessClassId) {
      setSessClassId(res.classes[0].id);
    }
    if (user?.email) {
      const sList = await apiListSessions(user.email);
      setSessions(sList);
    } else {
      setSessions([]);
    }
  };

  useEffect(() => {
    if (open) {
      setView(initialView);
      if (initialJoinCode) setJoinCode(initialJoinCode);
      setMsg(null);
      void loadWorkspaceData();
    }
  }, [open, initialView, initialJoinCode, user?.email]);

  // Timer tick every second while in a live session
  useEffect(() => {
    if (!open || (view !== "teacher_room" && view !== "student_play")) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, view]);

  // Live polling for Teacher Room (every 2s)
  useEffect(() => {
    if (!open || view !== "teacher_room" || !teacherCode) return;
    let active = true;
    const poll = async () => {
      const res = await apiGetSessionState({ code: teacherCode, role: "teacher" });
      if (active && res.ok) {
        setLiveSession(res.session);
        setLivePlayers(res.players);
        setItemStats(res.itemStats ?? []);
      }
    };
    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [open, view, teacherCode]);

  // Live polling for Student Room (every 1.8s)
  useEffect(() => {
    if (!open || view !== "student_play" || !studentSession?.code || !studentPlayer?.id) return;
    let active = true;
    const poll = async () => {
      const res = await apiGetSessionState({
        code: studentSession.code,
        role: "student",
        playerId: studentPlayer.id,
      });
      if (active && res.ok) {
        setStudentSession(res.session);
        setStudentPlayers(res.players);
        const me = res.players.find((p) => p.id === studentPlayer.id);
        if (me) setStudentPlayer(me);
      }
    };
    void poll();
    const id = setInterval(poll, 1800);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [open, view, studentSession?.code, studentPlayer?.id]);

  const soloPack = useMemo(
    () => packs.find((p) => p.id === soloPackId) ?? packs[0] ?? null,
    [packs, soloPackId]
  );

  if (!open) return null;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1800);
  };

  const getTimeLeft = (s: GameSession | null): number => {
    if (!s) return 0;
    if (!s.startedAt) return s.durationSec;
    if (s.status === "finished") return 0;
    const elapsed = Math.floor((nowMs - new Date(s.startedAt).getTime()) / 1000);
    return Math.max(0, s.durationSec - elapsed);
  };

  // ==================== CLASS & SESSION HANDLERS ====================

  const handleCreateClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiCreateClass({
        ownerEmail: user.email,
        name: clsName,
        grade: clsGrade,
        subject: clsSubject,
        description: clsDesc,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setClsName("");
      setClsDesc("");
      setSessClassId(res.classroom.id);
      await loadWorkspaceData();
      setMsg({ type: "ok", text: `Kelas "${res.classroom.name}" berhasil dibuat!` });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!user) return;
    await apiDeleteClass(id, user.email);
    await loadWorkspaceData();
  };

  const handleOpenLiveSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setMsg(null);
    setBusy(true);
    try {
      const cls = classes.find((c) => c.id === sessClassId);
      const res = await apiCreateSession({
        ownerEmail: user.email,
        classId: cls?.id ?? null,
        className: cls?.name ?? "Kelas Umum",
        packId: sessPackId,
        mode: sessMode,
        durationSec: sessDurationMin * 60,
        kkm: sessKkm,
        maxPlayers: sessMaxPlayers,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setTeacherCode(res.session.code);
      setLiveSession(res.session);
      setLivePlayers([]);
      setView("teacher_room");
      await loadWorkspaceData();
    } finally {
      setBusy(false);
    }
  };

  const handleControl = async (
    action: "start" | "pause" | "finish" | "broadcast",
    message?: string
  ) => {
    if (!user || !liveSession) return;
    const res = await apiControlSession({
      action,
      code: liveSession.code,
      ownerEmail: user.email,
      message,
    });
    if (!res.ok) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    setLiveSession(res.session);
    if (action === "broadcast") {
      setBroadcastInput("");
      setMsg({ type: "ok", text: "Pesan pengumuman terkirim ke semua murid!" });
    }
  };

  const handleAddDemoStudents = async () => {
    if (!liveSession) return;
    setBusy(true);
    try {
      await apiAddDemoStudents(liveSession.code, 5);
      const st = await apiGetSessionState({ code: liveSession.code, role: "teacher" });
      if (st.ok) {
        setLiveSession(st.session);
        setLivePlayers(st.players);
      }
    } finally {
      setBusy(false);
    }
  };

  // ==================== PACK BUILDER HANDLERS ====================

  const handleAddDraftQuestion = () => {
    if (qPrompt.trim().length < 3) {
      setMsg({ type: "err", text: "Isi teks pertanyaan terlebih dahulu." });
      return;
    }
    let item: QuestionItem;
    if (qType === "tf") {
      item = {
        id: `q_${Date.now()}`,
        type: "tf",
        prompt: qPrompt.trim(),
        options: ["Benar", "Salah"],
        correctIndex: qCorrectIdx === 1 ? 1 : 0,
        explanation: qExplanation.trim(),
      };
    } else if (qType === "short") {
      if (!qCorrectText.trim()) {
        setMsg({ type: "err", text: "Isi kunci jawaban singkat terlebih dahulu." });
        return;
      }
      item = {
        id: `q_${Date.now()}`,
        type: "short",
        prompt: qPrompt.trim(),
        options: [],
        correctIndex: 0,
        correctText: qCorrectText.trim(),
        explanation: qExplanation.trim(),
      };
    } else {
      const opts = [qOptA.trim(), qOptB.trim(), qOptC.trim(), qOptD.trim()].filter(Boolean);
      if (opts.length < 2) {
        setMsg({ type: "err", text: "Isi minimal 2 pilihan jawaban." });
        return;
      }
      item = {
        id: `q_${Date.now()}`,
        type: "mcq",
        prompt: qPrompt.trim(),
        options: opts,
        correctIndex: Math.min(qCorrectIdx, opts.length - 1),
        explanation: qExplanation.trim(),
      };
    }
    setDraftQuestions((prev) => [...prev, item]);
    setQPrompt("");
    setQOptA("");
    setQOptB("");
    setQOptC("");
    setQOptD("");
    setQCorrectText("");
    setQExplanation("");
    setMsg({ type: "ok", text: `Soal #${draftQuestions.length + 1} ditambahkan ke draf paket.` });
  };

  const handleSavePack = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiSavePack({
        ownerEmail: user?.email ?? "guest@local",
        title: packTitle,
        subject: packSubject,
        grade: packGrade,
        materialText: packMaterial,
        questions: draftQuestions,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setPackTitle("");
      setPackMaterial("");
      setDraftQuestions([]);
      setSessPackId(res.pack.id);
      await loadWorkspaceData();
      setMsg({
        type: "ok",
        text: `Paket soal "${res.pack.title}" (${res.pack.questions.length} soal) berhasil disimpan!`,
      });
    } finally {
      setBusy(false);
    }
  };

  // ==================== STUDENT JOIN & PLAY HANDLERS ====================

  const handleStudentJoin = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiJoinSession({
        code: joinCode.trim(),
        name: joinName.trim(),
        avatar: joinAvatar,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setStudentPlayer(res.player);
      setStudentSession(res.session);
      setLastFeedback(null);
      setQOpenedAt(Date.now());
      setView("student_play");
    } finally {
      setBusy(false);
    }
  };

  const handleStudentSubmit = async (selectedIndex: number | null, textAnswer = "") => {
    if (!studentSession || !studentPlayer) return;
    const qIndex = studentPlayer.answers.length;
    const elapsedSec = (Date.now() - qOpenedAt) / 1000;
    const speedBonus = Math.max(0, Math.round(50 - elapsedSec * 2));
    setBusy(true);
    try {
      const res = await apiSubmitAnswer({
        code: studentSession.code,
        playerId: studentPlayer.id,
        qIndex,
        selectedIndex,
        textAnswer,
        speedBonus,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setStudentPlayer(res.player);
      setStudentShortAns("");
      setLastFeedback({
        correct: res.correct,
        earned: res.earned,
        explanation: res.explanation,
      });
      setQOpenedAt(Date.now());
    } finally {
      setBusy(false);
    }
  };

  // ==================== SOLO GAME HANDLERS ====================

  const resetSolo = (newPackId?: string) => {
    if (newPackId) setSoloPackId(newPackId);
    setSoloIndex(0);
    setSoloScore(0);
    setSoloCorrect(0);
    setSoloShort("");
    setSoloFeedback(null);
    setSoloFinished(false);
  };

  const handleSoloAnswer = (idx: number | null, text = "") => {
    if (!soloPack) return;
    const q = soloPack.questions[soloIndex];
    if (!q) return;
    let ok = false;
    if (q.type === "short") {
      ok =
        text.trim().toLowerCase() ===
        String(q.correctText ?? "").trim().toLowerCase();
    } else {
      ok = idx === q.correctIndex;
    }
    if (ok) {
      setSoloScore((s) => s + 100);
      setSoloCorrect((c) => c + 1);
    }
    setSoloFeedback({
      ok,
      text: ok
        ? `Benar! +100 poin. ${q.explanation ?? ""}`
        : `Kurang tepat. ${q.explanation ?? ""}`,
    });
    setSoloShort("");
  };

  const nextSoloQuestion = () => {
    if (!soloPack) return;
    setSoloFeedback(null);
    if (soloIndex + 1 >= soloPack.questions.length) {
      setSoloFinished(true);
    } else {
      setSoloIndex((i) => i + 1);
    }
  };

  const shareUrl = liveSession
    ? `${window.location.origin}/?join=${liveSession.code}`
    : "";

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-panel wood workspace-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="px" style={{ margin: 0, fontSize: 26 }}>
              🌾 ZuperFarm Arena &amp; Ruang Kelas
            </h2>
            <div className="muted" style={{ fontSize: 13, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 2 }}>
              <span className={`badge ${health?.mode === "postgres" ? "status-available" : "free"}`}>
                {health?.mode === "postgres"
                  ? "🟢 Postgres Live (Siap 30+ Murid Lintas Perangkat)"
                  : "🟡 Mode Lokal (Tambahkan DATABASE_URL di Vercel untuk Mabar Lintas Perangkat)"}
              </span>
              {user && (
                <span className={`badge ${proActive ? "pro" : "free"}`}>
                  {proActive ? `⭐ ${user.name} (PRO)` : `🌱 ${user.name} (GRATIS)`}
                </span>
              )}
            </div>
          </div>
          <button className="btn sm w modal-close-btn" type="button" onClick={onClose}>
            ✖ Tutup
          </button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`btn sm ${view === "classes" || view === "teacher_room" ? "g" : "w"}`}
            onClick={() => {
              setView("classes");
              setMsg(null);
            }}
          >
            🏫 Kelas &amp; Mabar (Pro)
          </button>
          <button
            type="button"
            className={`btn sm ${view === "packs" ? "g" : "w"}`}
            onClick={() => {
              setView("packs");
              setMsg(null);
            }}
          >
            ✏️ Buat Soal ({packs.length})
          </button>
          <button
            type="button"
            className={`btn sm ${view === "student_join" || view === "student_play" ? "g" : "w"}`}
            onClick={() => {
              setView(studentPlayer && studentSession ? "student_play" : "student_join");
              setMsg(null);
            }}
          >
            🔑 Gabung Kode 6 Angka
          </button>
          <button
            type="button"
            className={`btn sm ${view === "solo" ? "g" : "w"}`}
            onClick={() => {
              setView("solo");
              setMsg(null);
            }}
          >
            🎮 Main Kebun Solo
          </button>
        </div>

        {msg && (
          <div className={`alert-box ${msg.type === "ok" ? "ok" : "err"}`}>
            <span>{msg.type === "ok" ? "✅" : "⚠️"}</span>
            <span>{msg.text}</span>
          </div>
        )}

        <div className="modal-body">
          {/* ================= VIEW 1: KELAS & SESI MABAR (PRO) ================= */}
          {view === "classes" && !proActive && (
            <div className="subcard" style={{ textAlign: "center", padding: 28 }}>
              <div style={{ fontSize: 48 }}>🔒</div>
              <h3 className="px" style={{ fontSize: 28, margin: "8px 0" }}>
                Fitur Buat Kelas &amp; Mabar 30+ Murid Khusus Akun Pro
              </h3>
              <p style={{ maxWidth: 560, margin: "0 auto 18px" }}>
                {user
                  ? `Akun Anda (${user.email}) saat ini masih berstatus Gratis. Ajukan permintaan lisensi Pro (menunggu persetujuan Admin) atau masukkan kode lisensi resmi dari Admin untuk membuka Buat Kelas, Kode Ruang 6 Angka, dan Rekap Nilai Excel.`
                  : "Silakan masuk akun guru Pro terlebih dahulu (atau daftar akun lalu ajukan lisensi Pro untuk persetujuan Admin) untuk membuka Buat Kelas & Ruang Mabar 30+ murid."}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn g"
                  onClick={() => {
                    onClose();
                    onOpenPortal(user ? "lisensi" : "akun");
                  }}
                >
                  {user ? "📩 Ajukan Lisensi Pro" : "🔐 Masuk / Daftar Akun Guru"}
                </button>
                <button
                  type="button"
                  className="btn w"
                  onClick={() => setView("solo")}
                >
                  🎮 Coba Main Solo Gratis
                </button>
              </div>
            </div>
          )}

          {view === "classes" && proActive && user && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="portal-grid">
                {/* Launch Live Session for 30+ players */}
                <form className="subcard" onSubmit={handleOpenLiveSession}>
                  <h3 className="px" style={{ marginTop: 0, fontSize: 22 }}>
                    🚀 Buka Ruang Live Mabar (Kode 6 Angka)
                  </h3>
                  <div className="form-stack">
                    <label>
                      Pilih Kelas
                      <select
                        value={sessClassId}
                        onChange={(e) => setSessClassId(e.target.value)}
                      >
                        <option value="">Kelas Umum (Tanpa Kelas Khusus)</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.grade})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Pilih Paket Soal
                      <select
                        value={sessPackId}
                        onChange={(e) => setSessPackId(e.target.value)}
                      >
                        {packs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.questions.length} soal · {p.subject})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mode Permainan
                      <select
                        value={sessMode}
                        onChange={(e) =>
                          setSessMode(e.target.value as "kebun" | "arena" | "asesmen")
                        }
                      >
                        <option value="kebun">🌱 Kebun Ilmu (Tanam &amp; Panen)</option>
                        <option value="arena">⚔️ Arena Berburu Peti + Peta Live</option>
                        <option value="asesmen">📝 Mode Asesmen (Ulangan + KKM)</option>
                      </select>
                    </label>
                    <div className="admin-gen-row">
                      <label>
                        Durasi (Menit)
                        <input
                          type="number"
                          min={2}
                          max={60}
                          value={sessDurationMin}
                          onChange={(e) => setSessDurationMin(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        KKM (0–100)
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={sessKkm}
                          onChange={(e) => setSessKkm(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Kapasitas Murid
                        <select
                          value={sessMaxPlayers}
                          onChange={(e) => setSessMaxPlayers(Number(e.target.value))}
                        >
                          <option value={30}>30 Murid</option>
                          <option value={40}>40 Murid (1 Kelas)</option>
                          <option value={60}>60 Murid</option>
                          <option value={100}>100 Murid</option>
                        </select>
                      </label>
                    </div>
                    <button className="btn g" type="submit" disabled={busy}>
                      {busy ? "Membuka Ruang..." : "🚀 Buka Ruang Mabar Sekarang"}
                    </button>
                  </div>
                </form>

                {/* Create Classroom */}
                <form className="subcard" onSubmit={handleCreateClass}>
                  <h3 className="px" style={{ marginTop: 0, fontSize: 22 }}>
                    🏫 Buat Kelas Baru
                  </h3>
                  <div className="form-stack">
                    <label>
                      Nama Kelas
                      <input
                        type="text"
                        required
                        value={clsName}
                        onChange={(e) => setClsName(e.target.value)}
                        placeholder="Contoh: Kelas 6B / X IPA 2"
                      />
                    </label>
                    <div className="admin-gen-row">
                      <label>
                        Jenjang / Tingkat
                        <input
                          type="text"
                          value={clsGrade}
                          onChange={(e) => setClsGrade(e.target.value)}
                          placeholder="SD / SMP / SMA"
                        />
                      </label>
                      <label>
                        Mata Pelajaran
                        <input
                          type="text"
                          value={clsSubject}
                          onChange={(e) => setClsSubject(e.target.value)}
                          placeholder="Matematika / IPA"
                        />
                      </label>
                    </div>
                    <label>
                      Catatan Kelas (opsional)
                      <input
                        type="text"
                        value={clsDesc}
                        onChange={(e) => setClsDesc(e.target.value)}
                        placeholder="Semester Ganjil 2026"
                      />
                    </label>
                    <button className="btn" type="submit" disabled={busy}>
                      ➕ Simpan Kelas
                    </button>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <h4 className="px" style={{ margin: "0 0 8px", fontSize: 18 }}>
                      Daftar Kelas Saya ({classes.length})
                    </h4>
                    {classes.length === 0 ? (
                      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                        Belum ada kelas. Buat kelas pertama Anda di atas.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {classes.map((c) => (
                          <div className="avail-item" key={c.id}>
                            <div>
                              <b>{c.name}</b>{" "}
                              <span className="muted" style={{ fontSize: 12 }}>
                                · {c.grade} · {c.subject}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn sm danger"
                              onClick={() => handleDeleteClass(c.id)}
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </form>
              </div>

              {/* Recent Sessions */}
              <div className="subcard">
                <h3 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                  📋 Riwayat Sesi Mabar Saya ({sessions.length})
                </h3>
                {sessions.length === 0 ? (
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                    Belum ada sesi live yang dibuat. Klik "Buka Ruang Mabar Sekarang" di atas untuk membuat ruang kode 6 angka.
                  </p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Kode</th>
                          <th>Kelas &amp; Paket</th>
                          <th>Mode</th>
                          <th>Status</th>
                          <th>Pemain</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.code}>
                            <td className="mono" style={{ fontWeight: 900, fontSize: 16 }}>
                              {s.code}
                            </td>
                            <td>
                              <b>{s.className}</b>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {s.packTitle}
                              </div>
                            </td>
                            <td>{s.mode.toUpperCase()}</td>
                            <td>
                              <span
                                className={`badge ${
                                  s.status === "playing"
                                    ? "status-available"
                                    : s.status === "finished"
                                      ? "role"
                                      : "pro"
                                }`}
                              >
                                {s.status.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              {s.playerCount ?? 0} / {s.maxPlayers}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn sm b"
                                onClick={() => {
                                  setTeacherCode(s.code);
                                  setLiveSession(s);
                                  setView("teacher_room");
                                }}
                              >
                                👁️ Pantau / Nilai
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= VIEW 2: TEACHER LIVE MONITOR ROOM ================= */}
          {view === "teacher_room" && liveSession && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="subcard teacher-top">
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge pro">{liveSession.mode.toUpperCase()}</span>
                    <span
                      className={`badge ${
                        liveSession.status === "playing"
                          ? "status-available"
                          : liveSession.status === "finished"
                            ? "role"
                            : "free"
                      }`}
                    >
                      STATUS: {liveSession.status.toUpperCase()}
                    </span>
                    <span className="badge role">
                      👥 {livePlayers.length} / {liveSession.maxPlayers} Murid
                    </span>
                    <span className="badge pro">
                      ⏱️ {formatClock(getTimeLeft(liveSession))}
                    </span>
                  </div>
                  <h3 className="px" style={{ margin: "6px 0 2px", fontSize: 24 }}>
                    {liveSession.className} — {liveSession.packTitle}
                  </h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                    <div className="big-code-pill">
                      KODE: <b>{liveSession.code}</b>
                    </div>
                    <button
                      type="button"
                      className="btn sm w"
                      onClick={() => copyText(liveSession.code, "code")}
                    >
                      {copied === "code" ? "✓ Kode Tersalin" : "📋 Salin Kode"}
                    </button>
                    <button
                      type="button"
                      className="btn sm b"
                      onClick={() => copyText(shareUrl, "link")}
                    >
                      {copied === "link" ? "✓ Link Tersalin" : "🔗 Salin Link Join Murid"}
                    </button>
                    <button
                      type="button"
                      className="btn sm w"
                      onClick={() => {
                        setJoinCode(liveSession.code);
                        setView("student_join");
                      }}
                    >
                      🧪 Uji Gabung sebagai Murid
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {liveSession.status === "lobby" && (
                    <>
                      <button
                        type="button"
                        className="btn g"
                        onClick={() => handleControl("start")}
                      >
                        ▶ Mulai Game
                      </button>
                      <button
                        type="button"
                        className="btn sm w"
                        disabled={busy}
                        onClick={handleAddDemoStudents}
                      >
                        🤖 +5 Murid Simulasi
                      </button>
                    </>
                  )}
                  {(liveSession.status === "playing" || liveSession.status === "paused") && (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleControl("pause")}
                      >
                        {liveSession.status === "paused" ? "▶ Lanjutkan" : "⏸ Jeda"}
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => handleControl("finish")}
                      >
                        🏁 Akhiri Sesi
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn sm b"
                    onClick={() => exportSessionCsv(liveSession, livePlayers)}
                  >
                    📊 Unduh Rekap Excel (CSV)
                  </button>
                </div>
              </div>

              {/* Teacher Broadcast */}
              {liveSession.status !== "finished" && (
                <form
                  className="subcard inline-activate"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleControl("broadcast", broadcastInput);
                  }}
                >
                  <input
                    type="text"
                    value={broadcastInput}
                    onChange={(e) => setBroadcastInput(e.target.value)}
                    placeholder="📢 Kirim pesan langsung ke layar semua murid (mis. 'Sisa waktu 3 menit, semangat!')"
                  />
                  <button className="btn sm" type="submit">
                    📢 Kirim Pesan
                  </button>
                </form>
              )}

              {/* Live Visual Arena Map */}
              <div className="subcard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 className="px" style={{ margin: 0, fontSize: 19 }}>
                    🗺️ Peta Arena / Kebun Langsung ({livePlayers.length} Pemain Aktif)
                  </h4>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Diperbarui otomatis setiap 2 detik
                  </span>
                </div>
                <div className="arena-map">
                  {livePlayers.length === 0 ? (
                    <div className="arena-empty">
                      Menunggu murid masuk menggunakan kode <b>{liveSession.code}</b>...
                    </div>
                  ) : (
                    livePlayers.map((p, idx) => (
                      <div
                        key={p.id}
                        className="arena-avatar"
                        style={{ left: `${p.posX}%`, top: `${p.posY}%` }}
                        title={`${p.name} · Skor ${p.score} · ${p.correctCount}/${liveSession.totalQuestions}`}
                      >
                        <div className="av-ic">
                          {idx === 0 && p.score > 0 ? "👑" : ""}
                          {p.avatar}
                        </div>
                        <div className="av-name">
                          {p.name.split(" ")[0]} ({p.score})
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Leaderboard + Item Analysis */}
              <div className="portal-grid">
                <div className="subcard">
                  <h4 className="px" style={{ marginTop: 0, fontSize: 19 }}>
                    🏆 Papan Peringkat &amp; Ketuntasan KKM ({liveSession.kkm})
                  </h4>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Murid</th>
                          <th>Skor</th>
                          <th>Progres</th>
                          <th>Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {livePlayers.map((p, idx) => {
                          const totalQ = Math.max(1, liveSession.totalQuestions);
                          const grade = Math.round((p.correctCount / totalQ) * 100);
                          const pass = grade >= liveSession.kkm;
                          return (
                            <tr key={p.id}>
                              <td><b>{idx + 1}</b></td>
                              <td>
                                {p.avatar} <b>{p.name}</b>
                              </td>
                              <td><b>{p.score}</b></td>
                              <td>
                                {p.answers.length}/{totalQ} (🌾{p.harvests})
                              </td>
                              <td>
                                <span className={`badge ${pass ? "status-available" : "status-revoked"}`}>
                                  {grade} {pass ? "Tuntas" : "Belum"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="subcard">
                  <h4 className="px" style={{ marginTop: 0, fontSize: 19 }}>
                    📊 Analisis Butir Soal
                  </h4>
                  {itemStats.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>
                      Statistik per soal akan muncul begitu murid mulai menjawab.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {itemStats.map((st) => (
                        <div className="stat-row" key={st.qIndex}>
                          <div style={{ fontSize: 13, fontWeight: 800 }}>
                            #{st.qIndex + 1} {st.prompt.slice(0, 68)}
                            {st.prompt.length > 68 ? "..." : ""}
                          </div>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{ width: `${st.accuracy}%` }}
                            />
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            Benar: {st.correct}/{st.attempts} ({st.accuracy}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW 3: PACK BUILDER ================= */}
          {view === "packs" && (
            <div className="portal-grid">
              <form className="subcard" onSubmit={handleSavePack}>
                <h3 className="px" style={{ marginTop: 0, fontSize: 22 }}>
                  ✏️ Buat Paket Soal Baru
                </h3>
                <div className="form-stack">
                  <label>
                    Judul Paket Soal
                    <input
                      type="text"
                      required
                      value={packTitle}
                      onChange={(e) => setPackTitle(e.target.value)}
                      placeholder="Contoh: Ulangan Pecahan Kelas 5"
                    />
                  </label>
                  <div className="admin-gen-row">
                    <label>
                      Mapel
                      <input
                        type="text"
                        value={packSubject}
                        onChange={(e) => setPackSubject(e.target.value)}
                      />
                    </label>
                    <label>
                      Jenjang
                      <input
                        type="text"
                        value={packGrade}
                        onChange={(e) => setPackGrade(e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    Ringkasan Materi (Perpustakaan Desa)
                    <input
                      type="text"
                      value={packMaterial}
                      onChange={(e) => setPackMaterial(e.target.value)}
                      placeholder="Ringkasan materi yang bisa dibaca murid sebelum menjawab..."
                    />
                  </label>

                  <div className="pro-tools" style={{ marginTop: 6 }}>
                    <h4 className="px" style={{ margin: "0 0 8px", fontSize: 18 }}>
                      ➕ Tambah Butir Soal ({draftQuestions.length} soal di draf)
                    </h4>
                    <div className="form-stack">
                      <label>
                        Tipe Soal
                        <select
                          value={qType}
                          onChange={(e) =>
                            setQType(e.target.value as "mcq" | "tf" | "short")
                          }
                        >
                          <option value="mcq">Pilihan Ganda (A–D)</option>
                          <option value="tf">Benar / Salah</option>
                          <option value="short">Isian Singkat</option>
                        </select>
                      </label>
                      <label>
                        Pertanyaan
                        <input
                          type="text"
                          value={qPrompt}
                          onChange={(e) => setQPrompt(e.target.value)}
                          placeholder="Tulis pertanyaan di sini..."
                        />
                      </label>

                      {qType === "mcq" && (
                        <>
                          <div className="admin-gen-row">
                            <input
                              placeholder="Opsi A"
                              value={qOptA}
                              onChange={(e) => setQOptA(e.target.value)}
                            />
                            <input
                              placeholder="Opsi B"
                              value={qOptB}
                              onChange={(e) => setQOptB(e.target.value)}
                            />
                          </div>
                          <div className="admin-gen-row">
                            <input
                              placeholder="Opsi C"
                              value={qOptC}
                              onChange={(e) => setQOptC(e.target.value)}
                            />
                            <input
                              placeholder="Opsi D"
                              value={qOptD}
                              onChange={(e) => setQOptD(e.target.value)}
                            />
                          </div>
                          <label>
                            Kunci Jawaban Benar
                            <select
                              value={qCorrectIdx}
                              onChange={(e) => setQCorrectIdx(Number(e.target.value))}
                            >
                              <option value={0}>Opsi A</option>
                              <option value={1}>Opsi B</option>
                              <option value={2}>Opsi C</option>
                              <option value={3}>Opsi D</option>
                            </select>
                          </label>
                        </>
                      )}

                      {qType === "tf" && (
                        <label>
                          Kunci Jawaban
                          <select
                            value={qCorrectIdx}
                            onChange={(e) => setQCorrectIdx(Number(e.target.value))}
                          >
                            <option value={0}>Benar</option>
                            <option value={1}>Salah</option>
                          </select>
                        </label>
                      )}

                      {qType === "short" && (
                        <label>
                          Kunci Jawaban Singkat
                          <input
                            type="text"
                            value={qCorrectText}
                            onChange={(e) => setQCorrectText(e.target.value)}
                            placeholder="Contoh: 100 atau H2O"
                          />
                        </label>
                      )}

                      <label>
                        Pembahasan Singkat (opsional)
                        <input
                          type="text"
                          value={qExplanation}
                          onChange={(e) => setQExplanation(e.target.value)}
                          placeholder="Penjelasan jawaban benar..."
                        />
                      </label>
                      <button
                        type="button"
                        className="btn sm b"
                        onClick={handleAddDraftQuestion}
                      >
                        ➕ Tambahkan Soal ke Draf
                      </button>
                    </div>
                  </div>

                  {draftQuestions.length > 0 && (
                    <div style={{ fontSize: 13 }}>
                      <b>Soal dalam draf:</b>
                      <ol style={{ margin: "4px 0", paddingLeft: 18 }}>
                        {draftQuestions.map((dq, i) => (
                          <li key={dq.id}>
                            {dq.prompt}{" "}
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() =>
                                setDraftQuestions((prev) => prev.filter((_, idx) => idx !== i))
                              }
                            >
                              (hapus)
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <button className="btn g" type="submit" disabled={busy || draftQuestions.length === 0}>
                    💾 Simpan Paket Soal ({draftQuestions.length} soal)
                  </button>
                </div>
              </form>

              <div className="subcard">
                <h3 className="px" style={{ marginTop: 0, fontSize: 22 }}>
                  📚 Daftar Paket Soal Siap Pakai ({packs.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {packs.map((p) => (
                    <div className="demo-box" key={p.id} style={{ marginTop: 0 }}>
                      <div>
                        <b>{p.title}</b>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.subject} · {p.grade} · {p.questions.length} soal
                          {p.isPublic ? " · Bawaan" : " · Buatan Anda"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="btn sm g"
                          onClick={() => {
                            resetSolo(p.id);
                            setView("solo");
                          }}
                        >
                          🎮 Main
                        </button>
                        {!p.isPublic && user && p.ownerEmail === user.email && (
                          <button
                            type="button"
                            className="btn sm danger"
                            onClick={async () => {
                              await apiDeletePack(p.id, user.email);
                              await loadWorkspaceData();
                            }}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW 4: STUDENT JOIN ================= */}
          {view === "student_join" && (
            <div className="subcard" style={{ maxWidth: 520, margin: "0 auto" }}>
              <h3 className="px" style={{ marginTop: 0, fontSize: 26, textAlign: "center" }}>
                🔑 Masuk Ruang Kelas (Murid)
              </h3>
              <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>
                Tanpa perlu akun! Cukup masukkan kode 6 angka dari guru, nama kamu, dan pilih karakter.
              </p>
              <form className="form-stack" onSubmit={handleStudentJoin}>
                <label>
                  Kode Ruang (6 Angka)
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="mono"
                    style={{ fontSize: 24, letterSpacing: 6, textAlign: "center" }}
                  />
                </label>
                <label>
                  Nama Murid
                  <input
                    type="text"
                    required
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Contoh: Raka Pratama"
                  />
                </label>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
                    Pilih Karakter:
                  </div>
                  <div className="avatar-picker">
                    {AVATARS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        className={`av-btn ${joinAvatar === av ? "active" : ""}`}
                        onClick={() => setJoinAvatar(av)}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn g" type="submit" disabled={busy}>
                  {busy ? "Menghubungkan..." : "🎮 Gabung ke Lobby Kelas"}
                </button>
              </form>
            </div>
          )}

          {/* ================= VIEW 5: STUDENT LIVE PLAY ================= */}
          {view === "student_play" && studentSession && studentPlayer && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="subcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="badge pro">Kode {studentSession.code}</span>
                    <span className="badge role">
                      {studentPlayer.avatar} {studentPlayer.name}
                    </span>
                    <span className="badge status-available">
                      ⭐ Skor: {studentPlayer.score}
                    </span>
                    <span className="badge free">🌾 Panen: {studentPlayer.harvests}</span>
                  </div>
                  <div style={{ fontWeight: 900, marginTop: 4 }}>
                    {studentSession.className} · {studentSession.packTitle}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge pro">
                    ⏱️ {formatClock(getTimeLeft(studentSession))}
                  </span>
                  <button
                    type="button"
                    className="btn sm w"
                    onClick={() => {
                      setStudentPlayer(null);
                      setStudentSession(null);
                      setView("student_join");
                    }}
                  >
                    Keluar Ruang
                  </button>
                </div>
              </div>

              {studentSession.broadcastMsg && (
                <div className="alert-box ok" style={{ marginBottom: 0 }}>
                  <span>📢</span>
                  <span>
                    <b>Pesan Guru:</b> {studentSession.broadcastMsg}
                  </span>
                </div>
              )}

              {studentSession.status === "lobby" && (
                <div className="subcard" style={{ textAlign: "center", padding: 26 }}>
                  <div style={{ fontSize: 48 }}>🏟️</div>
                  <h3 className="px" style={{ fontSize: 28, margin: "6px 0" }}>
                    Kamu sudah di Lobby! Menunggu Guru Menekan "Mulai"...
                  </h3>
                  <p className="muted">
                    Pemain bergabung: <b>{studentPlayers.length} / {studentSession.maxPlayers}</b>
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 }}>
                    {studentPlayers.map((p) => (
                      <span className="pill" key={p.id}>
                        {p.avatar} {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {studentSession.status === "paused" && (
                <div className="subcard" style={{ textAlign: "center", padding: 26 }}>
                  <div style={{ fontSize: 44 }}>⏸️</div>
                  <h3 className="px" style={{ fontSize: 26 }}>
                    Permainan Dijeda Sementara oleh Guru
                  </h3>
                  <p className="muted">Tunggu instruksi guru untuk melanjutkan.</p>
                </div>
              )}

              {studentSession.status === "playing" && !studentPlayer.finished && (
                <div className="portal-grid game-play-grid">
                  {/* Left (second on mobile): Visual Farm or Arena */}
                  <div className="subcard game-visual-card">
                    <h4 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                      {studentSession.mode === "kebun"
                        ? "🌱 Kebun Ilmumu"
                        : studentSession.mode === "arena"
                          ? "⚔️ Arena Kelas Live"
                          : "📝 Lembar Asesmen"}
                    </h4>

                    {studentSession.mode === "kebun" && (
                      <div className="farm-grid">
                        {CROP_ICONS.map((crop, idx) => {
                          const grown = studentPlayer.correctCount > idx;
                          return (
                            <div className={`farm-plot ${grown ? "grown" : ""}`} key={crop}>
                              <span style={{ fontSize: 34 }}>{grown ? crop : "🟫"}</span>
                              <span style={{ fontSize: 12, fontWeight: 800 }}>
                                {grown ? "Panen!" : `Petak ${idx + 1}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {studentSession.mode === "arena" && (
                      <div className="arena-map" style={{ height: 220 }}>
                        {studentPlayers.map((p) => (
                          <div
                            key={p.id}
                            className={`arena-avatar ${p.id === studentPlayer.id ? "me" : ""}`}
                            style={{ left: `${p.posX}%`, top: `${p.posY}%` }}
                          >
                            <div className="av-ic">{p.avatar}</div>
                            <div className="av-name">{p.name.split(" ")[0]}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {studentSession.mode === "asesmen" && (
                      <p className="muted" style={{ fontSize: 14 }}>
                        Mode Asesmen aktif: setiap soal hanya dijawab sekali dan kunci jawaban disembunyikan sampai sesi selesai. KKM: <b>{studentSession.kkm}</b>.
                      </p>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <b style={{ fontSize: 13 }}>🏆 5 Besar Sementara:</b>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                        {studentPlayers.slice(0, 5).map((p, idx) => (
                          <div className="lic-row" key={p.id} style={{ padding: "4px 0" }}>
                            <span>
                              <b>#{idx + 1}</b> {p.avatar} {p.name}
                            </span>
                            <b>{p.score}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right (first on mobile): Current Question */}
                  {(() => {
                    const qIdx = studentPlayer.answers.length;
                    const q = studentSession.questions[qIdx];
                    if (!q) return null;
                    return (
                      <div className="subcard game-question-card">
                        <div className="badge pro" style={{ marginBottom: 8 }}>
                          Soal {qIdx + 1} dari {studentSession.totalQuestions}
                        </div>
                        <h3 className="px" style={{ margin: "4px 0 14px", fontSize: 22 }}>
                          {q.prompt}
                        </h3>

                        {q.type === "short" ? (
                          <form
                            className="form-stack"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void handleStudentSubmit(null, studentShortAns);
                            }}
                          >
                            <input
                              type="text"
                              required
                              value={studentShortAns}
                              onChange={(e) => setStudentShortAns(e.target.value)}
                              placeholder="Ketik jawabanmu di sini..."
                            />
                            <button className="btn g" type="submit" disabled={busy}>
                              ✅ Kirim Jawaban
                            </button>
                          </form>
                        ) : (
                          <div className="option-list">
                            {q.options.map((opt, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="btn w option-btn"
                                disabled={busy}
                                onClick={() => handleStudentSubmit(idx)}
                              >
                                <span className="opt-letter">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span>{opt}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {lastFeedback && (
                          <div
                            className={`alert-box ${
                              lastFeedback.correct === false ? "err" : "ok"
                            }`}
                            style={{ marginTop: 12, marginBottom: 0 }}
                          >
                            <span>
                              {lastFeedback.correct === null
                                ? "📩"
                                : lastFeedback.correct
                                  ? "🌟"
                                  : "💡"}
                            </span>
                            <span>
                              {lastFeedback.correct === null
                                ? "Jawaban sebelumnya tersimpan!"
                                : lastFeedback.correct
                                  ? `Jawaban sebelumnya BENAR! (+${lastFeedback.earned} poin)`
                                  : "Jawaban sebelumnya belum tepat."}
                              {lastFeedback.explanation ? ` — ${lastFeedback.explanation}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {(studentSession.status === "finished" || studentPlayer.finished) && (
                <div className="subcard" style={{ textAlign: "center", padding: 24 }}>
                  <div style={{ fontSize: 48 }}>🏆</div>
                  <h3 className="px" style={{ fontSize: 28, margin: "6px 0" }}>
                    {studentSession.status === "finished"
                      ? "Sesi Selesai! Podium Kelas"
                      : "Hebat! Semua Soal Selesai Dikerjakan!"}
                  </h3>
                  <p>
                    Skor kamu: <b>{studentPlayer.score}</b> · Benar:{" "}
                    <b>
                      {studentPlayer.correctCount}/{studentSession.totalQuestions}
                    </b>{" "}
                    · Nilai:{" "}
                    <b>
                      {Math.round(
                        (studentPlayer.correctCount /
                          Math.max(1, studentSession.totalQuestions)) *
                          100
                      )}
                    </b>
                  </p>
                  <div className="podium-row">
                    {studentPlayers.slice(0, 3).map((p, idx) => (
                      <div className="subcard podium-card" key={p.id}>
                        <div style={{ fontSize: 30 }}>
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                        </div>
                        <div style={{ fontSize: 28 }}>{p.avatar}</div>
                        <b>{p.name}</b>
                        <div className="px" style={{ fontSize: 20, color: "#2d7a16" }}>
                          {p.score} pts
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= VIEW 6: SOLO FARM PRACTICE ================= */}
          {view === "solo" && soloPack && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="subcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div className="solo-pack-bar">
                  <label className="solo-select-label">
                    <span>Paket Latihan:</span>
                    <select
                      className="solo-select"
                      value={soloPack.id}
                      onChange={(e) => resetSolo(e.target.value)}
                    >
                      {packs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.questions.length} soal)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="badge status-available">⭐ Skor: {soloScore}</span>
                  <span className="badge free">🌾 Panen: {Math.floor(soloCorrect / 2)}</span>
                </div>
              </div>

              {soloPack.materialText && (
                <div className="subcard" style={{ background: "#eef9e4" }}>
                  <b>📖 Perpustakaan Desa:</b> {soloPack.materialText}
                </div>
              )}

              {soloFinished ? (
                <div className="subcard" style={{ textAlign: "center", padding: 28 }}>
                  <div style={{ fontSize: 52 }}>🎉</div>
                  <h3 className="px" style={{ fontSize: 28, margin: "8px 0" }}>
                    Panen Kebun Selesai!
                  </h3>
                  <p>
                    Skor: <b>{soloScore}</b> · Benar: <b>{soloCorrect}/{soloPack.questions.length}</b> · Nilai:{" "}
                    <b>{Math.round((soloCorrect / Math.max(1, soloPack.questions.length)) * 100)}</b>
                  </p>
                  <button type="button" className="btn g" onClick={() => resetSolo()}>
                    🔁 Main Lagi
                  </button>
                </div>
              ) : (
                <div className="portal-grid game-play-grid">
                  <div className="subcard game-visual-card">
                    <h4 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                      🌱 Kebun Ilmu Mandiri
                    </h4>
                    <div className="farm-grid">
                      {CROP_ICONS.map((crop, idx) => {
                        const grown = soloCorrect > idx;
                        return (
                          <div className={`farm-plot ${grown ? "grown" : ""}`} key={crop}>
                            <span style={{ fontSize: 34 }}>{grown ? crop : "🟫"}</span>
                            <span style={{ fontSize: 12, fontWeight: 800 }}>
                              {grown ? "Tumbuh!" : `Petak ${idx + 1}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const q = soloPack.questions[soloIndex];
                    if (!q) return null;
                    return (
                      <div className="subcard game-question-card">
                        <div className="badge pro" style={{ marginBottom: 8 }}>
                          Soal {soloIndex + 1} dari {soloPack.questions.length}
                        </div>
                        <h3 className="px" style={{ margin: "4px 0 14px", fontSize: 22 }}>
                          {q.prompt}
                        </h3>

                        {!soloFeedback ? (
                          q.type === "short" ? (
                            <form
                              className="form-stack"
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSoloAnswer(null, soloShort);
                              }}
                            >
                              <input
                                type="text"
                                required
                                value={soloShort}
                                onChange={(e) => setSoloShort(e.target.value)}
                                placeholder="Ketik jawaban..."
                              />
                              <button className="btn g" type="submit">
                                ✅ Cek Jawaban
                              </button>
                            </form>
                          ) : (
                            <div className="option-list">
                              {q.options.map((opt, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="btn w option-btn"
                                  onClick={() => handleSoloAnswer(idx)}
                                >
                                  <span className="opt-letter">
                                    {String.fromCharCode(65 + idx)}
                                  </span>
                                  <span>{opt}</span>
                                </button>
                              ))}
                            </div>
                          )
                        ) : (
                          <div>
                            <div className={`alert-box ${soloFeedback.ok ? "ok" : "err"}`}>
                              <span>{soloFeedback.ok ? "🌟" : "💡"}</span>
                              <span>{soloFeedback.text}</span>
                            </div>
                            <button type="button" className="btn g" onClick={nextSoloQuestion}>
                              {soloIndex + 1 >= soloPack.questions.length
                                ? "🏆 Lihat Hasil Panen"
                                : "Soal Berikutnya ▸"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
