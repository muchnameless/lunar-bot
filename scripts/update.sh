#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}
cd "$BOT_ROOT"

echo "pulling from git"
readonly CURRENT=$(git rev-parse --short HEAD)
git pull
readonly NEW=$(git rev-parse --short HEAD)

if [[ $CURRENT != $NEW ]]; then
	echo ""
	"$BOT_ROOT/scripts/bot.sh" status

	echo ""
	echo "updating local dependencies"
	yarn install

	echo ""
	echo "compiling to js"
	time yarn build
fi

echo ""
echo "done"

[[ $CURRENT != $NEW ]] && exit 1
