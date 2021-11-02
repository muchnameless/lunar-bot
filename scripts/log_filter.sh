#!/bin/bash

input=$*
filter=$(IFS=, ; echo "${input[*]}")

cat logs/lunar-bot-out.log | grep -i "$filter" | pino-pretty

