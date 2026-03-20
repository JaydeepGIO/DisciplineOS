#!/bin/bash
# stop.sh - Stop script for DisciplineOS

echo "🛑 Stopping DisciplineOS..."

# Stop and remove containers, networks, and volumes
docker compose down

echo "✅ DisciplineOS stopped!"
