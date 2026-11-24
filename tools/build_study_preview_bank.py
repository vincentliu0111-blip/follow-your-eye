"""Build a reproducible, preliminary 50-pair preview bank from local screening records.

This is an AI-assisted conservative shortlist, not PI/human content approval or
the five-judge prediction freeze required by the research protocol.
"""

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path


EXCLUDE_HINTS = re.compile(
    r"nudity|violence|death|short_side|extreme_aspect|classical_nudity|"
    r"unclothed_children|battle|suffering|execution|low_resolution|"
    r"presentation_artifact|low_contrast",
    re.IGNORECASE,
)
PERIOD_QUOTAS = {"1300-1599": 16, "1600-1799": 17, "1800-1914": 17}


def rows(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def build(bank_path, screen_path, images_dir):
    bank = {r["pair_id"]: r for r in rows(bank_path)}
    screening = [r for r in rows(screen_path) if r["role"] == "primary"]
    assert len(bank) == 100 and len(screening) == 100
    eligible = []
    for review in screening:
        pair = bank[review["pair_id"]]
        hints = review["priority_flags"] + ";" + review["ai_visual_flags"]
        if EXCLUDE_HINTS.search(hints):
            continue
        eligible.append((pair, review))
    chosen = []
    for period, count in PERIOD_QUOTAS.items():
        group = [(p, r) for p, r in eligible if p["period"] == period]
        group.sort(key=lambda item: (bool(item[1]["priority_flags"]), int(item[0]["bank_index"])))
        if len(group) < count:
            raise ValueError(f"Only {len(group)} eligible candidates in {period}; need {count}")
        chosen.extend(group[:count])
    assert len(chosen) == 50 and len({p["pair_id"] for p, _ in chosen}) == 50
    artwork_ids = [identifier for p, _ in chosen for identifier in (p["a"], p["b"])]
    assert len(set(artwork_ids)) == 100, "Artwork reused across preview pairs"
    records = []
    for p, review in chosen:
        a_file, b_file = (images_dir / f"{p[key]}.jpg" for key in ("a", "b"))
        if not a_file.is_file() or not b_file.is_file():
            raise FileNotFoundError(p["pair_id"])
        records.append({
            "pair_id": p["pair_id"], "a": p["a"], "b": p["b"],
            "a_title": p["a_title"], "b_title": p["b_title"],
            "a_source_url": p["a_source_url"], "b_source_url": p["b_source_url"],
            "period": p["period"], "a_display_sha256": digest(a_file),
            "b_display_sha256": digest(b_file), "original_bank_index": int(p["bank_index"]),
            "screening_hints": hints_for(review), "review_status": "PI_review_pending",
        })
    return records, len(eligible)


def hints_for(review):
    return ";".join(x for x in (review["priority_flags"], review["ai_visual_flags"]) if x)


def main():
    parser = argparse.ArgumentParser()
    for name in ("bank", "screening", "images_dir", "output", "report"):
        parser.add_argument(f"--{name.replace('_', '-')}", required=True, type=Path)
    args = parser.parse_args()
    records, eligible_count = build(args.bank, args.screening, args.images_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps([{k: row[k] for k in ("pair_id", "a", "b", "a_title", "b_title")} for row in records], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps({
        "status": "AI-assisted preview shortlist; PI and independent image review pending",
        "rules": {"exclude_hints_regex": EXCLUDE_HINTS.pattern, "period_quotas": PERIOD_QUOTAS},
        "source_sha256": {"bank100.csv": digest(args.bank), "screening.csv": digest(args.screening)},
        "eligible_after_hint_filter": eligible_count, "selected": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
