export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS preflight
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

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

    const link = String(body.link || "");
    const context = String(body.context || "");
    const guideline = String(body.guideline || "");
    const tone = String(body.tone || "netral");

    if (!guideline.trim()) return json({ error: "guideline wajib diisi" }, 400, cors);
    if (!env.OPENAI_API_KEY) return json({ error: "Missing OPENAI_API_KEY secret" }, 500, cors);

    // Prompt: paksa output JSON, Bahasa Indonesia, singkat, tidak menambah fakta
    const prompt = `
Kamu adalah asisten yang membuat komentar media sosial berbahasa Indonesia.

TUGAS:
Buat 3 draft komentar untuk sebuah postingan.

ATURAN WAJIB:
- Bahasa Indonesia saja.
- 1–2 kalimat per draft.
- Sopan, tidak provokatif, tidak menambah klaim/fakta baru.
- Hindari kata-kata: "Tugas:", "Konteks:", "Output:", "The text...", dan penjelasan meta.
- Tone: ${tone}
- Ikuti guideline pengguna.

INPUT:
Link (opsional): ${link}
Konteks (opsional): ${context}
Guideline: ${guideline}

KELUARAN:
HANYA tulis JSON valid persis seperti ini (tanpa teks lain):
{"drafts":["...","...","..."]}
`.trim();

    // Call OpenAI
    let r;
    try {
      r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: prompt,
        }),
      });
    } catch (e) {
      return json({ error: "Upstream fetch failed", details: String(e) }, 502, cors);
    }

    const raw = await r.text();

    if (!r.ok) {
      return json({ error: "openai_error", status: r.status, details: raw }, 500, cors);
    }

    // Extract output_text if possible
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

    // Parse JSON from model output
    const candidate = extractJson(outText || raw);

    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      return json({ error: "parse_failed", raw: outText || raw }, 500, cors);
    }

    if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 3) {
      return json({ error: "bad_format", raw: parsed }, 500, cors);
    }

    // Clean drafts
    parsed.drafts = parsed.drafts.map(s => String(s).trim());

    return json(parsed, 200, cors);
  }
};

function json(obj, status = 200, cors = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}

function extractJson(s) {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a === -1 || b === -1 || b <= a) return "{}";
  return s.slice(a, b + 1);
}
