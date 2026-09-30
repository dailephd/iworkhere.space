$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

function Get-PortListeners {
    @(Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue)
}

$listeners = @(Get-PortListeners)
if ($listeners.Count -gt 0) {
    $processIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    $owners = @()
    foreach ($processId in $processIds) {
        $owner = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $owner) {
            throw "Port 3000 is in use by process ID $processId, but its owner could not be identified. Stop that process or free port 3000 before running npm run dev."
        }
        $owners += $owner
    }

    $nonNodeOwner = $owners | Where-Object { $_.ProcessName -ne 'node' } | Select-Object -First 1
    if ($null -ne $nonNodeOwner) {
        throw "Port 3000 is already in use by '$($nonNodeOwner.ProcessName)' (PID $($nonNodeOwner.Id)). Stop that process or free port 3000 before running npm run dev."
    }

    foreach ($owner in $owners) {
        Write-Output "Stopping existing Node process on port 3000 (PID $($owner.Id))..."
        Stop-Process -Id $owner.Id -Force
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    do {
        Start-Sleep -Milliseconds 200
        $listeners = @(Get-PortListeners)
    } while ($listeners.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline)

    if ($listeners.Count -gt 0) {
        throw 'Port 3000 did not become available after stopping the existing Node process. Free port 3000 before running npm run dev.'
    }
}

Write-Output 'Starting Next.js dev server for iworkhere.space on http://localhost:3000 ...'
Write-Output 'Docker production preview is optional: npm run dev:docker'

& npm.cmd run dev:web
$devExitCode = $LASTEXITCODE
Write-Output "Dev server exited with code $devExitCode."
exit $devExitCode
