# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_all

sys.setrecursionlimit(5000)

# Resolve entry point relative to this spec file — works on any machine / CI runner
entry_point = os.path.join(SPECPATH, 'backend', 'desktop.py')

datas = [(os.path.join(SPECPATH, 'backend', 'static'), 'backend/static')]
binaries = []
hiddenimports = []

# List of packages to collect metadata and binaries for
packages_to_collect = ['uvicorn', 'fastapi', 'yfinance', 'pydantic']

# Conditionally collect PyQt6 (only if it is installed, e.g. on Windows)
try:
    import PyQt6
    packages_to_collect.append('PyQt6')
except ImportError:
    print("PyQt6 not installed, skipping collection")

# Conditionally collect python-multipart / multipart
try:
    import multipart
    packages_to_collect.append('multipart')
except ImportError:
    try:
        import python_multipart
        packages_to_collect.append('python-multipart')
    except ImportError:
        # Fallback to both just in case
        packages_to_collect.append('python-multipart')

print(f"Collecting metadata and binaries for packages: {packages_to_collect}")

for pkg in packages_to_collect:
    try:
        tmp_ret = collect_all(pkg)
        datas     += tmp_ret[0]
        binaries  += tmp_ret[1]
        hiddenimports += tmp_ret[2]
    except Exception as e:
        print(f"Warning: collect_all failed for package '{pkg}': {e}")

a = Analysis(
    [entry_point],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

# ── Folder distribution (default, faster startup) ─────────────────────────────
exe_folder = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='NovaPortfolio',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe_folder,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='NovaPortfolio',
)

# ── Single-file distribution ───────────────────────────────────────────────────
exe_onefile = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='NovaPortfolio-onefile',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
