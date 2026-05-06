#!/usr/bin/env bash
# Inmobi.ai — render everything in one shot
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── Inmobi.ai · render-all ──"
echo

if [ ! -d node_modules ]; then
  echo "→ Installing deps (first run)…"
  npm install
  npx playwright install chromium
fi

echo "→ Rendering carousels"
node scripts/render-carousels.mjs
echo

echo "→ Rendering brochure"
node scripts/render-brochure.mjs
echo

echo "→ Capturing CRM screenshots (requires CRM dev server on :8080)"
echo "  Skip with: SKIP_SCREENSHOTS=1 bash scripts/render-all.sh"
if [ "${SKIP_SCREENSHOTS:-0}" != "1" ]; then
  node scripts/capture-screenshots.mjs || echo "⚠  Screenshots skipped (CRM unreachable)"
fi
echo

echo "✅ All assets ready."
