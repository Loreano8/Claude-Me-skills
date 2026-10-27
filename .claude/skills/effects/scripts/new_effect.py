#!/usr/bin/env python3
"""Scaffold a HyperFrames project that applies one /effects effect to a talking-head video.

Usage:
  python3 new_effect.py <effect> <video> [--out DIR] [--config CFG.json] [--no-cutout]

Effects: glass-widgets, documentary, orbit, kallaway-split, spotlight, checklist, timeline.

The project is 1080x1920 and lasts as long as the source video. Text comes from the
effect's defaults in templates/<effect>.json, overridden key by key by --config.
Effects that place things behind the person (orbit, spotlight, checklist) cut the
person out with `hyperframes remove-background`; --no-cutout skips that step.
"""
import argparse, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
EFFECTS = ["glass-widgets", "documentary", "orbit", "kallaway-split", "spotlight", "checklist", "timeline"]
CUTOUT = {"orbit", "spotlight", "checklist"}
HF = "hyperframes@0.8.78"


def run(cmd, **kw):
    print("+", " ".join(cmd), file=sys.stderr)
    return subprocess.run(cmd, check=True, **kw)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    kinds = {s["codec_type"] for s in d.get("streams", [])}
    return float(d["format"]["duration"]), "audio" in kinds


def waveform(path, bars):
    """Loudness of `bars` equal slices of the audio, 0..1 (used by the timeline effect)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    n = len(raw) // 2
    if n == 0:
        return [0.3] * bars
    step = max(1, n // bars)
    vals = []
    for b in range(bars):
        chunk = raw[b * step * 2:(b + 1) * step * 2]
        if not chunk:
            vals.append(0.0)
            continue
        s = sum(abs(int.from_bytes(chunk[i:i + 2], "little", signed=True)) for i in range(0, len(chunk), 16))
        vals.append(s / (len(chunk) // 16 or 1))
    peak = max(vals) or 1
    return [round(0.12 + 0.88 * v / peak, 3) for v in vals]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("effect", choices=EFFECTS)
    ap.add_argument("video")
    ap.add_argument("--out")
    ap.add_argument("--config")
    ap.add_argument("--no-cutout", action="store_true")
    a = ap.parse_args()

    src = os.path.abspath(a.video)
    out = os.path.abspath(a.out or f"effect-{a.effect}")
    os.makedirs(os.path.join(out, "assets", "video"), exist_ok=True)
    os.makedirs(os.path.join(out, "assets", "audio"), exist_ok=True)
    os.makedirs(os.path.join(out, "assets", "vendor"), exist_ok=True)

    cfg = json.load(open(os.path.join(SKILL, "templates", f"{a.effect}.json")))
    if a.config:
        cfg.update(json.load(open(a.config)))

    dur, has_audio = probe(src)
    dur = round(dur, 3)
    shutil.copyfile(src, os.path.join(out, "assets", "video", "source.mp4"))
    shutil.copyfile(os.path.join(SKILL, "assets", "gsap.min.js"), os.path.join(out, "assets", "vendor", "gsap.min.js"))
    if has_audio:
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vn", "-c:a", "aac", "-b:a", "192k",
             os.path.join(out, "assets", "audio", "source.m4a")])

    cutout = False
    if a.effect in CUTOUT and not a.no_cutout:
        target = os.path.join(out, "assets", "video", "cutout.webm")
        if not os.path.exists(target):
            run(["npx", "--yes", HF, "remove-background", src, "-o", target])
        cutout = True
    if a.effect == "timeline":
        cfg["wave"] = waveform(src, 96)
    if a.effect == "documentary":
        os.makedirs(os.path.join(out, "assets", "img"), exist_ok=True)
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x808080:s=540x960",
             "-vf", "noise=alls=90:allf=u,format=gray", "-frames:v", "1", os.path.join(out, "assets", "img", "grain.png")])
    # Card images (orbit): copy local files into the project and point the card at the copy.
    for i, card in enumerate(cfg.get("cards", [])):
        img = card.get("image")
        if img and os.path.exists(img):
            os.makedirs(os.path.join(out, "assets", "img"), exist_ok=True)
            dest = f"assets/img/card-{i}{os.path.splitext(img)[1].lower()}"
            shutil.copyfile(img, os.path.join(out, dest))
            card["image"] = dest

    page = open(os.path.join(SKILL, "templates", f"{a.effect}.html")).read()
    audio = (f'<audio id="src-audio" src="assets/audio/source.m4a" data-start="0" data-duration="{dur}" '
             f'data-track-index="20" data-volume="1"></audio>') if has_audio else ""
    cut = (f'<video id="cutout" class="clip" src="assets/video/cutout.webm" data-start="0" data-duration="{dur}" '
           f'data-track-index="2" muted playsinline></video>') if cutout else ""
    data = json.dumps(cfg, ensure_ascii=False).replace("</", "<\\/")
    page = (page.replace("{{DURATION}}", str(dur)).replace("{{AUDIO}}", audio)
                .replace("{{CUTOUT}}", cut).replace("{{HAS_CUTOUT}}", "true" if cutout else "false")
                .replace("{{CONFIG}}", data))
    open(os.path.join(out, "index.html"), "w").write(page)

    name = os.path.basename(out)
    json.dump({"id": name, "name": name}, open(os.path.join(out, "meta.json"), "w"), indent=2)
    json.dump({"$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
               "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
               "media": {"autoProxy": True}}, open(os.path.join(out, "hyperframes.json"), "w"), indent=2)
    json.dump({"name": name, "private": True, "type": "module", "scripts": {
        "dev": f"npx --yes {HF} preview", "check": f"npx --yes {HF} check",
        "render": f"npx --yes {HF} render", "snapshot": f"npx --yes {HF} snapshot"}},
        open(os.path.join(out, "package.json"), "w"), indent=2)
    print(json.dumps({"project": out, "effect": a.effect, "duration": dur, "audio": has_audio, "cutout": cutout}))


if __name__ == "__main__":
    main()
