#!/bin/sh
# Gera mcp/dist/Icarus.mcpb — a extensão de Desktop do Icarus.
# Uso: sh mcp/build-mcpb.sh  (na raiz do repo ou em mcp/)
set -e
cd "$(dirname "$0")/mcpb-build"
cp ../server.mjs server/server.mjs
npm install --omit=dev --silent
npx --yes @anthropic-ai/mcpb pack . ../dist/Icarus.mcpb
