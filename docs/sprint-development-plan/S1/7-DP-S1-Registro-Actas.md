<h1>Registro de Actas — Sprint 1 – NexUS</h1>

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
| 1.1.0 | 26/02/2026 | Añadida acta de revisión semanal |
| 1.2.0 | 05/03/2026 | Añadidas actas de review y retrospectiva |

---

## Índice

1. [Acta S1-01 — Sprint Planning](#acta-s1-01--sprint-planning)
2. [Acta S1-02 — Revisión Semanal](#acta-s1-02--revisión-semanal)
3. [Acta S1-03 — Sprint Review](#acta-s1-03--sprint-review)
4. [Acta S1-04 — Sprint Retrospective](#acta-s1-04--sprint-retrospective)

---

## Acta S1-01 — Sprint Planning

| Campo | Valor |
|-------|-------|
| Tipo | Sprint Planning |
| Fecha | 19/02/2026 |
| Hora | 09:00 – 11:30 |
| Lugar / Canal | Presencial – ETSII, Sala de reuniones |
| Facilitador | Manuel Jesús Niza Cobo (Scrum Master) |
| Asistentes | Todos los miembros del equipo (21) |
| Ausencias | Ninguna |

### Agenda
1. Presentación del Sprint 1 y sus objetivos por el Product Owner
2. Revisión del backlog priorizado (26 historias de usuario)
3. Estimación de story points por historia (Planning Poker)
4. Asignación de módulos por equipo
5. Definición de Definition of Done para el sprint

### Resumen
Se presentó el Sprint 1 centrado en las funcionalidades core del MVP: infraestructura, autenticación, panel administrativo básico y sistema de incidencias. El Product Owner (Miguel Regidor) expuso las prioridades MoSCoW. Se realizó estimación con Planning Poker para las 26 historias y se asignaron módulos completos a cada equipo.

### Decisiones Tomadas
- Equipo A se encarga de infraestructura (S1-01 a S1-06) y partes de autenticación
- Equipo B se encarga de autenticación completa (S1-07 a S1-11) y dashboard (S1-12)
- Equipo C se encarga del sistema de incidencias (S1-17 a S1-21) y UX/UI (S1-22, S1-23)
- Equipo D se encarga de gestión de habitaciones (S1-13 a S1-16) y testing (S1-25, S1-26)
- Se acuerda rama de trabajo: `sprint/s1` como rama base de integración
- Todos los PRs deben tener título en formato Conventional Commits
- La semana 1 (19-25 Feb) se dedicará prioritariamente a infraestructura

### Historias Comprometidas
| Historia | Descripción | Equipo | SP | Prioridad |
|----------|-------------|--------|----|-----------|
| S1-01 | Configuración del Stack Tecnológico | A | 5 | Must |
| S1-02 | Repositorios y Estrategia de Ramas | A | 3 | Must |
| S1-03 | Pipeline CI/CD Básico | A | 5 | Must |
| S1-04 | Despliegue en Entornos | A | 5 | Must |
| S1-05 | Configuración de Base de Datos | A | 5 | Must |
| S1-06 | Documentación Técnica Inicial | A | 2 | Could |
| S1-07 | Registro de Usuarios | B | 3 | Must |
| S1-08 | Login de Usuarios | B | 3 | Must |
| S1-09 | Recuperación de Contraseña | B | 5 | Should |
| S1-10 | Gestión de Roles de Usuario | B | 3 | Must |
| S1-11 | Perfil Básico Usuario | B | 2 | Should |
| S1-12 | Dashboard Administrativo Inicial | B | 3 | Must |
| S1-13 | CRUD de Habitaciones | D | 5 | Must |
| S1-14 | Asignación Estudiantes a Habitaciones | D | 3 | Must |
| S1-15 | Listado Completo de Estudiantes | D | 2 | Should |
| S1-16 | Visualización Ocupación Residencia | D | 2 | Should |
| S1-17 | Creación de Incidencias | C | 5 | Must |
| S1-18 | Historial de Incidencias del Estudiante | C | 3 | Should |
| S1-19 | Vista Admin de Todas las Incidencias | C | 3 | Must |
| S1-20 | Cambio de Estado de Incidencia | C | 3 | Must |
| S1-21 | Filtrado de Incidencias | C | 3 | Should |
| S1-22 | Definir Paleta y Tipografía Base | C | 3 | Must |
| S1-23 | Wireframes Pantallas Principales | C | 5 | Could |
| S1-24 | Sistema Inicial de Componentes Reutilizables | C | 5 | Should |
| S1-25 | Casos de Prueba Funcionales | D | 3 | Must |
| S1-26 | Testing de Integración Básico | D | 5 | Should |
| **Total** | | | **80 SP** | |

### Puntos de Acción
| Acción | Responsable | Fecha límite |
|--------|-------------|--------------|
| Configurar rama `sprint/s1` en GitHub | Alejandro de los Reyes | 19/02/2026 |
| Enviar credenciales de entorno a todos los miembros | Ignacio Martínez | 19/02/2026 |
| Crear board de GitHub Projects con las historias | Manuel Niza | 20/02/2026 |

---

## Acta S1-02 — Revisión Semanal

| Campo | Valor |
|-------|-------|
| Tipo | Revisión Semanal (Coordinadores Técnicos) |
| Fecha | 26/02/2026 |
| Hora | 10:00 – 11:00 |
| Lugar / Canal | Discord – Canal #coordinadores |
| Facilitador | Manuel Jesús Niza Cobo (Scrum Master) |
| Asistentes | Alejandro de los Reyes (A), Ignacio Martínez (B), Marta Recio (C), Carlos Gallero (D), Manuel Niza (SM), Miguel Regidor (PO) |
| Ausencias | Ninguna |

### Agenda
1. Progreso por equipo (historias completadas vs planificadas)
2. Bloqueos activos
3. Riesgos para la segunda semana
4. Ajustes de asignación si necesario

### Estado por Equipo

| Equipo | SP completados | SP en curso | SP pendientes | Bloqueos |
|--------|---------------|-------------|---------------|----------|
| Equipo A (Infra) | 20/20 SP | 0 | 0 | BLQ-001 resuelto |
| Equipo B (Auth) | 11/16 SP | 5 | 0 | Ninguno |
| Equipo C (Incidencias/UX) | 8/19 SP | 8 | 3 | Ninguno |
| Equipo D (Habitaciones) | 10/25 SP | 10 | 5 | Ninguno |

### Bloqueos Detectados
- BLQ-003 (branch protection) — Manuel Niza — Pendiente PAT, sin impacto en desarrollo
- BLQ-006 (RELEASE_PLEASE_TOKEN) — Manuel Niza — Pendiente, sin impacto en desarrollo

### Puntos de Acción
| Acción | Responsable | Fecha límite |
|--------|-------------|--------------|
| Completar historias de autenticación (S1-09, S1-10, S1-11) | Ignacio Martínez | 04/03/2026 |
| Avanzar en historias de incidencias semana 2 | Marta Recio | 04/03/2026 |
| Completar CRUD habitaciones y asignación | Carlos Gallero | 04/03/2026 |
| Gestionar PAT para branch protection | Manuel Niza | 12/03/2026 |

---

## Acta S1-03 — Sprint Review

| Campo | Valor |
|-------|-------|
| Tipo | Sprint Review |
| Fecha | 05/03/2026 |
| Hora | 09:00 – 10:30 |
| Lugar / Canal | Presencial – ETSII, Aula de clase |
| Facilitador | Manuel Jesús Niza Cobo (Scrum Master) |
| Asistentes | Todo el equipo (21) + profesores ISPP |
| Ausencias | Ninguna |

### Agenda
1. Presentación de SP planificados vs completados
2. Demo funcional: login, dashboard, habitaciones, incidencias
3. Validación del Product Owner
4. Historias diferidas

### Historias Completadas (24/26)
| Historia | Descripción | Equipo | SP | Estado |
|----------|-------------|--------|----|--------|
| S1-01 | Configuración del Stack Tecnológico | A | 5 | ✅ |
| S1-02 | Repositorios y Estrategia de Ramas | A | 3 | ✅ |
| S1-03 | Pipeline CI/CD Básico | A | 5 | ✅ |
| S1-04 | Despliegue en Entornos | A | 5 | ✅ |
| S1-05 | Configuración de Base de Datos | A | 5 | ✅ |
| S1-06 | Documentación Técnica Inicial | A | 2 | ✅ |
| S1-07 | Registro de Usuarios | B | 3 | ✅ |
| S1-08 | Login de Usuarios | B | 3 | ✅ |
| S1-10 | Gestión de Roles de Usuario | B | 3 | ✅ |
| S1-11 | Perfil Básico Usuario | B | 2 | ✅ |
| S1-12 | Dashboard Administrativo Inicial | B | 3 | ✅ |
| S1-13 | CRUD de Habitaciones | D | 5 | ✅ |
| S1-14 | Asignación Estudiantes a Habitaciones | D | 3 | ✅ |
| S1-15 | Listado Completo de Estudiantes | D | 2 | ✅ |
| S1-17 | Creación de Incidencias | C | 5 | ✅ |
| S1-18 | Historial de Incidencias del Estudiante | C | 3 | ✅ |
| S1-19 | Vista Admin de Todas las Incidencias | C | 3 | ✅ |
| S1-20 | Cambio de Estado de Incidencia | C | 3 | ✅ |
| S1-21 | Filtrado de Incidencias | C | 3 | ✅ |
| S1-22 | Definir Paleta y Tipografía Base | C | 3 | ✅ |
| S1-23 | Wireframes Pantallas Principales | C | 5 | ✅ |
| S1-24 | Sistema Inicial de Componentes Reutilizables | C | 5 | ✅ |
| S1-25 | Casos de Prueba Funcionales | D | 3 | ✅ |
| S1-26 | Testing de Integración Básico | D | 5 | ✅ |

### Historias Diferidas (2/26)
| Historia | Descripción | SP | Motivo | Destino |
|----------|-------------|-----|--------|---------|
| S1-09 | Recuperación de Contraseña | 5 | Pendiente configuración servidor de email (SMTP) | Backlog S2 |
| S1-16 | Visualización Ocupación Residencia (gráfico avanzado) | 1 | Funcionalidad básica integrada en dashboard; gráfico avanzado se pospone | Backlog S2 |

### Feedback del Product Owner
- La demo del sistema de incidencias es funcional y cubre los requisitos del MVP
- El dashboard administrativo es visualmente claro y muestra las métricas necesarias
- Se solicita para S2 incluir notificaciones al estudiante cuando cambia el estado de su incidencia
- El sistema de autenticación con JWT y roles funciona correctamente

### Puntos de Acción
| Acción | Responsable | Fecha límite |
|--------|-------------|--------------|
| Incorporar S1-09 y S1-16 al backlog de S2 | Miguel Regidor (PO) | 12/03/2026 |
| Añadir notificaciones de incidencias al backlog de S2 | Miguel Regidor (PO) | 12/03/2026 |
| Resolver branch protection y RELEASE_PLEASE_TOKEN | Manuel Niza | 12/03/2026 |

---

## Acta S1-04 — Sprint Retrospective

| Campo | Valor |
|-------|-------|
| Tipo | Sprint Retrospective |
| Fecha | 05/03/2026 |
| Hora | 11:00 – 12:00 |
| Lugar / Canal | Presencial – ETSII, Sala de reuniones |
| Facilitador | Manuel Jesús Niza Cobo (Scrum Master) |
| Asistentes | Todo el equipo (21) |
| Ausencias | Ninguna |

### Agenda
1. Revisión del Niko-Niko del sprint
2. Dinámica Mad/Sad/Glad por equipos
3. Votación y priorización de acciones de mejora

### Resumen Mad/Sad/Glad

**😠 Mad (Frustraciones)**
- El setup del entorno Docker consumió más tiempo del esperado en varios equipos
- La falta de branch protection genera inseguridad en el trabajo con ramas compartidas
- Algunos PRs tardaron demasiado en ser revisados (bloqueo de integración)

**😔 Sad (Decepciones)**
- No se pudo completar la recuperación de contraseña (S1-09) por dependencia externa (SMTP)
- La falta de límites en WSL2 causó problemas de rendimiento a varios miembros

**😊 Glad (Satisfacciones)**
- La infraestructura Docker Compose está sólida y funciona en todos los equipos
- El CI/CD con GitHub Actions valida cada PR automáticamente
- Las 16 historias Must Have completadas al 100%
- Buena coordinación entre equipos gracias a las reuniones de coordinadores
- El seed demo automático facilita mucho el desarrollo diario

### Acciones de Mejora para el Sprint 2
| # | Acción de Mejora | Responsable | Fecha límite |
|---|------------------|-------------|--------------|
| 1 | Documentar `.wslconfig` en la guía de setup para evitar problemas de RAM en nuevos equipos | Alejandro de los Reyes | 12/03/2026 |
| 2 | Establecer tiempo máximo de revisión de PRs: 48h desde la apertura | Manuel Niza (SM) | Inicio S2 |
| 3 | Resolver branch protection y RELEASE_PLEASE_TOKEN antes de iniciar S2 | Manuel Niza (SM) | 12/03/2026 |
| 4 | Incluir estimación de tiempo de setup en el Sprint Planning de S2 | Manuel Niza (SM) | Sprint Planning S2 |
