#!/usr/bin/env python3
"""Apply Hasura migrations in the order they were added to git.

`hasura migrate apply` sorts by version number. This history mixes unix
milliseconds with YYYYMMDDHHMMSS, so a fresh apply runs later repairs
before the tables they change. The existing databases were built in
add order. One data repair updates state_code, which a later migration
removed; skipping that file leaves the schema the metadata describes.
"""

import os
import re
import subprocess
import sys

MIGRATIONS = 'apps/hasura/migrations/Rendasua'
SKIP = '1760255448302_fix_gabon_states_data'
SKIP_NEEDLE = 'state_code'
DEFER = re.compile(
    r'(does not exist|undefined column|column "[^"]+" of relation'
    r'|violates foreign key|there is no unique|missing FROM-clause'
    r'|operator does not exist|invalid input value for enum)',
    re.I,
)


def repo_root() -> str:
    out = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True)
    return out.strip()


def migration_dirs(root: str) -> list[str]:
    base = os.path.join(root, MIGRATIONS)
    names = []
    for name in os.listdir(base):
        path = os.path.join(base, name)
        version = name.split('_', 1)[0]
        up = os.path.join(path, 'up.sql')
        if os.path.isdir(path) and version.isdigit() and os.path.isfile(up):
            names.append(name)
    return names


def added_at(root: str, names: list[str]) -> dict[str, int]:
    log = subprocess.check_output(
        ['git', 'log', '--diff-filter=A', '--format=COMMIT %ct', '--name-only', '--', MIGRATIONS],
        cwd=root, text=True,
    )
    added: dict[str, int] = {}
    stamp = 0
    for line in log.splitlines():
        if line.startswith('COMMIT '):
            stamp = int(line.split()[1])
            continue
        if MIGRATIONS not in line:
            continue
        name = line.split(MIGRATIONS + '/', 1)[1].split('/', 1)[0]
        added[name] = stamp
    for name in names:
        if name in added:
            continue
        path = os.path.join(MIGRATIONS, name)
        out = subprocess.check_output(
            ['git', 'log', '--reverse', '--format=%ct', '-1', '--', path],
            cwd=root, text=True,
        ).strip()
        if not out:
            sys.exit(f'no git history for {name}')
        added[name] = int(out.splitlines()[0])
    return added


def apply_file(path: str) -> subprocess.CompletedProcess[str]:
    cmd = ['psql', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q']
    if os.environ.get('PGHOST'):
        cmd += ['-h', os.environ['PGHOST']]
    if os.environ.get('PGPORT'):
        cmd += ['-p', os.environ['PGPORT']]
    if os.environ.get('PGUSER'):
        cmd += ['-U', os.environ['PGUSER']]
    cmd += ['-d', os.environ.get('PGDATABASE', 'postgres'), '-f', path]
    return subprocess.run(cmd, capture_output=True, text=True)


def ordered(root: str) -> list[tuple[int, int, str]]:
    names = migration_dirs(root)
    stamps = added_at(root, names)
    rows = []
    for name in names:
        rows.append((stamps[name], int(name.split('_', 1)[0]), name))
    rows.sort()
    return rows


def replay(root: str, rows: list[tuple[int, int, str]]) -> None:
    pending = rows
    passes = 0
    while pending:
        passes += 1
        nxt: list[tuple[int, int, str, str]] = []
        progressed = 0
        for stamp, version, name in pending:
            path = os.path.join(root, MIGRATIONS, name, 'up.sql')
            result = apply_file(path)
            if result.returncode == 0:
                progressed += 1
                continue
            err = result.stderr or ''
            if DEFER.search(err):
                nxt.append((stamp, version, name, err))
                continue
            sys.exit(f'{name} failed:\n{err[-2000:]}')
        print(f'pass {passes}: applied {progressed}, waiting {len(nxt)}', flush=True)
        if progressed == 0:
            finish_waiting(nxt)
            return
        pending = [(s, v, n) for s, v, n, _ in nxt]


def finish_waiting(waiting: list[tuple[int, int, str, str]]) -> None:
    if len(waiting) == 1 and waiting[0][2] == SKIP and SKIP_NEEDLE in waiting[0][3]:
        print(f'skip {SKIP}: {SKIP_NEEDLE} was removed by a later migration', flush=True)
        return
    for _, _, name, err in waiting:
        line = next((ln for ln in err.splitlines() if 'ERROR' in ln), err[-300:])
        print(f'stuck {name}: {line}', flush=True)
    sys.exit(1)


def main() -> None:
    root = repo_root()
    replay(root, ordered(root))
    print('migrations applied', flush=True)


if __name__ == '__main__':
    main()
