#!/bin/bash
echo "Starting PRODUCTION Environment..."
docker-compose -f docker-compose.yml up --build -d
echo "PRODUCTION Environment Started! 🚀"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3001"

