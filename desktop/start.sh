#!/bin/bash
echo "Starting Nubia..."
cd desktop
npm start &
sleep 5
npx electron public/electron.js