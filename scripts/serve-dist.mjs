// Sirve el HTML estático compilado para preview
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 4000;
const htmlFile = path.join(root, 'dist', 'nexus-backlog.html');

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(htmlFile).pipe(res);
}).listen(PORT, () => {
  console.log(`✅ Serving ${htmlFile} on http://localhost:${PORT}`);
});
