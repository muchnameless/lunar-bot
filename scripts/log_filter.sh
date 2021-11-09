#!/bin/bash

input=$*
filter=$(IFS=, ; echo "${input[*]}")

cat ~/lunar-bot/logs/lunar-bot-out.log | grep -i "$filter" | pino-pretty --config ~/lunar-bot/.pino-prettyrc

