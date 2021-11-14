# Lunar Bot

Lunar Guard Discord Bot

## Prerequisites

 - Redis

    ```
    $ redis-cli

    > CONFIG SET maxmemory 1gb
    > CONFIG SET activedefrag yes
    > CONFIG SET maxmemory-policy volatile-lru
    > CONFIG REWRITE
    ```
    
 - PostgreSQL ^13
 
 - libs to build canvas
 
   `sudo apt install -y libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev`
