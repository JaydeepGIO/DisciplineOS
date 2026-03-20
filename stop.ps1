# stop.ps1 - Stop script for DisciplineOS

Write-Host "Stopping DisciplineOS..." -ForegroundColor Cyan

# Stop and remove containers, networks, and volumes
docker compose down

Write-Host "DisciplineOS stopped!" -ForegroundColor Cyan
