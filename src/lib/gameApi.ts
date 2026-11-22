import {
  activateLicenseForUser as localActivateLicense,
  adminAssignProToUser as localAdminAssignPro,
  adminDowngradeUser as localAdminDowngrade,
  ensureSeeded,
  generateLicenses as localGenerateLicenses,
  getCurrentUser as localGetCurrentUser,
  isProActive,
  listLicenses as localListLicenses,
  listUsers as localListUsers,
  loginUser as localLoginUser,
  logoutUser as localLogoutUser,
  registerUser as localRegisterUser,
  revokeLicense as localRevokeLicense,
  updateUserProfile as localUpdateProfile,
  type LicenseRecord,
  type UserAccount,
  type UserRole,
} from "./authLicenseStore";

export interface QuestionItem {
  id: string;
  type: "mcq" | "tf" | "short";
  prompt: string;
  options: string[];
  correctIndex?: number;
  correctText?: string;
  explanation?: string;
}

export interface ClassroomItem {
  id: string;
  ownerEmail: string;
  name: string;
  grade: string;
  subject: string;
  description: string;
  createdAt: string;
}

export interface QuestionPack {
  id: string;
  ownerEmail: string;
  title: string;
  subject: string;
  grade: string;
  materialText: string;
  questions: QuestionItem[];
  isPublic: boolean;
  createdAt: string;
}

export interface PlayerAnswerRecord {
  qIndex: number;
  correct: boolean;
  answer: string;
  points: number;
  answeredAt: string;
}

export interface SessionPlayer {
  id: string;
  sessionCode: string;
  name: string;
  avatar: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  harvests: number;
  currentQ: number;
  finished: boolean;
  posX: number;
  posY: number;
  answers: PlayerAnswerRecord[];
  joinedAt: string;
  lastSeenAt: string;
}

export interface GameSession {
  code: string;
  ownerEmail: string;
  classId: string | null;
  className: string;
  packId: string;
  packTitle: string;
  mode: "kebun" | "arena" | "asesmen";
  status: "lobby" | "playing" | "paused" | "finished";
  durationSec: number;
  kkm: number;
  maxPlayers: number;
  broadcastMsg: string;
  questions: QuestionItem[];
  totalQuestions: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  playerCount?: number;
}

export interface ItemStat {
  qIndex: number;
  prompt: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface BackendHealth {
  dbConfigured: boolean;
  dbConnected: boolean;
  mode: "postgres" | "local";
  message: string;
}

export const AVATARS = ["🧑‍🌾", "👩‍🌾", "🦊", "🐱", "🐼", "🐸", "🧙‍♂️", "🤖", "🐥", "🐰"];

const SESSION_EMAIL_KEY = "zuperfarm_session_v1";
const LOCAL_CLASSES_KEY = "zuperfarm_classes_v1";
const LOCAL_PACKS_KEY = "zuperfarm_packs_v1";
const LOCAL_SESSIONS_KEY = "zuperfarm_sessions_v1";
const LOCAL_PLAYERS_KEY = "zuperfarm_players_v1";

export const SAMPLE_PACKS: QuestionPack[] = [
  {
    id: "pack_mtk_sd",
    ownerEmail: "admin@zuperfarm.local",
    title: "Petualangan Hitung Cepat SD",
    subject: "Matematika",
    grade: "SD Kelas 4–6",
    materialText:
      "Ingat urutan operasi hitung: kerjakan perkalian/pembagian terlebih dahulu sebelum penjumlahan/pengurangan, dan dahulukan yang di dalam kurung.",
    isPublic: true,
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: "q1",
        type: "mcq",
        prompt: "Hasil dari 12 × 5 + 8 adalah...",
        options: ["68", "156", "60", "72"],
        correctIndex: 0,
        explanation: "12 × 5 = 60, lalu 60 + 8 = 68.",
      },
      {
        id: "q2",
        type: "mcq",
        prompt: "Sebuah kebun berbentuk persegi memiliki sisi 9 meter. Berapa kelilingnya?",
        options: ["18 m", "27 m", "36 m", "81 m"],
        correctIndex: 2,
        explanation: "Keliling persegi = 4 × sisi = 4 × 9 = 36 meter.",
      },
      {
        id: "q3",
        type: "tf",
        prompt: "Benar atau Salah: Pecahan 2/4 senilai dengan 1/2.",
        options: ["Benar", "Salah"],
        correctIndex: 0,
        explanation: "2/4 dibagi 2 pembilang dan penyebutnya menghasilkan 1/2.",
      },
      {
        id: "q4",
        type: "mcq",
        prompt: "Pak Tani memanen 48 buah jeruk dan memasukkannya sama banyak ke 6 keranjang. Isi tiap keranjang adalah...",
        options: ["6 jeruk", "7 jeruk", "8 jeruk", "9 jeruk"],
        correctIndex: 2,
        explanation: "48 ÷ 6 = 8 buah jeruk per keranjang.",
      },
      {
        id: "q5",
        type: "short",
        prompt: "Berapa hasil dari 150 - 75 + 25? (tulis angka saja)",
        options: [],
        correctIndex: 0,
        correctText: "100",
        explanation: "150 - 75 = 75, lalu 75 + 25 = 100.",
      },
      {
        id: "q6",
        type: "mcq",
        prompt: "Sudut siku-siku besarnya tepat...",
        options: ["45°", "60°", "90°", "180°"],
        correctIndex: 2,
        explanation: "Sudut siku-siku selalu berukuran 90 derajat.",
      },
    ],
  },
  {
    id: "pack_ipa_smp",
    ownerEmail: "admin@zuperfarm.local",
    title: "Ekspedisi IPA & Ekosistem SMP",
    subject: "IPA",
    grade: "SMP Kelas 7–9",
    materialText:
      "Fotosintesis berlangsung di kloroplas dengan bantuan cahaya matahari, air (H2O), dan karbon dioksida (CO2) menghasilkan glukosa dan oksigen (O2).",
    isPublic: true,
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: "i1",
        type: "mcq",
        prompt: "Gas yang dihasilkan tumbuhan saat proses fotosintesis adalah...",
        options: ["Karbon dioksida", "Oksigen", "Nitrogen", "Metana"],
        correctIndex: 1,
        explanation: "Fotosintesis menghasilkan glukosa dan gas oksigen (O2).",
      },
      {
        id: "i2",
        type: "mcq",
        prompt: "Satuan Internasional (SI) untuk gaya adalah...",
        options: ["Joule", "Watt", "Newton", "Pascal"],
        correctIndex: 2,
        explanation: "Satuan gaya dalam SI adalah Newton (N).",
      },
      {
        id: "i3",
        type: "tf",
        prompt: "Benar atau Salah: Perubahan wujud dari gas langsung menjadi padat disebut menyublim.",
        options: ["Benar", "Salah"],
        correctIndex: 1,
        explanation: "Gas menjadi padat disebut mengkristal/deposisi; padat ke gas adalah menyublim.",
      },
      {
        id: "i4",
        type: "mcq",
        prompt: "Organel sel yang berfungsi sebagai tempat respirasi seluler penghasil energi adalah...",
        options: ["Mitokondria", "Ribosom", "Vakuola", "Dinding sel"],
        correctIndex: 0,
        explanation: "Mitokondria dikenal sebagai 'powerhouse of the cell'.",
      },
      {
        id: "i5",
        type: "short",
        prompt: "Rumus kimia air adalah... (contoh: O2)",
        options: [],
        correctIndex: 0,
        correctText: "H2O",
        explanation: "Molekul air terdiri dari 2 atom Hidrogen dan 1 atom Oksigen (H2O).",
      },
      {
        id: "i6",
        type: "mcq",
        prompt: "Planet yang dikenal sebagai Planet Merah di tata surya kita adalah...",
        options: ["Venus", "Mars", "Jupiter", "Saturnus"],
        correctIndex: 1,
        explanation: "Permukaan Mars kaya oksida besi sehingga tampak kemerahan.",
      },
    ],
  },
  {
    id: "pack_umum_indo",
    ownerEmail: "admin@zuperfarm.local",
    title: "Wawasan Nusantara & Literasi",
    subject: "Bahasa & IPS",
    grade: "SD / SMP / SMA",
    materialText:
      "Indonesia adalah negara kepulauan dengan semboyan Bhinneka Tunggal Ika yang berarti berbeda-beda tetapi tetap satu jua.",
    isPublic: true,
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: "u1",
        type: "mcq",
        prompt: "Sinonim kata 'kolaborasi' dalam bahasa Indonesia adalah...",
        options: ["Persaingan", "Kerja sama", "Perdebatan", "Perpisahan"],
        correctIndex: 1,
        explanation: "Kolaborasi bermakna kerja sama untuk mencapai tujuan bersama.",
      },
      {
        id: "u2",
        type: "mcq",
        prompt: "Proklamasi Kemerdekaan Indonesia dibacakan pada tanggal...",
        options: ["17 Agustus 1945", "10 November 1945", "28 Oktober 1928", "1 Juni 1945"],
        correctIndex: 0,
        explanation: "Proklamasi dibacakan oleh Soekarno-Hatta pada 17 Agustus 1945.",
      },
      {
        id: "u3",
        type: "tf",
        prompt: "Benar atau Salah: Gunung Bromo terletak di Provinsi Jawa Timur.",
        options: ["Benar", "Salah"],
        correctIndex: 0,
        explanation: "Gunung Bromo berada di kawasan Taman Nasional Bromo Tengger Semeru, Jawa Timur.",
      },
      {
        id: "u4",
        type: "mcq",
        prompt: "Kalimat yang berisi gagasan utama pada sebuah paragraf disebut...",
        options: ["Kalimat penjelas", "Kalimat utama", "Kalimat tanya", "Kalimat majemuk"],
        correctIndex: 1,
        explanation: "Kalimat utama memuat ide pokok paragraf.",
      },
      {
        id: "u5",
        type: "short",
        prompt: "Ikon dasar negara Indonesia yang memiliki 5 sila disebut...",
        options: [],
        correctIndex: 0,
        correctText: "Pancasila",
        explanation: "Pancasila adalah dasar negara Republik Indonesia.",
      },
    ],
  },
];

let cachedHealth: BackendHealth | null = null;

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, val: T): void {
  localStorage.setItem(key, JSON.stringify(val));
}

function ensureLocalClassroomSeed(): void {
  const cls = readLocal<ClassroomItem[]>(LOCAL_CLASSES_KEY, []);
  if (cls.length === 0) {
    writeLocal<ClassroomItem[]>(LOCAL_CLASSES_KEY, [
      {
        id: "cls_demo_1",
        ownerEmail: "admin@zuperfarm.local",
        name: "Kelas 5A — Kebun Ilmu",
        grade: "SD Kelas 5",
        subject: "Matematika & IPA",
        description: "Kelas contoh siap pakai untuk sesi mabar hingga 40 murid.",
        createdAt: new Date().toISOString(),
      },
    ]);
  }
  const packs = readLocal<QuestionPack[]>(LOCAL_PACKS_KEY, []);
  if (packs.length === 0) {
    writeLocal<QuestionPack[]>(LOCAL_PACKS_KEY, SAMPLE_PACKS);
  }
}

async function apiPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  return (await res.json()) as T;
}

export async function checkBackendHealth(force = false): Promise<BackendHealth> {
  if (cachedHealth && !force) return cachedHealth;
  await ensureSeeded();
  ensureLocalClassroomSeed();
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) throw new Error("API unavailable");
    const data = (await res.json()) as Partial<BackendHealth>;
    cachedHealth = {
      dbConfigured: Boolean(data.dbConfigured),
      dbConnected: Boolean(data.dbConnected),
      mode: data.dbConnected ? "postgres" : "local",
      message:
        data.message ||
        (data.dbConnected
          ? "PostgreSQL aktif — siap mabar 30+ pemain lintas perangkat!"
          : "Mode Lokal aktif (tambahkan DATABASE_URL Postgres di Vercel untuk mabar lintas perangkat)."),
    };
  } catch {
    cachedHealth = {
      dbConfigured: false,
      dbConnected: false,
      mode: "local",
      message:
        "Mode Lokal aktif (tambahkan DATABASE_URL Postgres di Vercel untuk mabar lintas perangkat).",
    };
  }
  return cachedHealth;
}

function isPostgres(): boolean {
  return cachedHealth?.mode === "postgres";
}

// ==================== AUTH & LICENSE API ====================

export async function apiGetCurrentUser(): Promise<UserAccount | null> {
  await checkBackendHealth();
  const email = localStorage.getItem(SESSION_EMAIL_KEY);
  if (!email) return null;
  if (isPostgres()) {
    const res = await apiPost<{ ok: boolean; user: UserAccount | null }>("/api/auth", {
      action: "me",
      email,
    });
    return res.user ?? null;
  }
  return localGetCurrentUser();
}

export async function apiLogin(email: string, password: string) {
  await checkBackendHealth();
  if (isPostgres()) {
    const res = await apiPost<{ ok: true; user: UserAccount } | { ok: false; error: string }>(
      "/api/auth",
      { action: "login", email, password }
    );
    if (res.ok) {
      localStorage.setItem(SESSION_EMAIL_KEY, res.user.email);
    }
    return res;
  }
  return localLoginUser({ email, password });
}

export async function apiRegister(params: {
  name: string;
  email: string;
  institution: string;
  password: string;
  role?: UserRole;
  autoLogin?: boolean;
}) {
  await checkBackendHealth();
  if (isPostgres()) {
    const res = await apiPost<{ ok: true; user: UserAccount } | { ok: false; error: string }>(
      "/api/auth",
      { action: "register", ...params }
    );
    if (res.ok && params.autoLogin !== false) {
      localStorage.setItem(SESSION_EMAIL_KEY, res.user.email);
    }
    return res;
  }
  return localRegisterUser(params);
}

export function apiLogout(): void {
  localLogoutUser();
}

export async function apiUpdateProfile(params: {
  email: string;
  name: string;
  institution: string;
}) {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost<{ ok: true; user: UserAccount } | { ok: false; error: string }>("/api/auth", {
      action: "profile",
      ...params,
    });
  }
  return localUpdateProfile(params);
}

export async function apiActivateLicense(params: { email: string; licenseKey: string }) {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost<
      { ok: true; user: UserAccount; license: LicenseRecord } | { ok: false; error: string }
    >("/api/auth", { action: "activate_license", ...params });
  }
  return localActivateLicense(params);
}

export async function apiListAvailableLicenses(): Promise<LicenseRecord[]> {
  await checkBackendHealth();
  if (isPostgres()) {
    const res = await apiPost<{ ok: boolean; licenses?: LicenseRecord[] }>("/api/auth", {
      action: "list_available_licenses",
    });
    return res.licenses ?? [];
  }
  return localListLicenses().filter((l) => l.status === "available");
}

export async function apiClaimOrGenerateLicenses(params: {
  packageId: string;
  count: number;
  note: string;
  createdBy: string;
}): Promise<LicenseRecord[]> {
  await checkBackendHealth();
  if (isPostgres()) {
    const res = await apiPost<{ ok: boolean; licenses?: LicenseRecord[] }>("/api/auth", {
      action: "admin_generate_licenses",
      ...params,
    });
    return res.licenses ?? [];
  }
  return localGenerateLicenses(params);
}

export async function apiAdminData(): Promise<{
  users: UserAccount[];
  licenses: LicenseRecord[];
}> {
  await checkBackendHealth();
  if (isPostgres()) {
    const res = await apiPost<{
      ok: boolean;
      users?: UserAccount[];
      licenses?: LicenseRecord[];
    }>("/api/auth", { action: "admin_data" });
    return { users: res.users ?? [], licenses: res.licenses ?? [] };
  }
  return { users: localListUsers(), licenses: localListLicenses() };
}

export async function apiAdminRevokeLicense(key: string) {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost<{ ok: true } | { ok: false; error: string }>("/api/auth", {
      action: "admin_revoke_license",
      key,
    });
  }
  return localRevokeLicense(key);
}

export async function apiAdminAssignPro(params: {
  targetEmail: string;
  adminEmail: string;
  packageId?: string;
}) {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost<{ ok: true; license: LicenseRecord } | { ok: false; error: string }>(
      "/api/auth",
      { action: "admin_assign_pro", ...params }
    );
  }
  return localAdminAssignPro(params);
}

export async function apiAdminDowngradeUser(targetEmail: string) {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost<{ ok: true } | { ok: false; error: string }>("/api/auth", {
      action: "admin_downgrade_user",
      targetEmail,
    });
  }
  return localAdminDowngrade(targetEmail);
}

// ==================== CLASSES & QUESTION PACKS ====================

export async function apiFetchClassesAndPacks(ownerEmail?: string): Promise<{
  classes: ClassroomItem[];
  packs: QuestionPack[];
}> {
  await checkBackendHealth();
  if (isPostgres()) {
    const q = ownerEmail ? `?ownerEmail=${encodeURIComponent(ownerEmail)}` : "";
    const res = await apiGet<{
      ok: boolean;
      classes?: ClassroomItem[];
      packs?: QuestionPack[];
    }>(`/api/packs${q}`);
    return { classes: res.classes ?? [], packs: res.packs ?? SAMPLE_PACKS };
  }
  ensureLocalClassroomSeed();
  const allClasses = readLocal<ClassroomItem[]>(LOCAL_CLASSES_KEY, []);
  const allPacks = readLocal<QuestionPack[]>(LOCAL_PACKS_KEY, SAMPLE_PACKS);
  return {
    classes: ownerEmail ? allClasses.filter((c) => c.ownerEmail === ownerEmail) : allClasses,
    packs: ownerEmail
      ? allPacks.filter((p) => p.isPublic || p.ownerEmail === ownerEmail)
      : allPacks,
  };
}

export async function apiCreateClass(params: {
  ownerEmail: string;
  name: string;
  grade: string;
  subject: string;
  description: string;
}): Promise<{ ok: true; classroom: ClassroomItem } | { ok: false; error: string }> {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost("/api/packs", { action: "create_class", ...params });
  }
  if (params.name.trim().length < 2) {
    return { ok: false, error: "Nama kelas minimal 2 karakter." };
  }
  const classroom: ClassroomItem = {
    id: `cls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    ownerEmail: params.ownerEmail.toLowerCase(),
    name: params.name.trim(),
    grade: params.grade.trim() || "Umum",
    subject: params.subject.trim() || "Semua Mapel",
    description: params.description.trim(),
    createdAt: new Date().toISOString(),
  };
  const existing = readLocal<ClassroomItem[]>(LOCAL_CLASSES_KEY, []);
  writeLocal(LOCAL_CLASSES_KEY, [classroom, ...existing]);
  return { ok: true, classroom };
}

export async function apiDeleteClass(id: string, ownerEmail: string): Promise<void> {
  await checkBackendHealth();
  if (isPostgres()) {
    await apiPost("/api/packs", { action: "delete_class", id, ownerEmail });
    return;
  }
  const existing = readLocal<ClassroomItem[]>(LOCAL_CLASSES_KEY, []);
  writeLocal(
    LOCAL_CLASSES_KEY,
    existing.filter((c) => !(c.id === id && c.ownerEmail === ownerEmail))
  );
}

export async function apiSavePack(params: {
  id?: string;
  ownerEmail: string;
  title: string;
  subject: string;
  grade: string;
  materialText: string;
  questions: QuestionItem[];
}): Promise<{ ok: true; pack: QuestionPack } | { ok: false; error: string }> {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost("/api/packs", { action: "save_pack", ...params });
  }
  if (params.title.trim().length < 2) {
    return { ok: false, error: "Judul paket soal minimal 2 karakter." };
  }
  if (params.questions.length === 0) {
    return { ok: false, error: "Tambahkan minimal 1 soal ke dalam paket." };
  }
  const existing = readLocal<QuestionPack[]>(LOCAL_PACKS_KEY, SAMPLE_PACKS);
  const id = params.id || `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const pack: QuestionPack = {
    id,
    ownerEmail: params.ownerEmail.toLowerCase(),
    title: params.title.trim(),
    subject: params.subject.trim() || "Umum",
    grade: params.grade.trim() || "Umum",
    materialText: params.materialText.trim(),
    questions: params.questions,
    isPublic: false,
    createdAt: new Date().toISOString(),
  };
  const filtered = existing.filter((p) => p.id !== id);
  writeLocal(LOCAL_PACKS_KEY, [pack, ...filtered]);
  return { ok: true, pack };
}

export async function apiDeletePack(id: string, ownerEmail: string): Promise<void> {
  await checkBackendHealth();
  if (isPostgres()) {
    await apiPost("/api/packs", { action: "delete_pack", id, ownerEmail });
    return;
  }
  const existing = readLocal<QuestionPack[]>(LOCAL_PACKS_KEY, SAMPLE_PACKS);
  writeLocal(
    LOCAL_PACKS_KEY,
    existing.filter((p) => !(p.id === id && p.ownerEmail === ownerEmail && !p.isPublic))
  );
}

// ==================== MULTIPLAYER SESSIONS (30+ PLAYERS) ====================

function localGrade(
  q: QuestionItem,
  selectedIndex: number | null,
  textAnswer: string
): { correct: boolean; normalizedAnswer: string } {
  if (q.type === "short") {
    const u = textAnswer.trim().toLowerCase().replace(/\s+/g, " ");
    const e = String(q.correctText ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    return { correct: e.length > 0 && u === e, normalizedAnswer: textAnswer.trim() };
  }
  const idx = typeof selectedIndex === "number" ? selectedIndex : -1;
  return {
    correct: idx === q.correctIndex,
    normalizedAnswer: q.options?.[idx] ?? String(idx),
  };
}

export async function apiListSessions(ownerEmail: string): Promise<GameSession[]> {
  await checkBackendHealth();
  if (isPostgres()) {
    const res = await apiGet<{ ok: boolean; sessions?: GameSession[] }>(
      `/api/sessions?ownerEmail=${encodeURIComponent(ownerEmail)}`
    );
    return res.sessions ?? [];
  }
  const sessions = readLocal<GameSession[]>(LOCAL_SESSIONS_KEY, []);
  const players = readLocal<SessionPlayer[]>(LOCAL_PLAYERS_KEY, []);
  return sessions
    .filter((s) => s.ownerEmail === ownerEmail.toLowerCase())
    .map((s) => ({
      ...s,
      playerCount: players.filter((p) => p.sessionCode === s.code).length,
    }));
}

export async function apiCreateSession(params: {
  ownerEmail: string;
  classId: string | null;
  className: string;
  packId: string;
  mode: "kebun" | "arena" | "asesmen";
  durationSec: number;
  kkm: number;
  maxPlayers: number;
}): Promise<{ ok: true; session: GameSession } | { ok: false; error: string }> {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost("/api/sessions", { action: "create", ...params });
  }
  const curUser = localGetCurrentUser();
  if (!curUser || !isProActive(curUser)) {
    return {
      ok: false,
      error: "Fitur Ruang Mabar & Buat Kelas memerlukan akun Pro aktif.",
    };
  }
  const packs = readLocal<QuestionPack[]>(LOCAL_PACKS_KEY, SAMPLE_PACKS);
  const pack = packs.find((p) => p.id === params.packId);
  if (!pack) return { ok: false, error: "Paket soal tidak ditemukan." };

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const session: GameSession = {
    code,
    ownerEmail: params.ownerEmail.toLowerCase(),
    classId: params.classId,
    className: params.className || "Kelas Umum",
    packId: pack.id,
    packTitle: pack.title,
    mode: params.mode,
    status: "lobby",
    durationSec: params.durationSec,
    kkm: params.kkm,
    maxPlayers: params.maxPlayers,
    broadcastMsg: "",
    questions: pack.questions,
    totalQuestions: pack.questions.length,
    startedAt: null,
    endedAt: null,
    createdAt: new Date().toISOString(),
  };
  const existing = readLocal<GameSession[]>(LOCAL_SESSIONS_KEY, []);
  writeLocal(LOCAL_SESSIONS_KEY, [session, ...existing]);
  return { ok: true, session };
}

export async function apiGetSessionState(params: {
  code: string;
  role: "teacher" | "student";
  playerId?: string;
}): Promise<
  | { ok: true; session: GameSession; players: SessionPlayer[]; itemStats?: ItemStat[] }
  | { ok: false; error: string }
> {
  await checkBackendHealth();
  if (isPostgres()) {
    const qs = new URLSearchParams({
      code: params.code,
      role: params.role,
      ...(params.playerId ? { playerId: params.playerId } : {}),
    });
    return apiGet(`/api/sessions?${qs.toString()}`);
  }
  const sessions = readLocal<GameSession[]>(LOCAL_SESSIONS_KEY, []);
  const idx = sessions.findIndex((s) => s.code === params.code);
  if (idx === -1) {
    return { ok: false, error: `Ruang dengan kode ${params.code} tidak ditemukan.` };
  }
  const session = sessions[idx];
  if (session.status === "playing" && session.startedAt) {
    const endMs = new Date(session.startedAt).getTime() + session.durationSec * 1000;
    if (Date.now() > endMs) {
      session.status = "finished";
      session.endedAt = new Date().toISOString();
      sessions[idx] = session;
      writeLocal(LOCAL_SESSIONS_KEY, sessions);
    }
  }
  const allPlayers = readLocal<SessionPlayer[]>(LOCAL_PLAYERS_KEY, []);
  const players = allPlayers
    .filter((p) => p.sessionCode === params.code)
    .sort((a, b) => b.score - a.score || b.correctCount - a.correctCount);

  const itemStats =
    params.role === "teacher"
      ? session.questions.map((q, qIdx) => {
          let attempts = 0;
          let correct = 0;
          for (const p of players) {
            const ans = p.answers.find((a) => a.qIndex === qIdx);
            if (ans) {
              attempts++;
              if (ans.correct) correct++;
            }
          }
          return {
            qIndex: qIdx,
            prompt: q.prompt,
            attempts,
            correct,
            accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
          };
        })
      : undefined;

  return { ok: true, session, players, itemStats };
}

export async function apiJoinSession(params: {
  code: string;
  name: string;
  avatar: string;
}): Promise<{ ok: true; player: SessionPlayer; session: GameSession } | { ok: false; error: string }> {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost("/api/sessions", { action: "join", ...params });
  }
  const sessions = readLocal<GameSession[]>(LOCAL_SESSIONS_KEY, []);
  const session = sessions.find((s) => s.code === params.code.trim());
  if (!session) {
    return { ok: false, error: `Ruang dengan kode ${params.code} tidak ditemukan.` };
  }
  if (session.status === "finished") {
    return { ok: false, error: "Sesi permainan ini sudah selesai." };
  }
  const allPlayers = readLocal<SessionPlayer[]>(LOCAL_PLAYERS_KEY, []);
  const inRoom = allPlayers.filter((p) => p.sessionCode === session.code);
  if (inRoom.length >= session.maxPlayers) {
    return { ok: false, error: `Ruang sudah penuh (${session.maxPlayers} pemain).` };
  }
  const player: SessionPlayer = {
    id: `plr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    sessionCode: session.code,
    name: params.name.trim(),
    avatar: params.avatar || "🧑‍🌾",
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    harvests: 0,
    currentQ: 0,
    finished: false,
    posX: 12 + Math.floor(Math.random() * 76),
    posY: 16 + Math.floor(Math.random() * 68),
    answers: [],
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
  writeLocal(LOCAL_PLAYERS_KEY, [...allPlayers, player]);
  return { ok: true, player, session };
}

export async function apiControlSession(params: {
  action: "start" | "pause" | "finish" | "broadcast";
  code: string;
  ownerEmail: string;
  message?: string;
}): Promise<{ ok: true; session: GameSession } | { ok: false; error: string }> {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost("/api/sessions", params);
  }
  const sessions = readLocal<GameSession[]>(LOCAL_SESSIONS_KEY, []);
  const idx = sessions.findIndex(
    (s) => s.code === params.code && s.ownerEmail === params.ownerEmail.toLowerCase()
  );
  if (idx === -1) return { ok: false, error: "Sesi tidak ditemukan." };
  const s = { ...sessions[idx] };
  if (params.action === "start") {
    s.status = "playing";
    s.startedAt = s.startedAt ?? new Date().toISOString();
  } else if (params.action === "pause") {
    s.status = s.status === "paused" ? "playing" : "paused";
  } else if (params.action === "finish") {
    s.status = "finished";
    s.endedAt = new Date().toISOString();
  } else if (params.action === "broadcast") {
    s.broadcastMsg = (params.message ?? "").trim().slice(0, 200);
  }
  sessions[idx] = s;
  writeLocal(LOCAL_SESSIONS_KEY, sessions);
  return { ok: true, session: s };
}

export async function apiSubmitAnswer(params: {
  code: string;
  playerId: string;
  qIndex: number;
  selectedIndex: number | null;
  textAnswer: string;
  speedBonus?: number;
  posX?: number;
  posY?: number;
}): Promise<
  | {
      ok: true;
      correct: boolean | null;
      earned: number;
      explanation: string | null;
      player: SessionPlayer;
    }
  | { ok: false; error: string }
> {
  await checkBackendHealth();
  if (isPostgres()) {
    return apiPost("/api/sessions", { action: "answer", ...params });
  }
  const sessions = readLocal<GameSession[]>(LOCAL_SESSIONS_KEY, []);
  const session = sessions.find((s) => s.code === params.code);
  const players = readLocal<SessionPlayer[]>(LOCAL_PLAYERS_KEY, []);
  const pIdx = players.findIndex((p) => p.id === params.playerId && p.sessionCode === params.code);
  if (!session || pIdx === -1) {
    return { ok: false, error: "Sesi atau pemain tidak ditemukan." };
  }
  if (session.status !== "playing") {
    return { ok: false, error: "Permainan sedang tidak aktif." };
  }
  const q = session.questions[params.qIndex];
  if (!q) return { ok: false, error: "Nomor soal tidak valid." };
  const player = { ...players[pIdx] };
  if (player.answers.some((a) => a.qIndex === params.qIndex)) {
    return { ok: false, error: "Soal ini sudah dijawab." };
  }

  const { correct, normalizedAnswer } = localGrade(q, params.selectedIndex, params.textAnswer);
  const nextCorrect = player.correctCount + (correct ? 1 : 0);
  const nextWrong = player.wrongCount + (correct ? 0 : 1);
  const nextHarvests = Math.floor(nextCorrect / 2);
  const harvestBonus = nextHarvests > player.harvests ? 50 : 0;
  const speedBonus = Math.min(50, Math.max(0, params.speedBonus ?? 0));
  const earned = correct ? (session.mode === "asesmen" ? 100 : 100 + speedBonus + harvestBonus) : 0;

  player.correctCount = nextCorrect;
  player.wrongCount = nextWrong;
  player.harvests = nextHarvests;
  player.score += earned;
  player.answers = [
    ...player.answers,
    {
      qIndex: params.qIndex,
      correct,
      answer: normalizedAnswer,
      points: earned,
      answeredAt: new Date().toISOString(),
    },
  ];
  player.currentQ = Math.min(session.questions.length, player.answers.length);
  player.finished = player.answers.length >= session.questions.length;
  player.posX = params.posX ?? 12 + Math.floor(Math.random() * 76);
  player.posY = params.posY ?? 16 + Math.floor(Math.random() * 68);
  player.lastSeenAt = new Date().toISOString();

  players[pIdx] = player;
  writeLocal(LOCAL_PLAYERS_KEY, players);

  return {
    ok: true,
    correct: session.mode === "asesmen" ? null : correct,
    earned,
    explanation: session.mode === "asesmen" ? null : (q.explanation ?? null),
    player,
  };
}

export async function apiAddDemoStudents(code: string, count = 5): Promise<void> {
  const sampleNames = [
    "Alya Putri",
    "Bagas Pratama",
    "Citra Lestari",
    "Dimas Saputra",
    "Eka Wulandari",
    "Fajar Nugroho",
    "Gita Permata",
    "Hendra Wijaya",
    "Intan Sari",
    "Joko Susilo",
  ];
  for (let i = 0; i < count; i++) {
    const name = `${sampleNames[i % sampleNames.length]} #${Math.floor(10 + Math.random() * 89)}`;
    const avatar = AVATARS[i % AVATARS.length];
    await apiJoinSession({ code, name, avatar });
  }
}

export function exportSessionCsv(session: GameSession, players: SessionPlayer[]): void {
  const totalQ = Math.max(1, session.totalQuestions || session.questions.length);
  const header = [
    "Peringkat",
    "Nama Murid",
    "Skor",
    "Benar",
    "Salah",
    "Panen",
    "Nilai (0-100)",
    `Status KKM (${session.kkm})`,
    "Progres",
  ];
  const rows = players.map((p, idx) => {
    const grade = Math.round((p.correctCount / totalQ) * 100);
    const tuntas = grade >= session.kkm ? "TUNTAS" : "BELUM TUNTAS";
    return [
      String(idx + 1),
      `"${p.name.replace(/"/g, '""')}"`,
      String(p.score),
      String(p.correctCount),
      String(p.wrongCount),
      String(p.harvests),
      String(grade),
      tuntas,
      `${p.answers.length}/${totalQ}`,
    ].join(",");
  });
  const csv = "\uFEFF" + [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rekap-nilai-${session.className.replace(/[^a-z0-9]/gi, "_")}-${session.code}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
