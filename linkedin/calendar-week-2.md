# LinkedIn — Calendario Semana 2 · Innmobi.ai

> **Foco:** profundidad técnica + integración WhatsApp + autoridad temática.

---

## Lunes — Stack técnico (carousel-02)

**Hora:** 10:00 CDMX
**Formato:** carousel-02 stack (8 slides) + post intro
**CTA:** ver demo

```
Esta semana abrimos la cocina.

Cómo se construye un CRM inmobiliario que no se rompe a las 3 AM cuando el agente de voz Claude está respondiendo una llamada y el coordinador está consultando analytics desde su celular.

8 láminas sobre la arquitectura real de Innmobi.ai. Sin fluff, sin "powered by". Solo decisiones técnicas y por qué las tomamos.

→ Domain-Driven Design con Unit of Work
→ PostgreSQL real desde día 1 (no SQLite mocks que mienten)
→ Webhooks fail-closed
→ Blue/green deploy con rollback automático

Para directores que quieren saber qué hay debajo, y para CTOs que ya van a hacer due diligence.

#PropTech #SoftwareArchitecture #DDD #Postgres
```

**Asset:** `linkedin/carousel-02-stack/slide-*.png`

---

## Martes — WhatsApp Business API guide

**Hora:** 09:30 CDMX
**Formato:** post con bullets + link al artículo
**CTA:** leer guía técnica

```
Lo que ningún proveedor te dice sobre WhatsApp Business API:

→ Tu número debe quedar en TU Meta Business Manager, no en el del proveedor (lock-in escondido).
→ El alta con Meta toma 10 días reales, no "1 día instantáneo".
→ Categorías de plantillas (utility/marketing/auth) están auditadas por humanos. Las pones mal y te suspenden.
→ Tier 1 te limita a 250 destinos únicos al día. Tier 3 (10k/día) se desbloquea con buen historial.
→ Cuando Meta te suspende, son 5-30 días de espera para reactivación.

Guía completa con todo lo que aprendimos integrando WhatsApp en producción para AGNOR (10 min de lectura):

→ innmobi.ai/recursos/whatsapp-business-api-pipeline

#WhatsAppAPI #PropTech #VentasInmobiliarias
```

---

## Miércoles — Pricing transparency post

**Hora:** 11:00 CDMX
**Formato:** post conversacional
**CTA:** ver tres tiers

```
Hoy publicamos pricing público de Innmobi.ai.

¿Por qué? Porque los CRMs que esconden precios "pídenos cotización para tu caso" generan ansiedad, no confianza.

Tres tiers visibles:
→ Starter desde $2,400 MXN/asesor/mes (5+ asesores)
→ Growth desde $3,800 MXN/asesor/mes (15+ asesores)
→ Scale a la medida (25+ asesores, multi-tenancy, SSO, API)

Lo único variable es el ajuste fino dentro del tier — y eso lo cerramos en 30 minutos contigo, no en 3 semanas con un equipo de procurement.

Lo que sí o sí está incluido en todos: migración 4 semanas, hosting, backups, updates continuos, cumplimiento LFPDPPP, sin lock-in.

→ innmobi.ai/precios

#PropTech #Pricing #SaaS #Inmobiliarias
```

---

## Jueves — Mercado Libre integration

**Hora:** 13:00 CDMX
**Formato:** post + link blog comparativa
**CTA:** leer comparativa

```
Pregunta directa: ¿tu CRM tiene "integración con Mercado Libre Inmuebles"?

¿Es vía API oficial o vía scraping?

Si es scraping (login automatizado, simulación de navegación humana): tu cuenta ML está en riesgo de baneo. Cuando ML cambia su HTML, la integración se rompe sin aviso. Y técnicamente es contra los TOS.

Si es API oficial (OAuth + endpoints documentados): cumplimiento, estabilidad, tu cuenta segura.

Cómo distinguir a qué te están metiendo:
→ Pregunta: "¿usan la API oficial de Mercado Libre Inmuebles?"
→ Pide ver una publicación nueva en demo, en vivo.
→ Verifica que tu cuenta ML quede a TU nombre, no del proveedor.

Comparativa completa (9 min): nativa vs scraping vs publicación manual.

→ innmobi.ai/recursos/mercado-libre-inmuebles-integracion

#MercadoLibre #PropTech #Inmobiliarias
```

---

## Viernes — Long-form Friday: caso AGNOR

**Hora:** 14:00 CDMX
**Formato:** post de texto introduciendo el long-form
**CTA:** leer 18-min caso

```
Para terminar la semana: el long-form completo del caso AGNOR.

18 minutos de lectura. Lo que pasó en los seis meses de construcción del producto en piso de la inmobiliaria. Métricas reales, decisiones técnicas, y los tres errores que cometimos en el camino (y cómo los corregimos).

Cosas que están en el long-form y no en la versión ejecutiva:
→ Por qué el plan inicial fracasó (intentar todo a la vez)
→ Cómo forzamos adopción real con asesores no-técnicos
→ Las 3 categorías de errores que cometimos con WhatsApp/voz/cutover
→ Qué aplicamos en las siguientes implementaciones

→ innmobi.ai/recursos/caso-agnor-remates-bancarios-cdmx

#CasoDeÉxito #PropTech #Inmobiliarias #LearnFromMistakes
```

---

## Métricas semana 2

- Profile visits (objetivo: +30% vs semana 1)
- DMs cualificados (objetivo: 5+ desde directores de inmobiliaria)
- Clicks a /demo desde LinkedIn (objetivo: 8+)
- Demo bookings asignables a LinkedIn (objetivo: 2+)
