#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Bahá'í-Botschaften-Archiv: Lokaler automatischer Synchronisations-Runner
# Synchronisiert GitHub Actions Commits und führt lokale Web-Überprüfung durch.
# Kopiert alle neuen Botschaften & Dokumente direkt in den OneDrive-Ordner.
# ═══════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$REPO_DIR/.." && pwd)"
DEPLOY_DIR="$HOME/Desktop/bahai_botschaften_netlify_deploy"

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Starte lokalen Botschaften-Sync ==="

cd "$REPO_DIR"

# 1. Neueste Änderungen von GitHub holen (inkl. Cloud-Sync von GitHub Actions)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "⬇️  Prüfe auf Cloud-Aktualisierungen von origin/main..."
    git pull --rebase origin main 2>/dev/null || echo "⚠️  Git pull konnte nicht ausgeführt werden (offline oder temporär nicht erreichbar)."
fi

# 2. Synchronisationsskript ausführen (prüft bibliothek.bahai.de & bahai.org)
echo "🔍 Führe Web-Überprüfung durch..."
python3 "$REPO_DIR/scripts/sync_messages.py"

# 3. Dokumente abgleichen: von botschaftenarchiv/documents -> OneDrive workspace/documents
if [ -d "$REPO_DIR/documents" ] && [ "$REPO_DIR/documents" != "$WORKSPACE_DIR/documents" ]; then
    echo "📁 Synchronisiere Dokumente in den OneDrive-Ordner..."
    rsync -av --update "$REPO_DIR/documents/" "$WORKSPACE_DIR/documents/"
fi

# 4. Optional: Deployment-Ordner auf dem Schreibtisch aktualisieren
if [ -d "$DEPLOY_DIR/documents" ]; then
    rsync -av --update "$REPO_DIR/documents/" "$DEPLOY_DIR/documents/"
    cp -f "$REPO_DIR/data/index.json" "$DEPLOY_DIR/data/index.json" 2>/dev/null || true
fi

# 5. Falls lokal neue Dateien erzeugt wurden, committen und pushen
if [ -n "$(git status --porcelain data/ documents/)" ]; then
    echo "✨ Neue Botschaften gefunden! Committe und pushe..."
    git add data/ documents/
    git commit -m "chore(sync): automatische Synchronisierung neuer Botschaften in den Ordner [skip ci]"
    git push origin main
    echo "🚀 Änderungen erfolgreich auf GitHub gepusht."
else
    echo "✅ Alle Ordner und das Repository sind auf dem neuesten Stand."
fi

echo "=== Synchronisation abgeschlossen ==="
