#!/bin/sh
# Rebuild book/ from the PDF in report/, then serve the site locally.
# Needs: pip install pymupdf pillow
set -e
cd "$(dirname "$0")/.."
python3 scripts/build_pages.py
PORT="${PORT:-8000}"
echo "Open http://localhost:$PORT/   (Ctrl+C to stop; add ?intro=1 to replay the intro)"
python3 -m http.server "$PORT"
