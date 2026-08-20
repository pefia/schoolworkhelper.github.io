#!/usr/bin/env bash
set -euo pipefail

engine_dir="cs16/engine"
rm -rf "$engine_dir"
git clone --depth 1 --recurse-submodules \
  https://github.com/yohimik/webxash3d-fwgs.git "$engine_dir"
rm -rf "$engine_dir/.git"

if [[ ! -f "$engine_dir/index.html" ]]; then
  echo "WebXash checkout did not provide an index.html entry point" >&2
  exit 1
fi

# Give the service worker an exhaustive, build-specific list rather than
# guessing which resources the engine may request at runtime.
find "$engine_dir" -type f -printf '/%p\n' | LC_ALL=C sort \
  | python3 -c 'import json, sys; json.dump([line.rstrip("\n") for line in sys.stdin], sys.stdout)' \
  > cs16/offline-assets.json
