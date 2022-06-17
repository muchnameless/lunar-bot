#!/bin/tcsh -f

if ($#argv == 0) then
	systemctl status lunar-bot.service
else
	switch($argv[1])
		case 'start':
			sudo systemctl start lunar-bot
			breaksw
		case 'stop':
			sudo systemctl stop lunar-bot
			breaksw
		case 'restart':
			sudo systemctl restart lunar-bot
			breaksw
		case 'status':
			set running = `cat ~/lunar-bot/running.log`
			set current = `git rev-parse --short HEAD`

			echo " --- latest"
			echo " v"
			if (running == current) then
				git log --oneline -1
			else
				git log --oneline $running~1..$current
			endif
			echo " ^"
			echo " --- running"
			breaksw
		case 'init':
			sed "s@NODE@`which node`@g ; s@USER@$USER@g ; s@HOME@$HOME@g" ~/lunar-bot/lunar-bot.service | sudo tee /etc/systemd/system/lunar-bot.service
			sudo systemctl daemon-reload
			sudo systemctl enable lunar-bot
			breaksw
		default:
			echo "invalid args"
	endsw
endif
