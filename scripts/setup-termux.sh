#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# setup-termux.sh — One-time environment check for Termux
# ============================================================
# Run this after cloning on a fresh Termux install.
# Verifies: node, java, android sdk, paths.
# ============================================================

echo "🔍 Checking Termux environment..."
echo ""

FAIL=0

# Node
if command -v node >/dev/null 2>&1; then
  echo "✅ Node:    $(node -v)"
else
  echo "❌ Node:    NOT FOUND. Install: pkg install nodejs-lts"
  FAIL=1
fi

# npm
if command -v npm >/dev/null 2>&1; then
  echo "✅ npm:     $(npm -v)"
else
  echo "❌ npm:     NOT FOUND"
  FAIL=1
fi

# Java
if command -v java >/dev/null 2>&1; then
  echo "✅ Java:    $(java -version 2>&1 | head -1)"
else
  echo "❌ Java:    NOT FOUND. Install: pkg install openjdk-17"
  FAIL=1
fi

# ANDROID_HOME
if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
  echo "✅ ANDROID_HOME: $ANDROID_HOME"
else
  echo "❌ ANDROID_HOME not set or invalid"
  echo "   Add to ~/.bashrc: export ANDROID_HOME=\$HOME/android-sdk"
  FAIL=1
fi

# git
if command -v git >/dev/null 2>&1; then
  echo "✅ git:     $(git --version)"
else
  echo "❌ git:     NOT FOUND. Install: pkg install git"
  FAIL=1
fi

# gh
if command -v gh >/dev/null 2>&1; then
  echo "✅ gh CLI:  $(gh --version | head -1)"
else
  echo "⚠️  gh CLI:  NOT FOUND (optional but recommended). Install: pkg install gh"
fi

echo ""
if [ $FAIL -eq 0 ]; then
  echo "🎉 Environment looks good! You're ready to build."
  echo ""
  echo "Note: APK builds run on GitHub Actions, not locally."
  echo "      Just push and let the cloud do the work. ☁️"
else
  echo "⚠️  Some issues found. Fix them and re-run this script."
fi
