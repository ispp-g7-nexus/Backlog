// Build local: replica lo que hace el CI, produce dist/nexus-backlog.html
import { execSync } from 'child_process';
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
  `import { createRoot } from "react-dom/client";\n${src}\ncreateRoot(document.getElementById("root")).render(<App />);\n`
);

// 2. Bundle con esbuild
const bundlePath = path.join(root, 'dist', '_bundle.js');
try {
  execSync(
    `npx esbuild "${entryPath}" --bundle --outfile="${bundlePath}" --platform=browser --jsx=automatic --minify`,
    { stdio: 'inherit' }
  );
} finally {
  fs.rmSync(entryPath, { force: true });
}

// 3. Ensamblar HTML
const bundle = fs.readFileSync(bundlePath, 'utf-8');
fs.rmSync(bundlePath, { force: true });

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>NexUS — Product Backlog</title>
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
  <script>${bundle}</script>
</body>
</html>`;

const outPath = path.join(root, 'dist', 'nexus-backlog.html');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`✅ Build listo: ${outPath} (${(html.length / 1024).toFixed(0)} KB)`);
