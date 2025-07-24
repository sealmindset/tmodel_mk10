#!/bin/bash

# Script to manage PostgREST service with proper configuration
# Usage: ./manage-postgrest.sh [start|stop|restart|status]

POSTGREST_PID_FILE="postgrest.pid"
POSTGREST_LOG_FILE="postgrest.log"
POSTGREST_CONFIG_FILE="postgrest.conf"

# Function to check if PostgREST is running
is_postgrest_running() {
  if [ -f "$POSTGREST_PID_FILE" ]; then
    pid=$(cat $POSTGREST_PID_FILE)
    if ps -p $pid > /dev/null; then
      return 0  # Running
    fi
  fi
  return 1  # Not running
}

# Function to start PostgREST
start_postgrest() {
  if is_postgrest_running; then
    echo "PostgREST is already running with PID $(cat $POSTGREST_PID_FILE)"
    return 0
  fi
  
  echo "Starting PostgREST with configuration from $POSTGREST_CONFIG_FILE..."
  postgrest $POSTGREST_CONFIG_FILE > $POSTGREST_LOG_FILE 2>&1 &
  pid=$!
  echo $pid > $POSTGREST_PID_FILE
  echo "PostgREST started with PID: $pid"
  
  # Wait a moment to ensure PostgREST started properly
  sleep 2
  
  # Verify it's actually running
  if is_postgrest_running; then
    echo "PostgREST is running correctly."
  else
    echo "Failed to start PostgREST. Check logs for details."
    return 1
  fi
}

# Function to stop PostgREST
stop_postgrest() {
  if is_postgrest_running; then
    pid=$(cat $POSTGREST_PID_FILE)
    echo "Stopping PostgREST with PID $pid..."
    kill $pid
    sleep 1
    
    # Check if it's still running and force kill if needed
    if ps -p $pid > /dev/null; then
      echo "PostgREST still running, using force kill..."
      kill -9 $pid
    fi
    
    rm -f $POSTGREST_PID_FILE
    echo "PostgREST stopped."
  else
    echo "PostgREST is not running."
  fi
}

# Function to show PostgREST status
show_status() {
  if is_postgrest_running; then
    pid=$(cat $POSTGREST_PID_FILE)
    echo "PostgREST is running with PID $pid"
    echo "Configuration file: $POSTGREST_CONFIG_FILE"
    echo "Log file: $POSTGREST_LOG_FILE"
    
    # Show configured schemas from config file
    echo -n "Exposed schemas: "
    grep "db-schemas" $POSTGREST_CONFIG_FILE
    
    # Test endpoint access
    echo "Testing endpoint availability:"
    curl -s http://localhost:3010/ | grep -o '"\/[^"]*"' | sort | head -n 5
  else
    echo "PostgREST is not running."
  fi
}

# Main script execution
case "$1" in
  start)
    start_postgrest
    ;;
  stop)
    stop_postgrest
    ;;
  restart)
    stop_postgrest
    sleep 2
    start_postgrest
    ;;
  status)
    show_status
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac

exit 0
