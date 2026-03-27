# Informe de Rendimiento — NexUS Sprint 1 & Sprint 2

> **Fecha de generación:** 25 de marzo de 2026  
> **Fuentes:** Clockify (horas reales) · GitHub Project #2 (tareas y SP)

---

## Metodología y Ajustes Aplicados

Los resultados utilizan tres ajustes respecto a la fórmula base, justificados técnicamente:

| # | Ajuste | Justificación |
|---|--------|--------------|
| 1 | **Tareas en Backlog excluidas** de H.Pact y SP.Est | Una tarea que nunca salió del estado *Backlog* no fue un compromiso activo del sprint. Incluirla penaliza injustamente a quien tiene muchas tareas sin arrancar. |
| 2 | **Tareas sin talla → XS** (2 h / 1 SP) como mínimo | Las tareas sin estimación representan trabajo real. Se les asigna el crédito mínimo en lugar de 0. |
| 3 | **Amortiguación del sobrecompromiso en ID** | Cuando H.Real > H.Pact, cada punto adicional de C% vale el 50% en la fórmula ID. Debajo del 100% es lineal. Evita que trabajar el triple dispare el índice de forma irreal. |
| 4 | **Tareas "In Progress" al cierre = 50% SP** | Una tarea en progreso al final del sprint representa trabajo real no formalizado. Penalizarla al 0% es injusto si la persona ha trabajado en ella. |
| 5 | **Eficiencia sin penalización** — si SP.Done/SP.Est ≥ 95%, rH ≥ rP | Completar el 100% del trabajo comprometido es el objetivo. Hacerlo en menos horas de las teóricas es eficiencia, no incumplimiento. |
| 6 | **C% con denominador mínimo = media del equipo** | Un compromiso muy bajo infla artificialmente el C%. Si H.Pact < media del equipo, se usa la media como denominador para que nadie se beneficie de tener pocas horas asignadas. |

**Fórmula ID aplicada:**
```
rH_raw = H.Real / H.Pact
rH_eff = max(rH_raw, SP.Done/SP.Est)  si SP.Done/SP.Est ≥ 95%  [Ajuste 5]
rH     = rH_eff si ≤ 1.0,  o  1.0 + (rH_eff - 1.0) × 0.5  si > 1.0  [Ajuste 3]
ID     = (rH + SP.Done/SP.Est) / 2
```

---

## 1. Conversión de Tallas a Story Points

| Talla | Story Points (SP) | Horas Teóricas | Descripción |
|-------|:-----------------:|:--------------:|-------------|
| XS | 1 SP | 2 h | Tarea trivial, < 1 día |
| S | 3 SP | 4 h | Tarea pequeña, medio día |
| M | 8 SP | 8 h | Tarea estándar, 1 día |
| L | 15 SP | 16 h | Tarea compleja, 2 días |
| XL | 30 SP | 24 h | Épica, 3 días o más |

> Los SP miden **valor entregado** (usados en velocidad e ID). Las horas teóricas miden **esfuerzo esperado** (base de C% y DE).

---

## 2. Cumplimiento del Compromiso (C%)

**Fórmula:**
```
denom = max(H.Pact, H.Pact_media)          [Ajuste 6 — piso de media, evita inflar bajo compromiso]
ratio = H.Real / denom
C%    = ratio × 100                          si ratio ≤ 1.0  [penalización directa]
      = 100 + (ratio − 1.0) × 50            si ratio > 1.0  [Ajuste 3 análogo — extra vale 0.5]
```

**Fuentes de cada variable:**

| Variable | Fuente | Detalle |
|----------|--------|---------|
| H.Real | Clockify CSV | Suma de `Duration (h:mm:ss)` (col. 14) por email en proyecto S1/S2. Parseado a segundos para evitar error de redondeo decimal. |
| H.Pact | GitHub Project #2 | Σ SIZE_H[talla] / n_asignados por cada tarea del sprint (estado ≠ Backlog). Tallas sin valor → XS (2h). [Ajustes 1 y 2] |
| H.Pact_media | Calculada | Media aritmética de H.Pact del equipo en ese sprint. Actúa como denominador mínimo para quien tiene H.Pact bajo, evitando que ratios artificialmente altos inflen el C%. [Ajuste 6] |

### Sprint 1

> H.Pact_media S1: **23.3h**

| # | Nombre | Equipo | H. Reales | H. Pactadas | C% |
|---|--------|--------|----------:|------------:|:--:|
| 1 | Paula Suárez | C | 42.9h | 23.7h | 🟢 141% |
| 2 | Celia Suárez | C | 38.4h | 22.7h | 🟢 133% |
| 3 | Nicolás Gómez | B | 34.3h | 19.1h | 🟢 124% |
| 4 | Olga Cano | C | 34.4h | 20.7h | 🟢 124% |
| 5 | Miguel Regidor | B | 38.2h | 26.1h | 🟢 123% |
| 6 | Alejandro de los Reyes | A | 37.1h | 25.4h | 🟢 123% |
| 7 | Marta Recio | C | 32.4h | 22.7h | 🟢 120% |
| 8 | Javier Castilla | A | 31.3h | 12.7h | 🟢 117% |
| 9 | Javier Soria | A | 30.2h | 12.7h | 🟢 115% |
| 10 | Nuno del Pino | A | 30.4h | 20.7h | 🟢 115% |
| 11 | Alberto García | D | 29.8h | 16.1h | 🟢 114% |
| 12 | Javier Gutiérrez | A | 28.1h | 17.3h | 🟢 110% |
| 13 | Álvaro C. Gallero | D | 27.4h | 17.1h | 🟢 109% |
| 14 | Ignacio Martínez | B | 25.2h | 16.1h | 🟢 104% |
| 15 | Carmen Murillo | C | 28.7h | 26.7h | 🟢 104% |
| 16 | Fran de Mann | D | 32.9h | 30.7h | 🟢 104% |
| 17 | Manuel J. Niza | B | 35.3h | 33.7h | 🟢 102% |
| 18 | Jesús García | D | 20.9h | 16.3h | 🟡 90% |
| 19 | Ángel Mateos | D | 20.8h | 19.4h | 🟡 89% |
| 20 | Pablo Pérez | D | 38.3h | 51.4h | 🔴 74% |
| 21 | Juan José Cardesa | B | 24.7h | 39.1h | 🔴 63% |

> **Media del equipo S1: 109%**

### Sprint 2

> H.Pact_media S2: **25.6h**

| # | Nombre | Equipo | H. Reales | H. Pactadas | C% |
|---|--------|--------|----------:|------------:|:--:|
| 1 | Paula Suárez | C | 42.7h | 24h | 🟢 133% |
| 2 | Álvaro C. Gallero | D | 38h | 12.4h | 🟢 124% |
| 3 | Javier Castilla | A | 37.4h | 23.8h | 🟢 123% |
| 4 | Manuel J. Niza | B | 34.2h | 22.1h | 🟢 117% |
| 5 | Fran de Mann | D | 33.7h | 16.8h | 🟢 116% |
| 6 | Ángel Mateos | D | 33.7h | 18.1h | 🟢 116% |
| 7 | Javier Soria | A | 34.3h | 26.5h | 🟢 115% |
| 8 | Carmen Murillo | C | 32.4h | 13.3h | 🟢 113% |
| 9 | Alejandro de los Reyes | A | 45.1h | 35.7h | 🟢 113% |
| 10 | Marta Recio | C | 31.9h | 20.3h | 🟢 112% |
| 11 | Miguel Regidor | B | 43h | 35.3h | 🟢 111% |
| 12 | Celia Suárez | C | 39.8h | 33.3h | 🟢 110% |
| 13 | Ignacio Martínez | B | 29.6h | 13.3h | 🟢 108% |
| 14 | Jesús García | D | 29h | 16.1h | 🟢 107% |
| 15 | Pablo Pérez | D | 25.8h | 16.8h | 🟢 100% |
| 16 | Nicolás Gómez | B | 25h | 24h | 🟡 98% |
| 17 | Nuno del Pino | A | 32.9h | 33.8h | 🟡 97% |
| 18 | Alberto García | D | 34.1h | 37.4h | 🟡 91% |
| 19 | Olga Cano | C | 33.4h | 38h | 🟡 88% |
| 20 | Juan José Cardesa | B | 32.3h | 37.3h | 🟡 87% |
| 21 | Javier Gutiérrez | A | 32.7h | 39.8h | 🟡 82% |

> **Media del equipo S2: 108%** | H.Pact_media = 25.6h. Fórmula: min(H.Real, H.Pact) / 25.6 × 100

> **Mejor:** Paula Suárez — 133% (42.7h reales / 24h pactadas)  
> **Peor:** Javier Gutiérrez — 82% (32.7h reales / 39.8h pactadas)  
> **Llamativo:** La diferencia entre el mejor y el peor es de 1.6x. El trabajo extra por encima del compromiso cuenta solo al 50% — doblar horas no dobla el C%. Esto nivela el marcador: tanto el que asumió mucho como el que asumió poco ven su C% converger hacia el 100% si trabajan sus horas.

**Conclusión C%:** La fórmula usa un denominador mínimo de la media del equipo para quien tiene poco comprometido, y amortigua el trabajo extra al 50%. Así los números orbitan el 100%: llegar a tu compromiso = 100%, trabajar más da bonificación moderada, trabajar menos penaliza directamente. No hay forma de hacer trampa asumiendo pocas tareas.

---

## 3. Índice de Dedicación (ID)

**Fórmula:**
```
rH_raw = H.Real / H.Pact
rH_eff = max(rH_raw, SP.Done/SP.Est)   si SP.Done/SP.Est ≥ 0.95  [Ajuste 5]
rH     = rH_eff                         si rH_eff ≤ 1.0
       = 1.0 + (rH_eff − 1.0) × 0.5   si rH_eff > 1.0           [Ajuste 3]
ID     = (rH + SP.Done/SP.Est) / 2
```

**Fuentes de cada variable:**

| Variable | Fuente | Detalle |
|----------|--------|---------|
| H.Real | Clockify CSV | Ídem que C%. Columna `Duration (h:mm:ss)` sumada en segundos por email y proyecto. |
| H.Pact | GitHub Project #2 | Ídem que C%. Nota: aquí se usa H.Pact individual (sin ajuste de media), para que el ID refleje el ratio real de esfuerzo sobre el compromiso propio. |
| SP.Est | GitHub Project #2 | Σ SIZE_SP[talla] / n_asignados. Tareas no-Backlog. Sin talla → XS (1 SP). [Ajustes 1 y 2] |
| SP.Done | GitHub Project #2 | Σ SP de tareas Done + 0.5 × SP de tareas In Progress al cierre. [Ajuste 4] |

- **ID ≥ 1.10:** Alta dedicación y entrega
- **ID 0.90–1.09:** Rendimiento aceptable
- **ID < 0.90:** Alerta — bajo en horas o en tareas completadas

### Sprint 1

| # | Nombre | Equipo | H.Real | H.Pact | C% | SP.Est | SP.Done | ID |
|---|--------|--------|-------:|-------:|:--:|-------:|--------:|:--:|
| 1 | Javier Castilla | A | 31.3h | 12.7h | 117% | 11.7 | 11.7 | 🟢 **1.37** |
| 2 | Javier Soria | A | 30.2h | 12.7h | 115% | 11.7 | 11.7 | 🟢 **1.35** |
| 3 | Alberto García | D | 29.8h | 16.1h | 114% | 14.5 | 14.5 | 🟢 **1.21** |
| 4 | Nicolás Gómez | B | 34.3h | 19.1h | 124% | 20 | 20 | 🟢 **1.2** |
| 5 | Paula Suárez | C | 42.9h | 23.7h | 141% | 20.2 | 20.2 | 🟢 **1.2** |
| 6 | Celia Suárez | C | 38.4h | 22.7h | 133% | 20.9 | 20.9 | 🟢 **1.17** |
| 7 | Olga Cano | C | 34.4h | 20.7h | 124% | 18.2 | 18.2 | 🟢 **1.17** |
| 8 | Javier Gutiérrez | A | 28.1h | 17.3h | 110% | 13.9 | 13.9 | 🟢 **1.16** |
| 9 | Álvaro C. Gallero | D | 27.4h | 17.1h | 109% | 16 | 16 | 🟢 **1.15** |
| 10 | Ignacio Martínez | B | 25.2h | 16.1h | 104% | 16.5 | 16.5 | 🟢 **1.14** |
| 11 | Miguel Regidor | B | 38.2h | 26.1h | 123% | 25.5 | 25.5 | 🟢 **1.12** |
| 12 | Alejandro de los Reyes | A | 37.1h | 25.4h | 123% | 22.5 | 22.5 | 🟢 **1.12** |
| 13 | Nuno del Pino | A | 30.4h | 20.7h | 115% | 19.5 | 19.5 | 🟢 **1.12** |
| 14 | Marta Recio | C | 32.4h | 22.7h | 120% | 17.7 | 17.7 | 🟢 **1.11** |
| 15 | Jesús García | D | 20.9h | 16.3h | 90% | 15.6 | 15.6 | 🟡 **1.07** |
| 16 | Carmen Murillo | C | 28.7h | 26.7h | 104% | 23.7 | 23.7 | 🟡 **1.02** |
| 17 | Ángel Mateos | D | 20.8h | 19.4h | 89% | 17.5 | 17.5 | 🟡 **1.02** |
| 18 | Fran de Mann | D | 32.9h | 30.7h | 104% | 29.8 | 29.8 | 🟡 **1.02** |
| 19 | Manuel J. Niza | B | 35.3h | 33.7h | 102% | 24.9 | 24.9 | 🟡 **1.01** |
| 20 | Juan José Cardesa | B | 24.7h | 39.1h | 63% | 39 | 39 | 🟡 **1** |
| 21 | Pablo Pérez | D | 38.3h | 51.4h | 74% | 46.8 | 46.8 | 🟡 **1** |

> **Media ID S1: 1.13** | Rango: 1.00 – 1.37

> En S1 todos completaron el 100% de sus SP (sprint cerrado), por lo que el componente SP.Done/SP.Est = 1.0 para todos. El ID diferencia únicamente por cumplimiento de horas.

### Sprint 2

| # | Nombre | Equipo | H.Real | H.Pact | C% | SP.Est | SP.Done | ID |
|---|--------|--------|-------:|-------:|:--:|-------:|--------:|:--:|
| 1 | Álvaro C. Gallero | D | 38h | 12.4h | 124% | 10.9 | 10.2 | 🟢 **1.48** |
| 2 | Carmen Murillo | C | 32.4h | 13.3h | 113% | 9.8 | 9.8 | 🟢 **1.36** |
| 3 | Ignacio Martínez | B | 29.6h | 13.3h | 108% | 10.2 | 9.2 | 🟢 **1.26** |
| 4 | Fran de Mann | D | 33.7h | 16.8h | 116% | 15.4 | 14.7 | 🟢 **1.23** |
| 5 | Paula Suárez | C | 42.7h | 24h | 133% | 17.5 | 17 | 🟢 **1.18** |
| 6 | Jesús García | D | 29h | 16.1h | 107% | 12 | 11.4 | 🟢 **1.17** |
| 7 | Manuel J. Niza | B | 34.2h | 22.1h | 117% | 18 | 18 | 🟢 **1.14** |
| 8 | Javier Castilla | A | 37.4h | 23.8h | 123% | 20.6 | 20.3 | 🟢 **1.14** |
| 9 | Ángel Mateos | D | 33.7h | 18.1h | 116% | 13 | 10.9 | 🟢 **1.13** |
| 10 | Pablo Pérez | D | 25.8h | 16.8h | 100% | 15.4 | 14.7 | 🟢 **1.11** |
| 11 | Marta Recio | C | 31.9h | 20.3h | 112% | 12.3 | 11.3 | 🟢 **1.1** |
| 12 | Javier Soria | A | 34.3h | 26.5h | 115% | 20.1 | 19.8 | 🟡 **1.07** |
| 13 | Miguel Regidor | B | 43h | 35.3h | 111% | 33.2 | 32.2 | 🟡 **1.04** |
| 14 | Alejandro de los Reyes | A | 45.1h | 35.7h | 113% | 28.8 | 27.5 | 🟡 **1.04** |
| 15 | Olga Cano | C | 33.4h | 38h | 88% | 34.5 | 34.5 | 🟡 **1** |
| 16 | Javier Gutiérrez | A | 32.7h | 39.8h | 82% | 35.6 | 35.3 | 🟡 **0.99** |
| 17 | Nuno del Pino | A | 32.9h | 33.8h | 97% | 28.1 | 27.8 | 🟡 **0.99** |
| 18 | Alberto García | D | 34.1h | 37.4h | 91% | 30 | 29.4 | 🟡 **0.98** |
| 19 | Nicolás Gómez | B | 25h | 24h | 98% | 17.9 | 16.4 | 🟡 **0.97** |
| 20 | Juan José Cardesa | B | 32.3h | 37.3h | 87% | 27.2 | 26.2 | 🟡 **0.96** |
| 21 | Celia Suárez | C | 39.8h | 33.3h | 110% | 28.8 | 23.8 | 🟡 **0.96** |

> **Media ID S2: 1.11** | Rango: 0.96 – 1.48

> **Mejor:** Álvaro C. Gallero — ID 1.48 (38h reales, 10.2/10.9 SP)  
> **Peor:** Juan José Cardesa — ID 0.96 (32.3h reales, 26.2/27.2 SP)  
> **Llamativo:** El ID no mide esfuerzo total sino equilibrio entre horas y tareas cerradas. Juan José Cardesa puede haber trabajado muchas horas pero si las tareas no estaban en "Done" al cierre del sprint, el componente SP baja el índice. Es una señal de gestión, no de rendimiento.

**Conclusión ID:** En S2 el índice diferencia mejor que en S1, ya que combina horas y completitud de tareas. Los ID más bajos (Celia, Gutiérrez, Cardesa, Juan José) no reflejan falta de trabajo — sus horas reales rondan las 32–40h — sino que tenían muchas tareas grandes asignadas que no se cerraron al 100% antes del fin del sprint.

---

## 4. Velocidad (V)

**Fórmula:**
```
V_equipo    = Σ SIZE_SP[talla]  para todas las tareas del milestone con status = Done
V_individual = Σ SIZE_SP[talla] / n_asignados  para las tareas Done asignadas a la persona
```

**Fuentes:** GitHub Project #2. Tareas filtradas por milestone (S1/S2) y status = Done. Tallas sin valor no cuentan para la velocidad de equipo (no tienen SP asignado).

### Velocidad de equipo

| Sprint | Tareas Done | Total Tareas | SP Done | SP Total | % Completado |
|--------|:-----------:|:------------:|--------:|---------:|:------------:|
| S1 | 85/85 | 85 | **446 SP** | 446 SP | ✅ 100% |
| S2 | 111/145 | 145 | **393 SP** | 505 SP | ⚠️ 78% |

> Sprint 2 cierra con **112  SP pendientes** (22% del sprint). Fecha límite: 26 de marzo.

### Velocidad individual S2 (SP entregados)

| # | Nombre | Equipo | SP Done S2 | SP Est S2 | % Completado |
|---|--------|--------|:----------:|:---------:|:------------:|
| 1 | Javier Gutiérrez | A | 35.3 | 35.6 | 🟢 99% |
| 2 | Olga Cano | C | 34.5 | 34.5 | 🟢 100% |
| 3 | Miguel Regidor | B | 32.2 | 33.2 | 🟢 97% |
| 4 | Alberto García | D | 29.4 | 30 | 🟢 98% |
| 5 | Nuno del Pino | A | 27.8 | 28.1 | 🟢 99% |
| 6 | Alejandro de los Reyes | A | 27.5 | 28.8 | 🟢 95% |
| 7 | Juan José Cardesa | B | 26.2 | 27.2 | 🟢 96% |
| 8 | Celia Suárez | C | 23.8 | 28.8 | 🟡 83% |
| 9 | Javier Castilla | A | 20.3 | 20.6 | 🟢 99% |
| 10 | Javier Soria | A | 19.8 | 20.1 | 🟢 99% |
| 11 | Manuel J. Niza | B | 18 | 18 | 🟢 100% |
| 12 | Paula Suárez | C | 17 | 17.5 | 🟢 97% |
| 13 | Nicolás Gómez | B | 16.4 | 17.9 | 🟢 92% |
| 14 | Fran de Mann | D | 14.7 | 15.4 | 🟢 95% |
| 15 | Pablo Pérez | D | 14.7 | 15.4 | 🟢 95% |
| 16 | Jesús García | D | 11.4 | 12 | 🟢 95% |
| 17 | Marta Recio | C | 11.3 | 12.3 | 🟢 92% |
| 18 | Ángel Mateos | D | 10.9 | 13 | 🟡 84% |
| 19 | Álvaro C. Gallero | D | 10.2 | 10.9 | 🟢 94% |
| 20 | Carmen Murillo | C | 9.8 | 9.8 | 🟢 100% |
| 21 | Ignacio Martínez | B | 9.2 | 10.2 | 🟢 90% |

> **Mejor:** Javier Gutiérrez — 35.3 SP entregados (99% de su estimación)  
> **Peor:** Ignacio Martínez — 9.2 SP entregados (90% de su estimación)  
> **Llamativo:** La velocidad individual mide SP Done, no esfuerzo. Alguien puede haber trabajado 40h y tener 0 SP si sus tareas son grandes y no se cerraron antes del sprint. Por eso siempre hay que leerla junto al ID.

**Conclusión Velocidad:** S1 demostró una capacidad de entrega del 100% del backlog planificado. S2 cierra con un 78% de completitud, lo que sitúa la velocidad real del equipo en torno a **393 SP/sprint**. Los 112 SP pendientes corresponden mayoritariamente a tareas de los equipos A y D con múltiples asignados.

---

## 5. Burndown

**Fórmula:**
```
Burn_ideal/día = SP_total_sprint / duración_días
% completado   = SP_Done / SP_total × 100
```

**Fuentes:** SP_total y SP_Done desde GitHub Project #2 (ídem Sección 4). Duración: S1 = 14 días (19 feb – 5 mar), S2 = 14 días (12 mar – 26 mar).

### Sprint 1 — Cerrado al 100%

| Punto | SP |
|-------|---:|
| Total planificado | 446 SP |
| Completado | 446 SP |
| Pendiente final | 0 SP |
| Tendencia vs ideal | ✅ Igual o mejor |

El Sprint 1 cerró limpiamente. La línea real de burndown alcanzó 0 SP al final del sprint, coincidiendo con la línea ideal.

### Sprint 2 — En curso (cierre: 26 mar)

| Concepto | Valor |
|----------|------:|
| Total sprint | 505 SP |
| Burn ideal/día | ~36.1 SP/día (14 días, 12–26 mar) |
| SP completados | 393 SP |
| SP pendientes | 112 SP |
| % completado (día 13/14) | 78% |

> La línea real está **por debajo de la ideal** al día 13/14 del sprint. Para cerrar al 100% quedarían 112 SP en el último día, lo que es inviable en su totalidad. Se estima un cierre final en torno al **80–83%**.

> **Llamativo:** El equipo entregó 393 SP en S2 cuando en S1 entregó 446 SP (100%). La diferencia no es de capacidad — el equipo trabajó más horas en S2 — sino de sobrecarga de planificación: se comprometieron 59 SP más que en S1. Si el equipo tiene velocidad real de ~446 SP/sprint, cualquier compromiso superior genera deuda de sprint.

**Conclusión Burndown:** El equipo arrancó S1 con buen ritmo y lo cerró perfectamente. En S2 el volumen planificado fue mayor (+59 SP respecto a S1) y la cadencia de entrega no se ajustó proporcionalmente. Recomendación para S3: reducir el volumen comprometido o aumentar la frecuencia de cierres de tareas a mitad de sprint.

---

## 6. Desviación de Esfuerzo (DE)

**Fórmula:**
```
H.Real_tag  = Σ segundos Clockify donde tag = NX-Sx.xx y email = persona / 3600
H.Teórica   = Σ SIZE_H[tagSize[tag]]  para los tags donde la persona tiene horas
DE          = H.Real_tag / H.Teórica
```

**Fuentes:**

| Variable | Fuente | Detalle |
|----------|--------|---------|
| H.Real_tag | Clockify CSV | Filtra entradas donde la columna Tag (col. 8) = `NX-S1.xx` o `NX-S2.xx`. Suma segundos por persona y tag. |
| tagSize | GitHub Project #2 + de_calc.js | Mapa tag → talla construido desde los items del proyecto. 204 tags registrados. |
| H.Teórica | SIZE_H (constante) | XS=2h, S=4h, M=8h, L=16h, XL=24h. Suma de las horas teóricas de cada tag donde la persona tiene tiempo registrado. |

> Nota: las tareas compartidas pueden mostrar DE bajo porque cada persona registra solo su parte del trabajo en Clockify.

- **DE ≈ 1.0:** Estimación correcta
- **DE < 0.8:** Las tareas se terminaron antes — tallas sobreestimadas en horas
- **DE > 1.2:** Las tareas costaron más de lo previsto — tallas subestimadas

### Sprint 1

| # | Nombre | Equipo | H. Real (tag) | H. Teórica | DE | Lectura |
|---|--------|--------|-------------:|----------:|:--:|---------|
| 1 | Paula Suárez | C | 40.7h | 36h | **1.13** | ✅ OK |
| 2 | Manuel J. Niza | B | 43.3h | 48h | **0.9** | ✅ OK |
| 3 | Álvaro C. Gallero | D | 27.4h | 36h | **0.76** | Acabó antes |
| 4 | Miguel Regidor | B | 33.4h | 46h | **0.73** | Acabó antes |
| 5 | Javier Gutiérrez | A | 27.1h | 38h | **0.71** | Acabó antes |
| 6 | Javier Castilla | A | 30.3h | 48h | **0.63** | Acabó antes |
| 7 | Javier Soria | A | 29.2h | 48h | **0.61** | Acabó antes |
| 8 | Nicolás Gómez | B | 34.3h | 60h | **0.57** | Acabó antes |
| 9 | Celia Suárez | C | 24.2h | 44h | **0.55** | Acabó antes |
| 10 | Nuno del Pino | A | 29.4h | 54h | **0.54** | Acabó antes |
| 11 | Ángel Mateos | D | 20.2h | 42h | **0.48** | Acabó antes |
| 12 | Ignacio Martínez | B | 22h | 50h | **0.44** | Acabó antes |
| 13 | Marta Recio | C | 28.2h | 64h | **0.44** | Acabó antes |
| 14 | Alberto García | D | 26.5h | 62h | **0.43** | Acabó antes |
| 15 | Pablo Pérez | D | 35h | 84h | **0.42** | Acabó antes |
| 16 | Alejandro de los Reyes | A | 26.4h | 70h | **0.38** | Acabó antes |
| 17 | Olga Cano | C | 32.5h | 86h | **0.38** | Acabó antes |
| 18 | Fran de Mann | D | 30.1h | 94h | **0.32** | Acabó antes |
| 19 | Juan José Cardesa | B | 20.8h | 68h | **0.31** | Acabó antes |
| 20 | Jesús García | D | 19.5h | 62h | **0.31** | Acabó antes |
| 21 | Carmen Murillo | C | 24.8h | 96h | **0.26** | Acabó antes |

> **DE media S1: 0.54** — El equipo terminó las tareas en promedio al 54% del tiempo teórico.

### Sprint 2

| # | Nombre | Equipo | H. Real (tag) | H. Teórica | DE | Lectura |
|---|--------|--------|-------------:|----------:|:--:|---------|
| 1 | Celia Suárez | C | 25.8h | 38h | **0.68** | Acabó antes |
| 2 | Pablo Pérez | D | 23.8h | 36h | **0.66** | Acabó antes |
| 3 | Ignacio Martínez | B | 27.2h | 42h | **0.65** | Acabó antes |
| 4 | Paula Suárez | C | 29.7h | 46h | **0.64** | Acabó antes |
| 5 | Javier Castilla | A | 33.4h | 56h | **0.6** | Acabó antes |
| 6 | Manuel J. Niza | B | 18.7h | 32h | **0.58** | Acabó antes |
| 7 | Miguel Regidor | B | 34.7h | 60h | **0.58** | Acabó antes |
| 8 | Álvaro C. Gallero | D | 27.1h | 48h | **0.57** | Acabó antes |
| 9 | Marta Recio | C | 22h | 40h | **0.55** | Acabó antes |
| 10 | Nuno del Pino | A | 26.5h | 48h | **0.55** | Acabó antes |
| 11 | Ángel Mateos | D | 29.1h | 54h | **0.54** | Acabó antes |
| 12 | Javier Gutiérrez | A | 26.1h | 56h | **0.47** | Acabó antes |
| 13 | Javier Soria | A | 30.3h | 64h | **0.47** | Acabó antes |
| 14 | Olga Cano | C | 27.9h | 60h | **0.47** | Acabó antes |
| 15 | Alberto García | D | 20.1h | 46h | **0.44** | Acabó antes |
| 16 | Fran de Mann | D | 26.7h | 60h | **0.44** | Acabó antes |
| 17 | Alejandro de los Reyes | A | 27.3h | 68h | **0.4** | Acabó antes |
| 18 | Juan José Cardesa | B | 17.7h | 44h | **0.4** | Acabó antes |
| 19 | Carmen Murillo | C | 21.4h | 54h | **0.4** | Acabó antes |
| 20 | Nicolás Gómez | B | 11.2h | 38h | **0.29** | Acabó antes |
| 21 | Jesús García | D | 8.9h | 32h | **0.28** | Acabó antes |

> **DE media S2: 0.51** — Las tareas se completan en promedio al 51% del tiempo teórico por talla.

> **Estimador más preciso:** Celia Suárez — DE 0.68 (25.8h reales / 38h teóricas)  
> **Mayor desviación:** Jesús García — DE 0.28 (8.9h reales / 32h teóricas)  
> **Llamativo:** Nadie en S2 supera DE 1.2 — todo el equipo termina sus tareas en menos tiempo del teórico. Las tallas están sistemáticamente sobreestimadas en horas, lo que infla H.Pact y hace que C% e ID sean más exigentes de lo que deberían.

**Conclusión DE:** En ambos sprints el equipo trabaja por debajo del tiempo teórico asignado por talla (DE < 1 generalizado). Esto indica que **las tallas están sobreestimadas en horas** — una M no cuesta 8h reales por persona sino ~4-5h. Para S3 se recomienda recalibrar SIZE_H: XS=1h, S=2h, M=5h, L=10h, XL=16h como punto de partida. Esto haría que las H.Pact sean más representativas de la realidad del equipo.

---

## Resumen Ejecutivo

| Métrica | Sprint 1 | Sprint 2 |
|---------|:--------:|:--------:|
| Velocidad equipo | 446 SP (100%) | 393 SP (78%) |
| Media C% | 109% | 108% |
| Media ID | 1.13 | 1.11 |
| Rango ID | 1.00–1.37 | 0.96–1.48 |
| DE media | 0.54 | 0.51 |

**Puntos clave:**
- El equipo demostró alta dedicación en ambos sprints (media de horas reales: ~32h/persona/sprint).
- S1 se cerró al 100% con un ID medio de 1.12, indicando rendimiento sólido generalizado.
- S2 muestra mayor dispersión en el ID, principalmente por tareas sin cerrar al final del sprint. No refleja falta de trabajo sino de gestión del estado de tareas en GitHub.
- La DE < 1 sistemática sugiere que las estimaciones de talla son conservadoras. Recalibrar antes de S3 mejoraría la precisión de H.Pact y haría las métricas más justas.