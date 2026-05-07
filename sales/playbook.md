# Innmobi.ai — Sales Playbook

> Guía operativa para conversaciones comerciales. ICP, framework de calificación, top 10 objeciones, comparativas, scripts. Vivo: edita cuando aprendas algo nuevo en una llamada.

---

## ICP (Ideal Customer Profile)

**Innmobi.ai está optimizado para inmobiliarias que cumplen TODAS estas:**

1. Operan en **México** (CDMX, GDL, MTY, QRO, Mérida prioritarios; otras ciudades caso por caso).
2. **5 o más asesores activos**. Por debajo, el producto es over-engineering. Por arriba, justifica el costo.
3. Tienen pipeline activo: **mínimo 50 leads/mes** entrantes por canales múltiples.
4. **Multi-canal**: combinan al menos 3 de: llamada · WhatsApp · web · ML · referidos · presencial.
5. Tienen **al menos un coordinador o director comercial** dedicado (no solo asesores en piso).
6. Cierran **>30M MXN al año** (proxy de capacidad de pago al tier Growth).
7. Operan en **al menos uno de los 6 verticales**: remates, preventa, corretaje, recuperadas, reventa, rentas.

**Anti-patrones (NO ICP):**
- Asesor independiente solo (use otro CRM).
- Inmobiliaria solo de rentas administrativas (usar PMS especializado).
- Equipo 100% no-tech sin coordinación humana intermedia (curva alta sin Customer Success interno).
- Operación fuera de México (i18n no listo).

---

## Framework de calificación (BANT-mod)

Para cada conversación, calificar antes de avanzar a propuesta:

| Letra | Pregunta | Verde | Ámbar | Rojo |
|---|---|---|---|---|
| **B** Budget | ¿Qué pagas hoy en software de pipeline/CRM? | $20K+/mes total | $5-20K/mes | <$5K/mes |
| **A** Authority | ¿Quién decide la compra de software? | Tú o reportas directo a quien decide | Comité | "Tengo que consultar con socios" |
| **N** Need | ¿Qué problema te trajo a buscar CRM hoy? | Dolor concreto último mes | "Debería actualizar" | "Curiosidad" |
| **T** Timing | ¿Cuándo necesitas tener algo funcionando? | Próximas 4-8 semanas | 3-6 meses | "Sin prisa" |

**Verde-Verde-Verde-Verde:** propuesta inmediata, agenda demo técnica si CTO involucrado.
**Algún ámbar:** propuesta + nurture leve.
**Algún rojo:** mantener en boletín, no insistir.

---

## Top 10 objeciones y cómo responder

### № 01 — "Es muy caro."

**No respondas con descuento.** Respuesta:

> "Te entiendo. Pero antes de cerrar el tema del precio, ¿me dejas hacerte tres preguntas? (1) ¿Cuánto le pagas a tu coordinador para que haga reportes manuales en Excel? (2) ¿Qué porcentaje de tus leads se enfría sin contestación? (3) ¿Cuánto te costó el último asesor que renunció y se llevó sus WhatsApps? Si haces el cálculo de esos tres, el costo del CRM probablemente no es lo que estás midiendo."

### № 02 — "Ya tengo HubSpot."

> "HubSpot es un buen CRM genérico. Lo que vemos en MX es que requiere comprar 3-4 cosas adicionales (WhatsApp por Wati, ML por scraping, voz por Twilio) que terminan siendo caros y frágiles. ¿Cuánto te cuesta hoy todo el stack? ¿Y cómo se ve cuando algo se rompe — un solo proveedor o varios apuntando a otro?"

### № 03 — "Mis asesores no son técnicos."

> "Esa es la regla, no la excepción. La UI fue diseñada con asesores no-técnicos en piso de AGNOR. Curva de ~2 horas. Y el agente de voz reduce la dependencia de que el asesor capture cosas manualmente. ¿Quieres que te enseñe el caso de adopción específico — los 3 asesores más resistentes y cómo entraron?"

### № 04 — "¿Qué pasa si decido cambiarme?"

> "Tu data te la exportamos en CSV/JSON en cualquier momento desde el panel. Sin pedir permiso. Si firmas con nosotros y a los 6 meses decides cambiarte, te exportamos toda y borramos nuestros servidores en 30 días. Está en el contrato. ¿Me dejas mostrarte la cláusula?"

### № 05 — "Necesito ver el roadmap."

> "Con todo gusto. ¿Te late si te muestro las últimas 5 cosas que prometimos en roadmap y lanzamos? Eso vale más que un PDF futuro."

### № 06 — "¿Cumplen LFPDPPP?"

> "Sí. Aviso de privacidad por lead, ARCO atendible desde panel, sub-procesadores con DPA, encriptación AES-256, audit logs inmutables. Te puedo mandar la página /seguridad/ con todos los detalles que tu equipo legal va a pedir, y agendamos sesión técnica con tu CTO si quieres."

### № 07 — "Necesito SSO con Google Workspace."

> "Eso está en Scale tier. ¿Cuántos asesores tienen y cómo se ve el modelo de cuentas hoy? Si lo necesitas, lo metemos en el contrato."

### № 08 — "El director nuevo prefiere [otro CRM]."

Toma nota, no insistas en venta. Respuesta:

> "Entiendo, el director tiene que estar convencido. ¿Te parece si te mando el caso AGNOR y el checklist de evaluación para que él los lea cuando tenga 30 minutos? Si después tiene preguntas técnicas, agendamos. Sin presión."

### № 09 — "¿Por qué no Mercado Libre o EasyBroker?"

> "Mercado Libre es portal de captura, no CRM. EasyBroker es bueno para preventa, pero no resuelve coordinación de pipeline multi-canal en agencias con 5+ asesores. Si tu uso es solo publicar inventario, EasyBroker está bien. Si tu uso es coordinar al equipo de ventas, no escala. ¿Cuál es tu uso principal?"

### № 10 — "Mejor lo hablamos en 6 meses."

Acepta sin presionar. Respuesta:

> "Sin problema. ¿Te puedo mandar un correo de seguimiento dentro de 6 meses, en {{ FECHA }}, con un análisis específico de tu mercado para entonces? No quiero perder el contacto y tampoco quiero ser pesado."

Y registra en el CRM.

---

## Pricing conversation (cómo dar el número)

Una vez calificados B-A-N-T en verde, entra al cierre del precio:

```
Para tu caso específico:
- Inmobiliaria con {{ X }} asesores activos
- Volumen estimado de leads: {{ Y }}/mes
- Vertical principal: {{ Z }}
- Integraciones requeridas: WhatsApp + ML + Calendar

El plan que te recomendamos es {{ TIER }} con {{ X }} asesores.
Inversión: {{ MONTO }} MXN/mes (con descuento anual sería {{ MONTO_ANUAL }}).
Eso incluye: migración 4 semanas, hosting, todas las integraciones, soporte directo, sin lock-in.

¿Encaja con lo que tienes presupuestado para infraestructura?
```

**Reglas:**
- Da el número siempre antes de colgar la primera demo.
- Pricing válido por 14 días naturales.
- Descuento anual: máximo 20% en Starter, 25% en Growth.
- Setup fee: solo en Scale, justificable por scope.
- No discounts adicionales sin escalar a CEO.

---

## Competitive landscape (cómo nos comparamos)

| Competidor | Cuándo nos eligen vs ellos | Cuándo ellos ganan |
|---|---|---|
| **HubSpot Pro** | Necesitan WhatsApp/ML/voz nativos. Quieren un solo proveedor. | Equipo internacional con operaciones MX como minoría. |
| **Pipedrive** | Necesitan IA + integraciones MX específicas. | Equipo solo necesita pipeline visual sin más. |
| **EasyBroker** | Multi-vertical, coordinación de equipo, voz/WhatsApp. | Solo necesitan portal+publicación, equipo &lt;5 personas. |
| **Wasi** | Necesitan agente de voz + integración Mercado Libre nativa. | Buscan UX moderna pero sin necesidades de IA. |
| **Inmovilla** | Operación distribuida, multi-vertical mexicano. | Inmobiliarias chicas con flujos lineales. |

---

## Discovery questions (orden recomendado)

Pregunta SIEMPRE en este orden en la primera demo:

1. "Cuéntame de tu inmobiliaria — desde cuándo operan, qué venden, cuántos asesores."
2. "¿Qué te trajo a buscar CRM hoy? ¿Qué pasó concretamente?"
3. "¿Qué herramientas usan hoy para gestionar pipeline?"
4. "¿Cómo entran los leads? Por canal, ¿qué porcentaje aproximado?"
5. "¿Cuántos leads aproximadamente entran al mes?"
6. "¿Cómo se asignan los leads a los asesores?"
7. "¿Quién coordina el día a día y cómo lo hace?"
8. "¿Qué métrica te importa medir y no la estás midiendo bien hoy?"
9. "¿Tienes plazo o hay alguien presionando para que esto cambie?"
10. "Si todo saliera bien, ¿qué tiene que pasar en 90 días para que digas que valió la pena?"

Tomar notas estructuradas. Estas notas alimentan el resumen post-demo y el pricing personalizado.

---

## Reglas de oro

- **No descuentes en la primera llamada.** Si lo haces, pierdes anchor.
- **Pide pricing específico antes de colgar.** Nunca dejar abierto.
- **Mejor 5 conversaciones cualificadas que 50 superficiales.**
- **Cuando no encajamos, decirlo.** Mejor perder venta que cliente mal-fit.
- **El director comercial siempre hace seguimiento personal.** No SDRs el primer trimestre.
