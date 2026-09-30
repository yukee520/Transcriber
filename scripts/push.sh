#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# push.sh — Quick commit + push helper
# ============================================================
# Usage:
#   ./scripts/push.sh                     # auto-commit message
#   ./scripts/push.sh "custom message"
#
# If no remote exists, offers to create one via gh CLI.
# ============================================================

set -e

MSG="${1:-Auto commit $(date '+%Y-%m-%d %H:%M')}"

if [ ! -d ".git" ]; then
  echo "❌ Not a git repository. Run 'git init' first."
  exit 1
fi

# Check if remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "⚠️  No git remote 'origin' set."
  read -p "Create GitHub repo now? (y/n): " CREATE
  if [ "$CREATE" = "y" ]; then
    REPO_NAME=$(basename "$(pwd)")
    read -p "Repo name [$REPO_NAME]: " INPUT_NAME
    REPO_NAME="${INPUT_NAME:-$REPO_NAME}"
    read -p "Public or private [public]: " VIS
    VIS="${VIS:-public}"

    if [ "$VIS" = "private" ]; then
      gh repo create "$REPO_NAME" --private --source=. --remote=origin
    else
      gh repo create "$REPO_NAME" --public --source=. --remote=origin
    fi
  else
    echo "❌ Cannot push without remote."
    exit 1
  fi
fi

echo "📤 Staging changes..."
git add -A

if git diff --cached --quiet; then
  echo "ℹ️  No changes to commit."
else
  git commit -m "$MSG"
fi

echo "📤 Pushing to origin..."
git push -u origin main

echo ""
echo "✅ Pushed! Check GitHub Actions for build progress:"
REMOTE_URL=$(git remote get-url origin | sed 's/\.git$//')
echo "   $REMOTE_URL/actions"
echo ""
