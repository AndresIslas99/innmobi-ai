# Screenshots

Capturas de la plataforma Inmobi.ai.

## Estado actual
Las imágenes en este directorio son **mockups del producto** generados desde los templates de carrusel — sirven como vista previa fiel mientras se capturan screenshots reales de la app corriendo.

Para reemplazar con capturas reales:

```bash
# 1. Levanta el CRM en un puerto libre (8080 está ocupado por coolify-proxy)
cd ../agnor-crm-dev
PORT=9090 python3 -m uvicorn agnor.presentation.web.app_v2:app --host 0.0.0.0 --port 9090 --reload

# 2. Desde este repo, corre el script de captura apuntando al puerto correcto
cd ../inmobi-ai
CRM_BASE_URL=http://localhost:9090 npm run capture:screenshots
```

El script `scripts/capture-screenshots.mjs` ya tiene definidas las 8 rutas a capturar y maneja el login automático con `admin / admin123`.

## Dimensiones
- Desktop: 1440×900 @2x (2880×1800 PNG)
- Mobile: 390×844 @2x (780×1688 PNG)
