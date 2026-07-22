[CmdletBinding()]
param(
    [int]$Port = 3000,
    [string]$WorkspaceTag = "apps\\web"
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path

$connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue

if (-not $connections) {
    Write-Host "No process is listening on port $Port."
    exit 0
}

$killedAny = $false
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
    try {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
    } catch {
        Write-Host "Unable to inspect process $processId."
        continue
    }

    if (-not $process) {
        continue
    }

    $name = $process.Name
    $commandLine = if ($process.CommandLine) { $process.CommandLine } else { "" }
    $normalizedCommandLine = $commandLine -replace "/", "\\"
    $isNode = $name -ieq "node.exe"
    $isNextDev = $commandLine -match "next(\\.js)?\\s+dev"
    $isNextStartServer = $normalizedCommandLine -like "*next\dist\server\lib\start-server.js*"
    $isWorkspaceProcess = $commandLine -like "*$WorkspaceTag*"
    $isRepoProcess = $commandLine -like "*$repoRoot*"

    if ($isNode -and (($isNextDev -and $isWorkspaceProcess) -or ($isNextStartServer -and $isRepoProcess))) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Stopped stale Next.js process $processId on port $Port."
            $killedAny = $true
        } catch {
            Write-Host "Failed to stop process ${processId}: $($_.Exception.Message)"
            exit 1
        }
    } else {
        Write-Host "Port $Port is used by PID $processId ($name). Skipping because it does not look like apps/web next dev."
    }
}

if (-not $killedAny) {
    Write-Host "No stale apps/web Next.js dev process needed to be stopped."
}
