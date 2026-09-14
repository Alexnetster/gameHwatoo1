# Audio assets

The game looks for the optional background track at `/audio/bgm-main.mp3`.
It must be a loopable, user-distributable file whose license permits use in this repository.

Planned optional effect assets:

- `card-play.mp3` — hand card played
- `deck-flip.mp3` — deck card revealed
- `capture.mp3` — cards captured
- `special.mp3` — jjok or seolsa
- `go-stop.mp3` — GO/STOP prompt
- `round-win.mp3` / `round-lose.mp3` — round result

Before adding an asset, record its source, author, license, and attribution requirements in the commit message or a companion note. Until `bgm-main.mp3` is supplied, `AudioManager` uses a quiet Web Audio ambient fallback after a user gesture; effect sounds are also generated through Web Audio.
