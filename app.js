const $ = (id) => document.getElementById(id);

const linkInput = $("linkInput");
const contextInput = $("contextInput");
const guideInput = $("guideInput");
const toneInput = $("toneInput");

const btnGenerate = $("btnGenerate");
const btnOpen = $("btnOpen");
const statusEl = $("status");
const resultEl = $("result");

new Worker("./workers/polish.worker.js");

btnGenerate.onclick = () => {
  const guide = guideInput.value.trim();
  if (!guide) return alert("Guideline wajib diisi.");

  const link = linkInput.value.trim();
  if (link) {
    btnOpen.disabled = false;
    btnOpen.onclick = () => window.open(link, "_blank");
  }

  statusEl.textContent = "Menyusun draft komentar…";
  resultEl.innerHTML = "";

  worker.postMessage({
    tone: toneInput.value,
    context: contextInput.value,
    guideline: guide
  });
};

worker.onmessage = (e) => {
  const drafts = e.data;
  statusEl.textContent = "Draft siap.";

  drafts.forEach((t) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <p>${t}</p>
      <button>Copy</button>
    `;
    div.querySelector("button").onclick = () => {
      navigator.clipboard.writeText(t);
      statusEl.textContent = "Komentar disalin.";
    };
    resultEl.appendChild(div);
  });
};
