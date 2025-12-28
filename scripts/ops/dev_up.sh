#!/bin/bash
echo "Starting Development Environment..."
docker-compose -f docker-compose.dev.yml up --build -d
echo "Development Environment Started! 🚀"
echo "Backend: http://localhost:8000/docs"
echo "Frontend: http://localhost:3001"
echo "Database: localhost:5432"

