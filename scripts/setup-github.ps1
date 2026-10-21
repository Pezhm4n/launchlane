$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $repoRoot '.local/tools/github'
$binaryPath = Join-Path $toolsRoot 'gh.exe'
$zipPath = Join-Path $toolsRoot 'gh_2.103.0_windows_amd64.zip'
# Keep downloaded software local to this checkout; never alter the user's global CLI.
if (-not [Environment]::Is64BitOperatingSystem -or $env:OS -ne 'Windows_NT') {
  throw 'This helper supports Windows x64. Install official GitHub CLI 2.103.0 and configure LAUNCHLANE_GITHUB_CLI_PATH on another platform.'
}
foreach ($candidate in @((Join-Path $repoRoot '.local'), (Join-Path $repoRoot '.local/tools'), $toolsRoot, $zipPath, $binaryPath)) {
  if ((Test-Path -LiteralPath $candidate) -and ((Get-Item -LiteralPath $candidate -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Refusing a linked tool path.' }
}
$excludePath = & git -C $repoRoot rev-parse --git-path info/exclude
if ($LASTEXITCODE -ne 0) { throw 'Run this helper from a Git checkout.' }
if (-not [IO.Path]::IsPathRooted($excludePath)) { $excludePath = Join-Path $repoRoot $excludePath }
if (-not ((Get-Content -LiteralPath $excludePath -ErrorAction SilentlyContinue) -contains '.local/')) { Add-Content -LiteralPath $excludePath -Value "`n.local/" }
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
$expected = '80c846a5b8432672ca6373b34ce9de998c9686aaa1885c845f2e1ee81f713726'
if (-not (Test-Path -LiteralPath $zipPath)) {
  Invoke-WebRequest -Uri 'https://github.com/cli/cli/releases/download/v2.103.0/gh_2.103.0_windows_amd64.zip' -OutFile $zipPath -TimeoutSec 90
}
$hasher = [Security.Cryptography.SHA256]::Create()
$inputStream = [IO.File]::OpenRead($zipPath)
try { $actual = [BitConverter]::ToString($hasher.ComputeHash($inputStream)).Replace('-', '').ToLowerInvariant() } finally { $inputStream.Dispose(); $hasher.Dispose() }
if ((Get-Item -LiteralPath $zipPath).Length -gt 20971520 -or $actual -ne $expected) { throw 'Official GitHub CLI archive checksum mismatch; nothing was executed.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | Where-Object { $_.FullName -match '(^|/)bin/gh\.exe$' })
  if ($entries.Count -ne 1 -or $entries[0].Length -gt 67108864) { throw 'Unexpected official CLI archive layout.' }
  [IO.Compression.ZipFileExtensions]::ExtractToFile($entries[0], $binaryPath, $true)
} finally { $archive.Dispose() }
& $binaryPath --version
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI did not start.' }
Write-Output 'Official CLI ready locally. No account login, token grant or global PATH change was performed.'
