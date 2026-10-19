"""A repeatable zoom gesture for measuring the map (T-278).

    python -I tools/make-zoom-gesture.py <out.txt> [top_y]

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
"""
import sys

X, BOTTOM, STEP, FRAME_MS = 540, 1750, 20, 16


def main(path, top):
    lines = ['type= raw events', 'count= 1', 'speed= 1.0', 'start data >>']

    def ev(action, y):
        lines.append(f'DispatchPointer(0,0,{action},{X},{y},1.0,1.0,0,1.0,1.0,0,0)')

    steps = (BOTTOM - top) // STEP
    for _ in range(3):
        for direction in (1, -1):
            y0 = top if direction == 1 else top + steps * STEP
            ev(0, y0)
            ev(1, y0)
            lines.append('UserWait(90)')
            ev(0, y0)
            for i in range(1, steps + 1):
                ev(2, y0 + direction * i * STEP)
                lines.append(f'UserWait({FRAME_MS})')
            ev(1, y0 + direction * steps * STEP)
            lines.append('UserWait(800)')
    assert all(int(line.split(',')[4]) <= BOTTOM for line in lines if line.startswith('Dispatch'))
    with open(path, 'w', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 530)
