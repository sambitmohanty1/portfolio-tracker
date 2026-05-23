import os
import shutil
import subprocess
import sys

# Define directories
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
STATIC_DIR = os.path.join(BACKEND_DIR, "static")
VENV_DIR = os.path.join(BACKEND_DIR, "venv")

# Resolve venv Python / pip / pyinstaller paths
if sys.platform == "win32":
    PYTHON_EXE      = os.path.join(VENV_DIR, "Scripts", "python.exe")
    PIP_EXE         = os.path.join(VENV_DIR, "Scripts", "pip.exe")
    PYINSTALLER_EXE = os.path.join(VENV_DIR, "Scripts", "pyinstaller.exe")
else:
    PYTHON_EXE      = os.path.join(VENV_DIR, "bin", "python")
    PIP_EXE         = os.path.join(VENV_DIR, "bin", "pip")
    PYINSTALLER_EXE = os.path.join(VENV_DIR, "bin", "pyinstaller")

def run_command(command, cwd=None):
    """Executes a shell command and exits on non-zero return code."""
    print(f"  ► {command}")
    result = subprocess.run(command, shell=True, cwd=cwd or ROOT_DIR)
    if result.returncode != 0:
        print(f"\n[ERROR] Command failed (exit {result.returncode}): {command}")
        sys.exit(result.returncode)

def main():
    print("=" * 65)
    print("        NovaPortfolio  ·  Standalone Desktop App Builder")
    print("=" * 65)

    # ── Step 1: Create / refresh virtual environment ──────────────────
    print("\n[1/5] Setting up Python virtual environment...")
    if not os.path.exists(VENV_DIR):
        # Use the same Python that is running this script (important on CI)
        run_command(f'"{sys.executable}" -m venv "{VENV_DIR}"')
    else:
        print("      venv already exists — skipping creation.")

    # ── Step 2: Install Python dependencies ───────────────────────────
    print("\n[2/5] Installing Python dependencies...")
    req_path = os.path.join(BACKEND_DIR, "requirements.txt")
    if os.path.exists(req_path):
        run_command(f'"{PIP_EXE}" install --upgrade pip')
        run_command(f'"{PIP_EXE}" install -r "{req_path}"')

    if sys.platform == "win32":
        print("      Windows: installing PyQt6 + pywebview (no-deps workaround)...")
        run_command(f'"{PIP_EXE}" install PyQt6 PyQt6-WebEngine PyQt6-Qt6')
        run_command(f'"{PIP_EXE}" install pywebview --no-deps')
        run_command(f'"{PIP_EXE}" install pyinstaller bottle proxy-tools qtpy')
    else:
        print("      macOS/Linux: installing standard packages...")
        run_command(f'"{PIP_EXE}" install pywebview pyinstaller')

    # ── Step 3: Build React frontend ──────────────────────────────────
    print("\n[3/5] Building React frontend...")
    node_modules_dir = os.path.join(FRONTEND_DIR, "node_modules")
    if not os.path.exists(node_modules_dir):
        print("      node_modules not found — running npm ci...")
        run_command("npm ci", cwd=FRONTEND_DIR)
    run_command("npm run build", cwd=FRONTEND_DIR)

    # ── Step 4: Stage frontend assets for PyInstaller ─────────────────
    print("\n[4/5] Staging frontend assets...")
    dist_dir = os.path.join(FRONTEND_DIR, "dist")
    if not os.path.exists(dist_dir):
        print("[ERROR] React build output (frontend/dist) not found. Aborting.")
        sys.exit(1)

    if os.path.exists(STATIC_DIR):
        shutil.rmtree(STATIC_DIR)
    shutil.copytree(dist_dir, STATIC_DIR)
    print(f"      Copied {dist_dir} → {STATIC_DIR}")

    # ── Step 5: Run PyInstaller using the spec file ────────────────────
    print("\n[5/5] Bundling with PyInstaller (spec-driven build)...")
    spec_path = os.path.join(ROOT_DIR, "NovaPortfolio.spec")
    run_command(
        f'"{PYINSTALLER_EXE}" --noconfirm --distpath "{os.path.join(ROOT_DIR, "dist")}" "{spec_path}"',
        cwd=ROOT_DIR,
    )

    # ── Report output locations ────────────────────────────────────────
    print("\n" + "=" * 65)
    print("BUILD COMPLETED SUCCESSFULLY!")
    print("=" * 65)

    if sys.platform == "darwin":
        folder_path  = os.path.join(ROOT_DIR, "dist", "NovaPortfolio")
        onefile_path = os.path.join(ROOT_DIR, "dist", "NovaPortfolio-onefile")
        print(f"  Folder  build : {folder_path}")
        print(f"  Onefile build : {onefile_path}")
    else:
        folder_path  = os.path.join(ROOT_DIR, "dist", "NovaPortfolio")
        onefile_path = os.path.join(ROOT_DIR, "dist", "NovaPortfolio-onefile.exe")
        print(f"  Folder  build : {folder_path}\\")
        print(f"  Onefile build : {onefile_path}")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    main()
