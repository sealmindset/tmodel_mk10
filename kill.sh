#!/bin/bash
for port in {3000..3010}; do
  pid=$(lsof -ti tcp:$port)
  if [ -n "$pid" ]; then
    echo "Killing PID $pid on port $port"
    kill -9 $pid
  fi
done

# Kill any running PostgREST process
pkill -f postgrest

clear
clear

# Start PostgREST with proper schema configuration
echo "Starting PostgREST with reports schema..."
# Using configuration file directly instead of environment variables
# This ensures proper schema isolation for the reports schema
postgrest postgrest.conf > postgrest.log 2>&1 &
echo "PostgREST started with PID: $!"
# Wait a moment to ensure PostgREST is running
sleep 2

# Start your app
node app.js