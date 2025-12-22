export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (request.method === "GET") {
      return json({ ok: true, message: "Worker is running" }, 200, cors);
    }

    if (request.method !== "POST") return json({ error: "Use POST" }, 405, cors);

    let body = {};
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400, cors); }

    const taskText = String(body.taskText || "").trim();
    const personas = Array.isArray(body.personas) ? body.personas.map(String) : [];
    const autoVariation = !!body.autoVariation;

    if (!taskText) return json({ error: "taskText wajib" }, 400, cors);

    const urls = uniq(extractUrls(taskText));
    if (urls.length === 0) {
      return json({ error: "Tidak ada link ditemukan dalam teks." }, 400, cors);
    }

    // (Opsional) ringkas konteks umum dari tugas: ambil 1-2 baris awal supaya komentar terasa nyambung
    const contextHint = deriveContextHint(taskText);

    const items = urls.map((url, i) => {
      const personaKey = pickPersona(personas, i);
      const persona = PERSONA_RULES[personaKey] || PERSONA_RULES.netral;

      const drafts = makeDrafts({
        url,
        contextHint,
        persona,
        autoVariation,
        seed: hash(url + "|" + i),
      });

      return {
        url,
        personaKey: personaKey || "netral",
        personaLabel: persona.label,
        drafts,
      };
    });

    return json({ items }, 200, cors);
  }
};

// ===== Persona rules (gaya) =====
const PERSONA_RULES = {
  netral: {
    label: "Netral",
    openings: ["Menarik nih.", "Setuju untuk tetap tenang.", "Semoga semuanya cepat membaik."],
    tone: "netral",
    emoji: ["", ""],
  },
  santai_bangga: {
    label: "Netizen santai & bangga",
    openings: ["Mantap sih.", "Keren juga ya.", "Gas terus."],
    tone: "santai",
    emoji: ["🙌", "✨", "🔥", ""],
  },
  nasionalis_tenang: {
    label: "Nasionalis tenang",
    openings: ["Yang penting tetap bersatu.", "Kita jaga kekompakan.", "Tetap rukun itu utama."],
    tone: "tenang",
    emoji: ["🇮🇩", ""],
  },
  rasional: {
    label: "Rasional",
    openings: ["Kalau dipikir logis,", "Dari sisi penalaran,", "Yang penting lihat faktanya,"],
    tone: "rasional",
    emoji: [""],
  },
  pro_logika: {
    label: "Pro-logika",
    openings: ["Coba runtut ya:", "Sebab-akibatnya jelas:", "Kalau tujuannya efektif,"],
    tone: "argumentatif",
    emoji: [""],
  },
  historis_reflektif: {
    label: "Historis & reflektif",
    openings: ["Dari pengalaman kita,", "Pelajaran pentingnya,", "Sejarah sering mengingatkan,"],
    tone: "reflektif",
    emoji: ["", ""],
  },
  humanis: {
    label: "Humanis",
    openings: ["Semoga warga tetap kuat.", "Yang utama keselamatan orang-orang.", "Turut prihatin, semoga segera pulih."],
    tone: "empatik",
    emoji: ["🙏", "💙", ""],
  },
};

// ===== Draft generator (template-based, singkat ala komentar) =====
function makeDrafts({ url, contextHint, persona, autoVariation, seed }) {
  // Draft dibuat generik & aman: tidak menambah klaim fakta baru.
  const basePoints = [
    "Yang penting langkahnya jelas dan terukur.",
    "Semoga semua pihak fokus pada solusi, bukan saling menyalahkan.",
    "Lebih baik bahas hal yang bisa membantu, daripada memperkeruh suasana.",
    "Kalau ada kritik, bagusnya sekalian kasih usulan yang realistis.",
    "Semoga informasi yang beredar tetap dicek dulu biar nggak salah paham."
  ];

  const open = pickFrom(persona.openings, seed);
  const emo = pickFrom(persona.emoji, seed + 7);

  const v = autoVariation ? variationSet(seed) : ["A", "B", "C"];

  const d1 = formatDraft(v[0], persona, open, contextHint, pickFrom(basePoints, seed + 1), emo);
  const d2 = formatDraft(v[1], persona, open, contextHint, pickFrom(basePoints, seed + 2), emo);
  const d3 = formatDraft(v[2], persona, open, contextHint, pickFrom(basePoints, seed + 3), emo);

  return [d1, d2, d3].map(s => s.trim());
}

function formatDraft(kind, persona, opening, contextHint, point, emoji) {
  // Panjang default netizen: 1–2 kalimat
  const ctx = contextHint ? ` ${contextHint}` : "";
  switch (kind) {
    case "Q":
      return `${opening}${ctx} Menurut kalian, yang paling penting sekarang apa? ${point} ${emoji}`.replace(/\s+/g, " ");
    case "H":
      return `${opening}${ctx} Semoga situasinya cepat membaik. ${point} ${emoji}`.replace(/\s+/g, " ");
    case "L":
      return `${opening}${ctx} Intinya: ${point} ${emoji}`.replace(/\s+/g, " ");
    default:
      return `${opening}${ctx} ${point} ${emoji}`.replace(/\s+/g, " ");
  }
}

// ===== Helpers =====
function extractUrls(text) {
  // ambil semua http/https sampai whitespace
  const re = /https?:\/\/[^\s)]+/g;
  return (text.match(re) || []).map(cleanUrl);
}

function cleanUrl(u) {
  // buang trailing punctuation umum
  return u.replace(/[),.]+$/g, "");
}

function uniq(arr) {
  const s = new Set();
  const out = [];
  for (const x of arr) {
    if (!s.has(x)) { s.add(x); out.push(x); }
  }
  return out;
}

function pickPersona(personas, i) {
  if (!personas || personas.length === 0) return "netral";
  return personas[i % personas.length];
}

function pickFrom(arr, seed) {
  if (!arr || arr.length === 0) return "";
  const idx = Math.abs(seed) % arr.length;
  return arr[idx];
}

function variationSet(seed) {
  // rotasi bentuk supaya tidak repetitif: statement / question / hope / "intinya"
  const sets = [
    ["A", "H", "L"],
    ["L", "A", "Q"],
    ["H", "Q", "A"],
    ["Q", "L", "H"],
  ];
  return sets[Math.abs(seed) % sets.length];
}

function deriveContextHint(taskText) {
  // ambil 1 baris awal yang bukan URL untuk hint konteks umum (opsional)
  const lines = taskText.split("\n").map(s => s.trim()).filter(Boolean);
  const first = lines.find(l => !l.startsWith("http") && !l.includes("http://") && !l.includes("https://"));
  if (!first) return "";
  // batasi panjang agar tetap netizen
  const short = first.length > 80 ? first.slice(0, 80).trim() + "…" : first;
  return `(${short})`;
}

function hash(s) {
  // hash sederhana untuk variasi deterministik
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

function json(obj, status = 200, cors = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}
