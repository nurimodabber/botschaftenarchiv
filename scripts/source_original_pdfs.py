#!/usr/bin/env python3
"""
Source original PDFs, EPUBs, and DOCX documents for all books in data/index.json.
Scrapes direct PDF download links from bahai-library.com, validates existence,
and updates formatFiles and availableFormats across both workspaces.
"""

import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse

WORKSPACE_INDEX = "/Users/nurimilanmodabber/Library/CloudStorage/OneDrive-Personal/Baha'i/Botschaften Haus Antigravity/data/index.json"
REPO_INDEX = "/Users/nurimilanmodabber/Library/CloudStorage/OneDrive-Personal/Antigravity/botschaftenarchiv/data/index.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def extract_slug(url):
    if not url:
        return ''
    path = urlparse(url).path.strip('/')
    parts = path.split('/')
    return parts[-1] if parts else ''

def score_pdf_candidate(pdf_url, slug, doc_title, doc_lang):
    score = 100
    pdf_lower = pdf_url.lower()
    pdf_filename = pdf_lower.split('/')[-1]
    
    # Preferred host
    if 'bahai-library.com/pdf/' in pdf_lower:
        score += 35
    
    # Direct match or containment of slug
    clean_slug = slug.lower().replace('-', '_')
    if clean_slug in pdf_filename:
        score += 50
    else:
        tokens = [t for t in clean_slug.split('_') if len(t) > 3]
        match_count = sum(1 for t in tokens if t in pdf_filename)
        score += match_count * 10
        
    # Heavy penalties for fragments / auxiliary sections
    if '_index.pdf' in pdf_filename or '_idx.pdf' in pdf_filename:
        score -= 55
    if '_contents.pdf' in pdf_filename or '_toc.pdf' in pdf_filename:
        score -= 55
    if '_appendix.pdf' in pdf_filename or '_appendices.pdf' in pdf_filename:
        score -= 55
    if '_excerpt.pdf' in pdf_filename or '_extract.pdf' in pdf_filename:
        score -= 45
    if re.search(r'_ch\d+\.pdf', pdf_filename) or re.search(r'_part\d+\.pdf', pdf_filename):
        score -= 45
    if '_editorial.pdf' in pdf_filename or '_review.pdf' in pdf_filename:
        score -= 40
    if '_notes.pdf' in pdf_filename:
        score -= 30
        
    # Language filtering
    if doc_lang.lower() == 'english':
        if any(w in pdf_filename for w in ['_espanol', '_nueva-york', '_spanish', '_persian', '_farsi', '_arabic', '_french']):
            score -= 60
    elif doc_lang.lower() == 'german':
        if any(w in pdf_filename for w in ['_espanol', '_spanish', '_persian', '_farsi', '_arabic', '_french']):
            score -= 60
            
    # Published vs scan preference
    if '_published.pdf' in pdf_filename:
        score += 15
    elif '_scan.pdf' in pdf_filename:
        score += 5
        
    return score

def fetch_bahai_library_formats(doc):
    url = doc.get('sourceUrl')
    if not url:
        return doc['id'], None
    slug = extract_slug(url)
    doc_title = doc.get('title', '')
    doc_lang = doc.get('language', 'English')
    
    found_pdfs = []
    found_epubs = []
    found_docx = []
    
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            
            raw_links = re.findall(r'(?:href|data|src)=[\"\']([^\"\']+)[\"\']', html, re.I)
            for link in raw_links:
                clean_link = link.split('#')[0].split('?')[0].strip()
                full_url = urljoin(url, clean_link)
                clean_lower = clean_link.lower()
                if clean_lower.endswith('.pdf'):
                    found_pdfs.append(full_url)
                elif clean_lower.endswith('.epub'):
                    found_epubs.append(full_url)
                elif clean_lower.endswith(('.docx', '.doc')):
                    found_docx.append(full_url)
    except Exception:
        pass
        
    found_pdfs = list(dict.fromkeys(found_pdfs))
    found_epubs = list(dict.fromkeys(found_epubs))
    found_docx = list(dict.fromkeys(found_docx))
    
    # Fallback: check direct /pdf/{initial}/{slug}.pdf if no PDF linked in HTML
    if not found_pdfs and slug:
        initial = slug[0].lower() if slug else 'a'
        candidates = [
            f'https://bahai-library.com/pdf/{initial}/{slug}.pdf',
        ]
        if '_' in slug:
            sub_slug = '_'.join(slug.split('_')[1:])
            candidates.append(f'https://bahai-library.com/pdf/{initial}/{sub_slug}.pdf')
            
        for cand in candidates:
            try:
                head_req = urllib.request.Request(cand, headers=HEADERS, method='HEAD')
                with urllib.request.urlopen(head_req, timeout=5) as head_resp:
                    if head_resp.status == 200:
                        found_pdfs.append(cand)
                        break
            except Exception:
                pass
                
    best_pdf = None
    if found_pdfs:
        scored = [(p, score_pdf_candidate(p, slug, doc_title, doc_lang)) for p in found_pdfs]
        scored.sort(key=lambda x: x[1], reverse=True)
        best_pdf = scored[0][0]
        
    return doc['id'], {
        'best_pdf': best_pdf,
        'all_pdfs': found_pdfs,
        'epub': found_epubs[0] if found_epubs else None,
        'docx': found_docx[0] if found_docx else None
    }

def main():
    path_to_load = REPO_INDEX if os.path.exists(REPO_INDEX) else WORKSPACE_INDEX
    print(f"Loading {path_to_load}...")
    with open(path_to_load, 'r', encoding='utf-8') as f:
        docs = json.load(f)
        
    print(f"Total documents: {len(docs)}")
    
    # Known canonical overrides for UHJ statements & special works
    special_overrides = {
        'book_uhj_one_common_faith_eng': {
            'pdf': 'https://bahai-library.com/pdf/u/uhj_one_common_faith.pdf'
        },
        'book_uhj_century_of_light_eng': {
            'pdf': 'https://bahai-library.com/pdf/uhj/uhj_century_light_ebook.pdf',
            'docx': 'https://bahai-library.com/docs/u/uhj_century_light_thomas.docx'
        },
        'book_de_uhj_col_de': {
            'pdf': 'https://bahai-library.com/pdf/u/uhj_jahrhundert_lichts.pdf'
        }
    }
    
    # 1. Apply local document fixes (16 documents with filePath pointing to local PDF)
    local_pdf_count = 0
    for doc in docs:
        doc_id = doc.get('id')
        if doc_id in special_overrides:
            doc.setdefault('formatFiles', {})
            for fmt, url in special_overrides[doc_id].items():
                doc['formatFiles'][fmt] = url
            af = set(doc.get('availableFormats', []))
            af.update(special_overrides[doc_id].keys())
            doc['availableFormats'] = list(af)
            continue
            
        fp = doc.get('filePath')
        if fp and fp.lower().endswith('.pdf'):
            clean_fp = fp.replace('../', '')
            doc.setdefault('formatFiles', {})
            if not doc['formatFiles'].get('pdf'):
                doc['formatFiles']['pdf'] = clean_fp
                local_pdf_count += 1
            af = set(doc.get('availableFormats', []))
            af.add('pdf')
            doc['availableFormats'] = list(af)
            
    print(f"Updated {local_pdf_count} local documents with explicit formatFiles.pdf.")
    
    # 2. Collect bahai-library.com documents
    bahai_lib_docs = [
        d for d in docs
        if 'bahai-library.com' in d.get('sourceUrl', '') or d.get('source') == 'bahai-library.com'
    ]
    print(f"Found {len(bahai_lib_docs)} documents from bahai-library.com to process.")
    
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=25) as executor:
        results = dict(executor.map(fetch_bahai_library_formats, bahai_lib_docs))
    elapsed = time.time() - start_time
    print(f"Fetched all {len(bahai_lib_docs)} books from bahai-library in {elapsed:.1f}s.")
    
    # 3. Apply results
    sourced_pdfs = 0
    sourced_epubs = 0
    sourced_docx = 0
    
    for doc in docs:
        doc_id = doc.get('id')
        if doc_id in results and results[doc_id]:
            res = results[doc_id]
            doc.setdefault('formatFiles', {})
            af = set(doc.get('availableFormats', []))
            
            if res.get('best_pdf'):
                doc['formatFiles']['pdf'] = res['best_pdf']
                af.add('pdf')
                sourced_pdfs += 1
            if res.get('epub'):
                doc['formatFiles']['epub'] = res['epub']
                af.add('epub')
                sourced_epubs += 1
            if res.get('docx'):
                doc['formatFiles']['docx'] = res['docx']
                af.add('docx')
                sourced_docx += 1
                
            doc['availableFormats'] = list(af)
            
    print(f"\nSourcing Summary for bahai-library:")
    print(f"  - PDFs sourced: {sourced_pdfs} / {len(bahai_lib_docs)} ({sourced_pdfs / len(bahai_lib_docs) * 100:.1f}%)")
    print(f"  - EPUBs sourced: {sourced_epubs}")
    print(f"  - DOCX sourced: {sourced_docx}")
    
    # Overall statistics
    total_with_pdf = sum(1 for d in docs if d.get('formatFiles', {}).get('pdf'))
    total_with_epub = sum(1 for d in docs if d.get('formatFiles', {}).get('epub'))
    total_with_docx = sum(1 for d in docs if d.get('formatFiles', {}).get('docx'))
    print(f"\nOverall Database Statistics ({len(docs)} total docs):")
    print(f"  - Documents with PDF: {total_with_pdf} ({total_with_pdf / len(docs) * 100:.1f}%)")
    print(f"  - Documents with EPUB: {total_with_epub}")
    print(f"  - Documents with DOCX: {total_with_docx}")
    
    # Write to both locations
    for target in [REPO_INDEX, WORKSPACE_INDEX]:
        if os.path.exists(os.path.dirname(target)):
            print(f"Writing updated index to {target}...")
            with open(target, 'w', encoding='utf-8') as f:
                json.dump(docs, f, ensure_ascii=False, indent=2)
            print(f"Successfully wrote {target}")

if __name__ == '__main__':
    main()
