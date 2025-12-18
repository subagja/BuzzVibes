console.log("AI WORKER v3 LOADED");
// import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

// let generator = null;

// self.onmessage = async (e) => {
//   const { type, payload } = e.data || {};

//   try {
//     if (type === "init") {
//       self.postMessage({ type: "status", payload: { message: "Download model AI (sekali saja)…" } });

//       // Model instruksi kecil (tetap lumayan berat). Jika terlalu lambat, nanti kita ganti.
//       generator = await pipeline("text2text-generation", "Xenova/mt5-small");

//       self.postMessage({ type: "ready" });
//       return;
//     }

//     if (type === "polish") {
//       if (!generator) throw new Error("AI belum siap");

//       const { tone, guideline, context, drafts } = payload;

//       const polished = [];
//       for (const d of drafts) {
//         const prompt = buildPrompt({ tone, guideline, context, draft: d });

//       const out = await generator(prompt, {
//         max_new_tokens: 70,
//         do_sample: false,
//         num_beams: 3,
//         repetition_penalty: 1.1
//       });


//         const text = (out?.[0]?.generated_text || "").trim();
//         text = text.replace(/^KELUARAN\s*:\s*/i, "").replace(/^Output\s*:\s*/i, "").trim();
//         text = text.replace(/^"|"$/g, "").trim(); // buang kutip depan-belakang
//         polished.push(text || d);
//       }

//       self.postMessage({ type: "polished", payload: { drafts: polished } });
//       return;
//     }
//   } catch (err) {
//     self.postMessage({ type: "error", error: String(err?.message || err) });
//   }
// };

// function buildPrompt({ tone, guideline, context, draft }) {
//   const t = tone || "netral";
//   const ctx = context ? `Konteks singkat: ${context}\n` : "";
//   const g = guideline ? `Guideline: ${guideline}\n` : "";

//   return `
// TUGAS: Tulis ulang (rewrite) komentar berikut agar terdengar NATURAL dalam Bahasa Indonesia.
// ATURAN:
// - Pertahankan makna inti (jangan menambah klaim fakta baru).
// - 1–2 kalimat, ringkas, sopan, tidak provokatif.
// - Tone: ${t}.
// - Hindari kata kaku/robotik, hindari "Sebagai AI", hindari bullet/nomor.
// ${ctx}${g}
// KOMENTAR AWAL:
// ${draft}

// KELUARAN (hanya komentarnya saja):
// `.trim();
// }

import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

console.log("AI WORKER v3 LOADED");

let generator = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data || {};

  try {
    if (type === "init") {
      self.postMessage({ type: "status", payload: { message: "Menyiapkan AI (Bahasa Indonesia)..." } });

      generator = await pipeline(
        "text2text-generation",
        "Xenova/mt5-small",
        {
          progress_callback: () => {
            self.postMessage({
              type: "status",
              payload: { message: "Mengunduh & memuat model AI..." }
            });
          }
        }
      );

      self.postMessage({ type: "ready" });
      return;
    }

    if (type === "polish") {
      if (!generator) throw new Error("AI belum siap");

      const { tone, guideline, context, drafts } = payload;

      const polished = [];

      for (const d of drafts) {
        const prompt = buildPrompt({
          tone,
          guideline,
          context,
          draft: d
        });

        const out = await generator(prompt, {
          max_new_tokens: 60,
          do_sample: false,
          num_beams: 4,
          repetition_penalty: 1.2
        });

        let text = (out?.[0]?.generated_text || "").trim();

        // FILTER WAJIB
        if (!text) {
          throw new Error("Output AI kosong");
        }

        if (/[a-z]{4,}/i.test(text) && !/[aiueo]{2,}/i.test(text)) {
          // indikasi kuat English
          throw new Error("AI mengembalikan bahasa non-Indonesia");
        }

        polished.push(clean(text));
      }

      self.postMessage({ type: "polished", payload: { drafts: polished } });
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err.message || "AI gagal memproses"
    });
  }
};

function buildPrompt({ tone, guideline, context, draft }) {
  const t = tone || "netral";
  const ctx = context ? `Konteks: ${context}\n` : "";
  const g = guideline ? `Aturan: ${guideline}\n` : "";

  return `
TUGAS:
Tulis ulang komentar berikut dalam **Bahasa Indonesia yang alami dan sopan**.

ATURAN WAJIB:
- Gunakan Bahasa Indonesia.
- 1–2 kalimat saja.
- Jangan menambah informasi atau klaim baru.
- Jangan menyebut "artikel ini", "tulisan ini", atau meta lainnya.
- Tone: ${t}.
- Hindari kalimat kaku/robotik.

${ctx}${g}

KOMENTAR AWAL:
${draft}

HASIL (Bahasa Indonesia, singkat):
`.trim();
}

function clean(text) {
  return text
    .replace(/^hasil\s*[:：]/i, "")
    .replace(/^output\s*[:：]/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}


