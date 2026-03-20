#!/bin/bash
# setup.sh - Quickstart script for DisciplineOS

echo "🚀 Starting DisciplineOS Setup..."

# 1. Build and start containers in detached mode
echo "📦 Building and starting containers..."
docker compose up -d --build

# 2. Wait for DB to be ready (brief pause)
echo "⏳ Waiting for database to initialize..."
sleep 5

# 3. Initialize the database (tables)
echo "🏗️ Creating database tables..."
docker compose exec backend python init_db.py

# 4. Optional: Seed with demo data
# If you want to use the demo account (test@example.com / password123),
# run: docker compose exec backend python seed_data.py

echo "✅ Setup Complete!"
echo "------------------------------------------------"
echo "Frontend: http://localhost:5173"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Next Steps:"
echo "1. Go to http://localhost:5173/register to create your account."
echo "2. Or run 'docker compose exec backend python seed_data.py' for demo data."
echo "------------------------------------------------"
echo "Run 'docker compose logs -f' to see real-time output."
echo "To stop the project, run './stop.sh'."
