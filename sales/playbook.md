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
6. Cierran **>30M MXN al año** (proxy de capacidad de pago de $4K/mes + implementación).
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
| **B** Budget | ¿Cuánto puedes invertir para arrancar y cada mes? | $20K de arranque + $4K/mes sin problema | La mensualidad sí, el arranque necesita plazos (escalones B-D) | Ni $4K/mes |
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

### № 11 — "¿Los $4,000 ya incluyen IVA?"

> "No, son $4,000 más IVA: $4,640 al mes. La factura sale con CFDI desde OrzaTech, así que el IVA lo acreditas."

### № 12 — "¿Y si se me acaban las 5 horas de llamadas?"

> "Cinco horas son unas 120 llamadas de calificación al mes. Si tu volumen es mayor, hay paquetes de +5 horas por $1,500 o +10 horas por $2,700 al mes. Cuéntame cuántas llamadas les entran y te digo de una vez si te alcanza." (Usa la recomendación de horas del cotizador.)

### № 13 — "¿Qué pasa si me llaman 3 personas al mismo tiempo?"

> "Tienes 2 líneas simultáneas incluidas. La tercera escucha un mensaje de espera y entra en cuanto se libera una. Si en tu operación es común que entren 3 o más a la vez, cada línea adicional cuesta $500 al mes."

### № 14 — "No quiero que una IA le conteste a mis clientes."

> "Lo entiendo. Hoy, ¿quién contesta a las 10 de la noche o en domingo? … El agente no reemplaza a tu asesor: contesta cuando nadie puede, hace las preguntas que tu mejor asesor haría y le deja el lead listo. ¿Por qué no lo pruebas tú? Llama ahorita a este número como si buscaras casa." (Número de demo.)

### № 15 — "¿Dónde están mis datos?"

> "En un servidor dedicado solo para tu inmobiliaria, no compartido con nadie, con respaldos diarios fuera de sitio. Cumplimos la ley de protección de datos (LFPDPPP) y, si un día te vas, te exportamos todo y lo borramos en 30 días."

### № 16 — "¿Me lo dejas sin implementación?"

> "La implementación no es un cargo de 'activación': son 4 semanas de trabajo nuestro migrando tu data, conectando tu WhatsApp, tu número y Mercado Libre, y capacitando a tu equipo. Sin eso, el sistema es una hoja en blanco. Lo que sí puedo hacer es ayudarte con el calendario de pago." (Escalones B-D.)

---

## Pricing conversation (cómo dar el número)

**Precio de lista** (es lo que se dice primero, siempre). Todos los precios son en MXN + IVA:

| Concepto | Precio |
|---|---|
| Plan Innmobi: usuarios ilimitados, 5 h de llamadas IA, 2 líneas, servidor dedicado, todas las funciones | $4,000 MXN/mes |
| Paquete de voz +5 h | $1,500 MXN |
| Paquete de voz +10 h | $2,700 MXN |
| Minuto de voz sin paquete | $6 MXN |
| Línea simultánea adicional | $500 MXN/mes |
| Pago anual | $40,000 MXN (12 meses por el precio de 10) |
| Implementación (migración + canales + onboarding 4 semanas) | $20,000 MXN pago único |
| Scale (25+ asesores o varias sucursales) | A la medida, escala al CEO |

Una vez calificados B-A-N-T en verde, entra al cierre del precio:

```
Para tu caso específico:
- Inmobiliaria con {{ X }} asesores activos
- Volumen estimado de leads: {{ Y }}/mes
- Vertical principal: {{ Z }}
- Integraciones requeridas: WhatsApp + ML + Calendar

Mensualidad: $4,000 MXN/mes. Todo tu equipo dentro (usuarios ilimitados), 5 horas de
llamadas con el agente de voz, 2 líneas simultáneas y tu propio servidor.{{ EXTRAS }}
Implementación: $20,000 MXN, una sola vez. En 4 semanas migramos tu data,
conectamos WhatsApp, Mercado Libre y Calendar, y capacitamos a tu equipo.

Sin cobro por usuario. Una sola comisión te paga más de dos años.
¿Arrancamos la implementación el lunes {{ FECHA }}?
```

**Reglas:**
- Da el número siempre antes de colgar la primera demo.
- Pricing válido por 14 días naturales.
- La mensualidad **no se negocia**. El único descuento es el anual (12 por 10).
- Los paquetes de voz y las líneas extra tampoco se descuentan. Si el cliente va a llamar mucho, véndele el paquete de +10 h desde el arranque.
- "Usuarios ilimitados" es literal: nunca cobres por usuario. Si un cliente crece tanto que su servidor no aguanta, escala al CEO (se cotiza el servidor más grande).
- Lo que sí se negocia es **cuándo** se paga la implementación (ver abajo), nunca cuánto.
- Nada fuera de esta guía sin escalar a CEO.

---

## Negociación de la implementación: "se mueve el calendario, no el precio"

La implementación **siempre vale $20,000 MXN**. Lo que tienes como vendedor es libertad para mover **cuándo** se paga, desde el contado hasta nuestro piso (peor escenario): $10,000 al firmar y $10,000 a 90 días. En todos los escalones el cliente paga lo mismo: $68,000 MXN el primer año ($48K de mensualidad + $20K de implementación). Lo único que cambia es nuestro flujo de caja.

| Escalón | Al firmar | Resto | Cuándo usarlo | Qué pides a cambio |
|---|---|---|---|---|
| **A · Lista** | $20,000 | — | Siempre se ofrece primero. | — |
| **B** | $15,000 | $5,000 al go-live (semana 4) | "Es mucho de golpe." | Kickoff en las próximas 2 semanas. |
| **C** | $10,000 | $10,000 al go-live (semana 4) | Sigue atorado en el arranque, pero la mensualidad no le preocupa. | Firma esta semana. |
| **D · Piso** | $10,000 | $10,000 a 90 días | Última carta. Buen fit, problema solo de flujo. | Contrato 12 meses + cargo domiciliado + caso de éxito o 1 referido. |

**Atajo:** si el cliente paga anual por adelantado ($40,000), puedes darle el escalón D directo: ya entró más caja que en el escalón A.

**Reglas duras:**
- Baja **un escalón a la vez** y pide algo a cambio en cada uno. Nunca abras con el piso.
- Antes de mover dinero, agrega valor: una sesión extra de capacitación o plantillas de WhatsApp pre-armadas para su vertical.
- Nunca menos de **$10,000 al firmar**. Nunca crédito a **más de 90 días**. Nunca descuento sobre los **$20,000 totales**.
- Con el escalón D, el contrato lleva **cláusula de aceleración**: si cancela antes de liquidar, el saldo se vuelve exigible de inmediato.
- No arranca la implementación sin el pago de firma en cuenta.
- Si la objeción es la mensualidad de $4,000 (no el arranque), no la resuelvas con la implementación: regresa a la objeción № 01 o probablemente no es ICP hoy.

**Cómo decirlo:**

> **B:** "El precio de la implementación es fijo, pero te ayudo con el flujo: $15 mil para arrancar y $5 mil cuando ya estés operando, en la semana 4. ¿Te funciona?"

> **C:** "Si lo partimos a la mitad, $10 mil hoy y $10 mil el día del cutover, ¿arrancamos el lunes?"

> **D:** "Te propongo algo, pero necesito que tú también me ayudes: $10 mil para arrancar y los otros $10 mil a 90 días, cuando ya hayas visto resultados. A cambio, contrato de 12 meses con cargo domiciliado y, si te va bien, nos dejas contar tu caso. ¿Trato?"

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
