$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

foreach ($commandName in @('node', 'npm')) {
    if (-not (Get-Command $commandName -CommandType Application -ErrorAction SilentlyContinue)) {
        throw "Required command '$commandName' was not found on PATH. Install Node.js 24.x, then run npm run dev again."
    }
}

$nodeVersion = (& node --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v?(?<major>\d+)\.') {
    throw "Could not determine the Node.js version from '$nodeVersion'. Install Node.js 24.x, then run npm run dev again."
}

if ([int]$Matches['major'] -ne 24) {
    throw "iworkhere.space requires Node.js 24.x for the supported development and CI runtime.`nDetected: $nodeVersion`nSwitch to Node.js 24 and run npm run dev again."
}

$requiredPaths = @(
    'package.json',
    'src\app',
    'docs\ROADMAP.md',
    'docs\project-status.md'
)
foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath))) {
        throw "Required repository path '$relativePath' is missing from '$repoRoot'."
    }
}

$npmVersion = (& npm --version).Trim()
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to read the npm version. Check the Node.js installation and PATH.'
}

Write-Output 'Development environment check passed.'
Write-Output "Repo root: $repoRoot"
Write-Output "Node: $nodeVersion"
Write-Output "npm: $npmVersion"
