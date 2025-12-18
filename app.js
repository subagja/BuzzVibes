console.log("UI VERSION: CF-WORKER-2025-12-18");
document.title = "Generator Komentar (CF-WORKER-2025-12-18)";

const WORKER_URL = "https://buzzvibes.adisubagja300.workers.dev"; // GANTI

const $ = (id) => document.getElementById(id);

const linkEl = $("link");
const ctxEl = $("context");
const guideEl = $("guide");
const toneEl = $("tone");
const genBtn = $("gen");
const openBtn = $("open");
const statusEl = $("status");
const outEl = $("out");

genBtn.onclick = async () => {
  const link = linkEl.value.trim();
  const context = ctxEl.value.trim();
  const guideline = guideEl.value.trim();
  const tone = toneEl.value;

  if (!guideline) {
    alert("Guideline wajib diisi.");
    return;
  }

  if (link) {
    openBtn.disabled = false;
    openBtn.onclick = () => window.open(link, "_blank");
  } else {
    openBtn.disabled = true;
  }

  statusEl.textContent = "Menghubungi AI…";
  outEl.innerHTML = "";

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, context, guideline, tone })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(data);
      statusEl.textContent = "Gagal generate.";
      alert("Gagal generate. Cek console/log.");
      return;
    }

    renderDrafts(data.drafts || []);
    statusEl.textContent = "Draft siap.";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Koneksi gagal.";
    alert("Tidak bisa terhubung ke server.");
  }
};

function renderDrafts(drafts) {
  outEl.innerHTML = "";
  drafts.forEach((text) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <p>${escapeHtml(text)}</p>
      <button>Copy</button>
    `;
    card.querySelector("button").onclick = async () => {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = "Tersalin ke clipboard.";
    };
    outEl.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}
