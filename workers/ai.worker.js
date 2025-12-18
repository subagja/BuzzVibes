import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

let generator = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data || {};

  try {
    if (type === "init") {
      self.postMessage({ type: "status", payload: { message: "Download model AI (sekali saja)…" } });

      // Model instruksi kecil (tetap lumayan berat). Jika terlalu lambat, nanti kita ganti.
      generator = await pipeline("text2text-generation", "Xenova/LaMini-Flan-T5-248M");

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
          max_new_tokens: 80,
          temperature: 0.7
        });

        const text = (out?.[0]?.generated_text || "").trim();
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
  const ctx = context ? `Konteks: ${context}\n` : "";
  const g = guideline ? `Guideline: ${guideline}\n` : "";

  return `
Tugas: Rapikan dan variasikan komentar bahasa Indonesia agar sesuai tone "${t}".
${ctx}${g}
Komentar awal: ${draft}
Keluaran: 1 komentar singkat, sopan, tidak provokatif, tanpa menambah klaim fakta baru.
`.trim();
}
