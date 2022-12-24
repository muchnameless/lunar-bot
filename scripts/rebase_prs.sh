#!/bin/tcsh -f

foreach b (`gh pr list --json headRefName --jq '.[].headRefName' | awk '! /renovate/ {print}'`)
    git checkout $b && git rebase main && git push -f
end

git checkout main
