"""Create an offline HTML edition from the same source used by Cloudflare Pages."""
import argparse
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "dashboard"
MAP = SITE / "cartography"
MIME = {".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2"}


def data_uri(path):
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{MIME[path.suffix]};base64,{payload}"


def inline_css(path):
    def substitute(match):
        value = match.group(1).strip("\"'")
        if value.startswith(("data:", "#")):
            return match.group(0)
        return 'url("' + data_uri(path.parent / value) + '")'

    css = path.read_text(encoding="utf-8")
    css = re.sub(r'@import\s+url\("([^"]+)"\);',
                 lambda m: inline_css(path.parent / m.group(1)), css)
    return re.sub(r"url\(([^)]*)\)", substitute, css)


def script(text):
    # Keep script end tags in source strings from closing the HTML element.
    text = re.sub(r"</script", lambda _: r"<\/script", text, flags=re.I)
    return "<script>" + text + "</script>"


def export(output):
    page = (SITE / "index.html").read_text(encoding="utf-8")
    page = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: "<style>" + inline_css(SITE / m.group(1)) + "</style>", page)
    page = page.replace('src="provisional_logo.png"', 'src="' + data_uri(SITE / "provisional_logo.png") + '"')
    embedded = {
        "geography": json.loads((MAP / "geodata.json").read_text()),
        "places": json.loads((MAP / "place_labels.json").read_text()),
        "assets": {"baton_rouge.svg": data_uri(MAP / "baton_rouge.svg")},
    }
    prefix = script("window.BellOffline=" + json.dumps(embedded, separators=(",", ":")) + ";")
    leaflet = (MAP / "leaflet.js").read_text(encoding="utf-8")
    leaflet = re.sub(r"(?m)^\s*//# sourceMappingURL=.*$", "", leaflet)
    prefix += script(leaflet)

    def inline_script(match):
        text = (SITE / match.group(1)).read_text(encoding="utf-8")
        if match.group(1) == "app.js":
            text = text.replace('href="bell.jpg"', 'href="' + data_uri(SITE / "bell.jpg") + '"')
        return script(text)

    page = re.sub(r'<script src="([^"]+)"></script>', inline_script, page)
    page = page.replace("</head>", prefix + "</head>", 1)
    licenses = "\n\n".join(p.read_text(encoding="utf-8") for p in
                           (MAP / "leaflet-license.txt", SITE / "Inter_License.txt"))
    page = page.replace("</body>", '<script type="text/plain" id="licenses">' + licenses + "</script></body>")
    output.write_text(page, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path, default=ROOT / "Bell_District_61.html")
    export(parser.parse_args().output)
