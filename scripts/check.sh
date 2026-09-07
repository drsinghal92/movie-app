#!/usr/bin/env bash
# Fast, advisory. Runs on every Edit/Write via the PostToolUse hook.
# Reads the edited file from the hook payload on stdin and typechecks only the
# package that owns it. Skips file types that cannot change a typecheck result.
# Run by hand with no stdin, it falls back to checking every package under code/,
# with a root fallback for brownfield layouts. Never blocks, always exits 0.
#
# Lint is deliberately not in this hot path, it runs in scripts/test.sh and CI.
# The naive ancestor of this script (typecheck plus lint, every package, every
# write) ran seconds per fire and fires on every edit, so a build session paid
# it hundreds of times. Keep this scoped.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 0

# --- What was edited? Empty when invoked manually.
payload=""
[ -t 0 ] || payload="$(cat 2>/dev/null || true)"

edited=""
if [ -n "$payload" ]; then
  edited="$(printf '%s' "$payload" | node -e '
    let s = "";
    process.stdin.on("data", d => s += d).on("end", () => {
      try {
        const j = JSON.parse(s);
        process.stdout.write(j.tool_input?.file_path || "");
      } catch { /* unparseable payload, fall back to checking everything */ }
    });
  ' 2>/dev/null || true)"
fi

# --- Only TypeScript sources can change a typecheck result.
if [ -n "$edited" ]; then
  case "$edited" in
    *.ts|*.tsx|*.mts|*.cts) ;;
    *) exit 0 ;;
  esac
fi

check_pkg() {
  local dir="$1"
  [ -f "$dir/package.json" ] || return 0
  (cd "$dir" && node -e 'process.exit(require("./package.json").scripts?.typecheck ? 0 : 1)') 2>/dev/null || return 0
  echo "[check] $dir typecheck"
  (cd "$dir" && npm run typecheck --silent 2>&1 | tail -20) || true
}

check_all() {
  local found=0
  if [ -d code ]; then
    for d in code/*/; do
      if [ -f "${d%/}/package.json" ]; then check_pkg "${d%/}"; found=1; fi
    done
  fi
  [ "$found" -eq 0 ] && check_pkg .
  return 0
}

# --- Which packages does this edit affect?
# A shared contract directory is the one edit that crosses package boundaries
# (a frontend tsconfig may pull in backend/src/contract), so a contract edit
# checks every package. Anything else checks only its owning package.
case "$edited" in
  *"/code/"*"/src/contract/"*) check_all ;;
  *"/code/"*)
    pkg="code/$(printf '%s' "$edited" | sed -E 's#.*/code/([^/]+)/.*#\1#')"
    if [ -f "$pkg/package.json" ]; then check_pkg "$pkg"; else check_all; fi
    ;;
  *) check_all ;;
esac

exit 0
