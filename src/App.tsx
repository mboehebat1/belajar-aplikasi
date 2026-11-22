import { useEffect, useState, type FormEvent } from "react";

const ORIGIN = "https://zuperfarm.schoolpedia.id";
const PLAY = (hash: string) => `${ORIGIN}/play.html#${hash}`;
const LICENSE = "http://lynk.id/alizaenal22/dv1rorojmmj4";
const WA = "https://wa.me/6282266268008";

const features = [
  { ic: "🌱", t: "Kebun Ilmu", d: <>Cangkul, tanam, lalu "siram" tanaman dengan menjawab soal. Tiga kali benar = panen! Tiap bibit mewakili satu mapel.</> },
  { ic: "📖", t: "Perpustakaan Desa", d: <>Materi teks, gambar, dan video YouTube dipelajari langsung di dalam game, sebelum atau sesudah menjawab soal.</> },
  { ic: "⚔️", t: "Mabar Satu Kelas", d: <>Puluhan murid main bersama secara realtime di arena. Masuk cukup dengan <b>kode 6 angka</b> atau <b>link</b>, seperti Quizizz.</> },
  { ic: "👩‍🏫", t: "Guru Ikut Masuk", d: <>Guru tampil sebagai karakter di arena, memantau murid secara langsung, mengirim pesan, menjeda, dan mengumpulkan murid tanpa ikut mengerjakan soal.</> },
  { ic: "📝", t: "Mode Asesmen", d: <>Pakai game untuk Asesmen Harian, PTS, atau PAS. Tiap soal dijawab sekali, nilai = benar ÷ jumlah soal, kunci disembunyikan.</> },
  { ic: "📊", t: "Nilai & Analisis", d: <>Rekap nilai, ketuntasan KKM, sebaran nilai, tingkat kesukaran, daya pembeda, dan pengecoh. Unduh <b>Excel & PDF</b>.</> },
  { ic: "🐄", t: "Kebun Makin Hidup", d: <>Musim hujan & kemarau, cuaca harian, kandang ayam/bebek/kambing/sapi, hiasan kebun, butik baju, dan <b>lencana koleksi</b>. Semua digerakkan dengan menjawab soal.</> },
  { ic: "🧩", t: "Ragam Soal", d: <>Pilihan ganda, PG kompleks, benar/salah, isian, <b>menjodohkan</b>, <b>mengurutkan</b>, plus soal bergambar & bersuara (link Google Drive bisa).</> },
  { ic: "🏢", t: "Bukan Cuma Sekolah", d: <>Bisa untuk <b>kampus</b> (dosen & mahasiswa) dan <b>pelatihan perusahaan</b> (fasilitator & peserta): pre-test/post-test, K3, onboarding karyawan. Istilah, rekap, dan sertifikat menyesuaikan.</> },
  { ic: "🔁", t: "Ulang Soal Salah & PR", d: <>Soal yang salah otomatis diulang di hari berbeda sampai dikuasai. Guru bisa memberi <b>PR berjadwal</b> dan memantau siapa yang sudah tuntas.</> },
];

const modes = [
  { t: "🌀 Berburu Peti + Zona", d: <>Peti soal tersebar di arena dan zona aman menyempit tiap tahap, seperti di Free Fire atau PUBG. Di luar zona, skor berkurang. Cepat, seru, penuh strategi.</> },
  { t: "🧭 Jelajah Skor", d: <>Jelajahi arena, buka peti, kumpulkan poin sebanyak-banyaknya sebelum waktu habis. Cocok untuk latihan santai.</> },
  { t: "🏁 Balapan Gerbang", d: <>Lintasan dengan gerbang bertingkat yang hanya terbuka jika soal dijawab benar. Siapa yang pertama sampai di garis finis?</> },
  { t: "👾 Boss Raid & Mode Tim", d: <>Satu kelas bekerja sama mengalahkan monster dengan jawaban benar, atau bertanding 2–4 tim. Ada peti emas berisi power-up dan <b>Layar Proyektor</b> untuk ditampilkan di depan kelas.</> },
];

const flow = ["🏟️ Lobby", "▶ Guru Mulai", "🚪 Gerbang Terbuka", "🎁 Jawab & Kumpulkan Skor", "🏆 Podium & Nilai"];

const teacherPoints = [
  <><b>Paket Saya</b>: simpan paket soal, mainkan lagi kapan saja, dan lihat riwayat hasilnya.</>,
  <><b>Buat soal cepat dengan AI</b>: isi tujuan pembelajaran, salin perintah ke ChatGPT/Gemini/Claude, tempel jawabannya — langsung jadi paket. Bisa juga tulis manual.</>,
  <><b>Paket Gratis siap pakai</b>: materi ringkas + soal untuk SD, SMP, SMA, dan SMK.</>,
  <><b>Pengaturan skor</b>: durasi, poin, bonus kecepatan, pengurangan salah, KKM, acak soal & opsi.</>,
  <><b>Pantau realtime</b>: siapa online, skor, progres tiap murid, peta mini, ikuti kamera murid.</>,
  <><b>Kelas</b>: progres kebun tiap murid tersimpan, pengumuman, analisis per mapel.</>,
  <><b>Rekap otomatis</b>: Excel (3 lembar) dan PDF siap cetak, lengkap dengan analisis butir.</>,
];

const freePlan: [React.ReactNode, boolean][] = [
  ["Main ZuperFarm dengan paket contoh", true],
  ["Buat soal & materi sendiri (tersimpan di perangkat)", true],
  ["Mainkan paket buatanmu sendiri", true],
  ["Riwayat & hasil latihan di perangkat", true],
  ["Bagikan ke murid lewat kode/link", false],
  ["Sesi live mabar, kelas, asesmen", false],
  ["Dashboard nilai, analisis, Excel & PDF", false],
];

const proPlan = [
  <>Semua fitur Gratis</>,
  <><b>Kode & link main</b>: murid langsung masuk lobby</>,
  <><b>Sesi live</b> 3 mode mabar, guru ikut masuk & memantau</>,
  <><b>Mode asesmen</b> Harian/PTS/PAS + pengaturan skor</>,
  <><b>Kelas</b> dengan progres murid tersimpan</>,
  <><b>Paket Saya</b> di cloud + riwayat sesi</>,
  <><b>Dashboard nilai</b>, analisis butir, unduh <b>Excel & PDF</b></>,
  <><b>PR berjadwal</b>, sertifikat juara PDF, layar proyektor</>,
];

const faqs = [
  ["Apakah bisa dimainkan banyak murid sekaligus?", <>Bisa. Satu sesi live menampung hingga 120 pemain. Semua murid saling terlihat di arena, dan guru bisa ikut masuk untuk memantau.</>],
  ["Bagaimana murid masuk ke sesi?", <>Guru membagikan <b>kode 6 angka</b>, <b>link</b>, atau <b>QR</b>. Murid membuka link (atau mengetik kode di halaman ini), menulis nama, lalu langsung masuk lobby. Tidak perlu akun.</>],
  ["Bisakah dipakai untuk ulangan / asesmen?", <>Bisa. Pilih jenis Asesmen Harian, PTS, PAS, atau nama asesmen sendiri. Tiap soal hanya dijawab sekali, kunci disembunyikan, dan nilai dihitung otomatis lengkap dengan KKM dan analisis butir soal.</>],
  ["Bagaimana cara membuat soal dengan AI?", <>Buka <b>Buat Soal → ➕ Paket Baru → 🤖 Buat dengan AI</b>. Isi jenjang, kelas, mapel, dan tujuan pembelajaran, pilih bentuk soal, lalu klik tombol ChatGPT, Gemini, atau Claude. Perintahnya otomatis tersalin — tinggal tempel di AI, kirim, salin jawabannya, dan tempel kembali di ZuperFarm. Paket langsung jadi.</>],
  ["Apakah materi bisa berisi video YouTube?", <>Bisa. Tempel link YouTube di materi, dan video diputar langsung di Perpustakaan Desa di dalam game.</>],
  ["Apakah perlu internet?", <>Mode Gratis tetap bisa dibuka saat sinyal lemah setelah pernah dibuka sekali. Sesi live dan kelas membutuhkan internet. Progres murid di kelas disimpan sementara dan dikirim saat koneksi kembali.</>],
];

export default function App() {
  const [code, setCode] = useState("");
  const [installEvt, setInstallEvt] = useState<any>(null);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = code.trim().toUpperCase().replace(/\s/g, "");
    if (!v) return;
    window.location.href = /^\d{6}$/.test(v)
      ? `${ORIGIN}/main/${v}`
      : `${ORIGIN}/play.html?kelas=${encodeURIComponent(v)}`;
  };

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try {
      await installEvt.userChoice;
    } catch {}
    setInstallEvt(null);
  };

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
          <a className="btn sm w" href={PLAY("guru")} style={{ marginLeft: "auto" }}>
            👩‍🏫 Masuk Guru
          </a>
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
              ZuperFarm adalah game belajar bergaya pixel-art untuk <b>SD sampai SMA/SMK</b>. Murid menanam, memanen, dan berburu peti ilmu dengan <b>menjawab soal</b>. Guru menyiapkan materi &amp; soal, memantau permainan secara langsung, lalu mendapat <b>nilai dan analisisnya</b> secara otomatis.
            </p>
            <div className="cta">
              <a className="btn g" href={PLAY("main")}>🎮 Main Sekarang — Gratis</a>
              <a className="btn" href={PLAY("buat")}>✏️ Buat Soal Sendiri</a>
              <a className="btn b" href="#harga">⭐ Versi Pro</a>
            </div>
            <form className="join wood" onSubmit={submit}>
              <label>🔑 Punya kode dari guru? Ketik di sini:</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={8}
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
            Mapel dan jenjang bebas: guru tinggal mengisi materi dan soal (manual atau dengan bantuan AI). Bisa dimainkan di <b>laptop maupun HP</b>.
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
          <h2 className="t">⚔️ Mode Mabar, ala battle royale tapi edukatif</h2>
          <p className="sub">
            Semua murid berkumpul di lobby. Saat guru menekan <b>Mulai</b>, gerbang terbuka dan petualangan dimulai. Tidak ada saling serang: yang menang adalah yang paling banyak menjawab dengan benar dan cepat.
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
                {["SD", "SMP", "SMA", "SMK", "Semua mapel", "Laptop & HP", "Kurikulum Merdeka"].map((p) => (
                  <span className="pill" key={p}>{p}</span>
                ))}
              </p>
            </div>
            <img className="shot" src="/shot-dash.png" alt="Dashboard analisis nilai guru" />
          </div>
        </div>
      </section>

      <section id="harga" className="band">
        <div className="wrap">
          <h2 className="t">⭐ Gratis untuk mencoba, Pro untuk kelas</h2>
          <p className="sub">
            Coba semuanya dulu tanpa akun. Saat siap membagikan ke murid dan memakai sesi live, aktifkan lisensi tahunan.
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
                <a className="btn g" href={PLAY("main")}>🎮 Main</a>
                <a className="btn w" href={PLAY("buat")}>✏️ Buat Soal</a>
              </div>
            </div>
            <div className="plan wood pro">
              <div className="ribbon">TAHUNAN</div>
              <h3>Pro</h3>
              <div className="tag">Lisensi 1 tahun · akses penuh</div>
              <ul className="chk">
                {proPlan.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="btn g" href={LICENSE} target="_blank" rel="noopener noreferrer">🛒 Beli Lisensi</a>
                <a className="btn b" href={`${WA}?text=${encodeURIComponent("Halo Admin ZuperFarm, saya ingin tanya tentang lisensi Pro.")}`} target="_blank" rel="noopener noreferrer">💬 Tanya Admin</a>
              </div>
            </div>
          </div>

          <h3 className="px" style={{ textAlign: "center", fontSize: 24, marginTop: 34 }}>Cara aktivasi Pro</h3>
          <div className="steps">
            <div className="wood"><b>Beli lisensi</b><br />melalui <a href={LICENSE} target="_blank" rel="noopener noreferrer">link pembelian</a>.</div>
            <div className="wood"><b>Daftar akun guru</b><br />di <a href={PLAY("guru")}>halaman guru</a> (email &amp; password).</div>
            <div className="wood"><b>Konfirmasi via WhatsApp</b><br />ke admin <a href={WA} target="_blank" rel="noopener noreferrer">0822-6626-8008</a>.</div>
            <div className="wood"><b>Akun diaktifkan</b><br />semua fitur Pro terbuka selama 1 tahun.</div>
          </div>
        </div>
      </section>

      <section id="pasang">
        <div className="wrap" style={{ textAlign: "center" }}>
          <h2 className="t">📲 Pasang sebagai aplikasi, layar penuh</h2>
          <p className="sub">
            Pasang ZuperFarm di laptop atau HP. Saat dibuka dari aplikasi, game tampil <b>layar penuh</b> tanpa bilah judul, tombol jendela, maupun taskbar. Tombol ⛶ di dalam game juga bisa dipakai kapan saja.
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
          <p>Bagian dari ekosistem <b>Zuper Guru</b> · Dibuat untuk guru dan murid Indonesia 🇮🇩</p>
          <p>
            <a href={WA} target="_blank" rel="noopener noreferrer">💬 WhatsApp Admin 0822-6626-8008</a> ·{" "}
            <a href={LICENSE} target="_blank" rel="noopener noreferrer">🛒 Beli Lisensi</a> ·{" "}
            <a href={PLAY("guru")}>👩‍🏫 Masuk Guru</a>
          </p>
        </div>
      </footer>

      <a className="wa" href={`${WA}?text=${encodeURIComponent("Halo Admin ZuperFarm")}`} target="_blank" rel="noopener noreferrer">
        💬 Tanya Admin
      </a>
    </>
  );
}
