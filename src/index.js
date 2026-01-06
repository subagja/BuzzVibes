export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    // ✅ Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // ✅ Health check
    if (request.method === "GET") {
      return json({ ok: true, message: "Worker is running" }, 200, cors);
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405, cors);
    }

    // ✅ Bungkus seluruh handler POST agar error apapun tetap balik JSON + CORS
    try {
      // Parse body
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400, cors);
      }

      const taskText = String(body.taskText || "").trim();
      const personas = Array.isArray(body.personas) ? body.personas.map(String) : [];
      const autoVariation = !!body.autoVariation; // (simpan, kalau nanti dipakai)

      if (!taskText) return json({ error: "taskText wajib diisi" }, 400, cors);
      if (!env.OPENAI_API_KEY) return json({ error: "Missing OPENAI_API_KEY secret" }, 500, cors);

      // Ambil semua link
      const urls = uniq(extractUrls(taskText));
      if (urls.length === 0) return json({ error: "Tidak ada link ditemukan dalam teks." }, 400, cors);

      const contextHint = deriveContextHint(taskText);

      const items = [];
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        // const personaVal = pickPersona(personas, i);
        // const tone = personaVal ? personaVal : "netral";
        const personaMix = (personas && personas.length)
        ? personas.join(" + ")
        : "netral";

        // ✅ tiap link di-guard biar kalau 1 gagal, kamu tahu link mana yg gagal
        let drafts = [];
        try {
          drafts = await generateDraftsAI({
            env,
            link: url,
            context: contextHint,
            guideline: taskText,
            tone: personaMix, 
          });
        } catch (e) {
          return json(
            {
              error: "ai_failed",
              at_url: url,
              details: String(e?.message || e),
            },
            500,
            cors
          );
        }

        items.push({ url, personaLabel: personaMix, drafts });
      }

      return json({ items }, 200, cors);
    } catch (e) {
      // ✅ fallback terakhir
      return json({ error: "unhandled_error", details: String(e?.message || e) }, 500, cors);
    }
  },
};

/* =========================================================
   AI GENERATOR — PROMPT DIPERTAHANKAN
   ========================================================= */
async function generateDraftsAI({ env, link, context, guideline, tone }) {
const prompt = `
Kamu adalah asisten yang membuat komentar media sosial berbahasa Indonesia.

TUGAS:
Buat 3 draft komentar untuk sebuah postingan.

ATURAN WAJIB:
- Bahasa Indonesia saja.
- 1 kalimat per draft.
- Sopan, tidak provokatif, tidak menambah klaim/fakta baru.
- Hindari kata-kata: "Tugas:", "Konteks:", "Output:", "The text...", dan penjelasan meta.
- Penulisan selayaknya netizen sosial media (ringkas, natural).
- Tone dasar: ${tone}

ATURAN PERSONA & VARIASI:
- Jika Tone berisi lebih dari satu karakter/gaya (misal: "lucu, marah" atau "humanis + tegas"):
  • CAMPURKAN karakter tersebut secara halus.
  • Setiap draft harus terasa BERBEDA nuansa:
    - Draft 1: lebih ringan / santai.
    - Draft 2: lebih tegas / emosional (tanpa kasar).
    - Draft 3: lebih rasional / reflektif.
- Jangan mengulang struktur kalimat.
- Jangan mengulang kata pembuka yang sama.

ATURAN GUIDELINE (PALING PENTING):
- Guideline biasanya panjang dan berisi banyak link & instruksi.
- FOKUS UTAMA KAMU HANYA PADA KALIMAT atau PARAGRAF yang DIAWALI:
  "Diharapkan..." atau "Diharapkan memberikan..."
  YANG RELEVAN UNTUK LINK INI.
- Ambil INTI PESAN dari kalimat "Diharapkan..." tersebut.
- Abaikan:
  • pembuka surat,
  • catatan administratif,
  • komentar lain,
  • Google Form / laporan bukti.

INPUT:
Link (opsional): ${link}
Guideline:
${guideline}

KELUARAN:
HANYA tulis JSON valid persis seperti ini (tanpa teks lain):
{"drafts":["...","...","..."]}
`.trim();

  // ✅ timeout request ke OpenAI biar tidak nge-hang
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000); // < 60s aman untuk worker

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
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    throw new Error("Upstream fetch failed: " + String(e?.message || e));
  } finally {
    clearTimeout(t);
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
    throw new Error("parse_failed: model tidak mengembalikan JSON valid");
  }

  if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 3) {
    throw new Error("bad_format: JSON harus punya drafts[3]");
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
function uniq(arr) { return [...new Set(arr)]; }
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
