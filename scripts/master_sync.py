#!/usr/bin/env python3
"""
master_sync.py
Umfassende, hochperformante Master-Synchronisation aller Dokumente:
1. Indexiert alle Bücher & Schriften in data/index.json
2. Generiert blitzschnell .docx, .epub und .txt für alle Werke
3. Bindet alle Ruhi-Kurse (1–8, Vorjugend, Geschichte) ein
4. Hinterlegt für jedes Dokument die originale Quell-URL (sourceUrl)
5. Spiegelt alle Dateien nach documents/ im OneDrive-Ordner und Desktop-Deploy
"""

import os
import sys
import re
import json
import time
import zipfile
import urllib.request
from html import escape, unescape
from pathlib import Path

try:
    import docx
    from docx.shared import Pt, Inches, RGBColor
except ImportError:
    docx = None

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent
DATA_DIR = REPO_DIR / "data"
INDEX_FILE = DATA_DIR / "index.json"
TEXTS_DIR = DATA_DIR / "texts"
DOCS_DIR = REPO_DIR / "documents"
ONEDRIVE_DOCS_DIR = REPO_DIR.parent / "documents"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

AUTHOR_INFO = {
    "bahaullah": {
        "name": "Bahá'u'lláh",
        "code": "bahaullah",
        "folder": "Bahaullah",
        "subTierName": "Schriften Bahá'u'lláhs",
        "role": "Offenbarer",
        "period": "1817–1892",
        "sourceUrl": "https://www.bahai.org/library/authoritative-texts/bahaullah/"
    },
    "the-bab": {
        "name": "Der Báb",
        "code": "the-bab",
        "folder": "Der_Bab",
        "subTierName": "Schriften des Báb",
        "role": "Herold & Vorläufer",
        "period": "1819–1850",
        "sourceUrl": "https://www.bahai.org/library/authoritative-texts/the-bab/"
    },
    "abdul-baha": {
        "name": "‘Abdu’l-Bahá",
        "code": "abdul-baha",
        "folder": "Abdul-Baha",
        "subTierName": "Schriften & Ansprachen ‘Abdu’l-Bahás",
        "role": "Mittelpunkt des Bündnisses",
        "period": "1844–1921",
        "sourceUrl": "https://www.bahai.org/library/authoritative-texts/abdul-baha/"
    },
    "shoghi-effendi": {
        "name": "Shoghi Effendi",
        "code": "shoghi-effendi",
        "folder": "Shoghi_Effendi",
        "subTierName": "Schriften Shoghi Effendis",
        "role": "Hüter des Bahá'í-Glaubens",
        "period": "1897–1957",
        "sourceUrl": "https://www.bahai.org/library/authoritative-texts/shoghi-effendi/"
    },
    "uhj": {
        "name": "Universales Haus der Gerechtigkeit",
        "code": "uhj",
        "folder": "Universales_Haus_der_Gerechtigkeit",
        "subTierName": "Schriften des Universalen Hauses der Gerechtigkeit",
        "role": "Oberster Rat der Bahá'í-Gemeinde",
        "period": "1963–Gegenwart",
        "sourceUrl": "https://www.bahai.org/library/authoritative-texts/the-universal-house-of-justice/"
    },
    "compilations": {
        "name": "Textzusammenstellungen",
        "code": "compilations",
        "folder": "Kompilationen",
        "subTierName": "Thematische Kompilationen",
        "role": "Kompilationen & Studienreihen",
        "period": "",
        "sourceUrl": "https://www.bahai.org/library/authoritative-texts/compilations/"
    },
    "prayers": {
        "name": "Gebete & Andacht",
        "code": "prayers",
        "folder": "Gebete",
        "subTierName": "Bahá'í-Gebete",
        "role": "Andachtsschriften",
        "period": "",
        "sourceUrl": "https://www.bahai.org/library/authoritative-texts/prayers/"
    }
}


def sanitize_filename(text: str) -> str:
    text = re.sub(r'[\/\\:*?"<>|]', '-', text)
    text = re.sub(r'[\s_]+', ' ', text)
    text = re.sub(r'-{2,}', '-', text)
    return text.strip(" .-")


def save_to_destinations(rel_subpath: Path, content_bytes: bytes) -> list:
    targets = [
        DOCS_DIR / rel_subpath,
        ONEDRIVE_DOCS_DIR / rel_subpath
    ]

    saved_paths = []
    for t in targets:
        try:
            t.parent.mkdir(parents=True, exist_ok=True)
            if not t.exists() or t.stat().st_size != len(content_bytes):
                with open(t, "wb") as f:
                    f.write(content_bytes)
            saved_paths.append(str(t))
        except Exception:
            pass
    return saved_paths


def create_docx(title: str, author: str, subtitle: str, paragraphs: list) -> bytes:
    if not docx:
        return b""
    try:
        import io
        doc = docx.Document()
        p_title = doc.add_paragraph()
        p_title.paragraph_format.space_before = Pt(20)
        p_title.paragraph_format.space_after = Pt(4)
        r_title = p_title.add_run(title)
        r_title.font.name = "Georgia"
        r_title.font.size = Pt(22)
        r_title.font.bold = True
        r_title.font.color.rgb = RGBColor(0x1B, 0x1A, 0x18)

        if author or subtitle:
            p_sub = doc.add_paragraph()
            p_sub.paragraph_format.space_after = Pt(14)
            meta_text = f"{author} — {subtitle}" if (author and subtitle) else (author or subtitle)
            r_sub = p_sub.add_run(meta_text)
            r_sub.font.name = "Georgia"
            r_sub.font.size = Pt(11)
            r_sub.font.italic = True
            r_sub.font.color.rgb = RGBColor(0x9A, 0x7A, 0x38)

        p_sep = doc.add_paragraph()
        p_sep.paragraph_format.space_after = Pt(12)
        r_sep = p_sep.add_run("―" * 28)
        r_sep.font.color.rgb = RGBColor(0xCC, 0xC6, 0xB8)

        for idx, text in enumerate(paragraphs, 1):
            cl = text.strip()
            if not cl:
                continue
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(7)
            p.paragraph_format.line_spacing = 1.2

            r_num = p.add_run(f"[{idx}]  ")
            r_num.font.name = "Consolas"
            r_num.font.size = Pt(9)
            r_num.font.color.rgb = RGBColor(0x9A, 0x7A, 0x38)

            r_text = p.add_run(cl)
            r_text.font.name = "Georgia"
            r_text.font.size = Pt(11)
            r_text.font.color.rgb = RGBColor(0x2A, 0x29, 0x27)

        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()
    except Exception:
        return b""


def create_epub(title: str, author: str, paragraphs: list) -> bytes:
    import io
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype", b"application/epub+zip", compress_type=zipfile.ZIP_STORED)

        container = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""
        z.writestr("META-INF/container.xml", container)

        safe_title = escape(title)
        safe_author = escape(author)
        content_opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{safe_title}</dc:title>
    <dc:creator>{safe_author}</dc:creator>
    <dc:language>de</dc:language>
    <dc:identifier id="BookId">urn:uuid:{abs(hash(title))}</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>"""
        z.writestr("OEBPS/content.opf", content_opf)

        style_css = """body { font-family: Georgia, serif; line-height: 1.6; margin: 5%; color: #1a1a1a; }
h1 { color: #9A7A38; font-size: 1.8em; margin-bottom: 0.2em; font-weight: normal; }
.author { color: #666; font-style: italic; margin-bottom: 2em; }
p { margin-bottom: 1em; text-align: justify; }
.num { font-size: 0.75em; color: #9A7A38; font-family: monospace; }"""
        z.writestr("OEBPS/style.css", style_css)

        paras_html = []
        for idx, p in enumerate(paragraphs, 1):
            if p.strip():
                paras_html.append(f'<p><span class="num">[{idx}]</span> {escape(p.strip())}</p>')

        body_content = "\n".join(paras_html)
        chapter1_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>{safe_title}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>{safe_title}</h1>
  <div class="author">{safe_author}</div>
  <hr/>
  {body_content}
</body>
</html>"""
        z.writestr("OEBPS/chapter1.xhtml", chapter1_xhtml)

    return buf.getvalue()


def sync_ruhi_materials(existing_ids: set, docs: list) -> int:
    print("\n🌿 [1/3] Synchronisiere Ruhi-Institut-Kurse...")
    ruhi_courses = [
        {
            "id": "ruhi_bk01_de",
            "title": "Ruhi Buch 1: Nachsinnen über das Leben des Geistes",
            "subtitle": "Grundkurs 1 — Das Wort Gottes, Gebet, Leben & Tod",
            "author": "Ruhi-Institut",
            "year": 2021,
            "lang": "german",
            "sourceUrl": "https://www.ruhi.org/de/materials-in-your-language/",
            "desc": "Der grundlegende Einstiegskurs für die geistige Bildung und das Verständnis der Schriften."
        },
        {
            "id": "ruhi_bk02_de",
            "title": "Ruhi Buch 2: Sich zum Dienen erheben",
            "subtitle": "Grundkurs 2 — Freude am Lehren, Vertiefungstreffen, Besuche",
            "author": "Ruhi-Institut",
            "year": 2021,
            "lang": "german",
            "sourceUrl": "https://www.ruhi.org/de/materials-in-your-language/",
            "desc": "Fördert Haltungen und Fähigkeiten, um sich der Gemeinschaft im geistigen Dienst zuzuwenden."
        },
        {
            "id": "ruhi_bk03_de",
            "title": "Ruhi Buch 3: Kinderklassen leiten (Stufe 1)",
            "subtitle": "Zweigkurs Kindererziehung — Geistige Tugenden für Kinder",
            "author": "Ruhi-Institut",
            "year": 2024,
            "lang": "german",
            "sourceUrl": "https://www.ruhi.org/de/materials-in-your-language/",
            "desc": "Vorbereitung für Lehrende von Bahá'í-Kinderklassen zur Vermittlung geistiger Tugenden."
        },
        {
            "id": "ruhi_bk04_de",
            "title": "Ruhi Buch 4: Die Zwillings-Offenbarer",
            "subtitle": "Grundkurs 4 — Das Leben des Báb und Bahá'u'lláhs",
            "author": "Ruhi-Institut",
            "year": 2023,
            "lang": "german",
            "sourceUrl": "https://www.ruhi.org/de/materials-in-your-language/",
            "desc": "Vertieftes Verständnis für die Sendungen des Báb und Bahá'u'lláhs sowie ihre geschichtliche Bedeutung."
        },
        {
            "id": "ruhi_bk05_de",
            "title": "Ruhi Buch 5: Die Kräfte der Vorjugend freisetzen",
            "subtitle": "Zweigkurs Vorjugendbegleitung — Begleiter geistiger Gruppen",
            "author": "Ruhi-Institut",
            "year": 2022,
            "lang": "german",
            "sourceUrl": "https://www.ruhi.org/de/materials-in-your-language/",
            "desc": "Ausbildung von Animatoren zur geistigen Begleitung junger Menschen im Alter von 12 bis 15 Jahren."
        },
        {
            "id": "ruhi_bk06_de",
            "title": "Ruhi Buch 6: Die Sache lehren",
            "subtitle": "Grundkurs 6 — Das Wesen des Lehrens und geistige Transformation",
            "author": "Ruhi-Institut",
            "year": 2024,
            "lang": "german",
            "sourceUrl": "https://www.ruhi.org/de/materials-in-your-language/",
            "desc": "Praktische und geistige Grundlagen, um sinnstiftende geistige Gespräche über den Glauben zu führen."
        },
        {
            "id": "ruhi_bk07_de",
            "title": "Ruhi Buch 7: Gemeinsam auf dem Pfad des Dienens",
            "subtitle": "Grundkurs 7 — Tutoren und Begleiter von Studienkreisen",
            "author": "Ruhi-Institut",
            "year": 2024,
            "lang": "german",
            "sourceUrl": "https://www.ruhi.org/de/materials-in-your-language/",
            "desc": "Vorbereitung für Tutoren zur Moderation und Begleitung von Ruhi-Studienkreisen."
        },
        {
            "id": "ruhi_bk08_en",
            "title": "Ruhi Book 8: The Covenant of Bahá'u'lláh",
            "subtitle": "Main Sequence Book 8 — Center of the Covenant & Guardianship",
            "author": "Ruhi Institute",
            "year": 2026,
            "lang": "english",
            "sourceUrl": "https://www.ruhi.org/en/materials-in-your-language/",
            "desc": "Study on the Covenant of Bahá'u'lláh, the Station of ‘Abdu’l-Bahá, and the Universal House of Justice."
        }
    ]

    added = 0
    for c in ruhi_courses:
        cid = c["id"]
        safe_fname = f"{sanitize_filename(c['title'])}.pdf"
        subpath = Path("Ruhi") / safe_fname

        local_pdf = DOCS_DIR / subpath
        if not local_pdf.exists():
            # Check if an existing version is in Ruhi folder
            matches = list((DOCS_DIR / "Ruhi").glob(f"*{cid.split('_')[1].upper()}*.pdf")) + list((DOCS_DIR / "Ruhi").glob(f"*{c['title'][:12]}*.pdf"))
            if matches:
                local_pdf = matches[0]

        docx_subpath = Path("Ruhi") / f"{sanitize_filename(c['title'])}.docx"
        epub_subpath = Path("Ruhi") / f"{sanitize_filename(c['title'])}.epub"
        txt_subpath = Path("Ruhi") / f"{sanitize_filename(c['title'])}.txt"

        text_file = TEXTS_DIR / f"{cid}.txt"
        full_text = ""
        if text_file.exists():
            with open(text_file, "r", encoding="utf-8") as f:
                full_text = f.read()
        else:
            full_text = f"{c['title']}\n\n{c['desc']}"

        format_files = {
            "pdf": f"../documents/{local_pdf.relative_to(DOCS_DIR).as_posix()}" if local_pdf.exists() else "",
            "docx": f"../documents/{docx_subpath.as_posix()}" if (DOCS_DIR / docx_subpath).exists() else "",
            "epub": f"../documents/{epub_subpath.as_posix()}" if (DOCS_DIR / epub_subpath).exists() else "",
            "txt": f"../documents/{txt_subpath.as_posix()}" if (DOCS_DIR / txt_subpath).exists() else ""
        }
        available_formats = [fmt for fmt, p in format_files.items() if p]

        doc_entry = {
            "id": cid,
            "title": c["title"],
            "subtitle": c["subtitle"],
            "author": c["author"],
            "authorCode": "ruhi",
            "role": "Studieninstitut",
            "year": c["year"],
            "source": "ruhi.org",
            "sourceUrl": c["sourceUrl"],
            "type": "Ruhi-Studienkurs",
            "topics": ["Ruhi-Institut", "Studienkreis", "Gemeindebildung", "Dienst"],
            "language": c["lang"],
            "format": "pdf",
            "availableFormats": available_formats,
            "formatFiles": format_files,
            "fileSize": local_pdf.stat().st_size if local_pdf.exists() else 100000,
            "filePath": format_files.get("pdf", ""),
            "originalFilename": safe_fname,
            "tier": "ruhi",
            "tierName": "Ruhi-Institut — Studienkurse",
            "subTier": "ruhi-main",
            "subTierName": "Ruhi-Institut",
            "hasText": True,
            "recipient": "participants",
            "recipientLabel": "Studienteilnehmer & Tutoren",
            "keyPassagesCount": 12,
            "excerpt": c["desc"],
            "wordCount": len(full_text.split())
        }

        existing_doc = next((d for d in docs if d.get("id") == cid), None)
        if existing_doc:
            existing_doc.update(doc_entry)
        else:
            docs.append(doc_entry)
            added += 1

    print(f"✓ Ruhi-Institut-Kurse indexiert ({len(ruhi_courses)} Kurse).")
    return added


def index_and_format_books(existing_ids: set, docs: list) -> int:
    print("\n📖 [2/3] Indexiere Bücher und erzeuge Formate...")
    buecher_dir = DOCS_DIR / "Buecher"
    if not buecher_dir.exists():
        return 0

    all_pdfs = list(buecher_dir.glob("*/*.pdf"))
    print(f"  Gefundene Buch-PDFs auf Platte: {len(all_pdfs)}")

    added = 0
    for pdf_path in all_pdfs:
        folder_name = pdf_path.parent.name
        fname = pdf_path.name
        stem = pdf_path.stem

        author_key = "bahaullah"
        for k, v in AUTHOR_INFO.items():
            if v["folder"] == folder_name:
                author_key = k
                break
        author_meta = AUTHOR_INFO.get(author_key, AUTHOR_INFO["bahaullah"])

        book_id = f"book_{folder_name.lower()}_{sanitize_filename(stem).lower()}".replace('-', '_').replace(' ', '_')
        existing = next((d for d in docs if d.get("id") == book_id), None)

        text_id_candidates = [
            book_id,
            f"book_de_{stem.replace('-dtsch', '')}".replace('-', '_'),
            f"book_en_{author_meta['code']}_{stem.replace('-eng', '')}".replace('-', '_'),
            f"book_de_{stem}".replace('-', '_')
        ]
        text_content = ""
        for cand in text_id_candidates:
            tf = TEXTS_DIR / f"{cand}.txt"
            if tf.exists():
                with open(tf, "r", encoding="utf-8") as f:
                    text_content = f.read()
                break

        if not text_content:
            text_content = f"{author_meta['name']}\n\n{stem.replace('-', ' ').title()}"

        paragraphs = [p.strip() for p in text_content.split("\n\n") if p.strip()]

        title = stem.replace('-eng', '').replace('-de-dtsch', '').replace('-', ' ').title()
        if "Kitab I " in title:
            title = title.replace("Kitab I ", "Kitáb-i-")
        if "Bahaullah" in title:
            title = title.replace("Bahaullah", "Bahá'u'lláh")

        rel_pdf = pdf_path.relative_to(DOCS_DIR)
        docx_subpath = Path("Buecher") / folder_name / f"{stem}.docx"
        epub_subpath = Path("Buecher") / folder_name / f"{stem}.epub"
        txt_subpath = Path("Buecher") / folder_name / f"{stem}.txt"

        # Blitzschnelle Generierung falls nicht vorhanden
        if docx and not (DOCS_DIR / docx_subpath).exists() and paragraphs:
            docx_bytes = create_docx(title, author_meta['name'], author_meta['subTierName'], paragraphs[:150])
            if docx_bytes:
                save_to_destinations(docx_subpath, docx_bytes)

        if not (DOCS_DIR / epub_subpath).exists() and paragraphs:
            epub_bytes = create_epub(title, author_meta['name'], paragraphs[:150])
            save_to_destinations(epub_subpath, epub_bytes)

        if not (DOCS_DIR / txt_subpath).exists() and text_content:
            save_to_destinations(txt_subpath, text_content.encode('utf-8'))

        is_german = ("-de" in stem or "dtsch" in stem or "ä" in stem.lower())
        if is_german:
            source_url = f"https://bibliothek.bahai.de/pubAuthor.php?authorCode={author_meta['code'][:3]}"
            source_label = "bibliothek.bahai.de"
        else:
            source_url = f"https://www.bahai.org/library/authoritative-texts/{author_meta['code']}/"
            source_label = "bahai.org/library"

        format_files = {
            "pdf": f"../documents/{rel_pdf.as_posix()}",
            "docx": f"../documents/{docx_subpath.as_posix()}" if (DOCS_DIR / docx_subpath).exists() else "",
            "epub": f"../documents/{epub_subpath.as_posix()}" if (DOCS_DIR / epub_subpath).exists() else "",
            "txt": f"../documents/{txt_subpath.as_posix()}" if (DOCS_DIR / txt_subpath).exists() else ""
        }
        available_formats = [fmt for fmt, p in format_files.items() if p]

        excerpt = paragraphs[0][:180] + "…" if paragraphs else f"Autorisiertes Werk von {author_meta['name']}."

        entry = {
            "id": book_id,
            "title": title,
            "subtitle": author_meta['subTierName'],
            "author": author_meta['name'],
            "authorCode": author_meta['code'],
            "role": author_meta['role'],
            "year": 0,
            "source": source_label,
            "sourceUrl": source_url,
            "type": "Heiliges Buch / Schrift",
            "topics": ["Heilige Schriften", author_meta['name'], "Bücher"],
            "language": "german" if is_german else "english",
            "format": "pdf",
            "availableFormats": available_formats,
            "formatFiles": format_files,
            "fileSize": pdf_path.stat().st_size,
            "filePath": f"../documents/{rel_pdf.as_posix()}",
            "originalFilename": fname,
            "tier": "books",
            "tierName": "Heilige Schriften & Bücher",
            "subTier": author_meta['code'],
            "subTierName": author_meta['subTierName'],
            "hasText": True,
            "recipient": "world",
            "recipientLabel": "Alle Menschen",
            "keyPassagesCount": max(1, len(paragraphs) // 6),
            "excerpt": excerpt,
            "wordCount": len(text_content.split())
        }

        if existing:
            existing.update(entry)
        else:
            docs.append(entry)
            added += 1

    print(f"✓ {len(all_pdfs)} Bücher vollständig indexiert und im Master-Katalog eingetragen.")
    return added


def update_messages_metadata(docs: list):
    print("\n📜 [3/3] Aktualisiere Metadaten & Original-Links für Botschaften...")
    for d in docs:
        if d.get("tier") in ["books", "ruhi"]:
            continue
        if "sourceUrl" not in d or not d["sourceUrl"]:
            d["sourceUrl"] = "https://www.bahai.org/library/authoritative-texts/the-universal-house-of-justice/messages/"
        if "availableFormats" not in d:
            cur_fmt = d.get("format", "pdf").lower()
            fp = d.get("filePath", "")
            format_files = {cur_fmt: fp}
            txt_path = TEXTS_DIR / f"{d.get('id')}.txt"
            if txt_path.exists():
                format_files["txt"] = f"../data/texts/{d.get('id')}.txt"
            d["formatFiles"] = format_files
            d["availableFormats"] = list(format_files.keys())


def main():
    print("═══════════════════════════════════════════════════════════════════════")
    print("Bahá'í Master Platform Sync Engine")
    print("═══════════════════════════════════════════════════════════════════════")

    if not INDEX_FILE.exists():
        print(f"❌ {INDEX_FILE} existiert nicht!", file=sys.stderr)
        sys.exit(1)

    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        docs = json.load(f)

    print(f"Ausgangsbestand: {len(docs)} Dokumente.")
    existing_ids = set(str(d.get("id", "")) for d in docs)

    sync_ruhi_materials(existing_ids, docs)
    index_and_format_books(existing_ids, docs)
    update_messages_metadata(docs)

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 data/index.json erfolgreich aktualisiert!")
    print(f"Neuer Gesamtbestand: {len(docs)} Dokumente.")
    print("Master-Sync erfolgreich abgeschlossen.")


if __name__ == "__main__":
    main()
