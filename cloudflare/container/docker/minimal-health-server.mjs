import http from "node:http";

const port = Number(process.env.CALCOM_PORT || process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  const payload = {
    ok: true,
    mode: "minimal",
    method: req.method,
    path: req.url || "/",
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(body);
});

server.listen(port, "0.0.0.0", () => {
  // Keep this log concise so it is easy to spot in wrangler tail.
  console.log(`minimal-health-server listening on ${port}`);
});
