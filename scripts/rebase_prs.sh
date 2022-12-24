#!/bin/tcsh -f

git checkout main
git pull

foreach b (`gh pr list --json headRefName --jq '.[].headRefName' | awk '! /renovate/ {print}'`)
    git checkout $b && git rebase main && git push -f
end

git checkout main
