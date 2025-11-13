#!/bin/bash

# Microphone Permission Quick Fix Script
echo "🎤 Fixing Microphone Permissions for EduDash Pro"
echo "================================================"
echo ""

# Check if device is connected
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device connected via ADB"
    echo "Please connect your device and enable USB debugging"
    exit 1
fi

echo "✅ Device connected"
echo ""

# Step 1: Force grant microphone permission
echo "Step 1: Granting RECORD_AUDIO permission..."
adb shell cmd appops set com.edudashpro RECORD_AUDIO allow
echo "✅ Permission granted via appops"
echo ""

# Step 2: Also grant via pm (package manager)
echo "Step 2: Granting permission via package manager..."
adb shell pm grant com.edudashpro android.permission.RECORD_AUDIO 2>/dev/null || echo "Already granted"
echo "✅ Permission granted via pm"
echo ""

# Step 3: Verify permission status
echo "Step 3: Verifying permission status..."
echo "Current permissions for com.edudashpro:"
adb shell dumpsys package com.edudashpro | grep -A 1 "RECORD_AUDIO"
echo ""

# Step 4: Restart the app
echo "Step 4: Restarting app..."
adb shell am force-stop com.edudashpro
sleep 1
adb shell am start -n com.edudashpro/.MainActivity
echo "✅ App restarted"
echo ""

echo "================================================"
echo "✅ Done! Microphone permission should now work."
echo ""
echo "Next steps:"
echo "1. Open the app on your device"
echo "2. Try recording a voice message"
echo "3. Check logs with: adb logcat | grep Dash"
echo ""
echo "If it still doesn't work, run:"
echo "  adb shell pm clear com.edudashpro"
echo "  (This will clear all app data and force a fresh permission request)"
