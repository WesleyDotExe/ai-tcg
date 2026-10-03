#!/usr/bin/env python3
"""Generate ward art for Mythic cards that do not have it yet.

Runs ONLY inside the mythic-wards GitHub Action (.github/workflows/mythic-wards.yml).
The game never calls this or any network service: the art it makes is committed
as static files, and until a card has art the renderer draws the code-generated
fallback ward (seeded from the card name and faction).

Reads   render/presentation/mythics.json
Writes  render/assets/wards/mythic/<slug>.webp           (2x2 atlas, 512px cells)
        render/assets/wards/mythic/previews/<slug>.png   (small preview for the owner)
        progress/render/mythic-wards-log.md              (one line per card)
        and fills 'ward' / 'source' / 'generated' (or 'attempts') in mythics.json.

Environment: REPLICATE_API_TOKEN (from the repo secret REPLICATE_AI_TCG),
             MAX_PER_RUN (default 3; about $0.15 per card with Nano Banana Pro at 2K).
Dependencies: pillow, numpy (installed by the workflow). No other packages.
"""
import io
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PRES = ROOT / "render/presentation/mythics.json"
OUT = ROOT / "render/assets/wards/mythic"
PREV = OUT / "previews"
LOG = ROOT / "progress/render/mythic-wards-log.md"
MODEL = "google/nano-banana-pro"
MAX_PER_RUN = int(os.environ.get("MAX_PER_RUN", "3"))
MAX_ATTEMPTS = 3
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "")

THEMES = {
    "Cortex": "a cold machine intelligence of circuits, lenses and precise instruments",
    "Aegis": "an armoured fortress faction of heavy engineering, hexagonal plates and molten metal",
    "Swarm": "an organic alien insect hive of chitin, veins, eggs and spores",
    "Null": "a void faction of corrupted data, entropy, broken geometry and black holes",
}
BANNED = (
    "No grid lines, no dividing lines, no borders, no labels, no letters, no words, no numbers, "
    "no religious, occult or political symbols of any kind, no stars, no hexagrams, no pentagrams, "
    "no crosses, no swastikas, no eyes, no hearts, no crescent moons."
)


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def build_prompt(name, m):
    mo = m["motif"]
    return (
        f"A 2x2 grid of four separate glowing ward-circle layers for one legendary sci-fi card called {name}: "
        f"{mo['concept']} Theme: {THEMES.get(m['faction'], '')}. "
        "Pure solid black background (#000000). Monochrome white and grey neon line art only, absolutely no colour. "
        "Each item is perfectly circular, viewed straight on, centred in its own quadrant with generous black space; "
        "nothing touches the quadrant edges. "
        f"{BANNED} "
        f"Top-left: outer ring only (empty centre): {mo['outer']} "
        f"Top-right: middle layer (empty centre): {mo['middle']} "
        f"Bottom-left: core emblem: {mo['core']} "
        f"Bottom-right: {mo['ornament']}, on its own and small. "
        "Extremely detailed, elegant, high contrast, premium legendary game UI asset style."
    )


def api(method, url, body=None):
    req = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def generate(prompt):
    pr = api(
        "POST",
        f"https://api.replicate.com/v1/models/{MODEL}/predictions",
        {"input": {"prompt": prompt, "aspect_ratio": "1:1", "resolution": "2K", "output_format": "png"}},
    )
    t0 = time.time()
    while pr["status"] not in ("succeeded", "failed", "canceled"):
        if time.time() - t0 > 360:
            raise RuntimeError("timed out after 6 minutes")
        time.sleep(4)
        pr = api("GET", pr["urls"]["get"])
    if pr["status"] != "succeeded":
        raise RuntimeError(f"prediction {pr['status']}: {pr.get('error')}")
    out = pr["output"]
    url = out[0] if isinstance(out, list) else out
    with urllib.request.urlopen(url, timeout=120) as r:  # replicate.delivery URLs expire after ~1 hour
        return Image.open(io.BytesIO(r.read())).convert("L"), pr["id"]


# ---------- processing: same steps as the owner-approved hand-run wards ----------
S = 512
_yy, _xx = np.mgrid[0:S, 0:S]
_RR = np.hypot(_xx - S / 2 + 0.5, _yy - S / 2 + 0.5) / (S / 2)
_CIRC = np.clip((1.0 - _RR) / 0.04, 0, 1)


def fit(cell, centre_only=False):
    a = np.asarray(cell).astype(float)
    h, w = a.shape
    if centre_only:  # ornaments: ignore any ring the model drew around them
        mask = np.zeros_like(a, bool)
        mask[int(h * 0.3):int(h * 0.7), int(w * 0.3):int(w * 0.7)] = True
        ys, xs = np.where((a > 40) & mask)
    else:
        ys, xs = np.where(a > 40)
    if len(xs) < 50:
        raise RuntimeError("a quadrant came back empty")
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    half = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 * (1.25 if centre_only else 1.06)
    c = Image.fromarray(a.astype("uint8")).crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half)))
    out = np.asarray(c.resize((S, S), Image.LANCZOS)).astype(float) * _CIRC
    if centre_only:
        out *= np.clip((0.92 - _RR) / 0.1, 0, 1)
    return Image.fromarray(out.clip(0, 255).astype("uint8"))


def process(img):
    W = img.size[0]
    h = W // 2
    ins = int(W * 0.03)  # drops any divider lines the model drew between quadrants
    cells = [img.crop((k * h + ins, r * h + ins, (k + 1) * h - ins, (r + 1) * h - ins)) for r in range(2) for k in range(2)]
    layers = [fit(cells[0]), fit(cells[1]), fit(cells[2]), fit(cells[3], centre_only=True)]
    atlas = Image.new("L", (S * 2, S * 2))
    for i, layer in enumerate(layers):
        atlas.paste(layer, ((i % 2) * S, (i // 2) * S))
    return atlas.convert("RGB")


def main():
    data = json.loads(PRES.read_text(encoding="utf-8"))
    todo = [
        (name, m)
        for name, m in data["mythics"].items()
        if not (m.get("ward") and (ROOT / m["ward"]).exists()) and m.get("attempts", 0) < MAX_ATTEMPTS
    ]
    if not todo:
        print("Every Mythic has ward art. Nothing to do.")
        return 0
    if not TOKEN:
        print("No REPLICATE_API_TOKEN: these Mythics keep the code-generated fallback ward:", [n for n, _ in todo])
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    PREV.mkdir(parents=True, exist_ok=True)
    today = time.strftime("%Y-%m-%d")
    lines = []
    for name, m in todo[:MAX_PER_RUN]:
        s = slug(name)
        try:
            img, pid = generate(build_prompt(name, m))
            atlas = process(img)
            atlas.save(OUT / f"{s}.webp", "WEBP", quality=86, method=6)
            atlas.resize((512, 512)).save(PREV / f"{s}.png")
            m["ward"] = f"render/assets/wards/mythic/{s}.webp"
            m["source"] = f"replicate:{MODEL} ({pid})"
            m["generated"] = today
            m.pop("attempts", None)
            lines.append(
                f"- {today} **{name}** ({m['faction']}): ward generated. Preview: "
                f"`render/assets/wards/mythic/previews/{s}.png`. Owner: check it for unwanted symbols. "
                f"To redo it, delete the .webp and the action makes a new one on its next run."
            )
            print("generated", name)
        except Exception as e:  # never fail the build over art: the fallback ward covers it
            m["attempts"] = m.get("attempts", 0) + 1
            lines.append(f"- {today} **{name}**: generation failed ({e}). Fallback ward in use. Attempt {m['attempts']}/{MAX_ATTEMPTS}.")
            print("failed", name, e)
    PRES.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    LOG.parent.mkdir(parents=True, exist_ok=True)
    if not LOG.exists():
        LOG.write_text(
            "# Mythic ward generation log\n\nWritten by the mythic-wards GitHub Action "
            "(.github/workflows/mythic-wards.yml). One line per generated or failed ward.\n\n",
            encoding="utf-8",
        )
    with LOG.open("a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
