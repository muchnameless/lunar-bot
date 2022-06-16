#!/bin/tcsh -f

set curdir = `pwd`

cd ~/lunar-bot

echo "pulling from git"
git pull

echo ""
echo "updating local dependencies"
yarn install

echo ""
echo "compiling to js"
\time -p yarn build

echo ""
echo "done"

cd $curdir
