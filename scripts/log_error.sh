#!/bin/bash

tail -F ~/lunar-bot/logs/lunar-bot-out.log -n 10000 | grep "\"level\":50" | pino-pretty --config ~/lunar-bot/.pino-prettyrc

