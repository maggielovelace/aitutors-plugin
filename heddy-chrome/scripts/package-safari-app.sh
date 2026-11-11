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
