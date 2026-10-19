# backup_db.ps1 - saves a dated copy of the AutoKita database outside the project.
# Run it from the project folder:   .\scripts\backup_db.ps1
# It asks for the database password (DB_PASSWORD in .env.local).

$pgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
$folder = "$HOME\AutoKita-Backups"
$file   = "$folder\autokita_$(Get-Date -Format 'yyyy-MM-dd_HHmm').dump"

# Read the database address and user from the settings file.
$dbHost = (Select-String -Path ".env.local" -Pattern "^DB_HOST=").Line.Split("=", 2)[1].Trim()
$dbUser = (Select-String -Path ".env.local" -Pattern "^DB_USER=").Line.Split("=", 2)[1].Trim()

New-Item -ItemType Directory -Force $folder | Out-Null

# Port 5432 is the one a backup needs (the website uses 6543).
& $pgDump --host=$dbHost --port=5432 --username=$dbUser --dbname=postgres `
    --schema=public --no-owner --format=custom --file=$file

Write-Host "Saved to $file"
