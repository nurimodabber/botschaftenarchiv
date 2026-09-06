import json
import re
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_PATH = BASE_DIR / "botschaftenarchiv" / "data" / "index.json"

print("1. Fetching BRL (Bahai Reference Library) index...")
req_brl = urllib.request.Request(
    'https://www.bahai.org/library/authoritative-texts/the-universal-house-of-justice/messages',
    headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
)
brl_by_date = {}
try:
    with urllib.request.urlopen(req_brl, timeout=20) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        matches = re.findall(r'href=\"(/library/authoritative-texts/the-universal-house-of-justice/messages/(\d{8})_(\d{3})/1)\"', html)
        for path, d8, seq in matches:
            iso = f"{d8[:4]}-{d8[4:6]}-{d8[6:8]}"
            if iso not in brl_by_date:
                brl_by_date[iso] = f"https://www.bahai.org{path}"
    print(f"   -> Loaded {len(brl_by_date)} BRL message dates.")
except Exception as e:
    print("   -> Warning fetching BRL:", e)

print("2. Fetching bibliothek.bahai.de UHJ index...")
req_de = urllib.request.Request(
    'https://bibliothek.bahai.de/pubAuthor.php?authorCode=uhj',
    headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
)
de_by_date = {}
try:
    with urllib.request.urlopen(req_de, timeout=20) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        matches = re.findall(r'pubReader\.php\?titleLangUri=(uhj-(?:muhj|luhj)(\d{8})-de)', html)
        for uri, d8 in matches:
            iso = f"{d8[:4]}-{d8[4:6]}-{d8[6:8]}"
            if iso not in de_by_date:
                de_by_date[iso] = f"https://bibliothek.bahai.de/pubReader.php?titleLangUri={uri}"
    print(f"   -> Loaded {len(de_by_date)} German library message dates.")
except Exception as e:
    print("   -> Warning fetching German library:", e)

# 3. Load documents
with open(INDEX_PATH, 'r', encoding='utf-8') as f:
    docs = json.load(f)

updated_count = 0
for doc in docs:
    d_date = doc.get('date')
    d_lang = (doc.get('language') or '').lower()
    tier = doc.get('tier')
    type_name = doc.get('type')
    current_url = doc.get('sourceUrl') or ''

    # Check German library first for German messages
    if d_lang == 'deutsch' and d_date in de_by_date:
        doc['sourceUrl'] = de_by_date[d_date]
        doc['sourcePlatform'] = 'Bahá’í-Bibliothek Deutschland'
        updated_count += 1
    # Check BRL for English or fallback
    elif d_date in brl_by_date:
        doc['sourceUrl'] = brl_by_date[d_date]
        doc['sourcePlatform'] = 'Bahá’í Reference Library'
        updated_count += 1
    # Ruhi materials
    elif tier == 'ruhi' or 'ruhi' in (doc.get('title') or '').lower():
        title_lower = (doc.get('title') or '').lower()
        if '1' in title_lower:
            doc['sourceUrl'] = 'https://www.ruhi.org/en/materials/reflections-life-spirit/'
        elif '2' in title_lower:
            doc['sourceUrl'] = 'https://www.ruhi.org/en/materials/arising-to-serve/'
        elif '3' in title_lower:
            doc['sourceUrl'] = 'https://www.ruhi.org/en/materials/teaching-childrens-classes/'
        elif '4' in title_lower:
            doc['sourceUrl'] = 'https://www.ruhi.org/en/materials/the-twin-manifestations/'
        else:
            doc['sourceUrl'] = 'https://www.ruhi.org/en/materials/'
        doc['sourcePlatform'] = 'Ruhi Institute Official'
        updated_count += 1
    # Holy Writings
    elif tier == 'books':
        author = (doc.get('author') or '').lower()
        if 'baha' in author:
            doc['sourceUrl'] = 'https://www.bahai.org/library/authoritative-texts/bahaullah/'
            doc['sourcePlatform'] = 'Bahá’í Reference Library'
        elif 'bab' in author:
            doc['sourceUrl'] = 'https://www.bahai.org/library/authoritative-texts/the-bab/'
            doc['sourcePlatform'] = 'Bahá’í Reference Library'
        elif 'abdul' in author or 'abdu' in author:
            doc['sourceUrl'] = 'https://www.bahai.org/library/authoritative-texts/abdul-baha/'
            doc['sourcePlatform'] = 'Bahá’í Reference Library'
        elif 'shoghi' in author:
            doc['sourceUrl'] = 'https://www.bahai.org/library/authoritative-texts/shoghi-effendi/'
            doc['sourcePlatform'] = 'Bahá’í Reference Library'
        else:
            doc['sourceUrl'] = 'https://www.bahai.org/library/authoritative-texts/compilations/'
            doc['sourcePlatform'] = 'Bahá’í Reference Library'
        updated_count += 1
    elif not doc.get('sourcePlatform'):
        if 'bibliothek.bahai.de' in current_url:
            doc['sourcePlatform'] = 'Bahá’í-Bibliothek Deutschland'
        else:
            doc['sourcePlatform'] = 'Bahá’í Reference Library'

print(f"4. Updated {updated_count} documents with specific canonical deep URLs.")

# Save updated index.json
with open(INDEX_PATH, 'w', encoding='utf-8') as f:
    json.dump(docs, f, ensure_ascii=False, indent=2)

print("Done! index.json enriched.")
