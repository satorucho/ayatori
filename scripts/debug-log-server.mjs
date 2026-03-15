import http from "node:http";
import fs from "node:fs";

const HOST = "127.0.0.1";
const PORT = 4317;
const LOG_PATH = "/opt/cursor/logs/debug.log";

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/debug-log") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        fs.appendFileSync(LOG_PATH, `${JSON.stringify(parsed)}\n`);
      } catch {
        // keep server alive even if payload is malformed
      }
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
      });
      res.end();
    });
    return;
  }

  res.writeHead(404, {
    "Access-Control-Allow-Origin": "*",
  });
  res.end();
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`debug-log-server listening on http://${HOST}:${PORT}\n`);
});
