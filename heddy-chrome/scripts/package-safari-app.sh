#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
extension_id=${1:-me.aitutors.heddy.safari}
version=$(node -p "require('./manifest.json').version")
project_dir="$PWD/dist/safari-$version"
if [ -e "$project_dir" ]; then
  printf 'Safari project already exists at %s\n' "$project_dir" >&2
  exit 1
fi

node scripts/package.mjs --browser=safari
resources=$(mktemp -d "${TMPDIR:-/tmp}/heddy-safari.XXXXXX")
trap 'rm -rf "$resources"' EXIT
unzip -q "dist/heddy-safari-$version.zip" -d "$resources"
xcrun safari-web-extension-packager "$resources" --project-location "$project_dir" \
  --app-name Heddy --bundle-identifier "$extension_id" --swift --copy-resources --no-open --no-prompt

# The manifest needs Safari 17.4, which ships with iOS 17.4 and macOS 14.4.
# Older systems would install the app but never load the extension.
sed -i '' \
  -e 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]*;/IPHONEOS_DEPLOYMENT_TARGET = 17.4;/g' \
  -e 's/MACOSX_DEPLOYMENT_TARGET = [0-9.]*;/MACOSX_DEPLOYMENT_TARGET = 14.4;/g' \
  "$project_dir/Heddy/Heddy.xcodeproj/project.pbxproj"

# Sharp app icons, rendered from icons/src/eyes-mark.svg by store/render/icons.mjs.
# The converter scales the 128 px store icon up, and its iOS icon keeps
# transparency, which App Store Connect rejects.
icons="$project_dir/Heddy/Shared (App)/Assets.xcassets/AppIcon.appiconset"
cp store/icons/appstore-icon-1024.png "$icons/universal-icon-1024@1x.png"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" store/icons/mac-icon-1024.png --out "$icons/mac-icon-$size@1x.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" store/icons/mac-icon-1024.png --out "$icons/mac-icon-$size@2x.png" >/dev/null
done
