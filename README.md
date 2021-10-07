# Lunar Bot

Lunar Guard Discord Bot

Redis (as an LRU cache)

    redis-cli

    CONFIG SET maxmemory 1gb
    
    CONFIG SET activedefrag yes

    CONFIG SET maxmemory-policy volatile-lru
    
    CONFIG REWRITE

PostgreSQL ^13 (earlier versions do not accept Date.now() in BigInt arrays)

    # Create the file repository configuration:
    
    sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

    # Import the repository signing key:
    
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

    # Update the package lists:
    
    sudo apt update

    # Install the latest version of PostgreSQL.
    
    sudo apt install postgresql
