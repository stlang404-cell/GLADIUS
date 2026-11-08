# GLADIUS local launcher: serves the built game from .\app on http://localhost
# using only built-in Windows PowerShell (.NET HttpListener), then opens the
# default browser. Close this window to stop the server.
# Tip: in Edge/Chrome use "Install GLADIUS" (address bar) for an app window that
# then also works offline without this launcher.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'app'
if (-not (Test-Path (Join-Path $root 'index.html'))) { Write-Host "Missing app\index.html - is the package complete?"; Read-Host; exit 1 }
$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.css'='text/css'; '.json'='application/json';
  '.webmanifest'='application/manifest+json'; '.wasm'='application/wasm'; '.svg'='image/svg+xml'; '.png'='image/png'; '.txt'='text/plain'; '.ico'='image/x-icon'
}
# A fixed port keeps the browser's saved data (IndexedDB is per-origin). Fall back if busy.
$ports = 47615, 47616, 47617, 47618
$listener = $null
foreach ($p in $ports) {
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$p/"); $l.Start(); $listener = $l; $port = $p; break } catch { }
}
if (-not $listener) { Write-Host 'Could not open a local port.'; Read-Host; exit 1 }
if ($port -ne 47615) { Write-Host "NOTE: port 47615 was busy; using $port. Your save lives per-port - export/import it from Legacy > Saves if needed." }
$url = "http://localhost:$port/"
Write-Host "GLADIUS is running at $url  (close this window to quit)"
Start-Process $url
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $path))
    if (-not $full.StartsWith([IO.Path]::GetFullPath($root)) -or -not (Test-Path $full -PathType Leaf)) { $full = Join-Path $root 'index.html' }
    $ext = [IO.Path]::GetExtension($full).ToLower()
    # Cross-origin isolation lets the multi-threaded Stockfish build run.
    $ctx.Response.Headers.Add('Cross-Origin-Opener-Policy', 'same-origin')
    $ctx.Response.Headers.Add('Cross-Origin-Embedder-Policy', 'require-corp')
    $ctx.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
    # HEAD (the app probes for the bundled full-strength engine): headers only.
    if ($ctx.Request.HttpMethod -eq 'HEAD') {
      $ctx.Response.ContentLength64 = (Get-Item -LiteralPath $full).Length
    } else {
      # Stream from disk (the full engine .wasm files are ~99 MB each).
      $fs = [IO.File]::OpenRead($full)
      try { $ctx.Response.ContentLength64 = $fs.Length; $fs.CopyTo($ctx.Response.OutputStream) } finally { $fs.Close() }
    }
  } catch { $ctx.Response.StatusCode = 500 } finally { $ctx.Response.OutputStream.Close() }
}
