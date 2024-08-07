#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}

case $1 in
	('')
		systemctl status lunar-bot.service
		;;
	('start')
		sudo systemctl start lunar-bot
		;;
	('stop')
		sudo systemctl stop lunar-bot
		;;
	('restart')
		sudo systemctl restart lunar-bot
		;;
	('status')
		readonly RUNNING=$(<"$BOT_ROOT/running.log")
		readonly CURRENT=$(git rev-parse --short HEAD)

		echo " --- latest"
		echo " v"
		if [[ $RUNNING == $CURRENT ]]; then
			git --no-pager log --oneline -1
		else
			git --no-pager log --oneline $RUNNING~1..$CURRENT
		fi
		echo " ^"
		echo " --- running"
		;;
	('init')
		sed "s@NODE@$(which node)@g ; s@USER@$USER@g ; s@BOT_ROOT@$BOT_ROOT@g" "$BOT_ROOT/lunar-bot.service" | sudo tee /etc/systemd/system/lunar-bot.service
		sudo systemctl daemon-reload
		sudo systemctl enable lunar-bot
		;;
	(*)
		echo "invalid args"
		exit 1
esac
