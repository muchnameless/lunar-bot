#!/bin/tcsh -f

# build if dist is missing
if ( ! -f './dist/index.js' ) then
	echo "compiling to js"
	\time -f 'Done in %E, CPU Usage %P' yarn build
endif

# save current commit
git rev-parse --short HEAD > running.log
