# Lista de Bloqueos — Sprint 1 – NexUS

<p align="center">
  <img src="../../images/logo-app.png" alt="Logo NexUS" width="500">
</p>

<div align="center">

<p>
  <img src="https://img.shields.io/badge/Versión-1.3.0-blue?style=flat-square" alt="Versión">
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

## Historial de versiones

| Versión | Fecha | Cambio principal |
|---------|-------|------------------|
| 1.0.0 | 19/02/2026 | Creación del documento |
| 1.1.0 | 26/02/2026 | Actualización tras reestructuración de equipos y stack |
| 1.2.0 | 04/03/2026 | Incorporación de bloqueos de diseño y comunicaciones |
| 1.3.0 | 05/03/2026 | Inclusión de bloqueo de Modelo ER y validación estratégica |

---

## Índice

1. [Descripción](#1-descripción)
2. [Tabla de bloqueos](#2-tabla-de-bloqueos)
3. [Resumen por impacto](#3-resumen-por-impacto)
4. [Resoluciones y validación estratégica](#4-resoluciones-y-validación-estratégica)
5. [Lecciones aprendidas](#5-lecciones-aprendidas)

---

## 1. Descripción

Este documento registra los impedimentos detectados durante el **Sprint 1**. Debido a la magnitud del equipo (21 personas) y la complejidad técnica inicial, el enfoque se desplazó de la implementación pura a la resolución de conflictos de infraestructura, cambios en el stack tecnológico y la organización del backlog tras la división en subgrupos (A, B, C, D).

---

## 2. Tabla de bloqueos

| ID | Descripción del Bloqueo | Estado | Responsable | Fecha Res. | Impacto | Historia Afectada |
|:---|:---|:---:|:---|:---:|:---:|:---|
| **BLQ-001** | **Bloqueo crítico de migraciones:** Incompatibilidad de esquemas al inicializar la BD. Fallo masivo en la consistencia de datos iniciales. | 🟡 | Equipo D | 03/03/2026 | 🔴 Alto | NX-S1.03 |
| **BLQ-002** | **Desfase UI Figma:** Los diseños no coincidían con las capacidades de los componentes frontend, retrasando wireframes. | 🟡 | Todos | 20/02/2026 | 🔴 Alto | NX-S1.11 |
| **BLQ-003** | **Pivotaje tecnológico:** Cambios en el stack obligaron a revertir el backend base y editar tutoriales. | ✅ | Equipo A/D | 23/02/2026 | 🔴 Alto | NX-S1.74, NX-S1.75 |
| **BLQ-004** | **Bloqueo organizativo:** Descoordinación inicial. Necesidad de separar en subgrupos y organizar el Backlog en GitHub. | ✅ | Coordinación | 20/02/2026 | 🟡 Medio | NX-S1.67, NX-S1.80 |
| **BLQ-005** | **Bloqueo en comunicaciones:** Flujo deficiente. Retraso en validación de PRs y criterios de API unificados. | ✅ | Todos | 20/02/2026 | 🟡 Medio | NX-S1.59, NX-S1.72 |
| **BLQ-006** | **Cambio en backlog original:** Detección de HU faltantes (landing, seeders) que obligaron a reajustar el alcance. | ✅ | Coordinación | 02/03/2026 | 🟢 Bajo | Infraestructura |
| **BLQ-007** | **Retraso en modelo entidad-relación:** Ausencia del diagrama ER definitivo solicitado a inicio del sprint, recibido con demora crítica. | ✅ | Equipo D | 02/03/2026 | 🔴 Alto | NX-S1.78, NX-S1.03 |

---

## 3. Resumen por impacto

| Impacto | Total | Resueltos | Pendientes |
|---------|-------|-----------|------------|
| 🔴 Alto | 4 | 2 | 2 |
| 🟡 Medio | 2 | 2 | 0 |
| 🟢 Bajo | 1 | 1 | 0 |
| **Total** | **7** | **5** | **2** |

---

## 4. Resoluciones y validación estratégica

A raíz de los bloqueos, se han tomado decisiones que consideramos **acertadas y vitales** para la escalabilidad:

* **Segmentación funcional (Células A, B, C, D):** Una política **excelente**. Permite que el Equipo B (Panel) avance sin depender de que el Equipo D (Infra) resuelva el motor de matching.
* **Estandarización de APIs (`NX-S1.72`):** Resolución **crítica**. Al definir el contrato antes de programar, el Frontend puede trabajar con datos mockeados, mitigando el impacto del retraso en el Modelo ER y las migraciones.
* **Infraestructura congelada (`NX-S1.74`):** Decisión **muy acertada**. Es preferible perder dos días alineando el stack que dos semanas arreglando errores de entorno locales por cada uno de los 21 miembros.



---

## 5. Lecciones aprendidas

1. **Estandarización técnica:** El documento de APIs fue la llave para desbloquear el desarrollo paralelo. Sin contrato de datos, el equipo se detiene.
2. **Dependencia de diseño:** El retraso en el **Modelo ER (BLQ-007)** demostró que la arquitectura de datos debe ser la prioridad absoluta en la primera semana; de lo contrario, las migraciones de BD se vuelven un "infierno" de versiones incompatibles.
3. **Agilidad en la estructura:** La división en subgrupos con reuniones específicas redujo drásticamente el ruido de comunicación.