// ====== CONFIG ======
const WORKER_URL = "https://buzzvibes.adisubagja300.workers.dev"; // GANTI

// ====== Persona presets (autocomplete) ======
const PERSONA_PRESETS = [
  { key: "santai_bangga",  label: "Netizen santai & bangga", desc: "Hangat, santai, singkat, vibe positif." },
  { key: "nasionalis_tenang", label: "Nasionalis tenang", desc: "Kalem, persatuan, tidak emosional." },
  { key: "rasional", desc: "Fokus logika umum, tidak hiperbola." , label: "Rasional"},
  { key: "pro_logika", desc: "Lebih argumentatif, sebab-akibat, tetap singkat.", label: "Pro-logika" },
  { key: "historis_reflektif", desc: "Nada bijak, pelajaran masa lalu secara umum.", label: "Historis & reflektif" },
  { key: "humanis", desc: "Empatik, menenangkan, fokus warga/manusia.", label: "Humanis" },
];

// ====== DOM ======
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

let selectedPersonas = []; // array of keys

function renderSelectedChips() {
  personaChips.innerHTML = "";
  if (selectedPersonas.length === 0) {
    const tip = document.createElement("div");
    tip.className = "muted";
    tip.textContent = "Belum pilih persona. (Boleh kosong: default netral.)";
    personaChips.appendChild(tip);
    return;
  }

  selectedPersonas.forEach((key) => {
    const p = PERSONA_PRESETS.find(x => x.key === key);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip selected small";
    chip.textContent = `${p?.label || key} ×`;
    chip.onclick = () => {
      selectedPersonas = selectedPersonas.filter(k => k !== key);
      renderSelectedChips();
    };
    personaChips.appendChild(chip);
  });
}

function showSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) { suggestBox.style.display = "none"; return; }

  const matches = PERSONA_PRESETS.filter(p =>
    p.key.includes(q) || (p.label || "").toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q)
  ).slice(0, 6);

  if (matches.length === 0) { suggestBox.style.display = "none"; return; }

  suggestBox.innerHTML = "";
  matches.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `${p.label} <div class="muted">${p.desc}</div>`;
    btn.onclick = () => {
      if (!selectedPersonas.includes(p.key)) selectedPersonas.push(p.key);
      personaInput.value = "";
      suggestBox.style.display = "none";
      renderSelectedChips();
    };
    suggestBox.appendChild(btn);
  });

  suggestBox.style.display = "block";
}

personaInput.addEventListener("input", (e) => showSuggestions(e.target.value));
personaInput.addEventListener("focus", (e) => showSuggestions(e.target.value));
document.addEventListener("click", (e) => {
  if (!suggestBox.contains(e.target) && e.target !== personaInput) suggestBox.style.display = "none";
});

btnClear.onclick = () => {
  taskText.value = "";
  statusEl.textContent = "";
  resultsEl.innerHTML = "";
};

// ====== Main Generate ======
btnGenerate.onclick = async () => {
  const text = taskText.value.trim();
  if (!text) return alert("Paste tugas dulu.");

  statusEl.textContent = "Mengirim ke Worker…";
  resultsEl.innerHTML = "";

  const payload = {
    taskText: text,
    personas: selectedPersonas,         // array keys
    autoVariation: !!varToggle.checked, // boolean
  };

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let data = {};
    try { data = JSON.parse(raw); } catch { data = { raw }; }

    if (!res.ok) {
      console.error("Worker error:", data);
      statusEl.textContent = "Gagal.";
      alert(data?.error || `HTTP ${res.status}`);
      return;
    }

    if (!Array.isArray(data.items)) {
      console.error("Unexpected:", data);
      statusEl.textContent = "Respon server tidak sesuai.";
      alert("Worker tidak mengembalikan items.");
      return;
    }

    statusEl.textContent = `Selesai. ${data.items.length} link diproses.`;
    renderResults(data.items);

  } catch (err) {
    console.error("FETCH FAILED:", err);
    statusEl.textContent = "Koneksi gagal.";
    alert("Tidak bisa terhubung ke Worker. Cek URL Worker & koneksi.");
  }
};

function renderResults(items) {
  resultsEl.innerHTML = "";

  items.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "meta";

    const title = document.createElement("h3");
    title.innerHTML = `Link #${idx + 1}`;
    title.style.flex = "1";
    title.style.margin = "0";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "secondary";
    openBtn.textContent = "Open Link";
    openBtn.onclick = () => window.open(item.url, "_blank", "noopener,noreferrer");

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item.personaLabel ? `Persona: ${item.personaLabel}` : "Persona: Netral";

    header.appendChild(title);
    header.appendChild(pill);
    header.appendChild(openBtn);

    card.appendChild(header);

    (item.drafts || []).forEach((t) => {
      const d = document.createElement("div");
      d.className = "draft";
      d.innerHTML = `
        <p>${escapeHtml(t)}</p>
        <div class="actions">
          <button type="button" class="secondary">Copy</button>
        </div>
      `;
      d.querySelector("button").onclick = async () => {
        await navigator.clipboard.writeText(t);
        statusEl.textContent = "Tersalin ke clipboard.";
      };
      card.appendChild(d);
    });

    const urlLine = document.createElement("div");
    urlLine.className = "muted";
    urlLine.style.marginTop = "10px";
    urlLine.textContent = item.url;

    card.appendChild(urlLine);
    resultsEl.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
