#!/bin/tcsh -f

foreach b (`gh pr list --json headRefName | jq -r '.[] | .headRefName' | awk '! /renovate/ {print $0}'`)
    git checkout $b && git rebase main && git push -f
end

git checkout main
