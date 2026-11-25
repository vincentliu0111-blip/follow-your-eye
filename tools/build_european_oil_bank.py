"""Build the proposed 50-pair European-oil study bank and review appendix.

The pair IDs below are a human-curated shortlist from the project's existing
Met style-pair catalog. Source metadata is checked on every build. A title
screen is not a substitute for inspecting the actual images.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path


PAIR_IDS_BY_PERIOD = {
    "1300-1599": [
        "met-437540-437598", "met-436044-436036", "met-435820-435835",
        "met-436739-437487", "met-435818-435819", "met-436741-437828",
        "met-435802-437889", "met-436341-435779", "met-436472-437830",
        "met-437210-435951", "met-436917-435960", "met-437146-436941",
        "met-435959-436986", "met-437154-435946", "met-436749-435955",
        "met-435615-436480",
    ],
    "1600-1799": [
        "met-435646-435839", "met-436432-437920", "met-436686-437868",
        "met-435631-437687", "met-437900-437181", "met-437386-437360",
        "met-436872-437450", "met-436215-437406", "met-437391-437500",
        "met-437087-436551", "met-436591-436239", "met-436621-436641",
        "met-436617-436397", "met-436823-436217", "met-436594-436830",
        "met-436598-438465", "met-438101-438103",
    ],
    "1800-1914": [
        "met-441969-436964", "met-436295-436153", "met-436206-436407",
        "met-438113-436152", "met-437943-436297", "met-437998-437683",
        "met-437519-441755", "met-437518-438950", "met-437514-439343",
        "met-437301-437313", "met-436534-437980", "met-437431-437999",
        "met-437836-436090", "met-435997-436091", "met-436527-436868",
        "met-437424-437432", "met-436000-435990",
    ],
}

EXPECTED_COUNTS = {"1300-1599": 16, "1600-1799": 17, "1800-1914": 17}
MANUAL_PAIRS = {
    "met-436044-436036": ("436044", "436036", "1300-1599"),
    "met-435820-435835": ("435820", "435835", "1300-1599"),
    "met-437210-435951": ("437210", "435951", "1300-1599"),
    "met-436749-435955": ("436749", "435955", "1300-1599"),
    "met-435615-436480": ("435615", "436480", "1300-1599"),
    "met-435818-435819": ("435818", "435819", "1300-1599"),
    "met-438101-438103": ("438101", "438103", "1600-1799"),
    "met-437301-437313": ("437301", "437313", "1800-1914"),
}
TITLE_RISK = re.compile(
    r"crucifix|martyr|flagell|behead|death|dead|slay|battle|war\b|nude|"
    r"naked|bacchan|bath|massacre|execution|holofernes|purgatory|tomb|"
    r"lamentation|rape|satyr|venus|diana|sacrifice|hell\b|triton|putti|"
    r"adam and eve|bellona|atalanta|pygmalion|persephone|judith|toilet|"
    r"the temptation|the glorification|bashi-bazouk|odalisque|tahitian|"
    r"abduction|bandits|the smokers|drinkers|man of sorrows",
    re.IGNORECASE,
)


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def build(repo: Path) -> tuple[list[dict], dict]:
    catalog_path = repo / "web/met_catalog.json"
    department_path = repo / "Data/met_department_snapshot_v1.json"
    pairs_path = repo / "web/met_all_pair_catalog.json"
    catalog = {str(a["id"]): a for a in json.loads(catalog_path.read_text())["artworks"]}
    departments = json.loads(department_path.read_text())["departmentById"]
    pairs = {p["id"]: p for p in json.loads(pairs_path.read_text())["pairs"]}
    records = []
    used_artworks: set[str] = set()
    for period, ids in PAIR_IDS_BY_PERIOD.items():
        if len(ids) != EXPECTED_COUNTS[period]:
            raise ValueError(f"Wrong {period} pair count")
        for pair_id in ids:
            pair = pairs.get(pair_id)
            if pair is None:
                a_id, b_id, manual_period = MANUAL_PAIRS[pair_id]
                pair = {"id": pair_id, "a": a_id, "b": b_id, "period": manual_period}
            if pair["period"] != period:
                raise ValueError(f"Wrong period: {pair_id}")
            artwork_data = []
            for side in ("a", "b"):
                ident = str(pair[side])
                if ident in used_artworks:
                    raise ValueError(f"Duplicate artwork: {ident}")
                used_artworks.add(ident)
                artwork = catalog[ident]
                department = departments.get(ident)
                medium = artwork.get("medium", "")
                title = artwork.get("title", "")
                image = repo / "web" / artwork["image"]
                if (department != "European Paintings" or
                        not medium.lower().startswith("oil on ") or
                        "gold" in medium.lower()):
                    raise ValueError(f"Not a Met European oil painting: {ident}")
                if TITLE_RISK.search(title):
                    raise ValueError(f"Title needs additional content review: {ident}: {title}")
                if not image.is_file():
                    raise FileNotFoundError(image)
                width, height = int(artwork["width"]), int(artwork["height"])
                if min(width, height) < 500 or not 0.55 <= width / height <= 2.4:
                    raise ValueError(f"Display size/aspect risk: {ident}")
                artwork_data.append({
                    "id": ident, "title": title, "artist": artwork.get("artist", ""),
                    "date": artwork.get("date", ""), "medium": medium,
                    "department": department, "met_url": artwork["sourceUrl"],
                    "image": artwork["image"], "sha256": digest(image),
                    "width": width, "height": height,
                })
            records.append({"pair_number": len(records) + 1, "pair_id": pair_id,
                            "period": period, "a": artwork_data[0], "b": artwork_data[1]})
    if len(records) != 50 or len(used_artworks) != 100:
        raise ValueError("Expected exactly 50 pairs and 100 unique artworks")
    provenance = {"met_catalog_sha256": digest(catalog_path),
                  "met_department_snapshot_sha256": digest(department_path),
                  "met_pair_catalog_sha256": digest(pairs_path),
                  "selection_counts": EXPECTED_COUNTS,
                  "scope": "Met European Paintings department; medium begins with Oil on and excludes gold; 100 unique works",
                  "manual_pairs": MANUAL_PAIRS,
                  "status": "Candidate only; image-by-image review and PI approval of this revised bank pending"}
    return records, provenance


def render_appendix(repo: Path, path: Path, records: list[dict], provenance: dict) -> None:
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    font = "Helvetica"
    for candidate in (Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
                      Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")):
        if candidate.is_file():
            pdfmetrics.registerFont(TTFont("ArtUnicode", str(candidate)))
            font = "ArtUnicode"
            break
    c = canvas.Canvas(str(path), pagesize=(612, 792))
    c.setTitle("Follow Your Eye - European oil painting candidate bank")
    ink, muted = HexColor("#1D2923"), HexColor("#56665B")

    def one_line(value: str, max_chars: int = 50) -> str:
        return value if len(value) <= max_chars else value[: max_chars - 1] + "…"

    for page in range(25):
        c.setFillColor(ink)
        c.setFont(font, 14)
        c.drawString(28, 757, "Follow Your Eye · European oil painting pairs")
        c.setFillColor(muted)
        c.setFont(font, 7.2)
        c.drawString(28, 742, "Candidate bank · Met European Paintings department · both works have oil medium")
        for slot, row in enumerate(records[page * 2: page * 2 + 2]):
            top = 717 - slot * 345
            c.setFillColor(ink)
            c.setFont(font, 10)
            c.drawString(28, top, f"Pair {row['pair_number']:02d}   {row['period']}   {row['pair_id']}")
            for side, x in (("a", 28), ("b", 312)):
                art = row[side]
                image = repo / "web" / art["image"]
                box_x, box_y, box_w, box_h = x, top - 251, 272, 226
                c.setStrokeColor(HexColor("#D5DDD4"))
                c.rect(box_x, box_y, box_w, box_h)
                iw, ih = ImageReader(str(image)).getSize()
                scale = min((box_w - 8) / iw, (box_h - 8) / ih)
                dw, dh = iw * scale, ih * scale
                c.drawImage(str(image), box_x + (box_w - dw) / 2,
                            box_y + (box_h - dh) / 2, dw, dh)
                c.setFont(font, 8)
                c.drawString(x, top - 265, f"Met {art['id']}  ·  {one_line(art['title'], 44)}")
                c.setFillColor(muted)
                c.setFont(font, 7)
                c.drawString(x, top - 277, one_line(art['artist'], 53))
                c.drawString(x, top - 289, one_line(art['medium'], 55))
                c.setFillColor(ink)
        c.setFillColor(muted)
        c.setFont(font, 7)
        c.drawString(28, 20, "Content suitability must be checked on the displayed images before formal use.")
        c.drawRightString(584, 20, f"{page + 1} / 25")
        c.showPage()
    c.save()


def write_outputs(repo: Path, output: Path) -> None:
    records, provenance = build(repo)
    output.mkdir(parents=True, exist_ok=True)
    (output / "European_Oil_50_Pairs_Index.json").write_text(
        json.dumps({"provenance": provenance, "pairs": records}, ensure_ascii=False, indent=2) + "\n")
    (output / "European_Oil_50_Pairs_Preview.json").write_text(
        json.dumps([{"pair_id": row["pair_id"], "a": row["a"]["id"],
                     "b": row["b"]["id"], "a_title": row["a"]["title"],
                     "b_title": row["b"]["title"]} for row in records],
                   ensure_ascii=False, indent=2) + "\n")
    with (output / "European_Oil_50_Pairs_Index.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        fieldnames = ["pair_number", "pair_id", "period", "a_id", "a_title", "a_artist", "a_medium",
                      "a_department", "a_met_url", "a_image_sha256", "b_id", "b_title", "b_artist",
                      "b_medium", "b_department", "b_met_url", "b_image_sha256", "image_content_review"]
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        for row in records:
            a, b = row["a"], row["b"]
            writer.writerow({"pair_number": row["pair_number"], "pair_id": row["pair_id"],
                             "period": row["period"], "a_id": a["id"], "a_title": a["title"],
                             "a_artist": a["artist"], "a_medium": a["medium"],
                             "a_department": a["department"], "a_met_url": a["met_url"],
                             "a_image_sha256": a["sha256"], "b_id": b["id"], "b_title": b["title"],
                             "b_artist": b["artist"], "b_medium": b["medium"],
                             "b_department": b["department"], "b_met_url": b["met_url"],
                             "b_image_sha256": b["sha256"],
                             "image_content_review": "PENDING visual check of revised bank"})
    render_appendix(repo, output / "European_Oil_50_Pairs_Review_Appendix.pdf", records, provenance)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    write_outputs(args.repo, args.output)
