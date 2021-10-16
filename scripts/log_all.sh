#!/bin/bash

tail -F logs/lunar-bot-out.log -n 50 | pino-pretty

