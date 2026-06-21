# Registro de Horas

App web de seguimiento de horas de trabajo. Funciona completamente en el navegador, sin instalación ni servidor.

## Requisitos

- Un navegador moderno (Chrome, Firefox, Edge, Safari — versiones de los últimos 2 años)
- Conexión a internet la primera vez (para cargar Chart.js desde CDN)

Sin Node.js. Sin npm. Sin backend. Sin base de datos.

## Cómo iniciarlo

```bash
# Opción 1 — abrir directamente
Doble clic en index.html

# Opción 2 — servidor local (evita restricciones de CORS en algunos navegadores)
# Con Python:
python -m http.server 8080
# Luego abre http://localhost:8080

# Con Node.js (si lo tienes):
npx serve .
# Luego abre la URL que indique la terminal
```

## Archivos

| Archivo | Descripción |
|---|---|
| `index.html` | App principal — abre este archivo |
| `styles.css` | Estilos |
| `data.js` | Gestión de datos y localStorage |
| `timer.js` | Lógica del temporizador |
| `history.js` | Vista de historial de registros |
| `export.js` | Exportación de datos |
| `summaries.js` | Resúmenes y estadísticas |
| `shell.html` | Vista auxiliar |
| `comandos.txt` | Comandos de desarrollo (tmux / Claude Code) |

## Datos

Los datos se guardan en el `localStorage` del navegador. No se envía nada a ningún servidor.

Para llevar los datos a otro ordenador usa la opción de exportar dentro de la app.
