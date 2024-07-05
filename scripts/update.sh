#!/bin/zsh

cd ~/lunar-bot

echo "pulling from git"
current=$(git rev-parse --short HEAD)
git pull
new=$(git rev-parse --short HEAD)

if [[ $current != $new ]]; then
	echo ""
	./scripts/bot.sh status

	echo ""
	echo "updating local dependencies"
	yarn install

	echo ""
	echo "compiling to js"
	time yarn build
fi

echo ""
echo "done"

[[ $current != $new ]] && exit 1
