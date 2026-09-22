# Iteraciones visuales

Las capturas usan un ancho de 390 px, equivalente al viewport móvil solicitado.
Se renderizaron con el CSS real de producción y fixtures estáticos del contenido
existente, porque el entorno no incluye un binario de Chromium disponible para
Playwright.

## 00 — Estado anterior

- Tarjetas redondeadas, sombras y navegación dentro de una cápsula.
- Tipografía genérica con fallback a Comic Sans.
- Gradientes CSS como simulación de papel.
- Vinos y platos presentados como componentes convencionales.

## 01 — Deconstrucción

- Se quitaron cápsulas, radios, paneles sólidos y sombras.
- La composición pasó a depender de líneas, sangría y posición.
- Pendientes detectados: tipografía demasiado digital, falta de textura y
  fotografías todavía excesivamente geométricas.

## 02 — Sistema manuscrito

- Se incorporaron las dos fuentes locales elegidas, papel, subrayados y marcos.
- Se construyó el árbol `categoría → varietal → etiqueta`.
- Pendientes detectados: encabezado estrecho en 360 px, acciones de vino anchas
  y formularios demasiado delimitados.

## 03 — Fidelidad final

- Se redujo y estabilizó el encabezado del detalle.
- Se afinó la densidad de platos y vinos para conservar lectura y áreas táctiles.
- Los formularios quedaron como hojas con líneas, sin tarjeta modal.
- La navegación perdió el contenedor redondeado y usa marcas dibujadas.
- Se verificaron variantes de inicio, detalle largo, calendario, catálogo,
  detalle de vino, creación, opinión y estado vacío.
