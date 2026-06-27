# Log de cambios — Programador

## Archivos modificados
- `index.html` (único archivo tocado)

## Cambio 1 — Quitar `value="3"` redundante del input de tarifa (línea 421)

**Qué se hizo:** Se eliminó el atributo `value="3"` hardcodeado del input `#config-penalty-rate`.

**Por qué es seguro:** `openConfigModal()` siempre fija `rateEl.value = config.sanction_rate_eur` al abrir el modal, por lo que el valor estático nunca se lee en runtime. El input no es visible hasta que el modal se abre, momento en que el valor real lo sobrescribe.

**Antes:**
```html
<input type="number" id="config-penalty-rate" class="input" min="0" step="0.5" value="3" />
```

**Después:**
```html
<input type="number" id="config-penalty-rate" class="input" min="0" step="0.5" />
```

## Cambio 2 — Eliminar loop muerto de listeners `.btn-remove-category` (antes ~líneas 1491-1495)

**Qué se hizo:** Se eliminó el bloque dentro de `DOMContentLoaded` con el comentario `// Remove category buttons` que ejecutaba `document.querySelectorAll('.btn-remove-category').forEach(...)` y su closure completo.

**Por qué es seguro:** Al cargar la página, `#config-goals-list` está vacío (las filas se generan dinámicamente en `openConfigModal()`), por lo que `querySelectorAll('.btn-remove-category')` no encuentra ningún elemento y el loop no adjunta nada. Además, `buildGoalRow()` ya añade su propio listener de eliminación a cada botón al crear cada fila, por lo que este loop era completamente redundante.

**Antes:**
```js
    // Remove category buttons
    document.querySelectorAll('.btn-remove-category').forEach(function(btn){
      var row=btn.closest('.config-goal-row');
      if(row)btn.addEventListener('click',function(){removeCategoryRow(row,row.getAttribute('data-category'));});
    });

    // Add category
```

**Después:**
```js
    // Add category
```

## Qué NO se tocó y por qué
- **JavaScript de lógica** (`openConfigModal`, `saveConfig`, `buildGoalRow`, `removeCategoryRow`, etc.): fuera del alcance; solo se eliminó código muerto.
- **`DEFAULT_CONFIG`**: no era parte del informe de Inspector.
- **Archivos `*.js` legacy**: explícitamente excluidos.
- **Resto de `index.html`**: el objetivo principal (horas objetivo configurables en ⚙) ya estaba cumplido en la ejecución anterior.

## Estado final
Ambos cambios aplicados con la herramienta Edit y verificados leyendo las líneas afectadas:
- Línea 421: input sin `value="3"`. ✅
- Líneas ~1489-1491: el bloque del loop muerto fue eliminado; tras el listener de `modalConfig` sigue directamente `// Add category`. ✅

Sin cambios funcionales. Ambas modificaciones son limpieza de bajo riesgo.

PROGRAMADOR_DONE
