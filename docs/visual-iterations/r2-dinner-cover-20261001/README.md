# Foto de cena y portada — 1 de octubre de 2026

Prueba sobre la app real, con Pages Functions, D1 y R2 locales. Se usó como
imagen de prueba el dibujo incluido en la app, exportado a PNG, no una foto real.

- `dinner-cover-mobile.png`: foto propia y acción de reemplazo, 390 × 844.
- `dinner-cover-360.png`: mismo detalle, 360 × 844.
- `home-cover-mobile.png`: misma foto de cena en el inicio, 390 × 844.
- `dinner-photo-form.png`: formulario de carga de la cena, 390 × 844.

Verificado: sin imágenes aparece el dibujo; al subir al tercer plato y luego
al segundo, la portada cambia al segundo por orden de creación. Al subir al
primero, toma el primero. Inicio y detalle coinciden. La foto propia de cena
tiene prioridad sobre todos ellos, persiste al recargar y puede reemplazarse
sin cambiar fotos de platos. Sin errores JS ni overflow a 390 y 360 px.
