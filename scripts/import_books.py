#!/usr/bin/env python3
"""
import_books.py
Automatischer Importer aller autorisierten Bücher und Schriften aus:
1. Bahá'í Reference Library (bahai.org) - Offizielle englische Bücher & PDFs
2. bibliothek.bahai.de - Autorisierte deutsche Bücher & Schriften

Legt alle Bücher strukturiert in OneDrive unter documents/Buecher/<Autor>/ ab,
extrahiert Volltexte nach data/texts/ und indexiert alles in data/index.json.
"""

import os
import sys
import re
import json
import time
import hashlib
import urllib.request
import urllib.error
import http.cookiejar
from html import unescape
from pathlib import Path
from datetime import datetime

# Pfade
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent
DATA_DIR = REPO_DIR / "data"
INDEX_FILE = DATA_DIR / "index.json"
TEXTS_DIR = DATA_DIR / "texts"
REPO_DOCS_DIR = REPO_DIR / "documents" / "Buecher"
WORKSPACE_DOCS_DIR = REPO_DIR.parent / "documents" / "Buecher"
NETLIFY_DOCS_DIR = Path.home() / "Desktop/bahai_botschaften_netlify_deploy/documents/Buecher"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

AUTHOR_INFO = {
    "bahaullah": {
        "name": "Bahá'u'lláh",
        "code": "bahaullah",
        "folder": "Bahaullah",
        "subTierName": "Schriften Bahá'u'lláhs",
        "role": "Offenbarer",
        "period": "1817–1892"
    },
    "the-bab": {
        "name": "Der Báb",
        "code": "the-bab",
        "folder": "Der_Bab",
        "subTierName": "Schriften des Báb",
        "role": "Herold & Vorläufer",
        "period": "1819–1850"
    },
    "abdul-baha": {
        "name": "‘Abdu’l-Bahá",
        "code": "abdul-baha",
        "folder": "Abdul-Baha",
        "subTierName": "Schriften & Ansprachen ‘Abdu’l-Bahás",
        "role": "Mittelpunkt des Bündnisses",
        "period": "1844–1921"
    },
    "shoghi-effendi": {
        "name": "Shoghi Effendi",
        "code": "shoghi-effendi",
        "folder": "Shoghi_Effendi",
        "subTierName": "Schriften Shoghi Effendis",
        "role": "Hüter des Bahá'í-Glaubens",
        "period": "1897–1957"
    },
    "the-universal-house-of-justice": {
        "name": "Universales Haus der Gerechtigkeit",
        "code": "uhj",
        "folder": "Universales_Haus_der_Gerechtigkeit",
        "subTierName": "Schriften des Universalen Hauses der Gerechtigkeit",
        "role": "Oberster Rat der Bahá'í-Gemeinde",
        "period": "1963–Gegenwart"
    },
    "compilations": {
        "name": "Textzusammenstellungen",
        "code": "compilations",
        "folder": "Kompilationen",
        "subTierName": "Thematische Kompilationen",
        "role": "Kompilationen & Studienreihen",
        "period": ""
    },
    "prayers": {
        "name": "Gebete & Andacht",
        "code": "prayers",
        "folder": "Gebete",
        "subTierName": "Bahá'í-Gebete",
        "role": "Andachtsschriften",
        "period": ""
    },
    # DE-Codes
    "bah": {
        "name": "Bahá'u'lláh",
        "code": "bahaullah",
        "folder": "Bahaullah",
        "subTierName": "Schriften Bahá'u'lláhs",
        "role": "Offenbarer",
        "period": "1817–1892"
    },
    "bab": {
        "name": "Der Báb",
        "code": "the-bab",
        "folder": "Der_Bab",
        "subTierName": "Schriften des Báb",
        "role": "Herold & Vorläufer",
        "period": "1819–1850"
    },
    "abd": {
        "name": "‘Abdu’l-Bahá",
        "code": "abdul-baha",
        "folder": "Abdul-Baha",
        "subTierName": "Schriften & Ansprachen ‘Abdu’l-Bahás",
        "role": "Mittelpunkt des Bündnisses",
        "period": "1844–1921"
    },
    "sho": {
        "name": "Shoghi Effendi",
        "code": "shoghi-effendi",
        "folder": "Shoghi_Effendi",
        "subTierName": "Schriften Shoghi Effendis",
        "role": "Hüter des Bahá'í-Glaubens",
        "period": "1897–1957"
    },
    "uhj": {
        "name": "Universales Haus der Gerechtigkeit",
        "code": "uhj",
        "folder": "Universales_Haus_der_Gerechtigkeit",
        "subTierName": "Schriften des Universalen Hauses der Gerechtigkeit",
        "role": "Oberster Rat der Bahá'í-Gemeinde",
        "period": "1963–Gegenwart"
    },
    "comp": {
        "name": "Textzusammenstellungen",
        "code": "compilations",
        "folder": "Kompilationen",
        "subTierName": "Thematische Kompilationen",
        "role": "Kompilationen & Studienreihen",
        "period": ""
    },
    "prayer": {
        "name": "Gebete & Andacht",
        "code": "prayers",
        "folder": "Gebete",
        "subTierName": "Bahá'í-Gebete",
        "role": "Andachtsschriften",
        "period": ""
    }
}


def sanitize_filename(text: str) -> str:
    """Dateinamen für macOS / Windows Filesysteme bereinigen."""
    text = re.sub(r'[\/\\:*?"<>|]', '-', text)
    text = re.sub(r'[\s_]+', ' ', text)
    text = re.sub(r'-{2,}', '-', text)
    return text.strip(" .-")


def clean_html_text(raw_html: str) -> str:
    if not raw_html:
        return ""
    text = re.sub(r'<script[^>]*>.*?</script>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = unescape(text)
    text = text.replace('\xa0', ' ').replace('\u202f', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def save_pdf_to_destinations(folder_name: str, filename: str, content_bytes: bytes) -> str:
    """Speichert PDF im Repository, im OneDrive-Ordner und Desktop-Deploy."""
    rel_subpath = Path("Buecher") / folder_name / filename
    targets = [
        REPO_DOCS_DIR.parent / rel_subpath,
        WORKSPACE_DOCS_DIR.parent / rel_subpath
    ]
    if NETLIFY_DOCS_DIR.parent.exists():
        targets.append(NETLIFY_DOCS_DIR.parent / rel_subpath)

    for target in targets:
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists() or target.stat().st_size != len(content_bytes):
                with open(target, "wb") as f:
                    f.write(content_bytes)
        except Exception as e:
            print(f"     Fehler beim Speichern in {target}: {e}", file=sys.stderr)

    return f"../documents/{rel_subpath.as_posix()}"


def generate_book_pdf(title: str, subtitle: str, author_name: str, paragraphs: list) -> bytes:
    """Generiert druckreifes Buch-PDF mit Inhaltsverzeichnis / Absätzen."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        import io

        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=A4,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )
        styles = getSampleStyleSheet()

        author_style = ParagraphStyle(
            'Author',
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=13,
            textColor=colors.HexColor('#9A7A38'),
            spaceAfter=10,
            alignment=1
        )
        title_style = ParagraphStyle(
            'Title',
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=23,
            textColor=colors.HexColor('#141413'),
            spaceAfter=8,
            alignment=1
        )
        sub_style = ParagraphStyle(
            'Sub',
            fontName='Helvetica-Oblique',
            fontSize=11,
            leading=15,
            textColor=colors.HexColor('#555555'),
            spaceAfter=18,
            alignment=1
        )
        body_style = ParagraphStyle(
            'Body',
            fontName='Helvetica',
            fontSize=10,
            leading=15,
            textColor=colors.HexColor('#222222'),
            spaceAfter=9,
            alignment=4
        )
        footer_style = ParagraphStyle(
            'Footnote',
            fontName='Helvetica',
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#777777'),
            spaceBefore=14,
            alignment=1
        )

        safe_t = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        safe_a = author_name.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

        story = [
            Paragraph(safe_a, author_style),
            Paragraph(safe_t, title_style)
        ]
        if subtitle:
            safe_sub = subtitle.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(safe_sub, sub_style))

        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#C5A059'), spaceAfter=18, spaceBefore=0))

        for p in paragraphs:
            cleaned = p.strip()
            if cleaned:
                safe_p = cleaned.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                story.append(Paragraph(safe_p, body_style))

        story.append(Spacer(1, 16))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E0DCD3'), spaceAfter=8, spaceBefore=10))
        story.append(Paragraph("Autorisierte Veröffentlichung &bull; Bahá'í-Bibliothek // Persönliches Studienarchiv", footer_style))

        doc.build(story)
        return pdf_buffer.getvalue()
    except Exception as e:
        print(f"     PDF-Generierung fehlgeschlagen ({e}), erstelle Text-Fallback.", file=sys.stderr)
        plain = f"{author_name}\n{title}\n{subtitle}\n\n" + "\n\n".join(paragraphs)
        return plain.encode('utf-8')


def import_english_books(existing_ids: set, docs: list) -> int:
    """Importiert alle englischen Bücher von bahai.org/library/authoritative-texts/downloads."""
    print("\n [1/2] Importiere englische Bücher von bahai.org/library...")
    base_url = "https://www.bahai.org"
    dl_url = f"{base_url}/library/authoritative-texts/downloads"

    opener = urllib.request.build_opener()
    opener.addheaders = [('User-Agent', USER_AGENT)]

    try:
        html = opener.open(dl_url, timeout=25).read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f" Fehler beim Laden der Downloads-Seite von bahai.org: {e}", file=sys.stderr)
        return 0

    # Links extrahieren: href="/library/authoritative-texts/<author>/<slug>/<file>.pdf"
    pdf_matches = re.findall(
        r'href=[\"\'](/library/authoritative-texts/([^/]+)/([^/]+)/([^\"]+\.pdf)(?:\?[^\"]*)?)[\"\']',
        html
    )

    count = 0
    seen_slugs = set()

    for full_path, author_key, slug, filename in pdf_matches:
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        author_meta = AUTHOR_INFO.get(author_key, {
            "name": author_key.replace('-', ' ').title(),
            "code": author_key,
            "folder": author_key.replace('-', '_').title(),
            "subTierName": "Schriften",
            "role": "Autor"
        })

        book_id = f"book_en_{author_meta['code']}_{slug}".replace('-', '_')
        if book_id in existing_ids:
            continue

        # Schönen Titel aus Dateiname / Slug formen
        clean_title = slug.replace('-', ' ').title()
        if clean_title.startswith("Kitab I "):
            clean_title = clean_title.replace("Kitab I ", "Kitáb-i-")
        if "Bahaullah" in clean_title:
            clean_title = clean_title.replace("Bahaullah", "Bahá'u'lláh")
        if "Abdul Baha" in clean_title:
            clean_title = clean_title.replace("Abdul Baha", "‘Abdu’l-Bahá")

        print(f"  ⬇️ Lade [{author_meta['name']}] {clean_title}...")

        # 1. PDF herunterladen
        pdf_url = f"{base_url}{full_path}"
        try:
            pdf_bytes = opener.open(pdf_url, timeout=40).read()
        except Exception as e:
            print(f"     PDF konnte nicht geladen werden ({pdf_url}): {e}")
            continue

        safe_fname = f"{sanitize_filename(clean_title)}-eng.pdf"
        file_web_path = save_pdf_to_destinations(author_meta['folder'], safe_fname, pdf_bytes)

        # 2. Text / XHTML für Reader herunterladen
        xhtml_url = f"{base_url}/library/authoritative-texts/{author_key}/{slug}/{slug}.xhtml"
        full_text = ""
        paragraphs = []
        try:
            xhtml = opener.open(xhtml_url, timeout=30).read().decode('utf-8', errors='replace')
            raw_pars = re.findall(r'<p[^>]*>(.*?)</p>', xhtml, re.DOTALL)
            for p in raw_pars:
                cp = clean_html_text(p)
                if cp and len(cp) > 10:
                    paragraphs.append(cp)
            full_text = "\n\n".join(paragraphs)
        except Exception:
            full_text = f"{author_meta['name']}\n\n{clean_title}\n\n[Volltext in Original-PDF verfügbar]"

        # Volltext speichern
        TEXTS_DIR.mkdir(parents=True, exist_ok=True)
        with open(TEXTS_DIR / f"{book_id}.txt", "w", encoding="utf-8") as f:
            f.write(full_text)

        word_count = len(full_text.split())
        excerpt = paragraphs[0][:180] + "…" if paragraphs else f"Authoritative work by {author_meta['name']}."

        entry = {
            "id": book_id,
            "title": clean_title,
            "subtitle": author_meta['subTierName'],
            "author": author_meta['name'],
            "authorCode": author_meta['code'],
            "role": author_meta['role'],
            "year": 0,
            "source": "bahai.org",
            "type": "Heiliges Buch / Schrift",
            "topics": ["Heilige Schriften", author_meta['name'], "Bücher"],
            "language": "english",
            "format": "pdf",
            "fileSize": len(pdf_bytes),
            "filePath": file_web_path,
            "originalFilename": safe_fname,
            "tier": "books",
            "tierName": "Heilige Schriften & Bücher",
            "subTier": author_meta['code'],
            "subTierName": author_meta['subTierName'],
            "hasText": True,
            "recipient": "world",
            "recipientLabel": "Alle Menschen",
            "keyPassagesCount": max(1, len(paragraphs) // 5),
            "excerpt": excerpt,
            "wordCount": word_count
        }

        docs.append(entry)
        existing_ids.add(book_id)
        count += 1
        time.sleep(0.1)

    print(f" {count} englische Bücher erfolgreich importiert.")
    return count


def import_german_books(existing_ids: set, docs: list) -> int:
    """Importiert alle deutschen Bücher von bibliothek.bahai.de."""
    print("\n [2/2] Importiere deutsche Bücher von bibliothek.bahai.de...")
    base_url = "https://bibliothek.bahai.de"
    authors = ["bah", "bab", "abd", "sho", "uhj", "comp", "prayer"]

    count = 0

    for a_code in authors:
        author_meta = AUTHOR_INFO.get(a_code)
        author_url = f"{base_url}/pubAuthor.php?authorCode={a_code}"

        req = urllib.request.Request(author_url, headers={'User-Agent': USER_AGENT})
        try:
            html = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f"   Fehler beim Laden von Autor {a_code}: {e}", file=sys.stderr)
            continue

        book_blocks = re.findall(r'<a[^>]*href=[\"\']pubReader\.php\?titleLangUri=([^\"\']+)[\"\'][^>]*>(.*?)</a>', html, re.DOTALL)
        print(f"   Autor [{author_meta['name']}]: {len(book_blocks)} Werke gefunden.")

        for uri, block in book_blocks:
            book_id = f"book_de_{uri}".replace('-', '_')
            if book_id in existing_ids:
                continue

            t_match = re.search(r'<p class=\"w3-large[^\"]*\"[^>]*>(.*?)</p>', block, re.DOTALL)
            title = clean_html_text(t_match.group(1)) if t_match else uri
            sub_match = re.search(r'<p class=\"w3-small[^\"]*\"[^>]*>(.*?)</p>', block, re.DOTALL)
            subtitle = clean_html_text(sub_match.group(1)) if sub_match else ""

            # Entferne Autorennennung im Buchtitel falls doppelt
            if title.startswith(author_meta['name']):
                title = title[len(author_meta['name']):].strip(" :–-")

            print(f"     Lade [{author_meta['name']}] {title[:50]}...")

            # Session initialisieren und alle Absätze iterativ per loadTextAfter laden
            cj = http.cookiejar.CookieJar()
            opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
            opener.addheaders = [('User-Agent', USER_AGENT)]

            paragraphs = []
            try:
                init_res = opener.open(f"{base_url}/pubReader.php?titleLangUri={uri}", timeout=25).read().decode('utf-8', errors='replace')
                init_pars = re.findall(r'<par[^>]*>([\s\S]*?)</par>', init_res)
                for p in init_pars:
                    cp = clean_html_text(p)
                    if cp and len(cp) > 5:
                        paragraphs.append(cp)

                # Weitere Absätze nachladen
                for _ in range(40):
                    ajax_url = f"{base_url}/pubAjax.php?action=loadTextAfter&titleLangUri={uri}"
                    ajax_res = opener.open(ajax_url, timeout=20).read().decode('utf-8', errors='replace')
                    ajax_pars = re.findall(r'<par[^>]*>([\s\S]*?)</par>', ajax_res)
                    if not ajax_pars:
                        break
                    for p in ajax_pars:
                        cp = clean_html_text(p)
                        if cp and len(cp) > 5:
                            paragraphs.append(cp)
                    if "Ende des Dokuments" in ajax_res:
                        break
                    time.sleep(0.05)
            except Exception as e:
                print(f"       Fehler beim Nachladen ({e})", file=sys.stderr)

            if not paragraphs:
                continue

            full_text = "\n\n".join(paragraphs)
            word_count = len(full_text.split())

            # Text speichern
            TEXTS_DIR.mkdir(parents=True, exist_ok=True)
            with open(TEXTS_DIR / f"{book_id}.txt", "w", encoding="utf-8") as f:
                f.write(full_text)

            # PDF erzeugen
            pdf_bytes = generate_book_pdf(title, subtitle, author_meta['name'], paragraphs)
            safe_fname = f"{sanitize_filename(title)}-dtsch.pdf"
            file_web_path = save_pdf_to_destinations(author_meta['folder'], safe_fname, pdf_bytes)

            excerpt = paragraphs[0][:180] + "…" if paragraphs else f"Autorisiertes deutsches Werk von {author_meta['name']}."

            entry = {
                "id": book_id,
                "title": title,
                "subtitle": subtitle,
                "author": author_meta['name'],
                "authorCode": author_meta['code'],
                "role": author_meta['role'],
                "year": 0,
                "source": "bibliothek.bahai.de",
                "type": "Heiliges Buch / Schrift",
                "topics": ["Heilige Schriften", author_meta['name'], "Bücher", "Deutsch"],
                "language": "deutsch",
                "format": "pdf",
                "fileSize": len(pdf_bytes),
                "filePath": file_web_path,
                "originalFilename": safe_fname,
                "tier": "books",
                "tierName": "Heilige Schriften & Bücher",
                "subTier": author_meta['code'],
                "subTierName": author_meta['subTierName'],
                "hasText": True,
                "recipient": "world",
                "recipientLabel": "Alle Menschen",
                "keyPassagesCount": max(1, len(paragraphs) // 5),
                "excerpt": excerpt,
                "wordCount": word_count
            }

            docs.append(entry)
            existing_ids.add(book_id)
            count += 1
            time.sleep(0.1)

    print(f" {count} deutsche Bücher erfolgreich importiert.")
    return count


def main():
    print("═══════════════════════════════════════════════════════════════════════")
    print("Bahá'í-Bücher-Importer: Bahá'í Reference Library & Bahá'í-Bibliothek")
    print(f"Zeitpunkt: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═══════════════════════════════════════════════════════════════════════")

    if not INDEX_FILE.exists():
        print(f" Index-Datei {INDEX_FILE} nicht gefunden!", file=sys.stderr)
        sys.exit(1)

    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        docs = json.load(f)

    print(f"Bestehender Datenbestand: {len(docs)} Einträge.")

    existing_ids = set(str(d.get("id", "")).lower() for d in docs)

    added_en = import_english_books(existing_ids, docs)
    added_de = import_german_books(existing_ids, docs)
    total_added = added_en + added_de

    if total_added > 0:
        print(f"\n Insgesamt {total_added} neue Bücher erfolgreich hinzugefügt ({added_en} EN, {added_de} DE).")
        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False, indent=2)
        print(f" data/index.json aktualisiert. Neuer Gesamtbestand: {len(docs)} Dokumente.")
    else:
        print("\n Alle Bücher sind bereits vollständig im Index und Ordner vorhanden.")

    print("\n=== Bücher-Import abgeschlossen ===")


if __name__ == "__main__":
    main()
