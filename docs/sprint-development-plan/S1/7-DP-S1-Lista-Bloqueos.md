<h1>Lista de Bloqueos — Sprint 1 – NexUS</h1>

<p align="center">
  <img src="../../images/logo-app.png" alt="Logo NexUS" width="500">
</p>

<div align="center">

<p>
  <img src="https://img.shields.io/badge/Versión-1.0.0-blue?style=flat-square" alt="Versión">
  <img src="https://img.shields.io/badge/Estado-Completado-yellow?style=flat-square" alt="Estado">
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
**Sprint:** S1 — 19/02/2026 al 05/03/2026

<p align="center">
  <img src="../../images/logo-etsii.jpe" alt="Logo ETSII" width="400">
</p>

---

## Historial de Versiones

| Versión | Fecha | Cambio principal |
|---------|-------|------------------|
| 1.0.0 | 19/02/2026 | Creación del documento |
| 1.1.0 | 01/03/2026 | Añadidos bloqueos de entorno resueltos |
| 1.2.0 | 05/03/2026 | Cierre del sprint, estado final |

---

## Índice

1. [Descripción](#1-descripción)
2. [Tabla de Bloqueos](#2-tabla-de-bloqueos)
3. [Resumen por Impacto](#3-resumen-por-impacto)

---

## 1. Descripción

Registro de todos los impedimentos detectados durante el Sprint 1, centrado en la puesta en marcha de la infraestructura base del proyecto. La mayoría de bloqueos se concentraron en la primera semana del sprint (19-25 Feb), durante la configuración del stack tecnológico.

---

## 2. Tabla de Bloqueos

| ID | Descripción | Estado | Responsable | Fecha Detección | Fecha Resolución | Impacto | Historia Afectada |
|----|-------------|--------|-------------|-----------------|------------------|---------|-------------------|
| BLQ-001 | Puerto 5432 ocupado por instalación nativa de PostgreSQL en el host Windows. El healthcheck del contenedor `nexus_postgres` fallaba impidiendo arrancar el backend y los workers. | ✅ Resuelto | Alejandro de los Reyes | 19/02/2026 | 01/03/2026 | 🔴 Alto | S1-01, S1-05 |
| BLQ-002 | WSL2 sin límites de memoria configurados. El proceso `vmmem` consumía hasta 6 GB de RAM en un equipo con 8 GB, haciendo el equipo inutilizable durante el desarrollo con Docker activo. | ✅ Resuelto | Carlos Gallero | 19/02/2026 | 01/03/2026 | 🔴 Alto | S1-01 |
| BLQ-003 | Branch protection en `main`, `develop` y `release/*` pendiente de configurar. Requiere Personal Access Token (PAT) con permisos `contents` y `pull-requests`. Sin ello el workflow `release-please` no funciona. | 🚫 Abierto | Manuel Niza (SM) | 19/02/2026 | — | 🟡 Medio | S1-02, S1-03 |
| BLQ-004 | El frontend tardaba ~3 minutos en estar disponible tras `docker compose up -d` por la ejecución de `npm ci` al arrancar. Generaba confusión en el equipo pensando que el despliegue había fallado (error 502). | ✅ Resuelto | Marta Recio | 20/02/2026 | 23/02/2026 | 🟢 Bajo | S1-01 |
| BLQ-005 | El healthcheck de PostgreSQL fallaba por timeout en la primera inicialización del esquema. El contenedor tardaba más de 50 segundos (10 reintentos × 5s) en inicializar el cluster por primera vez. | ✅ Resuelto | Ignacio Martínez | 20/02/2026 | 20/02/2026 | 🟡 Medio | S1-05 |
| BLQ-006 | Ausencia de `RELEASE_PLEASE_TOKEN` como secreto en GitHub Actions. El workflow `release-please.yml` termina en estado neutro en lugar de crear PRs de release automáticamente. | 🚫 Abierto | Manuel Niza (SM) | 22/02/2026 | — | 🟢 Bajo | S1-03 |

---

## 3. Resumen por Impacto

| Impacto | Total | Resueltos | Pendientes |
|---------|-------|-----------|------------|
| 🔴 Alto | 2 | 2 | 0 |
| 🟡 Medio | 2 | 1 | 1 |
| 🟢 Bajo | 2 | 1 | 1 |
| **Total** | **6** | **4** | **2** |
