import crypto from "node:crypto";
import { Pool } from "pg";

export interface QuestionItem {
  id: string;
  type: "mcq" | "tf" | "short";
  prompt: string;
  options: string[];
  correctIndex: number;
  correctText?: string;
  explanation?: string;
}

export const DEFAULT_SAMPLE_PACKS: Array<{
  id: string;
  title: string;
  subject: string;
  grade: string;
  materialText: string;
  questions: QuestionItem[];
}> = [
  {
    id: "pack_mtk_sd",
    title: "Petualangan Hitung Cepat SD",
    subject: "Matematika",
    grade: "SD Kelas 4–6",
    materialText:
      "Ingat urutan operasi hitung: kerjakan perkalian/pembagian terlebih dahulu sebelum penjumlahan/pengurangan, dan dahulukan yang di dalam kurung.",
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
    title: "Ekspedisi IPA & Ekosistem SMP",
    subject: "IPA",
    grade: "SMP Kelas 7–9",
    materialText:
      "Fotosintesis berlangsung di kloroplas dengan bantuan cahaya matahari, air (H2O), dan karbon dioksida (CO2) menghasilkan glukosa dan oksigen (O2).",
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
    title: "Wawasan Nusantara & Literasi",
    subject: "Bahasa & IPS",
    grade: "SD / SMP / SMA",
    materialText:
      "Indonesia adalah negara kepulauan dengan semboyan Bhinneka Tunggal Ika yang berarti berbeda-beda tetapi tetap satu jua.",
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

let cachedPool: Pool | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export function getDatabaseUrl(): string | null {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    "";
  return url.trim() || null;
}

export function getPool(): Pool | null {
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;
  if (!cachedPool) {
    const isLocal =
      connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    cachedPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 8000,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
  }
  return cachedPool;
}

export function sha256Password(password: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export function randomCode(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export async function ensureSchema(): Promise<Pool> {
  const pool = getPool();
  if (!pool) {
    throw new Error("DATABASE_URL belum dikonfigurasi di Vercel.");
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS zf_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          institution TEXT NOT NULL DEFAULT 'Sekolah / Umum',
          role TEXT NOT NULL DEFAULT 'guru',
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'free',
          license_key TEXT,
          license_activated_at TIMESTAMPTZ,
          license_expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS zf_licenses (
          key TEXT PRIMARY KEY,
          plan_name TEXT NOT NULL,
          duration_days INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'available',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          activated_by_email TEXT,
          activated_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS zf_classes (
          id TEXT PRIMARY KEY,
          owner_email TEXT NOT NULL,
          name TEXT NOT NULL,
          grade TEXT NOT NULL DEFAULT 'Umum',
          subject TEXT NOT NULL DEFAULT 'Semua Mapel',
          description TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS zf_packs (
          id TEXT PRIMARY KEY,
          owner_email TEXT NOT NULL,
          title TEXT NOT NULL,
          subject TEXT NOT NULL DEFAULT 'Umum',
          grade TEXT NOT NULL DEFAULT 'Umum',
          material_text TEXT NOT NULL DEFAULT '',
          questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          is_public BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS zf_sessions (
          code TEXT PRIMARY KEY,
          owner_email TEXT NOT NULL,
          class_id TEXT,
          class_name TEXT NOT NULL DEFAULT 'Kelas Umum',
          pack_id TEXT NOT NULL,
          pack_title TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'kebun',
          status TEXT NOT NULL DEFAULT 'lobby',
          duration_sec INTEGER NOT NULL DEFAULT 600,
          kkm INTEGER NOT NULL DEFAULT 75,
          max_players INTEGER NOT NULL DEFAULT 40,
          broadcast_msg TEXT NOT NULL DEFAULT '',
          questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          started_at TIMESTAMPTZ,
          ended_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS zf_session_players (
          id TEXT PRIMARY KEY,
          session_code TEXT NOT NULL REFERENCES zf_sessions(code) ON DELETE CASCADE,
          name TEXT NOT NULL,
          avatar TEXT NOT NULL DEFAULT '🧑‍🌾',
          score INTEGER NOT NULL DEFAULT 0,
          correct_count INTEGER NOT NULL DEFAULT 0,
          wrong_count INTEGER NOT NULL DEFAULT 0,
          harvests INTEGER NOT NULL DEFAULT 0,
          current_q INTEGER NOT NULL DEFAULT 0,
          finished BOOLEAN NOT NULL DEFAULT FALSE,
          pos_x INTEGER NOT NULL DEFAULT 50,
          pos_y INTEGER NOT NULL DEFAULT 50,
          answers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_zf_players_session ON zf_session_players(session_code);
        CREATE INDEX IF NOT EXISTS idx_zf_sessions_owner ON zf_sessions(owner_email);
        CREATE INDEX IF NOT EXISTS idx_zf_classes_owner ON zf_classes(owner_email);
        CREATE INDEX IF NOT EXISTS idx_zf_packs_owner ON zf_packs(owner_email);
      `);

      // Seed default accounts if empty
      const { rows: userCountRows } = await pool.query<{ n: string }>(
        "SELECT COUNT(*)::text AS n FROM zf_users"
      );
      if (Number(userCountRows[0]?.n ?? 0) === 0) {
        const now = new Date();
        const adminExp = new Date(now.getTime() + 3650 * 86400 * 1000);
        const adminSalt = "seed_admin_salt_2026";
        const guruSalt = "seed_guru_salt_2026";
        const adminHash = sha256Password("admin123", adminSalt);
        const guruHash = sha256Password("guru123", guruSalt);

        await pool.query(
          `INSERT INTO zf_users (id, name, email, institution, role, password_hash, salt, plan, license_key, license_activated_at, license_expires_at)
           VALUES
             ('usr_admin_default', 'Admin ZuperFarm', 'admin@zuperfarm.local', 'ZuperFarm Indonesia', 'admin', $1, $2, 'pro', 'ZFARM-PRO-ADMIN-0001', $3, $4),
             ('usr_guru_demo', 'Budi Santoso, S.Pd.', 'guru@zuperfarm.local', 'SDN Nusantara 01', 'guru', $5, $6, 'free', NULL, NULL, NULL)
           ON CONFLICT (email) DO NOTHING`,
          [adminHash, adminSalt, now.toISOString(), adminExp.toISOString(), guruHash, guruSalt]
        );

        await pool.query(
          `INSERT INTO zf_licenses (key, plan_name, duration_days, status, created_by, note, activated_by_email, activated_at, expires_at)
           VALUES
             ('ZFARM-PRO-ADMIN-0001', 'Lisensi Admin (10 Tahun)', 3650, 'active', 'admin@zuperfarm.local', 'Akun Administrator Utama', 'admin@zuperfarm.local', $1, $2),
             ('ZFARM-PRO-2026-8801', 'Pro Tahunan (1 Tahun)', 365, 'available', 'admin@zuperfarm.local', 'Kode lisensi siap pakai #1', NULL, NULL, NULL),
             ('ZFARM-PRO-2026-8802', 'Pro Tahunan (1 Tahun)', 365, 'available', 'admin@zuperfarm.local', 'Kode lisensi siap pakai #2', NULL, NULL, NULL),
             ('ZFARM-TRL-2026-0030', 'Trial Pro (30 Hari)', 30, 'available', 'admin@zuperfarm.local', 'Kode uji coba 30 hari', NULL, NULL, NULL),
             ('ZFARM-SCH-2026-9901', 'Pro Sekolah (2 Tahun)', 730, 'available', 'admin@zuperfarm.local', 'Kode lisensi sekolah 2 tahun', NULL, NULL, NULL)
           ON CONFLICT (key) DO NOTHING`,
          [now.toISOString(), adminExp.toISOString()]
        );

        await pool.query(
          `INSERT INTO zf_classes (id, owner_email, name, grade, subject, description)
           VALUES ('cls_demo_1', 'admin@zuperfarm.local', 'Kelas 5A — Kebun Ilmu', 'SD Kelas 5', 'Matematika & IPA', 'Kelas contoh siap pakai untuk mabar hingga 40 murid.')
           ON CONFLICT (id) DO NOTHING`
        );
      }

      // Seed default public question packs
      for (const pack of DEFAULT_SAMPLE_PACKS) {
        await pool.query(
          `INSERT INTO zf_packs (id, owner_email, title, subject, grade, material_text, questions_json, is_public)
           VALUES ($1, 'admin@zuperfarm.local', $2, $3, $4, $5, $6::jsonb, TRUE)
           ON CONFLICT (id) DO NOTHING`,
          [
            pack.id,
            pack.title,
            pack.subject,
            pack.grade,
            pack.materialText,
            JSON.stringify(pack.questions),
          ]
        );
      }
    })().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }

  await schemaReadyPromise;
  return pool;
}
