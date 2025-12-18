// --- Optional PWA offline cache ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}

const el = (id) => document.getElementById(id);

const linkInput = el("linkInput");
const contextInput = el("contextInput");
const guideInput = el("guideInput");
const toneSelect = el("toneSelect");

const btnGenerate = el("btnGenerate");
const btnOpen = el("btnOpen");
const btnPolish = el("btnPolish");

const statusEl = el("status");
const resultEl = el("result");

let lastDrafts = []; // one-time session memory only

btnGenerate.addEventListener("click", () => {
  const link = linkInput.value.trim();
  const guide = guideInput.value.trim();
  const context = contextInput.value.trim();
  const tone = toneSelect.value || "netral";

  if (!guide) return alert("Guideline wajib diisi.");

  // Open link button
  if (link) {
    btnOpen.disabled = false;
    btnOpen.onclick = () => window.open(link, "_blank");
  } else {
    btnOpen.disabled = true;
    btnOpen.onclick = null;
  }

  lastDrafts = generate3Drafts({ context, guide, tone });
  renderDrafts(lastDrafts);

  btnPolish.disabled = false;
  status("Draft dibuat (mode cepat). Kalau mau, klik “Polish dengan AI”.");
});

function status(msg) { statusEl.textContent = msg || ""; }

function sanitize(text) {
  return String(text).replace(/[<>]/g, "");
}

function parseMaxWords(guide) {
  const m = guide.toLowerCase().match(/max\s*(\d+)\s*(kata|words)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function enforceMaxWords(text, maxWords) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ").replace(/[,.]?\s*$/, "") + ".";
}

function generate3Drafts({ context, guide, tone }) {
  const topic = context ? `Terkait "${context}", ` : "";
  const maxWords = parseMaxWords(guide) ?? 60;

  const bank = {
    formal: [
      `${topic}saya menilai isu ini perlu dibahas secara objektif dan proporsional. Terima kasih atas informasinya.`,
      `${topic}terima kasih telah berbagi. Akan lebih kuat apabila disertai rujukan atau data pendukung yang jelas.`,
      `${topic}semoga diskusi ini mendorong langkah yang konstruktif, serta tetap mengedepankan etika dan ketertiban.`
    ],
    netral: [
      `${topic}poinnya menarik untuk dicermati lebih lanjut. Semoga diskusinya tetap sehat.`,
      `${topic}terima kasih sudah berbagi perspektif. Ini bisa jadi bahan pertimbangan yang bermanfaat.`,
      `${topic}akan bagus jika pembahasan fokus pada fakta dan solusi agar tidak menimbulkan salah paham.`
    ],
    santai: [
      `${topic}menarik nih. Semoga bahasannya tetap adem dan jelas ya.`,
      `${topic}makasih udah share. Jadi nambah perspektif.`,
      `${topic}poinnya dapet sih. Biar makin kuat, enak juga kalau ada data/contoh.`
    ],
    tegas: [
      `${topic}ini sebaiknya disikapi serius. Mohon klarifikasi data dan langkah konkret agar tidak memicu spekulasi.`,
      `${topic}kalau ini benar, dampaknya bisa besar. Perlu penjelasan yang transparan dan terukur.`,
      `${topic}mari fokus pada fakta dan solusi. Hindari narasi yang berpotensi memecah-belah.`
    ]
  };

  const drafts = (bank[tone] || bank.netral).map(d => enforceMaxWords(d, maxWords));
  return drafts;
}

function renderDrafts(drafts) {
  resultEl.innerHTML = "";
  drafts.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "card";
    const safeText = sanitize(t);

    card.innerHTML = `
      <p>${safeText}</p>
      <div class="actions">
        <button class="ghost" data-copy="${i}">Copy</button>
        <button class="ghost" data-edit="${i}">Edit</button>
      </div>
    `;
    resultEl.appendChild(card);
  });

  resultEl.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const idx = Number(e.currentTarget.getAttribute("data-copy"));
      await navigator.clipboard.writeText(lastDrafts[idx]);
      status("Tersalin ke clipboard.");
    });
  });

  resultEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.currentTarget.getAttribute("data-edit"));
      const edited = prompt("Edit draft:", lastDrafts[idx]);
      if (edited != null) {
        lastDrafts[idx] = edited.trim();
        renderDrafts(lastDrafts);
        status("Draft diperbarui.");
      }
    });
  });
}

// -----------------------
// AI OPTIONAL (Local inference via Web Worker)
// -----------------------
let aiWorker = null;
let aiReady = false;

btnPolish.addEventListener("click", async () => {
  if (!lastDrafts.length) return;

  try {
    btnPolish.disabled = true;
    status("Menyiapkan AI lokal… (pertama kali bisa agak lama karena download model)");

    if (!aiWorker) {
      aiWorker = new Worker("./workers/ai.worker.js", { type: "module" });

      aiWorker.onmessage = (e) => {
        const { type, payload, error } = e.data || {};
        if (type === "ready") {
          aiReady = true;
          status("AI siap. Memoles 3 draft…");
          aiWorker.postMessage({ type: "polish", payload: buildPolishPayload() });
        } else if (type === "polished") {
          lastDrafts = payload.drafts;
          renderDrafts(lastDrafts);
          status("Selesai dipoles AI.");
          btnPolish.disabled = false;
        } else if (type === "status") {
          status(payload?.message || "");
        } else if (type === "error") {
          status(`AI gagal: ${error}. Tetap bisa pakai mode cepat.`);
          btnPolish.disabled = false;
        }
      };

      aiWorker.postMessage({ type: "init" });
      return; // tunggu ready
    }

    if (aiReady) {
      status("Memoles 3 draft…");
      aiWorker.postMessage({ type: "polish", payload: buildPolishPayload() });
    } else {
      aiWorker.postMessage({ type: "init" });
    }
  } catch (err) {
    status("AI tidak bisa dijalankan di device ini. Tetap pakai mode cepat.");
    btnPolish.disabled = false;
  }
});

function buildPolishPayload() {
  return {
    tone: toneSelect.value || "netral",
    guideline: guideInput.value.trim(),
    context: contextInput.value.trim(),
    drafts: lastDrafts
  };
}
