# Velvet Coast

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Johndurux/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Johndurux/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Velvet Coast is an open-world crime game for desktop Chrome: a top-down city called Velara Bay, twelve avenues wide, with a beach and a pier along the north shore, traffic that reads the lights, people who walk the pavements and run when you get close, and a police department that counts your stars. You play Rico Vale, who starts outside a safehouse with three hundred dollars and a borrowed pistol and ends up working five jobs for Doc Vela and Mira Sol.

The game is drawn entirely by its own code. There are no images, fonts or sound files: the city, the cars, the people, the portraits and the animated sunset are canvas 2D shapes, and the engine note, sirens, gunshots and mission stingers are synthesised with the Web Audio API. It loads no library and makes no network request, so it plays from a static folder, or straight off the disk, with nothing installed.

## Play

Open `game/index.html` in Chrome, or serve the folder:

```sh
cd game && python3 -m http.server 8080
```

Then walk out of the safehouse, press **E** at the car, and look for the gold marker on the minimap.

| Key | Action |
| --- | --- |
| `W A S D` / arrows | walk, and drive when you are in a car |
| `Shift` | sprint |
| `E` | take or leave a car, talk to a job giver, start a courier run |
| `Space` | handbrake (and hold a drift), or skip a line of dialogue |
| mouse | aim |
| left click / `J` | fire |
| `Esc` | pause, save, and the controls |

Five jobs chain from the safehouse through the pier, the radio tower, Club Halo and the hilltop, each with a brief, an objective, a marker and a cash reward. Between them the city pays for itself: cash drops on street corners, a repeatable courier run from the dockside depot, and whatever a stolen car is worth to the police. Cash, story progress and the place you left the car in are saved to `localStorage` after every job and in the pause menu.

## Under the hood

`game/src/world` holds the simulation (city generation, traffic, pedestrians, the player, police, missions, gunfire), `game/src/render` draws it (streets and buildings, actors, sky, HUD, menus), and `game/src/audio`, `game/src/save` and `game/src/core` hold the sound, the save file and the shared maths. `?shot=1..4` stages one of the four screenshots instead of starting at the title.

`main.ts` copies `game/` and `screenshots/` to the output folder and writes the dossier:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```