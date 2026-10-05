"""Render the captured demo output as an animated GIF. Requires Pillow."""
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'assets/demo.json').read_text(encoding='utf-8'))
font = ImageFont.load_default(size=19)
title_font = ImageFont.load_default(size=26)
frames = []
for i, stage in enumerate(data['stages']):
    image = Image.new('RGB', (1120, 640), '#0e1523')
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((24, 24, 1096, 616), radius=18, fill='#182338', outline='#354764', width=2)
    draw.text((48, 46), 'dsh-jev-prune | recorded deterministic run', font=title_font, fill='#f2f6ff')
    draw.text((48, 90), 'REAL PLUGIN  /  SIMULATED HOST  /  FIXED JUDGE', font=font, fill='#8dc7ff')
    draw.line((48, 130, 1070, 130), fill='#354764', width=2)
    draw.text((48, 150), stage['title'], font=title_font, fill='#9eebc5')
    y = 205
    for line in stage['lines']:
        # Render only ASCII in the GIF; full Unicode receipt stays in JSON/cast.
        if not line.isascii():
            line = '[Chinese receipt output captured verbatim in demo.json / demo.cast]'
        for part in textwrap.wrap(line, width=88) or ['']:
            draw.text((48, y), part, font=font, fill='#e4ebf6')
            y += 29
    draw.text((48, 576), f'{i+1}/4  |  No live API calls  |  Reproduce: node demo/run.mjs', font=font, fill='#98a8bf')
    frames.append(image)
frames[0].save(root / 'assets/demo.gif', save_all=True, append_images=frames[1:], duration=6000, loop=0, optimize=True)
frames[-1].save(root / 'assets/demo-poster.png')
