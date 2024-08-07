#!/bin/zsh

readonly BOT_ROOT=${0:a:h:h}
readonly LOG_FILE="$BOT_ROOT/logs/lunar-bot-out.log"
readonly PINO_OPTIONS="--config '$BOT_ROOT/.pino-prettyrc'"
readonly GREP_OPTIONS='--line-buffered --max-count=50'

case $1 in
	('')
		tail -F "$LOG_FILE" -n 50 \
		| pino-pretty $PINO_OPTIONS
		;;
	('error')
		tac "$LOG_FILE" \
		| grep $GREP_OPTIONS '"level":50' \
		| tac \
		| pino-pretty $PINO_OPTIONS
		;;
	('warn')
		tac "$LOG_FILE" \
		| grep $GREP_OPTIONS '"level":40' \
		| tac \
		| pino-pretty $PINO_OPTIONS
		;;
	(*)
		tac "$LOG_FILE" \
		| grep $GREP_OPTIONS -i "$*" \
		| tac \
		| pino-pretty $PINO_OPTIONS
esac
