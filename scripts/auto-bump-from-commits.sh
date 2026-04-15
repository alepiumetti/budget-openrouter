#!/usr/bin/env sh
set -eu

BUMP_COMMIT_PREFIX="chore(release): bump version to"

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [ "$current_branch" = "HEAD" ]; then
  echo "[bump] Detached HEAD, skipping automatic version bump."
  exit 0
fi

latest_subject="$(git log -1 --pretty=%s 2>/dev/null || true)"
case "$latest_subject" in
  "$BUMP_COMMIT_PREFIX"*)
    echo "[bump] Latest commit is already an auto bump commit, skipping."
    exit 0
    ;;
esac

if upstream_ref="$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null)"; then
  :
elif git show-ref --verify --quiet refs/remotes/origin/main; then
  upstream_ref="origin/main"
else
  echo "[bump] No upstream configured and origin/main does not exist. Skipping."
  exit 0
fi

if ! git rev-parse --verify --quiet "$upstream_ref" >/dev/null; then
  echo "[bump] Upstream ref '$upstream_ref' not found. Skipping."
  exit 0
fi

commit_range="$upstream_ref..HEAD"

if ! git rev-list --quiet "$commit_range" >/dev/null 2>&1; then
  echo "[bump] Invalid commit range '$commit_range'. Skipping."
  exit 0
fi

if [ "$(git rev-list --count "$commit_range")" -eq 0 ]; then
  echo "[bump] No commits pending push."
  exit 0
fi

messages="$(git log --format=%s%n%b "$commit_range")"

bump_type=""

if printf '%s\n' "$messages" | grep -Eqi '(^|[^A-Z])(FEAT|FT)($|[^A-Z])'; then
  bump_type="major"
elif printf '%s\n' "$messages" | grep -Eqi '(^|[^A-Z])REF($|[^A-Z])'; then
  bump_type="minor"
elif printf '%s\n' "$messages" | grep -Eqi '(^|[^A-Z])(FIX|ADD|DOC|PATCH)($|[^A-Z])'; then
  bump_type="patch"
fi

if [ -z "$bump_type" ]; then
  echo "[bump] No bump keywords found in commits to push."
  exit 0
fi

echo "[bump] Selected bump type: $bump_type"

npm version "$bump_type" --no-git-tag-version >/dev/null

new_version="$(node -p "require('./package.json').version")"

git add package.json
if [ -f package-lock.json ]; then
  git add package-lock.json
fi

if git diff --cached --quiet; then
  echo "[bump] No version changes staged after bump."
  exit 0
fi

git commit -m "$BUMP_COMMIT_PREFIX v$new_version [skip bump]"

echo "[bump] Created bump commit for version v$new_version"
exit 20