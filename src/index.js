// export default {
//   async fetch() {
//     return new Response("Worker OK");
//   }
// };

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, ping: "pong" }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    if (request.method === "POST") {
      return new Response(JSON.stringify({ drafts: ["tes 1", "tes 2", "tes 3"] }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: cors });
  }
};
