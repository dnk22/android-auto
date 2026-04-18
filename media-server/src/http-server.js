import http from "node:http";

export function createHealthServer(options = {}) {
  const { onRequest, getHealthPayload } = options;

  return http.createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.url === "/health") {
      const extraPayload =
        typeof getHealthPayload === "function" ? await getHealthPayload() : {};
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          ts: Date.now(),
          ...extraPayload,
        })
      );
      return;
    }

    if (typeof onRequest === "function") {
      const requestUrl = new URL(request.url || "/", "http://localhost");
      const handled = await onRequest(request, response, requestUrl);
      if (handled || response.writableEnded) {
        return;
      }
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });
}
