# Screenshots

Capturas reales del CRM Innmobi.ai corriendo con datos demo seeded.

> **TODO post-rebrand:** Las capturas actuales fueron tomadas cuando el CRM aún
> mostraba "Inmobi.ai" en su UI. Después de actualizar el repo del CRM
> (`../inmobi-ai/agnor-crm-dev`) para mostrar "Innmobi.ai" en navbar/títulos,
> hay que volver a correr `npm run capture:screenshots` y reemplazar los 9 PNGs.

## Inventario

| Archivo | Vista | Viewport |
|---|---|---|
| `01-dashboard.png` | Command Center con KPIs y leads que requieren atención | 1440×900 @2x |
| `02-leads-list.png` | Lista de prospectos con filtros y status badges | 1440×900 @2x |
| `03-pipeline-kanban.png` | Pipeline visual drag-and-drop por etapa | 1440×900 @2x |
| `04-lead-detail.png` | Detalle del lead con tabs (Citas, Notas, AI Insights) | 1440×900 @2x |
| `05-properties.png` | Catálogo de propiedades por vertical | 1440×900 @2x |
| `06-analytics.png` | Analytics con embudo de conversión | 1440×900 @2x |
| `07-calendar.png` | Calendario mensual de citas | 1440×900 @2x |
| `08-appointments.png` | Lista de citas agrupada por día | 1440×900 @2x |
| `09-mobile-dashboard.png` | Vista mobile del Command Center | 390×844 @2x |

## Cómo regenerar

```bash
# 1) Levanta el CRM dev en un puerto libre (8080 está ocupado por coolify-proxy)
cd ../agnor-crm-dev
nohup python3 -m uvicorn agnor.presentation.web.app_v2:app \
  --host 127.0.0.1 --port 9090 > /tmp/crm.log 2>&1 &

# 2) Si la DB está vacía, seedea con datos demo
python3 -m agnor.db.seeds --clean

# 3) (Opcional) parchea pipeline_stages para que el kanban tenga columnas
python3 -c "
import sqlite3, datetime, random
random.seed(42)
conn = sqlite3.connect('agnor.db'); c = conn.cursor()
now = datetime.datetime.now().isoformat()
stages = [
  ('Nuevo',1,10,0,0,0,'#7C7C82'), ('Calificado',2,25,0,0,0,'#A77E2B'),
  ('Cita agendada',3,50,0,0,0,'#2D5440'), ('Visita realizada',4,65,0,0,0,'#1F3A2D'),
  ('Oferta',5,80,0,0,0,'#16291F'), ('Cierre ganado',6,100,1,0,0,'#10B981'),
  ('Perdido',7,0,0,1,1,'#EF4444'),
]
for s in stages:
  c.execute('INSERT INTO pipeline_stages (name, sequence, probability, is_won, is_lost, fold, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', s + (now, now))
mapping = {'NEW':1,'CONTACTED':2,'APPOINTMENT_PENDING':3,'APPOINTMENT_CONFIRMED':3,'COMPLETED':6,'NOT_INTERESTED':7,'NO_ANSWER':2}
for status, sid in mapping.items():
  c.execute('UPDATE leads SET stage_id=? WHERE status=?', (sid, status))
conn.commit()
"

# 4) Captura desde el repo de marketing
cd ../innmobi-ai
CRM_BASE_URL=http://127.0.0.1:9090 npm run capture:screenshots
```

El script `scripts/capture-screenshots.mjs` hace login automático con `admin / admin123` y captura las 9 vistas en secuencia (8 desktop + 1 mobile).
