# setup.ps1 - Quickstart script for DisciplineOS

Write-Host "Starting DisciplineOS Setup..." -ForegroundColor Cyan

# 1. Build and start containers in detached mode
Write-Host "Building and starting containers..." -ForegroundColor Green
docker compose up -d --build

# 2. Wait for DB to be ready (brief pause)
Write-Host "Waiting for database to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 3. Initialize the database (tables)
Write-Host "Creating database tables..." -ForegroundColor Green
docker compose exec backend python init_db.py

# 4. Seed with demo data
Write-Host "Seeding demo data (tester@example.com / password123)..." -ForegroundColor Green
docker compose exec backend python seed_data.py

Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "------------------------------------------------"
Write-Host "Frontend: http://localhost:5173"
Write-Host "API Docs: http://localhost:8000/docs"
Write-Host "------------------------------------------------"
Write-Host "Run 'docker compose logs -f' to see real-time output."
Write-Host "To stop the project, run './stop.ps1'."
