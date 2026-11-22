import { useEffect, useState, type FormEvent } from "react";
import GameWorkspace, { type WorkspaceView } from "./components/GameWorkspace";
import PortalModal, { type PortalTab } from "./components/PortalModal";
import { isProActive, type UserAccount } from "./lib/authLicenseStore";
import {
  apiGetCurrentUser,
  checkBackendHealth,
  type BackendHealth,
} from "./lib/gameApi";

const features = [
  { ic: "🌱", t: "Kebun Ilmu", d: <>Cangkul, tanam, lalu "siram" tanaman dengan menjawab soal. Tiga kali benar = panen! Tiap bibit mewakili satu mapel.</> },
  { ic: "📖", t: "Perpustakaan Desa", d: <>Materi teks, gambar, dan video YouTube dipelajari langsung di dalam game, sebelum atau sesudah menjawab soal.</> },
  { ic: "⚔️", t: "Mabar Satu Kelas", d: <>Puluhan murid main bersama secara realtime di arena. Masuk cukup dengan <b>kode 6 angka</b> atau <b>link</b>, seperti Quizizz.</> },
  { ic: "👩‍🏫", t: "Guru Ikut Masuk", d: <>Guru memantau murid secara langsung di peta arena, mengirim pengumuman, menjeda, dan mengakhiri sesi kapan saja.</> },
  { ic: "📝", t: "Mode Asesmen", d: <>Pakai game untuk Asesmen Harian, PTS, atau PAS. Tiap soal dijawab sekali, nilai = benar ÷ jumlah soal, kunci disembunyikan.</> },
  { ic: "📊", t: "Nilai & Analisis", d: <>Rekap nilai otomatis, ketuntasan KKM, dan analisis akurasi tiap butir soal. Unduh <b>CSV / Excel</b> sekali klik.</> },
  { ic: "🐄", t: "Kebun Makin Hidup", d: <>Tanam &amp; panen 6 petak kebun ilmu langsung di dalam game. Setiap jawaban benar menumbuhkan hasil panen dan bonus skor.</> },
  { ic: "🧩", t: "Ragam Soal", d: <>Pilihan ganda (A–D), benar/salah, dan isian singkat, lengkap dengan pembahasan serta ringkasan materi.</> },
  { ic: "🏢", t: "Bukan Cuma Sekolah", d: <>Bisa untuk <b>kampus</b> (dosen & mahasiswa) dan <b>pelatihan perusahaan</b> (fasilitator & peserta): pre-test/post-test, K3, onboarding karyawan.</> },
  { ic: "👥", t: "Siap 30–100 Pemain", d: <>Ditenagai API serverless Vercel + database PostgreSQL sehingga satu kelas penuh (30–100 murid) bisa bergabung bersamaan lintas perangkat.</> },
];

const modes = [
  { t: "🌱 Kebun Ilmu", d: <>Setiap jawaban benar menumbuhkan bibit hingga panen di 6 petak kebunmu. Setiap 2 jawaban benar menghasilkan 1 panen + bonus poin!</> },
  { t: "⚔️ Arena Berburu Peti", d: <>Semua karakter murid tampil di peta arena live. Jawab soal secepat mungkin untuk meraih bonus kecepatan dan merebut mahkota #1!</> },
  { t: "📝 Mode Asesmen (Ulangan)", d: <>Tiap soal dijawab sekali, kunci disembunyikan selama ujian, lalu sistem menghitung nilai 0–100 dan ketuntasan KKM otomatis.</> },
  { t: "📊 Layar Pantau Guru & Excel", d: <>Guru melihat semua 30+ murid di lobby &amp; arena, kirim pengumuman live, cek analisis butir soal, lalu unduh rekap nilai CSV/Excel.</> },
];

const flow = ["🏟️ Lobby", "▶ Guru Mulai", "🚪 Gerbang Terbuka", "🎁 Jawab & Kumpulkan Skor", "🏆 Podium & Nilai"];

const teacherPoints = [
  <><b>Buat Kelas &amp; Ruang Mabar</b>: kelola daftar kelas dan buka ruang kode 6 angka untuk 30–100 murid sekaligus.</>,
  <><b>Buat Paket Soal Sendiri</b>: susun soal Pilihan Ganda, Benar/Salah, atau Isian lengkap dengan materi ringkas.</>,
  <><b>Paket Gratis siap pakai</b>: paket contoh Matematika SD, IPA SMP, dan Wawasan Nusantara langsung bisa dimainkan.</>,
  <><b>Pengaturan durasi &amp; KKM</b>: atur durasi permainan, batas KKM, dan kapasitas murid per sesi.</>,
  <><b>Pantau live di peta arena</b>: lihat siapa sudah masuk, skor, panen, dan progres soal tiap murid.</>,
  <><b>Kontrol kelas penuh</b>: mulai, jeda, akhiri sesi, dan kirim pengumuman ke layar semua murid.</>,
  <><b>Rekap nilai otomatis</b>: analisis akurasi butir soal + tombol unduh rekap Excel (CSV) siap cetak.</>,
];

const freePlan: [React.ReactNode, boolean][] = [
  ["Main ZuperFarm Solo dengan paket contoh", true],
  ["Buat soal & materi sendiri", true],
  ["Mainkan paket buatanmu sendiri", true],
  ["Gabung sesi kelas dengan kode 6 angka", true],
  ["Buat Kelas & buka ruang kode 6 angka", false],
  ["Sesi live mabar 30–100 murid & asesmen", false],
  ["Dashboard pantau guru, analisis butir & unduh Excel", false],
];

const proPlan = [
  <>Semua fitur Gratis</>,
  <><b>Buat Kelas</b> &amp; kelola daftar kelas sendiri</>,
  <><b>Kode 6 angka &amp; link join</b> untuk 30–100 murid bersamaan</>,
  <><b>3 Mode Mabar</b>: Kebun Ilmu, Arena Live, &amp; Asesmen</>,
  <><b>Kontrol Guru Live</b>: mulai, jeda, akhiri, &amp; kirim pesan</>,
  <><b>Peta Arena Realtime</b> + Papan Peringkat &amp; Podium</>,
  <><b>Analisis butir soal</b> + ketuntasan KKM otomatis</>,
  <><b>Unduh Rekap Nilai Excel (CSV)</b> sekali klik</>,
];

const faqs = [
  ["Apakah bisa dimainkan 30 murid sekaligus?", <>Bisa! Aplikasi ini dirancang mendukung <b>30 hingga 100 murid bersamaan</b> dalam satu sesi melalui API Vercel + database PostgreSQL. Cukup tambahkan variabel <code>DATABASE_URL</code> (mis. Neon Postgres) di pengaturan Vercel untuk sinkronisasi lintas HP/laptop.</>],
  ["Bagaimana murid masuk ke sesi?", <>Guru membagikan <b>kode 6 angka</b> atau <b>link join</b> (<code>?join=123456</code>). Murid cukup mengetik nama dan memilih karakter, lalu langsung masuk lobby tanpa perlu akun.</>],
  ["Bagaimana cara membuka fitur Buat Kelas (Pro)?", <>Masuk menggunakan akun Pro (mis. <code>admin@zuperfarm.local</code> / <code>admin123</code>) atau daftar akun guru baru lalu aktifkan kode lisensi yang tersedia di menu <b>🔑 Lisensi</b>. Setelah Pro aktif, fitur <b>Buat Kelas &amp; Mabar</b> langsung terbuka!</>],
  ["Bisakah dipakai untuk ulangan / asesmen?", <>Bisa. Pilih mode <b>Asesmen</b> saat membuka ruang. Tiap soal dijawab sekali, kunci disembunyikan selama pengerjaan, dan nilai serta status KKM otomatis direkap untuk diunduh ke Excel (CSV).</>],
  ["Bagaimana cara mengaktifkan mode database lintas perangkat di Vercel?", <>Buat database PostgreSQL gratis (mis. di Neon), salin connection string-nya ke Environment Variable <code>DATABASE_URL</code> di project Vercel <code>belajar-aplikasi</code>, lalu redeploy. Tabel database akan dibuat otomatis saat pertama kali dibuka.</>],
];

export default function App() {
  const [code, setCode] = useState("");
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalTab, setPortalTab] = useState<PortalTab>("akun");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("solo");
  const [workspaceJoinCode, setWorkspaceJoinCode] = useState("");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);

  const syncUser = async () => {
    const u = await apiGetCurrentUser();
    setCurrentUser(u);
  };

  useEffect(() => {
    let alive = true;
    checkBackendHealth().then(async (h) => {
      if (!alive) return;
      setHealth(h);
      const u = await apiGetCurrentUser();
      if (alive) setCurrentUser(u);
    });

    // Support direct join links: ?join=123456
    try {
      const params = new URLSearchParams(window.location.search);
      const join = (params.get("join") ?? "").replace(/\D/g, "").slice(0, 6);
      if (join.length === 6) {
        setCode(join);
        setWorkspaceJoinCode(join);
        setWorkspaceView("student_join");
        setWorkspaceOpen(true);
      }
    } catch {
      // ignore
    }

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  useEffect(() => {
    const isOpen = portalOpen || workspaceOpen;
    document.body.classList.toggle("modal-open", isOpen);
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [portalOpen, workspaceOpen]);

  const openPortal = (tab: PortalTab) => {
    setWorkspaceOpen(false);
    setPortalTab(tab);
    setPortalOpen(true);
  };

  const openWorkspace = (view: WorkspaceView, joinCode = "") => {
    setPortalOpen(false);
    setWorkspaceView(view);
    if (joinCode) setWorkspaceJoinCode(joinCode);
    setWorkspaceOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = code.trim().replace(/\D/g, "").slice(0, 6);
    if (!v) return;
    openWorkspace("student_join", v);
  };

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try {
      await installEvt.userChoice;
    } catch {}
    setInstallEvt(null);
  };

  const proActive = isProActive(currentUser);

  return (
    <>
      <nav>
        <div className="wrap">
          <a className="logo" href="#">
            <img src="/icon-192.png" alt="" />
            Zuper<span>Farm</span>
          </a>
          <div className="links">
            <a href="#fitur">Fitur</a>
            <a href="#mabar">Mode Mabar</a>
            <a href="#guru">Untuk Guru</a>
            <a href="#harga">Harga</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-actions">
            <button
              type="button"
              className="btn sm g"
              onClick={() => openWorkspace("classes")}
            >
              🏫 Kelas
            </button>
            <button
              type="button"
              className="btn sm b nav-lic-btn"
              onClick={() => openPortal("lisensi")}
            >
              🔑 Lisensi
            </button>
            <button
              type="button"
              className={`btn sm ${proActive ? "g" : "w"}`}
              onClick={() => openPortal("akun")}
            >
              {currentUser
                ? `${proActive ? "⭐" : "👤"} ${currentUser.name.split(" ")[0]}`
                : "👩‍🏫 Masuk"}
            </button>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="cloud" style={{ top: 40, width: 110, animation: "drift 60s linear infinite" }} />
        <div className="cloud" style={{ top: 110, width: 80, animation: "drift 85s linear infinite -30s" }} />
        <div className="wrap">
          <div>
            <h1>
              Belajar sambil <b>bertani</b> &amp; <b>berpetualang</b> bareng satu kelas!
            </h1>
            <p className="lead">
              ZuperFarm adalah game belajar bergaya pixel-art untuk <b>SD sampai SMA/SMK</b>. Murid menanam, memanen, dan berburu peti ilmu dengan <b>menjawab soal</b>. Guru membuat kelas &amp; soal, memantau hingga <b>30–100 murid</b> secara langsung, lalu mengunduh <b>nilai dan analisisnya</b> otomatis.
            </p>
            <div className="cta">
              <button type="button" className="btn g" onClick={() => openWorkspace("solo")}>
                🎮 Main Sekarang — Gratis
              </button>
              <button type="button" className="btn" onClick={() => openWorkspace("packs")}>
                ✏️ Buat Soal Sendiri
              </button>
              <button type="button" className="btn b" onClick={() => openWorkspace("classes")}>
                🏫 Buat Kelas &amp; Mabar
              </button>
            </div>
            {currentUser && (
              <div className="wood account-banner">
                <div>
                  <span className={`badge ${proActive ? "pro" : "free"}`} style={{ marginRight: 8 }}>
                    {proActive ? "⭐ PRO AKTIF" : "🌱 GRATIS"}
                  </span>
                  <b>{currentUser.name}</b>{" "}
                  <span className="muted">({currentUser.email})</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {proActive && (
                    <button
                      type="button"
                      className="btn sm g"
                      onClick={() => openWorkspace("classes")}
                    >
                      🏫 Buka Kelas
                    </button>
                  )}
                  <button type="button" className="btn sm w" onClick={() => openPortal("akun")}>
                    Akun ▸
                  </button>
                </div>
              </div>
            )}
            <form className="join wood" onSubmit={submit}>
              <label>🔑 Punya kode 6 angka dari guru? Ketik di sini:</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
                placeholder="123456"
                autoComplete="off"
                aria-label="Kode main"
              />
              <button className="btn g" type="submit">Masuk ▸</button>
            </form>
          </div>
          <div>
            <img className="shot" src="/shot-farm.png" alt="Tampilan ZuperFarm: desa, kebun, dan tokoh guru" />
          </div>
        </div>
      </header>

      <section id="fitur">
        <div className="wrap">
          <h2 className="t">🌾 Satu game, banyak cara belajar</h2>
          <p className="sub">
            Mapel dan jenjang bebas: guru tinggal mengisi materi dan soal langsung di aplikasi ini. Bisa dimainkan di <b>laptop maupun HP</b> untuk 30+ murid sekaligus.
          </p>
          <div className="grid">
            {features.map((f) => (
              <div className="card wood" key={f.t}>
                <p className="ic">{f.ic}</p>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="mabar" className="band">
        <div className="wrap">
          <h2 className="t">⚔️ Mode Mabar, seru satu kelas (30–100 murid)</h2>
          <p className="sub">
            Semua murid berkumpul di lobby pakai kode 6 angka. Saat guru menekan <b>Mulai</b>, gerbang terbuka dan petualangan dimulai. Yang menang adalah yang paling banyak menjawab dengan benar dan cepat!
          </p>
          <div className="flow">
            {flow.map((f, i) => (
              <span key={f} style={{ display: "contents" }}>
                <div className="wood">{f}</div>
                {i < flow.length - 1 && <i>➜</i>}
              </span>
            ))}
          </div>
          <div className="two">
            <img className="shot" src="/shot-arena.png" alt="Arena mabar ZuperFarm dengan peti soal dan murid" />
            <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
              {modes.map((m) => (
                <div className="card wood" key={m.t}>
                  <h3>{m.t}</h3>
                  <p>{m.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="guru">
        <div className="wrap">
          <div className="two">
            <div>
              <h2 className="t" style={{ textAlign: "left" }}>👩‍🏫 Tetap terukur &amp; terkondisikan</h2>
              <ul className="chk" style={{ fontSize: 17 }}>
                {teacherPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <p>
                {["SD", "SMP", "SMA", "SMK", "Semua mapel", "30–100 Murid", "Laptop & HP"].map((p) => (
                  <span className="pill" key={p}>{p}</span>
                ))}
              </p>
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn g" onClick={() => openWorkspace("classes")}>
                  🏫 Buka Ruang Kelas &amp; Mabar
                </button>
                <button type="button" className="btn w" onClick={() => openWorkspace("packs")}>
                  ✏️ Kelola Paket Soal
                </button>
              </div>
            </div>
            <img className="shot" src="/shot-dash.png" alt="Dashboard analisis nilai guru" />
          </div>
        </div>
      </section>

      <section id="harga" className="band">
        <div className="wrap">
          <h2 className="t">⭐ Gratis untuk mencoba, Pro untuk kelas</h2>
          <p className="sub">
            Coba main solo &amp; buat soal gratis. Saat siap membuat kelas dan membuka ruang mabar 30+ murid, aktifkan lisensi Pro langsung di web ini.
          </p>
          <div className="price">
            <div className="plan wood">
              <h3>Gratis</h3>
              <div className="tag">Tanpa akun · langsung pakai</div>
              <ul className="chk">
                {freePlan.map(([t, ok], i) => (
                  <li key={i} className={ok ? "" : "no"}>{t}</li>
                ))}
              </ul>
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn g" onClick={() => openWorkspace("solo")}>
                  🎮 Main Solo
                </button>
                <button type="button" className="btn w" onClick={() => openWorkspace("packs")}>
                  ✏️ Buat Soal
                </button>
              </div>
            </div>
            <div className="plan wood pro">
              <div className="ribbon">PRO KELAS</div>
              <h3>Pro</h3>
              <div className="tag">Buat Kelas + Mabar 30–100 Murid</div>
              <ul className="chk">
                {proPlan.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn g" onClick={() => openPortal("lisensi")}>
                  🔑 Aktivasi / Buat Lisensi
                </button>
                <button type="button" className="btn b" onClick={() => openWorkspace("classes")}>
                  🏫 Buka Kelas Pro
                </button>
              </div>
            </div>
          </div>

          <h3 className="px" style={{ textAlign: "center", fontSize: 24, marginTop: 34 }}>Cara aktivasi Pro</h3>
          <div className="steps">
            <div className="wood">
              <b>Buat / Ambil lisensi</b><br />
              melalui <button type="button" className="link-btn" onClick={() => openPortal("lisensi")}>halaman lisensi</button>.
            </div>
            <div className="wood">
              <b>Daftar / Masuk akun guru</b><br />
              di <button type="button" className="link-btn" onClick={() => openPortal("akun")}>portal akun guru</button>.
            </div>
            <div className="wood">
              <b>Masukkan kode lisensi</b><br />
              di Dashboard Akun atau kelola via <button type="button" className="link-btn" onClick={() => openPortal("admin")}>Panel Admin</button>.
            </div>
            <div className="wood">
              <b>Langsung Buat Kelas!</b><br />
              buka <button type="button" className="link-btn" onClick={() => openWorkspace("classes")}>Ruang Kelas &amp; Mabar</button> untuk 30+ murid.
            </div>
          </div>
        </div>
      </section>

      <section id="pasang">
        <div className="wrap" style={{ textAlign: "center" }}>
          <h2 className="t">📲 Pasang sebagai aplikasi, layar penuh</h2>
          <p className="sub">
            Pasang ZuperFarm di laptop atau HP. Saat dibuka dari aplikasi, game tampil nyaman di layar penuh baik untuk guru maupun murid.
          </p>
          {installEvt && (
            <button className="btn g" onClick={install} style={{ marginBottom: 14 }}>📲 Pasang ZuperFarm</button>
          )}
          <p className="muted">
            Di Chrome/Edge laptop: klik ikon <b>Pasang</b> (⊕) di ujung kanan bilah alamat. Di HP Android: menu ⋮ ➜ <b>Tambahkan ke layar utama</b>. Di iPhone: tombol Bagikan ➜ <b>Tambah ke Layar Utama</b>.
          </p>
        </div>
      </section>

      <section id="faq" className="band">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <h2 className="t">❓ Pertanyaan umum</h2>
          {faqs.map(([q, a]) => (
            <details className="wood" key={q as string}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="logo" style={{ justifyContent: "center" }}>
            <img src="/icon-192.png" alt="" />
            Zuper<span>Farm</span>
          </div>
          <p>
            Ekosistem Game Belajar Kelas · Status Server:{" "}
            <b>
              {health?.mode === "postgres"
                ? "🟢 PostgreSQL Aktif (Multi-Perangkat)"
                : "🟡 Mode Lokal (Siap Dihubungkan ke Postgres)"}
            </b>
          </p>
          <p className="footer-actions">
            <button type="button" className="footer-link" onClick={() => openWorkspace("classes")}>
              🏫 Buat Kelas &amp; Mabar
            </button>{" "}
            ·{" "}
            <button type="button" className="footer-link" onClick={() => openPortal("akun")}>
              👩‍🏫 Portal Akun Guru
            </button>{" "}
            ·{" "}
            <button type="button" className="footer-link" onClick={() => openPortal("lisensi")}>
              🔑 Aktivasi Lisensi
            </button>{" "}
            ·{" "}
            <button type="button" className="footer-link" onClick={() => openPortal("admin")}>
              👑 Panel Admin
            </button>
          </p>
        </div>
      </footer>

      <button
        type="button"
        className="wa"
        onClick={() => openWorkspace(proActive ? "classes" : "solo")}
      >
        {proActive ? "🏫 Kelas & Mabar" : "🎮 Main / Kelas"}
      </button>

      <PortalModal
        open={portalOpen}
        initialTab={portalTab}
        user={currentUser}
        health={health}
        onClose={() => setPortalOpen(false)}
        onAuthChange={syncUser}
        onOpenClassroom={() => openWorkspace("classes")}
      />

      <GameWorkspace
        open={workspaceOpen}
        initialView={workspaceView}
        initialJoinCode={workspaceJoinCode}
        user={currentUser}
        health={health}
        onClose={() => setWorkspaceOpen(false)}
        onOpenPortal={openPortal}
      />
    </>
  );
}
