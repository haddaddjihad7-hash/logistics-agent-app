param(
    [string]$EnvFile = ".env"
)

if (-not (Test-Path $EnvFile)) {
    Copy-Item .env.example $EnvFile
}

$lines = Get-Content $EnvFile
$updated = $lines | ForEach-Object {
    if ($_ -match '^(API_KEY|JWT_SECRET|POSTGRES_PASSWORD)=') {
        $name = $_.Split('=')[0]
        "$name=$([Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 })))"
    }
    else {
        $_
    }
}
Set-Content -Path $EnvFile -Value $updated
Write-Output "Rotated API_KEY, JWT_SECRET, and POSTGRES_PASSWORD in $EnvFile"
