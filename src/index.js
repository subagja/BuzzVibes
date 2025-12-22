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
    if (urls.length === 0) return json({ error: "Tidak ada link ditemukan dalam teks." }, 400, cors);

    const contextHint = deriveContextHint(taskText);

    const items = urls.map((url, i) => {
      const personaVal = pickPersona(personas, i); // bisa preset key atau custom text
      const persona = resolvePersona(personaVal);

      const drafts = makeDrafts({
        url,
        contextHint,
        persona,
        autoVariation,
        seed: hash(url + "|" + i + "|" + personaVal),
      });

      return {
        url,
        personaLabel: persona.label,
        drafts,
      };
    });

    return json({ items }, 200, cors);
  }
};

// ===== Persona rules =====
const PERSONA_RULES = {
  netral: {
    label: "Netral",
    openings: ["Menarik nih.", "Semoga makin jelas ya.", "Setuju untuk tetap tenang."],
    emojis: ["", ""],
  },
  santai_bangga: {
    label: "Netizen santai & bangga",
    openings: ["Mantap sih.", "Keren juga ya.", "Gas terus."],
    emojis: ["🙌", "✨", "🔥", ""],
  },
  nasionalis_tenang: {
    label: "Nasionalis tenang",
    openings: ["Yang penting tetap rukun.", "Kita jaga kekompakan.", "Semoga tetap bersatu."],
    emojis: ["🇮🇩", ""],
  },
  rasional: {
    label: "Rasional",
    openings: ["Kalau dipikir logis,", "Dari sisi penalaran,", "Yang penting lihat intinya,"],
    emojis: [""],
  },
  pro_logika: {
    label: "Pro-logika",
    openings: ["Coba runtut ya:", "Sebab-akibatnya jelas:", "Kalau tujuannya efektif,"],
    emojis: [""],
  },
  historis_reflektif: {
    label: "Historis & reflektif",
    openings: ["Dari pengalaman kita,", "Pelajaran pentingnya,", "Sejarah sering mengingatkan,"],
    emojis: ["", ""],
  },
  humanis: {
    label: "Humanis",
    openings: ["Semoga semuanya aman.", "Yang utama keselamatan orang-orang.", "Turut prihatin, semoga cepat pulih."],
    emojis: ["🙏", "💙", ""],
  },
};

function resolvePersona(val) {
  if (!val) return PERSONA_RULES.netral;
  const key = String(val).trim();
  if (PERSONA_RULES[key]) return PERSONA_RULES[key];

  // custom persona: kita map ke gaya netral tapi label sesuai input user
  return {
    label: key, // tampilkan “marah”, “formal banget”, dll
    openings: [`(${key})`, "Oke.", "Saya lihat begini:"],
    emojis: ["", ""],
  };
}

// ===== Draft generator (singkat ala komentar) =====
function makeDrafts({ contextHint, persona, autoVariation, seed }) {
  const basePoints = [
    "Semoga pembahasannya tetap fokus dan jelas.",
    "Lebih baik cari solusi yang bisa dilakukan daripada saling menyalahkan.",
    "Kalau ada kritik, akan lebih kuat kalau disertai usulan yang realistis.",
    "Yang penting informasinya dicek dulu supaya tidak salah paham.",
    "Semoga hasil akhirnya membawa manfaat."
  ];

  const open = pickFrom(persona.openings, seed);
  const emo = pickFrom(persona.emojis, seed + 7);
  const v = autoVariation ? variationSet(seed) : ["A", "B", "C"];

  const d1 = formatDraft(v[0], open, contextHint, pickFrom(basePoints, seed + 1), emo);
  const d2 = formatDraft(v[1], open, contextHint, pickFrom(basePoints, seed + 2), emo);
  const d3 = formatDraft(v[2], open, contextHint, pickFrom(basePoints, seed + 3), emo);

  return [d1, d2, d3].map(s => s.trim());
}

function formatDraft(kind, opening, contextHint, point, emoji) {
  const ctx = contextHint ? ` ${contextHint}` : "";
  switch (kind) {
    case "Q":
      return `${opening}${ctx} Menurut kalian, yang paling penting sekarang apa? ${point} ${emoji}`.replace(/\s+/g, " ");
    case "H":
      return `${opening}${ctx} Semoga semuanya berjalan baik. ${point} ${emoji}`.replace(/\s+/g, " ");
    case "L":
      return `${opening}${ctx} Intinya: ${point} ${emoji}`.replace(/\s+/g, " ");
    default:
      return `${opening}${ctx} ${point} ${emoji}`.replace(/\s+/g, " ");
  }
}

// ===== Helpers =====
function extractUrls(text) {
  const re = /https?:\/\/[^\s)]+/g;
  return (text.match(re) || []).map(u => u.replace(/[),.]+$/g, ""));
}
function uniq(arr) { return [...new Set(arr)]; }
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
  const sets = [
    ["A", "H", "L"],
    ["L", "A", "Q"],
    ["H", "Q", "A"],
    ["Q", "L", "H"],
  ];
  return sets[Math.abs(seed) % sets.length];
}
function deriveContextHint(taskText) {
  const lines = taskText.split("\n").map(s => s.trim()).filter(Boolean);
  const first = lines.find(l => !l.includes("http://") && !l.includes("https://"));
  if (!first) return "";
  const short = first.length > 80 ? first.slice(0, 80).trim() + "…" : first;
  return `(${short})`;
}
function hash(s) {
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
