#!/usr/bin/env bash
# Innmobi.ai — one-shot GitHub setup
# Crea el repo público en GitHub, hace push, y activa GitHub Pages apuntando a /docs.
# Prereq: estar autenticado con gh CLI (corre `gh auth login` primero si no lo has hecho).

set -euo pipefail
cd "$(dirname "$0")/.."

OWNER="${GH_OWNER:-AndresIslas99}"
REPO="${GH_REPO:-innmobi-ai}"
DESC="Innmobi.ai · CRM Inmobiliario con IA · marketing showcase"

echo "── Innmobi.ai · GitHub setup ──"
echo "Owner: $OWNER"
echo "Repo:  $REPO"
echo

# 1) Verificar gh auth
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh CLI no está autenticado. Corre primero:"
  echo "   gh auth login"
  exit 1
fi

# 2) Crear repo en GitHub si no existe
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "✓ Repo $OWNER/$REPO ya existe en GitHub — se actualiza el remote y push."
  git remote set-url origin "git@github.com:$OWNER/$REPO.git" 2>/dev/null || \
    git remote add origin "git@github.com:$OWNER/$REPO.git"
else
  echo "→ Creando repo público $OWNER/$REPO…"
  gh repo create "$OWNER/$REPO" --public --description "$DESC" --source . --remote origin
fi

# 3) Push
echo "→ Push a main…"
git push -u origin main

# 4) Activar GitHub Pages apuntando a /docs en main
echo "→ Activando GitHub Pages (branch=main, path=/docs)…"
gh api -X POST "/repos/$OWNER/$REPO/pages" \
  -f source[branch]=main \
  -f source[path]=/docs 2>/dev/null \
  || gh api -X PUT "/repos/$OWNER/$REPO/pages" \
       -f source[branch]=main \
       -f source[path]=/docs 2>/dev/null \
  || echo "⚠  Pages quizás ya estaba activado — revisa manualmente."

# 5) Output
echo
echo "✅ Listo."
echo "   Repo:  https://github.com/$OWNER/$REPO"
echo "   Pages: https://${OWNER,,}.github.io/$REPO/   (puede tardar 1-2 min en propagarse)"
echo "   Brochure: https://github.com/$OWNER/$REPO/blob/main/brochure/brochure.pdf"
