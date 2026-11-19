# Jugador LAN: comprueba al anfitrion y abre el juego desde localhost (contexto seguro).
# El servidor local es solo de archivos, en 127.0.0.1. La pagina es riposte-frontline.html.
param(
  [string]$HostIp = "",
  [int]$LanPort = 8770,
  [switch]$NoBrowser
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $HostIp) {
  Write-Host "IP del anfitrion (la que muestra Jugar-LAN-Host, por ejemplo 192.168.1.25)."
  Write-Host "No escribas 127.0.0.1: esa es solo el PC del anfitrion."
  $HostIp = Read-Host "IP"
}
$HostIp = ("" + $HostIp).Trim()
$HostIp = $HostIp -replace '^https?://', ''
$HostIp = $HostIp.Trim().TrimEnd('/')
if ($HostIp.Contains("/")) { $HostIp = $HostIp.Split("/")[0] }
if (-not $HostIp) { Write-Host "Falta la IP."; exit 1 }
$lanHost = $HostIp
if ($HostIp -match '^(.*):(\d+)$') {
  $lanHost = $Matches[1]
  $LanPort = [int]$Matches[2]
}
if ($lanHost.StartsWith("127.") -or $lanHost -eq "localhost") {
  Write-Host "127.0.0.1 es este PC, no el anfitrion. Pide la IP que sale en su ventana (192.168... o 10...)."
}

function Find-Page($dir) {
  if (-not (Test-Path -LiteralPath $dir)) { return "" }
  foreach ($name in @("riposte-frontline.html", "index.html")) {
    if (Test-Path -LiteralPath (Join-Path $dir $name)) { return $name }
  }
  return ""
}

$probe = "http://" + $lanHost + ":" + $LanPort + "/version.json"
Write-Host ("Comprobando " + $probe + " ...")
try {
  $resp = Invoke-WebRequest -Uri $probe -UseBasicParsing -TimeoutSec 5
  if ($resp.StatusCode -ne 200) { throw ("estado " + $resp.StatusCode) }
} catch {
  Write-Host "El anfitrion no responde."
  Write-Host "Comprueba la IP, que Jugar-LAN-Host siga abierto y que el firewall deje el puerto TCP $LanPort."
  exit 1
}
Write-Host "El anfitrion responde."

$web = Join-Path $here "juego"
$page = Find-Page $web
if (-not $page) {
  $dist = Join-Path (Split-Path -Parent $here) "dist"
  $page = Find-Page $dist
  if ($page) { $web = $dist }
  else { Write-Host "No encuentro riposte-frontline.html. Copia la carpeta entera o construye dist/."; exit 1 }
}

$port = 8758
$ok = $false
$listener = $null
foreach ($tryPort in @(8758, 8759, 8760, 8761, 8762)) {
  $tryL = $null
  try {
    $tryL = [System.Net.HttpListener]::new()
    $tryL.Prefixes.Add("http://127.0.0.1:$tryPort/")
    $tryL.Start()
    $listener = $tryL
    $port = $tryPort
    $ok = $true
    break
  } catch {
    if ($tryL) { try { $tryL.Close() } catch {} }
  }
}
if (-not $ok) { Write-Host "No pude abrir un puerto local (8758-8762)."; exit 1 }

function Get-Mime($path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".webp" { "image/webp" }
    ".svg" { "image/svg+xml" }
    ".ico" { "image/x-icon" }
    ".mp3" { "audio/mpeg" }
    ".woff2" { "font/woff2" }
    ".webmanifest" { "application/manifest+json" }
    default { "application/octet-stream" }
  }
}

$lan = $lanHost + ":" + $LanPort
$url = "http://127.0.0.1:" + $port + "/" + $page + "?lan=" + $lan
Write-Host ""
Write-Host "Riposte Frontline (unirse por LAN) listo en $url"
Write-Host "En el juego: Multijoueur, Rejoindre un salon, y el codigo de 5 caracteres del anfitrion."
Write-Host "Cierra esta ventana para salir."
Write-Host ""
if (-not $NoBrowser) {
  try { Start-Process $url } catch { Write-Host "Abre el navegador en $url" }
}

$rootFull = [IO.Path]::GetFullPath($web)
while ($listener.IsListening) {
  $ctx = $null
  try { $ctx = $listener.GetContext() } catch { break }
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = $page }
    $path = [IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    $respH = $ctx.Response
    $respH.Headers["Access-Control-Allow-Origin"] = "*"
    if (-not $path.StartsWith($rootFull) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
      $respH.StatusCode = 404
      $buf = [Text.Encoding]::UTF8.GetBytes("Not found")
      $respH.OutputStream.Write($buf, 0, $buf.Length)
    } else {
      $bytes = [IO.File]::ReadAllBytes($path)
      $respH.StatusCode = 200
      $respH.ContentType = Get-Mime $path
      $respH.ContentLength64 = $bytes.Length
      $respH.Headers["Cache-Control"] = "no-cache"
      $respH.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $respH.OutputStream.Close()
  } catch { try { $ctx.Response.Abort() } catch {} }
}
try { $listener.Stop(); $listener.Close() } catch {}
