"""HTML-версия одним файлом: шрифты и видео встраиваются в index.html как data-URI.

python3 build_single.py <выходной .html>
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
b64 = lambda p: base64.b64encode(p.read_bytes()).decode()

css = (ROOT / 'fonts' / 'fonts.css').read_text(encoding='utf-8')
css = re.sub(r'url\(([^)]+\.woff2)\)', lambda m: f'url(data:font/woff2;base64,{b64(ROOT / "fonts" / m.group(1))})', css)
html = (ROOT / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="fonts/fonts.css">', f'<style>\n{css}</style>')
html = re.sub(r'src="(media/[\w-]+\.mp4)"', lambda m: f'src="data:video/mp4;base64,{b64(ROOT / m.group(1))}"', html)
Path(sys.argv[1]).write_text(html, encoding='utf-8')
print('saved', sys.argv[1], round(len(html) / 2**20, 1), 'MB')
