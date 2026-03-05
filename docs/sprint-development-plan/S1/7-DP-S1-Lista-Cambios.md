# Lista de Cambios — Sprint 1 – NexUS

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

## Historial de Versiones

| Versión | Fecha | Cambio principal |
|---------|-------|------------------|
| 1.0.0 | 19/02/2026 | Creación del documento |
| 1.1.0 | 05/03/2026 | Cierre del sprint, registro completo de cambios reales |

---

## Índice

1. [Descripción](#1-descripción)
2. [Registro de Cambios](#2-registro-de-cambios)
3. [Resumen por Tipo](#3-resumen-por-tipo)

---

## 1. Descripción

Este documento detalla los cambios realizados durante el Sprint 1. El foco principal ha sido la estabilización de la infraestructura base, la definición de estándares de comunicación (APIs) y el despliegue de los módulos core de Autenticación, Eventos y Gestión de Incidencias, superando bloqueos críticos de entorno y diseño.

---

## 2. Registro de Cambios

| ID | Fecha | Tipo | Descripción | Motivo | Responsable | Historia Relacionada |
|----|-------|------|-------------|--------|-------------|----------------------|
| CHG-001 | 19/02 | `config` | Setup de stack tecnológico, repositorios y estrategia de ramas | Base necesaria para el desarrollo colaborativo | Equipo D | NX-S1.01, NX-S1.03 |
| CHG-002 | 21/02 | `feat` | Implementación de Pipeline CI/CD básico y SonarQube | Garantizar la calidad de código y automatización de despliegues | Equipo D / B | NX-S1.02, NX-S1.42 |
| CHG-003 | 23/02 | `fix` | **Reversión de Backend:** Limpieza del proyecto base y edición de tutoriales | El código heredado causaba errores de entorno masivos; se priorizó la estabilidad | Equipo A / D | NX-S1.74, NX-S1.71 |
| CHG-004 | 24/02 | `feat` | Módulo completo de Autenticación (Login, Registro, Roles) | Seguridad core para diferenciar Residencia, Residente y Personal | Equipo C | NX-S1.06 - 08 |
| CHG-005 | 25/02 | `config` | **Estandarización de APIs:** Creación de documento de contratos de datos | Evitar que el frontend se bloquee por cambios en el esquema de la BD | Equipo B | NX-S1.72 |
| CHG-006 | 26/02 | `feat` | CRUD de Eventos, moderación y sistema de inscripción | Funcionalidad core de dinamización de la residencia | Equipo A | NX-S1.29 - 31 |
| CHG-007 | 27/02 | `feat` | Sistema de Incidencias (Creación y Vista Global con filtros) | Permitir a residentes reportar fallos y al staff gestionarlos | Equipo C | NX-S1.18, NX-S1.20 |
| CHG-008 | 01/03 | `feat` | CRUD de Objetos y condiciones de préstamo | Gestión de inventario compartido de la residencia | Equipo A | NX-S1.35 |
| CHG-009 | 02/03 | `feat` | Creación de Landing Page oficial NexUS | Presencia pública y presentación del producto | Equipo D | NX-S1.77 |
| CHG-010 | 03/03 | `feat` | Sistema de Avisos con notificaciones visuales | Comunicación urgente de la administración a residentes | Equipo C | NX-S1.23, NX-S1.24 |
| CHG-011 | 04/03 | `docs` | **Modelo Entidad-Relación (ER)** definitivo | Base de datos validada tras retraso inicial; desbloquea migraciones finales | Equipo D | NX-S1.78 |
| CHG-012 | 04/03 | `feat` | Interfaz de reserva de espacios y cancelación propia | Gestión de zonas comunes de la residencia | Equipo B | NX-S1.27, NX-S1.28 |
| CHG-013 | 05/03 | `docs` | Registro de lecciones aprendidas, contingencias y métricas Scrum | Documentación de cierre requerida para la retrospectiva | Equipo C / SM | NX-S1.65, NX-S1.83 |

---

## 3. Resumen por Tipo

| Tipo | Cantidad | Descripción |
|------|----------|-------------|
| `feat` | 8 | Funcionalidades de módulos terminadas. |
| `config` | 2 | Estándares de API y Setup de Repositorio. |
| `fix` | 1 | Reversión técnica para estabilidad. |
| `docs` | 2 | Modelo de datos y documentación de gestión. |
| **Total** | **13** | **Cambios significativos validados.** |