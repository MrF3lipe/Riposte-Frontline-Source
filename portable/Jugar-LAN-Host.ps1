# Anfitrion LAN de este fork de Riposte: Frontline. Juego + senalizacion PeerJS en 0.0.0.0.
# El servidor esta en LanServer.cs y se compila en este proceso con Add-Type (no hay .exe).
# Windows PowerShell 5.1. Cierra esta ventana para salir.
# La pagina del juego es dist/riposte-frontline.html (no index.html).
param(
  [int]$Port = 8770,
  [string]$Bind = "0.0.0.0",
  [string]$WebRoot = "",
  [switch]$NoBrowser,
  [switch]$NoFirewall,
  [switch]$NoElevate
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ps1 = $MyInvocation.MyCommand.Path

function Test-Win {
  try { return ([System.Environment]::OSVersion.Platform.ToString() -eq "Win32NT") } catch { return $false }
}
function Test-Admin {
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { return $false }
}
function Find-Page($dir) {
  if (-not (Test-Path -LiteralPath $dir)) { return "" }
  foreach ($name in @("riposte-frontline.html", "index.html")) {
    if (Test-Path -LiteralPath (Join-Path $dir $name)) { return $name }
  }
  return ""
}

$win = Test-Win
if ($win -and -not $NoElevate -and -not (Test-Admin)) {
  $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$ps1`" -Port $Port -Bind `"$Bind`""
  if ($WebRoot) { $arg += " -WebRoot `"$WebRoot`"" }
  if ($NoBrowser) { $arg += " -NoBrowser" }
  if ($NoFirewall) { $arg += " -NoFirewall" }
  $arg += " -NoElevate"
  Write-Host "Hace falta administrador para abrir el puerto en el firewall. Acepta la ventana de Windows."
  Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $arg
  exit 0
}

if (-not $WebRoot) {
  $juego = Join-Path $here "juego"
  $dist = Join-Path (Split-Path -Parent $here) "dist"
  if (Find-Page $juego) { $WebRoot = $juego }
  elseif (Find-Page $dist) { $WebRoot = $dist }
  else { Write-Host "No encuentro riposte-frontline.html en juego\ ni en dist\."; exit 1 }
}
$WebRoot = [IO.Path]::GetFullPath($WebRoot)
$page = Find-Page $WebRoot
if (-not $page) {
  Write-Host "No encuentro riposte-frontline.html en $WebRoot"
  exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $WebRoot "peerjs.min.js"))) {
  Write-Host "Falta peerjs.min.js junto al juego. Vuelve a construir con python3 build.py."
  exit 1
}

if ($win -and -not $NoFirewall) {
  $rule = "Riposte Frontline LAN $Port"
  & netsh advfirewall firewall show rule name="$rule" | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Firewall: la regla ya estaba ($rule)."
  } else {
    & netsh advfirewall firewall add rule name="$rule" dir=in action=allow protocol=TCP localport=$Port profile=private,public | Out-Host
    if ($LASTEXITCODE -ne 0) {
      Write-Host "No pude crear la regla de firewall. Si un amigo no entra, abre el puerto TCP $Port (perfiles privado y publico)."
    } else {
      Write-Host "Firewall: puerto TCP $Port permitido (privado y publico)."
    }
  }
}

$csPath = Join-Path $here "LanServer.cs"
if (-not (Test-Path -LiteralPath $csPath)) { Write-Host "Falta LanServer.cs junto a este script."; exit 1 }
if (-not ("LanHost" -as [type])) {
  $code = [IO.File]::ReadAllText($csPath)
  Add-Type -TypeDefinition $code -Language CSharp
}

if (-not [LanHost]::Start($WebRoot, $Port, $Bind)) {
  Write-Host ("No pude abrir el puerto " + $Port + " en " + $Bind + ". " + [LanHost]::StartError)
  Write-Host "Cierra el otro Jugar-LAN-Host si ya estaba abierto."
  exit 1
}

function Get-LanIPv4 {
  $out = New-Object System.Collections.Generic.List[string]
  try {
    $nics = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()
    foreach ($nic in $nics) {
      if ($nic.OperationalStatus -ne "Up") { continue }
      foreach ($ua in $nic.GetIPProperties().UnicastAddresses) {
        if ($ua.Address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { continue }
        $s = $ua.Address.ToString()
        if ($s.StartsWith("127.") -or $s.StartsWith("169.254.")) { continue }
        if (-not $out.Contains($s)) { $out.Add($s) }
      }
    }
  } catch {}
  return $out
}

Write-Host ""
Write-Host "Riposte Frontline LAN listo (fork, sin internet)."
Write-Host ("Juego y senalizacion: http://127.0.0.1:" + $Port + "/" + $page + "?lan=127.0.0.1:" + $Port)
Write-Host "Carpeta: $WebRoot"
Write-Host ""
Write-Host "Di a tus amigos UNA de estas IPv4 (la de tu Wi-Fi):"
$ips = @(Get-LanIPv4)
if ($ips.Count -eq 0) { Write-Host "  (no veo una IPv4 de red; revisa el Wi-Fi)" }
else { foreach ($ip in $ips) { Write-Host ("  " + $ip + "   -> ellos abren Jugar-LAN-Unirse.bat y escriben " + $ip) } }
Write-Host ""
Write-Host "En el juego: Multijoueur, crear salon, y pasa el codigo de 5 caracteres."
Write-Host "Cierra esta ventana para salir."
Write-Host ""

$url = "http://127.0.0.1:" + $Port + "/" + $page + "?lan=127.0.0.1:" + $Port
if (-not $NoBrowser) {
  try { Start-Process $url } catch { Write-Host "Abre el navegador en $url" }
}

try { [LanHost]::Loop() }
finally { try { [LanHost]::Stop() } catch {} }
