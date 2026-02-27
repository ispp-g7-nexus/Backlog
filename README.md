# NexUS — Product Backlog Manager

> Herramienta interna de gestión del backlog para el proyecto NexUS  
> Grupo 7 · ISPP 2025/26 · Universidad de Sevilla

[![Build & Deploy](https://github.com/TU-ORG/nexus-backlog/actions/workflows/build.yml/badge.svg)](https://github.com/TU-ORG/nexus-backlog/actions/workflows/build.yml)

---

## 📁 Estructura del repositorio

```
nexus-backlog/
├── src/
│   └── nexus-backlog.jsx        # Fuente React — aquí se hacen todos los cambios
├── data/
│   └── nexus-backlog.json       # Backlog exportado (usado por el script Python)
├── scripts/
│   └── nexus_clockify.py        # Genera informe Excel desde CSV de Clockify
├── dist/
│   └── nexus-backlog.html       # HTML compilado — NO editar directamente
├── docs/
│   └── index.html               # Copia para GitHub Pages (se actualiza sola)
└── .github/
    └── workflows/
        └── build.yml            # CI/CD: compila y publica en cada push a main
```

---

## 🌐 Acceso al backlog

El backlog está publicado en GitHub Pages y se actualiza automáticamente con cada push a `main`:

**→ [https://TU-ORG.github.io/nexus-backlog](https://TU-ORG.github.io/nexus-backlog)**

*(Reemplaza `TU-ORG` con el nombre real de la organización)*

---

## ✏️ Cómo editar el backlog

**Nunca edites `dist/` ni `docs/` directamente.** El único archivo fuente es:

```
src/nexus-backlog.jsx
```

Tras editar, el workflow de GitHub Actions compila y publica automáticamente.

### Editar en local

Requisitos: **Node.js ≥ 18**

```bash
# Instalar esbuild (solo la primera vez)
npm install -g esbuild

# Compilar
esbuild src/nexus-backlog.jsx \
  --bundle --outfile=dist/nexus-backlog.html \
  --platform=browser --jsx=automatic --minify

# Ver en local
python -m http.server 8080
# Abrir http://localhost:8080/dist/nexus-backlog.html
```

---

## ⏱️ Informe Clockify × Backlog

### Requisitos

```bash
pip install requests openpyxl
```

### Opción A — Script Python (informe Excel)

```bash
# Informe completo
python scripts/nexus_clockify.py \
  --api-key TU_API_KEY \
  --backlog data/nexus-backlog.json

# Solo Sprint 1
python scripts/nexus_clockify.py \
  --api-key TU_API_KEY \
  --sprint 1 \
  --start 2026-02-19T00:00:00Z \
  --end 2026-03-05T23:59:59Z
```

Genera `nexus_clockify_report.xlsx` con 4 hojas:
- 📊 Resumen por sprint
- 📋 Horas reales vs estimadas por tarea
- 👥 Horas por persona
- ⚠️ Alertas (tareas en riesgo o excedidas)

### Opción B — Pestaña CSV en el HTML

1. En Clockify → **Reports → Detailed** → selecciona el rango → **Export → CSV**
2. Abre el backlog en el navegador
3. Ve a la pestaña **📊 Informe CSV**
4. Arrastra el archivo CSV

---

## 🏷️ Formato de tags en Clockify

Cada miembro del equipo debe añadir el tag de la tarea al registrar tiempo:

| Tarea | Tag en Clockify |
|-------|----------------|
| Infraestructura | `NX-S1.1` |
| Autenticación   | `NX-S1.2` |
| ...             | `NX-S{sprint}.{num}` |

El sistema detecta automáticamente el ID desde el campo Tags del CSV.

---

## 👥 Equipo

| Rol | Persona |
|-----|---------|
| Scrum Master | Manuel Jesús Niza Cobo |
| Product Owner | Miguel Regidor García |
| Coord. Equipo A | Alejandro de los Reyes |
| Coord. Equipo B | Ignacio Martínez |
| Coord. Equipo C | Marta Recio |
| Coord. Equipo D | Carlos Gallero |

---

## 📋 Sprints

| Sprint | Fechas | Peso | Tareas |
|--------|--------|------|--------|
| S1 | 19 feb – 5 mar | 10% | 62 |
| S2 | 12 mar – 26 mar | 15% | 45 |
| S3 | 2 abr – 16 abr | 30% | 39 |
