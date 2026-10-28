# restore_test.ps1 - proves the newest backup works: restores it into a spare database
# on this laptop, counts the records, then removes the spare database.
# Run it from the project folder:   .\scripts\restore_test.ps1
# It asks once for the laptop's own PostgreSQL password (not the Supabase one).

$pg   = "C:\Program Files\PostgreSQL\18\bin"
$db   = "autokita_restore_test"
$file = (Get-ChildItem "$HOME\AutoKita-Backups\*.dump" | Sort-Object LastWriteTime | Select-Object -Last 1).FullName

if (-not $file) { throw "No backup file found in $HOME\AutoKita-Backups. Run backup_db.ps1 first." }
Write-Host "Testing backup: $file"

# Ask for the password without showing it, and give it to the tools for this run only.
$secure = Read-Host "Laptop PostgreSQL password" -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new("", $secure).Password

& "$pg\dropdb.exe"     -U postgres --if-exists $db
& "$pg\createdb.exe"   -U postgres $db
& "$pg\pg_restore.exe" -U postgres -d $db --no-owner --no-privileges $file
& "$pg\psql.exe"       -U postgres -d $db -c "SELECT (SELECT count(*) FROM users) AS customers, (SELECT count(*) FROM job_orders) AS job_orders, (SELECT count(*) FROM payments) AS payments;"
& "$pg\dropdb.exe"     -U postgres $db

Remove-Item Env:PGPASSWORD
