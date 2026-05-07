# Social media templates

Plantillas HTML para componer assets de redes sociales con la identidad de Innmobi.ai. Reutilizan el sistema editorial (Fraunces + JetBrains Mono + brass period).

## Plantillas

| Archivo | Tamaño | Uso |
|---|---|---|
| `instagram-post.html` | 1080×1080 | Posts de Instagram, Facebook, LinkedIn cuadrado |
| `instagram-story.html` | 1080×1920 | Stories de Instagram, reels covers |
| `x-post.html` | 1600×900 | X (Twitter), LinkedIn horizontal |

## Variables (slots)

- `{{ EYEBROW }}` — texto eyebrow (e.g. "INNMOBI · ANÁLISIS"), JetBrains Mono UPPERCASE
- `{{ HEADLINE }}` — titular principal, Fraunces 600 italic permitido con `<em>...</em>`
- `{{ PROOF }}` — línea de prueba/dato (instagram-post)
- `{{ CTA }}` — call to action (instagram-story)

## Cómo usar

1. Abre la plantilla en VS Code o cualquier editor.
2. Reemplaza los slots `{{ ... }}` con copy real.
3. Renderiza:
   - Manualmente: abre en navegador a 100% zoom, screenshot del viewport.
   - Con Playwright: añadir un script `scripts/render-social.mjs` siguiendo el patrón de `scripts/render-og-images.mjs`.

## Reglas de marca

- El period en "Innmobi.ai" debe estar en color `#A77E2B` (brass). Nunca cambiar.
- `<em>` solo en italic Fraunces, color forest `#1F3A2D` (sobre fondo claro) o brass-soft `#C9A661` (sobre fondo oscuro).
- No agregar emojis dentro del headline. Solo en metadata o CTA si es necesario.
- Mantener clear-space: nunca poner texto a menos de 80px del borde.
