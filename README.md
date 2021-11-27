# Lunar Bot

Lunar Guard Discord Bot

## Prerequisites

- [`Redis`]

  ```sh-session
  $ redis-cli

  > CONFIG SET maxmemory 1gb
  > CONFIG SET activedefrag yes
  > CONFIG SET maxmemory-policy volatile-lru
  > CONFIG REWRITE
  ```

- [`PostgreSQL`]

- libs to build [`canvas`]

  `sudo apt install -y libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev`

## Installation

```sh-session
$ git clone <repo>
$ npm install
$ cp .env_example .env && chmod 600 .env
```

edit the `.env`-file

## Credit

- MessageCollector.ts adapted from [`discord.js`]
- Emoji name <> unicode converter ported from [`DSharpPlus`]
- randomNumber ported from [`random-number-csprng`]

<!----------------- LINKS --------------->

[`postgresql`]: https://www.postgresql.org/download/
[`redis`]: https://redis.io
[`canvas`]: https://www.npmjs.com/package/canvas
[`discord.js`]: https://discord.js.org/
[`dsharpplus`]: https://github.com/DSharpPlus/DSharpPlus
[`random-number-csprng`]: https://github.com/joepie91/node-random-number-csprng
