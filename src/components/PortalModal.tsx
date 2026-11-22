import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  LICENSE_PACKAGES,
  buildLicenseCertificateText,
  formatDateID,
  getLicenseDaysLeft,
  isProActive,
  resetAllData,
  type LicenseRecord,
  type LicenseStatus,
  type UserAccount,
  type UserRole,
} from "../lib/authLicenseStore";
import {
  apiActivateLicense,
  apiAdminAssignPro,
  apiAdminData,
  apiAdminDowngradeUser,
  apiAdminRevokeLicense,
  apiClaimOrGenerateLicenses,
  apiListAvailableLicenses,
  apiLogin,
  apiLogout,
  apiRegister,
  apiUpdateProfile,
  type BackendHealth,
} from "../lib/gameApi";

export type PortalTab = "akun" | "lisensi" | "admin";

interface PortalModalProps {
  open: boolean;
  initialTab: PortalTab;
  user: UserAccount | null;
  health: BackendHealth | null;
  onClose: () => void;
  onAuthChange: () => Promise<void> | void;
  onOpenClassroom: () => void;
}

export default function PortalModal({
  open,
  initialTab,
  user,
  health,
  onClose,
  onAuthChange,
  onOpenClassroom,
}: PortalModalProps) {
  const [tab, setTab] = useState<PortalTab>(initialTab);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Auth form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regInst, setRegInst] = useState("");
  const [regPass, setRegPass] = useState("");

  // Profile edit
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editInst, setEditInst] = useState("");

  // License activation
  const [licenseInput, setLicenseInput] = useState("");

  // Admin state
  const [adminPkg, setAdminPkg] = useState("yearly");
  const [adminCount, setAdminCount] = useState(1);
  const [adminNote, setAdminNote] = useState("");
  const [licenseFilter, setLicenseFilter] = useState<"all" | LicenseStatus>("all");
  const [adminSection, setAdminSection] = useState<"licenses" | "users">("licenses");

  // Admin create user form
  const [newAccName, setNewAccName] = useState("");
  const [newAccEmail, setNewAccEmail] = useState("");
  const [newAccInst, setNewAccInst] = useState("");
  const [newAccPass, setNewAccPass] = useState("");
  const [newAccRole, setNewAccRole] = useState<UserRole>("guru");
  const [newAccPro, setNewAccPro] = useState(true);

  // Data snapshot
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [availableOnly, setAvailableOnly] = useState<LicenseRecord[]>([]);
  const [busy, setBusy] = useState(false);

  // Feedback message
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const refreshData = async () => {
    await onAuthChange();
    try {
      const avail = await apiListAvailableLicenses();
      setAvailableOnly(avail);
      const adminSnap = await apiAdminData();
      setUsers(adminSnap.users);
      setLicenses(adminSnap.licenses);
    } catch {
      // Ignore transient error
    }
  };

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setMsg(null);
      void refreshData();
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditInst(user.institution);
    }
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredLicenses = useMemo(() => {
    if (licenseFilter === "all") return licenses;
    return licenses.filter((l) => l.status === licenseFilter);
  }, [licenses, licenseFilter]);

  const stats = useMemo(() => {
    const proUsers = users.filter((u) => isProActive(u)).length;
    const availLic = licenses.filter((l) => l.status === "available").length;
    const activeLic = licenses.filter((l) => l.status === "active").length;
    return { totalUsers: users.length, proUsers, availLic, activeLic };
  }, [users, licenses]);

  if (!open) return null;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    setCopiedKey(text);
    setTimeout(() => setCopiedKey((cur) => (cur === text ? null : cur)), 1800);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiLogin(loginEmail, loginPass);
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setLoginPass("");
      await refreshData();
      setMsg({ type: "ok", text: `Berhasil masuk sebagai ${res.user.name}!` });
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiRegister({
        name: regName,
        email: regEmail,
        institution: regInst,
        password: regPass,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setRegName("");
      setRegEmail("");
      setRegInst("");
      setRegPass("");
      await refreshData();
      setMsg({
        type: "ok",
        text: `Akun ${res.user.name} berhasil dibuat! Anda kini dapat mengaktifkan lisensi Pro.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleQuickLogin = async (email: string, password: string) => {
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiLogin(email, password);
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      await refreshData();
      setMsg({ type: "ok", text: `Masuk sebagai ${res.user.name} (${res.user.role.toUpperCase()}).` });
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    apiLogout();
    setEditingProfile(false);
    await refreshData();
    setMsg({ type: "ok", text: "Anda telah keluar dari akun." });
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const res = await apiUpdateProfile({
        email: user.email,
        name: editName,
        institution: editInst,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setEditingProfile(false);
      await refreshData();
      setMsg({ type: "ok", text: "Profil akun berhasil diperbarui." });
    } finally {
      setBusy(false);
    }
  };

  const handleActivateLicense = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!user) {
      setTab("akun");
      setMsg({
        type: "err",
        text: "Silakan masuk atau daftar akun terlebih dahulu sebelum mengaktifkan lisensi.",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await apiActivateLicense({ email: user.email, licenseKey: licenseInput });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setLicenseInput("");
      await refreshData();
      setTab("akun");
      setMsg({
        type: "ok",
        text: `Selamat! Lisensi ${res.license.key} (${res.license.planName}) berhasil diaktifkan sampai ${formatDateID(res.license.expiresAt)}.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleClaimPackage = async (pkgId: string) => {
    setMsg(null);
    setBusy(true);
    try {
      const created = await apiClaimOrGenerateLicenses({
        packageId: pkgId,
        count: 1,
        note: user ? `Dipesan oleh ${user.email}` : "Dipesan melalui halaman Lisensi",
        createdBy: user?.email ?? "self-service",
      });
      if (created.length === 0) return;
      const newKey = created[0].key;
      setLicenseInput(newKey);
      await refreshData();
      void copyText(newKey);
      setMsg({
        type: "ok",
        text: user
          ? `Kode lisensi baru dibuat: ${newKey} (tersalin). Klik "Aktifkan Lisensi Sekarang" di atas.`
          : `Kode lisensi baru dibuat: ${newKey} (tersalin). Masuk/daftar akun dulu lalu aktifkan kode ini.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadCertificate = () => {
    if (!user) return;
    const content = buildLicenseCertificateText(user);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lisensi-zuperfarm-${user.email.replace(/[^a-z0-9]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdminGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") return;
    setBusy(true);
    try {
      const created = await apiClaimOrGenerateLicenses({
        packageId: adminPkg,
        count: adminCount,
        note: adminNote,
        createdBy: user.email,
      });
      setAdminNote("");
      await refreshData();
      if (created.length === 1) {
        void copyText(created[0].key);
        setMsg({
          type: "ok",
          text: `1 kode lisensi berhasil dibuat & disalin: ${created[0].key}`,
        });
      } else {
        setMsg({
          type: "ok",
          text: `${created.length} kode lisensi baru berhasil dibuat!`,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAdminCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiRegister({
        name: newAccName,
        email: newAccEmail,
        institution: newAccInst,
        password: newAccPass,
        role: newAccRole,
        autoLogin: false,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }

      let extra = "";
      if (newAccPro) {
        const assigned = await apiAdminAssignPro({
          targetEmail: res.user.email,
          adminEmail: user.email,
          packageId: "yearly",
        });
        if (assigned.ok) {
          extra = ` + Lisensi Pro aktif (${assigned.license.key})`;
        }
      }

      setNewAccName("");
      setNewAccEmail("");
      setNewAccInst("");
      setNewAccPass("");
      await refreshData();
      setMsg({
        type: "ok",
        text: `Akun ${res.user.email} berhasil dibuat${extra}.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (key: string) => {
    const res = await apiAdminRevokeLicense(key);
    if (!res.ok) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    await refreshData();
    setMsg({ type: "ok", text: `Lisensi ${key} telah dicabut.` });
  };

  const handleAdminAssignPro = async (targetEmail: string) => {
    if (!user || user.role !== "admin") return;
    const res = await apiAdminAssignPro({
      targetEmail,
      adminEmail: user.email,
      packageId: "yearly",
    });
    if (!res.ok) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    await refreshData();
    setMsg({
      type: "ok",
      text: `Akun ${targetEmail} kini Pro dengan kode ${res.license.key}.`,
    });
  };

  const handleAdminDowngrade = async (targetEmail: string) => {
    const res = await apiAdminDowngradeUser(targetEmail);
    if (!res.ok) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    await refreshData();
    setMsg({ type: "ok", text: `Akun ${targetEmail} dikembalikan ke paket Gratis.` });
  };

  const handleResetDemo = async () => {
    if (!window.confirm("Reset data lokal kembali ke pengaturan awal?")) return;
    await resetAllData();
    await refreshData();
    setMsg({ type: "ok", text: "Data lokal telah direset ke pengaturan awal." });
  };

  const proActive = isProActive(user);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-panel wood" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="px" style={{ margin: 0, fontSize: 26 }}>
              🌾 Portal Akun &amp; Lisensi ZuperFarm
            </h2>
            <div className="muted" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
              <span>Kelola akun guru, aktivasi lisensi Pro, dan panel admin</span>
              <span className={`badge ${health?.mode === "postgres" ? "status-available" : "free"}`}>
                {health?.mode === "postgres" ? "🟢 Server Postgres Aktif" : "🟡 Mode Lokal"}
              </span>
            </div>
          </div>
          <button className="btn sm w modal-close-btn" type="button" onClick={onClose} aria-label="Tutup">
            ✖ Tutup
          </button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`btn sm ${tab === "akun" ? "g" : "w"}`}
            onClick={() => {
              setTab("akun");
              setMsg(null);
            }}
          >
            {user ? `👤 Akun (${user.name.split(" ")[0]})` : "🔐 Masuk / Daftar"}
          </button>
          <button
            type="button"
            className={`btn sm ${tab === "lisensi" ? "g" : "w"}`}
            onClick={() => {
              setTab("lisensi");
              setMsg(null);
            }}
          >
            🔑 Lisensi Pro
          </button>
          <button
            type="button"
            className={`btn sm ${tab === "admin" ? "g" : "w"}`}
            onClick={() => {
              setTab("admin");
              setMsg(null);
            }}
          >
            👑 Panel Admin
          </button>
        </div>

        {msg && (
          <div className={`alert-box ${msg.type === "ok" ? "ok" : "err"}`}>
            <span>{msg.type === "ok" ? "✅" : "⚠️"}</span>
            <span>{msg.text}</span>
          </div>
        )}

        <div className="modal-body">
          {/* ================= TAB 1: AKUN / AUTH ================= */}
          {tab === "akun" && !user && (
            <div className="portal-grid">
              <div className="subcard">
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button
                    type="button"
                    className={`btn sm ${authMode === "login" ? "" : "w"}`}
                    onClick={() => {
                      setAuthMode("login");
                      setMsg(null);
                    }}
                  >
                    Masuk Akun
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${authMode === "register" ? "" : "w"}`}
                    onClick={() => {
                      setAuthMode("register");
                      setMsg(null);
                    }}
                  >
                    Daftar Akun Baru
                  </button>
                </div>

                {authMode === "login" ? (
                  <form className="form-stack" onSubmit={handleLogin}>
                    <label>
                      Email Akun
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="nama@sekolah.sch.id"
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        required
                        value={loginPass}
                        onChange={(e) => setLoginPass(e.target.value)}
                        placeholder="Minimal 6 karakter"
                      />
                    </label>
                    <button className="btn g" type="submit" disabled={busy}>
                      {busy ? "Memproses..." : "🔓 Masuk Sekarang"}
                    </button>
                  </form>
                ) : (
                  <form className="form-stack" onSubmit={handleRegister}>
                    <label>
                      Nama Lengkap / Guru
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Contoh: Siti Rahmawati, S.Pd."
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="nama@sekolah.sch.id"
                      />
                    </label>
                    <label>
                      Sekolah / Kampus / Instansi
                      <input
                        type="text"
                        value={regInst}
                        onChange={(e) => setRegInst(e.target.value)}
                        placeholder="Contoh: SMPN 1 Malang"
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        placeholder="Minimal 6 karakter"
                      />
                    </label>
                    <button className="btn g" type="submit" disabled={busy}>
                      {busy ? "Memproses..." : "🌱 Daftar Akun Guru"}
                    </button>
                  </form>
                )}
              </div>

              <div className="subcard">
                <h3 className="px" style={{ marginTop: 0, fontSize: 22 }}>
                  ⚡ Akun Siap Pakai
                </h3>
                <p style={{ marginTop: 0, fontSize: 14 }}>
                  Masuk instan menggunakan akun bawaan untuk langsung membuka fitur **Buat Kelas** dan **Ruang Mabar 30+ Murid**:
                </p>

                <div className="demo-box">
                  <div>
                    <b>👑 Admin (Pro + Buat Kelas + Lisensi)</b>
                    <div className="mono">admin@zuperfarm.local / admin123</div>
                  </div>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    onClick={() => handleQuickLogin("admin@zuperfarm.local", "admin123")}
                  >
                    Masuk Admin
                  </button>
                </div>

                <div className="demo-box">
                  <div>
                    <b>👩‍🏫 Guru Demo (Paket Gratis)</b>
                    <div className="mono">guru@zuperfarm.local / guru123</div>
                  </div>
                  <button
                    type="button"
                    className="btn sm b"
                    disabled={busy}
                    onClick={() => handleQuickLogin("guru@zuperfarm.local", "guru123")}
                  >
                    Masuk Guru
                  </button>
                </div>

                {licenseInput && (
                  <div className="alert-box ok" style={{ marginTop: 12 }}>
                    <span>🔑</span>
                    <span>
                      Kode <b>{licenseInput}</b> sudah disiapkan. Setelah masuk/daftar, Anda bisa langsung mengaktifkannya!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "akun" && user && (
            <div className="portal-grid">
              <div className="subcard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      <span className={`badge ${proActive ? "pro" : "free"}`}>
                        {proActive ? "⭐ PRO AKTIF" : "🌱 PAKET GRATIS"}
                      </span>
                      <span className="badge role">
                        {user.role === "admin" ? "👑 ADMIN" : "👩‍🏫 GURU"}
                      </span>
                    </div>
                    <h3 className="px" style={{ margin: "2px 0", fontSize: 24 }}>
                      {user.name}
                    </h3>
                    <div className="mono" style={{ fontSize: 14 }}>{user.email}</div>
                    <div className="muted" style={{ fontSize: 14 }}>🏫 {user.institution}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn sm w"
                      onClick={() => setEditingProfile((v) => !v)}
                    >
                      ✏️ Edit
                    </button>
                    <button type="button" className="btn sm" onClick={handleLogout}>
                      🚪 Keluar
                    </button>
                  </div>
                </div>

                {editingProfile && (
                  <form className="form-stack" onSubmit={handleSaveProfile} style={{ marginTop: 14, paddingTop: 12, borderTop: "2px dashed var(--wood2)" }}>
                    <label>
                      Nama Lengkap
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </label>
                    <label>
                      Sekolah / Instansi
                      <input
                        type="text"
                        value={editInst}
                        onChange={(e) => setEditInst(e.target.value)}
                      />
                    </label>
                    <button className="btn sm g" type="submit" disabled={busy}>
                      💾 Simpan Profil
                    </button>
                  </form>
                )}

                {proActive && (
                  <div className="pro-tools" style={{ marginTop: 16 }}>
                    <h4 className="px" style={{ margin: "0 0 8px", fontSize: 19 }}>
                      🏫 Akses Pro Terbuka Penuh!
                    </h4>
                    <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                      Anda bisa langsung membuat kelas, menyusun paket soal, dan membuka ruang mabar kode 6 angka untuk <b>30+ murid sekaligus</b>.
                    </p>
                    <button
                      type="button"
                      className="btn sm g"
                      onClick={() => {
                        onClose();
                        onOpenClassroom();
                      }}
                    >
                      🚀 Buka Kelas &amp; Ruang Mabar ▸
                    </button>
                  </div>
                )}
              </div>

              <div className="subcard">
                <h3 className="px" style={{ marginTop: 0, fontSize: 22 }}>
                  🔑 Status Lisensi Akun
                </h3>

                {proActive ? (
                  <div className="license-detail">
                    <div className="lic-row">
                      <span>Kode Lisensi</span>
                      <button
                        type="button"
                        className="key-chip"
                        onClick={() => user.licenseKey && copyText(user.licenseKey)}
                      >
                        {user.licenseKey} {copiedKey === user.licenseKey ? "✓" : "📋"}
                      </button>
                    </div>
                    <div className="lic-row">
                      <span>Aktif Sejak</span>
                      <b>{formatDateID(user.licenseActivatedAt)}</b>
                    </div>
                    <div className="lic-row">
                      <span>Berlaku Sampai</span>
                      <b>{formatDateID(user.licenseExpiresAt)}</b>
                    </div>
                    <div className="lic-row">
                      <span>Sisa Masa Aktif</span>
                      <b>{getLicenseDaysLeft(user.licenseExpiresAt)} hari</b>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                      <button type="button" className="btn sm b" onClick={handleDownloadCertificate}>
                        📄 Unduh Bukti Lisensi
                      </button>
                      <button type="button" className="btn sm w" onClick={() => setTab("lisensi")}>
                        ➕ Perpanjang Lisensi
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ marginTop: 0, fontSize: 14 }}>
                      Akun Anda saat ini masih berada di <b>Paket Gratis</b>. Masukkan kode lisensi untuk langsung membuka fitur <b>Buat Kelas &amp; Mabar 30+ Murid</b>!
                    </p>
                    <form className="form-stack" onSubmit={handleActivateLicense}>
                      <label>
                        Kode Lisensi Pro
                        <input
                          type="text"
                          required
                          value={licenseInput}
                          onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                          placeholder="ZFARM-PRO-2026-8801"
                          className="mono"
                        />
                      </label>
                      <button className="btn g" type="submit" disabled={busy}>
                        🔓 Aktifkan Lisensi Pro
                      </button>
                    </form>
                    <div style={{ marginTop: 10, fontSize: 13 }}>
                      Belum punya kode?{" "}
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setTab("lisensi")}
                      >
                        Lihat &amp; ambil kode lisensi di sini ▸
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 2: LISENSI PRO ================= */}
          {tab === "lisensi" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="subcard">
                <h3 className="px" style={{ marginTop: 0, fontSize: 22 }}>
                  🔓 Aktivasi Kode Lisensi
                </h3>
                <form className="inline-activate" onSubmit={handleActivateLicense}>
                  <input
                    type="text"
                    required
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                    placeholder="Contoh: ZFARM-PRO-2026-8801"
                    className="mono"
                  />
                  <button className="btn g" type="submit" disabled={busy}>
                    {user ? "🔓 Aktifkan Lisensi Sekarang" : "🔐 Masuk & Aktifkan"}
                  </button>
                </form>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {user
                    ? `Aktifkan untuk akun: ${user.name} (${user.email})`
                    : "Masukkan kode lisensi, lalu masuk/daftar akun guru untuk mengaktifkannya."}
                </div>
              </div>

              <div>
                <h3 className="px" style={{ margin: "0 0 10px", fontSize: 22 }}>
                  📦 Pilih Paket &amp; Buat Kode Lisensi
                </h3>
                <div className="pkg-grid">
                  {LICENSE_PACKAGES.map((pkg) => (
                    <div className="subcard pkg-card" key={pkg.id}>
                      <div className="badge pro" style={{ alignSelf: "flex-start" }}>
                        {pkg.durationDays} Hari
                      </div>
                      <h4 className="px" style={{ margin: "6px 0 2px", fontSize: 20 }}>
                        {pkg.name}
                      </h4>
                      <div style={{ fontWeight: 900, color: "#8a3d12", marginBottom: 6 }}>
                        {pkg.priceLabel}
                      </div>
                      <p style={{ margin: "0 0 12px", fontSize: 14, flex: 1 }}>
                        {pkg.description}
                      </p>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={busy}
                        onClick={() => handleClaimPackage(pkg.id)}
                      >
                        ⚡ Buat Kode Lisensi
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="subcard">
                <h3 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                  🎫 Kode Lisensi Tersedia ({availableOnly.length})
                </h3>
                {availableOnly.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Belum ada kode tersedia. Klik "Buat Kode Lisensi" pada paket di atas untuk membuat kode baru.
                  </p>
                ) : (
                  <div className="avail-list">
                    {availableOnly.slice(0, 6).map((lic) => (
                      <div className="avail-item" key={lic.key}>
                        <div>
                          <div className="mono" style={{ fontWeight: 900 }}>{lic.key}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {lic.planName} · {lic.durationDays} hari
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn sm w"
                            onClick={() => copyText(lic.key)}
                          >
                            {copiedKey === lic.key ? "✓" : "📋"}
                          </button>
                          <button
                            type="button"
                            className="btn sm g"
                            onClick={() => {
                              setLicenseInput(lic.key);
                              setMsg({
                                type: "ok",
                                text: `Kode ${lic.key} dimasukkan ke kolom aktivasi di atas.`,
                              });
                            }}
                          >
                            Pakai
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 3: PANEL ADMIN ================= */}
          {tab === "admin" && (!user || user.role !== "admin") && (
            <div className="subcard" style={{ textAlign: "center", padding: 28 }}>
              <div style={{ fontSize: 44 }}>👑</div>
              <h3 className="px" style={{ fontSize: 26, margin: "8px 0" }}>
                Akses Khusus Admin Lisensi
              </h3>
              <p style={{ maxWidth: 500, margin: "0 auto 16px" }}>
                Masuk menggunakan akun Admin untuk membuat kode lisensi massal, mencabut lisensi, membuat akun guru baru, dan mengelola status Pro semua pengguna.
              </p>
              <div className="mono" style={{ marginBottom: 16 }}>
                admin@zuperfarm.local · admin123
              </div>
              <button
                type="button"
                className="btn g"
                disabled={busy}
                onClick={() => handleQuickLogin("admin@zuperfarm.local", "admin123")}
              >
                👑 Masuk sebagai Admin Sekarang
              </button>
            </div>
          )}

          {tab === "admin" && user && user.role === "admin" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="stats-grid">
                <div className="stat-box">
                  <span className="muted">Total Akun</span>
                  <b className="px">{stats.totalUsers}</b>
                </div>
                <div className="stat-box">
                  <span className="muted">Akun Pro Aktif</span>
                  <b className="px" style={{ color: "#2d7a16" }}>{stats.proUsers}</b>
                </div>
                <div className="stat-box">
                  <span className="muted">Lisensi Tersedia</span>
                  <b className="px" style={{ color: "#8a3d12" }}>{stats.availLic}</b>
                </div>
                <div className="stat-box">
                  <span className="muted">Lisensi Terpakai</span>
                  <b className="px">{stats.activeLic}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={`btn sm ${adminSection === "licenses" ? "" : "w"}`}
                    onClick={() => setAdminSection("licenses")}
                  >
                    🔑 Kelola Lisensi ({licenses.length})
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${adminSection === "users" ? "" : "w"}`}
                    onClick={() => setAdminSection("users")}
                  >
                    👥 Kelola Akun ({users.length})
                  </button>
                </div>
                {health?.mode !== "postgres" && (
                  <button type="button" className="btn sm w" onClick={handleResetDemo}>
                    🔄 Reset Data Lokal
                  </button>
                )}
              </div>

              {adminSection === "licenses" ? (
                <>
                  <form className="subcard" onSubmit={handleAdminGenerate}>
                    <h3 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                      ⚡ Generator Kode Lisensi Baru
                    </h3>
                    <div className="admin-gen-row">
                      <label>
                        Paket Lisensi
                        <select value={adminPkg} onChange={(e) => setAdminPkg(e.target.value)}>
                          {LICENSE_PACKAGES.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.durationDays} hr)
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Jumlah (1–20)
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={adminCount}
                          onChange={(e) => setAdminCount(Number(e.target.value))}
                        />
                      </label>
                      <label style={{ flex: 2 }}>
                        Catatan / Pembeli
                        <input
                          type="text"
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Contoh: Ibu Rina - SMAN 3"
                        />
                      </label>
                      <button className="btn g" type="submit" disabled={busy} style={{ alignSelf: "flex-end" }}>
                        ⚡ Generate
                      </button>
                    </div>
                  </form>

                  <div className="subcard">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {(["all", "available", "active", "revoked"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`btn sm ${licenseFilter === f ? "b" : "w"}`}
                          onClick={() => setLicenseFilter(f)}
                        >
                          {f === "all"
                            ? "Semua"
                            : f === "available"
                              ? "Tersedia"
                              : f === "active"
                                ? "Aktif"
                                : "Dicabut"}
                        </button>
                      ))}
                    </div>

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Kode Lisensi</th>
                            <th>Paket</th>
                            <th>Status</th>
                            <th>Pengguna / Catatan</th>
                            <th>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLicenses.map((lic) => (
                            <tr key={lic.key}>
                              <td className="mono" style={{ fontWeight: 800 }}>{lic.key}</td>
                              <td>{lic.planName}</td>
                              <td>
                                <span className={`badge status-${lic.status}`}>
                                  {lic.status === "available"
                                    ? "Tersedia"
                                    : lic.status === "active"
                                      ? "Aktif"
                                      : "Dicabut"}
                                </span>
                              </td>
                              <td>
                                {lic.activatedByEmail ? (
                                  <div>
                                    <b>{lic.activatedByEmail}</b>
                                    <div className="muted" style={{ fontSize: 12 }}>
                                      s/d {formatDateID(lic.expiresAt)}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="muted">{lic.note || "-"}</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn sm w"
                                    onClick={() => copyText(lic.key)}
                                  >
                                    {copiedKey === lic.key ? "✓" : "📋"}
                                  </button>
                                  {lic.status !== "revoked" &&
                                    lic.key !== "ZFARM-PRO-ADMIN-0001" && (
                                      <button
                                        type="button"
                                        className="btn sm danger"
                                        onClick={() => handleRevoke(lic.key)}
                                      >
                                        Cabut
                                      </button>
                                    )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <form className="subcard" onSubmit={handleAdminCreateAccount}>
                    <h3 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                      ➕ Buat Akun Pengguna Baru
                    </h3>
                    <div className="admin-user-grid">
                      <label>
                        Nama Lengkap
                        <input
                          type="text"
                          required
                          value={newAccName}
                          onChange={(e) => setNewAccName(e.target.value)}
                          placeholder="Nama guru / pengguna"
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          required
                          value={newAccEmail}
                          onChange={(e) => setNewAccEmail(e.target.value)}
                          placeholder="email@sekolah.sch.id"
                        />
                      </label>
                      <label>
                        Sekolah / Instansi
                        <input
                          type="text"
                          value={newAccInst}
                          onChange={(e) => setNewAccInst(e.target.value)}
                          placeholder="Nama instansi"
                        />
                      </label>
                      <label>
                        Password
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={newAccPass}
                          onChange={(e) => setNewAccPass(e.target.value)}
                          placeholder="Minimal 6 karakter"
                        />
                      </label>
                      <label>
                        Role
                        <select
                          value={newAccRole}
                          onChange={(e) => setNewAccRole(e.target.value as UserRole)}
                        >
                          <option value="guru">Guru</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newAccPro}
                          onChange={(e) => setNewAccPro(e.target.checked)}
                        />
                        Langsung aktifkan Lisensi Pro (1 Tahun)
                      </label>
                    </div>
                    <button className="btn g" type="submit" disabled={busy} style={{ marginTop: 10 }}>
                      ➕ Buat Akun
                    </button>
                  </form>

                  <div className="subcard">
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Nama &amp; Instansi</th>
                            <th>Email</th>
                            <th>Paket</th>
                            <th>Kode Lisensi</th>
                            <th>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => {
                            const active = isProActive(u);
                            return (
                              <tr key={u.id}>
                                <td>
                                  <b>{u.name}</b>{" "}
                                  {u.role === "admin" && <span className="badge role">ADMIN</span>}
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    {u.institution}
                                  </div>
                                </td>
                                <td className="mono">{u.email}</td>
                                <td>
                                  <span className={`badge ${active ? "pro" : "free"}`}>
                                    {active ? "PRO" : "GRATIS"}
                                  </span>
                                </td>
                                <td className="mono" style={{ fontSize: 12 }}>
                                  {u.licenseKey ?? "-"}
                                </td>
                                <td>
                                  {u.role !== "admin" &&
                                    (active ? (
                                      <button
                                        type="button"
                                        className="btn sm danger"
                                        onClick={() => handleAdminDowngrade(u.email)}
                                      >
                                        Cabut Pro
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn sm g"
                                        onClick={() => handleAdminAssignPro(u.email)}
                                      >
                                        ⭐ Aktifkan Pro
                                      </button>
                                    ))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
