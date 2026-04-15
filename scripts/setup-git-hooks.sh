#!/usr/bin/env sh
set -eu

git config core.hooksPath .githooks
chmod +x .githooks/pre-push
chmod +x scripts/auto-bump-from-commits.sh

echo "[hooks] core.hooksPath configured to .githooks"