#!/usr/bin/env bash
# Full build of The Elo Blueprint. See BUILD.md.
set -euo pipefail
cd "$(dirname "$0")"
DEPTH="${DEPTH:-18}"
EPUBCHECK_CP="${EPUBCHECK_CP:-/tmp/tools/ec/lib/*}"
mkdir -p build/logs build/dist

echo "== 1. validate chess content (depth $DEPTH)"
python3 tools/validate_all.py --depth "$DEPTH"

echo "== 2. plan, cover, icons"
python3 tools/plan.py
python3 tools/render_cover.py

echo "== 3. book PDF"
python3 tools/build_pdf.py 2>&1 | grep -v "^WARNING" | tee build/logs/pdf.log
echo "== 4. EPUB"
python3 tools/build_epub.py | tee build/logs/epub.log
java -cp "$EPUBCHECK_CP" com.adobe.epubcheck.tool.Checker build/dist/THE-ELO-BLUEPRINT.epub 2>&1 \
  | grep -v -e JAVA_TOOL -e "XSLT version" -e "^Warning $" | tee build/logs/epubcheck.log
echo "== 5. cheat sheets + workbook"
python3 tools/build_cheatsheets.py 2>&1 | grep -v "^WARNING"
python3 tools/build_workbook.py 2>&1 | grep -v "^WARNING"
echo "== 6. web data, app, site"
python3 tools/build_webdata.py
python3 tools/build_app.py
echo "== 7. app tests"
node tools/test_app.js 2>&1 | tee build/logs/app-tests.log
echo "== 8. audit + release"
python3 tools/audit.py
python3 tools/build_release.py | tee build/logs/release.log
python3 tools/audit.py
python3 tools/build_release.py > /dev/null
echo "done: build/release/"
