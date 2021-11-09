#!/bin/bash

tail -F ~/lunar-bot/logs/lunar-bot-out.log -n 50 | pino-pretty

