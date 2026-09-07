#!/usr/bin/env python3
"""
build_intuitive_folder_structure.py
Baut die vollstaendige, intuitive Ordnerstruktur fuer alle Dokumente des Bahai-Botschaftenarchivs auf:
- Alle 1.059 Dokumente in 870 Werken gemaess den 4 Hauptsaeulen der Website
- Jedes Werk erhaelt einen individuellen Ordner
- In jedem Ordner befinden sich saemtliche verfuegbaren Formate (PDF, DOCX, EPUB, TXT)
- Zweisprachige Botschaften werden mit [DE] und [EN] praezise gekennzeichnet
- Erstellung von interaktiven Uebersichten in 00_Uebersichten (HTML, MD, CSV)
"""

import os
import sys
import re
import csv
import json
import shutil
import html
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
INDEX_PATH = DATA_DIR / "index.json"

TARGET_DIR = WORKSPACE_DIR / "Exportierte_Botschaften"
OVERVIEW_DIR = TARGET_DIR / "00_Übersichten"

def sanitize_name(name):
    name = re.sub(r'[/\\\:\*\?\"<>\|]', ' - ', name or '')
    name = re.sub(r'\s+', ' ', name).strip(' .-')
    return name[:110]

def resolve_source_file(p):
    if not p:
        return None
    p1 = BASE_DIR / p
    if p1.exists():
        return p1
    p2 = WORKSPACE_DIR / p
    if p2.exists():
        return p2
    return None

def get_work_info(glist):
    primary_de = next((d for d in glist if d.get('language') == 'deutsch'), None)
    primary_en = next((d for d in glist if d.get('language') == 'english'), None)
    primary = primary_de or primary_en or glist[0]

    tier = primary.get('tier', 'house')
    date = primary.get('date') or ''
    year = date[:4] if (date and len(date) >= 4) else (str(primary.get('year')) if primary.get('year') else '')
    author = primary.get('author') or ''
    recipient = primary.get('recipient') or ''
    title_de = primary_de.get('title') if primary_de else ''
    title_en = primary_en.get('title') if primary_en else ''
    base_title = sanitize_name(title_de or title_en or 'Dokument')

    # 1. Saeule: Botschaften des Hauses
    if tier == 'house':
        pillar = '01_Botschaften_des_Hauses'
        yr_folder = year if year else 'Undatiert'
        if date and re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            clean_t = re.sub(r'^\d{4}-\d{2}-\d{2}\s*[-–]?\s*', '', base_title)
            folder_name = f'{date} - {clean_t}'
        else:
            folder_name = base_title
        category = f'Jahr {yr_folder}'
        rel_dir = f'{pillar}/{yr_folder}/{folder_name}'

    # 2. Saeule: Botschaften an oder ueber Institutionen
    elif tier == 'institutions':
        pillar = '02_Botschaften_an_oder_über_Institutionen'
        if recipient in ['counsellors', 'itc'] or 'berater' in base_title.lower() or 'counsellor' in base_title.lower():
            subcat = '01_Kontinentale_Berater_und_ITC'
            category = 'Kontinentale Berater & ITC'
        elif recipient == 'nsa':
            yr_folder = year if year else 'Allgemein'
            subcat = f'02_Nationale_Geistige_Räte/{yr_folder}'
            category = f'Nationale Geistige Räte ({yr_folder})'
        elif recipient == 'world' or 'welt' in base_title.lower():
            subcat = '03_Internationale_Gemeinschaft_und_Konferenzen'
            category = 'Internationale Gemeinschaft'
        elif recipient == 'youth' or 'jugend' in base_title.lower() or 'pionier' in base_title.lower():
            subcat = '04_Jugend_und_Pioniere'
            category = 'Jugend & Pioniere'
        elif recipient == 'iran' or 'iran' in base_title.lower():
            subcat = '05_Gemeinde_im_Iran'
            category = 'Gemeinde im Iran'
        else:
            subcat = '06_Weitere_Institutionen'
            category = 'Weitere Institutionen'

        if date and re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            clean_t = re.sub(r'^\d{4}-\d{2}-\d{2}\s*[-–]?\s*', '', base_title)
            folder_name = f'{date} - {clean_t}'
        else:
            folder_name = base_title
        rel_dir = f'{pillar}/{subcat}/{folder_name}'

    # 3. Saeule: Kompilationen des Hauses
    elif tier == 'compilations':
        pillar = '03_Kompilationen_des_Hauses'
        category = 'Thematische Kompilationen'
        folder_name = base_title
        rel_dir = f'{pillar}/{folder_name}'

    # 4. Saeule: Heilige Schriften & Buecher
    elif tier == 'books':
        pillar = '04_Heilige_Schriften_und_Bücher'
        auth_lower = author.lower()
        if 'abdul' in auth_lower or '‘abdu' in auth_lower or 'abdu' in auth_lower:
            auth_dir = '03_Abdul-Baha'
            category = "Schriften ‘Abdu’l-Bahás"
        elif 'báb' in auth_lower or 'bab' in auth_lower:
            auth_dir = '02_Der_Bab'
            category = 'Schriften des Báb'
        elif 'bahaullah' in auth_lower or 'bahá’u’lláh' in auth_lower or 'bahá' in auth_lower or 'baha' in auth_lower:
            auth_dir = '01_Bahaullah'
            category = "Schriften Bahá'u'lláhs"
        elif 'shoghi' in auth_lower:
            auth_dir = '04_Shoghi_Effendi'
            category = 'Werke Shoghi Effendis'
        elif 'haus' in auth_lower or 'justice' in auth_lower:
            auth_dir = '05_Universales_Haus_der_Gerechtigkeit_Werke'
            category = 'Bände des Universalen Hauses'
        else:
            auth_dir = '06_Weitere_Schriften'
            category = 'Weitere Schriften'
        folder_name = base_title
        rel_dir = f'{pillar}/{auth_dir}/{folder_name}'

    # 5. Saeule: Ruhi-Institut
    elif tier == 'ruhi':
        pillar = '05_Ruhi_Institut'
        if 'zweig' in base_title.lower() or 'branch' in base_title.lower():
            subcat = '02_Zweigkurse'
            category = 'Ruhi Zweigkurse'
        else:
            subcat = '01_Hauptkursfolge'
            category = 'Ruhi Hauptkursfolge'
        folder_name = base_title
        rel_dir = f'{pillar}/{subcat}/{folder_name}'

    # 6. Studienmaterialien
    else:
        pillar = '06_Studienmaterialien'
        category = 'Studienmaterialien'
        folder_name = base_title
        rel_dir = f'{pillar}/{folder_name}'

    return {
        'pillar': pillar,
        'category': category,
        'folder_name': folder_name,
        'rel_dir': rel_dir,
        'title_de': title_de,
        'title_en': title_en,
        'primary': primary
    }

def main():
    print("Starte den Aufbau der intuitiven Ordnerstruktur...")

    with open(INDEX_PATH, 'r', encoding='utf-8') as f:
        docs = json.load(f)

    # Nach groupId buendeln
    groups = defaultdict(list)
    for d in docs:
        groups[d['groupId']].append(d)

    print(f"Gesamtbestand: {len(docs)} Dokumente in {len(groups)} Werken.")

    # Zielordner vorbereiten
    if not TARGET_DIR.exists():
        TARGET_DIR.mkdir(parents=True, exist_ok=True)

    # 00_Uebersichten Ordner vorbereiten
    OVERVIEW_DIR.mkdir(parents=True, exist_ok=True)

    copied_files_count = 0
    work_catalog = []

    for idx, (gk, glist) in enumerate(groups.items()):
        info = get_work_info(glist)
        work_dir = TARGET_DIR / info['rel_dir']
        work_dir.mkdir(parents=True, exist_ok=True)

        is_bilingual = len(glist) > 1 and any(d.get('language') == 'deutsch' for d in glist) and any(d.get('language') == 'english' for d in glist)

        available_formats = set()
        file_entries = []

        for d in glist:
            lang = (d.get('language') or 'deutsch').lower()
            lang_tag = 'DE' if lang == 'deutsch' else 'EN'
            raw_title = sanitize_name(d.get('title') or 'Dokument')

            # Formate kopieren
            for fmt in ['pdf', 'docx', 'epub', 'txt']:
                src_rel = (d.get('formatFiles') or {}).get(fmt)
                if not src_rel:
                    continue
                src_path = resolve_source_file(src_rel)
                if not src_path or not src_path.exists():
                    continue

                available_formats.add(fmt)

                # Dateiname im Werkordner
                if is_bilingual:
                    dest_filename = f"[{lang_tag}] {raw_title}.{fmt}"
                else:
                    dest_filename = f"{raw_title}.{fmt}"

                dest_path = work_dir / dest_filename

                # Schnelles Kopieren (oder hardlink)
                try:
                    if not dest_path.exists() or dest_path.stat().st_size != src_path.stat().st_size:
                        shutil.copy2(src_path, dest_path)
                    copied_files_count += 1
                    file_entries.append({
                        'fmt': fmt,
                        'lang': lang_tag,
                        'filename': dest_filename,
                        'rel_file_path': str(dest_path.relative_to(TARGET_DIR))
                    })
                except Exception as e:
                    print(f"Fehler beim Kopieren von {src_path} nach {dest_path}: {e}")

        # Katalog-Eintrag fuer die Uebersichten
        work_catalog.append({
            'pillar': info['pillar'].split('_', 1)[1].replace('_', ' '),
            'category': info['category'],
            'title': info['title_de'] or info['title_en'] or info['folder_name'],
            'title_en': info['title_en'] if is_bilingual else '',
            'is_bilingual': is_bilingual,
            'formats': sorted(list(available_formats)),
            'rel_dir': info['rel_dir'],
            'files': file_entries
        })

        if (idx + 1) % 150 == 0 or idx + 1 == len(groups):
            print(f"  Fortschritt: {idx + 1}/{len(groups)} Werke verarbeitet ({copied_files_count} Dateien abgelegt)...")

    print(f"Erfolgreich {copied_files_count} Dateien in {len(groups)} individuellen Werkordnern platziert.")

    # 4. Navigations-Uebersichten generieren
    print("Erstelle Navigations-Uebersichten in 00_Übersichten/...")

    # CSV-Verzeichnis
    csv_path = OVERVIEW_DIR / "00_INHALTSVERZEICHNIS.csv"
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Hauptsäule', 'Kategorie', 'Werk-Titel', 'Englischer Titel', 'Zweisprachig', 'Verfügbare Formate', 'Relativer Ordnerpfad'])
        for item in work_catalog:
            writer.writerow([
                item['pillar'],
                item['category'],
                item['title'],
                item['title_en'],
                'Ja' if item['is_bilingual'] else 'Nein',
                ', '.join(item['formats']).upper(),
                item['rel_dir']
            ])
    print(f"  CSV-Index generiert: {csv_path}")

    # Markdown-Verzeichnis
    md_path = OVERVIEW_DIR / "00_INHALTSVERZEICHNIS.md"
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write("# Gesamt-Inhaltsverzeichnis des Bahá'í-Botschaften-Archivs\n\n")
        f.write("Dieses Verzeichnis bietet eine vollständige, strukturierte Übersicht aller **870 Werke** und **1.059 Dokumente** im Archiv.\n")
        f.write("Jedes Werk befindet sich in einem eigenen Ordner mit allen zugehörigen Dateiformaten (PDF, DOCX, EPUB, TXT).\n\n")

        # Nach Saeule gruppieren
        by_pillar = defaultdict(list)
        for item in work_catalog:
            by_pillar[item['pillar']].append(item)

        for pillar_name, items in sorted(by_pillar.items()):
            f.write(f"## {pillar_name} ({len(items)} Werke)\n\n")
            f.write("| Werk / Titel | Kategorie / Zeitraum | Sprachen | Formate | Ordner-Link |\n")
            f.write("| :--- | :--- | :--- | :--- | :--- |\n")
            for it in items:
                t = it['title']
                if it['title_en']:
                    t += f"<br>*{it['title_en']}*"
                langs = "DE · EN" if it['is_bilingual'] else "DE"
                fmts = ' '.join(f"`{fmt.upper()}`" for fmt in it['formats'])
                f.write(f"| {t} | {it['category']} | {langs} | {fmts} | [{it['rel_dir'].split('/')[-1]}](../{it['rel_dir']}) |\n")
            f.write("\n---\n\n")
    print(f"  Markdown-Index generiert: {md_path}")

    # Interaktive HTML-Uebersicht
    html_path = OVERVIEW_DIR / "00_GESAMTVERZEICHNIS.html"
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write("""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bahá'í-Botschaften-Archiv — Gesamtverzeichnis aller Werke</title>
    <style>
        :root {
            --font-serif: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --accent-gold: #C5A059;
            --accent-burgundy: #7A1E3A;
            --text-primary: #1A1A1A;
            --text-muted: #6B7280;
            --bg-page: #FDFBF7;
            --bg-card: #FFFFFF;
            --border-color: #E5E0D8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--font-sans);
            background: var(--bg-page);
            color: var(--text-primary);
            line-height: 1.5;
            padding: 2.5rem 1.5rem;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            margin-bottom: 2.5rem;
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 2rem;
        }
        h1 {
            font-family: var(--font-serif);
            font-size: 2.4rem;
            color: var(--accent-burgundy);
            margin-bottom: 0.5rem;
            letter-spacing: -0.01em;
        }
        .subhead {
            font-size: 1.1rem;
            color: var(--text-muted);
            max-width: 750px;
            margin: 0 auto;
        }
        .search-box {
            display: flex;
            gap: 1rem;
            margin: 2rem 0;
            background: var(--bg-card);
            padding: 1rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        .search-box input {
            flex: 1;
            padding: 0.75rem 1rem;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            font-size: 1rem;
            font-family: inherit;
        }
        .search-box input:focus {
            outline: none;
            border-color: var(--accent-gold);
        }
        .stats-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            font-size: 0.95rem;
            color: var(--text-muted);
        }
        .table-wrap {
            background: var(--bg-card);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0,0,0,0.04);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 0.95rem;
        }
        th {
            background: #F7F5F0;
            padding: 1rem;
            font-weight: 600;
            color: var(--text-muted);
            border-bottom: 1px solid var(--border-color);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
        }
        td {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
            vertical-align: middle;
        }
        tr:hover {
            background: #FAF8F4;
        }
        .title-de {
            font-family: var(--font-serif);
            font-size: 1.05rem;
            font-weight: 600;
            color: var(--text-primary);
        }
        .title-en {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-top: 0.15rem;
        }
        .badge-pillar {
            display: inline-block;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            background: #F0EAE1;
            color: #5A4A3A;
        }
        .badge-bilingual {
            display: inline-block;
            font-size: 0.7rem;
            font-weight: 700;
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
            background: #FDF4E3;
            color: #9A6A15;
            border: 1px solid #E6D0A7;
            margin-left: 0.5rem;
        }
        .file-links {
            display: flex;
            gap: 0.4rem;
            flex-wrap: wrap;
        }
        .file-btn {
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            text-decoration: none;
            color: var(--accent-burgundy);
            background: #FDF2F4;
            border: 1px solid #F5D3D9;
            transition: all 0.15s ease;
        }
        .file-btn:hover {
            background: var(--accent-burgundy);
            color: #FFFFFF;
        }
        .folder-link {
            font-size: 0.85rem;
            color: var(--accent-gold);
            text-decoration: none;
            font-weight: 600;
        }
        .folder-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Gesamtverzeichnis aller Werke</h1>
            <p class="subhead">Vollständiger, offline-verfügbarer Katalog des Bahá'í-Botschaften-Archivs mit direktem Dateizugriff auf alle 870 Werke und 1.059 Dokumente in allen Formaten (PDF, DOCX, EPUB, TXT).</p>
        </header>

        <div class="search-box">
            <input type="text" id="filter-input" placeholder="Titel, Säule, Kategorie oder Jahr durchsuchen..." onkeyup="filterTable()">
        </div>

        <div class="stats-bar">
            <span id="results-count">870 Werke angezeigt</span>
            <span>Jedes Werk im eigenen Ordner</span>
        </div>

        <div class="table-wrap">
            <table id="works-table">
                <thead>
                    <tr>
                        <th style="width: 20%;">Hauptsäule</th>
                        <th style="width: 45%;">Werk / Titel</th>
                        <th style="width: 20%;">Kategorie</th>
                        <th style="width: 15%;">Dateien &amp; Formate</th>
                    </tr>
                </thead>
                <tbody>
""")
        for it in work_catalog:
            bilingual_html = '<span class="badge-bilingual">DE · EN</span>' if it['is_bilingual'] else ''
            sub_title_html = f'<div class="title-en">{html.escape(it["title_en"])}</div>' if it['title_en'] else ''

            file_links_html = ''
            for fe in it['files']:
                file_links_html += f'<a class="file-btn" href="../{html.escape(fe["rel_file_path"])}" title="{html.escape(fe["filename"])}">{fe["lang"]}-{fe["fmt"].upper()}</a> '

            f.write(f"""                    <tr data-search="{html.escape((it['pillar'] + ' ' + it['category'] + ' ' + it['title'] + ' ' + it['title_en']).lower())}">
                        <td><span class="badge-pillar">{html.escape(it['pillar'])}</span></td>
                        <td>
                            <div class="title-de"><a class="folder-link" href="../{html.escape(it['rel_dir'])}/" title="Ordner öffnen">{html.escape(it['title'])}</a>{bilingual_html}</div>
                            {sub_title_html}
                        </td>
                        <td><span style="font-size:0.85rem; color:var(--text-muted);">{html.escape(it['category'])}</span></td>
                        <td><div class="file-links">{file_links_html}</div></td>
                    </tr>
""")
        f.write("""                </tbody>
            </table>
        </div>
    </div>

    <script>
        function filterTable() {
            const query = document.getElementById('filter-input').value.toLowerCase().trim();
            const rows = document.querySelectorAll('#works-table tbody tr');
            let visibleCount = 0;

            rows.forEach(row => {
                const searchData = row.getAttribute('data-search');
                if (!query || searchData.includes(query)) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });

            document.getElementById('results-count').textContent = `${visibleCount} von ${rows.length} Werken angezeigt`;
        }
    </script>
</body>
</html>
""")
    print(f"  Interaktiver HTML-Katalog generiert: {html_path}")
    print("\nBau der intuitiven Ordnerstruktur erfolgreich abgeschlossen.")

if __name__ == '__main__':
    main()
