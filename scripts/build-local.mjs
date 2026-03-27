// Build local: produce dist/nexus-backlog.html (bundle único con JS + CSS inline)
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

// 1. Crear entry file en src/ (para que los imports relativos funcionen)
const entryPath = path.join(root, 'src', '_entry.jsx');
const srcPath   = path.join(root, 'src', 'nexus-backlog.jsx');
const src = fs.readFileSync(srcPath, 'utf-8')
  .replace(/^export default function App/m, 'function App');

fs.writeFileSync(entryPath,
  `import "./styles/index.css";\nimport { createRoot } from "react-dom/client";\n${src}\ncreateRoot(document.getElementById("root")).render(<App />);\n`
);

// 2. Bundle con esbuild (JS + CSS)
const bundleJsPath = path.join(root, 'dist', '_bundle.js');
const bundleCssPath = path.join(root, 'dist', '_bundle.css');
try {
  await build({
    entryPoints: [entryPath],
    bundle: true,
    outfile: bundleJsPath,
    platform: 'browser',
    jsx: 'automatic',
    minify: true,
    loader: { '.css': 'css' },
  });
} finally {
  fs.rmSync(entryPath, { force: true });
}

// 3. Ensamblar HTML
const bundleJs = fs.readFileSync(bundleJsPath, 'utf-8');
const bundleCss = fs.existsSync(bundleCssPath) ? fs.readFileSync(bundleCssPath, 'utf-8') : '';
fs.rmSync(bundleJsPath, { force: true });
if (fs.existsSync(bundleCssPath)) fs.rmSync(bundleCssPath, { force: true });

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>NexUS — Product Backlog</title>
  <style>${bundleCss}</style>
</head>
<body>
  <div id="root"></div>
  <script>${bundleJs}</script>
</body>
</html>`;

const outPath = path.join(root, 'dist', 'nexus-backlog.html');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`✅ Build listo: ${outPath} (${(html.length / 1024).toFixed(0)} KB)`);
