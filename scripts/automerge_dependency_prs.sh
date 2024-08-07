#!/bin/zsh

for number in $(gh pr list --label dependencies --json number --jq '.[].number' | tac); do
    gh pr edit $number --add-label automerge
done
