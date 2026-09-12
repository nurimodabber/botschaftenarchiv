#!/usr/bin/env python3
"""
Automated Daily Sync for Bahá'í Messages Archive
Scans:
1. Bahá'í Reference Library (bahai.org) - Authoritative English messages
2. bibliothek.bahai.de - Official German translations

Detects new messages, downloads full texts, extracts clean metadata & excerpts,
and appends them to data/index.json and data/texts/<id>.txt.
"""

import os
import sys
import re
import json
import time
import hashlib
import urllib.request
import urllib.error
from html import unescape
from pathlib import Path
from datetime import datetime

# Path resolution (works locally and in GitHub Actions)
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent
DATA_DIR = REPO_DIR / "data"
INDEX_FILE = DATA_DIR / "index.json"
TEXTS_DIR = DATA_DIR / "texts"
REPO_DOCS_DIR = REPO_DIR / "documents"
WORKSPACE_DOCS_DIR = REPO_DIR.parent / "documents"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def sanitize_filename(text: str) -> str:
    """Sanitize title or string for filesystem compatibility."""
    text = re.sub(r'[\/\\:*?"<>|]', '-', text)
    text = re.sub(r'[\s_]+', ' ', text)
    text = re.sub(r'-{2,}', '-', text)
    return text.strip(" .-")


def fetch_binary(url: str, timeout: int = 30) -> bytes:
    """Fetch binary file (PDF/DOCX) with timeout and headers."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except Exception:
        return b""


def save_document_to_destinations(relative_subpath: Path, content_bytes: bytes) -> str:
    """
    Saves document binary content (PDF/DOCX) to:
    1. REPO_DOCS_DIR / relative_subpath (inside git repo)
    2. WORKSPACE_DOCS_DIR / relative_subpath (user's personal OneDrive folder!)
    Returns web relative path e.g. '../documents/2026/filename.pdf'
    """
    targets = [REPO_DOCS_DIR / relative_subpath]
    try:
        if WORKSPACE_DOCS_DIR.exists() and WORKSPACE_DOCS_DIR.resolve() != REPO_DOCS_DIR.resolve():
            targets.append(WORKSPACE_DOCS_DIR / relative_subpath)
    except Exception:
        pass

    for target in targets:
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            with open(target, "wb") as f:
                f.write(content_bytes)
            print(f"    📁 In Ordner abgelegt: {target.parent.name}/{target.name}")
        except Exception as e:
            print(f"    ⚠ Fehler beim Ablegen in {target}: {e}", file=sys.stderr)

    return f"../documents/{relative_subpath.as_posix()}"


def generate_pdf(title: str, iso_date: str, recipient: str, paragraphs: list) -> bytes:
    """Generate clean, publication-ready PDF using reportlab with fallback to plain text."""
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

        eyebrow_style = ParagraphStyle(
            'Eyebrow',
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#9A7A38'),
            spaceAfter=8
        )
        title_style = ParagraphStyle(
            'Title',
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=19,
            textColor=colors.HexColor('#141413'),
            spaceAfter=6
        )
        meta_style = ParagraphStyle(
            'Meta',
            fontName='Helvetica-Oblique',
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor('#555555'),
            spaceAfter=14
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
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#777777'),
            spaceBefore=14,
            alignment=1
        )

        safe_title = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        story = [
            Paragraph("UNIVERSALES HAUS DER GERECHTIGKEIT", eyebrow_style),
            Paragraph(safe_title, title_style)
        ]

        meta_line = []
        if iso_date:
            meta_line.append(f"Datum: {iso_date}")
        if recipient:
            meta_line.append(f"Empf\u00e4nger: {recipient}")
        if meta_line:
            story.append(Paragraph(" &bull; ".join(meta_line).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), meta_style))

        story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor('#E0DCD3'), spaceAfter=14, spaceBefore=0))

        for p in paragraphs:
            cleaned = p.strip()
            if cleaned:
                safe_p = cleaned.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                story.append(Paragraph(safe_p, body_style))

        story.append(Spacer(1, 14))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E0DCD3'), spaceAfter=8, spaceBefore=10))
        story.append(Paragraph("Offizieller autorisierter Text &bull; bibliothek.bahai.de // Aufbereitet f\u00fcr das pers\u00f6nliche Studienarchiv", footer_style))

        doc.build(story)
        return pdf_buffer.getvalue()
    except Exception as e:
        print(f"  ⚠ PDF-Generierung fehlgeschlagen, speichere als Text: {e}", file=sys.stderr)
        plain = f"UNIVERSALES HAUS DER GERECHTIGKEIT\n{title}\nDatum: {iso_date} | Empf\u00e4nger: {recipient}\n\n" + "\n\n".join(paragraphs)
        return plain.encode('utf-8')


def clean_html_text(raw_html: str) -> str:
    """Clean HTML tags, comments, unescape entities, and normalize whitespace."""
    if not raw_html:
        return ""
    text = re.sub(r'<script[^>]*>.*?</script>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '', text)
    text = unescape(text)
    text = text.replace('\xa0', ' ').replace('\u202f', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def fetch_url(url: str, timeout: int = 20) -> str:
    """Fetch URL with timeout and standard browser headers."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except Exception as e:
        print(f"  ⚠ Error fetching {url}: {e}", file=sys.stderr)
        return ""


def parse_german_date(date_str: str) -> str:
    """Parse German date string to ISO YYYY-MM-DD."""
    if not date_str:
        return ""
    date_str = date_str.strip()

    m_rid = re.search(r'Riḍván\s*(\d{4})', date_str, re.IGNORECASE)
    if m_rid:
        return f"{m_rid.group(1)}-04-21"

    m_naw = re.search(r'Naw[- ]Rúz\s*(\d{4})', date_str, re.IGNORECASE)
    if m_naw:
        return f"{m_naw.group(1)}-03-21"

    months = {
        "januar": "01", "februar": "02", "märz": "03", "maerz": "03",
        "april": "04", "mai": "05", "juni": "06", "juli": "07",
        "august": "08", "september": "09", "oktober": "10",
        "november": "11", "dezember": "12"
    }

    m = re.search(r'(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})', date_str)
    if m:
        day = int(m.group(1))
        m_name = m.group(2).lower()
        year = m.group(3)
        month = months.get(m_name, "01")
        return f"{year}-{month}-{day:02d}"

    m_my = re.search(r'([A-Za-zäöüÄÖÜ]+)\s+(\d{4})', date_str)
    if m_my:
        m_name = m_my.group(1).lower()
        year = m_my.group(2)
        month = months.get(m_name, "01")
        return f"{year}-{month}-01"

    m_y = re.search(r'\b(19\d{2}|20\d{2})\b', date_str)
    if m_y:
        return f"{m_y.group(1)}-01-01"

    return ""


def parse_english_id_date(doc_id: str, date_str: str) -> str:
    """Parse date from bahai.org document ID (YYYYMMDD_001) or date string."""
    m_id = re.match(r'(\d{4})(\d{2})(\d{2})_', doc_id)
    if m_id:
        return f"{m_id.group(1)}-{m_id.group(2)}-{m_id.group(3)}"

    m_rid = re.search(r'Riḍván\s*(\d{4})', date_str, re.IGNORECASE)
    if m_rid:
        return f"{m_rid.group(1)}-04-21"

    m_naw = re.search(r'Naw[- ]Rúz\s*(\d{4})', date_str, re.IGNORECASE)
    if m_naw:
        return f"{m_naw.group(1)}-03-21"

    months = {
        "january": "01", "february": "02", "march": "03", "april": "04",
        "may": "05", "june": "06", "july": "07", "august": "08",
        "september": "09", "october": "10", "november": "11", "december": "12"
    }
    m = re.search(r'(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})', date_str)
    if m:
        day = int(m.group(1))
        m_name = m.group(2).lower()
        year = m.group(3)
        month = months.get(m_name, "01")
        return f"{year}-{month}-{day:02d}"

    m_y = re.search(r'\b(19\d{2}|20\d{2})\b', date_str)
    if m_y:
        return f"{m_y.group(1)}-01-01"

    return ""


def determine_recipient(recipient_text: str, title: str):
    """Determine recipient key and display label."""
    combined = f"{recipient_text} {title}".lower()
    if any(k in combined for k in ["an die bahá’í der welt", "an die bahá'í der welt", "bahá’ís of the world", "bahá'ís of the world", "weltweite"]):
        return "world", "Weltweite Bahá'í-Gemeinde"
    if any(k in combined for k in ["nationalen geistigen", "national spiritual", "nationale geistige"]):
        return "nsa", "Nationale Geistige Räte"
    if any(k in combined for k in ["berater", "counsellor", "hilfsamt", "auxiliary board", "kontinentale"]):
        return "counsellors", "Kontinentale Berater & Hilfsamt"
    if any(k in combined for k in ["jugend", "youth"]):
        return "youth", "Bahá'í-Jugend"
    if any(k in combined for k in ["trainingsinstitut", "training institute", "institutes"]):
        return "institutes", "Trainingsinstitute"
    if any(k in combined for k in ["iran", "írán"]):
        return "iran", "Bahá'í im Iran"
    if any(k in combined for k in ["einzelne", "individual", "an einen"]):
        return "individual", "Einzelne Gläubige"
    return "other", recipient_text if recipient_text else "Allgemein"


def determine_message_type(title: str, date_str: str):
    """Determine message category/type."""
    combined = f"{title} {date_str}".lower()
    if "riḍván" in combined or "ridvan" in combined:
        return "Riḍván-Botschaft"
    if "naw-rúz" in combined or "naw rúz" in combined or "nawruz" in combined:
        return "Naw-Rúz-Botschaft"
    if "berater" in combined or "counsellor" in combined:
        return "Beraterkonferenz-Botschaft"
    if "jugend" in combined or "youth" in combined:
        return "Jugendkonferenz-Botschaft"
    if "frieden" in combined or "peace" in combined:
        return "Friedensbotschaft"
    return "Botschaft"


def create_clean_excerpt(paragraphs: list, max_length: int = 180) -> str:
    """Extract first 1-2 actual content sentences, skipping salutations and headings."""
    skip_markers = [
        "universale haus", "universal house", "riḍván", "ridvan", "naw-rúz", "naw rúz",
        "an die", "an alle", "to the", "to all", "freunde", "friends", "geehrt", "liebe", "dear"
    ]
    for p in paragraphs:
        p_clean = clean_html_text(p).strip()
        if len(p_clean) < 30:
            continue
        first_lower = p_clean[:80].lower()
        if any(marker in first_lower for marker in skip_markers):
            continue
        # Found first content paragraph, extract sentences
        sentences = re.split(r'(?<=[.!?])\s+', p_clean)
        first_two = " ".join(sentences[:2]).strip()
        if len(first_two) > max_length:
            return first_two[:max_length].rstrip(" ,.;-") + "…"
        return first_two
    return ""


def sync_german_bibliothek(existing_keys: set, existing_docs: list) -> int:
    """Check bibliothek.bahai.de for new UHJ German messages."""
    print("\n🔍 Überprüfe bibliothek.bahai.de auf neue Botschaften...")
    author_url = "https://bibliothek.bahai.de/pubAuthor.php?authorCode=uhj"
    html = fetch_url(author_url)
    if not html:
        print("  ❌ bibliothek.bahai.de konnte nicht erreicht werden.")
        return 0

    items = re.findall(
        r'<a[^>]*href="pubReader\.php\?titleLangUri=(uhj-[^"]+)"[^>]*>(.*?)</a>',
        html,
        re.DOTALL
    )
    print(f"  ✓ {len(items)} Veröffentlichungen auf bibliothek.bahai.de gefunden.")

    new_count = 0
    for uri, block in items:
        # Extract date, recipient, description
        d_match = re.search(r'name="divDate"[^>]*>.*?<span>(.*?)</span>', block, re.DOTALL)
        r_match = re.search(r'name="divRecipient"[^>]*>.*?<span>(.*?)</span>', block, re.DOTALL)
        desc_match = re.search(r'name="divDescriptionMessage"[^>]*>.*?<span>(.*?)</span>', block, re.DOTALL)

        raw_date = clean_html_text(d_match.group(1)) if d_match else ""
        raw_recip = clean_html_text(r_match.group(1)) if r_match else ""
        desc = clean_html_text(desc_match.group(1)) if desc_match else ""

        if not desc and not raw_recip:
            t_match = re.search(r'<p class="w3-large[^"]*"[^>]*>(.*?)</p>', block, re.DOTALL)
            if t_match:
                desc = clean_html_text(t_match.group(1))

        iso_date = parse_german_date(raw_date)
        if not iso_date:
            uri_m = re.search(r'(\d{4})(\d{2})(\d{2})', uri)
            if uri_m:
                iso_date = f"{uri_m.group(1)}-{uri_m.group(2)}-{uri_m.group(3)}"
            else:
                uri_ym = re.search(r'(\d{4})(\d{2})00', uri)
                if uri_ym:
                    iso_date = f"{uri_ym.group(1)}-{uri_ym.group(2)}-01"

        if not iso_date:
            continue

        # Check deduplication keys
        key_date_lang = f"{iso_date}_deutsch"
        key_uri = uri.lower()
        if key_date_lang in existing_keys or key_uri in existing_keys:
            continue

        # Check if title or date already closely matched in index
        title_parts = []
        if desc:
            title_parts.append(desc)
        if raw_recip and raw_recip != desc:
            title_parts.append(f"({raw_recip})")
        title = " ".join(title_parts) if title_parts else f"Botschaft vom {raw_date}"

        # Fetch reader page for full text
        reader_url = f"https://bibliothek.bahai.de/pubReader.php?titleLangUri={uri}"
        reader_html = fetch_url(reader_url)
        if not reader_html:
            continue

        # Extract <par> tags
        pars_raw = re.findall(r'<par[^>]*>([\s\S]*?)</par>', reader_html)
        clean_paras = []
        for p in pars_raw:
            p_no_addr = re.sub(r'<address>[^<]*</address>', '', p)
            cleaned = clean_html_text(p_no_addr)
            if cleaned and len(cleaned) > 1:
                clean_paras.append(cleaned)

        if not clean_paras:
            continue

        full_text = "\n\n".join(clean_paras)
        word_count = len(full_text.split())
        year = int(iso_date[:4]) if iso_date[:4].isdigit() else datetime.now().year

        doc_hash = hashlib.sha256(f"de_{iso_date}_{uri}".encode("utf-8")).hexdigest()[:12]
        text_file_path = TEXTS_DIR / f"{doc_hash}.txt"
        TEXTS_DIR.mkdir(parents=True, exist_ok=True)

        with open(text_file_path, "w", encoding="utf-8") as f:
            f.write(full_text)

        # In PDF umwandeln und im Benutzerordner (documents/<year>/) ablegen
        date_dots = iso_date.replace('-', '.')
        safe_t = sanitize_filename(desc or title)
        if len(safe_t) > 60:
            safe_t = safe_t[:60].rstrip(' -')
        pdf_filename = f"{date_dots}-E-UHG-{safe_t}-dtsch.pdf"
        rel_subpath = Path(str(year)) / pdf_filename

        pdf_bytes = generate_pdf(title, iso_date, raw_recip, clean_paras)
        web_file_path = save_document_to_destinations(rel_subpath, pdf_bytes)

        recip_key, recip_label = determine_recipient(raw_recip, title)
        msg_type = determine_message_type(title, raw_date)
        excerpt = create_clean_excerpt(clean_paras)

        doc_entry = {
            "id": doc_hash,
            "title": title,
            "date": iso_date,
            "year": year,
            "source": "bibliothek.bahai.de",
            "type": msg_type,
            "topics": ["Botschaft", msg_type],
            "language": "deutsch",
            "format": "pdf",
            "fileSize": len(pdf_bytes),
            "filePath": web_file_path,
            "originalFilename": pdf_filename,
            "tier": "house",
            "tierName": "Botschaften des Hauses",
            "subTier": None,
            "subTierName": None,
            "hasText": True,
            "recipient": recip_key,
            "recipientLabel": recip_label,
            "keyPassagesCount": max(1, len(clean_paras) // 3),
            "excerpt": excerpt,
            "wordCount": word_count
        }

        existing_docs.append(doc_entry)
        existing_keys.add(key_date_lang)
        existing_keys.add(key_uri)
        existing_keys.add(doc_hash)
        new_count += 1
        print(f"  ✨ Neue Botschaft hinzugefügt [DE]: {iso_date} | {title[:60]}")
        time.sleep(0.1)

    return new_count


def sync_english_reference_library(existing_keys: set, existing_docs: list) -> int:
    """Check bahai.org/library for new UHJ authoritative English messages."""
    print("\n🔍 Überprüfe Bahá'í Reference Library (bahai.org) auf neue Botschaften...")
    url = "https://www.bahai.org/library/authoritative-texts/the-universal-house-of-justice/messages"
    html = fetch_url(url)
    if not html:
        print("  ❌ bahai.org konnte nicht erreicht werden.")
        return 0

    rows = re.findall(r'<tr[^>]*id="([^"]*)"[^>]*>(.*?)</tr>', html, re.DOTALL)
    print(f"  ✓ {len(rows)} Botschaften-Einträge auf bahai.org gefunden.")

    new_count = 0
    for doc_id, r_content in rows:
        tds = re.findall(r'<td[^>]*>(.*?)</td>', r_content, re.DOTALL)
        clean_tds = [clean_html_text(td) for td in tds]

        date_raw = clean_tds[0] if len(clean_tds) > 0 else ""
        recipient = clean_tds[1] if len(clean_tds) > 1 else ""
        subject = clean_tds[2] if len(clean_tds) > 2 else ""

        iso_date = parse_english_id_date(doc_id, date_raw)
        if not iso_date:
            continue

        key_date_lang = f"{iso_date}_english"
        key_doc_id = doc_id.lower()

        if key_date_lang in existing_keys or key_doc_id in existing_keys:
            continue

        # Fetch XHTML content
        xhtml_url = f"https://www.bahai.org/library/authoritative-texts/the-universal-house-of-justice/messages/{doc_id}/{doc_id}.xhtml"
        xhtml = fetch_url(xhtml_url)

        clean_paras = []
        if xhtml and len(xhtml) > 200:
            p_matches = re.findall(r'<p[^>]*>(.*?)</p>', xhtml, re.DOTALL)
            for p in p_matches:
                cp = clean_html_text(p)
                if cp and len(cp) > 5:
                    clean_paras.append(cp)

        if not clean_paras:
            # Fallback to web reader page
            web_url = f"https://www.bahai.org/library/authoritative-texts/the-universal-house-of-justice/messages/{doc_id}/1"
            web_html = fetch_url(web_url)
            if web_html:
                content_match = re.search(r'<div[^>]+class=[\"\'][^\"\']*library-document-content[^\"\']*[\"\'][^>]*>([\s\S]*?)</div>\s*</div>', web_html)
                if content_match:
                    for p in re.findall(r'<p[^>]*>(.*?)</p>', content_match.group(1)):
                        cp = clean_html_text(p)
                        if cp and len(cp) > 5:
                            clean_paras.append(cp)

        if not clean_paras:
            continue

        # Build title
        if subject and recipient:
            title = f"{subject} ({recipient})"
        elif subject:
            title = subject
        elif recipient:
            title = recipient
        else:
            title = date_raw

        full_text = "\n\n".join(clean_paras)
        word_count = len(full_text.split())
        year = int(iso_date[:4]) if iso_date[:4].isdigit() else datetime.now().year

        doc_hash = hashlib.sha256(f"en_{iso_date}_{doc_id}".encode("utf-8")).hexdigest()[:12]
        text_file_path = TEXTS_DIR / f"{doc_hash}.txt"
        TEXTS_DIR.mkdir(parents=True, exist_ok=True)

        with open(text_file_path, "w", encoding="utf-8") as f:
            f.write(full_text)

        # Offizielle PDF von bahai.org herunterladen oder generieren und im Ordner (documents/<year>/) ablegen
        date_dots = iso_date.replace('-', '.')
        safe_t = sanitize_filename(subject or title)
        if len(safe_t) > 60:
            safe_t = safe_t[:60].rstrip(' -')
        pdf_filename = f"{date_dots}-E-UHG-{safe_t}-eng.pdf"
        rel_subpath = Path(str(year)) / pdf_filename

        pdf_url = f"https://www.bahai.org/library/authoritative-texts/the-universal-house-of-justice/messages/{doc_id}/{doc_id}.pdf"
        pdf_bytes = fetch_binary(pdf_url)

        if not pdf_bytes or len(pdf_bytes) < 1000:
            pdf_bytes = generate_pdf(title, iso_date, recipient, clean_paras)

        web_file_path = save_document_to_destinations(rel_subpath, pdf_bytes)

        recip_key, recip_label = determine_recipient(recipient, title)
        msg_type = determine_message_type(title, date_raw)
        excerpt = create_clean_excerpt(clean_paras)

        doc_entry = {
            "id": doc_hash,
            "title": title,
            "date": iso_date,
            "year": year,
            "source": "bahai.org",
            "type": msg_type,
            "topics": ["Messages", msg_type],
            "language": "english",
            "format": "pdf",
            "fileSize": len(pdf_bytes),
            "filePath": web_file_path,
            "originalFilename": pdf_filename,
            "tier": "house",
            "tierName": "Botschaften des Hauses",
            "subTier": None,
            "subTierName": None,
            "hasText": True,
            "recipient": recip_key,
            "recipientLabel": recip_label,
            "keyPassagesCount": max(1, len(clean_paras) // 3),
            "excerpt": excerpt,
            "wordCount": word_count
        }

        existing_docs.append(doc_entry)
        existing_keys.add(key_date_lang)
        existing_keys.add(key_doc_id)
        existing_keys.add(doc_hash)
        new_count += 1
        print(f"  ✨ Neue Botschaft hinzugefügt [EN]: {iso_date} | {title[:60]}")
        time.sleep(0.1)

    return new_count


def main():
    print(f"=== Bahá'í Botschaften-Archiv: Täglicher Synchronisationslauf ===")
    print(f"Zeitpunkt: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Index-Pfad: {INDEX_FILE}")

    if not INDEX_FILE.exists():
        print(f"❌ Fehler: Index-Datei {INDEX_FILE} nicht gefunden!", file=sys.stderr)
        sys.exit(1)

    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        docs = json.load(f)

    print(f"Aktueller Dokumentenbestand: {len(docs)} Einträge")

    # Build index of existing keys to prevent duplicates
    existing_keys = set()
    for d in docs:
        if d.get("id"):
            existing_keys.add(str(d["id"]).lower())
        if d.get("date") and d.get("language"):
            existing_keys.add(f"{d['date']}_{d['language']}".lower())
        if d.get("originalFilename"):
            existing_keys.add(str(d["originalFilename"]).lower())

    added_de = sync_german_bibliothek(existing_keys, docs)
    added_en = sync_english_reference_library(existing_keys, docs)
    total_added = added_de + added_en

    if total_added > 0:
        print(f"\n📦 {total_added} neue Botschaften gefunden ({added_de} DE, {added_en} EN). Aktualisiere Index...")
        # Sort documents: non-dated at bottom, then descending by date
        docs.sort(key=lambda d: d.get("date") or "0000-00-00", reverse=True)

        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False, indent=2)

        print(f"✅ data/index.json erfolgreich aktualisiert. Neuer Gesamtbestand: {len(docs)} Dokumente.")
    else:
        print("\n✅ Keine neuen Botschaften gefunden. Das Archiv ist auf dem neuesten Stand.")

    print(f"=== Synchronisationslauf beendet ===\n")
    return total_added


if __name__ == "__main__":
    main()
