# Innmobi.ai — Social Profiles Cheatsheet

Guía operativa para configurar perfiles oficiales en Instagram, Facebook, LinkedIn (personal + company) y X. Los assets están listos en `images/social/`. La copy de cada bio está abajo, lista para pegar.

---

## Inventario de assets en `images/social/`

| Archivo | Tamaño | Uso |
|---|---|---|
| `profile-brass-1024.png` | 1024×1024 | **PRINCIPAL.** Foto de perfil para todas las plataformas (Insta/FB/LinkedIn/X). Brass + monograma "I" serif. |
| `profile-ink-1024.png` | 1024×1024 | Variante. Fondo negro con monograma brass. Úsalo si quieres look más sobrio. |
| `profile-bone-1024.png` | 1024×1024 | Variante. Fondo bone con monograma negro. Úsalo en plataformas con backgrounds oscuros (algunos themes de Slack/Discord). |
| `profile-brass-400.png` | 400×400 | Mismo que principal, optimizado para X (su uploader prefiere 400px). |
| `cover-facebook-light.png` | 1640×856 | Cover de la página de Facebook (variante luz, default). |
| `cover-facebook-dark.png` | 1640×856 | Misma cover, fondo ink-black. |
| `cover-linkedin-personal-light.png` | 1584×396 | Banner de **perfil personal** del founder en LinkedIn. |
| `cover-linkedin-personal-dark.png` | 1584×396 | Variante dark del banner personal. |
| `cover-linkedin-company-light.png` | 1128×191 | Banner de **página de empresa** Innmobi.ai en LinkedIn. |
| `cover-linkedin-company-dark.png` | 1128×191 | Variante dark de la página de empresa. |
| `cover-x-light.png` | 1500×500 | Header de X (Twitter) — variante luz. |
| `cover-x-dark.png` | 1500×500 | Header de X — variante dark (recomendado, X usa tema oscuro por default). |
| `ig-highlight-producto.png` | 1080×1080 | Cover circular de un highlight de Instagram, etiqueta "Producto". |
| `ig-highlight-casos.png` | 1080×1080 | Cover de highlight "Casos". |
| `ig-highlight-equipo.png` | 1080×1080 | Cover de highlight "Equipo". |
| `ig-highlight-recursos.png` | 1080×1080 | Cover de highlight "Recursos". |

Para regenerar: `npm run build:social-profiles` (después de editar `scripts/render-social-profiles.mjs`).

---

## Plataforma por plataforma

### 1) Instagram (`@innmobi.ai`)

**Profile photo:** `profile-brass-1024.png`
**Tamaño que ves:** se renderiza en círculo a ~110px en mobile · 150px en escritorio. Sube siempre el 1024 fuente — Insta lo escala.

**Username sugerido:** `@innmobi.ai`
**Display name:** `Innmobi.ai`
**Categoría:** Software / Software de empresa / Tecnología

**Bio (limit 150 chars):**
```
El sistema operativo para inmobiliarias mexicanas que cierran de verdad.
CRM con IA · WhatsApp · Mercado Libre. CDMX 🇲🇽
```
*(132 chars — cabe sin recortar)*

**Link en bio:** `https://innmobi.ai`

**Highlights iniciales (4 sugeridas):**
1. **Producto** → cover `ig-highlight-producto.png` · stories de capturas del CRM
2. **Casos** → cover `ig-highlight-casos.png` · testimonios de AGNOR
3. **Equipo** → cover `ig-highlight-equipo.png` · detrás de cámaras
4. **Recursos** → cover `ig-highlight-recursos.png` · linkbacks a `/recursos/`

**Story templates:** ya tienes `templates/social/instagram-story.html` y `instagram-post.html` para componer contenido editorial.

---

### 2) Facebook Page (`facebook.com/innmobi.ai`)

**Profile photo:** `profile-brass-1024.png` (FB lo recorta a círculo, 170×170 displayed)
**Cover photo:** `cover-facebook-light.png` (Subir el 1640×856; FB lo renderiza 851×315 en escritorio y 640×360 en mobile — el área central segura es ~851×315 con padding alrededor)
**Page name:** `Innmobi.ai`
**Username/URL:** `facebook.com/innmobi.ai`
**Categoría:** Servicio empresarial / Empresa de software / Bienes raíces

**Sobre nosotros corto (255 chars max):**
```
CRM Inmobiliario con IA construido en piso vendiendo remates en CDMX. Pipeline visual, WhatsApp Business nativo, sync con Mercado Libre. Hoy en producción 100% en AGNOR Inmobiliaria.
```
*(186 chars)*

**Sobre nosotros largo (descripción extendida):**
```
Innmobi.ai es el sistema operativo CRM para inmobiliarias mexicanas. Diseñado desde cero para los flujos reales del corredor en México: remates bancarios, preventa, corretaje, recuperadas, reventa y rentas.

Lo que nos hace distintos:
→ Inteligencia que no se cansa: agente Claude + Retell contesta tu número 24/7 y entrega leads pre-calificados.
→ Una sola fuente de verdad: cinco canales en un timeline cronológico por prospecto.
→ Hecho con asesores en CDMX: no diseñado en Notion, construido en piso de AGNOR Inmobiliaria.

Producto de OrzaTech S.A.P.I. de C.V. · CDMX 🇲🇽
Reservar demo: https://innmobi.ai/demo/
```

**Datos de contacto:**
- Sitio: `https://innmobi.ai`
- Email: `hola@innmobi.ai`
- WhatsApp: `+52 56 2059 5320`
- Dirección: Ciudad de México, México

**Botón de acción:** `Reservar` → enlace a `https://innmobi.ai/demo/`

---

### 3) LinkedIn — Página de empresa (`linkedin.com/company/innmobi-ai`)

**Logo (cuadrado, displayed circular):** `profile-brass-1024.png`
**Banner:** `cover-linkedin-company-light.png` (1128×191)
**Nombre:** `Innmobi.ai`
**LinkedIn URL:** `linkedin.com/company/innmobi-ai`
**Industria:** Software Development / Desarrollo de software
**Tamaño:** 2-10 employees
**Tipo:** Privately held
**Año fundación:** 2025
**Especialidades (skills/keywords):**
```
CRM, Real Estate Software, PropTech, AI, WhatsApp Business API, Mercado Libre Integration, Mexico, Inmobiliaria, Pipeline Management, LFPDPPP Compliant
```

**Tagline (corto, 120 chars):**
```
El sistema operativo CRM para inmobiliarias mexicanas que cierran de verdad. IA + WhatsApp + Mercado Libre. CDMX.
```
*(118 chars)*

**Descripción/About (2,000 chars max):**
```
Innmobi.ai es el sistema operativo CRM para inmobiliarias mexicanas que cierran de verdad.

Construido desde cero para los flujos del corredor inmobiliario en México: remates bancarios, preventa, corretaje, recuperadas, reventa y rentas. Cada feature pasó por las manos de los asesores de AGNOR Inmobiliaria — nuestro cliente fundador, hoy operando 100% sobre la plataforma con 15+ asesores activos diariamente en CDMX.

Tres pilares:
→ INTELIGENCIA QUE NO SE CANSA. Agente de voz Claude + Retell contesta tu número público 24/7 y entrega leads pre-calificados al asesor humano por WhatsApp, antes de que cuelgue el teléfono.
→ UNA SOLA FUENTE DE VERDAD. Llamadas, WhatsApp, web, citas y notas en un timeline cronológico por prospecto. Cero pestañas, cero "se me pasó".
→ HECHO CON ASESORES EN CDMX. No diseñado en Notion. Construido durante seis meses en piso vendiendo remates bancarios. Cuando lo instalas, no estás financiando experimentos — usas algo que ya gana dinero.

Stack: FastAPI · Python 3.12 · React 18 · PostgreSQL 16 · Anthropic Claude · Retell · Meta WhatsApp Cloud · Google Calendar · Mercado Libre Inmuebles API. Cumplimiento LFPDPPP.

Aceptamos 2-3 nuevas implementaciones por trimestre. Si tu inmobiliaria tiene 5+ asesores activos en MX, hablemos.

Reservar demo: https://innmobi.ai/demo
Caso AGNOR: https://innmobi.ai/casos-de-exito/agnor

Un producto de OrzaTech S.A.P.I. de C.V. · Ciudad de México 🇲🇽
```

**Sitio web:** `https://innmobi.ai`
**Sede:** Ciudad de México, México

---

### 4) LinkedIn — Perfil personal del founder

**Foto de perfil:** retrato real del founder (no el monograma — el monograma se usa para la página de empresa). Si aún no tienes headshot pro, usa una foto en alta calidad con fondo neutro.
**Banner del perfil:** `cover-linkedin-personal-light.png` (1584×396)
**Headline (220 chars max):**
```
Founder @ Innmobi.ai · Construyendo el sistema operativo CRM para inmobiliarias mexicanas. Producto de OrzaTech. Antes en sistemas críticos.
```
*(140 chars)*

**Sobre mí (About) — 2,000 chars:**
```
Founder de Innmobi.ai — el sistema operativo CRM para inmobiliarias mexicanas.

Llevo 8+ años construyendo software para industrias tradicionales mexicanas. Después de pasar tiempo con AGNOR Inmobiliaria en CDMX vendiendo remates bancarios, identificamos que el CRM correcto para una inmobiliaria mexicana no es uno con más features — es uno con menos fricción en los cinco momentos donde se gana o se pierde un cierre:

1. Cuando entra el lead (la velocidad importa más que el copy)
2. Cuando se califica (la estructura importa más que la puntuación)
3. Cuando se coordina la cita
4. Cuando se da seguimiento
5. Cuando se cierra (la documentación auditable evita disputas)

Construimos Innmobi.ai durante seis meses en piso, con asesores reales como co-diseñadores. Hoy AGNOR opera 100% sobre la plataforma — 15+ asesores, 6 verticales, 24/7 con agente de voz Claude.

Si gestionas una inmobiliaria mexicana con 5+ asesores y operas en Excel + WhatsApp + Hubspot Free, escríbeme. Aceptamos 2-3 nuevas implementaciones por trimestre.

📧 hola@innmobi.ai · 📲 +52 56 2059 5320 · 🌐 innmobi.ai
```

---

### 5) X / Twitter (`@innmobiai`)

**Profile photo:** `profile-brass-1024.png` o `profile-brass-400.png` (X recomienda 400px)
**Header:** `cover-x-dark.png` (recomendado, X tiene UI dark default) o `cover-x-light.png`
**Display name:** `Innmobi.ai`
**Handle/@:** `@innmobiai`
**Ubicación:** Ciudad de México, México
**Sitio web:** `https://innmobi.ai`

**Bio (160 chars max):**
```
Sistema operativo CRM para inmobiliarias mexicanas que cierran de verdad. IA + WhatsApp + Mercado Libre. Hoy 100% en AGNOR · CDMX 🇲🇽
```
*(146 chars)*

**Pinned tweet sugerido (lanzamiento):**
```
Hoy lanzamos innmobi.ai.

CRM construido en piso, vendiendo remates en CDMX. Tres pilares:

→ Inteligencia que no se cansa
→ Una sola fuente de verdad
→ Hecho con asesores en CDMX

15 asesores activos. 6 verticales. 100% en producción en AGNOR Inmobiliaria.

innmobi.ai
```

---

## Reglas universales de upload

1. **Sube siempre el archivo más grande disponible.** Las plataformas escalan abajo, nunca arriba. Subir un 400×400 cuando puedes subir 1024×1024 te deja con avatar pixelado en escritorio.
2. **Profile photos siempre cuadradas.** Las plataformas las recortan en círculo automáticamente. El centro debe estar ocupado por el monograma — no pongas elementos críticos en las esquinas.
3. **Banners: cuidado con safe zones.** Los banners se recortan distinto en mobile vs desktop. Para evitar problemas, mantén el contenido importante en el 60% central de la imagen.
4. **Después de subir cualquier asset, prueba en mobile real.** Lo que se ve bien en escritorio puede romper en celular.
5. **Foto de perfil del founder en LinkedIn ≠ logo del producto.** En personal, foto real. En company page, logo/monograma.

---

## Verificación post-upload

Lista para marcar después de configurar cada perfil:

- [ ] Instagram (`@innmobi.ai`) — profile + bio + 4 highlights
- [ ] Facebook Page (`facebook.com/innmobi.ai`) — profile + cover + about + botón demo
- [ ] LinkedIn Company (`linkedin.com/company/innmobi-ai`) — logo + banner + tagline + about + skills
- [ ] LinkedIn Personal del founder — banner + headline + about
- [ ] X (`@innmobiai`) — profile + header + bio + pinned tweet de lanzamiento

Cuando termines los 5, escribe a `marca@innmobi.ai` con los URLs de cada perfil para que actualicemos los links del footer del sitio (`src/partials/footer.html`).

---

## Cuándo regenerar los assets

Si cambian:
- La paleta de colores en `BRAND.md`
- El tagline oficial
- La razón social o ubicación
- Decides agregar plataformas nuevas (TikTok, Threads, Mastodon, etc.)

Edita `scripts/render-social-profiles.mjs`, ajusta los templates HTML embedded, y corre `node scripts/render-social-profiles.mjs`. Los PNGs se sobrescriben en `images/social/`.
