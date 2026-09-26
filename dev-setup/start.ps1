# Rig Setup launcher for Windows (PowerShell).
# Finds a Python 3 interpreter and starts the local web app.
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Find-Python {
  foreach ($candidate in @("python", "python3", "py")) {
    $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($cmd) {
      try {
        $ok = & $candidate -c "import sys; print(1 if sys.version_info[0] >= 3 else 0)" 2>$null
        if ($ok -eq "1") { return $candidate }
      } catch { }
    }
  }
  return $null
}

$py = Find-Python
if (-not $py) {
  Write-Host "Python 3 was not found on this machine."
  Write-Host ""
  Write-Host "Install it, then re-run start.ps1 :"
  Write-Host "  winget install --id Python.Python.3.12 -e"
  Write-Host "  (or download from https://www.python.org/downloads/)"
  exit 1
}

Write-Host "Using Python at: $((Get-Command $py).Source)"
& $py (Join-Path $ScriptDir "app.py") @args
