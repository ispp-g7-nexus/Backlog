// Dev server con live reload: abre http://localhost:3000
import { context } from 'esbuild';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const srcPath   = path.join(root, 'src', 'nexus-backlog.jsx');
const entryPath = path.join(root, 'src', '_entry.jsx');

function writeEntry() {
  const src = fs.readFileSync(srcPath, 'utf-8')
    .replace(/^export default function App/m, 'function App');
  fs.writeFileSync(entryPath,
    `import { createRoot } from "react-dom/client";\n${src}\ncreateRoot(document.getElementById("root")).render(<App />);\n`
  );
}

writeEntry();

const ctx = await context({
  entryPoints: [entryPath],
  bundle: true,
  outfile: path.join(root, 'dist', '_dev_bundle.js'),
  platform: 'browser',
  jsx: 'automatic',
  sourcemap: 'inline',
});

// Arrancar el servidor de esbuild
const { host, port: esbuildPort } = await ctx.serve({ servedir: path.join(root, 'dist') });

// Proxy HTTP que inyecta el HTML shell
const PORT = 3000;
const HTML_SHELL = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>NexUS — Product Backlog [DEV]</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#09090b;color:#e2e8f0;font-family:"Inter","Segoe UI",system-ui,sans-serif}
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-track{background:#18181b}
    ::-webkit-scrollbar-thumb{background:#3f3f46;border-radius:3px}
    #root{min-height:100vh}
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="/_dev_bundle.js"></script>
</body>
</html>`;

http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_SHELL);
    return;
  }
  // Proxy al servidor de esbuild
  const proxy = http.request({ host, port: esbuildPort, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  req.pipe(proxy);
}).listen(PORT, () => {
  console.log(`✅ Dev server en http://localhost:${PORT}`);
  console.log(`   Edita src/nexus-backlog.jsx y recarga el navegador`);
  console.log(`   Ctrl+C para parar`);
});

// Limpiar al salir
process.on('SIGINT', () => {
  fs.rmSync(entryPath, { force: true });
  fs.rmSync(path.join(root, 'dist', '_dev_bundle.js'), { force: true });
  process.exit(0);
});
