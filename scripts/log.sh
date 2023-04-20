#!/bin/tcsh -f

set log_file = ~/lunar-bot/logs/lunar-bot-out.log
set pino_options = '--config ~/lunar-bot/.pino-prettyrc'

if ($#argv == 0) then
	tail -F $log_file -n 50 \
	| pino-pretty $pino_options
else
	set grep_options = '--line-buffered'

	switch($argv[1])
		case 'error':
			tail -F $log_file -n 10000 \
			| grep $grep_options '"level":50' \
			| pino-pretty $pino_options

			breaksw
		case 'warn':
			tail -F $log_file -n 10000 \
			| grep $grep_options '"level":40' \
			| pino-pretty $pino_options

			breaksw
		default:
			cat $log_file \
			| grep $grep_options -i "$argv" \
			| pino-pretty $pino_options
	endsw
endif
