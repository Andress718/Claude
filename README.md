# Editor de Video (navegador)

Editor gráfico multipista que corre 100 % en el navegador. Sin instalar nada.

**Uso:** abre `editor/index.html` en **Chrome o Edge** (para la voz en off conviene servirlo:
`python3 -m http.server -d editor` y abrir `http://localhost:8000`).

## Qué incluye
**Video**
- Pista principal + capas superpuestas (video sobre video, imágenes, formas), con posición, escala, rotación, opacidad y modos de fusión.
- **Máscaras** (círculo, rectángulo, corazón, estrella…) con suavizado, inversión y animación; al invertir se ve lo que hay detrás.
- **Croma** para quitar fondos de color. Fondo desenfocado al cambiar de formato.
- **Efectos** (capa de efectos): zoom in/out, impacto, latido, desenfoque, destello, estroboscopio, sacudida, aberración RGB, glitch, viñeta, grano, fuga de luz, barras de cine.
- **Filtros/looks** (B/N, noir, cine teal-naranja, vintage, cyberpunk…) y **corrección de color** (exposición, contraste, saturación, tono, temperatura, matiz, sombras, luces, viñeta), por clip o como capa de ajuste.
- Transiciones, animaciones de entrada/salida y movimiento continuo.
- **Formas**: cuadrado, redondeado, círculo, triángulo, rombo, estrella, corazón, flecha, línea.

**Audio**: volumen (hasta 200 %), fundidos, silenciar, **extraer audio del video**, **voz en off** grabada sobre la línea de tiempo, importar música, forma de onda.

**Texto y subtítulos** estilo CapCut: 12 títulos animados y 12 estilos de subtítulos (Hormozi, karaoke, pop por palabra, caja resaltada, máquina de escribir…). Todo editable: tipografía (o sube la tuya), colores, contorno, fondo, resplandor, animación por texto/palabra/letra. Importar/exportar `.srt`.

**Transcripción automática (voz → subtítulos)**: Whisper corre en tu navegador (idiomas: español, inglés, portugués, francés, alemán, italiano, catalán o detección automática; modelos tiny/base/small). Genera subtítulos con tiempos, divididos en frases cortas y con el estilo CapCut que elijas. La primera vez necesita internet para descargar el motor y el modelo; después queda en caché.

**Formatos**: 16:9, 9:16, 1:1, 4:5, 2:3, 3:4, 4:3, 21:9 a 480p/720p/1080p.

**Exportación a MP4** (H.264) grabando en tiempo real, con el audio mezclado.

## Atajos
Espacio reproducir · S dividir · Supr eliminar · Ctrl+D duplicar · Ctrl+Z / Ctrl+Shift+Z deshacer/rehacer · rueda sobre la vista previa = escala.
