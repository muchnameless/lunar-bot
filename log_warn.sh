#!/bin/bash

tail -F logs/lunar-bot-out.log -n 10000 | grep "\"level\":40" | pino-pretty

