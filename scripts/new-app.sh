#!/data/data/com.termux/files/usr/bin/bash
# new-app.sh - Create a new project from the template
# Usage: ./scripts/new-app.sh MyAppName com.yourname.myapp

set -e

APP_NAME="$1"
PACKAGE_NAME="$2"

if [ -z "$APP_NAME" ] || [ -z "$PACKAGE_NAME" ]; then
  echo "Usage: $0 <AppName> <com.yourname.appname>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_DIR="$(cd "$TEMPLATE_DIR/.." && pwd)"
NEW_DIR="$PARENT_DIR/$APP_NAME"

if [ -d "$NEW_DIR" ]; then
  echo "Directory already exists: $NEW_DIR"
  exit 1
fi

if ! echo "$PACKAGE_NAME" | grep -qE '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'; then
  echo "Invalid package name: $PACKAGE_NAME"
  exit 1
fi

echo "Creating new app: $APP_NAME"
echo "Package: $PACKAGE_NAME"
echo "Location: $NEW_DIR"

echo "Copying template..."
rsync -a \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='android/.gradle' \
  --exclude='android/app/build' \
  --exclude='android/build' \
  --exclude='*.bak' \
  "$TEMPLATE_DIR/" "$NEW_DIR/"

cd "$NEW_DIR"

git init -q
git branch -m main

OLD_PACKAGE="com.rntest"
echo "Renaming package: $OLD_PACKAGE -> $PACKAGE_NAME"

for f in \
  android/app/build.gradle \
  android/app/src/main/java/com/rntest/MainActivity.kt \
  android/app/src/main/java/com/rntest/MainApplication.kt
do
  if [ -f "$f" ]; then
    sed -i "s|$OLD_PACKAGE|$PACKAGE_NAME|g" "$f"
  fi
done

OLD_JAVA_DIR="android/app/src/main/java/com/rntest"
NEW_JAVA_DIR="android/app/src/main/java/$(echo "$PACKAGE_NAME" | tr '.' '/')"
if [ -d "$OLD_JAVA_DIR" ]; then
  mkdir -p "$(dirname "$NEW_JAVA_DIR")"
  mv "$OLD_JAVA_DIR" "$NEW_JAVA_DIR"
  rmdir "android/app/src/main/java/com/rntest" 2>/dev/null || true
  rmdir "android/app/src/main/java/com" 2>/dev/null || true
fi

echo "Updating app name in MainActivity.kt..."
MAIN_ACTIVITY=$(find android/app/src/main/java -name "MainActivity.kt" | head -1)
if [ -n "$MAIN_ACTIVITY" ]; then
  sed -i "s|getMainComponentName(): String = \".*\"|getMainComponentName(): String = \"$APP_NAME\"|" "$MAIN_ACTIVITY"
  echo "  Fixed: $MAIN_ACTIVITY"
fi

echo "Updating app.json..."
cat > app.json << APPJSON_EOF
{
  "name": "$APP_NAME",
  "displayName": "$APP_NAME"
}
APPJSON_EOF

echo "Updating strings.xml..."
sed -i "s|<string name=\"app_name\">.*</string>|<string name=\"app_name\">$APP_NAME</string>|" android/app/src/main/res/values/strings.xml

echo "Updating settings.gradle..."
sed -i "s|rootProject.name = '.*'|rootProject.name = '$APP_NAME'|" android/settings.gradle

echo "Updating package.json..."
NPM_NAME=$(echo "$APP_NAME" | sed 's/\([A-Z]\)/-\L\1/g' | sed 's/^-//')
sed -i "s|\"name\": \".*\"|\"name\": \"$NPM_NAME\"|" package.json

echo ""
echo "Installing npm dependencies (takes a few minutes)..."
npm install

echo ""
echo "============================================"
echo " New app created successfully!"
echo "============================================"
echo ""
echo "Location:  $NEW_DIR"
echo "App name:  $APP_NAME"
echo "Package:   $PACKAGE_NAME"
echo ""
echo "Next steps:"
echo "  cd $NEW_DIR"
echo "  ./scripts/push.sh"
