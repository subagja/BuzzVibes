function generate() {
  const guide = document.getElementById("guide").value.trim();
  const out = document.getElementById("out");
  out.innerHTML = "";

  if (!guide) {
    alert("Guideline wajib diisi.");
    return;
  }

  const drafts = [
    "Terima kasih informasinya. Menarik untuk dicermati lebih lanjut.",
    "Diskusi seperti ini penting. Semoga tetap objektif dan konstruktif.",
    "Akan lebih kuat jika disertai data/rujukan agar tidak menimbulkan salah paham."
  ];

  drafts.forEach((t) => {
    const div = document.createElement("div");
    div.style.border = "1px solid #ddd";
    div.style.padding = "10px";
    div.style.marginTop = "10px";
    div.innerHTML = `
      <p style="margin:0 0 10px">${t}</p>
      <button>Copy</button>
    `;
    div.querySelector("button").onclick = async () => {
      await navigator.clipboard.writeText(t);
      alert("Tersalin!");
    };
    out.appendChild(div);
  });
}
