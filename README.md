# Botschaften-Archiv — Inspirierte private Studieninitiative

> **Hinweis zur Transparenz:** Dies ist eine **unabhängige, private Studieninitiative** zur Erleichterung der Textarbeit, Reflexion und Erstellung von Zitatesammlungen für Andachten und Studienkreise. Diese Plattform ist **keine offizielle Website und keine Publikation des Universalen Hauses der Gerechtigkeit** oder anderer Bahá'í-Institutionen. Die offiziellen Texte und Verlautbarungen der weltweiten Bahá'í-Gemeinde finden sich unter [bahai.org](https://www.bahai.org) sowie [bahai.de](https://www.bahai.de).

Digitales Studien- und Recherchewerkzeug zur Erschließung der Botschaften des Universalen Hauses der Gerechtigkeit (1963–2026), thematischer Kompilationen und der Ruhi-Studienreihe.

Gestaltet im **Cosmos-Designsystem** ([cosmos.so](https://www.cosmos.so/)):
- Warmer Alabaster- & Papier-Canvas (`#F9F7F3`) und tiefer OLED-Obsidian-Modus (`#0C0C0B`)
- Schwebendes Kapsel-Navigations-Dock (`.cosmos-dock`) mit 28px Milchglas-Effekt
- Kinetische Typografie mit Blur-Reveal und rhythmisch gestaffeltem Karten-Entrance
- Exakte 2-Zeilen-Garantie für Kartentitel und zitatbasierte Textvorschauen
- Sanctuary Lightbox Leseraum mit strikter Zählung ab Absatz 1
- Studienbücher des Ruhi-Instituts in hochauflösender PDF-Ansicht
- Interaktives Kompilations-Studio für Andachten, Studienkreise und Tagungen

## Automatische Bereitstellung & Entwicklungs-Richtlinie

- **Hosting & CI/CD**: Dieses Repository ist ausschließlich mit [Vercel (bahaibibliothek.vercel.app)](https://bahaibibliothek.vercel.app/) verbunden.
- **Auto-Commit & Auto-Push Regel (Antigravity)**: Alle zukünftigen Anpassungen, Ergänzungen und Codeänderungen werden von Antigravity stets **automatisch selbst committet und auf `origin main` gepusht**, sodass die Live-Webseite jederzeit synchron und ohne manuellen Aufwand aktualisiert wird.

## Täglicher Botschaften-Sync (Automatischer Crawler)

Das Archiv überprüft **einmal täglich um 04:00 Uhr UTC** vollautomatisch über GitHub Actions die beiden offiziellen Quellen auf neue Botschaften:
1. **Bahá'í Reference Library** ([bahai.org/library](https://www.bahai.org/library/authoritative-texts/the-universal-house-of-justice/messages)) für englische Originaltexte.
2. **bibliothek.bahai.de** ([bibliothek.bahai.de](https://bibliothek.bahai.de/pubAuthor.php?authorCode=uhj)) für offizielle deutsche Übersetzungen.

- **Workflow-Datei**: [`.github/workflows/daily_sync.yml`](.github/workflows/daily_sync.yml)
- **Skript**: [`scripts/sync_messages.py`](scripts/sync_messages.py)
- **Ablauf**: Werden neue Botschaften gefunden, lädt der Bot den Volltext herunter, berechnet Exzerpte und Metadaten, trägt sie in `data/index.json` und `data/texts/` ein und pusht den neuen Stand auf `main`. Vercel aktualisiert daraufhin die Live-Seite automatisch.
- **Manueller Sofort-Start**: Kann jederzeit im GitHub Actions Tab per Klick auf *„Run workflow“* oder lokal via `npm run sync` ausgeführt werden.


