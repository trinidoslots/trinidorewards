<#
    Gives points to everyone who was in chat recently, from a Stream Deck button.

    Posts to /api/control/points/grant. Everything that decides who gets paid
    lives on the server; this file only says how much and how far back.

    Not called directly by the Stream Deck — the "System: Open" action runs a
    file but passes no arguments, so each button gets its own .bat wrapper.
    See grant-500.bat.example and README.md.
#>

param(
    # Points per person. The route refuses anything above 10000.
    [Parameter(Mandatory = $true)]
    [int] $Points,

    # How far back "active" reaches, in minutes.
    [int] $Minutes = 3
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$configPath = Join-Path $here "config.ps1"
if (-not (Test-Path $configPath)) {
    throw "config.ps1 is missing. Copy config.ps1.example to config.ps1 and fill in the key."
}
. $configPath

if (-not $SiteUrl -or -not $ControlApiKey -or $ControlApiKey -like "PASTE_*") {
    throw "config.ps1 is not filled in yet."
}

# One key per press, not per request. A press that fails halfway and is retried
# below reuses it, so the grant lands exactly once; the next press makes a new
# one and pays out again, which is what pressing the button twice should mean.
$idempotencyKey = [guid]::NewGuid().ToString()

$body = @{
    windowMinutes  = $Minutes
    pointsEach     = $Points
    idempotencyKey = $idempotencyKey
    grantedBy      = "stream-deck"
} | ConvertTo-Json -Compress

$headers = @{
    "Authorization" = "Bearer $ControlApiKey"
    "Content-Type"  = "application/json"
}

$uri = "$($SiteUrl.TrimEnd('/'))/api/control/points/grant"
$logPath = Join-Path $here "grant-log.txt"

function Write-Log([string] $line) {
    "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $line | Add-Content -Path $logPath -Encoding utf8
}

<#
    A balloon, not a MessageBox. A modal dialog waits for a click, which during
    a stream means it sits over the scene until somebody alt-tabs to it; this
    one dismisses itself. The sleep is not decoration — the balloon dies with
    the process, and the script would otherwise exit before it is drawn.
#>
function Notify([string] $title, [string] $text) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $icon = New-Object System.Windows.Forms.NotifyIcon
        $icon.Icon = [System.Drawing.SystemIcons]::Warning
        $icon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning
        $icon.BalloonTipTitle = $title
        $icon.BalloonTipText = $text
        $icon.Visible = $true
        $icon.ShowBalloonTip(8000)
        Start-Sleep -Seconds 6
        $icon.Dispose()
    }
    catch {
        # Never let the notice itself be what breaks the button — the line is
        # already in the log either way.
    }
}

# Two attempts. A dropped connection can mean the grant landed and the answer
# was lost, so the second attempt carries the same key rather than a fresh one.
$attempt = 0
$result = $null
while ($true) {
    $attempt++
    try {
        $result = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -TimeoutSec 15
        break
    }
    catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int] $_.Exception.Response.StatusCode }

        # A 4xx is the request itself being wrong — a bad key, too many points.
        # Repeating it changes nothing, so it fails loudly straight away.
        if ($attempt -ge 2 -or ($status -ge 400 -and $status -lt 500)) {
            # No status at all means the request never reached the site, which
            # reads very differently from a rejection — say so rather than
            # printing "HTTP " and leaving it to be guessed.
            $where = if ($status) { "HTTP $status" } else { "no response" }
            $message = "Grant failed ($where): $($_.Exception.Message)"
            Write-Log $message
            Notify "Points grant failed" $message
            exit 1
        }
        Start-Sleep -Milliseconds 700
    }
}

if ($result.reused) {
    Write-Log "Already applied: $($result.pointsEach) each, $($result.userCount) users (key reused)"
}
else {
    Write-Log "Granted $($result.pointsEach) to $($result.userCount) users over $($result.windowMinutes) min (total $($result.totalPoints))"
}

# Nobody in the window is not an error, but it is worth noticing: it usually
# means the chat recorder is not running, not that chat was quiet.
if ($result.userCount -eq 0) {
    Write-Log "WARNING: nobody matched. Check that the chat recorder source is live in OBS."
}
