# Brochure

Brochure imprimible de 2 páginas (A4) para Innmobi.ai.

## Archivos
- `brochure.html` — fuente editable (HTML + CSS, fonts via Google)
- `brochure.pdf` — generado (regenerar con script)

## Regenerar el PDF

```bash
# Desde la raíz del repo
node scripts/render-brochure.mjs
```

## Imprimir manualmente desde Chrome
1. Abrir `brochure.html` en Chrome
2. Cmd/Ctrl + P
3. **Margins**: None
4. **Background graphics**: ON
5. **Paper size**: A4
6. Save as PDF
