from pathlib import Path
import re
import json
import hashlib
import unicodedata
from urllib.parse import unquote

root = Path(__file__).resolve().parents[1]
def slug(text):
    text = re.sub(r'[`*_]', '', text).strip().lower()
    return ''.join(c for c in text if c in ' -_' or not unicodedata.category(c).startswith(('P', 'S'))).replace(' ', '-')

files = ['AGENTS.md', 'README.md'] + [str(p.relative_to(root)) for p in (root / 'docs').rglob('*.md')]
errors = []
# Only current entry points carry this contract. Dated evidence and archives
# must retain the schema they actually exercised.
current_pages = [
    'README.md', 'docs/README.md', 'docs/ROADMAP.md',
    'docs/gameplay/implementation-status.md',
    'docs/development/architecture.md', 'docs/development/validation.md',
]
schema = int(re.search(r'export const SCHEMA_VERSION\s*=\s*(\d+)',
    (root / 'src/sim/types.ts').read_text(encoding='utf-8')).group(1))
def header_schema(contents):
    header = re.sub(r'[`*_]', '', contents[:1200]).lower()
    match = re.search(r'schéma (?:de sauvegarde |courant(?: est)? |reste )?(\d+)', header)
    return int(match.group(1)) if match else None

for name in current_pages:
    documented = header_schema((root / name).read_text(encoding='utf-8'))
    if documented != schema:
        errors.append(f'{name}: current schema header {documented!r}, expected {schema}')
links = 0
local_evidence = 0
for name in files:
    source = root / name
    contents = source.read_text(encoding='utf-8')
    for target in re.findall(r'\]\(([^\n)]+)\)', contents):
        target = target.strip('<>')
        if re.match(r'^[a-zA-Z]+://', target):
            continue
        pathpart, _, anchor = target.partition('#')
        dest = source.parent / unquote(pathpart) if pathpart else source
        # tmp/ is gitignored, machine-local evidence (runs, captures, profiles).
        # It never exists in a fresh clone and is pruned to save disk space, so
        # links into it are informative only and are not required to resolve.
        try:
            if dest.resolve().relative_to(root / 'tmp'):
                local_evidence += 1
                continue
        except ValueError:
            pass
        links += 1
        if not dest.exists():
            errors.append(f'{name}: missing {target}')
        elif anchor and dest.suffix == '.md':
            headings = re.findall(r'^#{1,6}\s+(.+)$', dest.read_text(encoding='utf-8'), flags=re.M)
            if unquote(anchor) not in [slug(h) for h in headings]:
                errors.append(f'{name}: missing anchor {target}')

matrix = (root / 'docs/gameplay/systems-matrix.md').read_text(encoding='utf-8')
rows = re.findall(r'^\| (S\d{2}) \|.*$', matrix, flags=re.M)
assert rows == [f'S{i:02}' for i in range(25)], rows
families = re.findall(r'^\| (F\d) —', matrix, flags=re.M)
assert families == [f'F{i}' for i in range(1,6)], families
print(f'{len(files)} documents; {links} local links checked ({local_evidence} links into machine-local tmp/ not required); 25 domain IDs and 5 validation families preserved.')
for error in errors:
    print(error)
if errors:
    raise SystemExit(1)
for entry in json.loads((root/'docs/reference/originals/manifest.json').read_text(encoding='utf-8')):
    source=root/'docs/reference/originals'/entry['file']
    assert source.stat().st_size == entry['bytes'], source
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry['sha256'], source
print(f'Documentation checks passed; six current headers at schema {schema}; three original sources byte-identical.')
