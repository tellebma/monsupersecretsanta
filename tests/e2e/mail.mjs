import { createServer } from "node:http";
import { once } from "node:events";
import { expect } from "@playwright/test";

export async function captureMail() {
  const messages = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    messages.push({ ...JSON.parse(Buffer.concat(chunks).toString()), key: req.headers["idempotency-key"] });
    res.writeHead(200, { "Content-Type": "application/json" }).end('{"id":"fake-delivery"}');
  });
  server.listen(3101, "127.0.0.1");
  await once(server, "listening");
  return {
    messages,
    async deliver(request) {
      const headers = { Authorization: `Bearer ${process.env.SCHEDULE_SECRET}` };
      expect((await request.post("/api/schedule", { headers })).status()).toBe(200);
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
