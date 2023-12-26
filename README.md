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

## Installation

```sh-session
$ git clone <repo>
$ yarn install
$ cp .env.example .env && chmod 600 .env
```

edit the `.env`-file

## Credit

- MessageCollector.ts adapted from [`discord.js`]
- emoji name <-> unicode converter using [`discord emoji map project`]
- randomNumber ported from [`random-number-csprng`]
- networth calculations from [`MaroAPI`], [`SkyHelperAPI`] and [`SkyCrypt`]

<!----------------- LINKS --------------->

[`discord emoji map project`]: https://emzi0767.gl-pages.emzi0767.dev/discord-emoji/
[`discord.js`]: https://discord.js.org/
[`maroapi`]: https://github.com/zt3h/MaroAPI
[`postgresql`]: https://www.postgresql.org/download/
[`random-number-csprng`]: https://github.com/joepie91/node-random-number-csprng
[`redis`]: https://redis.io
[`skycrypt`]: https://github.com/SkyCryptWebsite/SkyCrypt
[`skyhelperapi`]: https://github.com/Altpapier/SkyHelperAPI
