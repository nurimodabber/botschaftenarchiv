#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_search_index.py
Erstellt die vollstaendige Volltext-Suchindex-Datei data/search_texts.json
fuer saemtliche 1.059 Dokumente (Botschaften, Buecher, Kompilationen, Ruhi-Kurse).
"""

import os
import json
import re

def build_search_index():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    docs_path = os.path.join(base_dir, "data", "index.json")
    texts_dir = os.path.join(base_dir, "data", "texts")
    out_path = os.path.join(base_dir, "data", "search_texts.json")

    if not os.path.exists(docs_path):
        print(f"Fehler: {docs_path} nicht gefunden.")
        return

    with open(docs_path, "r", encoding="utf-8") as f:
        docs = json.load(f)

    search_index = {}
    matched = 0
    missing = 0

    for d in docs:
        doc_id = d.get("id")
        if not doc_id:
            continue
        txt_path = os.path.join(texts_dir, f"{doc_id}.txt")
        if os.path.exists(txt_path):
            with open(txt_path, "r", encoding="utf-8", errors="ignore") as tf:
                content = tf.read()
                # Leerzeichen normalisieren
                content = re.sub(r"\s+", " ", content).strip()
                search_index[doc_id] = content
                matched += 1
        else:
            # Fallback auf Auszug oder Titel falls keine separate Textdatei vorliegt
            fallback = (d.get("title", "") + " " + d.get("excerpt", "")).strip()
            if fallback:
                search_index[doc_id] = fallback
            missing += 1

    with open(out_path, "w", encoding="utf-8") as out:
        json.dump(search_index, out, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Volltext-Suchindex erfolgreich erstellt: {out_path}")
    print(f"  Erfasste Dokumente: {matched} vollstaendige Texte, {missing} Fallbacks")
    print(f"  Dateigroesse: {size_mb:.2f} MB")

if __name__ == "__main__":
    build_search_index()
