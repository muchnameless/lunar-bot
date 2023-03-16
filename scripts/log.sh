#!/bin/tcsh -f

if ($#argv == 0) then
	tail -F ~/lunar-bot/logs/lunar-bot-out.log -n 50 | pino-pretty --config ~/lunar-bot/.pino-prettyrc
else
	switch($argv[1])
		case 'error':
			tail -F ~/lunar-bot/logs/lunar-bot-out.log -n 10000 | grep '"level":50' | pino-pretty --config ~/lunar-bot/.pino-prettyrc
			breaksw
		case 'warn':
			tail -F ~/lunar-bot/logs/lunar-bot-out.log -n 10000 | grep '"level":40' | pino-pretty --config ~/lunar-bot/.pino-prettyrc
			breaksw
		default:
			cat ~/lunar-bot/logs/lunar-bot-out.log | grep -i "$argv" | pino-pretty --config ~/lunar-bot/.pino-prettyrc
	endsw
endif
