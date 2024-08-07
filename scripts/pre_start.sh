#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}
cd "$BOT_ROOT"

# build if dist is missing
if [[ ! -f 'dist/index.js' ]]; then
	echo 'compiling to js'
	time yarn build
fi
