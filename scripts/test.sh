#!/usr/bin/env bash
# The enforced test gate. The qa agent runs this. A non-zero exit means the story is not done.
# Runs the typecheck and test scripts of every package under code/ (frontend,
# backend, db), falls back to a root package.json for brownfield apps that keep
# their own layout.
#
# Typecheck joins the gate on 2026-07-26. A transpiling test runner executes
# code that does not typecheck, so a suite can be green while the build is
# broken. That is not theoretical, it happened, and where a project has not
# armed CI this script is the only thing that would catch it. See
# docs/DECISIONS.md for whether CI is armed in this repo.
#
# A package opts in by DEFINING a `typecheck` script, so a new slot is covered
# the moment it has one and no list here goes stale. Both run even when the
# first fails, so one invocation reports everything rather than making you
# re-run to find the next problem.
#
# The name match is ANCHORED, unlike the equivalent in ci.yml, which is not.
# Anchoring matters because `npm run` lists every script, so an unanchored
# `test` also matches `test:unit` and the script would then call `npm test`,
# which does not exist, and fail on Missing script. Anchored, it says so
# plainly instead.
#
# A package that has SOMETHING to run and no bare `test` is a hard failure
# rather than a skip, see run_pkg, because skipping it would run zero tests and
# exit 0. Something to run means it defines a `typecheck` script or any
# `test:`-prefixed script. A package with neither is a scaffold and passes.
#
# The contract limit, stated rather than hidden. Test script names cannot be
# enumerated, so a package whose tests hide under a name matching neither
# pattern, `spec` say, still runs nothing and exits 0. The bare `test` script
# is the contract. These two heuristics only catch the common ways of missing
# it, they do not replace it.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

ran=0
fail=0

has_script() {
  (cd "$1" && npm run 2>/dev/null | grep -qE "^[[:space:]]+$2\$")
}

# Any `test:`-prefixed script, the namespaced-tests shape. Used only to decide
# whether a package HAS something to test, never to run anything, since the
# real contract is a bare `test` script.
has_namespaced_tests() {
  (cd "$1" && npm run 2>/dev/null | grep -qE "^[[:space:]]+test:")
}

run_pkg() {
  local dir="$1"
  local typechecks=0
  [ -f "$dir/package.json" ] || return 0
  if has_script "$dir" typecheck; then
    typechecks=1
    echo "[typecheck] $dir"
    if ! (cd "$dir" && npm run typecheck --silent); then
      fail=1
    fi
    ran=1
  fi
  if has_script "$dir" test; then
    echo "[test] $dir"
    if ! (cd "$dir" && npm test --silent); then
      fail=1
    fi
    ran=1
  elif [ "$typechecks" -eq 1 ] || has_namespaced_tests "$dir"; then
    # A package that typechecks is real code, so it owes tests. Without this it
    # would typecheck, run ZERO tests, and exit 0, which is a silent green on
    # the only enforced layer and the worst outcome this script can produce.
    # The usual cause is tests living under namespaced names (test:unit,
    # test:e2e) with no bare `test`, since the detection below is anchored.
    #
    # Scoped to packages that HAVE something to run ON PURPOSE, meaning they
    # define a typecheck script or a test:-prefixed one. A bare scaffold, a
    # package.json with only a build script or no scripts at all, is not a
    # failure, it is a project that has not written code yet, and failing it
    # would mean the first story of every new project could never pass. The
    # test: arm exists because a plain JS package with test:unit and no
    # typecheck would otherwise run nothing and exit 0, which the previous
    # version of this script caught and an earlier draft of this one did not.
    #
    # `ran=1` is LOAD-BEARING, do not remove it as redundant. A package that
    # reaches this branch through the test: arm alone, with no typecheck
    # script, has not set `ran` anywhere above, so without this the final
    # `if [ "$ran" -eq 0 ]` returns 0 and swallows the failure. That exact
    # swallow shipped once already and was caught in review.
    echo "[gate] $dir has something to run but no \"test\" script, so nothing was tested."
    echo "[gate] Add a \"test\" script. If tests live under names like test:unit, have it call them."
    echo "[gate] A package that genuinely has nothing to test says so explicitly with \"test\": \"exit 0\"."
    fail=1
    ran=1
  fi
}

if [ -d code ]; then
  for d in code/*/; do
    [ -d "$d" ] && run_pkg "${d%/}"
  done
fi
# root fallback (brownfield layouts, or pre-code/ scaffolds)
[ "$ran" -eq 0 ] && run_pkg .

if [ "$ran" -eq 0 ]; then
  echo "[gate] no package defines a typecheck or test script yet, nothing to run"
  exit 0
fi
exit $fail
