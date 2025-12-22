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

    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405, cors);
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    const taskText = String(body.taskText || "").trim();
    const personas = Array.isArray(body.personas) ? body.personas : [];
    const tone = personas.length > 0 ? personas.join(", ") : "netral";

    if (!taskText) return json({ error: "taskText wajib" }, 400, cors);
    if (!env.OPENAI_API_KEY) return json({ error: "Missing OPENAI_API_KEY secret" }, 500, cors);

    const urls = uniq(extractUrls(taskText));
    if (urls.length === 0) {
      return json({ error: "Tidak ada link ditemukan dalam teks." }, 400, cors);
    }

    const contextHint = deriveContextHint(taskText);

    const items = [];
    for (const url of urls) {
      const drafts = await generateDrafts({
        env,
        url,
        context: contextHint,
        guideline: taskText,
        tone,
      });

      items.push({ url, drafts });
    }

    return json({ items }, 200, cors);
  }
};

// ===== OpenAI generator (PROMPT SAMA DENGAN index1.js) =====
async function generateDrafts({ env, url, context, guideline, tone }) {
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
Link (opsional): ${url}
Konteks (opsional): ${context}
Guideline: ${guideline}

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
  if (!r.ok) throw new Error(raw);

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

  const candidate = extractJson(outText || raw);
  const parsed = JSON.parse(candidate);

  if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 3) {
    throw new Error("Bad format from OpenAI");
  }

  return parsed.drafts.map(s => String(s).trim());
}

// ===== Helpers =====
function extractUrls(text) {
  const re = /https?:\/\/[^\s)]+/g;
  return (text.match(re) || []).map(u => u.replace(/[),.]+$/g, ""));
}

function uniq(arr) {
  return [...new Set(arr)];
}

function deriveContextHint(taskText) {
  const lines = taskText.split("\n").map(s => s.trim()).filter(Boolean);
  const first = lines.find(l => !l.includes("http"));
  if (!first) return "";
  return first.length > 80 ? first.slice(0, 80) + "…" : first;
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
