# Red DAIMAY · Gemelos digitales

Mapa 3D del sureste de Coahuila (Saltillo – Ramos Arizpe – Parras) con los gemelos digitales de las plantas DAIMAY, navegables desde una sola página:

| Planta | Fuente | Contenido |
|---|---|---|
| Planta 1 | DWG · Propuesta B (9-sep-26) | Moldeo por inyección, almacén y ensamble |
| Planta 4 | DWG · Rev 10 | IMM 1000–2850 t, headliner, termoformado, prensas y hornos |
| Planta 8 | DWG v3 (23-sep-26) | Líneas Honda (CR-V 34AA, Civic 37A), Estación 0 |
| Planta Parras | PDF vectorial (9.8.26) | 10 líneas de costura, corte, laminado, espuma y químicos |
| Planta 2 · Planta 6-7 | — | Marcadas en el mapa, sin gemelo (falta plano) |

Módulos del panel: **Plantas** (con fijación de ubicación por coordenadas de Google Maps), **Comparar**, **Portafolio OPEX**, **Tier 3 regional (SQDCP)** y **Flujos entre plantas**.

## Publicar en GitHub Pages (todo plano, sin carpetas)

1. En github.com: **+ → New repository** → nombre `red-daimay` → **Public** → **Create repository**.
2. Clic en **"uploading an existing file"** → **choose your files** → dentro de esta carpeta presiona **Ctrl + A** → **Abrir**. Son puros archivos, sin subcarpetas.
3. Espera a que carguen todos → **Commit changes**.
4. **Settings → Pages → Branch: `main` / `(root)` → Save**. En 1–2 min queda en `https://<usuario>.github.io/red-daimay/`.

**Para actualizar:** repite el paso 2 en el mismo repo; GitHub reemplaza los archivos con el mismo nombre.

> Ojo: el sitio publicado en GitHub Pages es público aunque el repositorio sea privado (salvo Enterprise).

## Probarlo en tu computadora

No funciona con doble clic (`file://`), porque la página carga los gemelos con `fetch`. Levanta un servidor local en esta carpeta:

```bash
python -m http.server 8000
# abre http://localhost:8000
```

Se necesita internet: Three.js se carga desde `cdn.jsdelivr.net`.

## Estructura

```
index.html            mapa regional + panel (el "hub")
map_*.jpg / .png      mapa base, relieve y detalle metropolitano
p1.html p4.html p8.html parras.html   cada gemelo (también se abre solo)
p1_*.jpg … parras_*.jpg               texturas de piso y minimapa de cada planta
```

## Dónde se guardan los datos

En esta versión **no hay servidor**: portafolio, Tier 3, flujos, ubicaciones fijadas y escenarios de cada gemelo se guardan en el `localStorage` **del navegador de cada persona**.

- La primera vez arranca con los datos de demostración (20 proyectos del portafolio y 2 flujos).
- Lo que captura una persona **no lo ven las demás**.
- Para mover los datos de una computadora a otra, usa **Exportar respaldo / Importar respaldo** en el panel (archivo `.json`).
- Los escenarios de cada gemelo (rutas, montacargas, cambios de layout) se guardan cuando el gemelo se abre **desde la Red**. Si abres `p1.html` (o cualquier gemelo) directamente, funciona igual pero sin guardar ("Solo en esta vista").
- **Restablecer demo** borra lo capturado y vuelve a los datos de demostración.

Para que todo el equipo comparta los mismos datos se necesita un backend. La capa de datos (`LocalDB` en `index.html`) imita la API de documentos y colecciones de Firestore (`doc`, `collection`, `get`, `set`, `update`, `delete`, `onSnapshot`, `where`, `orderBy`, `limit`), así que conectarla a Firebase o a un backend similar es un cambio acotado. La versión publicada en claude.ai sí comparte los datos entre usuarios.

## Créditos del mapa

Natural Earth (carreteras, vías férreas, límites, zonas urbanas, ríos) · INEGI (localidades y altitudes). El relieve está interpolado a partir de las altitudes de las localidades y exagerado ×2.4. Las ubicaciones de las plantas son **aproximadas** hasta que se fijen con coordenadas reales desde la pestaña Plantas.
