# RN Blank Template

React Native 0.75.4 starter for building any Android app.

## Creating a New App

From GitHub (recommended):
1. Go to github.com/yukee520/rn-blank-template
2. Click "Use this template" to create a new repo
3. In Termux: git clone <your-new-repo-url>
4. cd <your-new-repo>
5. ./scripts/new-app.sh MyApp com.yukee.myapp

From local template:
  cd ~/rn-blank-template && ./scripts/new-app.sh MyApp com.yukee.myapp

## Development
1. Edit App.tsx and src/ files
2. Push with: ./scripts/push.sh "message"
3. GitHub Actions builds APK automatically (~10 min)
4. Download APK from repo Actions tab

## Structure
src/components/ - reusable UI
src/screens/    - app screens
src/navigation/ - React Navigation
src/theme/      - colors, spacing
src/hooks/      - custom hooks
src/services/   - axios API clients
src/store/      - Zustand state
src/utils/      - helpers
scripts/        - new-app, push, setup-termux

## Libraries
Navigation, NativeWind, Styled Components, Reanimated,
Gesture Handler, Vector Icons, SVG, Linear Gradient,
Toast, Zustand, React Query, Axios, AsyncStorage,
NetInfo, WebView, Render HTML, Image Picker,
Permissions, Device Info, FS

## Build
APK builds run on GitHub Actions (Ubuntu).
Local Termux Gradle builds are NOT supported.
Debug APK only - no keystore needed.

## Design Notes
Package: com.rntest (renamed per-project by new-app.sh)
Old architecture (Bridge) + Hermes
TypeScript strict mode
Path alias: @/ -> src/
