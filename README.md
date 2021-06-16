# lunar_bot_dev

dev version of the lunar guard discord bot

requires

Redis (as a LRU cache)
    CONFIG SET maxmemory 100mb
    CONFIG SET maxmemory-policy volatile-lru

PostrgeSQL ^13 (earlier versions do not accept Date.now() in BigInt arrays)
