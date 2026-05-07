# Innmobi.ai — Brand System

> El sistema visual y verbal de Innmobi.ai. Disciplina editorial, paleta industrial, voz mexicana específica. La regla básica: nos parecemos más a Sotheby's o Monocle que a Linear o Vercel.

---

## Naming

- **Producto**: Innmobi.ai
- **Pronunciación**: "innmobi punto ei-ai"
- **Tagline**: El sistema operativo para inmobiliarias que cierran de verdad.
- **Subhead**: Tu pipeline merece más que una hoja de Excel.
- **Origin story**: No nació en un garage. Nació en piso, vendiendo remates en CDMX.
- **Made by**: OrzaTech

---

## Paleta — Industrial Premium

Heredada del lenguaje histórico del real estate de lujo. Forest + bone + brass, en proporciones editoriales.

### Tinta y papel
| Token | Hex | Uso |
|---|---|---|
| `--ink-black` | `#0F0F10` | Hero h1 |
| `--ink-900` | `#1F1F22` | h2, body fuerte |
| `--ink-700` | `#4A4A52` | Body |
| `--ink-500` | `#7C7C82` | Captions, metadata |
| `--ink-300` | `#A8A6A0` | Placeholders |
| `--ink-200` | `#D4D2CB` | Reglas, bordes |
| `--bone` | `#F2EFE9` | Fondo principal |
| `--bone-deep` | `#E8E3D7` | Secciones alternas |
| `--paper` | `#FEFCF7` | Cards y surfaces |

### Acentos
| Token | Hex | Uso |
|---|---|---|
| `--forest` | `#1F3A2D` | Acento primario, links, CTAs, datos clave |
| `--forest-deep` | `#16291F` | Hover, pressed |
| `--forest-soft` | `#2D5440` | Highlights claros |
| `--brass` | `#A77E2B` | Énfasis raro: case quotes, awards, period del wordmark |
| `--brass-soft` | `#C9A661` | Secundario brass |
| `--terracota` | `#9A4521` | Análogo de alert/danger; uso muy raro |

### Reglas de uso
- **Default canvas**: `--bone`. NO `--paper` (muy blanco) ni `--ink-black` (sólo dark sections puntuales).
- **Forest** es el único acento de acción (botones, links). NUNCA usar para decoración.
- **Brass** es ceremonial: títulos de caso de estudio, comillas, period del logo, awards. Si lo usas en más del 5% de la superficie, lo arruinaste.
- **Terracota** sólo para errores y alertas. No es decorativo.
- **Sin gradientes**. Sin glows. Sin glassmorphism. Sin blur. Si necesitas drama, úsalo con peso tipográfico, no con efectos.

---

## Tipografía — Editorial luxe

| Rol | Familia | Peso | Tracking | Optical size |
|---|---|---|---|---|
| H1 hero (88-120px) | Fraunces | 600 | -0.028em | 144 |
| H2 sección (52-72px) | Fraunces | 600 | -0.022em | 72 |
| H3 cards (22-28px) | Inter | 700 | -0.012em | — |
| Body (16-22px) | Inter | 400-500 | 0 | — |
| Eyebrow / labels | JetBrains Mono | 500 | 0.18em UPPERCASE | — |
| Cifras grandes | Fraunces tabular | 500 | -0.02em | 24 |

### Font loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"/>
```

### Reglas
- **Fraunces** vive en titulares. Si la usas en body, perdiste.
- **Inter** vive en body. Si la usas en hero, perdiste.
- **JetBrains Mono** vive en eyebrows, datos numéricos, metadata.
- Optical size importa: en H1 muy grande usar `font-variation-settings: 'opsz' 144;`. En H3 chico, `'opsz' 24`. Fraunces se ve genérica si no se ajusta.
- Numerales tabulares en cifras (`font-variant-numeric: tabular-nums lining-nums;`).

---

## Logo — Wordmark first

### Hierarchy
1. **Primary surface** (todo marketing): wordmark "Innmobi.ai" en Fraunces 600, color `--ink-black`, period en `--brass`.
2. **App icon / favicon**: mark mínimo — rectángulo `--brass` sobre `--bone` con trazo negativo formando "I". Sólo donde el wordmark no cabe.
3. **Email signature / contextos minúsculos**: wordmark a 14px sin period coloreado.

### Reglas
- Clear-space mínimo: 1× la altura de la mayúscula equivalente de la "I", todos los lados.
- Tamaño mínimo wordmark: 96px de ancho. Más chico → usar logomark.
- NO modificar tracking, peso, ni el color del period.
- NO componer el wordmark sobre fotografías o gradientes — sólo sobre `--bone` o `--ink-black`.

### Referencias mentales
Hermès. Bloomberg. Monocle. FT. Kinfolk. Sotheby's. Cada una vive 90% en wordmark.

---

## Texturas y motivos

### Lo que usamos
1. **Reglas editoriales** — líneas horizontales 1px en `--ink-200` o `--brass` que dividen secciones. Comunica seriedad editorial.
2. **Section markers numéricos** — eyebrow tipo `01 — INTELIGENCIA` en mono uppercase. Referencia drawing notes arquitectónicas.
3. **Topografía sutil** (opcional) — líneas de elevación al 2-4% opacidad en hero. Evoca terreno sin caer en mapa de México folklórico.
4. **Property line / cadastral** — rectángulos delineados sin relleno en feature icons. Real-estate-native.
5. **Fotografía B&W de alto contraste** — sólo en hero y dividers de sección. Material, no decorativa.

### Lo que NO usamos
Gradientes de fondo. Glows radiales. Grid patterns. Glassmorphism. Blur. Gradient meshes. Bokeh. Cualquier "AI generated aesthetic".

---

## Voz

### Master positioning
> El sistema operativo para inmobiliarias que cierran de verdad.

### Origin story
> No nació en un garage. Nació en piso, vendiendo remates en CDMX.

### Tres pilares
1. **Inteligencia que no se cansa** — promete cobertura, no IA
2. **Una sola fuente de verdad** — promete claridad, no integraciones
3. **Hecho con asesores en CDMX** — provenance, no geografía

### Reglas
- Prohibido: "automatización", "innovación", "disruption", "synergy", "best-in-class", "powered by AI", "next-gen", "revolutionize"
- Cifras concretas > superlativos. "15 asesores" no "decenas". "60%" no "muchos".
- "Tu equipo" no "your team", no "users", no "los usuarios".
- Una idea por párrafo. Punto.
- Cadencia editorial: corta. Punto. Después una frase larga que se gana el derecho a serlo con un dato específico.

### Antes / Después

| Antes (v1) | Después (v2) |
|---|---|
| "Automatiza tu pipeline" | "El tiempo de tu equipo, de regreso." |
| "CRM con IA" | "Inteligencia que no se cansa" |
| "Sistema next-gen para real estate" | "El sistema operativo para inmobiliarias que cierran de verdad" |
| "Probado en producción" | "No nació en un garage. Nació en piso." |

---

## Make by

Innmobi.ai es producto de **OrzaTech**, México.
Contacto: aibravo@orzatech.com · WhatsApp +52 56 2059 5320
