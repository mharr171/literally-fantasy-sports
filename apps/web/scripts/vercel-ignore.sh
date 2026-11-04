#!/bin/sh
# Vercel "Ignored Build Step" (D100). Runs from apps/web before each build.
# Exit 0 skips the build; exit 1 builds. Skips only when nothing the site is
# built from changed since this branch's last deployment (docs, CI files,
# database tests…). When in doubt, it builds.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo "No earlier deployment to compare with: building."
  exit 1
fi
# docs/legal: the privacy policy and terms pages are built from it.
if git diff --quiet "$base" HEAD -- . ../../packages ../../docs/legal \
  ../../package.json ../../pnpm-lock.yaml ../../pnpm-workspace.yaml \
  ../../turbo.json; then
  echo "Nothing the site is built from changed since $base: skipping."
  exit 0
fi
echo "Site files changed since $base: building."
exit 1
