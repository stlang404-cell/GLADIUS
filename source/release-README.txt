THE ELO BLUEPRINT — Complete Release
=====================================

Contents
  THE-ELO-BLUEPRINT-COMPLETE.pdf     The complete illustrated book (lessons, exercises, solutions, quick reference)
  THE-ELO-BLUEPRINT.epub             Reflowable EPUB 3 edition (Apple Books, Kobo, Thorium, Google Play Books…)
  THE-ELO-CHEAT-SHEETS.pdf           Printable practical reference (US Letter)
  THE-90-DAY-CHESS-ACCELERATOR.pdf   90-day training program and practice records (US Letter, printable)
  THE-ELO-BLUEPRINT-INTERACTIVE/     Offline web app (PWA): lessons, interactive exercises, play vs engine,
                                     PGN import + analysis, mistake journal, spaced review, 90-day dashboard
  THE-ELO-BLUEPRINT-WEBSITE.zip      Upload-ready static website (landing page + downloads + trainer)
  THE-ELO-BLUEPRINT-SOURCE/          Editable manuscript, exercise database, diagram data, app source, build tools
  VERIFICATION-REPORT.md             What was tested, with results, and what remains unverified
  SHA256SUMS.txt                     Checksums of every file

ON AN IPHONE
  EPUB: save THE-ELO-BLUEPRINT.epub to Files (or open it from Mail/Safari), tap it, then tap the
        Share button and choose "Books". It stays in Apple Books, works offline, and you can change
        the font size; diagrams scale with the screen.
  PDF:  tap the PDF in Files or Safari to read it; tap Share → "Books" to keep it in Apple Books
        too. Use the table of contents / bookmarks to jump to chapters; every "Solution p. N"
        reference is a link.

INTERACTIVE TRAINER
  The trainer must be served over http(s) for the engine and offline mode to work:
    - Easiest: deploy THE-ELO-BLUEPRINT-WEBSITE.zip to any static host (e.g. Cloudflare Pages:
      Workers & Pages → Create → Pages → Upload assets) and open https://<your-site>/app/
    - Locally: in THE-ELO-BLUEPRINT-INTERACTIVE/ run   python3 -m http.server 8000
      then open http://localhost:8000/
  Install as an app:
    - iPhone/iPad (Safari): open the trainer, tap Share → "Add to Home Screen".
    - Desktop Chrome/Edge: click the install icon in the address bar.
  After the first visit everything (including the chess engine) is cached and works offline.
  Your progress is stored only on your device; use Settings → Export progress to back it up.
