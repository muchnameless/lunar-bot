#!/bin/tcsh -f

foreach b (`gh pr list | awk '!/renovate/ {print $(NF-1)}'`)
    git checkout $b && git rebase main && git push -f
end

git checkout main
