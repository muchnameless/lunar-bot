#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}
cd "$BOT_ROOT"

for number in $(gh pr list --label dependencies --json number --jq '.[].number' | tac); do
	gh pr edit $number --add-label automerge
done
