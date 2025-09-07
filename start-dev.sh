#!/bin/bash

echo "🚀 Starting Nubia Development Environment"
echo "========================================="
echo ""

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start backend
echo "📦 Starting Backend Server (port 3001)..."
BACKEND_PORT=3001 node backend/src/server-simple.js &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 2

# Test backend health
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is healthy!"
else
    echo "❌ Backend failed to start"
    exit 1
fi

echo ""
echo "========================================="
echo "✅ Development environment is ready!"
echo ""
echo "📝 Available endpoints:"
echo "   Backend API: http://localhost:3001/api"
echo "   Health Check: http://localhost:3001/api/health"
echo "   Auth: http://localhost:3001/api/auth/[login|register|me]"
echo "   Chat: http://localhost:3001/api/chat"
echo ""
echo "🛠️  To start the frontend:"
echo "   cd desktop && npm start"
echo ""
echo "🛑 Press Ctrl+C to stop all services"
echo ""

# Keep script running and handle cleanup
trap "echo ''; echo '🛑 Shutting down...'; kill $BACKEND_PID 2>/dev/null; exit" INT TERM

# Wait for background process
wait $BACKEND_PID