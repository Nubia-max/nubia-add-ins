#!/bin/bash
echo "=== NUBIA EXCEL AUTOMATION TEST ==="
echo "Starting app..."
cd /Users/wikiwoo/Nubia/desktop

# Kill any existing processes
pkill -f "npm start"
pkill -f "electron"
sleep 2

echo "Starting React dev server..."
npm start &
REACT_PID=$!
sleep 8

echo "Starting Electron app..."
npx electron public/electron.js &
ELECTRON_PID=$!
sleep 5

echo ""
echo "🚀 App should be running now!"
echo ""
echo "MANUAL TEST STEPS:"
echo "1. Click the purple bubble to open chat"
echo "2. Type EXACTLY: 'record sales to bola for 5000'"
echo "3. Press Enter"
echo "4. Watch console logs below for automation proof"
echo "5. Check if Microsoft Excel actually opens"
echo ""
echo "Console output will show:"

# Monitor the electron process output
wait $ELECTRON_PID

echo ""
echo "Test completed. Cleaning up..."
kill $REACT_PID 2>/dev/null
kill $ELECTRON_PID 2>/dev/null