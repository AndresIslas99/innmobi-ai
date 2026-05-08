# Editorial

Plan de contenido multi-canal (LinkedIn · Instagram · Facebook) y assets visuales.

## Estructura

```
editorial/
├── README.md                       (este archivo)
├── cadencia.md                     reglas operativas: cadencia, voz por canal, hashtags, time slots
├── calendario-2026-05.md           plan fechado mayo: día por día, copy listo, paths a assets
└── assets/
    ├── _shared.css                 variables de marca + frame chrome reutilizable
    ├── 2026-05-08-soft-launch.html       fuente HTML
    ├── 2026-05-08-soft-launch/
    │   ├── post-square.png         1080×1080  IG feed + FB
    │   └── post-story.png          1080×1920  IG story
    ├── 2026-05-12-lead-rot-60.html
    ├── 2026-05-12-lead-rot-60/post-square.png
    └── …                            una carpeta por fecha que necesita asset propio
```

Para días que reusan los carouseles existentes, los PNGs viven en `linkedin/carousel-NN-*/` (no en `editorial/assets/`).

## Para publicar

1. Abre `calendario-2026-05.md`. Cada día tiene canales, hora, copy y path al asset.
2. Para LinkedIn, el copy completo de los posts grandes vive en `linkedin/calendar-week-*.md` (el calendario te dice cuál archivo y sección).
3. Para Instagram y Facebook, el copy va en línea en el calendario.
4. Sube el PNG correspondiente, pega copy + hashtags, publica.

## Para crear un asset nuevo

1. Crea `editorial/assets/YYYY-MM-DD-nombre.html` siguiendo el patrón de cualquiera existente.
   - `<link rel="stylesheet" href="_shared.css"/>` para heredar variables y frame chrome
   - Cada `<section class="slide">` declara `data-w` y `data-h` (1080×1080 cuadrado, 1080×1920 story, 1600×900 horizontal)
   - Atributo `data-slide="nombre"` define el nombre del PNG de salida
   - Theme con clase: `bg-ink`, `bg-bone`, `bg-paper`, `bg-forest`
2. Corre `npm run build:editorial`. Genera PNGs retina-quality en `editorial/assets/<slug>/<slide-name>.png`.
3. Actualiza el calendario para apuntar al path nuevo.
4. Commit incluyendo HTML y PNGs renderizados.

## Reglas de marca al producir láminas

- Wordmark `Innmobi.ai` SIEMPRE con period en brass `#A77E2B` y SIEMPRE en sentence case (nunca `INNMOBI.AI`)
- Italic `<em>` en forest sobre fondo claro, en brass-soft sobre fondo oscuro
- Sin emojis decorativos en headlines (✓ funcionales en cuerpo OK)
- Cifras concretas (no "muchos", no "varios")
- 80-90px de padding mínimo en los bordes (clear-space)
- Fraunces para tipografía editorial; JetBrains Mono para metadata/eyebrow

Detalle completo en `BRAND.md` (raíz) y `brand-bible/brand-bible.html`.

## Cadencia de mantenimiento

- **Cada semana**: marcar publicaciones realizadas con ✅ en el calendario, anotar si algo se movió
- **Cada mes**: crear `calendario-2026-MM.md` siguiendo el mismo formato
- **Cada 60 días**: revisar `cadencia.md` y ajustar frecuencia según métricas (subir solo si engagement aguanta)
