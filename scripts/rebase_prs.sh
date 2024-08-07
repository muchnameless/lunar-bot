#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}
cd "$BOT_ROOT"

git checkout main
git pull

for branch in $(gh pr list --json headRefName --jq '.[].headRefName' | awk '!/^renovate/'); do
	git checkout $branch && git rebase main && git push --force
done

git checkout main
