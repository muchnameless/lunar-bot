#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}
cd "$BOT_ROOT"

# save current commit
git rev-parse --short HEAD > 'running.log'
