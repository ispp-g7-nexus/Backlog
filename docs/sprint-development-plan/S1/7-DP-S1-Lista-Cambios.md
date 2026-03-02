<h1>Lista de Cambios — Sprint 1 – NexUS</h1>

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
| 1.1.0 | 05/03/2026 | Cierre del sprint, registro completo |

---

## Índice

1. [Descripción](#1-descripción)
2. [Registro de Cambios](#2-registro-de-cambios)
3. [Resumen por Tipo](#3-resumen-por-tipo)

---

## 1. Descripción

Registro completo de cambios realizados en el Sprint 1. Este sprint estuvo centrado en la infraestructura base del proyecto: Docker Compose, CI/CD, autenticación, panel administrativo y sistema de incidencias.

---

## 2. Registro de Cambios

| ID | Fecha | Tipo | Descripción | Motivo | Responsable | Historia Relacionada |
|----|-------|------|-------------|--------|-------------|----------------------|
| CHG-001 | 19/02/2026 | `config` | Creación de estructura Docker Compose con servicios: postgres, redis, backend, celery_worker, celery_beat, frontend, tenant_gateway, nginx | Necesario para tener un entorno de desarrollo reproducible y consistente en todos los equipos | Alejandro de los Reyes | S1-01 |
| CHG-002 | 19/02/2026 | `config` | Configuración de Nginx como reverse proxy y tenant-gateway (Node.js) para inyección de contexto tenant | Arquitectura multitenant requiere resolución del tenant por cabecera Host antes de enrutar al frontend/backend | Alejandro de los Reyes | S1-01, S1-05 |
| CHG-003 | 19/02/2026 | `config` | Setup de Django 5 con django-tenants y multitenancy por esquema PostgreSQL | Requisito core de la plataforma: cada residencia tiene su propio esquema aislado | Ignacio Martínez | S1-01, S1-05 |
| CHG-004 | 19/02/2026 | `feat` | Workflows CI/CD en GitHub Actions: ci.yml (backend/frontend checks + compose validate), pr-title.yml (conventional commits), release-please.yml, promote-tag.yml, tagged-release.yml | Automatizar validaciones en cada PR y preparar pipeline de releases por entorno | Manuel Niza | S1-03 |
| CHG-005 | 19/02/2026 | `feat` | Seed demo automático al arrancar backend: crea tenant demo.nexus.local, admin y estudiante de prueba | Facilitar el desarrollo sin necesidad de crear datos manualmente en cada reset de BD | Ignacio Martínez | S1-05 |
| CHG-006 | 19/02/2026 | `docs` | README.md completo con arquitectura, stack, instrucciones de arranque, flujo HTTP y decisiones técnicas | Permitir que cualquier miembro del equipo configure el proyecto desde cero | Todo el equipo | S1-06 |
| CHG-007 | 19/02/2026 | `docs` | Guía de developer (7-DP-Developer-Guide.md) y guía de setup Docker (7-DP-Base-Setup-Docker-Compose.md) | Documentar el entorno de desarrollo para facilitar onboarding | Alejandro de los Reyes | S1-06 |
| CHG-008 | 20/02/2026 | `feat` | Sistema de autenticación JWT: registro, login, refresh token, logout con cookies HttpOnly | Requisito de seguridad: tokens en cookies evitan acceso desde JavaScript (XSS) | Ignacio Martínez | S1-07, S1-08 |
| CHG-009 | 21/02/2026 | `feat` | Gestión de roles RBAC: Admin, Estudiante, Personal con restricción de acceso por rol | Control de acceso a recursos según el rol del usuario autenticado | Juan José Cardesa | S1-10 |
| CHG-010 | 23/02/2026 | `feat` | Dashboard administrativo con métricas: nº estudiantes, habitaciones, incidencias abiertas, % ocupación | Proporcionar al administrador una visión general del estado de la residencia | Miguel Regidor | S1-12 |
| CHG-011 | 24/02/2026 | `feat` | CRUD completo de habitaciones: crear, editar, eliminar, con validaciones de capacidad y soft delete | Gestión básica del inventario de habitaciones de la residencia | Marta Recio | S1-13 |
| CHG-012 | 24/02/2026 | `feat` | Sistema de asignación de estudiantes a habitaciones con control de capacidad | Necesario para gestionar la ocupación real de la residencia | Celia Suárez | S1-14 |
| CHG-013 | 25/02/2026 | `feat` | Sistema de incidencias: creación por estudiante, vista admin, cambio de estado (Abierta/En progreso/Resuelta/Cerrada), filtrado | Funcionalidad core del MVP: los estudiantes deben poder reportar problemas | Paula Suárez | S1-17, S1-19, S1-20, S1-21 |
| CHG-014 | 26/02/2026 | `feat` | Perfil básico de usuario: ver y editar nombre, foto de perfil, datos personales | Los usuarios necesitan gestionar su información personal | Nicolás Gómez | S1-11 |
| CHG-015 | 26/02/2026 | `feat` | Sistema de diseño base: paleta de colores, tipografía, componentes reutilizables (Button, Input, Card, Table, Modal) | Base visual consistente para todo el frontend del sprint | Carolina Murillo, Olga Cantalejo | S1-22, S1-24 |
| CHG-016 | 27/02/2026 | `feat` | Wireframes en Figma de todas las pantallas principales: login, registro, dashboard, habitaciones, incidencias | Diseñar antes de implementar reduce reproceso y alinea al equipo visualmente | Carolina Murillo | S1-23 |
| CHG-017 | 27/02/2026 | `feat` | Listado paginado de estudiantes con filtros básicos (nombre, habitación, estado) | El admin necesita buscar y gestionar estudiantes fácilmente | Javier Castilla | S1-15, S1-16 |
| CHG-018 | 02/03/2026 | `feat` | Tests de integración básicos: endpoints de autenticación, CRUD habitaciones, flujos de incidencias | Garantizar que el código integrado funciona correctamente de extremo a extremo | Francisco de Castro | S1-25, S1-26 |
| CHG-019 | 01/03/2026 | `config` | Creación de `.wslconfig` con límites de memoria (3 GB) y CPU (2 cores) para WSL2 | El proceso vmmem consumía hasta 6 GB de RAM en equipos con 8 GB, haciendo imposible el desarrollo | Carlos Gallero | — |
| CHG-020 | 01/03/2026 | `config` | Añadido `demo.nexus.local` al hosts file de Windows | Permitir acceder al entorno de desarrollo con el dominio configurado sin necesitar DNS externo | Alejandro de los Reyes | — |
| CHG-021 | 03/03/2026 | `feat` | Historial de incidencias del estudiante: vista personal con ordenación por fecha y detalle de cada incidencia | Los estudiantes necesitan seguimiento de sus propias incidencias | Ángel Mateos | S1-18 |
| CHG-022 | 04/03/2026 | `fix` | Corrección del healthcheck de PostgreSQL: ajuste de retries y timeout para soportar primera inicialización del cluster | En primera ejecución, PostgreSQL tarda más de 50s en inicializar; con 10 retries fallaba antes de estar listo | Ignacio Martínez | S1-05 |

---

## 3. Resumen por Tipo

| Tipo | Cantidad |
|------|----------|
| `feat` | 15 |
| `fix` | 1 |
| `refactor` | 0 |
| `config` | 4 |
| `docs` | 2 |
| `scope` | 0 |
| **Total** | **22** |
