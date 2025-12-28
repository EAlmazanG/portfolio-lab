#!/bin/bash
echo "Stopping PRODUCTION Environment..."
docker-compose -f docker-compose.yml down
echo "PRODUCTION Environment Stopped."

