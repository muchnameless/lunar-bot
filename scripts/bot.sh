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
			systemctl status lunar-bot.service
			breaksw
		case 'init':
			sed "s@NODE@`which node`@ ; s@USER@$USER@ ; s@HOME@$HOME@" ~/lunar-bot/lunar-bot.service | sudo tee /etc/systemd/system/lunar-bot.service
			sudo systemctl daemon-reload
			sudo systemctl enable lunar-bot
			sudo systemctl restart lunar-bot
			breaksw
		default:
			echo "invalid args"
	endsw
endif
