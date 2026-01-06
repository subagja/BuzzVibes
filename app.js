// ====== CONFIG ======
const WORKER_URL = "https://buzzvibes.adisubagja300.workers.dev"; // GANTI jika beda

// Persona presets (autocomplete)
const PERSONA_PRESETS = [
  { key: "santai_bangga", label: "Netizen santai & bangga", desc: "Hangat, santai, singkat, vibe positif." },
  { key: "nasionalis_tenang", label: "Nasionalis tenang", desc: "Kalem, persatuan, tidak emosional." },
  { key: "rasional", label: "Rasional", desc: "Fokus logika umum, hindari hiperbola." },
  { key: "pro_logika", label: "Pro-logika", desc: "Lebih runtut sebab–akibat, tetap singkat." },
  { key: "historis_reflektif", label: "Historis & reflektif", desc: "Nada bijak, pelajaran umum, tidak menggurui." },
  { key: "humanis", label: "Humanis", desc: "Empatik, menenangkan, fokus warga/manusia." },
];

// ================= DOM =================
const $ = (id) => document.getElementById(id);

const personaInput = $("personaInput");
const suggestBox = $("suggestBox");
const personaChips = $("personaChips");

const varToggle = $("varToggle");
const taskText = $("taskText");

const btnGenerate = $("btnGenerate");
const btnClear = $("btnClear");

const statusEl = $("status");
const resultsEl = $("results");

// Progress UI (pastikan ada di index.html)
const progressWrap = $("progressWrap");
const progressFill = $("progressFill");
const progressLabel = $("progressLabel");
const progressMeta = $("progressMeta");

let selectedPersonas = []; // bisa preset key atau teks custom

// ================= Utils =================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ================= Progress (estimasi) =================
let progressTimer = null;
let progressTick = null;
let progressStartAt = 0;

function startProgress(labelText = "Memproses…") {
  if (!progressWrap || !progressFill || !progressLabel || !progressMeta) return;

  stopProgress(false);

  progressStartAt = Date.now();
  progressWrap.style.display = "block";
  progressLabel.textContent = labelText;

  let p = 2;
  progressFill.style.width = `${p}%`;
  progressMeta.textContent = `${Math.floor(p)}% • 0s`;

  progressTimer = setInterval(() => {
    const secs = Math.floor((Date.now() - progressStartAt) / 1000);
    progressMeta.textContent = `${Math.floor(p)}% • ${secs}s`;
  }, 250);

  progressTick = setInterval(() => {
    const remaining = 90 - p;
    if (remaining <= 0) return;
    p += Math.max(0.2, remaining * 0.03);
    if (p > 90) p = 90;
    progressFill.style.width = `${p}%`;
  }, 300);
}

function stopProgress(success = true, finalLabel = "") {
  if (progressTimer) clearInterval(progressTimer);
  if (progressTick) clearInterval(progressTick);
  progressTimer = null;
  progressTick = null;

  if (!progressWrap || !progressFill || !progressLabel || !progressMeta) return;

  if (!success) {
    if (finalLabel) progressLabel.textContent = finalLabel;
    setTimeout(() => {
      progressWrap.style.display = "none";
      progressFill.style.width = "0%";
      progressMeta.textContent = "";
    }, finalLabel ? 1500 : 0);
    return;
  }

  progressFill.style.width = "100%";
  if (finalLabel) progressLabel.textContent = finalLabel;

  setTimeout(() => {
    progressWrap.style.display = "none";
    progressFill.style.width = "0%";
    progressMeta.textContent = "";
  }, 700);
}

// ================= Persona UI =================
function renderSelectedChips() {
  personaChips.innerHTML = "";

  if (selectedPersonas.length === 0) {
    const tip = document.createElement("div");
    tip.className = "muted";
    tip.textContent = "Belum pilih persona. (Boleh kosong: default netral.)";
    personaChips.appendChild(tip);
    return;
  }

  selectedPersonas.forEach((val) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip selected";

    const preset = PERSONA_PRESETS.find(p => p.key === val);
    if (preset) {
      chip.innerHTML = `
        <span class="chipDetail">
          <span class="chipTitle">${escapeHtml(preset.label)}</span>
          <span class="chipDesc">${escapeHtml(preset.desc)}</span>
        </span>
        <span style="margin-left:10px;font-weight:900;">×</span>
      `;
    } else {
      chip.innerHTML = `
        <span class="chipDetail">
          <span class="chipTitle">${escapeHtml(val)}</span>
          <span class="chipDesc">Custom persona</span>
        </span>
        <span style="margin-left:10px;font-weight:900;">×</span>
      `;
    }

    chip.onclick = () => {
      selectedPersonas = selectedPersonas.filter(x => x !== val);
      renderSelectedChips();
    };
    personaChips.appendChild(chip);
  });
}

function addPersona(val) {
  const v = String(val || "").trim();
  if (!v) return;

  const presetByLabel = PERSONA_PRESETS.find(p => p.label.toLowerCase() === v.toLowerCase());
  const storeVal = presetByLabel ? presetByLabel.key : v;

  if (!selectedPersonas.includes(storeVal)) selectedPersonas.push(storeVal);

  personaInput.value = "";
  suggestBox.style.display = "none";
  renderSelectedChips();
}

function showSuggestions(query) {
  const q = String(query || "").trim();
  const qLower = q.toLowerCase();

  if (!q) { suggestBox.style.display = "none"; return; }

  const matches = PERSONA_PRESETS.filter(p =>
    p.key.includes(qLower) ||
    (p.label || "").toLowerCase().includes(qLower) ||
    (p.desc || "").toLowerCase().includes(qLower)
  ).slice(0, 6);

  suggestBox.innerHTML = "";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.innerHTML = `Tambah persona: <b>${escapeHtml(q)}</b> <div class="muted">Tekan Enter juga bisa</div>`;
  addBtn.onclick = () => addPersona(q);
  suggestBox.appendChild(addBtn);

  matches.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `${escapeHtml(p.label)} <div class="muted">${escapeHtml(p.desc)}</div>`;
    btn.onclick = () => addPersona(p.key);
    suggestBox.appendChild(btn);
  });

  suggestBox.style.display = "block";
}

// events
personaInput.addEventListener("input", (e) => showSuggestions(e.target.value));
personaInput.addEventListener("focus", (e) => showSuggestions(e.target.value));

personaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addPersona(personaInput.value);
  } else if (e.key === "Escape") {
    suggestBox.style.display = "none";
  }
});

document.addEventListener("click", (e) => {
  if (!suggestBox.contains(e.target) && e.target !== personaInput) {
    suggestBox.style.display = "none";
  }
});

btnClear.onclick = () => {
  taskText.value = "";
  statusEl.textContent = "";
  resultsEl.innerHTML = "";
  stopProgress(false);
};

// ================= Worker Call (Debuggable) =================
async function callWorker(payload) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);

  let res;
  let raw = "";
  try {
    res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    raw = await res.text();
  } catch (err) {
    clearTimeout(t);

    const name = String(err?.name || "");
    const msg = String(err?.message || err);
    const m = msg.toLowerCase();

    if (
      name === "AbortError" ||
      m.includes("aborted") ||
      m.includes("signal is aborted") ||
      m.includes("the user aborted") ||
      m.includes("request aborted")
    ) {
      throw new Error("REQUEST_TIMEOUT: Proses terlalu lama / dibatalkan browser. Coba ulang atau kurangi jumlah link.");
    }

    if (msg.includes("Failed to fetch")) {
      throw new Error("FAILED_TO_FETCH (CORS/URL/Network). Cek WORKER_URL, CORS header Worker, dan koneksi.");
    }

    throw new Error(msg);
  } finally {
    clearTimeout(t);
  }

  console.log("Worker status:", res.status);
  console.log("Worker raw:", raw);

  let data = {};
  try { data = JSON.parse(raw); } catch { data = { raw }; }

  if (!res.ok) {
    const errMsg = data?.error ? `${data.error}` : `HTTP ${res.status}`;
    const details = data?.details ? `\n\nDetails:\n${data.details}` : (data?.raw ? `\n\nRaw:\n${data.raw}` : "");
    throw new Error(`${errMsg}${details}`.trim());
  }

  return data;
}

// ================= Generate =================
btnGenerate.onclick = async () => {
  const text = taskText.value.trim();
  if (!text) return alert("Paste tugas dulu.");

  btnGenerate.disabled = true;
  btnClear.disabled = true;

  statusEl.textContent = "Mengirim ke Worker…";
  resultsEl.innerHTML = "";

  startProgress("Mengirim & memproses di Worker…");

  const payload = {
    taskText: text,
    personas: selectedPersonas,
  };

    // autoVariation: !!varToggle.checked,
  
  try {
    const data = await callWorker(payload);

    if (!Array.isArray(data.items)) {
      console.error("Unexpected response:", data);
      stopProgress(false, "Gagal ❌");
      statusEl.textContent = "Respon server tidak sesuai.";
      alert("Worker tidak mengembalikan items.");
      return;
    }

    stopProgress(true, "Selesai ✅");
    statusEl.textContent = `Selesai. ${data.items.length} link diproses.`;
    renderResults(data.items);

  } catch (err) {
    console.error("Worker call failed:", err);
    stopProgress(false, "Gagal ❌");
    statusEl.textContent = "Gagal.";
    alert(String(err.message || err));
  } finally {
    btnGenerate.disabled = false;
    btnClear.disabled = false;
  }
};

function renderResults(items) {
  resultsEl.innerHTML = "";

  items.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "card";

    const meta = document.createElement("div");
    meta.className = "meta";

    const left = document.createElement("div");
    left.className = "metaLeft";

    const title = document.createElement("div");
    title.style.fontWeight = "900";
    title.textContent = `Link #${idx + 1}`;

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item.personaLabel ? `Persona: ${item.personaLabel}` : "Persona: Netral";

    left.appendChild(title);
    left.appendChild(pill);

    // ✅ Hapus tombol Open Link di header (karena approve akan buka link)
    meta.appendChild(left);
    card.appendChild(meta);

    (item.drafts || []).forEach((t, didx) => {
      const d = document.createElement("div");
      d.className = "draft";
      d.innerHTML = `
        <p>${escapeHtml(t)}</p>
        <div class="actions">
          <button type="button" class="primary smallBtn">Approve</button>
        </div>
      `;

      d.querySelector("button").onclick = async () => {
        // ✅ Panggil window.open dulu (anti popup-block), lalu copy
        const w = window.open(item.url, "_blank", "noopener,noreferrer");

        try {
          await navigator.clipboard.writeText(t);
          statusEl.textContent = "Approved ✓ Komentar disalin & link dibuka.";
        } catch (e) {
          console.error(e);
          statusEl.textContent = "Link dibuka, tapi gagal copy (cek izin clipboard).";
          alert("Link sudah dibuka, tapi gagal copy. Cek izin clipboard browser.");
        }

        // Kalau popup diblokir, kasih hint
        if (!w) {
          alert("Popup diblokir. Aktifkan popups untuk site ini, lalu coba Approve lagi.");
        }
      };

      card.appendChild(d);
    });

    const urlLine = document.createElement("div");
    urlLine.className = "muted url";
    urlLine.textContent = item.url;
    card.appendChild(urlLine);

    resultsEl.appendChild(card);
  });
}

// init
renderSelectedChips();
