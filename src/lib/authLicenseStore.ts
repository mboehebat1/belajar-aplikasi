export type UserRole = "admin" | "guru";
export type PlanType = "free" | "pro";
export type LicenseStatus = "available" | "active" | "revoked";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  institution: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  plan: PlanType;
  licenseKey: string | null;
  licenseActivatedAt: string | null;
  licenseExpiresAt: string | null;
  createdAt: string;
}

export interface LicenseRecord {
  key: string;
  planName: string;
  durationDays: number;
  status: LicenseStatus;
  createdAt: string;
  createdBy: string;
  note: string;
  activatedByEmail: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
}

export interface LicensePackageOption {
  id: string;
  name: string;
  prefix: string;
  durationDays: number;
  priceLabel: string;
  description: string;
}

export const LICENSE_PACKAGES: LicensePackageOption[] = [
  {
    id: "trial",
    name: "Trial Pro (30 Hari)",
    prefix: "TRL",
    durationDays: 30,
    priceLabel: "Gratis Uji Coba",
    description: "Cocok untuk mencoba seluruh fitur Pro selama 1 bulan.",
  },
  {
    id: "semester",
    name: "Pro Semester (6 Bulan)",
    prefix: "SEM",
    durationDays: 180,
    priceLabel: "Rp 75.000 / 6 bln",
    description: "Akses penuh sesi live mabar, asesmen, dan analisis nilai 1 semester.",
  },
  {
    id: "yearly",
    name: "Pro Tahunan (1 Tahun)",
    prefix: "PRO",
    durationDays: 365,
    priceLabel: "Rp 129.000 / tahun",
    description: "Paket paling populer. Semua fitur Pro terbuka penuh selama 1 tahun.",
  },
  {
    id: "school",
    name: "Pro Sekolah (2 Tahun)",
    prefix: "SCH",
    durationDays: 730,
    priceLabel: "Rp 229.000 / 2 thn",
    description: "Hemat untuk pemakaian jangka panjang di sekolah, kampus, atau lembaga.",
  },
];

const USERS_KEY = "zuperfarm_users_v1";
const LICENSES_KEY = "zuperfarm_licenses_v1";
const SESSION_KEY = "zuperfarm_session_v1";

function fallbackHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const text = `${salt}:${password}`;
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    try {
      const data = new TextEncoder().encode(text);
      const buf = await window.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return fallbackHash(text);
    }
  }
  return fallbackHash(text);
}

function randomChunk(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const arr = new Uint32Array(length);
    window.crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      out += chars[arr[i] % chars.length];
    }
    return out;
  }
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomChunk(5).toLowerCase()}`;
}

function addDays(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function normalizeLicenseKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function getLicenseDaysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function isProActive(user: UserAccount | null): boolean {
  if (!user || user.plan !== "pro") return false;
  if (!user.licenseExpiresAt) return true;
  return new Date(user.licenseExpiresAt).getTime() > Date.now();
}

export function formatDateID(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function ensureSeeded(): Promise<void> {
  const existingUsers = readJson<UserAccount[]>(USERS_KEY, []);
  const existingLicenses = readJson<LicenseRecord[]>(LICENSES_KEY, []);

  if (existingUsers.length > 0 && existingLicenses.length > 0) {
    return;
  }

  const now = new Date().toISOString();
  const adminSalt = "seed_admin_salt_2026";
  const guruSalt = "seed_guru_salt_2026";

  const [adminHash, guruHash] = await Promise.all([
    hashPassword("admin123", adminSalt),
    hashPassword("guru123", guruSalt),
  ]);

  const seedUsers: UserAccount[] = [
    {
      id: "usr_admin_default",
      name: "Admin ZuperFarm",
      email: "admin@zuperfarm.local",
      institution: "ZuperFarm Indonesia",
      role: "admin",
      passwordHash: adminHash,
      salt: adminSalt,
      plan: "pro",
      licenseKey: "ZFARM-PRO-ADMIN-0001",
      licenseActivatedAt: now,
      licenseExpiresAt: addDays(now, 3650),
      createdAt: now,
    },
    {
      id: "usr_guru_demo",
      name: "Budi Santoso, S.Pd.",
      email: "guru@zuperfarm.local",
      institution: "SDN Nusantara 01",
      role: "guru",
      passwordHash: guruHash,
      salt: guruSalt,
      plan: "free",
      licenseKey: null,
      licenseActivatedAt: null,
      licenseExpiresAt: null,
      createdAt: now,
    },
  ];

  const seedLicenses: LicenseRecord[] = [
    {
      key: "ZFARM-PRO-ADMIN-0001",
      planName: "Lisensi Admin (10 Tahun)",
      durationDays: 3650,
      status: "active",
      createdAt: now,
      createdBy: "admin@zuperfarm.local",
      note: "Akun Administrator Utama",
      activatedByEmail: "admin@zuperfarm.local",
      activatedAt: now,
      expiresAt: addDays(now, 3650),
    },
    {
      key: "ZFARM-PRO-2026-8801",
      planName: "Pro Tahunan (1 Tahun)",
      durationDays: 365,
      status: "available",
      createdAt: now,
      createdBy: "admin@zuperfarm.local",
      note: "Kode lisensi siap pakai #1",
      activatedByEmail: null,
      activatedAt: null,
      expiresAt: null,
    },
    {
      key: "ZFARM-PRO-2026-8802",
      planName: "Pro Tahunan (1 Tahun)",
      durationDays: 365,
      status: "available",
      createdAt: now,
      createdBy: "admin@zuperfarm.local",
      note: "Kode lisensi siap pakai #2",
      activatedByEmail: null,
      activatedAt: null,
      expiresAt: null,
    },
    {
      key: "ZFARM-TRL-2026-0030",
      planName: "Trial Pro (30 Hari)",
      durationDays: 30,
      status: "available",
      createdAt: now,
      createdBy: "admin@zuperfarm.local",
      note: "Kode uji coba 30 hari",
      activatedByEmail: null,
      activatedAt: null,
      expiresAt: null,
    },
    {
      key: "ZFARM-SCH-2026-9901",
      planName: "Pro Sekolah (2 Tahun)",
      durationDays: 730,
      status: "available",
      createdAt: now,
      createdBy: "admin@zuperfarm.local",
      note: "Kode lisensi sekolah 2 tahun",
      activatedByEmail: null,
      activatedAt: null,
      expiresAt: null,
    },
  ];

  if (existingUsers.length === 0) {
    writeJson(USERS_KEY, seedUsers);
  }
  if (existingLicenses.length === 0) {
    writeJson(LICENSES_KEY, seedLicenses);
  }
}

export async function resetAllData(): Promise<void> {
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(LICENSES_KEY);
  localStorage.removeItem(SESSION_KEY);
  await ensureSeeded();
}

export function listUsers(): UserAccount[] {
  return readJson<UserAccount[]>(USERS_KEY, []);
}

export function listLicenses(): LicenseRecord[] {
  return readJson<LicenseRecord[]>(LICENSES_KEY, []);
}

export function getCurrentUser(): UserAccount | null {
  const email = localStorage.getItem(SESSION_KEY);
  if (!email) return null;
  const users = listUsers();
  return users.find((u) => u.email === email) ?? null;
}

export function logoutUser(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function registerUser(params: {
  name: string;
  email: string;
  institution: string;
  password: string;
  role?: UserRole;
  autoLogin?: boolean;
}): Promise<{ ok: true; user: UserAccount } | { ok: false; error: string }> {
  await ensureSeeded();
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const institution = params.institution.trim() || "Sekolah / Umum";
  const password = params.password;

  if (name.length < 2) {
    return { ok: false, error: "Nama lengkap minimal 2 karakter." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Format email tidak valid." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password minimal 6 karakter." };
  }

  const users = listUsers();
  if (users.some((u) => u.email === email)) {
    return { ok: false, error: "Email tersebut sudah terdaftar. Silakan masuk." };
  }

  const salt = randomChunk(12);
  const passwordHash = await hashPassword(password, salt);
  const newUser: UserAccount = {
    id: generateId("usr"),
    name,
    email,
    institution,
    role: params.role ?? "guru",
    passwordHash,
    salt,
    plan: "free",
    licenseKey: null,
    licenseActivatedAt: null,
    licenseExpiresAt: null,
    createdAt: new Date().toISOString(),
  };

  writeJson(USERS_KEY, [newUser, ...users]);
  if (params.autoLogin !== false) {
    localStorage.setItem(SESSION_KEY, newUser.email);
  }
  return { ok: true, user: newUser };
}

export async function loginUser(params: {
  email: string;
  password: string;
}): Promise<{ ok: true; user: UserAccount } | { ok: false; error: string }> {
  await ensureSeeded();
  const email = params.email.trim().toLowerCase();
  const users = listUsers();
  const found = users.find((u) => u.email === email);

  if (!found) {
    return { ok: false, error: "Email belum terdaftar. Silakan daftar akun baru terlebih dahulu." };
  }

  const candidateHash = await hashPassword(params.password, found.salt);
  if (candidateHash !== found.passwordHash) {
    return { ok: false, error: "Password salah. Silakan periksa kembali." };
  }

  localStorage.setItem(SESSION_KEY, found.email);
  return { ok: true, user: found };
}

export function updateUserProfile(params: {
  email: string;
  name: string;
  institution: string;
}): { ok: true; user: UserAccount } | { ok: false; error: string } {
  const name = params.name.trim();
  const institution = params.institution.trim() || "Sekolah / Umum";
  if (name.length < 2) {
    return { ok: false, error: "Nama lengkap minimal 2 karakter." };
  }

  const users = listUsers();
  const idx = users.findIndex((u) => u.email === params.email);
  if (idx === -1) {
    return { ok: false, error: "Akun tidak ditemukan." };
  }

  const updated: UserAccount = { ...users[idx], name, institution };
  users[idx] = updated;
  writeJson(USERS_KEY, users);
  return { ok: true, user: updated };
}

export function activateLicenseForUser(params: {
  email: string;
  licenseKey: string;
}): { ok: true; user: UserAccount; license: LicenseRecord } | { ok: false; error: string } {
  const normalized = normalizeLicenseKey(params.licenseKey);
  if (!normalized) {
    return { ok: false, error: "Masukkan kode lisensi terlebih dahulu." };
  }

  const users = listUsers();
  const userIdx = users.findIndex((u) => u.email === params.email);
  if (userIdx === -1) {
    return { ok: false, error: "Akun pengguna tidak ditemukan." };
  }

  const licenses = listLicenses();
  const licIdx = licenses.findIndex((l) => l.key === normalized);
  if (licIdx === -1) {
    return { ok: false, error: `Kode lisensi "${normalized}" tidak ditemukan.` };
  }

  const lic = licenses[licIdx];
  if (lic.status === "revoked") {
    return { ok: false, error: "Kode lisensi ini telah dicabut dan tidak dapat digunakan." };
  }
  if (lic.status === "active" && lic.activatedByEmail !== params.email) {
    return { ok: false, error: "Kode lisensi ini sudah digunakan oleh akun lain." };
  }
  if (lic.status === "active" && lic.activatedByEmail === params.email) {
    return { ok: false, error: "Kode lisensi ini sudah aktif pada akun Anda." };
  }

  const now = new Date().toISOString();
  const currentUser = users[userIdx];
  const baseDate =
    currentUser.licenseExpiresAt && new Date(currentUser.licenseExpiresAt).getTime() > Date.now()
      ? currentUser.licenseExpiresAt
      : now;
  const expiresAt = addDays(baseDate, lic.durationDays);

  const updatedLicense: LicenseRecord = {
    ...lic,
    status: "active",
    activatedByEmail: currentUser.email,
    activatedAt: now,
    expiresAt,
  };
  licenses[licIdx] = updatedLicense;
  writeJson(LICENSES_KEY, licenses);

  const updatedUser: UserAccount = {
    ...currentUser,
    plan: "pro",
    licenseKey: updatedLicense.key,
    licenseActivatedAt: now,
    licenseExpiresAt: expiresAt,
  };
  users[userIdx] = updatedUser;
  writeJson(USERS_KEY, users);

  return { ok: true, user: updatedUser, license: updatedLicense };
}

export function generateLicenses(params: {
  packageId: string;
  count: number;
  note: string;
  createdBy: string;
}): LicenseRecord[] {
  const pkg = LICENSE_PACKAGES.find((p) => p.id === params.packageId) ?? LICENSE_PACKAGES[2];
  const safeCount = Math.min(20, Math.max(1, Math.floor(params.count || 1)));
  const existing = listLicenses();
  const existingKeys = new Set(existing.map((l) => l.key));
  const year = new Date().getFullYear();
  const now = new Date().toISOString();

  const created: LicenseRecord[] = [];
  for (let i = 0; i < safeCount; i++) {
    let key = "";
    do {
      key = `ZFARM-${pkg.prefix}-${year}-${randomChunk(4)}`;
    } while (existingKeys.has(key));
    existingKeys.add(key);

    created.push({
      key,
      planName: pkg.name,
      durationDays: pkg.durationDays,
      status: "available",
      createdAt: now,
      createdBy: params.createdBy,
      note: params.note.trim() || `Dibuat via Panel Admin`,
      activatedByEmail: null,
      activatedAt: null,
      expiresAt: null,
    });
  }

  writeJson(LICENSES_KEY, [...created, ...existing]);
  return created;
}

export function revokeLicense(key: string): { ok: true } | { ok: false; error: string } {
  const normalized = normalizeLicenseKey(key);
  const licenses = listLicenses();
  const licIdx = licenses.findIndex((l) => l.key === normalized);
  if (licIdx === -1) {
    return { ok: false, error: "Lisensi tidak ditemukan." };
  }

  const lic = licenses[licIdx];
  if (lic.key === "ZFARM-PRO-ADMIN-0001") {
    return { ok: false, error: "Lisensi Admin utama tidak dapat dicabut." };
  }

  licenses[licIdx] = { ...lic, status: "revoked" };
  writeJson(LICENSES_KEY, licenses);

  if (lic.activatedByEmail) {
    const users = listUsers();
    const userIdx = users.findIndex((u) => u.email === lic.activatedByEmail);
    if (userIdx !== -1 && users[userIdx].licenseKey === lic.key) {
      users[userIdx] = {
        ...users[userIdx],
        plan: "free",
        licenseKey: null,
        licenseActivatedAt: null,
        licenseExpiresAt: null,
      };
      writeJson(USERS_KEY, users);
    }
  }

  return { ok: true };
}

export function adminAssignProToUser(params: {
  targetEmail: string;
  adminEmail: string;
  packageId?: string;
}): { ok: true; license: LicenseRecord } | { ok: false; error: string } {
  const [generated] = generateLicenses({
    packageId: params.packageId ?? "yearly",
    count: 1,
    note: `Aktivasi langsung oleh Admin untuk ${params.targetEmail}`,
    createdBy: params.adminEmail,
  });

  const activated = activateLicenseForUser({
    email: params.targetEmail,
    licenseKey: generated.key,
  });

  if (!activated.ok) {
    return { ok: false, error: activated.error };
  }

  return { ok: true, license: activated.license };
}

export function adminDowngradeUser(targetEmail: string): { ok: true } | { ok: false; error: string } {
  const users = listUsers();
  const idx = users.findIndex((u) => u.email === targetEmail);
  if (idx === -1) return { ok: false, error: "Akun tidak ditemukan." };
  if (users[idx].role === "admin") {
    return { ok: false, error: "Akun Admin tidak dapat diturunkan ke paket Gratis." };
  }

  const currentKey = users[idx].licenseKey;
  if (currentKey) {
    revokeLicense(currentKey);
  } else {
    users[idx] = {
      ...users[idx],
      plan: "free",
      licenseKey: null,
      licenseActivatedAt: null,
      licenseExpiresAt: null,
    };
    writeJson(USERS_KEY, users);
  }
  return { ok: true };
}

export function buildLicenseCertificateText(user: UserAccount): string {
  return [
    "================================================",
    "        SERTIFIKAT LISENSI ZUPERFARM PRO        ",
    "================================================",
    `Nama Pemegang : ${user.name}`,
    `Email Akun    : ${user.email}`,
    `Instansi      : ${user.institution}`,
    `Role          : ${user.role.toUpperCase()}`,
    `Status Paket  : ${isProActive(user) ? "PRO AKTIF" : "GRATIS / KEDALUWARSA"}`,
    `Kode Lisensi  : ${user.licenseKey ?? "-"}`,
    `Diaktifkan    : ${formatDateID(user.licenseActivatedAt)}`,
    `Berlaku Sampai: ${formatDateID(user.licenseExpiresAt)}`,
    `Sisa Masa     : ${getLicenseDaysLeft(user.licenseExpiresAt)} hari`,
    "================================================",
    `Dicetak pada  : ${new Date().toLocaleString("id-ID")}`,
  ].join("\n");
}
