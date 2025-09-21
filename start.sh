#!/bin/bash

echo "🚀 Starting Nubia Excel Add-in..."

# Start backend server
echo "📡 Starting backend server on port 3001..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start add-in dev server
echo "🌐 Starting add-in dev server on port 3000..."
cd add-in && npm run dev &
ADDIN_PID=$!

# Wait for dev server to start
sleep 5

# Sideload to Excel
echo "📊 Loading add-in in Excel..."
cd add-in && npx office-addin-dev-settings sideload manifest.xml

echo "✅ Nubia is running!"
echo "Backend PID: $BACKEND_PID"
echo "Add-in PID: $ADDIN_PID"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $ADDIN_PID; exit" INT
wait