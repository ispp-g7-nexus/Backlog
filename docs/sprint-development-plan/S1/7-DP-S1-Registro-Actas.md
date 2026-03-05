# Registro de Actas — Sprint 1 – NexUS

<p align="center">
  <img src="../../images/logo-app.png" alt="Logo NexUS" width="500">
</p>

<div align="center">

<p>
  <img src="https://img.shields.io/badge/Versión-1.2.0-blue?style=flat-square" alt="Versión">
  <img src="https://img.shields.io/badge/Estado-Finalizado-green?style=flat-square" alt="Estado">
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
| 1.0.0 | 19/02/2026 | Creación y Acta de Inicio Presencial |
| 1.1.0 | 25/02/2026 | Incorporación de Acta de Crisis del Stack (Reunión Extraordinaria) |
| 1.2.0 | 05/03/2026 | Cierre de Sprint: Registro de Weekly, Review y Retrospectiva |

---

## Índice

1. [Acta S1-01 — Inicio Presencial y Planning](#acta-s1-01--inicio-presencial-y-planning)
2. [Acta S1-02 — Sincronización del Stack Tecnológico](#acta-s1-02--sincronización-del-stack-tecnológico)
3. [Acta S1-03 — Sprint Weekly y Seguimiento](#acta-s1-03--sprint-weekly-y-seguimiento)
4. [Acta S1-04 — Sprint Review y Retrospectiva](#acta-s1-04--sprint-review-y-retrospectiva)

---

## Acta S1-01 — Inicio Presencial y Planning

| Campo | Valor |
|-------|-------|
| **Fecha** | 19/02/2026 |
| **Tipo** | Reunión Presencial / Sprint Planning |
| **Referencia Backlog** | NX-S1.56, NX-S1.68, NX-S1.67 |
| **Asistentes** | Equipo Completo (21 miembros) |

### Agenda
1. Presentación de los subgrupos (A, B, C, D).
2. Definición del flujo de trabajo en GitHub Projects.
3. Instalación masiva de entornos locales.

### Resumen y Decisiones
- Se formaliza la división en 4 células de trabajo para evitar colisiones de código.
- Se acuerda el uso de **GitHub Projects** para el tablón Kanban (`NX-S1.67`).
- Se establece que la prioridad de la semana 1 es la infraestructura y el entorno de Docker (`NX-S1.71`).

---

## Acta S1-02 — Sincronización del Stack Tecnológico

| Campo | Valor |
|-------|-------|
| **Fecha** | 25/02/2026 |
| **Tipo** | Reunión Técnica de Emergencia |
| **Referencia Backlog** | NX-S1.75, NX-S1.74, NX-S1.72 |
| **Asistentes** | Coordinadores y Desarrolladores Backend |

### Agenda
1. Análisis de bloqueos por el proyecto base heredado.
2. Estandarización de APIs.

### Resumen y Decisiones
- **Resolución Crítica:** Ante fallos masivos de entorno, se decide revertir el backend del proyecto base para estabilizarlo (`NX-S1.74`).
- Se aprueba la creación de un manual técnico para la estandarización de APIs (`NX-S1.72`), permitiendo al Frontend trabajar de forma independiente mediante contratos de datos definidos.

---

## Acta S1-03 — Sprint Weekly y Seguimiento

| Campo | Valor |
|-------|-------|
| **Fecha** | 26/02/2026 y 27/02/2026 |
| **Tipo** | Sprint Weekly / Coordinación de Coordinadores |
| **Referencia Backlog** | NX-S1.58, NX-S1.59, NX-S1.11 |
| **Asistentes** | Coordinadores de equipos y Scrum Master |

### Agenda
1. Estado de las Historias de Usuario (HU).
2. Gestión de bloqueos (Diseño y Modelo ER).

### Resumen y Decisiones
- Se detecta retraso en la entrega del Modelo Entidad-Relación (`NX-S1.78`). Se insta al equipo responsable a priorizarlo para no frenar las migraciones.
- Se valida el progreso de los Wireframes (`NX-S1.11`) para asegurar que el desarrollo visual sigue la línea de Figma.

---

## Acta S1-04 — Sprint Review y Retrospectiva

| Campo | Valor |
|-------|-------|
| **Fecha** | 04/03/2026 - 05/03/2026 |
| **Tipo** | Sprint Review y Retrospective |
| **Referencia Backlog** | NX-S1.55, NX-S1.83, NX-S1.52 |
| **Asistentes** | Equipo Completo |

### Agenda
1. Demo de funcionalidades terminadas.
2. Análisis de métricas (Burndown Chart y Clockify).
3. Dinámica de mejora continua.

### Resumen y Decisiones
- **Review:** Se validan 41 tareas como completadas. El módulo de matching IA queda en revisión por su complejidad técnica (`NX-S1.41`).
- **Retrospective:**
    - **Puntos Positivos:** La segmentación en equipos A-D ha funcionado perfectamente para la coordinación. La resolución del stack permitió a todos trabajar.
    - **Puntos a mejorar:** El retraso en el Modelo ER fue el mayor bloqueo; para el S2 el diseño de DB debe ser previo a cualquier código.
- Se cierra el sprint generando el **Burndown Chart** final (`NX-S1.52`) y el registro de lecciones aprendidas (`NX-S1.65`).

---

*Nota: Todas las reuniones han sido documentadas y contrastadas con los registros de tiempos de Clockify y el historial de cambios de GitHub.*