#!/usr/bin/env python3
"""Build the offline data files the app ships with.

Inputs (from github.com/scrollmapper/bible_databases, branch 2025):
  formats/json/BSB.json              Berean Standard Bible, CC0
  sources/extras/cross_references.txt  OpenBible.info cross references, CC-BY

Usage: python3 tools/build_data.py BSB.json cross_references.txt
Writes data/bsb/<BOOK>.json and data/xref/<BOOK>.json.
"""
import json
import os
import re
import sys
from collections import defaultdict

USFM = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO "
        "ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL "
        "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB "
        "JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()
OSIS = ("Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job "
        "Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag "
        "Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim "
        "2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev").split()
OSIS_TO_USFM = dict(zip(OSIS, USFM))

# Keep the strongest links only, so the files stay small enough to ship offline.
MIN_VOTES = 3
MAX_PER_VERSE = 10

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def build_bible(path):
    data = json.load(open(path, encoding="utf-8"))
    out = os.path.join(ROOT, "bsb")
    os.makedirs(out, exist_ok=True)
    assert len(data["books"]) == 66
    for code, book in zip(USFM, data["books"]):
        chapters = []
        for ch in book["chapters"]:
            verses = [clean(v["text"]) for v in sorted(ch["verses"], key=lambda v: v["verse"])]
            chapters.append(verses)
        with open(os.path.join(out, code + ".json"), "w", encoding="utf-8") as f:
            json.dump(chapters, f, ensure_ascii=False, separators=(",", ":"))


def parse_ref(ref):
    book, ch, vs = ref.split(".")
    return OSIS_TO_USFM[book], int(ch), int(vs)


def short_ref(target):
    """Gen.1.1-Gen.1.3 -> 'GEN 1:1-3'; spans across chapters keep both."""
    parts = target.split("-")
    b1, c1, v1 = parse_ref(parts[0])
    if len(parts) == 1:
        return f"{b1} {c1}:{v1}"
    b2, c2, v2 = parse_ref(parts[1])
    if b1 != b2:
        return f"{b1} {c1}:{v1}"
    if c1 == c2:
        return f"{b1} {c1}:{v1}-{v2}"
    return f"{b1} {c1}:{v1}-{c2}:{v2}"


def build_xref(path):
    by_book = defaultdict(lambda: defaultdict(list))
    with open(path, encoding="utf-8") as f:
        next(f)
        for line in f:
            src, dst, votes = line.rstrip("\n").split("\t")[:3]
            votes = int(votes)
            if votes < MIN_VOTES:
                continue
            book, ch, vs = parse_ref(src)
            by_book[book][f"{ch}:{vs}"].append((votes, short_ref(dst)))
    out = os.path.join(ROOT, "xref")
    os.makedirs(out, exist_ok=True)
    for book, verses in by_book.items():
        slim = {k: [r for _, r in sorted(v, reverse=True)[:MAX_PER_VERSE]] for k, v in verses.items()}
        with open(os.path.join(out, book + ".json"), "w", encoding="utf-8") as f:
            json.dump(slim, f, separators=(",", ":"))


if __name__ == "__main__":
    build_bible(sys.argv[1])
    build_xref(sys.argv[2])
