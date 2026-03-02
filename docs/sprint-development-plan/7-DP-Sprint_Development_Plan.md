<h1>Plan de Desarrollo de Sprints – NexUS</h1>

<p align="center">
  <img src="../images/logo-app.png" alt="Logo NexUS" width="500">
</p>

<div align="center">

<p>
  <img src="https://img.shields.io/badge/Versión-1.2.0-blue?style=flat-square" alt="Versión">
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
**Fecha:** 09/02/2026  

<p align="center">
  <img src="../images/logo-etsii.jpe" alt="Logo ETSII" width="400">
</p>

---



## Historial de Versiones

| Versión | Fecha | Cambio principal |
|---------|-------|------------------|
| 1.0.0 | 09/02/2026 | Creación del documento base |
| 1.1.0 | 10/02/2026 | Inclusión de criterios de aceptación (DoD) y tareas legales (GDPR) en Sprint 2 |
| 1.1.1 | 10/02/2026 | Actualización de identidad visual, badges de estado y tabla de enlaces rápidos |
| 1.1.2 | 10/02/2026 | Reorganización de la cabecera y mejora del formato del documento |
| 1.1.3 | 11/02/2026 | Ajustes en sprint 3 y corrección de errores en la conclusión |
| 1.2.0 | 15/02/2026 | Ajustes del formato de documento, planificación temporal de tareas, clasificación MoSCoW y corrección de errores |
---


## Índice

1. [Visión general del proyecto](#1-visión-general-del-proyecto)
2. [Composición del equipo](#2-composición-del-equipo)
3. [Sprint 1 - Funcionalidades Core del MVP](#3-sprint-1---funcionalidades-core-del-mvp)
4. [Sprint 2 - MVP v1 Completo](#4-sprint-2---mvp-v1-completo)
5. [Sprint 3 - MVP v2 y Diferenciadores](#5-sprint-3---mvp-v2-y-diferenciadores)
6. [Metodología de trabajo](#6-metodología-de-trabajo)
7. [Gestión de riesgos](#7-gestión-de-riesgos)

---

## 1. Visión general del proyecto

### 1.1 Objetivo del proyecto

 Nuestro objetivo consiste en desarrollar una plataforma integral de gestión de residencias de estudiantes que profesionalice los procesos internos, reduzca la carga operativa y mejore significativamente la experiencia de convivencia de los residentes, bajo el nombre de **NexUS**.

### 1.2 Propuesta de valor única

A diferencia de los ERPs complejos (StarRez, Yardi) y las soluciones parciales existentes, NexUS combina:
- **Gestión operativa profesional** (habitaciones, incidencias, reservas)
- **Automatización de procesos cotidianos** 
- **Mejora activa de la convivencia** (matching social, eventos, comunidad)
- **UX moderna** diseñada específicamente para estudiantes

### 1.3 Modelo de negocio

**B2B2C SaaS**: Las residencias pagan la suscripción, los estudiantes la usan gratuitamente.

**Monetización**:
- Plan base: Gestión básica (estudiantes, habitaciones, incidencias, reservas de espacios), panel administrativo y roles y permisos
- Módulos premium: Analítica avanzada, marca blanca, automatizaciones, informes exportables

### 1.4 Enfoque de desarrollo

**MVP evolutivo** en 3 sprints que construye incrementalmente:
1. **Sprint 1**: Casos de uso core + infraestructura
2. **Sprint 2**: MVP v1 completo funcional + pilotaje
3. **Sprint 3**: MVP v2 con diferenciadores clave + marketing

---

## 2. Composición del equipo

### 2.1 Estructura organizativa

**Total:** 21 personas organizadas en 4 equipos multidisciplinares
- **Equipo A**
- **Equipo B**
- **Equipo C**
- **Equipo D**

3 de esos equipos estarán conformados por 5 integrantes, mientras que uno de ellos dispondrá de 6 miembros.

### 2.2 Filosofía de equipos multidisciplinares

Cada equipo es **autónomo y completo**, capaz de entregar módulos funcionales end-to-end (backend + frontend + UX + testing + documentación). Esto permite:

- Mayor velocidad de entrega
- Menos dependencias entre equipos
- Ownership completo de funcionalidades
- Aprendizaje multidisciplinar
- Comunicación más eficiente

### 2.3 Roles transversales

#### Scrum Master
**Funciones**:
- Facilitación de reuniones Scrum (sprint planning, retrospectives)
- Eliminación de impedimentos
- Seguimiento del progreso del sprint
- Comunicación con stakeholders y profesores
- **También desarrolla dentro de su equipo**

#### Product Owner
**Funciones**:
- Definición y priorización del Product Backlog
- Validación de criterios de aceptación
- Contacto con usuarios piloto
- Decisiones sobre alcance y cambios
- **También desarrolla dentro de su equipo**

#### Coordinadores técnicos (1 por equipo)
Cada equipo tiene un coordinador técnico que:
- Coordina decisiones de arquitectura dentro del equipo
- Participa en sincronización entre equipos semanalmente
- Revisa código de su equipo
- **También desarrolla activamente**

### 2.4 Modelo de trabajo por sprints

**Asignación de módulos funcionales**:
Cada sprint, los equipos reciben módulos completos para implementar. Las asignaciones se acordarán en reuniones al principio de cada sprint.

### 2.5 Sincronización entre equipos

**Sincronización semanal** (Según disponibilidad: viernes, sábado o domingo):
- Líderes de cada equipo, junto con otros integrantes designados según sea necesario.
- Revisar implementación hasta el momento
- Resolver conflictos
- Acordar trabajo de la siguiente semana

---
## 3 Estrategia de Priorización – Método MoSCoW

Para priorizar las historias de usuario utilizaremos la metodología **MoSCoW**, que clasifica cada funcionalidad en cuatro niveles:

- **Must Have (M)**: Imprescindible para que el sistema funcione correctamente. Sin esto el sprint no se considera entregable.
- **Should Have (S)**: Importante pero no bloqueante. Puede aplazarse si hay restricciones de tiempo.
- **Could Have (C)**: Deseable, aporta valor diferencial pero no es crítica para la versión actual.
- **Won't Have (W)**: No se implementará

### Criterios de priorización utilizados

1. Impacto en el MVP funcional.
2. Valor estratégico diferencial.
3. Dependencias técnicas.
4. Riesgo de implementación.
5. Capacidad real del equipo (21 personas, 6 semanas).

El objetivo es garantizar que:
- El **Sprint 1 entregue una base sólida y operativa**.
- El **Sprint 2 complete el MVP comercializable**.
- El **Sprint 3 incorpore los grandes diferenciadores estratégicos restantes**.
---

## 4. Sprint 1 – Funcionalidades Core del MVP

**Duración**: 19 febrero – 5 marzo (2 semanas)  
**Peso**: 10% de la nota final  
**Objetivo**: Implementar los casos de uso esenciales del MVP y establecer la base técnica del sistema.

### 4.1 Objetivos del Sprint 1

- Disponer de una **infraestructura técnica funcional**
- Permitir **autenticación y gestión básica de usuarios**
- Contar con un **panel administrativo inicial**
- Implementar un **sistema básico de incidencias**
- Definir una **base común de UX/UI y testing**
- Desplegar la aplicación en la nube

### 4.2 Backlog de Historias de Usuario del Sprint 1

#### Infraestructura y base técnica

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S1-01 | Como desarrollador, necesito el stack tecnológico configurado para comenzar el desarrollo | **M** |
| S1-02 | Como desarrollador, necesito repositorios y estrategia de ramas definidos | **M** |
| S1-03 | Como desarrollador, necesito un pipeline CI/CD básico para automatizar builds | **M** |
| S1-04 | Como desarrollador, necesito desplegar la aplicación en un entorno de desarrollo y de producción | **M** |
| S1-05 | Como desarrollador, necesito una base de datos configurada y accesible | **M** |
| S1-06 | Como desarrollador, necesito documentación técnica inicial del sistema | **C** |

#### Autenticación y usuarios

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S1-07 | Como usuario, quiero registrarme en la plataforma usando mi email | **M** |
| S1-08 | Como usuario, quiero iniciar sesión con email y contraseña | **M** |
| S1-09 | Como usuario, quiero recuperar mi contraseña si la olvido | **S** |
| S1-10 | Como administrador, quiero gestionar roles de usuario (Admin, Estudiante, Personal) | **M** |
| S1-11 | Como usuario, quiero ver y editar mi perfil básico | **S** |

#### Panel administrativo básico

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S1-12 | Como administrador, quiero ver un dashboard inicial con información básica | **M** |
| S1-13 | Como administrador, quiero crear, editar y eliminar habitaciones | **M**|
| S1-14 | Como administrador, quiero asignar estudiantes a habitaciones | **M**|
| S1-15 | Como administrador, quiero ver un listado completo de estudiantes | **S**|
| S1-16 | Como administrador, quiero visualizar el estado de ocupación de la residencia | **S**|

#### Sistema de incidencias (versión inicial)

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S1-17 | Como estudiante, quiero crear una incidencia con una descripción | **M** |
| S1-18 | Como estudiante, quiero ver el historial de mis incidencias | **S** |
| S1-19 | Como administrador, quiero ver todas las incidencias reportadas | **M** |
| S1-20 | Como administrador, quiero cambiar el estado de una incidencia | **M** |
| S1-21 | Como administrador, quiero filtrar incidencias por tipo, estado y prioridad | **S** |

#### UX/UI y calidad

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S1-22 | Como diseñador, quiero definir una paleta de colores y tipografía base | **M**|
| S1-23 | Como diseñador, quiero crear wireframes de las pantallas principales | **C** |
| S1-24 | Como desarrollador, quiero un sistema inicial de componentes reutilizables | **S** |
| S1-25 | Como equipo, quiero definir y ejecutar casos de prueba funcionales | **M** |
| S1-26 | Como equipo, quiero realizar testing de integración básico | **S** |


### 4.3 Hitos del Sprint 1

| Fecha | Hito | Entregables |
|-------|------|-------------|
| **19 Feb** | Inicio Sprint 1 | Sprint planning completado, tareas asignadas |
| **4 Mar** | **Entrega Sprint 1** (10%) | - Stack tecnológico configurado<br>- MVP desplegado en la nube<br>- Autenticación + Usuarios funcional<br>-Diseños UX/UI aprobados por el equipo<br>- Panel admin básico<br>- Incidencias básicas<br>- Demo funcional |

### 4.4 Diagrama de Gantt simplificado del Sprint 1

![Diagrama de Gantt Sprint 1](../images/sprint_plan/gantt_s1.png)

---

## 5. Sprint 2 - MVP v1 Completo

**Duración**: 12 marzo - 26 marzo (2 semanas)  
**Peso**: 15% de la nota final  
**Objetivo**: Completar el MVP v1 funcional, iniciar pilotaje con usuarios reales, establecer ciclo de mejora continua

### 5.1 Objetivos del Sprint 2

1. **Completar funcionalidades esenciales del modelo base**
   - Reservas de espacios comunes
   - Comunicación institucional (avisos oficiales)
   - Mejoras en sistema de incidencias (imágenes, priorización)

2. **Implementar onboarding digital**
   - Check-in digital
   - Firma de normas
   - Información práctica

3. **Mejorar infraestructura**
   - Monitorización y logging (si es necesario)
   - Optimización de rendimiento
   - Seguridad reforzada

4. **Implementar funcionalidades operativas adicionales**
   - Reserva de objetos comunes

### 5.2 Backlog de Historias de Usuario – Sprint 2

#### Reservas de espacios comunes

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S2-01 | Como administrador, quiero configurar espacios comunes | **M** |
| S2-02 | Como administrador, quiero definir horarios y aforos | **M** |
| S2-03 | Como estudiante, quiero ver la disponibilidad de espacios en tiempo real | **M** |
| S2-04 | Como estudiante, quiero reservar un espacio común | **M** |
| S2-05 | Como estudiante, quiero cancelar mis reservas | **S** |
| S2-06 | Como administrador, quiero ver y gestionar todas las reservas | **M** |
| S2-07 | Como sistema, quiero enviar recordatorios automáticos de reservas | **C** |

#### Comunicación institucional

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S2-08 | Como administrador, quiero publicar avisos oficiales | **M** |
| S2-09 | Como administrador, quiero segmentar avisos por grupos | **S** |
| S2-10 | Como estudiante, quiero ver los avisos relevantes | **M** |
| S2-11 | Como estudiante, quiero marcar avisos como leídos | **C** |
| S2-12 | Como administrador, quiero ver estadísticas de lectura | **S** |
| S2-13 | Como administrador, quiero gestionar una FAQ dinámica | **C** |
| S2-14 | Como administrador, quiero que existan canales de comunicación moderados y estructurados | **S** |

#### Incidencias (mejoras)

| ID  | Historia de Usuario | MoSCoW |
|-----|---------------------|--------|
| S2-15 | Como estudiante, quiero adjuntar imágenes a una incidencia | **M** |
| S2-16 | Como administrador, quiero asignar incidencias a personal interno o proveedores | **M** |
| S2-17 | Como estudiante, quiero recibir notificaciones sobre mi incidencia | **S** |
| S2-18 | Como administrador, quiero ver el historial completo de incidencias| **M** |
| S2-19 | Como sistema, quiero priorizar incidencias según criterios básicos | **S** |
| S2-20 | Como administrador, quiero dividir una incidencia en subtareas internas para organizar su resolución | **M** |
| S2-21 | Como administrador, quiero asignar estados independientes a cada subtarea | **M** |
| S2-22 | Como administrador, quiero ver el progreso global de la incidencia basado en el estado de sus subtareas | **C** |
| S2-23 | Como administrador, quiero que el sistema registre y analice automáticamente las incidencias para que en el futuro se puedan aplicar automatizaciones y mecanismsos de priorización inteligente | **C** |


#### Onboarding digital

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S2-24 | Como estudiante nuevo, quiero completar un check-in digital | **M** |
| S2-25 | Como estudiante nuevo, quiero firmar digitalmente las normas | **M** |
| S2-26 | Como estudiante nuevo, quiero ver un checklist de llegada | **S** |
| S2-27 | Como estudiante nuevo, quiero acceder a información práctica | **S** |
| S2-28 | Como administrador, quiero ver el estado de onboarding de los estudiantes | **S** |
| S2-29 | Como administrador, quiero ver un checklist de llegada y salida de los invitados, así como su nombre completo y el residente que lo invitó | **S** |

#### Buzón Dirección-Estudiante

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S2-30 | Como estudiante, quiero enviar un mensaje privado a la dirección de la residencia | **M** |
| S2-31 | Como administrador, quiero responder mensajes privados de estudiantes desde un panel centralizado | **M** |
| S2-32 | Como administrador, quiero ver el historial completo de conversaciones con cada estudiante | **S** |
| S2-33 | Como usuario, quiero ser notificado cuando haya nuevos mensajes pendientes de respuesta | **S** |

#### Reserva de Objetos Comunes

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S2-34 | Como administrador, quiero registrar objetos comunes en un inventario digital | **M** |
| S2-35 | Como administrador, quiero definir disponibilidad y condiciones de préstamo de cada objeto | **M** |
| S2-36 | Como estudiante, quiero ver la disponibilidad de objetos en tiempo real | **M** |
| S2-37 | Como estudiante, quiero reservar un objeto para una franja horaria | **M** |
| S2-38 | Como sistema, quiero enviar recordatorios automáticos de devolución | **C** |
| S2-39 | Como administrador, quiero ver el historial de uso y préstamos de cada objeto | **S** |

#### Legal y Cumplimiento (GDPR/RGPD)

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S2-40 | Como usuario, quiero leer y aceptar la Política de Privacidad y Términos de Uso antes de registrarme | **M** |
| S2-41 | Como usuario, quiero poder descargar una copia de todos mis datos personales (Derecho a la Portabilidad) | **S** |
| S2-42 | Como usuario, quiero solicitar la eliminación de mi cuenta y mis datos (Derecho al Olvido) | **M** |
| S2-43 | Como administrador, quiero asegurar que las contraseñas y datos sensibles estén encriptados en la base de datos | **M** |


### 5.3 Hitos del Sprint 2

| Fecha | Hito | Entregables |
|-------|------|-------------|
| **12 Mar** | Inicio Sprint 2 | Sprint planning, objetivos claros |
| **25 Mar** | **Entrega Sprint 2** (15%) | - Reservas funcionales<br>- Incidencias mejoradas<br>- Onboarding implementado<br>- Comunicación institucional completa<br>- Despliegue en producción<br>- Primeros usuarios piloto onboardeados<br>- MVP v1 completo en producción<br>- Usuarios piloto activos<br>- Feedback inicial recogido<br>- Analytics configurados<br>- Informe de mejora continua |

### 5.4 Diagrama de Gantt simplificado del Sprint 2

![Diagrama de Gantt Sprint 2](../images/sprint_plan/gantt_s2.png)

---

## 6. Sprint 3 - MVP v2 y Diferenciadores

**Duración**: 2 abril - 16 abril (2 semanas)  
**Peso**: 30% de la nota final  
**Objetivo**: Implementar funcionalidades diferenciadores (vida social, IA matching), pivotear basado en feedback de pilotaje, completar plan de marketing

### 6.1 Objetivos del Sprint 3

1. **Implementar últimas funcionalidades de NexUS**
   - Matching social entre estudiantes (IA)
   - Gestión de eventos y actividades
   - Gestión digital del comedor y menús

2. **Pivotear basado en feedback de pilotaje**
   - Analizar métricas del Sprint 2
   - Ajustar prioridades según necesidades reales

3. **Completar modelo premium**
   - Marca blanca (configuración básica)
   - Dashboard de analítica avanzada
   - Exportación de informes

4. **Implementar Vista NexUS multi-residencia**
   - Supervisión centralizada de múltiples residencias
   - Analítica comparativa entre sedes
   - Roles corporativos para gestoras

5. **Pulir experiencia de usuario**
   - Optimización de UX basada en feedback
   - Corrección de bugs prioritarios
   - Mejora de rendimiento

### 6.2 Backlog de Historias de Usuario – Sprint 3

#### Vida social y convivencia

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S3-01 | Como estudiante, quiero completar un perfil social | **M** |
| S3-02 | Como estudiante, quiero recibir sugerencias de compañeros compatibles | **M** |
| S3-03 | Como estudiante, quiero que el sistema me ayude a encontrar compañero de habitación | **M** |
| S3-04 | Como administrador, quiero crear eventos para la residencia | **M** |
| S3-05 | Como estudiante, quiero ver e inscribirme en eventos | **M** |
| S3-06 | Como administrador, quiero gestionar la asistencia a eventos | **M** |
| S3-07 | Como administrador, quiero crear encuestas de clima social | **C** |
| S3-08 | Como estudiante, quiero responder encuestas de forma anónima | **C** |

#### Módulos premium

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S3-09 | Como administrador, quiero personalizar el logo de la residencia | **M** |
| S3-10 | Como administrador, quiero configurar colores corporativos | **M** |
| S3-11 | Como administrador, quiero personalizar el nombre de la aplicación | **S** |
| S3-12 | Como administrador, quiero exportar informes en PDF y Excel | **C** |

#### Gestión de Comedor y Menús

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S3-13 | Como administrador, quiero crear y publicar el menú semanal | **M** |
| S3-14 | Como estudiante, quiero elegir los platos del menú que desee | **S** |
| S3-15 | Como estudiante, quiero confirmar mi asistencia al comedor para optimizar previsiones | **S** |
| S3-16 | Como estudiante, quiero autorizar digitalmente a otro residente para recoger mi menú | **C** |
| S3-17 | Como estudiante, quiero ver las solicitudes que tengo para recoger comida por parte de otros estudiantes y aceptarlas o denegarlas | **C** |
| S3-18 | Como trabajador del comedor, quiero ver que pedidos van a ser recogidos por un estudiante distinto al que realizó el pedido | **C** |

#### Vista NexUS – Panel Multi-Residencia

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S3-19 | Como administrador, quiero visualizar todas mis residencias desde un único panel central | **C** |
| S3-20 | Como administrador corporativo, quiero comparar métricas operativas entre residencias | **C** |
| S3-21 | Como sistema, quiero permitir la gestión independiente de cada residencia bajo una misma cuenta corporativa | **C** |

#### Calidad, seguridad y lanzamiento

| ID | Historia de Usuario | MoSCoW |
|----|---------------------|--------|
| S3-22 | Como equipo, queremos realizar un testing de seguridad básico para asegurar que la aplicación no tiene vulnerabilidades críticas antes del lanzamiento | **M** |
| S3-23 | Como equipo, queremos verificar que la PWA funciona correctamente en distintos navegadores (Chrome, Firefox) | **M** |
| S3-24 | Como equipo, queremos revisar y corregir los bugs e incidencias de UX más críticos detectados durante el pilotaje del Sprint 2 | **M** |

### 6.3 Hitos del Sprint 3

| Fecha | Hito | Entregables |
|-------|------|-------------|
| **2 Abr** | Inicio Sprint 3 | Sprint planning, análisis de feedback Sprint 2 |
| **15 Abr** | **Entrega Sprint 3** (30%) | - Matching social funcional<br>- Eventos implementados<br>- Marca blanca básica<br>- Analítica avanzada<br>- Automatizaciones<br>- UX pulida<br>- Landing page comercial<br>- MVP v2 completo<br>- Diferenciadores implementados<br>- Plan de marketing ejecutable<br>- Material de ventas<br>- Informe de pivot y mejoras<br>- Demo lista para WPL |

### 6.4 Diagrama de Gantt simplificado del Sprint 2

![Diagrama de Gantt Sprint 3](../images/sprint_plan/gantt_s3.png)

---

## 7. Metodología de trabajo

### 7.1 Framework Scrum adaptado

Aplicaremos Scrum con las siguientes reuniones, adaptadas a nuestra estructura de 4 equipos autónomos. No se realizarán Sprint Reviews como tal, sino que las exposiciones en clase a final de sprint cumplirán esa función:

#### Sprint Planning (Inicio de cada sprint)
**Parte 1: Definición de objetivos** (todos juntos)
- Product Owner presenta prioridades del sprint
- Equipos hacen preguntas y clarificaciones
- Se asignan módulos funcionales a cada equipo

**Parte 2: Planning por equipo** (equipos separados)
- Cada equipo descompone su módulo en tareas
- Estimación colectiva (planning poker)
- Distribución de responsabilidades internas
- Identificación de dependencias

**Resultado**: Backlog del sprint claro con ownership por equipo

#### Sprint Retrospective (final de cada sprint)
**Parte 1: Retro por equipo** (equipos separados)
- ¿Qué salió bien en nuestro equipo?
- ¿Qué salió mal?
- ¿Qué queremos mejorar?

**Parte 2: Retro general** (coordinadores)
- Cada equipo comparte 2-3 insights clave
- Identificar problemas inter-equipos
- Definir acciones de mejora concretas para el siguiente sprint

**Responsable**: Scrum Master
**Resultado**: Retrospectiva

#### Sincronización técnica (semanal)
**Participantes**: 4 coordinadores técnicos y otros miembros de cada equipo según sea necesario.

**Contenido**:
- Revisar implementación hasta el momento
- Alinear decisiones
- Resolver conflictos
- Acordar trabajo semanal

### 7.2 Criterios de Aceptación Globales (Definition of Done - DoD)

Para garantizar la calidad y la integración continua entre los 4 equipos, ninguna Historia de Usuario (HU) o tarea se considerará "Termiada" hasta cumplir estrictamente con los siguientes criterios:

1.  **Código**:
    * El código está subido a la rama `develop` (o la rama de feature correspondiente).
    * Cumple con las guías de estilo definidas (Linter sin errores).
    * No existen credenciales ni secretos hardcodeados.

2.  **Testing y Calidad**:
    * La funcionalidad tiene tests unitarios asociados (si aplica).
    * El pipeline de CI/CD (GitHub Actions/GitLab CI) ha pasado en verde (Build + Tests).
    

3.  **Revisión (Code Review)**:
    * La Pull Request (PR) ha sido aprobada por al menos un desarrollador de otro equipo (cross-review) o por el coordinador técnico.
    * Se han resuelto todos los comentarios de la revisión.

4.  **Documentación**:
    * Si hubo cambios en la API, la documentación está actualizada.
    * Si es una funcionalidad compleja, se ha actualizado la Wiki del proyecto.

#### 7.3 Documentación obligatoria por equipo
Cada equipo debe mantener:
   
1. **API Documentation** (puede ser autogenerada):
   - Endpoints expuestos
   - Request/response schemas
   - Ejemplos de uso

2. **User Documentation**:
   - Guías de uso para sus features
   - Screenshots/videos si es necesario

3. **ADRs** (Architecture Decision Records):
   - Decisiones técnicas importantes

### 7.4 Gestión de dependencias entre equipos

**Principio**: Minimizar dependencias, maximizar autonomía

**Cuando hay dependencias**:
1. **Identificar temprano**
2. **Definir contrato**: API o interfaz clara entre módulos
3. **Mock early**: Equipo dependiente crea mocks para no bloquearse
4. **Sincronizar**: Reunión específica entre equipos afectados si fuera necesario
5. **Integrar continuamente**: Merges diarios a develop

**Ejemplo**: 
- Equipo B necesita datos de autenticación de Equipo A
- Equipo A define y documenta API de auth en día 1
- Equipo B usa mock de auth mientras Equipo A implementa
- Integración real en día 5 con testing conjunto

---

## 8. Gestión de riesgos

### 8.1 Riesgos identificados

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|--------------|---------|------------|
| R1 | Dificultad para conseguir usuarios piloto | Media | Alto | - Contactar múltiples residencias en paralelo<br>- Ofrecer periodo gratuito extendido<br>- Usar red de contactos de profesores |
| R2 | Complejidad técnica del matching IA subestimada | Alta | Medio | - Empezar con matching basado en reglas simples<br>- Iterar a ML solo si hay tiempo<br>- Considerar APIs externas (Anthropic Claude) |
| R3 | Conflictos entre miembros del equipo | Media | Medio | - Definir roles claros desde el inicio<br>- Retrospectivas honestas<br>- Scrum Master como mediador |
| R4 | Enfermedad o ausencias de miembros clave | Media | Medio | - Documentar código y decisiones<br>- Colaboración entre equipos<br>- Pair programming para features críticas |
| R5 | Scope creep (añadir features no prioritarias) | Alta | Alto | - Product Owner controla backlog estrictamente<br>- Revisión semanal de prioridades<br>- Decir "no" a features no MVP |
| R6 | Feedback negativo de usuarios piloto | Media | Alto | - Hacer testing de usabilidad temprano<br>- Iterar rápido basado en feedback |
| R7 | Performance pobre (app lenta) | Media | Medio | - Testing de performance desde Sprint 1<br>- Optimización continua<br>- Usar CDN para assets |
| R8 | Bugs críticos cerca de entregas | Media | Alto | - Testing exhaustivo semana antes de entrega<br>- Feature freeze 3 días antes<br>- Buffer de tiempo en planificación |
| R9 | Falta de diferenciación vs competencia | Baja | Alto | - Validar propuesta de valor con profesores<br>- Investigar competencia continuamente |

### 8.2 Plan de contingencia

Si vamos retrasados:
1. **Repriorizar**: Mover historias de menor prioridad a siguiente sprint
2. **Aumentar capacidad temporalmente**: Pedir a miembros hacer horas extra por semana
3. **Simplificar scope**: Reducir features a versión más simple

Si perdemos usuario piloto:
1. Activar contactos de respaldo
2. Ofrecer nuevos incentivos dentro de la aplicación

Si hay problema técnico grave (servidor de despliegue caido continuamente...):
1. Documentar problema detalladamente
2. Buscar soluciones alternativas
3. Escalar a profesores si necesario
4. Mantener trabajo local mientras se resuelve

---

## Conclusión

Este plan de desarrollo de 3 sprints está diseñado para construir NexUS, la plataforma de gestión de residencias de estudiantes. La planificación trata de ser:

- **Realista**: Ajustada a la capacidad de 21 personas y los timings del syllabus
- **Incremental**: Cada sprint añade valor significativo sobre el anterior
- **Validada**: Con usuarios piloto reales

**Factores clave de éxito**:
1. Comunicación constante entre equipos
2. Priorización rigurosa del Product Owner
3. Feedback temprano y continuo de usuarios
4. Calidad sobre cantidad en cada entrega
5. Agilidad para pivotar basado en aprendizajes

El equipo está preparado para entregar un producto que no solo cumple con los requisitos académicos, sino que tiene potencial real de mercado en el sector de gestión de residencias estudiantiles.