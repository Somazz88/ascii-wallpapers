#!/bin/sh
# Rebuild chrome/content.js from chrome/src/content.ts and the shared scenes in hooks/scenes.ts.
cd "$(dirname "$0")" && npx --yes esbuild src/content.ts --bundle --format=iife --target=chrome110 --legal-comments=none --outfile=content.js
