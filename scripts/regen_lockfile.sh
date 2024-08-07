#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}

rm -rf "$BOT_ROOT/node_modules"

# https://github.com/renovatebot/renovate/blob/c481ad235c2f18e37845d2541f8b7ed13ce19b90/lib/modules/manager/npm/post-update/yarn.ts#L252-L271
echo '' > "$BOT_ROOT/yarn.lock"

yarn
