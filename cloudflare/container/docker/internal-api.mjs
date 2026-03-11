import http from "node:http";
import { spawn } from "node:child_process";

const listenPort = Number(process.env.PORT || "3000");
const calcomPort = Number(process.env.CALCOM_PORT || "3001");
const cronToken = process.env.INTERNAL_CRON_TOKEN || "";
const smsWebhookToken = process.env.BREVO_SMS_WEBHOOK_TOKEN || "";
const brevoApiKey = process.env.BREVO_API_KEY || "";
const brevoSmsSender = process.env.BREVO_SMS_SENDER || "";

let backupInProgress = false;

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function unauthorized(res) {
  writeJson(res, 401, { error: "Unauthorized" });
}

function checkToken(req) {
  const headerToken = req.headers["x-internal-token"];
  if (!cronToken) {
    return false;
  }

  return headerToken === cronToken;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

async function sendBrevoSms({ recipient, message }) {
  if (!brevoApiKey || !brevoSmsSender) {
    throw new Error("Brevo SMS is not configured");
  }

  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": brevoApiKey,
    },
    body: JSON.stringify({
      sender: brevoSmsSender,
      recipient,
      content: message,
      type: "transactional",
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Brevo API error ${response.status}: ${text}`);
  }

  return text;
}

function runBackup() {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/local/bin/backup-postgres.sh", {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || `backup command exited with code ${code}`));
    });
  });
}

function proxyToCalcom(req, res) {
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: calcomPort,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    writeJson(res, 502, { error: "Cal.com upstream unavailable", details: error.message });
  });

  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const { url = "/", method = "GET" } = req;

  if (url === "/internal/wake") {
    if (!checkToken(req)) {
      unauthorized(res);
      return;
    }

    writeJson(res, 200, {
      ok: true,
      wokeAt: new Date().toISOString(),
    });
    return;
  }

  if (url === "/internal/backup" && method === "POST") {
    if (!checkToken(req)) {
      unauthorized(res);
      return;
    }

    if (backupInProgress) {
      writeJson(res, 409, { error: "Backup already in progress" });
      return;
    }

    backupInProgress = true;
    try {
      const output = await runBackup();
      writeJson(res, 200, { ok: true, output });
    } catch (error) {
      writeJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Backup failed",
      });
    } finally {
      backupInProgress = false;
    }
    return;
  }

  if (url === "/internal/health") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (url === "/integrations/brevo/sms" && method === "POST") {
    const authHeader = req.headers.authorization || "";
    if (!smsWebhookToken || authHeader !== `Bearer ${smsWebhookToken}`) {
      unauthorized(res);
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const recipient = payload.to || payload.recipient || payload.phone;
      const message = payload.message || payload.text || payload.content;

      if (!recipient || !message) {
        writeJson(res, 400, { error: "Missing recipient or message" });
        return;
      }

      const output = await sendBrevoSms({ recipient, message });
      writeJson(res, 200, { ok: true, output });
    } catch (error) {
      writeJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "SMS delivery failed",
      });
    }
    return;
  }

  proxyToCalcom(req, res);
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log(`Internal API and Cal.com proxy listening on ${listenPort}`);
});
