#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}

# save current commit
git rev-parse --short HEAD > "$BOT_ROOT/running.log"
