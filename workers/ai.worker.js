import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

let generator = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data || {};

  try {
    if (type === "init") {
      self.postMessage({ type: "status", payload: { message: "Download model AI (sekali saja)…" } });

      // Model instruksi kecil (tetap lumayan berat). Jika terlalu lambat, nanti kita ganti.
      generator = await pipeline("text2text-generation", "Xenova/mt5-small");

      self.postMessage({ type: "ready" });
      return;
    }

    if (type === "polish") {
      if (!generator) throw new Error("AI belum siap");

      const { tone, guideline, context, drafts } = payload;

      const polished = [];
      for (const d of drafts) {
        const prompt = buildPrompt({ tone, guideline, context, draft: d });

      const out = await generator(prompt, {
        max_new_tokens: 70,
        do_sample: false,
        num_beams: 3,
        repetition_penalty: 1.1
      });


        const text = (out?.[0]?.generated_text || "").trim();
        text = text.replace(/^KELUARAN\s*:\s*/i, "").replace(/^Output\s*:\s*/i, "").trim();
        text = text.replace(/^"|"$/g, "").trim(); // buang kutip depan-belakang
        polished.push(text || d);
      }

      self.postMessage({ type: "polished", payload: { drafts: polished } });
      return;
    }
  } catch (err) {
    self.postMessage({ type: "error", error: String(err?.message || err) });
  }
};

function buildPrompt({ tone, guideline, context, draft }) {
  const t = tone || "netral";
  const ctx = context ? `Konteks singkat: ${context}\n` : "";
  const g = guideline ? `Guideline: ${guideline}\n` : "";

  return `
TUGAS: Tulis ulang (rewrite) komentar berikut agar terdengar NATURAL dalam Bahasa Indonesia.
ATURAN:
- Pertahankan makna inti (jangan menambah klaim fakta baru).
- 1–2 kalimat, ringkas, sopan, tidak provokatif.
- Tone: ${t}.
- Hindari kata kaku/robotik, hindari "Sebagai AI", hindari bullet/nomor.
${ctx}${g}
KOMENTAR AWAL:
${draft}

KELUARAN (hanya komentarnya saja):
`.trim();
}

