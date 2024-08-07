#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}

# build if dist is missing
if [[ ! -f "$BOT_ROOT/dist/index.js" ]]; then
	echo "compiling to js"
	time yarn build
fi
