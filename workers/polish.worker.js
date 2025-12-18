self.onmessage = (e) => {
  const { tone, context, guideline } = e.data;

  const drafts = [];
  for (let i = 0; i < 3; i++) {
    drafts.push(generate({ tone, context, guideline }));
  }

  self.postMessage(drafts);
};

function generate({ tone, context, guideline }) {
  const t = tone || "netral";
  const topic = context ? ringkas(context) : "isu ini";

  const openers = {
    netral: [`Terkait ${topic},`, "Menarik untuk dicermati,"],
    formal: [`Terkait ${topic},`, "Menanggapi hal tersebut,"],
    santai: [`Soal ${topic},`, "Kalau dilihat-lihat,"],
    tegas: [`Terkait ${topic},`, "Perlu dicermati secara serius,"]
  };

  const closers = {
    netral: [
      "semoga diskusinya tetap sehat dan berbasis fakta.",
      "akan lebih kuat jika disertai data atau rujukan."
    ],
    formal: [
      "semoga pembahasannya tetap objektif dan konstruktif.",
      "perlu penjelasan yang proporsional agar tidak menimbulkan salah tafsir."
    ],
    santai: [
      "semoga bahasannya tetap adem dan jelas.",
      "kalau ada data pendukung pasti makin mantap."
    ],
    tegas: [
      "sebaiknya fokus pada fakta dan solusi, bukan asumsi.",
      "perlu klarifikasi agar tidak memicu spekulasi."
    ]
  };

  const o = pick(openers[t] || openers.netral);
  const c = pick(closers[t] || closers.netral);

  return limit(`${o} ${c}`, guideline);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ringkas(text) {
  const w = text.trim().split(/\s+/);
  return `"${w.slice(0, 8).join(" ")}${w.length > 8 ? "…" : ""}"`;
}

function limit(text, guide) {
  const m = guide.match(/max\s*(\d+)\s*kata/i);
  if (!m) return text;

  const max = parseInt(m[1], 10);
  const words = text.split(/\s+/);
  return words.length <= max
    ? text
    : words.slice(0, max).join(" ") + ".";
}
