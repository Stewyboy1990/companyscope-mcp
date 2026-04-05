/**
 * Minimal HTTP proxy for MCPize deployment.
 * Forwards all /mcp requests to the Cloudflare Worker.
 */
import http from "node:http";
import https from "node:https";

const UPSTREAM = "https://companyscope-mcp.stewwilli.workers.dev";
const PORT = parseInt(process.env.PORT || "8080", 10);

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", upstream: UPSTREAM }));
    return;
  }

  // Proxy everything else to upstream
  const target = new URL(req.url || "/", UPSTREAM);
  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const options = {
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: target.hostname,
      },
    };

    const proxy = https.request(options, (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    });

    proxy.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_error", message: String(err) }));
    });

    if (body) proxy.write(body);
    proxy.end();
  });
});

server.listen(PORT, () => {
  console.log(`CompanyScope proxy listening on :${PORT} → ${UPSTREAM}`);
});
