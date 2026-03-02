<h1>Plantilla — Velocity Chart – NexUS</h1>

<p align="center">
  <img src="../../images/logo-app.png" alt="Logo NexUS" width="500">
</p>

<div align="center">

<p>
  <img src="https://img.shields.io/badge/Versión-2.0.0-blue?style=flat-square" alt="Versión">
  <img src="https://img.shields.io/badge/Estado-Plantilla-grey?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Grupo-7--NexUS-green?style=flat-square" alt="Grupo">
  <img src="https://img.shields.io/badge/Asignatura-ISPP-red?style=flat-square" alt="Asignatura">
</p>

</div>

---

**Proyecto:** NexUS
**Grupo:** 7 - NexUS
**Asignatura:** Ingeniería del Software y Práctica Profesional (ISPP)
**Institución:** ETSII – Universidad de Sevilla
**Curso académico:** 2025/2026

<p align="center">
  <img src="../../images/logo-etsii.jpe" alt="Logo ETSII" width="400">
</p>

---

## Historial de Versiones

| Versión | Fecha | Cambio principal |
|---------|-------|------------------|
| 1.0.0 | DD/MM/AAAA | Creación del documento |
| 2.0.0 | DD/MM/AAAA | Añadidas métricas de horas Clockify y rendimiento |

---

## Índice

1. [Descripción](#1-descripción)
2. [Tabla de Velocidad por Sprint — Story Points](#2-tabla-de-velocidad-por-sprint--story-points)
3. [Tabla de Velocidad por Sprint — Horas](#3-tabla-de-velocidad-por-sprint--horas)
4. [Gráfico ASCII](#4-gráfico-ascii)
5. [Análisis de Velocidad](#5-análisis-de-velocidad)

---

## 1. Descripción

El Velocity Chart muestra la capacidad entregada por sprint, permitiendo al equipo y al Scrum Master estimar la capacidad real para planificar sprints futuros.

Se registran **dos dimensiones de velocidad**:

- **Story Points (SP):** métrica de planificación ágil clásica — los SP completados (aceptados según Definition of Done).
- **Horas estimadas de tareas Done:** métrica de valor entregado en horas — las horas estimadas de las historias marcadas como Done. Más precisa que los SP al reflejar el esfuerzo real acordado.
- **Horas Clockify:** horas efectivamente registradas en Clockify — el esfuerzo real invertido, independientemente de si las tareas están Done o no.
- **Rendimiento:** ratio entre horas estimadas de tareas Done y horas Clockify registradas. Indica la eficiencia del sprint (>100% = equipo más eficiente de lo esperado, <100% = más esfuerzo del planificado).

**Nota:** La velocidad se calcula sobre los ítems efectivamente completados (aceptados según Definition of Done), no los iniciados.

---

## 2. Tabla de Velocidad por Sprint — Story Points

| Sprint | Período | SP Planificados | SP Completados | % Completado | Velocidad Acumulada Media |
|--------|---------|-----------------|----------------|--------------|--------------------------|
| Sprint 1 | 19/02 – 05/03/2026 | — | — | — | — |
| Sprint 2 | 12/03 – 26/03/2026 | — | — | — | — |
| Sprint 3 | 02/04 – 16/04/2026 | — | — | — | — |

---

## 3. Tabla de Velocidad por Sprint — Horas

| Sprint | H. Estimadas Totales | H. Estimadas Done | H. Clockify | Rendimiento | % Cobertura Etiquetado |
|--------|---------------------|-------------------|-------------|-------------|------------------------|
| Sprint 1 | — h | — h | — h | — % | — % |
| Sprint 2 | — h | — h | — h | — % | — % |
| Sprint 3 | — h | — h | — h | — % | — % |

> **H. Estimadas Done:** suma de horas estimadas de tareas en estado Done.
> **H. Clockify:** horas registradas en el proyecto del sprint en Clockify (independiente del estado de las tareas).
> **Rendimiento:** `(H. Estimadas Done / H. Clockify) × 100`. Un valor >100% indica que el equipo completó más valor estimado del que necesitó invertir en tiempo real.
> **% Cobertura Etiquetado:** porcentaje de horas Clockify correctamente etiquetadas con ID de tarea o área.

---

## 4. Gráfico ASCII

```
SP / h
XX |████░░░░
   |████░░░░
   |████████
   |████████
   |████████
   |████████
   |████████
 0 +---S1---S2---S3---

   ████ Completados / Done
   ░░░░ No completados / diferidos
```

---

## 5. Análisis de Velocidad

### Story Points

| Métrica | Valor |
|---------|-------|
| Velocidad media (SP/sprint) | — |
| Sprint con mayor velocidad SP | — |
| Sprint con menor velocidad SP | — |
| Tendencia SP | — |
| Estimación para siguiente sprint | ~ — SP |

### Horas

| Métrica | Valor |
|---------|-------|
| H. estimadas Done media (h/sprint) | — h |
| Rendimiento medio | — % |
| Sprint con mayor rendimiento | — |
| Sprint con menor rendimiento | — |
| % Cobertura etiquetado medio | — % |
| Estimación H. Done siguiente sprint | ~ — h |

**Observaciones:**
- [Observación sobre la evolución de la velocidad en SP entre sprints]
- [Observación sobre rendimiento (horas Done vs Clockify)]
- [Factores que han afectado positiva o negativamente a la velocidad]
- [Estado de la cobertura de etiquetado y su evolución]

**Estimación para el siguiente sprint:**
- Velocidad esperada: ~ X SP (basada en la media de los últimos N sprints)
- H. estimadas Done esperadas: ~ X h
- H. Clockify estimadas: ~ X h (asumiendo rendimiento similar)
