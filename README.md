# Red DAIMAY · gemelos digitales (versión HTML)

Sitio estático: no necesita servidor ni instalación. Se publica tal cual en GitHub Pages.

## Qué hay aquí

| Ruta | Contenido |
|---|---|
| `index.html` | Red DAIMAY: mapa regional, Centro de Mejora Continua, VSM de red, portafolio, Tier 3, flujos, Recorrido Rivian y Sala de Guerra |
| `p1.html` `p2.html` `p4.html` `p67.html` `p8.html` `parras.html` | Gemelo de cada planta (la red los carga al entrar; también abren solos) |
| `rivian/` | Sala de Guerra, Kanban 3D, simulación de pistola y Spacer vs CAD |
| `vsm/` | Consola VSM de Planta 4 y sus 48 fotos de piso |
| `datos/base.js` | Datos oficiales: portafolio, 5S, VSM, flujos, ubicaciones, escenarios de cada planta, notas y tableros |
| `datos/base_respaldo.json` | Los mismos datos en formato de respaldo (se puede importar desde el sitio) |
| `usuarios.js` | Quién puede entrar |
| `acceso.js` | Pantalla de acceso |
| `vendor/` | three.js (0.160 para la red y los gemelos, r128 para las simulaciones Rivian) |

## Publicar en GitHub Pages

1. Crea el repositorio y sube todo el contenido de esta carpeta a la raíz (incluye el archivo `.nojekyll`).
2. En el repositorio: Settings → Pages → Source: "Deploy from a branch" → rama `main`, carpeta `/ (root)`.
3. Abre la dirección que te da GitHub. La primera vez el sitio pide crear al administrador y descarga `usuarios.js`: súbelo al repositorio reemplazando el que está.

Nota: GitHub Pages sobre un repositorio privado requiere un plan de pago de GitHub, y la página publicada queda accesible por su dirección aunque el repositorio sea privado.

## Usuarios

- Entra como administrador → botón con tu nombre (arriba a la derecha) → **Usuarios**.
- Agrega número de empleado, nombre, rol y contraseña inicial → **Descargar usuarios.js** → súbelo al repositorio.
- Para cambiar una contraseña, agrega de nuevo el mismo número de empleado con la contraseña nueva.
- Roles: **Administrador** (todo, más el panel de usuarios), **Usuario** (edita y captura en su navegador), **Solo lectura** (no ve el editor ni los formularios de edición del VSM y nada de lo que haga se guarda).
- Las contraseñas no se guardan en claro (PBKDF2-SHA256 con sal).
- Es un candado de uso interno: quien tenga los archivos del repositorio puede leer el contenido sin pasar por él.

## Datos: qué es oficial y qué es local

- Lo que captura cada persona (Tier 3, proyectos, 5S, escenarios, rutas) se guarda **solo en su navegador**. Nadie puede cambiar lo que ven los demás desde el sitio.
- La versión oficial es `datos/base.js`. Solo cambia cuando alguien con permiso de escritura en el repositorio sube un archivo nuevo.
- Para publicar tus capturas como oficiales: pestaña con el aviso de versión estática → **Exportar respaldo** → ese archivo se convierte en `datos/base.js`.
- **Restablecer datos oficiales** borra lo capturado en ese navegador y vuelve a `datos/base.js`.

## Probar en tu computadora

Abrir `index.html` con doble clic no funciona (el navegador bloquea la carga de los gemelos desde `file://`). Con Python instalado: `python -m http.server 8000` dentro de la carpeta y abre `http://localhost:8000`.

## Diferencias contra el artifact de claude.ai

- La captura ya no es compartida en vivo; es por navegador (ver arriba).
- En la Consola VSM no se pueden subir fotos nuevas desde el sitio; las 48 existentes sí se ven.
- Las tipografías se piden a Google Fonts; sin internet se usa la del sistema.

## Fase 2 (10-nov-2026)

- **Editor de layout en las 6 plantas.** P1, P2, P6-7, P8 y Parras ahora traen el mismo editor que P4: catálogo, colocar, mover, girar, duplicar, eliminar, medida libre, Piso, 5S, Cambios y deshacer. Cada planta conserva su propio modelo, recorrido y pestañas.
- **Consola VSM: fondo blanco u oscuro.** Botón "Fondo blanco / Fondo oscuro" junto a "Pausar". La elección se recuerda en el navegador.
- **Consola VSM: editar cajas.** Clic en una caja → "Editar esta caja" (nombre, detalle, planta, columna, fila, descripción, alerta) o "Agregar caja nueva al mapa" (con de dónde viene y hacia dónde va). "Restaurar original" deshace la edición; las cajas agregadas se pueden eliminar. Se guarda en `vx/r2/cfg/edit_<flujo>` y viaja en el respaldo.
- Se agregaron a los datos oficiales las 41 capturas de la Consola VSM (C/T, operadores, WIP por caja) que faltaban en la entrega de la Fase 1.

## Fase 3 (10-nov-2026) · capa de vida

Archivo nuevo y compartido por los 6 gemelos: `motor/vida.js`. La interfaz no cambia; solo aparece el control **Animación: No · Zona · Alta** junto a Calidad (vista de ingeniería).

- **Operadores articulados** cerca de donde miras (40 en Zona, 90 en Alta): mueven brazos al trabajar, giran a tomar material y dan pasos cortos. Los que están lejos siguen como figuras fijas. Los sentados solo mueven brazos.
- **Montacargas:** el mástil sube y baja en cada parada y la tarima se toma o se deja.
- **Inyectoras (P1 y P4):** el robot cartesiano baja al molde, saca la pieza y la deja en la banda.
- **Prensas (P4):** la platina baja, sostiene y sube.
- Si el equipo no mantiene la fluidez, la animación se reduce sola. Al abrir el Editor se apaga para que puedas seleccionar y mover operadores.
- Es dibujo, no simulación: los ciclos y movimientos son ilustrativos y no cambian tiempos, rutas ni datos.
