<h1>Plan de gestión ágil, seguimiento y calidad – NexUS</h1>

<p align="center">
  <img src="../images/logo-app.png" alt="Logo NexUS" width="500">
</p>

<div align="center">

<p>
  <img src="https://img.shields.io/badge/Versión-1.0.0-blue?style=flat-square" alt="Versión">
  <img src="https://img.shields.io/badge/Estado-Completado-yellow?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Grupo-7--NexUS-green?style=flat-square" alt="Grupo">
  <img src="https://img.shields.io/badge/Asignatura-ISPP-red?style=flat-square" alt="Asignatura">
</p>

<p>
  <strong>Plataforma integral de gestión y convivencia para residencias universitarias</strong>
</p>

</div>

---

**Proyecto:** NexUS  
**Grupo:** 7 - NexUS  
**Asignatura:** Ingeniería del Software y Práctica Profesional (ISPP)  
**Institución:** ETSII – Universidad de Sevilla  
**Curso académico:** 2025/2026  
**Fecha:** 17/02/2026  

<p align="center">
  <img src="../images/logo-etsii.jpe" alt="Logo ETSII" width="400">
</p>

---

## Historial de Versiones

| Versión | Fecha | Cambio principal |
|---------|-------|------------------|
| 1.0.0 | 17/02/2026 | Creación del documento base |


---

## 1. Objetivo del documento

Este documento establece cómo se gestionará y supervisará el proyecto NexUS, asegurando que todo el equipo trabaja alineado, midiendo el progreso de manera objetiva y mostrando al  evidencia de buena gestión. Contempla la planificación, seguimiento, calidad, métricas y presentaciones de los sprints.

---

## 2. Roles y responsabilidades

| Rol                                  | Funciones principales                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Scrum Master**                     | Facilitar la metodología, eliminar bloqueos, supervisar progreso, asegurar cumplimiento de DoD, evitar scope creep.                     |
| **Product Owner (PO)**               | Definir prioridades del backlog, validar criterios de aceptación, decidir cambios de alcance, comunicar necesidades de usuarios piloto. |
| **Coordinador Técnico (por equipo)** | Coordinar arquitectura, revisar código del equipo, sincronización inter-equipos semanal.                                                |
| **Desarrollador**                    | Implementar tareas técnicas según historias de usuario asignadas.                                                                       |

**Nota:** El Scrum Master no reparte tareas técnicas ni decide prioridades; se centra en facilitar y supervisar.

---

## 3. Onboarding inicial

Al inicio del proyecto se realizará una sesión de alineación para todo el equipo:

* Explicación de la metodología Scrum y trabajo por sprints.
* Revisión del stack tecnológico (TypeScript, Figma Maker para vistas, backend y base de datos).
* Uso de repositorios y ramas (GitHub, estrategias de branching).
* Introducción al pipeline CI/CD (GitHub Actions).
* Aclaración de roles y responsabilidades de cada miembro.

**Objetivo:** Partir todos del mismo punto y evitar confusión.

---

## 4. Organización del trabajo

* Proyecto dividido en **sprints de 2 semanas**.
* Cada equipo trabaja en **módulos completos end-to-end**.
* Priorización de historias con **MoSCoW**.
* Minimizar dependencias entre equipos; si existen, documentarlas y usar mocks temporales.
* Comunicación: WhatsApp / Discord para coordinación rápida.

---

## 5. Reuniones y seguimiento

| Reunión                  | Participantes                | Propósito                                                        |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| **Sprint Planning**      | Todos                        | Definir objetivos del sprint, asignar módulos, estimar tareas.   |
| **Revisión semanal**     | Coordinadores y Scrum Master | Revisar progreso, identificar bloqueos, ajustar prioridades.     |
| **Sprint Review**        | Todo el equipo, PO           | Mostrar lo desarrollado, demo funcional, comparar con objetivos. |
| **Sprint Retrospective** | Por equipo + coordinadores   | Qué salió bien, qué mal, acciones de mejora para próximo sprint. |

**Formato de las exposiciones de sprint:**

1. Qué se planeó hacer
2. Qué se terminó realmente (demo)
3. Problemas encontrados
4. Aprendizajes del sprint
5. Qué se va a mejorar en el siguiente sprint

---

## 6. Métricas y seguimiento

### 6.1 Progreso

* Historias planeadas vs. terminadas.
* Porcentaje de tareas **Must** completadas.
* Historias movidas al siguiente sprint.

### 6.2 Calidad

* Bugs detectados después de integraciones.
* Builds fallidos en **CI/CD (GitHub Actions)**.
* Pull Requests que requieren múltiples revisiones.

### 6.4 Visualización

* **GitHub Project** para tracking de tareas y estados (To Do / In Progress / Done).
* **Burndown chart** semanal para mostrar progreso.
* **ADR (Architecture Decision Records)** para decisiones técnicas importantes.

---

## 7. Gestión de riesgos y bloqueos

El Scrum Master supervisa:

* Sobrecarga de equipos.
* Retrasos acumulados.
* Dependencias bloqueantes.
* Introducción de tareas fuera del sprint.

Si se detectan problemas:

* Reunión con equipo para buscar soluciones.
* Ajuste de prioridades si es necesario.
* Escalado al Product Owner si el problema es de alcance o decisión.

---

## 8. Mejora continua

Después de cada sprint:

* Revisar qué ha funcionado y qué no.
* Identificar problemas recurrentes.
* Ajustar metodología, flujo o herramientas si es necesario.
* Incorporar feedback de los desarrolladores.

---

## 9. Presentación y entrega del sprint

**Contenido mínimo para cada demo:**

1. Historias planeadas vs terminadas.
2. Demo funcional de los módulos implementados.
3. Registro de problemas y cómo se resolvieron.
4. Aprendizajes y mejoras para siguiente sprint.
5. Métricas visuales: burndown chart, % tareas Must completadas, bugs críticos.
