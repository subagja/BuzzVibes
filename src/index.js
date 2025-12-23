export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Health check
    if (request.method === "GET") {
      return json({ ok: true, message: "Worker is running" }, 200, cors);
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405, cors);
    }

    // Parse body
    let body = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    const taskText = String(body.taskText || "").trim();
    const personas = Array.isArray(body.personas) ? body.personas.map(String) : [];
    const autoVariation = !!body.autoVariation;

    if (!taskText) {
      return json({ error: "taskText wajib diisi" }, 400, cors);
    }
    if (!env.OPENAI_API_KEY) {
      return json({ error: "Missing OPENAI_API_KEY secret" }, 500, cors);
    }

    // Ambil semua link
    const urls = uniq(extractUrls(taskText));
    if (urls.length === 0) {
      return json({ error: "Tidak ada link ditemukan dalam teks." }, 400, cors);
    }

    const contextHint = deriveContextHint(taskText);

    const items = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const personaVal = pickPersona(personas, i);
      const tone = personaVal ? personaVal : "netral";

      const drafts = await generateDraftsAI({
        env,
        link: url,
        context: contextHint,
        guideline: taskText,
        tone,
      });

      items.push({
        url,
        personaLabel: tone,
        drafts,
      });
    }

    return json({ items }, 200, cors);
  }
};

/* =========================================================
   AI GENERATOR — PROMPT DIPERTAHANKAN (VERSI index1.js)
   ========================================================= */
async function generateDraftsAI({ env, link, context, guideline, tone }) {

  // 🔒 PROMPT TETAP (tidak diubah strukturnya)
//   const prompt = `
// Kamu adalah asisten yang membuat komentar media sosial berbahasa Indonesia.

// TUGAS:
// Buat 3 draft komentar untuk sebuah postingan.

// ATURAN WAJIB:
// - Bahasa Indonesia saja.
// - 1–2 kalimat per draft.
// - Sopan, tidak provokatif, tidak menambah klaim/fakta baru.
// - Hindari kata-kata: "Tugas:", "Konteks:", "Output:", "The text...", dan penjelasan meta.
// - Tone: ${tone}
// - Ikuti guideline pengguna.

// INPUT:
// Link (opsional): ${link}
// Konteks (opsional): ${context}
// Guideline: ${guideline}

// KELUARAN:
// HANYA tulis JSON valid persis seperti ini (tanpa teks lain):
// {"drafts":["...","...","..."]}
// `.trim();

  const prompt = `
    Kamu adalah asisten yang membuat komentar media sosial berbahasa Indonesia.
    
    TUGAS:
    Buat 3 draft komentar untuk sebuah postingan.
    
    ATURAN WAJIB:
    - Bahasa Indonesia saja.
    - 1–2 kalimat per draft.
    - Sopan, tidak provokatif, tidak menambah klaim/fakta baru.
    - Hindari kata-kata: "Tugas:", "Konteks:", "Output:", "The text...", dan penjelasan meta.
    - Netizen like
    - Penulisan selayaknya netizen sosial media
    - Tone: ${tone}
    - Ikuti guideline pengguna.
    - Guideline biasanya panjang dan berisi konteks kasus.
      **FOKUS UTAMA KAMU HANYA PADA BAGIAN "Upaya" DAN POIN-POIN TEMANYA.**
    - Abaikan narasi pembuka, latar belakang, atau opini di luar poin "Upaya".
    - Setiap draft harus merefleksikan salah satu tema dalam bagian "Upaya".
    
    INPUT:
    Link (opsional): ${link}
    Konteks (opsional): ${context}
    Guideline:
    ${guideline}
    
    KELUARAN:
    HANYA tulis JSON valid persis seperti ini (tanpa teks lain):
    {"drafts":["...","...","..."]}
    `.trim();


  let r;
  try {
    r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
      }),
    });
  } catch (e) {
    throw new Error("Upstream fetch failed: " + String(e));
  }

  const raw = await r.text();
  if (!r.ok) {
    throw new Error(raw);
  }

  // Ambil output_text
  let outText = "";
  try {
    const data = JSON.parse(raw);
    outText =
      data?.output?.flatMap(o => o.content || [])
        ?.filter(c => c.type === "output_text")
        ?.map(c => c.text)
        ?.join("\n") || "";
  } catch {
    outText = raw;
  }

  // Parse JSON dari model
  const candidate = extractJson(outText || raw);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error("parse_failed");
  }

  if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 3) {
    throw new Error("bad_format");
  }

  return parsed.drafts.map(s => String(s).trim());
}

/* =========================================================
   Helpers
   ========================================================= */
function extractUrls(text) {
  const re = /https?:\/\/[^\s)]+/g;
  return (text.match(re) || []).map(u => u.replace(/[),.]+$/g, ""));
}

function uniq(arr) {
  return [...new Set(arr)];
}

function pickPersona(personas, i) {
  if (!personas || personas.length === 0) return "netral";
  return personas[i % personas.length];
}

function deriveContextHint(taskText) {
  const lines = taskText.split("\n").map(s => s.trim()).filter(Boolean);
  const first = lines.find(l => !l.includes("http://") && !l.includes("https://"));
  if (!first) return "";
  return first.length > 100 ? first.slice(0, 100) + "…" : first;
}

function extractJson(s) {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a === -1 || b === -1 || b <= a) return "{}";
  return s.slice(a, b + 1);
}

function json(obj, status = 200, cors = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}
