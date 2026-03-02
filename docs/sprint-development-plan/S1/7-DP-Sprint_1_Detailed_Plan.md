<h1>Plan de Desarrollo del Sprint 1 – NexUS</h1>

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
**Fecha:** 09/02/2026  

<p align="center">
  <img src="../images/logo-etsii.jpe" alt="Logo ETSII" width="400">
</p>

---

## Historial de Versiones

| Versión | Fecha | Cambio principal |
|---------|-------|------------------|
| 1.0.0 | 15/02/2026 | Creación del documento base |
| 1.1.0 | 17/02/2026 | Revisión del documento |


---

## Sprint 1 - Funcionalidades Core del MVP: Guía Detallada

| Duración | 19 febrero – 5 marzo (2 semanas) |
|---|---|
| Peso | 10% de la nota final |
| Fecha entrega | 4 de marzo de 2026 |

---

## Índice

1. [Objetivos del Sprint](#1-objetivos-del-sprint)
2. [Infraestructura y base técnica](#2-infraestructura-y-base-técnica)
3. [Autenticación y usuarios](#3-autenticación-y-usuarios)
4. [Panel administrativo básico](#4-panel-administrativo-básico)
5. [Sistema de incidencias](#5-sistema-de-incidencias)
6. [UX/UI y calidad](#6-uxui-y-calidad)
7. [Resumen y planificación](#7-resumen-y-planificación)
8. [Entregables finales](#8-entregables-finales)

---

## 1. Objetivos del Sprint

- Disponer de una infraestructura técnica funcional
- Implementar autenticación y gestión básica de usuarios
- Crear un panel administrativo inicial operativo
- Desarrollar un sistema básico de incidencias
- Definir una base común de UX/UI y testing
- Desplegar la aplicación en la nube

---

**AVISO:** *al final del nombre de cada historia de usuario aparece entre paréntesis la clasificación MoSCoW: must have (M), should have (S), could have (C) y won't have (W)*

---

## 2. Infraestructura y base técnica

### S1-01: Configuración del Stack Tecnológico (M)

#### Historia de Usuario

Como desarrollador, necesito el stack tecnológico configurado para comenzar el desarrollo.

#### Descripción

Establecer las tecnologías fundamentales del proyecto.

#### Tareas Específicas

- Frontend: Instalar framework, configurar bundler, sistema de rutas
- Backend: Configurar servidor, establecer arquitectura
- Base de datos: Instalar SGBD, configurar ORM
- Gestión de dependencias: Inicializar package manager y documentar versiones

#### Criterios de Aceptación

- El proyecto frontend se inicia correctamente
- El servidor backend arranca sin errores
- La conexión a BD se establece
- Existe README.md con instrucciones
- Todos los miembros pueden ejecutar el proyecto

### S1-02: Repositorios y Estrategia de Ramas (M)

#### Historia de Usuario

Como desarrollador, necesito repositorios Git y estrategia de ramas para colaborar eficientemente.

#### Descripción

Establecer control de versiones que permitirá trabajo organizado.

#### Tareas Específicas

- Crear repositorio en GitHub con permisos del equipo
- Definir estrategia
- Convenciones: formato de ramas, formato de commits...
- Protección de ramas: configurar branch protection, requerir PRs

#### Criterios de Aceptación

- Repositorio creado con todos los miembros
- Ramas principales protegidas
- .gitignore configurado

### S1-03: Pipeline CI/CD Básico (M)

#### Historia de Usuario

Como desarrollador, necesito pipeline CI/CD para automatizar builds y tests.

#### Descripción

Automatizar procesos de integración y despliegue.

#### Tareas Específicas

- Seleccionar herramienta
- Pipeline CI/CD: instalación de dependencias, tests, build, despliegue...

#### Criterios de Aceptación

- Pipeline se ejecuta en cada push
- Build se completa sin errores

### S1-04: Despliegue en Entornos (M)

#### Historia de Usuario

Como desarrollador, necesito desplegar en dev y producción para probar funcionalidades.

#### Descripción

Establecer infraestructura cloud accesible públicamente. Se hará un despliegue por sprint, dejando el primero sin tocar una vez terminado el primer sprint.

#### Tareas Específicas

- Seleccionar proveedor
- Variables de entorno: configurar secrets en plataforma
- Dominio: configurar URL y SSL/HTTPS
- Monitoreo: configurar logs básicos

#### Criterios de Aceptación

- App accesible vía URL
- Despliegues automáticos funcionan
- HTTPS configurado
- Documentación de URLs disponible

### S1-05: Configuración de Base de Datos (M)

#### Historia de Usuario

Como desarrollador, necesito una base de datos configurada y accesible.

#### Descripción

Provisionar BD que almacenará información del sistema.

#### Tareas Específicas

- Provisionar BD cloud y local
- Diseño: tablas Users, Roles, Rooms, Incidents con relaciones
- Migraciones: configurar herramienta
- Seed data: usuarios ejemplo, roles, habitaciones

#### Criterios de Aceptación

- BD cloud accesible desde app
- Migraciones se ejecutan correctamente
- Seed data funciona
- Diagrama de esquema disponible

### S1-06: Documentación Técnica Inicial (C)

#### Historia de Usuario

Como desarrollador, necesito documentación para facilitar incorporación y mantenimiento.

#### Descripción

Crear documentación esencial de arquitectura y desarrollo.

#### Tareas Específicas

- README.md: descripción, stack, instalación, comandos
- Arquitectura: documento con diagramas de componentes
- Convenciones: guía de estilo, estructura de carpetas
- API Documentation: endpoints, request/response

#### Criterios de Aceptación

- README.md completo
- Documentación de arquitectura en /docs
- Nuevo desarrollador puede configurar proyecto
- Endpoints documentados con ejemplos
- Diagrama de BD actualizado

---

## 3. Autenticación y usuarios

### S1-07: Registro de Usuarios (M)

#### Historia de Usuario

Como usuario, quiero registrarme usando email para acceder al sistema.

#### Descripción

Implementar funcionalidad de registro con validaciones.

#### Tareas Específicas

- Formulario: email, contraseña, confirmar contraseña, nombre completo
- Crear endpoint: POST /api/auth/register con validaciones
- BD: modelo User con email unique constraint
- Validaciones: email válido, contraseña fuerte

#### Criterios de Aceptación

- Usuario puede registrarse con email válido
- Email duplicado bloqueado
- Contraseña débil rechazada
- Usuario creado correctamente en BD
- Respuesta adecuada

### S1-08: Login de Usuarios (M)

#### Historia de Usuario

Como usuario, quiero iniciar sesión con email y contraseña.

#### Descripción

Implementar autenticación para acceso seguro.

#### Tareas Específicas

- Formulario login: email + contraseña
- Crear endpoint: POST /api/auth/login
- Verificación: comparar contraseña hasheada
- JWT: generar token con expiración

#### Criterios de Aceptación

- Usuario puede iniciar sesión con credenciales correctas
- Credenciales incorrectas muestran error
- Token generado correctamente
- Rutas protegidas rechazan si no tiene token
- Sesión persiste

### S1-09: Recuperación de Contraseña (S)

#### Historia de Usuario

Como usuario, quiero recuperar mi contraseña si la olvido.

#### Descripción

Permitir restablecimiento de contraseña seguro via email.

#### Tareas Específicas

- Formulario solicitar reset (email)
- Crear endpoint: POST /api/auth/forgot-password
- Generar token único con expiración
- Enviar email con enlace
- Endpoint reset: POST /api/auth/reset-password

#### Criterios de Aceptación

- Usuario puede solicitar restablecimiento de contraseña con email registrado
- Token generado y guardado
- Email enviado correctamente
- Usuario puede establecer nueva contraseña
- Token expira correctamente

### S1-10: Gestión de Roles de Usuario (M)

#### Historia de Usuario

Como administrador, quiero gestionar roles (Admin, Estudiante, Personal).

#### Descripción

Implementar roles básicos para controlar accesos.

#### Tareas Específicas

- Crear modelo Rol
- Asociar roles a usuarios
- Seed en BD
- Mostrar opciones según rol

#### Criterios de Aceptación

- Roles creados y asignables
- Admin tiene acceso a panel administrativo
- Estudiante no puede acceder rutas admin
- Roles visibles en perfil usuario

### S1-11: Perfil Básico Usuario (S)

#### Historia de Usuario

Como usuario, quiero ver y editar mi perfil básico.

#### Descripción

Permitir gestión de información personal.

#### Tareas Específicas

- Vista perfil: nombre, email, rol, habitación
- Crear endpoints
- Validaciones básicas
- Formulario editable con confirmación

#### Criterios de Aceptación

- Usuario puede ver su información
- Usuario puede editar campos permitidos
- Email no editable
- Datos guardados en BD
- UI muestra confirmación de cambios

---

## 4. Panel administrativo básico

### S1-12: Dashboard Administrativo Inicial (M)

#### Historia de Usuario

Como administrador, quiero ver un dashboard con información básica.

#### Descripción

Dashboard con métricas iniciales para control.

#### Tareas Específicas

- Definir métricas: nº estudiantes, habitaciones, incidencias abiertas, ocupación
- Crear endpoint
- UI dashboard con resumen general
- Permitir acceso solo al rol admin
- Datos de prueba para demo

#### Criterios de Aceptación

- Dashboard muestra métricas básicas
- Datos correctos desde BD
- Acceso correctamente restringido
- UI responsive

### S1-13: CRUD de Habitaciones (M)

#### Historia de Usuario

Como administrador, quiero crear, editar y eliminar habitaciones.

#### Descripción

Gestionar habitaciones disponibles en residencia.

#### Tareas Específicas

- Crear modelo para habitacioens: nº, capacidad, estado (disponible/ocupada)
- Crear endpoints
- UI tabla habitaciones con acciones
- Validaciones: nº único, capacidad > 0
- Soft delete opcional

#### Criterios de Aceptación

- Admin puede crear habitación y editar atributos
- Se pueden eliminar habitación vacía
- Validaciones funcionan correctamente
- UI actualiza sin recargar

### S1-14: Asignación Estudiantes a Habitaciones (M)

#### Historia de Usuario

Como administrador, quiero asignar estudiantes a habitaciones.

#### Descripción

Permitir asignar estudiante a una habitación para gestión de ocupación.

#### Tareas Específicas

- Crear relación entre modelos de estudiante y habitación
- Crear endpoint de asignación
- Validación de la capacidad de la habitación
- UI: selector estudiante + habitación
- Actualizar estado ocupación habitación

#### Criterios de Aceptación

- Admin puede asignar estudiantes a una habitación
- No se puede superar la capacidad
- Usuario actualizado correctamente
- Habitaciones se marcan ocupadas
- Se muestran cambios en dashboard

### S1-15: Listado Completo de Estudiantes (S)

#### Historia de Usuario

Como administrador, quiero ver un listado completo de estudiantes.

#### Descripción

Mostrar información general para control.

#### Tareas Específicas

- Crear endpoint para mostrar el listado
- Incluir: nombre, email, habitación, estado
- UI: tabla con filtros básicos
- Paginación si aplica
- Solo acceso para el admin

#### Criterios de Aceptación

- La lista carga correctamente
- Paginación o scroll funciona
- Acceso restringido
- Búsqueda funciona correctamente

### S1-16: Visualización Ocupación Residencia (S)

#### Historia de Usuario

Como administrador, quiero visualizar el estado de ocupación de la residencia.

#### Descripción

Vista gráfica o resumen para monitorizar ocupación.

#### Tareas Específicas

- Calcular porcentaje de ocupación (habitaciones ocupadas / total)
- Crear endpoint para ver la ocupación
- UI: gráfico simple o barra de progreso
- Integrar con dashboard inicial

#### Criterios de Aceptación

- Porcentaje de ocupación calculado correctamente
- UI clara y visible
- Datos se actualizan tras una asignación
- Acceso restringido a admin

---

## 5. Sistema de incidencias

### S1-17: Creación de Incidencias (M)

#### Historia de Usuario

Como estudiante, quiero crear una incidencia con una descripción.

#### Descripción

Permitir que estudiantes reporten problemas en la residencia, tanto problemas personales (habitación del estudiante) como en zonas comunes.

#### Tareas Específicas

- Crear modelo para incidencias: id, id usuario, descripción, estado, fecha creación...
- Crear endpoint para crear las incidencias
- UI formulario: título opcional, descripción, categoría básica, tipo (personal o común)
- Validaciones: descripción obligatoria
- Incidencia se crea en estado “Abierta”

#### Criterios de Aceptación

- Rol estudiante puede crear una incidencia
- Incidencia guardada en BD
- Estado inicial correcto
- Validaciones funcionan correctamente
- UI confirma creación

### S1-18: Historial de Incidencias del Estudiante (S)

#### Historia de Usuario

Como estudiante, quiero ver el historial de mis incidencias.

#### Descripción

Mostrar incidencias creadas por el usuario.

#### Tareas Específicas

- Crear endpoint para ver el historial de las incidencias propias
- UI: lista incidencias con estado y fecha
- Ordenar por fecha descendente
- Mostrar detalles de cada incidencia usando botones

#### Criterios de Aceptación

- Estudiante ve solo sus incidencias
- Lista se carga correctamente
- Orden correcto
- Estados visibles

### S1-19: Vista Admin de Todas las Incidencias (M)

#### Historia de Usuario

Como administrador, quiero ver todas las incidencias reportadas.

#### Descripción

Permitir seguimiento centralizado de las incidencias de una forma más detallada y exhasutiva para el administrador.

#### Tareas Específicas

- Crear endpoint para ver todas las incidencias reportadas
- UI: tabla con filtros básicos
- Mostrar: descripción, usuario, estado, fecha
- Paginación básica
- Acceso solo par admin

#### Criterios de Aceptación

- Admin ve todas incidencias con todos los detalles
- Acceso restringido
- Búsqueda funciona correctamente

### S1-20: Cambio de Estado de Incidencia (M)

#### Historia de Usuario

Como administrador, quiero cambiar el estado de una incidencia.

#### Descripción

Actualizar estado a “En progreso”, “Resuelta”, etc.

#### Tareas Específicas

- Definir estados: Abierta, En progreso, Resuelta, Cerrada
- Crear endpoint para cambiar el estado de una incidencia
- UI: dropdown para cambiar estado
- Validaciones: id válido, estado válido
- Registrar fecha de cierre

#### Criterios de Aceptación

- Admin puede cambiar estado
- Estado se actualiza en BD
- UI: refleja cambio inmediatamente
- Estado inválido rechazado
- Registro correcto de fecha cierre

### S1-21: Filtrado de Incidencias (S)

#### Historia de Usuario

Como administrador, quiero filtrar incidencias por tipo, estado y prioridad.

#### Descripción

Mejorar gestión mostrando solo incidencias relevantes.

#### Tareas Específicas

- Añadir filtrado de incidencias 
- UI: filtros dropdown o tabs por estado
- Actualizar tabla dinámicamente
- Mantener paginación con filtros

#### Criterios de Aceptación

- Filtrado funciona correctamente
- UI permite seleccionar tipo, estado y prioridad fácilmente
- Paginación mantiene filtros
- Resultados correctos
- Reset de filtros disponible

---

## 6. UX/UI y calidad

### S1-22: Definir Paleta y Tipografía Base (M)

#### Historia de Usuario

Como diseñador, quiero definir una paleta de colores y tipografía base.

#### Descripción

Crear guía visual consistente.

#### Tareas Específicas

- Seleccionar colores primarios/secundarios/neutros
- Definir tipografías
- Definir spacing y botones estándar

#### Criterios de Aceptación

- Paleta definida
- Tipografía seleccionada
- UI consistente entre pantallas

### S1-23: Wireframes Pantallas Principales (C)

#### Historia de Usuario

Como diseñador, quiero crear wireframes de las pantallas principales.

#### Descripción

Diseñar estructura de UI antes de implementar.

#### Tareas Específicas

- Pantallas: login, registro, dashboard admin, listado habitaciones, incidencias
- Crear wireframes en Figma
- Validar flujo con equipo
- Iterar en base a feedback

#### Criterios de Aceptación

- Wireframes creados
- Flujos principales validados
- Feedback incorporado
- Las pantallas cubren historias principales

### S1-24: Sistema Inicial de Componentes Reutilizables (S)

#### Historia de Usuario

Como desarrollador, quiero un sistema inicial de componentes reutilizables.

#### Descripción

Acelerar desarrollo frontend con componentes comunes.

#### Tareas Específicas

- Definir librería a utilizar
- Crear componentes base: Button, Input, Card, Table, Modal
- Definir estilos globales
- Asegurar _responsive design_

#### Criterios de Aceptación

- Componentes base creados
- Uso consistente en las distintas pantallas
- Sistema responsivo aplicado correctamente
- Documentación de componentes disponible
- Fácil extensión para Sprint 2

### S1-25: Casos de Prueba Funcionales (M)

#### Historia de Usuario

Como equipo, quiero definir y ejecutar casos de prueba funcionales.

#### Descripción

Garantizar que las funcionalidades core funcionan correctamente.

#### Tareas Específicas

- Definir casos de prueba por historia (registro, login, dashboard, incidencias...)
- Registrar resultados y bugs encontrados
- Priorizar bugs críticos para hotfix

#### Criterios de Aceptación

- Pruebas ejecutadas y registradas
- Bugs críticos identificados
- Funcionalidades core funcionan

### S1-26: Testing de Integración Básico (S)

#### Historia de Usuario

Como equipo, quiero realizar testing de integración básico.

#### Descripción

Implementar tests automáticos para endpoints y flujos principales.

#### Tareas Específicas

- Tests de API: probar endpoints principales, autenticación (registro/login/JWT), CRUD
- Tests frontend-backend: flujos completos (crear incidencia, login y rutas protegidas)
- Cobertura: configurar coverage reports
- Integración CI: tests en pipeline automáticamente

#### Criterios de Aceptación

- Framework de testing configurado
- Los tests cubren endpoints críticos
- Todos los tests pasan
- Tests en pipeline CI/CD
- Coverage report disponible

---

## 7. Resumen y planificación

#### Resumen

En la primera semana, será de suma importancia implementar la base de la aplicación rápidamente para permitir el trabajo en el resto de historias de usuario, por lo que se le dará prioridad absoluta. Así mismo, el objetivo es disponer del despliegue en esta misma semana.

La segunda semana estará plenamente enfocada en implementar las funcionalidades necesarias para el MVP.

#### Planificación

**Semana 1 (19-25 Feb): Fundamentos**
- Completar toda la categoría de Infraestructura (S1-01 a S1-06)
- Comenzar Autenticación (S1-07, S1-08)
- Diseño UX/UI (S1-22, S1-23)
- Componentes reutilizables (S1-24)

**Semana 2 (26 Feb - 4 Mar): Funcionalidades Core**
- Finalizar Autenticación y Usuarios (S1-09 a S1-11)
- Completar Panel Administrativo (S1-12 a S1-16)
- Sistema de Incidencias (S1-17 a S1-21)
- Testing (S1-25, S1-26)

#### Cronograma

![Diagrama de Gantt Sprint 1](../images/sprint_plan/gantt_s1.png)

**Nota**: El testing de cada módulo funcional formará parte del desarrollo de cada uno. No se programará como una actividad independiente.

---

## 8. Entregables finales

#### Entregables Técnicos

- Aplicación desplegada y accesible públicamente
- Código fuente en repositorio con historia clara de commits
- Documentación técnica completa (README, arquitectura, API docs)
- Base de datos con seed data para demostración
- Pipeline CI/CD funcional

#### Entregables de Diseño

- Sistema de diseño documentado (colores, tipografía)
- Wireframes de todas las pantallas principales
- Interfaz implementada y responsiva

#### Entregables de Calidad

- Documento de casos de prueba con resultados
- Tests de integración implementados y pasando
- Lista de bugs conocidos (si los hay) con prioridades

#### Demo Funcional

Preparar demostración que cubra:

- Registro y login de usuarios
- Dashboard administrativo con métricas
- Gestión de habitaciones (CRUD y asignación)
- Creación y gestión de incidencias
- Visualización de ocupación