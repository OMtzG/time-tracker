# Config Report — Inspector (actualizado 2026-06-27)

## Resumen ejecutivo (leer primero)

**Objetivo del usuario CUMPLIDO.** Las horas objetivo de cada categoría — incluidas **"Curso" e "Introspección"** — son configurables desde la app. Existe un modal de Configuración (botón ⚙) con un input numérico por categoría que persiste en `localStorage` bajo la clave `time_config`. Editar y Guardar refresca selects y resúmenes en caliente. No hay nada roto.

**Estado tras la ejecución anterior:** se vació el contenido estático de `#config-goals-list` (ya no tiene las filas hardcodeadas `2/8/5`); el contenedor está vacío con comentario explicativo (`index.html:426-427`). ✅ Verificado en el árbol actual (`git diff --stat`: index.html, +30/−39).

**Pendiente real (menor, opcional):** dos limpiezas de bajo riesgo, ninguna bloqueante para el objetivo:
1. `value="3"` redundante en `#config-penalty-rate` (`index.html:421`) — sigue presente.
2. Loop muerto de listeners `.btn-remove-category` en `DOMContentLoaded` (`index.html:1492-1495`).

> Cualquier "bug crítico" de `openConfigModal()`/`saveConfig()` mencionado en informes antiguos **ya no existe**: el código actual reconstruye la lista dinámicamente y `saveConfig()` refresca resúmenes.

---

## Archivos analizados

| Archivo | Propósito | ¿Lo usa la app? |
|---|---|---|
| `index.html` | **App real desplegada.** Bundle autocontenido: HTML + CSS inline + 6 bloques `<script>` inline (Storage/Categories, Timer, History/Hoy, Summaries, Export, Config modal). Único `src` externo: Chart.js por CDN (`:7`). | ✅ SÍ |
| `data.js` | Versión modular de Storage/Categories (`time_entries`, `time_config`). `DEFAULT_CONFIG` duplicado. | ❌ NO enlazado |
| `timer.js` | Temporizador y entradas del día (modular). | ❌ NO |
| `history.js` | Historial (modular). | ❌ NO |
| `summaries.js` | Resúmenes semanales/mensuales (modular). | ❌ NO |
| `export.js` | Exportación CSV/XLSX/JSON (modular). | ❌ NO |
| `styles.css` | Hoja de estilos modular (incluye `.badge--introspection/project/course`). | ❌ NO (index.html tiene su CSS inline) |
| `shell.html` | Esqueleto auxiliar; referencia un `app.js` inexistente e IDs distintos. | ❌ NO (incompatible/muerto) |
| `data/backup-registro-horas-2026-06-21.json` | Backup de entradas + config exportado. | Datos, no código |
| `data/backup-registro-horas-2026-06-20.json`, `data/registro-horas-2026-06-20.csv` | Backups/export previos. | Datos |
| `README.md`, `comandos.txt` | Documentación / comandos de desarrollo. | — |
| `tmp/config_report.md`, `tmp/changes_log.md`, `tmp/review_report.md` | Informes de las ejecuciones del equipo. | Meta |

> **Hallazgo clave:** el repo tiene DOS implementaciones paralelas — los `*.js`/`styles.css`/`shell.html` (modular) y la copia inline dentro de `index.html`. **Solo la inline está viva.** `grep "<script" index.html` confirma que el único recurso externo es Chart.js; los `*.js` no se enlazan. Toda la lógica viva está en `index.html`; los `*.js` son código legacy/muerto duplicado.

---

## Mecanismo de configuración de horas objetivo (estado: ✅ FUNCIONAL)

Categorías y metas viven en un único objeto `config` en `localStorage` (clave `time_config`), con `DEFAULT_CONFIG` de respaldo (`index.html:466-470`):

```js
DEFAULT_CONFIG = {
  sanction_rate_eur: 3.0,
  weekly_targets: { 'Introspección': 2, 'Proyecto': 8, 'Curso': 5 },
  categories: ['Introspección', 'Proyecto', 'Curso']
}
```

- `weekly_targets`: mapa `nombre → horas objetivo/semana`. **Aquí está la "hora objetivo" configurable.**
- `Storage.getConfig` rellena `weekly_targets`/`sanction_rate_eur` faltantes desde el default (`:504-505`).

Flujo del modal (todo en `index.html`):

| Pieza | Línea | Qué hace |
|---|---|---|
| Botón ⚙ `#btn-config` | `230` / listener `1480-1481` | Abre `openConfigModal`. |
| `buildGoalRow(name, goalVal)` | `1400-1410` | Crea fila `.config-goal-row` con badge, `input.goal-input` editable (`value=goalVal`), unidad "h/semana" y botón eliminar **con su propio listener** (`1408`). |
| `openConfigModal()` | `1411-1425` | Fija la tarifa (`1415`), **vacía** `#config-goals-list` (`1418`) y **reconstruye** una fila por categoría desde `config.categories`/`config.weekly_targets` (`1419-1422`). ✅ Dinámico. |
| `saveConfig()` | `1430-1445` | Lee cada `.goal-input` → `config.weekly_targets[cat]=parseFloat(input.value)||0` (`1434-1437`), guarda, refresca `populateCategorySelects` (`1441`) y `Summaries.refresh` (`1442-1444`). ✅ |
| `addCategoryFromModal()` | `1452-1464` | Añade categoría (nombre + meta) y la persiste. |
| `removeCategoryRow()` | `1447-1451` | Elimina categoría; bloquea si tiene entradas recientes (`Categories.remove`). |

Consumo de las metas: `calcWeekSummary` (`index.html:877+`) usa `targets[cat]` para déficit/sanción; el resumen y el gráfico (~`1237`) las pintan.

**Conclusión:** mecanismo completo y operativo. Para verificar basta abrir ⚙, cambiar Curso/Introspección, Guardar y ver el déficit/meta actualizados en Resúmenes.

---

## Valores hardcodeados restantes

### En `index.html` (LA APP REAL)

| Línea | Valor | Contexto | ¿Problema? |
|---|---|---|---|
| `468` | `{ 'Introspección': 2, 'Proyecto': 8, 'Curso': 5 }` | `DEFAULT_CONFIG.weekly_targets` (fallback legítimo) | **OK** — default correcto y única fuente de verdad. |
| `467` | `3.0` | `DEFAULT_CONFIG.sanction_rate_eur` | OK — default legítimo. |
| `421` | `value="3"` | Input estático `#config-penalty-rate` en el modal | **SÍ, redundante.** `openConfigModal()` lo sobrescribe siempre con `config.sanction_rate_eur` (`:1415`). Nunca se lee en runtime; magic number decorativo que puede desincronizarse del `DEFAULT_CONFIG`. |
| `426-427` | (vacío) | `#config-goals-list` ya vaciado con comentario | **OK** — limpiado en la ejecución anterior. ✅ Ya no hay filas estáticas `2/8/5`. |

> `grep` confirma que **no quedan** filas `.config-goal-row` estáticas ni valores `2/8/5` en el HTML del modal (solo aparecen en `DEFAULT_CONFIG`, donde corresponde).

### En datos (esperado, no es código)

| Archivo:línea | Valor | Contexto |
|---|---|---|
| `data/backup-...2026-06-21.json:67-72` | `sanction_rate_eur:3`, `Introspección:2, Proyecto:8, Curso:5` | Snapshot de la config del usuario (correcto). |

### En `*.js` legacy (código muerto, no se ejecuta)

| Archivo | Valor | Contexto |
|---|---|---|
| `data.js` | `{Introspección:2, Proyecto:8, Curso:5}` | `DEFAULT_CONFIG` duplicado. No requiere cambios (no se enlaza). |

---

## Respuestas a las preguntas concretas

**1. `#config-penalty-rate` con `value="3"` (línea 421) — ¿sigue siendo redundante?**
**SÍ.** Sigue presente y sigue siendo redundante. `openConfigModal()` fija `rateEl.value = config.sanction_rate_eur` cada vez que se abre el modal (`index.html:1415`), por lo que el `value="3"` estático nunca se muestra al usuario en runtime. Es un magic number decorativo que puede desincronizarse del `DEFAULT_CONFIG`. La ejecución anterior lo dejó intencionadamente fuera de alcance.

**2. Loop de listeners `.btn-remove-category` en `DOMContentLoaded` (línea ~1492) — ¿es código muerto?**
**SÍ, es código muerto.** Por dos razones independientes:
- Al cargar la página, `#config-goals-list` está **vacío** (`:427`), por lo que `document.querySelectorAll('.btn-remove-category')` (`:1492`) no encuentra ningún elemento y **no engancha nada**.
- Aunque hubiera filas, sería **redundante**: `buildGoalRow()` ya añade su propio listener de eliminación a cada botón (`:1408`). El loop usa `row.getAttribute('data-category')` para reconstruir el nombre, que `buildGoalRow` ya pasa directamente.

No causa daño (no hay error), pero es inofensivo y eliminable.

---

## Inconsistencias detectadas (con severidad)

1. **[BAJA] `value="3"` redundante en `#config-penalty-rate`** (`index.html:421`): sobrescrito al abrir el modal. Magic number decorativo. → limpieza recomendada.
2. **[BAJA] Loop muerto `.btn-remove-category` en `DOMContentLoaded`** (`index.html:1492-1495`): no engancha nada (lista vacía al cargar) y duplica el listener que ya pone `buildGoalRow`. → eliminable.
3. **[MEDIA] Doble implementación / código duplicado**: `data.js`, `summaries.js`, `export.js`, `history.js`, `timer.js`, `styles.css`, `shell.html` reimplementan lo que ya está inline en `index.html` pero **no están enlazados**. Riesgo de editar el archivo equivocado. → fuera de alcance; documentar o borrar.
4. **[MEDIA] `DEFAULT_CONFIG` duplicado** en `index.html:466` y `data.js`. Para cambiar el default basta tocar `index.html` (el otro es legacy).
5. **[BAJA] Opciones de categoría hardcodeadas** en los `<select>` estáticos de timer/manual, sobreescritas en runtime por `populateCategorySelects()` (`:770`). Redundantes; pueden confundir.
6. **[BAJA] `shell.html` referencia `app.js` inexistente** e IDs distintos a `index.html`. Esqueleto incompatible/muerto.
7. **[BAJA] Validación mínima en `saveConfig`**: `parseFloat(input.value)||0` convierte vacío/NaN en 0 silenciosamente; solo hay `min="0"` (sin tope superior). Aceptable.

---

## Estrategia recomendada para Programador (mínima — solo lo necesario)

El objetivo del usuario **ya está cumplido**. Lo único pendiente es una limpieza de bajo riesgo, en **un solo archivo: `index.html`**. No tocar JS de lógica, ni `DEFAULT_CONFIG`, ni los `*.js`/`shell.html` legacy.

### Cambios exactos a realizar

| # | Línea | Acción | Antes → Después |
|---|---|---|---|
| 1 | `index.html:421` | Quitar el `value="3"` estático del input de tarifa (lo fija `openConfigModal`). | `<input type="number" id="config-penalty-rate" class="input" min="0" step="0.5" value="3" />` → `<input type="number" id="config-penalty-rate" class="input" min="0" step="0.5" />` |
| 2 | `index.html:1491-1495` | Eliminar el loop muerto de listeners `.btn-remove-category` (incluido el comentario `// Remove category buttons`). `buildGoalRow` ya añade el listener (`:1408`). | Borrar las 5 líneas `1491-1495`. |

> Ambos cambios son seguros y no alteran el comportamiento: el `value` se sobrescribe siempre al abrir el modal, y el loop no engancha nada con la lista vacía. Tras aplicarlos, el único origen de las metas/tarifa es `DEFAULT_CONFIG` (`:466-470`) + `localStorage`.

### Opcional (Nivel 2, no requerido para el objetivo)
- Validar rango en `saveConfig` (p. ej. 0–168 h/semana).
- Decidir destino de los `*.js`/`shell.html`/`styles.css` legacy: borrar o documentar en README que `index.html` es el bundle vivo.

---

## Valores objetivo actuales (referencia)

| Categoría | Meta default | Fuente de verdad |
|---|---|---|
| Introspección | 2 h/semana | `index.html:468` `DEFAULT_CONFIG.weekly_targets` → editable en ⚙ → `localStorage['time_config']` |
| Proyecto | 8 h/semana | idem |
| Curso | 5 h/semana | idem |
| Tarifa sanción | 3.0 €/h | `index.html:467` `DEFAULT_CONFIG.sanction_rate_eur` |

> Coinciden con el backup del usuario (`data/backup-...2026-06-21.json:67-72`). El valor "vivo" proviene siempre de `localStorage`/`DEFAULT_CONFIG`.

INSPECTOR_DONE: tmp/config_report.md listo
