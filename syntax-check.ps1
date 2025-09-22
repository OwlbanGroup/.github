# PowerShell script to check JavaScript syntax for multiple files
$files = @(
    "app.js",
    "financial-services.js",
    "financial-config.js",
    "financial-models.js"
)

Write-Host "Checking JavaScript syntax..." -ForegroundColor Green

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Checking $file..." -ForegroundColor Yellow
        try {
            node -c $file
            Write-Host "$file - Syntax OK" -ForegroundColor Green
        }
        catch {
            Write-Host "$file - Syntax Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    else {
        Write-Host "$file - File not found" -ForegroundColor Red
    }
}

Write-Host "Syntax check complete!" -ForegroundColor Green
