"""A repeatable zoom gesture for measuring the map (T-278).

    python -I tools/make-zoom-gesture.py <out.txt> [top_y]
    python -I tools/make-zoom-gesture.py --strokes <dir> [top_y]

`adb shell input` has no pinch, the P30 refuses writes to /dev/input, and
monkey's own `PinchZoom` injects every step within a few milliseconds, which
Google's map reads as almost no gesture. So this writes a monkey script for
Google's **one-finger zoom**: double tap, then hold and drag down to zoom in, up
to zoom out. It goes through the same continuous zoom as a pinch, crossing the
lit roads' width steps, with real 16 ms gaps between moves.

Three cycles: in from `top_y` down to 1,750 px, then out back up.
⚠ No touch below y = 1,750 (T-278, 19 Oct 2026): a first version started its
zoom-out at 2,230 px, where Bruma's *Começar passeio* sits, and its double
taps started and ended two outings on the lead's phone.

`--strokes <dir>` writes the same six strokes as `stroke-1.txt` to
`stroke-6.txt` (odd in, even out), each a whole monkey script, so the probe can
log a marker before each one (N17, A4 of the 30 Oct fix plan). The events are
the same as the single script's, less the 800 ms wait after each stroke, which
the probe keeps as a sleep between runs.
"""
import sys

X, BOTTOM, STEP, FRAME_MS = 640, 1750, 20, 16


HEADER = ['type= raw events', 'count= 1', 'speed= 1.0', 'start data >>']


def strokes(top):
    """The six strokes in order, in then out, three times; each a list of monkey lines."""
    steps = (BOTTOM - top) // STEP
    out = []
    for _ in range(3):
        for direction in (1, -1):
            lines = []

            def ev(action, y):
                lines.append(f'DispatchPointer(0,0,{action},{X},{y},1.0,1.0,0,1.0,1.0,0,0)')

            y0 = top if direction == 1 else top + steps * STEP
            ev(0, y0)
            ev(1, y0)
            lines.append('UserWait(90)')
            ev(0, y0)
            for i in range(1, steps + 1):
                ev(2, y0 + direction * i * STEP)
                lines.append(f'UserWait({FRAME_MS})')
            ev(1, y0 + direction * steps * STEP)
            assert all(int(line.split(',')[4]) <= BOTTOM for line in lines if line.startswith('Dispatch'))
            out.append(lines)
    return out


def write(path, lines):
    with open(path, 'w', newline='\n') as f:
        f.write('\n'.join(HEADER + lines) + '\n')


def main(path, top):
    lines = []
    for stroke in strokes(top):
        lines += stroke + ['UserWait(800)']
    write(path, lines)


def main_strokes(directory, top):
    for index, stroke in enumerate(strokes(top), start=1):
        write(f'{directory}/stroke-{index}.txt', stroke)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[0] == '--strokes':
        main_strokes(args[1], int(args[2]) if len(args) > 2 else 1100)
    else:
        main(args[0], int(args[1]) if len(args) > 1 else 1100)
