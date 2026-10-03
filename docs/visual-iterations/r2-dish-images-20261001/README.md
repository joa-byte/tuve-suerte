# Fotos por plato — 1 de octubre de 2026

Verificado sobre la aplicación real con Pages Functions, D1 y R2 emulados
por Wrangler, sin mocks de red. Se subió como PNG de prueba el dibujo ya
incluido en la app; no es una foto real de la cena.

- `photo-upload-mobile.png`: formulario de carga, 390 × 844.
- `dish-photo-mobile.png`: plato con imagen guardada y acción de reemplazo, 390 × 844.
- `dish-photo-360.png`: mismo detalle a 360 × 844, sin overflow horizontal.

Se comprobó subir, recargar, reemplazar, mostrar una sola imagen por plato y
serializar `imageUrl` desde D1, sin exponer `image_key` ni errores de JavaScript.
