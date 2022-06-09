#!/bin/bash

curdir=`pwd`

cd ~/lunar-bot

echo "pulling from git"
git pull

echo ""
echo "updating local dependencies"
yarn install

echo ""
echo "compiling to js"
time yarn build

echo ""
echo "done"

cd $curdir
