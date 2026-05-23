import os
import shutil
import subprocess
import sys

# Define directories
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
STATIC_DIR = os.path.join(BACKEND_DIR, "static")

# Get local python virtual environment paths
if sys.platform == "win32":
    PYTHON_EXE = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
    PIP_EXE = os.path.join(BACKEND_DIR, "venv", "Scripts", "pip.exe")
    PYINSTALLER_EXE = os.path.join(BACKEND_DIR, "venv", "Scripts", "pyinstaller.exe")
else:
    PYTHON_EXE = os.path.join(BACKEND_DIR, "venv", "bin", "python")
    PIP_EXE = os.path.join(BACKEND_DIR, "venv", "bin", "pip")
    PYINSTALLER_EXE = os.path.join(BACKEND_DIR, "venv", "bin", "pyinstaller")

def run_command(command, cwd=None):
    """Executes a command and exits on error."""
    print(f"Running: {command} in {cwd or ROOT_DIR}")
    result = subprocess.run(command, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"Error: Command failed with code {result.returncode}: {command}")
        sys.exit(result.returncode)

def main():
    print("="*60)
    print("         NovaPortfolio Standalone Desktop App Builder")
    print("="*60)

    # 1. Install build dependencies in backend virtual environment securely
    print("\n[Step 1] Ensuring build dependencies are installed...")
    req_path = os.path.join(BACKEND_DIR, "requirements.txt")
    if os.path.exists(req_path):
        print("Installing backend requirements...")
        run_command(f'"{PIP_EXE}" install -r "{req_path}"')
        
    if sys.platform == "win32":
        # Windows PyQt6 workaround to avoid pythonnet compile crash
        print("Windows detected: Installing PyQt6-WebEngine and pywebview --no-deps...")
        run_command(f'"{PIP_EXE}" install PyQt6 PyQt6-WebEngine')
        run_command(f'"{PIP_EXE}" install pywebview --no-deps')
        run_command(f'"{PIP_EXE}" install pyinstaller bottle proxy-tools qtpy')
    else:
        # Standard Unix install
        print("Unix detected: Installing standard packages...")
        run_command(f'"{PIP_EXE}" install pywebview pyinstaller')

    # 2. Run React frontend build
    print("\n[Step 2] Building frontend React assets...")
    node_modules_dir = os.path.join(FRONTEND_DIR, "node_modules")
    if not os.path.exists(node_modules_dir):
        print("node_modules folder not found in frontend. Running npm install first...")
        run_command("npm install", cwd=FRONTEND_DIR)
        
    run_command("npm run build", cwd=FRONTEND_DIR)

    # 3. Clean and prepare backend static assets folder
    print("\n[Step 3] Staging frontend assets for Python inclusion...")
    if os.path.exists(STATIC_DIR):
        print(f"Cleaning existing staged assets in: {STATIC_DIR}")
        shutil.rmtree(STATIC_DIR)
        
    dist_dir = os.path.join(FRONTEND_DIR, "dist")
    if not os.path.exists(dist_dir):
        print("Error: React build directory (frontend/dist) was not created.")
        sys.exit(1)
        
    shutil.copytree(dist_dir, STATIC_DIR)
    print(f"Successfully copied build files from {dist_dir} to {STATIC_DIR}")

    # 4. Invoke PyInstaller
    print("\n[Step 4] Bundling desktop application with PyInstaller...")
    # Determine the cross-platform path separator for PyInstaller --add-data
    # Windows uses Semicolon (;), Mac/Linux use Colon (:)
    sep = ";" if sys.platform == "win32" else ":"
    
    pyinstaller_args = [
        f'"{PYINSTALLER_EXE}"',
        '--name="NovaPortfolio"',
        '--noconsole',
        '--noconfirm',  # Overwrite output directory without asking
        f'--add-data="backend/static{sep}backend/static"',
        '--collect-all uvicorn',
        '--collect-all fastapi',
        '--collect-all yfinance',
        '--collect-all python-multipart',
        '--collect-all pydantic',
    ]
    
    if sys.platform == "win32":
        pyinstaller_args.append('--collect-all PyQt6')  # Collect PyQt6 libraries for webview rendering
        
    if sys.platform == "darwin":
        pyinstaller_args.append('--windowed')  # Create .app bundle on macOS
        
    pyinstaller_args.append(f'"{os.path.join(BACKEND_DIR, "desktop.py")}"')
    
    # Run the compile command
    build_cmd = " ".join(pyinstaller_args)
    run_command(build_cmd, cwd=ROOT_DIR)
    
    print("\n" + "="*60)
    print("BUILD COMPLETED SUCCESSFULLY!")
    
    out_path = os.path.join(ROOT_DIR, 'dist', 'NovaPortfolio.app' if sys.platform == 'darwin' else 'NovaPortfolio')
    print(f"Standalone application path: {out_path}")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
