# Guía de contribución — NexUS Backlog

## Flujo de trabajo

```
Editar src/nexus-backlog.jsx
        ↓
  git push → main
        ↓
  GitHub Actions compila automáticamente
        ↓
  GitHub Pages actualizado (~60 segundos)
```

## Reglas

- **Nunca edites** `dist/nexus-backlog.html` ni `docs/index.html` directamente
- **Un PR por sprint** para cambios de backlog grandes (reorganizaciones, nuevos módulos)
- **Push directo a main** para cambios pequeños (corrección de títulos, tallas, MoSCoW)
- El archivo `data/nexus-backlog.json` se regenera desde el JSX — no lo edites a mano

## Cómo añadir una tarea nueva

Abre `src/nexus-backlog.jsx` y añade un objeto al array `BACKLOG`:

```js
{ id:"NX-S1.43", sprint:1, area:"Infraestructura", tag:"Nuevo",
  title:"Descripción de la tarea",
  moscow:"M",   // M | S | C | W
  size:"M",     // XS(2h) | S(4h) | M(8h) | L(16h) | XL(24h)
  role:"Dev" }, // Dev | Equipo | SM | PO
```

Luego añade el nodo al grafo en `GNODES` si tiene dependencias.

## Equivalencia de tallas

| Talla | Horas | Descripción |
|-------|-------|-------------|
| XS | 2h | Tarea trivial (config, docs menores) |
| S  | 4h | Medio día de trabajo |
| M  | 8h | Un día completo |
| L  | 16h | Dos días |
| XL | 24h | Tres días o más |

## Tags de Clockify

Al registrar tiempo en Clockify, añadir el tag `NX-S{sprint}.{num}` correspondiente.  
Ejemplo: trabajando en la tarea `NX-S1.5` → tag `NX-S1.5`
