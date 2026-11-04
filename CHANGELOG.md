# Changelog

## [0.2.0](https://github.com/mharr171/literally-fantasy-sports/compare/v0.1.0...v0.2.0) (2026-11-04)


### Features

* **admin:** add an admin area with a game settings overview ([#18](https://github.com/mharr171/literally-fantasy-sports/issues/18)) ([5ae9764](https://github.com/mharr171/literally-fantasy-sports/commit/5ae97640e34ab4e4a5a47f3b5d3d84e37f793fb1))
* **admin:** paint, test and publish soccer position templates ([#19](https://github.com/mharr171/literally-fantasy-sports/issues/19)) ([7935bd5](https://github.com/mharr171/literally-fantasy-sports/commit/7935bd5bba131dc5edca35aad3e1ae9cc9596903))
* **core:** add chemistry colours and gameday boosts ([#11](https://github.com/mharr171/literally-fantasy-sports/issues/11)) ([ba3e608](https://github.com/mharr171/literally-fantasy-sports/commit/ba3e608632d1baaa79a2b8400d066b69fc0da6a3))
* **core:** add the match engine foundation (seeded RNG, Elo, Sport interface) ([#9](https://github.com/mharr171/literally-fantasy-sports/issues/9)) ([2b9e6a6](https://github.com/mharr171/literally-fantasy-sports/commit/2b9e6a62d9aeacc322b4a0c4586b769c3d1b476e))
* **core:** chemistry groups need at least two players to earn a boost ([#12](https://github.com/mharr171/literally-fantasy-sports/issues/12)) ([7ac7132](https://github.com/mharr171/literally-fantasy-sports/commit/7ac7132d194962aa510791e33153a85db08a15fb))
* **core:** generate player names styled by nationality ([#16](https://github.com/mharr171/literally-fantasy-sports/issues/16)) ([59fb0ee](https://github.com/mharr171/literally-fantasy-sports/commit/59fb0ee04140bc9db8f3cd0f72518cb8f22e0dfe))
* **db:** add versioned game settings that only admins can change ([#17](https://github.com/mharr171/literally-fantasy-sports/issues/17)) ([e21eccd](https://github.com/mharr171/literally-fantasy-sports/commit/e21eccd52c7e14a0a0ab5a8cdaec7ce0f90d6da5))
* **soccer:** add positions, attributes, overall rating and effective skill ([#13](https://github.com/mharr171/literally-fantasy-sports/issues/13)) ([4952cc1](https://github.com/mharr171/literally-fantasy-sports/commit/4952cc10ec303c0b9fcb53c53e2ed7e2f62deb75))
* **soccer:** play full matches with possession phases, extra time and penalties ([#14](https://github.com/mharr171/literally-fantasy-sports/issues/14)) ([c570a9b](https://github.com/mharr171/literally-fantasy-sports/commit/c570a9bfcc808afca153797b7342c689e0dd0ee7))
* **soccer:** players tire, get booked and injured, and the bench comes on ([#15](https://github.com/mharr171/literally-fantasy-sports/issues/15)) ([08c51ee](https://github.com/mharr171/literally-fantasy-sports/commit/08c51ee79ab30910b7b42b0719a307f3ba1407a8))


### Documentation

* plan template variants per position (D82) ([#20](https://github.com/mharr171/literally-fantasy-sports/issues/20)) ([9d6628e](https://github.com/mharr171/literally-fantasy-sports/commit/9d6628e3718b0aa803e98c4a32f0262c9c2a476e))

## 0.1.0 (2026-11-04)


### Features

* **auth:** sign in with Google or an email magic link via Supabase ([#2](https://github.com/mharr171/literally-fantasy-sports/issues/2)) ([70e3842](https://github.com/mharr171/literally-fantasy-sports/commit/70e3842d526f70f6b22dcd9b42b0d709e34ba84a))
* **db:** add packages/db with profiles table, RLS and migration workflows ([#3](https://github.com/mharr171/literally-fantasy-sports/issues/3)) ([e0ef529](https://github.com/mharr171/literally-fantasy-sports/commit/e0ef529db6923ff92851580849799e0ab83760fa))


### Bug Fixes

* **db:** show the database error when a migration fails ([#4](https://github.com/mharr171/literally-fantasy-sports/issues/4)) ([d9fa544](https://github.com/mharr171/literally-fantasy-sports/commit/d9fa544174e85e87ade76e78e360beeb32835ee3))


### Build and CI

* add daily Supabase keep-alive and nightly lfs-prod backups ([#5](https://github.com/mharr171/literally-fantasy-sports/issues/5)) ([f6b4f93](https://github.com/mharr171/literally-fantasy-sports/commit/f6b4f93e527c72f9c35d99ebb35bb81af539114b))
* add release-please for changelog, version tags and GitHub releases ([#6](https://github.com/mharr171/literally-fantasy-sports/issues/6)) ([c9ae9f5](https://github.com/mharr171/literally-fantasy-sports/commit/c9ae9f5fac9d8fb8af769f698cabdf7d5e212923))
* start release-please at 0.1.0 instead of 1.0.0 ([#8](https://github.com/mharr171/literally-fantasy-sports/issues/8)) ([46809fd](https://github.com/mharr171/literally-fantasy-sports/commit/46809fd27ca1f7bbc0d9947fd3bf81eeeff7b90a))
