#!/bin/tcsh -f

foreach b (`gh pr list --label dependencies --json number --jq '.[].number'`)
    gh pr edit $b --add-label automerge
end
