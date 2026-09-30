$ErrorActionPreference = 'Stop'

function Test-DockerReady {
    try {
        & docker info 1>$null 2>$null
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        return $false
    }
}

if (Test-DockerReady) {
    Write-Output 'Docker is ready.'
    exit 0
}

$timeoutSeconds = 180
if ($Env:DOCKER_START_TIMEOUT_SECONDS) {
    $parsedTimeout = 0
    if (-not [int]::TryParse($Env:DOCKER_START_TIMEOUT_SECONDS, [ref]$parsedTimeout) -or $parsedTimeout -le 0) {
        Write-Error 'DOCKER_START_TIMEOUT_SECONDS must be a positive integer.'
        exit 2
    }
    $timeoutSeconds = $parsedTimeout
}

$desktopCommandStarted = $false
try {
    & docker desktop start 1>$null 2>$null
    $desktopCommandStarted = ($LASTEXITCODE -eq 0)
}
catch {
    # Older Docker Desktop installations do not provide the desktop CLI command.
}

if (-not $desktopCommandStarted -and -not (Test-DockerReady)) {
    $desktopPaths = @(
        (Join-Path $Env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path $Env:LocalAppData 'Docker\Docker Desktop.exe')
    )
    foreach ($desktopPath in $desktopPaths) {
        if (Test-Path -LiteralPath $desktopPath) {
            Start-Process -FilePath $desktopPath -WindowStyle Hidden
            break
        }
    }
}

$deadline = [DateTime]::UtcNow.AddSeconds($timeoutSeconds)
while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-DockerReady) {
        Write-Output 'Docker is ready.'
        exit 0
    }
    Start-Sleep -Seconds 3
}

Write-Error "Docker Desktop did not become ready within $timeoutSeconds seconds. Check Docker Desktop status and try again."
exit 1
