#!/usr/bin/env python3
"""
enrich_translations.py
Vollautomatische Deduplizierung und zweisprachige Verknuepfung fuer das Bahai-Botschaftenarchiv.

Aufgaben:
1. Gleiche Dokumente in derselben Sprache zusammenfuehren (Deduplizierung)
   - PDFs aus Buecher- und Jahresordnern mit DOCX der Online-Scrapes vereinen
   - Alle verfuegbaren Formate (pdf, docx, epub, txt) in formatFiles konsolidieren
   - Bevorzugung authentischer Original-PDFs des Bahai-Verlags fuer Anzeige und Download
2. Zuverlaessige groupId-Vergabe ueber alle Dokumentkategorien
   - Jaehrliche Ridvan-Botschaften (z.B. msg-ridvan-2026, gleicht 20. und 21. April ab)
   - Jaehrliche Naw-Ruz-Botschaften (z.B. msg-nawruz-YYYY)
   - Historische Schluesseldokumente (Friedensbotschaft 1985, Religionsfuehrer 2002, etc.)
   - Botschaften des Universalen Hauses & Institutionen nach Datum & Thema
   - Schriften, Buecher, Ruhi-Institut und Kompilationen
3. Zweisprachige Verknuepfung:
   - groupId buendelt deutsche und englische Fassung
   - translations: { de: id_de, en: id_en }
   - availableLanguages: ['de', 'en']
   - deTitle & enTitle fuer zweisprachige Kartenanzeige
4. ID-Alias-Mapping (data/id_aliases.json) fuer nahtlose Rueckwaertskompatibilitaet
5. Synchronisation nach botschaftenarchiv/ und website/
"""

import json
import re
import os
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
INDEX_PATH = DATA_DIR / "index.json"
ALIAS_PATH = DATA_DIR / "id_aliases.json"

WEBSITE_DIR = BASE_DIR.parent / "website"
WEBSITE_DATA_DIR = WEBSITE_DIR / "data"
WEBSITE_INDEX_PATH = WEBSITE_DATA_DIR / "index.json"
WEBSITE_ALIAS_PATH = WEBSITE_DATA_DIR / "id_aliases.json"

def norm_text(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s.lower())).strip()

def extract_year(date_str, title_str=""):
    m = re.search(r"\b(19\d\d|20\d\d)\b", (date_str or "") + " " + (title_str or ""))
    return m.group(1) if m else None

def extract_ridvan_year(d):
    t = (d.get("title") or "").lower()
    typ = (d.get("type") or "").lower()
    path = (d.get("filePath") or "").lower()
    if "ridvan" in t or "riḍván" in t or "ridvan" in typ or "riḍván" in typ or "ridvan" in path or "riḍván" in path:
        return extract_year(d.get("date"), d.get("title"))
    date = d.get("date") or ""
    if date.endswith("-04-21") or date.endswith("-04-20"):
        if "world" in t or "welt" in t or d.get("recipient") == "world" or not d.get("recipient"):
            return extract_year(date, d.get("title"))
    return None

def extract_nawruz_year(d):
    t = (d.get("title") or "").lower()
    if "naw-ruz" in t or "naw-rúz" in t or "nawruz" in t:
        return extract_year(d.get("date"), d.get("title"))
    return None

def score_doc(d):
    s = 0
    doc_id = d.get("id", "")
    if not doc_id.startswith("book_"):
        s += 100
    if d.get("format") == "docx" or (d.get("filePath") or "").endswith(".docx"):
        s += 50
    if d.get("hasText") or (d.get("text") and len(d.get("text", "")) > 100):
        s += 30
    if len(d.get("title") or "") > 15:
        s += 10
    t_lower = (d.get("title") or "").lower()
    if "ridvan" in t_lower or "riḍván" in t_lower or "naw-ruz" in t_lower or "naw-rúz" in t_lower:
        s += 40
    return s

def merge_group(glist, alias_map):
    if len(glist) == 1:
        return glist[0]
    sorted_g = sorted(glist, key=score_doc, reverse=True)
    canonical = sorted_g[0]
    all_formats = set(canonical.get("availableFormats") or [])
    all_files = dict(canonical.get("formatFiles") or {})

    # Falls Geschwisterdokumente spezifischere Typen oder Titel haben:
    for item in sorted_g[1:]:
        alias_map[item["id"]] = canonical["id"]
        for fmt in item.get("availableFormats") or []:
            all_formats.add(fmt)
        for fmt, path in (item.get("formatFiles") or {}).items():
            if fmt not in all_files or not all_files[fmt]:
                all_files[fmt] = path
            elif fmt == "pdf" and ("documents/Buecher/" in path or "documents/202" in path):
                all_files["pdf"] = path
        if not canonical.get("text") and item.get("text"):
            canonical["text"] = item["text"]
            canonical["hasText"] = True

    canonical["formatFiles"] = all_files
    canonical["availableFormats"] = sorted(list(all_formats))
    return canonical

def main():
    print("Starte Anreicherung und Deduplizierung...")
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        docs = json.load(f)
    print(f"Ausgangsbestand: {len(docs)} Dokumente.")

    # 1. Deduplizierung gleicher Dokumente nach (sourceUrl, language)
    by_url_lang = defaultdict(list)
    no_url = []
    alias_map = {}

    for d in docs:
        url = d.get("sourceUrl")
        lang = (d.get("language") or "deutsch").lower()
        if url:
            by_url_lang[(url, lang)].append(d)
        else:
            no_url.append(d)

    step_a_docs = []
    for (url, lang), glist in by_url_lang.items():
        step_a_docs.append(merge_group(glist, alias_map))
    step_a_docs.extend(no_url)

    print(f"Schritt 1 abgeschlossen: {len(step_a_docs)} Dokumente nach URL-Deduplizierung.")

    # Alte groupIds zuruecksetzen, um saubere Neuzuordnung zu gewaehrleisten
    for d in step_a_docs:
        d.pop("groupId", None)

    # 2. Zuordnung kanonischer groupIds
    for d in step_a_docs:
        d_title = norm_text(d.get("title") or "")
        d_date = d.get("date") or ""
        d_tier = d.get("tier") or ""

        # Ruhi-Institut
        if d_tier == "ruhi" or (d.get("title") and d["title"].lower().startswith("ruhi")):
            branch_match = re.search(r"Zweigkurs\s*0?(\d+)", d.get("title") or "", re.I)
            num_match = re.search(r"(?:Buch|Book)\s*0?(\d+(?:\.\d+)?)", d.get("title") or "", re.I)
            if branch_match:
                d["groupId"] = "ruhi-book-3-branch-" + branch_match.group(1)
            elif num_match:
                d["groupId"] = "ruhi-book-" + num_match.group(1)
            else:
                d["groupId"] = "ruhi-" + d["id"]
            continue

        # Kompilationen
        if d_tier == "compilations" or d.get("type") == "Kompilation" or d.get("source") == "Forschungsabteilung":
            key = d.get("compilationTopic") or re.sub(r"\s*\([^)]*\)$", "", d.get("title") or "").strip()
            d["groupId"] = "comp-" + norm_text(key)[:30].replace(" ", "-")
            continue

        # Heilige Schriften & Buecher (ausser UHJ-Botschaften-Scrapes)
        if d_tier == "books" and not d.get("id", "").startswith("book_universales_haus_der_gerechtigkeit"):
            t = re.sub(r"^(the|die|der|das|ein|eine)\s+", "", d_title)
            if "iqan" in t or "íqán" in t: d["groupId"] = "book-iqan"
            elif "aqdas" in t: d["groupId"] = "book-aqdas"
            elif "hidden words" in t or "verborgenen worte" in t: d["groupId"] = "book-hidden-words"
            elif "gleanings" in t or "ährenlese" in t: d["groupId"] = "book-gleanings"
            elif "son of the wolf" in t or "sohn des wolfes" in t: d["groupId"] = "book-son-of-wolf"
            elif "paris talks" in t or "ansprachen in paris" in t: d["groupId"] = "book-paris-talks"
            elif "some answered questions" in t or "beantwortete fragen" in t: d["groupId"] = "book-some-answered-questions"
            elif "god passes by" in t or "gott geht vorüber" in t: d["groupId"] = "book-god-passes-by"
            elif "secret divine civilization" in t or "geheimnis göttlicher kultur" in t: d["groupId"] = "book-secret-civilization"
            elif "tablets divine plan" in t or "göttlichen plan" in t or "göttlichen heilsplan" in t: d["groupId"] = "book-divine-plan"
            elif "world order" in t or "weltordnung" in t: d["groupId"] = "book-world-order"
            elif "advent divine justice" in t or "kommen göttlicher gerechtigkeit" in t: d["groupId"] = "book-advent-justice"
            elif "promised day" in t or "verheißene tag" in t: d["groupId"] = "book-promised-day"
            elif "prayers and meditations" in t or "gebete und meditationen" in t: d["groupId"] = "book-prayers-meditations"
            elif "seven valleys" in t or "sieben täler" in t: d["groupId"] = "book-seven-valleys"
            elif "gems of divine" in t or "edelsteine göttlicher" in t: d["groupId"] = "book-gems"
            elif "summons" in t or "ruf des herrn" in t: d["groupId"] = "book-summons"
            elif "days of remembrance" in t or "tage des gedenkens" in t: d["groupId"] = "book-days-remembrance"
            elif "tabernacle of unity" in t or "zelt der einheit" in t: d["groupId"] = "book-tabernacle"
            elif "call of the divine" in t or "ruf des göttlichen" in t: d["groupId"] = "book-call-beloved"
            elif "memorials faithful" in t or "vorbilder der treue" in t: d["groupId"] = "book-memorials-faithful"
            elif "will and testament" in t or "wille und testament" in t: d["groupId"] = "book-will-testament"
            elif "citadel faith" in t or "feste des glaubens" in t: d["groupId"] = "book-citadel-faith"
            elif "bahai administration" in t or "bahá’í verwaltung" in t or "bahai verwaltung" in t: d["groupId"] = "book-bahai-admin"
            elif "promulgation universal peace" in t or "verkündigung des weltfriedens" in t: d["groupId"] = "book-promulgation"
            elif "light of the world" in t or "licht der welt" in t: d["groupId"] = "book-light-world"
            elif "selections" in t and ("bab" in t or "báb" in t): d["groupId"] = "book-selections-bab"
            elif "selections" in t and ("abdul" in t or "‘abdu" in t): d["groupId"] = "book-selections-abdul-baha"
            elif "auguste forel" in t: d["groupId"] = "book-tablet-auguste-forel"
            else:
                auth = re.sub(r"[^a-z0-9]", "", (d.get("author") or "book").lower())
                d["groupId"] = "book-" + auth + "-" + t[:25].replace(" ", "-")
            continue

        # Historische Schluesseldokumente des Universalen Hauses der Gerechtigkeit
        if "verheißung des weltfriedens" in d_title or "promise of world peace" in d_title or "friedensbotschaft" in d_title:
            d["groupId"] = "msg-peace-statement-1985"
            continue
        if "religionsgemeinschaften" in d_title or "religious leaders" in d_title or "mwrl" in d.get("sourceUrl", ""):
            d["groupId"] = "msg-religious-leaders-2002"
            continue
        if "jahrhundert des lichts" in d_title or "century of light" in d_title:
            d["groupId"] = "msg-century-of-light-2001"
            continue
        if "wohlfahrt der menschheit" in d_title or "prosperity of humankind" in d_title:
            d["groupId"] = "msg-prosperity-humankind-1995"
            continue
        if "gemeinsamer glaube" in d_title or "common faith" in d_title or "uhj-ocf-de" in d.get("sourceUrl", ""):
            d["groupId"] = "msg-one-common-faith-2005"
            continue
        if ("2021-11" in d_date) and ("ascension" in d_title or "hinscheiden" in d_title or "huldigung" in d_title or "tribute" in d_title or "rfcfa" in d.get("sourceUrl", "")):
            d["groupId"] = "msg-2021-11-27-ascension-abdul-baha"
            continue
        if ("2017" in d_date) and ("oktober 2017" in d_title or "glory of god" in d_title or "bicentenary" in d_title or "200 jahrestag" in d_title):
            d["groupId"] = "msg-bicentenary-bahaullah-2017"
            continue
        if ("2019" in d_date) and ("oktober 2019" in d_title or "bicentenary" in d_title or "200 jahrestag" in d_title):
            d["groupId"] = "msg-bicentenary-bab-2019"
            continue

        # Jaehrliche Ridvan-Botschaften
        ry = extract_ridvan_year(d)
        if ry:
            sub = ""
            if "europa" in d_title or "europe" in d_title: sub = "-europe"
            elif "deutschland" in d_title or "germany" in d_title: sub = "-germany"
            d["groupId"] = f"msg-ridvan-{ry}{sub}"
            continue

        # Jaehrliche Naw-Ruz-Botschaften
        ny = extract_nawruz_year(d)
        if ny:
            sub = ""
            if "iran" in d_title: sub = "-iran"
            d["groupId"] = f"msg-nawruz-{ny}{sub}"
            continue

    # Dokumente nach Datum abgleichen
    de_house_unassigned = [d for d in step_a_docs if not d.get("groupId") and d.get("language") == "deutsch" and d.get("tier") in ["house", "institutions"] and d.get("date")]
    en_house_unassigned = [d for d in step_a_docs if not d.get("groupId") and d.get("language") == "english" and d.get("tier") in ["house", "institutions"] and d.get("date")]

    de_by_date = defaultdict(list)
    for d in de_house_unassigned: de_by_date[d["date"]].append(d)
    en_by_date = defaultdict(list)
    for d in en_house_unassigned: en_by_date[d["date"]].append(d)

    for date, de_list in list(de_by_date.items()):
        if date in en_by_date:
            en_list = en_by_date[date]
            if len(de_list) == 1 and len(en_list) == 1:
                gk = f"msg-{date}"
                de_list[0]["groupId"] = gk
                en_list[0]["groupId"] = gk
            else:
                for d in de_list:
                    dt = norm_text(d.get("title"))
                    best_match = None
                    for ed in en_list:
                        et = norm_text(ed.get("title"))
                        if ("training" in dt and "training" in et) or ("iran" in dt and "iran" in et) or ("counsellor" in dt and "counsellor" in et) or ("nsa" in dt and "nsa" in et):
                            best_match = ed
                            break
                    if not best_match:
                        best_match = en_list[0]
                    gk = f"msg-{date}"
                    d["groupId"] = gk
                    best_match["groupId"] = gk

    # Restliche Dokumente erhalten Standard-groupId
    for d in step_a_docs:
        if not d.get("groupId"):
            if d.get("date"):
                d["groupId"] = f"msg-{d['date']}"
            else:
                d["groupId"] = f"doc-{d['id']}"

    # 3. Zweiter Deduplizierungsschritt nach (groupId, language)
    by_group_lang = defaultdict(list)
    for d in step_a_docs:
        by_group_lang[(d["groupId"], (d.get("language") or "deutsch").lower())].append(d)

    final_docs = []
    for (gk, lang), glist in by_group_lang.items():
        final_docs.append(merge_group(glist, alias_map))

    print(f"Schritt 2 abgeschlossen: {len(final_docs)} eindeutige Dokumente ({len(alias_map)} Dubletten zusammengefuehrt).")

    # 4. Zweisprachige Metadaten eintragen
    final_groups = defaultdict(list)
    for d in final_docs:
        final_groups[d["groupId"]].append(d)

    bilingual_count = 0
    for gk, glist in final_groups.items():
        de_docs = [d for d in glist if (d.get("language") or "").lower() == "deutsch"]
        en_docs = [d for d in glist if (d.get("language") or "").lower() == "english"]

        de_doc = de_docs[0] if de_docs else None
        en_doc = en_docs[0] if en_docs else None

        avail_langs = []
        if de_doc: avail_langs.append("de")
        if en_doc: avail_langs.append("en")
        if len(avail_langs) > 1: bilingual_count += 1

        for d in glist:
            d["translations"] = {
                "de": de_doc["id"] if de_doc else None,
                "en": en_doc["id"] if en_doc else None
            }
            d["availableLanguages"] = avail_langs
            if de_doc and en_doc:
                d["deTitle"] = de_doc.get("title")
                d["enTitle"] = en_doc.get("title")

    print(f"Eindeutige Werke gesamt: {len(final_groups)}")
    print(f"Zweisprachige Werke (DE + EN): {bilingual_count}")

    # 5. Speichern in botschaftenarchiv/
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(final_docs, f, ensure_ascii=False, indent=2)
    print(f"Gespeichert: {INDEX_PATH}")

    with open(ALIAS_PATH, "w", encoding="utf-8") as f:
        json.dump(alias_map, f, ensure_ascii=False, indent=2)
    print(f"Gespeichert: {ALIAS_PATH} ({len(alias_map)} Weiterleitungen)")

    # 6. Synchronisieren nach website/
    if WEBSITE_DIR.exists():
        WEBSITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(WEBSITE_INDEX_PATH, "w", encoding="utf-8") as f:
            json.dump(final_docs, f, ensure_ascii=False, indent=2)
        with open(WEBSITE_ALIAS_PATH, "w", encoding="utf-8") as f:
            json.dump(alias_map, f, ensure_ascii=False, indent=2)
        print(f"Synchronisiert nach website/data/")

    print("Erfolgreich abgeschlossen.")

if __name__ == "__main__":
    main()
