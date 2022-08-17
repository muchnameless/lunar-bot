#!/bin/tcsh -f

set curdir = `pwd`

cd ~/lunar-bot

echo "pulling from git"
set current = `git rev-parse --short HEAD`
git pull

@ outdated = `git rev-parse --short HEAD` != $current

if ($outdated) then
	echo ""
	./scripts/bot.sh status

	echo ""
	echo "updating local dependencies"
	yarn install

	echo ""
	echo "compiling to js"
	\time -f 'Done in %E, CPU Usage %P' yarn build
endif

echo ""
echo "done"

cd $curdir

if ($outdated == 0) exit 1
