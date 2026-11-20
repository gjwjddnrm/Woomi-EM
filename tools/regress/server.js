// 회귀 테스트용 읽기 전용 정적 서버 (GET 전용). 저장소 폴더를 그대로 서빙.
// 사용: node tools/regress/server.js <서빙할_폴더> <포트>
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(process.argv[2] || ".");
const PORT = Number(process.argv[3] || 8790);
const TYPES = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml" };
http.createServer((req, res) => {
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, buf) => {
    if (e) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, "127.0.0.1", () => console.log("serving " + ROOT + " on " + PORT));
