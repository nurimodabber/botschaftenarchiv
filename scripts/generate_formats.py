import os
import sys
import json
import html
import zipfile
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, 'data', 'index.json')
TEXTS_DIR = os.path.join(BASE_DIR, 'data', 'texts')
FORMATS_DIR = os.path.join(BASE_DIR, 'documents', 'formats')

PDF_DIR = os.path.join(FORMATS_DIR, 'pdf')
DOCX_DIR = os.path.join(FORMATS_DIR, 'docx')
EPUB_DIR = os.path.join(FORMATS_DIR, 'epub')

os.makedirs(PDF_DIR, exist_ok=True)
os.makedirs(DOCX_DIR, exist_ok=True)
os.makedirs(EPUB_DIR, exist_ok=True)

# Register high quality fonts
HAS_GEORGIA = False
try:
    g_reg = '/System/Library/Fonts/Supplemental/Georgia.ttf'
    g_bold = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
    g_ita = '/System/Library/Fonts/Supplemental/Georgia Italic.ttf'
    if os.path.isfile(g_reg) and os.path.isfile(g_bold):
        pdfmetrics.registerFont(TTFont('Georgia', g_reg))
        pdfmetrics.registerFont(TTFont('Georgia-Bold', g_bold))
        if os.path.isfile(g_ita):
            pdfmetrics.registerFont(TTFont('Georgia-Italic', g_ita))
        HAS_GEORGIA = True
except Exception:
    HAS_GEORGIA = False

FONT_BODY = 'Georgia' if HAS_GEORGIA else 'Helvetica'
FONT_BOLD = 'Georgia-Bold' if HAS_GEORGIA else 'Helvetica-Bold'
FONT_ITA = 'Georgia-Italic' if HAS_GEORGIA else 'Helvetica-Oblique'

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont(FONT_ITA, 8)
        self.setFillColor(colors.HexColor('#64748b'))
        # Running header on pages 2+
        if self._pageNumber > 1:
            title_snippet = getattr(self, '_doc_title_snippet', "Bahá'í-Archiv")
            self.drawString(54, 842 - 36, title_snippet)
            self.setStrokeColor(colors.HexColor('#e2e8f0'))
            self.setLineWidth(0.5)
            self.line(54, 842 - 42, 595 - 54, 842 - 42)
        # Running footer on all pages
        self.setStrokeColor(colors.HexColor('#e2e8f0'))
        self.setLineWidth(0.5)
        self.line(54, 45, 595 - 54, 45)
        page_text = f"Seite {self._pageNumber} von {page_count}"
        self.drawRightString(595 - 54, 32, page_text)
        self.drawString(54, 32, "Offizielles Bahá'í-Archiv • botschaften-haus.de")
        self.restoreState()

def clean_xml(text):
    if not text:
        return ""
    # Strip control chars
    clean = "".join(ch for ch in text if ch in ('\n', '\r', '\t') or ord(ch) >= 32)
    return html.escape(clean)

def generate_pdf(doc, paragraphs, output_path):
    title = doc.get('title', '')
    title_short = (title[:55] + '...') if len(title) > 58 else title
    
    class CustomCanvas(NumberedCanvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._doc_title_snippet = title_short

    pdf_doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    styles = getSampleStyleSheet()

    eyebrow_style = ParagraphStyle(
        'Eyebrow',
        parent=styles['Normal'],
        fontName=FONT_BOLD,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#c89d5c'),
        spaceAfter=4
    )
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName=FONT_BOLD,
        fontSize=17,
        leading=22,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=6
    )
    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName=FONT_ITA,
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=10
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName=FONT_BODY,
        fontSize=10,
        leading=15,
        alignment=4,  # Justified
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=8
    )

    institution = doc.get('sourcePlatform') or doc.get('source') or 'Universales Haus der Gerechtigkeit'
    eyebrow_text = clean_xml(str(institution).upper())

    date_str = doc.get('date', '')
    recipient_str = doc.get('recipientLabel') or doc.get('recipient') or ''
    meta_parts = [p for p in [date_str, doc.get('source', ''), recipient_str] if p]
    meta_text = clean_xml(' • '.join(meta_parts))

    story = [
        Paragraph(eyebrow_text, eyebrow_style),
        Paragraph(clean_xml(title), title_style),
        Paragraph(meta_text, meta_style),
        HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#c89d5c'), spaceAfter=14)
    ]

    for p in paragraphs:
        story.append(Paragraph(clean_xml(p), body_style))

    pdf_doc.build(story, canvasmaker=CustomCanvas)

def generate_docx(doc, paragraphs, output_path):
    d = docx.Document()
    for sec in d.sections:
        sec.top_margin = Inches(1)
        sec.bottom_margin = Inches(1)
        sec.left_margin = Inches(1)
        sec.right_margin = Inches(1)

    h = d.add_heading(doc.get('title', ''), level=1)
    if h.runs:
        h.runs[0].font.name = 'Georgia'
        h.runs[0].font.size = Pt(18)
        h.runs[0].font.color.rgb = RGBColor(0x0f, 0x17, 0x2a)

    meta_p = d.add_paragraph()
    meta_p.paragraph_format.space_after = Pt(12)
    date_str = doc.get('date', '')
    recipient_str = doc.get('recipientLabel') or doc.get('recipient') or ''
    meta_parts = [p for p in [date_str, doc.get('source', ''), recipient_str] if p]
    run_meta = meta_p.add_run(' • '.join(meta_parts))
    run_meta.font.name = 'Georgia'
    run_meta.font.italic = True
    run_meta.font.size = Pt(10)
    run_meta.font.color.rgb = RGBColor(0x64, 0x74, 0x8b)

    for p in paragraphs:
        clean_p = "".join(ch for ch in p if ch in ('\n', '\r', '\t') or ord(ch) >= 32)
        p_elem = d.add_paragraph(clean_p)
        p_elem.paragraph_format.line_spacing = 1.15
        p_elem.paragraph_format.space_after = Pt(6)
        p_elem.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    if doc.get('sourceUrl'):
        src_p = d.add_paragraph()
        src_p.paragraph_format.space_before = Pt(18)
        run_src = src_p.add_run("Offizielle Referenz: " + doc['sourceUrl'])
        run_src.font.size = Pt(8.5)
        run_src.font.italic = True
        run_src.font.color.rgb = RGBColor(0x94, 0xa3, 0xb8)

    d.save(output_path)

def generate_epub(doc, paragraphs, output_path):
    doc_id = doc.get('id', 'doc')
    title = clean_xml(doc.get('title', ''))
    source = clean_xml(str(doc.get('source') or "Bahá'í-Weltzentrum"))
    date_val = doc.get('date', '2026-01-01')
    lang = 'en' if doc.get('language') == 'english' else 'de'

    container_xml = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""

    content_opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{title}</dc:title>
    <dc:creator>{source}</dc:creator>
    <dc:identifier id="BookId">urn:uuid:{doc_id}</dc:identifier>
    <dc:language>{lang}</dc:language>
    <dc:date>{date_val}</dc:date>
    <meta property="dcterms:modified">2026-09-07T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="content"/>
  </spine>
</package>"""

    nav_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{lang}">
<head><title>{title}</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Inhaltsverzeichnis</h1>
    <ol><li><a href="content.xhtml">{title}</a></li></ol>
  </nav>
</body>
</html>"""

    toc_ncx = f"""<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:{doc_id}"/></head>
  <docTitle><text>{title}</text></docTitle>
  <navMap>
    <navPoint id="np-1" playOrder="1">
      <navLabel><text>{title}</text></navLabel>
      <content src="content.xhtml"/>
    </navPoint>
  </navMap>
</ncx>"""

    css = """body {
    font-family: Georgia, "Times New Roman", serif;
    margin: 5% 8%;
    line-height: 1.6;
    color: #111827;
    text-align: justify;
}
.eyebrow {
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #c89d5c;
    margin-bottom: 0.4em;
    font-weight: bold;
}
h1 {
    font-size: 1.8em;
    line-height: 1.25;
    color: #0f172a;
    margin-top: 0;
    margin-bottom: 0.3em;
}
.meta {
    font-size: 0.9em;
    color: #64748b;
    font-style: italic;
    margin-bottom: 1.5em;
    border-bottom: 1.5px solid #c89d5c;
    padding-bottom: 0.8em;
}
p {
    margin-top: 0;
    margin-bottom: 0.9em;
    text-indent: 1.2em;
}
p.first-p {
    text-indent: 0;
}
.footer-note {
    margin-top: 3em;
    border-top: 1px solid #e2e8f0;
    padding-top: 1em;
    font-size: 0.8em;
    color: #94a3b8;
    font-style: italic;
}"""

    p_elems = []
    for i, p in enumerate(paragraphs):
        cls = ' class="first-p"' if i == 0 else ''
        p_elems.append(f'<p{cls}>{clean_xml(p)}</p>')
    p_html = '\n'.join(p_elems)

    recipient_str = doc.get('recipientLabel') or doc.get('recipient') or ''
    meta_parts = [p for p in [doc.get('date', ''), doc.get('source', ''), recipient_str] if p]
    meta_text = clean_xml(' • '.join(meta_parts))

    source_url_p = ''
    if doc.get('sourceUrl'):
        source_url_p = f'<p class="footer-note">Offizielle Referenz: {clean_xml(doc["sourceUrl"])}</p>'

    content_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="{lang}">
<head>
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="eyebrow">{source.upper()}</div>
  <h1>{title}</h1>
  <div class="meta">{meta_text}</div>
  <div class="content">
    {p_html}
  </div>
  {source_url_p}
</body>
</html>"""

    with zipfile.ZipFile(output_path, 'w') as zf:
        zf.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        zf.writestr('META-INF/container.xml', container_xml, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr('OEBPS/content.opf', content_opf, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr('OEBPS/nav.xhtml', nav_xhtml, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr('OEBPS/toc.ncx', toc_ncx, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr('OEBPS/style.css', css, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr('OEBPS/content.xhtml', content_xhtml, compress_type=zipfile.ZIP_DEFLATED)

def process_single_doc(doc):
    doc_id = doc['id']
    txt_path = os.path.join(TEXTS_DIR, f"{doc_id}.txt")
    if not os.path.isfile(txt_path):
        return doc_id, False, f"Text file not found: {txt_path}"

    try:
        with open(txt_path, 'r', encoding='utf-8', errors='ignore') as f:
            raw_text = f.read().strip()

        paragraphs = [p.strip() for p in raw_text.split('\n\n') if p.strip()]
        if not paragraphs:
            paragraphs = [p.strip() for p in raw_text.split('\n') if p.strip()]
        if not paragraphs:
            paragraphs = [doc.get('title', 'Dokument ohne Textinhalt.')]

        format_files = dict(doc.get('formatFiles') or {})
        available_fmts = set(doc.get('availableFormats') or [])

        # Ensure TXT
        format_files['txt'] = f"data/texts/{doc_id}.txt"
        available_fmts.add('txt')

        # 1. PDF
        pdf_rel = format_files.get('pdf')
        needs_pdf = not pdf_rel or not os.path.isfile(os.path.join(BASE_DIR, pdf_rel))
        if needs_pdf:
            target_pdf = os.path.join(PDF_DIR, f"{doc_id}.pdf")
            if not os.path.isfile(target_pdf) or os.path.getsize(target_pdf) == 0:
                generate_pdf(doc, paragraphs, target_pdf)
            format_files['pdf'] = f"documents/formats/pdf/{doc_id}.pdf"
        available_fmts.add('pdf')

        # 2. DOCX
        docx_rel = format_files.get('docx')
        needs_docx = not docx_rel or not os.path.isfile(os.path.join(BASE_DIR, docx_rel))
        if needs_docx:
            target_docx = os.path.join(DOCX_DIR, f"{doc_id}.docx")
            if not os.path.isfile(target_docx) or os.path.getsize(target_docx) == 0:
                generate_docx(doc, paragraphs, target_docx)
            format_files['docx'] = f"documents/formats/docx/{doc_id}.docx"
        available_fmts.add('docx')

        # 3. EPUB
        epub_rel = format_files.get('epub')
        needs_epub = not epub_rel or not os.path.isfile(os.path.join(BASE_DIR, epub_rel))
        if needs_epub:
            target_epub = os.path.join(EPUB_DIR, f"{doc_id}.epub")
            if not os.path.isfile(target_epub) or os.path.getsize(target_epub) == 0:
                generate_epub(doc, paragraphs, target_epub)
            format_files['epub'] = f"documents/formats/epub/{doc_id}.epub"
        available_fmts.add('epub')

        canonical_order = ['pdf', 'docx', 'epub', 'txt']
        ordered_fmts = [f for f in canonical_order if f in available_fmts]
        for f in available_fmts:
            if f not in ordered_fmts:
                ordered_fmts.append(f)

        return doc_id, True, (format_files, ordered_fmts)
    except Exception as e:
        return doc_id, False, f"{str(e)}\n{traceback.format_exc()}"

def main():
    print("Starting format generation...")
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        docs = json.load(f)

    print(f"Loaded {len(docs)} documents.")

    success_count = 0
    error_count = 0
    doc_updates = {}

    workers = min(os.cpu_count() or 4, 8)
    print(f"Using {workers} worker processes.")

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_single_doc, doc): doc['id'] for doc in docs}
        done = 0
        total = len(futures)
        for future in as_completed(futures):
            doc_id, ok, res = future.result()
            done += 1
            if ok:
                format_files, ordered_fmts = res
                doc_updates[doc_id] = (format_files, ordered_fmts)
                success_count += 1
            else:
                print(f"Error on {doc_id}: {res}")
                error_count += 1

            if done % 200 == 0 or done == total:
                print(f"Progress: {done}/{total} ({done*100/total:.1f}%) | Success: {success_count}, Errors: {error_count}")

    print("Updating index.json with new format metadata...")
    for doc in docs:
        doc_id = doc['id']
        if doc_id in doc_updates:
            ff, af = doc_updates[doc_id]
            doc['formatFiles'] = ff
            doc['availableFormats'] = af

    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

    print(f"Finished! Successfully updated all {success_count} documents. Errors: {error_count}")

if __name__ == '__main__':
    main()
