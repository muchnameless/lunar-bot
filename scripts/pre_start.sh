#!/bin/zsh

# build if dist is missing
if [[ ! -f './dist/index.js' ]]; then
	echo "compiling to js"
	time pnpm build
fi
