import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  LICENSE_PACKAGES,
  buildLicenseCertificateText,
  formatDateID,
  getLicenseDaysLeft,
  isProActive,
  resetAllData,
  type LicenseRecord,
  type LicenseRequestRecord,
  type LicenseStatus,
  type UserAccount,
  type UserRole,
} from "../lib/authLicenseStore";
import {
  apiActivateLicense,
  apiAdminApproveRequest,
  apiAdminAssignPro,
  apiAdminData,
  apiAdminDowngradeUser,
  apiAdminGenerateLicenses,
  apiAdminRejectRequest,
  apiAdminRevokeLicense,
  apiLogin,
  apiLogout,
  apiMyLicenseRequests,
  apiRegister,
  apiSubmitLicenseRequest,
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

  // License activation & user request form
  const [licenseInput, setLicenseInput] = useState("");
  const [reqPackageId, setReqPackageId] = useState("yearly");
  const [reqNote, setReqNote] = useState("");
  const [myRequests, setMyRequests] = useState<LicenseRequestRecord[]>([]);

  // Admin state
  const [adminPkg, setAdminPkg] = useState("yearly");
  const [adminCount, setAdminCount] = useState(1);
  const [adminNote, setAdminNote] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [licenseFilter, setLicenseFilter] = useState<"all" | LicenseStatus>("all");
  const [adminSection, setAdminSection] = useState<"requests" | "licenses" | "users">("requests");

  // Admin create user form
  const [newAccName, setNewAccName] = useState("");
  const [newAccEmail, setNewAccEmail] = useState("");
  const [newAccInst, setNewAccInst] = useState("");
  const [newAccPass, setNewAccPass] = useState("");
  const [newAccRole, setNewAccRole] = useState<UserRole>("guru");
  const [newAccPro, setNewAccPro] = useState(true);

  // Admin data snapshot
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [allRequests, setAllRequests] = useState<LicenseRequestRecord[]>([]);
  const [busy, setBusy] = useState(false);

  // Feedback message
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const refreshData = async (activeUser?: UserAccount | null) => {
    await onAuthChange();
    const targetUser = activeUser !== undefined ? activeUser : user;
    try {
      if (targetUser) {
        const reqs = await apiMyLicenseRequests(targetUser.email);
        setMyRequests(reqs);
      } else {
        setMyRequests([]);
      }
      if (targetUser?.role === "admin") {
        const adminSnap = await apiAdminData(targetUser.email);
        setUsers(adminSnap.users);
        setLicenses(adminSnap.licenses);
        setAllRequests(adminSnap.requests);
      } else {
        setUsers([]);
        setLicenses([]);
        setAllRequests([]);
      }
    } catch {
      // ignore transient error
    }
  };

  useEffect(() => {
    if (open) {
      const nextTab = initialTab === "admin" && user?.role !== "admin" ? "akun" : initialTab;
      setTab(nextTab);
      setMsg(null);
      void refreshData(user);
    }
  }, [open, initialTab, user?.email, user?.role]);

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

  const pendingRequestsCount = useMemo(
    () => allRequests.filter((r) => r.status === "pending").length,
    [allRequests]
  );

  const hasPendingMyRequest = useMemo(
    () => myRequests.some((r) => r.status === "pending"),
    [myRequests]
  );

  const stats = useMemo(() => {
    const proUsers = users.filter((u) => isProActive(u)).length;
    const availLic = licenses.filter((l) => l.status === "available").length;
    return {
      totalUsers: users.length,
      proUsers,
      pendingReq: pendingRequestsCount,
      availLic,
    };
  }, [users, licenses, pendingRequestsCount]);

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
      await refreshData(res.user);
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
      await refreshData(res.user);
      setMsg({
        type: "ok",
        text: `Akun ${res.user.name} berhasil dibuat! Ajukan permintaan lisensi Pro untuk menunggu persetujuan Admin.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    apiLogout();
    setEditingProfile(false);
    setTab("akun");
    await refreshData(null);
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
      await refreshData(res.user);
      setMsg({ type: "ok", text: "Profil akun berhasil diperbarui." });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitLicenseRequest = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!user) {
      setTab("akun");
      setMsg({
        type: "err",
        text: "Silakan masuk atau daftar akun guru terlebih dahulu sebelum mengajukan lisensi.",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await apiSubmitLicenseRequest({
        email: user.email,
        packageId: reqPackageId,
        note: reqNote,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setReqNote("");
      await refreshData(user);
      setMsg({
        type: "ok",
        text: `Pengajuan ${res.request.packageName} berhasil dikirim! Akun Anda akan otomatis aktif Pro setelah disetujui Admin.`,
      });
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
        text: "Silakan masuk atau daftar akun terlebih dahulu sebelum mengaktifkan kode lisensi.",
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
      await refreshData(res.user);
      setTab("akun");
      setMsg({
        type: "ok",
        text: `Lisensi ${res.license.key} (${res.license.planName}) berhasil diaktifkan sampai ${formatDateID(res.license.expiresAt)}.`,
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

  const handleAdminApprove = async (requestId: string) => {
    if (!user || !isAdmin) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiAdminApproveRequest({
        requestId,
        adminEmail: user.email,
        adminNote: reviewNotes[requestId] ?? "",
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      await refreshData(user);
      setMsg({
        type: "ok",
        text: `Permintaan disetujui! Akun ${res.request.userEmail} kini Pro dengan kode ${res.licenseKey}.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAdminReject = async (requestId: string) => {
    if (!user || !isAdmin) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiAdminRejectRequest({
        requestId,
        adminEmail: user.email,
        adminNote: reviewNotes[requestId] ?? "",
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      await refreshData(user);
      setMsg({
        type: "ok",
        text: `Permintaan dari ${res.request.userEmail} telah ditolak.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAdminGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setBusy(true);
    try {
      const created = await apiAdminGenerateLicenses({
        packageId: adminPkg,
        count: adminCount,
        note: adminNote,
        adminEmail: user.email,
      });
      setAdminNote("");
      await refreshData(user);
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
    if (!user || !isAdmin) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await apiRegister({
        name: newAccName,
        email: newAccEmail,
        institution: newAccInst,
        password: newAccPass,
        role: newAccRole,
        adminEmail: user.email,
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
      await refreshData(user);
      setMsg({
        type: "ok",
        text: `Akun ${res.user.email} berhasil dibuat${extra}.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (key: string) => {
    if (!user || !isAdmin) return;
    const res = await apiAdminRevokeLicense(key, user.email);
    if (!res.ok) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    await refreshData(user);
    setMsg({ type: "ok", text: `Lisensi ${key} telah dicabut.` });
  };

  const handleAdminAssignPro = async (targetEmail: string) => {
    if (!user || !isAdmin) return;
    const res = await apiAdminAssignPro({
      targetEmail,
      adminEmail: user.email,
      packageId: "yearly",
    });
    if (!res.ok) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    await refreshData(user);
    setMsg({
      type: "ok",
      text: `Akun ${targetEmail} kini Pro dengan kode ${res.license.key}.`,
    });
  };

  const handleAdminDowngrade = async (targetEmail: string) => {
    if (!user || !isAdmin) return;
    const res = await apiAdminDowngradeUser(targetEmail, user.email);
    if (!res.ok) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    await refreshData(user);
    setMsg({ type: "ok", text: `Akun ${targetEmail} dikembalikan ke paket Gratis.` });
  };

  const handleResetDemo = async () => {
    if (!window.confirm("Reset data lokal kembali ke pengaturan awal?")) return;
    await resetAllData();
    await refreshData(null);
    setTab("akun");
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
            <div
              className="muted"
              style={{
                fontSize: 13,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                marginTop: 2,
              }}
            >
              <span>Kelola akun guru &amp; pengajuan lisensi Pro</span>
              <span className={`badge ${health?.mode === "postgres" ? "status-available" : "free"}`}>
                {health?.mode === "postgres" ? "🟢 Server Postgres Aktif" : "🟡 Mode Lokal"}
              </span>
            </div>
          </div>
          <button
            className="btn sm w modal-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Tutup"
          >
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
          {isAdmin && (
            <button
              type="button"
              className={`btn sm ${tab === "admin" ? "g" : "w"}`}
              onClick={() => {
                setTab("admin");
                setMsg(null);
              }}
            >
              👑 Panel Admin{pendingRequestsCount > 0 ? ` (${pendingRequestsCount})` : ""}
            </button>
          )}
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
            <div className="subcard" style={{ maxWidth: 480, margin: "0 auto" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  className={`btn sm ${authMode === "login" ? "" : "w"}`}
                  style={{ flex: 1 }}
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
                  style={{ flex: 1 }}
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
                      placeholder="Masukkan password"
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
          )}

          {tab === "akun" && user && (
            <div className="portal-grid">
              <div className="subcard">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      <span className={`badge ${proActive ? "pro" : "free"}`}>
                        {proActive ? "⭐ PRO AKTIF" : "🌱 PAKET GRATIS"}
                      </span>
                      <span className="badge role">
                        {isAdmin ? "👑 ADMIN" : "👩‍🏫 GURU"}
                      </span>
                    </div>
                    <h3 className="px" style={{ margin: "2px 0", fontSize: 24 }}>
                      {user.name}
                    </h3>
                    <div className="mono" style={{ fontSize: 14 }}>
                      {user.email}
                    </div>
                    <div className="muted" style={{ fontSize: 14 }}>
                      🏫 {user.institution}
                    </div>
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
                  <form
                    className="form-stack"
                    onSubmit={handleSaveProfile}
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "2px dashed var(--wood2)",
                    }}
                  >
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
                      Anda bisa membuat kelas, menyusun paket soal, dan membuka ruang mabar kode 6 angka untuk <b>30–100 murid sekaligus</b>.
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
                      <button
                        type="button"
                        className="btn sm b"
                        onClick={handleDownloadCertificate}
                      >
                        📄 Unduh Bukti Lisensi
                      </button>
                      <button
                        type="button"
                        className="btn sm w"
                        onClick={() => setTab("lisensi")}
                      >
                        ➕ Perpanjang Lisensi
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {hasPendingMyRequest && (
                      <div className="alert-box ok" style={{ marginBottom: 12 }}>
                        <span>⏳</span>
                        <span>
                          Pengajuan lisensi Pro Anda sedang <b>menunggu persetujuan Admin</b>. Setelah disetujui, akun otomatis berubah menjadi Pro.
                        </span>
                      </div>
                    )}

                    <p style={{ marginTop: 0, fontSize: 14 }}>
                      Untuk mengaktifkan fitur <b>Buat Kelas &amp; Mabar 30+ Murid</b>, ajukan lisensi Pro untuk ditinjau Admin atau masukkan kode lisensi resmi dari Admin:
                    </p>
                    <form className="form-stack" onSubmit={handleActivateLicense}>
                      <label>
                        Kode Lisensi Resmi dari Admin
                        <input
                          type="text"
                          required
                          value={licenseInput}
                          onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                          placeholder="ZFARM-PRO-XXXX-XXXX"
                          className="mono"
                        />
                      </label>
                      <button className="btn g" type="submit" disabled={busy}>
                        🔓 Aktifkan Kode Lisensi
                      </button>
                    </form>
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn sm b"
                        style={{ width: "100%" }}
                        onClick={() => setTab("lisensi")}
                      >
                        📩 Ajukan Persetujuan Lisensi Pro ke Admin
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 2: PENGAJUAN & AKTIVASI LISENSI ================= */}
          {tab === "lisensi" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <form className="subcard" onSubmit={handleSubmitLicenseRequest}>
                <h3 className="px" style={{ marginTop: 0, fontSize: 22 }}>
                  📩 Ajukan Lisensi Pro (Persetujuan Admin)
                </h3>
                <p style={{ marginTop: 0, fontSize: 14 }}>
                  Pilih paket lisensi yang diinginkan lalu kirim pengajuan. <b>Admin akan meninjau dan menyetujui pengajuan Anda</b> sebelum akses Pro diaktifkan.
                </p>

                <div className="pkg-grid" style={{ marginBottom: 14 }}>
                  {LICENSE_PACKAGES.map((pkg) => {
                    const selected = reqPackageId === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        className="subcard pkg-card"
                        style={{
                          cursor: "pointer",
                          borderColor: selected ? "#4c9a2a" : "var(--wood2)",
                          background: selected ? "#eef9e4" : "#fff8e3",
                        }}
                        onClick={() => setReqPackageId(pkg.id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="badge pro">{pkg.durationDays} Hari</span>
                          {selected && <span className="badge status-available">✓ Dipilih</span>}
                        </div>
                        <h4 className="px" style={{ margin: "6px 0 2px", fontSize: 19 }}>
                          {pkg.name}
                        </h4>
                        <div style={{ fontWeight: 900, color: "#8a3d12", marginBottom: 6 }}>
                          {pkg.priceLabel}
                        </div>
                        <p style={{ margin: 0, fontSize: 13 }}>{pkg.description}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="form-stack">
                  <label>
                    Catatan / No. WhatsApp / Info Sekolah (untuk verifikasi Admin)
                    <input
                      type="text"
                      required
                      value={reqNote}
                      onChange={(e) => setReqNote(e.target.value)}
                      placeholder="Contoh: WA 0812xxxx - Guru Kelas 5 SDN 1 Malang"
                    />
                  </label>
                  <button
                    className="btn g"
                    type="submit"
                    disabled={busy || hasPendingMyRequest}
                  >
                    {!user
                      ? "🔐 Masuk / Daftar untuk Mengajukan"
                      : hasPendingMyRequest
                        ? "⏳ Pengajuan Sebelumnya Masih Menunggu Admin"
                        : "📩 Kirim Pengajuan Lisensi ke Admin"}
                  </button>
                </div>
              </form>

              {user && myRequests.length > 0 && (
                <div className="subcard">
                  <h3 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                    📋 Status Pengajuan Lisensi Saya
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {myRequests.map((r) => (
                      <div className="avail-item" key={r.id}>
                        <div>
                          <b>{r.packageName}</b>{" "}
                          <span
                            className={`badge ${
                              r.status === "approved"
                                ? "status-available"
                                : r.status === "rejected"
                                  ? "status-revoked"
                                  : "pro"
                            }`}
                          >
                            {r.status === "pending"
                              ? "⏳ Menunggu Admin"
                              : r.status === "approved"
                                ? "✅ Disetujui"
                                : "❌ Ditolak"}
                          </span>
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            Diajukan: {formatDateID(r.createdAt)}
                            {r.note ? ` · ${r.note}` : ""}
                          </div>
                          {r.adminNote && (
                            <div style={{ fontSize: 12.5, marginTop: 2 }}>
                              <b>Catatan Admin:</b> {r.adminNote}
                            </div>
                          )}
                          {r.approvedLicenseKey && (
                            <div className="mono" style={{ fontSize: 12.5, marginTop: 2, fontWeight: 900 }}>
                              Kode Aktif: {r.approvedLicenseKey}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="subcard">
                <h3 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                  🔓 Sudah Menerima Kode Lisensi dari Admin?
                </h3>
                <form className="inline-activate" onSubmit={handleActivateLicense}>
                  <input
                    type="text"
                    required
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                    placeholder="Masukkan kode lisensi resmi dari Admin"
                    className="mono"
                  />
                  <button className="btn g" type="submit" disabled={busy}>
                    {user ? "🔓 Aktifkan Kode" : "🔐 Masuk & Aktifkan"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ================= TAB 3: PANEL ADMIN (HANYA UNTUK ADMIN) ================= */}
          {tab === "admin" && isAdmin && user && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="stats-grid">
                <div className="stat-box">
                  <span className="muted">Menunggu Persetujuan</span>
                  <b className="px" style={{ color: "#c9621f" }}>
                    {stats.pendingReq}
                  </b>
                </div>
                <div className="stat-box">
                  <span className="muted">Total Akun</span>
                  <b className="px">{stats.totalUsers}</b>
                </div>
                <div className="stat-box">
                  <span className="muted">Akun Pro Aktif</span>
                  <b className="px" style={{ color: "#2d7a16" }}>
                    {stats.proUsers}
                  </b>
                </div>
                <div className="stat-box">
                  <span className="muted">Kode Tersedia</span>
                  <b className="px">{stats.availLic}</b>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`btn sm ${adminSection === "requests" ? "" : "w"}`}
                    onClick={() => setAdminSection("requests")}
                  >
                    📩 Persetujuan ({pendingRequestsCount})
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${adminSection === "licenses" ? "" : "w"}`}
                    onClick={() => setAdminSection("licenses")}
                  >
                    🔑 Lisensi ({licenses.length})
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${adminSection === "users" ? "" : "w"}`}
                    onClick={() => setAdminSection("users")}
                  >
                    👥 Akun ({users.length})
                  </button>
                </div>
                {health?.mode !== "postgres" && (
                  <button type="button" className="btn sm w" onClick={handleResetDemo}>
                    🔄 Reset Data Lokal
                  </button>
                )}
              </div>

              {adminSection === "requests" && (
                <div className="subcard">
                  <h3 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                    📩 Daftar Pengajuan Persetujuan Lisensi
                  </h3>
                  {allRequests.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      Belum ada pengajuan lisensi dari guru.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {allRequests.map((req) => (
                        <div className="demo-box" key={req.id} style={{ marginTop: 0, alignItems: "stretch", flexDirection: "column" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div>
                              <b>{req.userName}</b>{" "}
                              <span className="mono" style={{ fontSize: 12 }}>
                                ({req.userEmail})
                              </span>
                              <div className="muted" style={{ fontSize: 12 }}>
                                🏫 {req.institution} · 📦 <b>{req.packageName}</b> ({req.durationDays} hari)
                              </div>
                              {req.note && (
                                <div style={{ fontSize: 13, marginTop: 4 }}>
                                  📝 <b>Catatan Pemohon:</b> {req.note}
                                </div>
                              )}
                            </div>
                            <span
                              className={`badge ${
                                req.status === "approved"
                                  ? "status-available"
                                  : req.status === "rejected"
                                    ? "status-revoked"
                                    : "pro"
                              }`}
                              style={{ alignSelf: "flex-start" }}
                            >
                              {req.status === "pending"
                                ? "⏳ MENUNGGU"
                                : req.status === "approved"
                                  ? "✅ DISETUJUI"
                                  : "❌ DITOLAK"}
                            </span>
                          </div>

                          {req.status === "pending" ? (
                            <div className="inline-activate" style={{ marginTop: 8 }}>
                              <input
                                type="text"
                                value={reviewNotes[req.id] ?? ""}
                                onChange={(e) =>
                                  setReviewNotes((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value,
                                  }))
                                }
                                placeholder="Catatan admin (opsional, mis. 'Pembayaran terverifikasi')"
                              />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn sm g"
                                  disabled={busy}
                                  onClick={() => handleAdminApprove(req.id)}
                                >
                                  ✅ Setujui &amp; Aktifkan Pro
                                </button>
                                <button
                                  type="button"
                                  className="btn sm danger"
                                  disabled={busy}
                                  onClick={() => handleAdminReject(req.id)}
                                >
                                  ❌ Tolak
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="muted" style={{ fontSize: 12 }}>
                              Diproses oleh {req.reviewedBy} · {formatDateID(req.reviewedAt)}
                              {req.approvedLicenseKey ? ` · Kode: ${req.approvedLicenseKey}` : ""}
                              {req.adminNote ? ` · "${req.adminNote}"` : ""}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {adminSection === "licenses" && (
                <>
                  <form className="subcard" onSubmit={handleAdminGenerate}>
                    <h3 className="px" style={{ marginTop: 0, fontSize: 20 }}>
                      ⚡ Terbitkan Kode Lisensi Manual (Khusus Admin)
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
                        Catatan / Nama Penerima
                        <input
                          type="text"
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Contoh: Ibu Rina - SMAN 3"
                        />
                      </label>
                      <button
                        className="btn g"
                        type="submit"
                        disabled={busy}
                        style={{ alignSelf: "flex-end" }}
                      >
                        ⚡ Terbitkan
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
                              <td className="mono" style={{ fontWeight: 800 }}>
                                {lic.key}
                              </td>
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
              )}

              {adminSection === "users" && (
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
