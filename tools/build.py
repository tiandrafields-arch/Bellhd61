"""Build the Cloudflare Pages directory using only the Python standard library."""
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist"
branch = os.environ.get("CF_PAGES_BRANCH", "main")
release = os.environ.get("CAMPAIGN_RELEASE") == "enabled" and branch == "main"
source = ROOT / ("dashboard" if release else "setup")

# Rebuild the dedicated output directory so disabling the release removes old assets.
if OUTPUT.exists():
    if OUTPUT.is_symlink() or not (OUTPUT / ".bell_build").is_file():
        raise SystemExit("dist already exists and was not created by this build. Move it and retry.")
    shutil.rmtree(OUTPUT)
shutil.copytree(source, OUTPUT)
(OUTPUT / ".bell_build").touch()
shutil.copy2(ROOT / "_headers", OUTPUT / "_headers")
print("Built the campaign dashboard." if release else "Built the setup page.")
