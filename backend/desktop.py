import os
import sys
import socket
import secrets
import threading
import time
import uvicorn
import webview
from fastapi.staticfiles import StaticFiles

# Resolve base path for PyInstaller or local development
if getattr(sys, "frozen", False):
    # PyInstaller temporary extraction path
    base_path = sys._MEIPASS
else:
    # Local developer project root
    base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def find_free_port() -> int:
    """Finds a random free port on loopback."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port

def wait_for_server(port: int, timeout: int = 30) -> bool:
    """
    Polls the loopback port until the server starts accepting connections
    or the timeout (in seconds) is exceeded.
    Returns True if server is ready, False if timed out.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except (ConnectionRefusedError, OSError):
            time.sleep(0.1)
    return False

def start_backend(port: int, hmac_key: str, ready_event: threading.Event):
    """Starts the FastAPI backend using Uvicorn."""
    # Pass HMAC key to backend environment
    os.environ["NOVA_HMAC_KEY"] = hmac_key

    # Import and configure app
    from main import app

    # Resolve static assets folder location
    static_dir = os.path.join(base_path, "backend", "static")
    if not os.path.exists(static_dir):
        # Fallback to dev frontend dist folder
        static_dir = os.path.join(base_path, "frontend", "dist")

    print(f"Serving static assets from: {static_dir}")

    if os.path.exists(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    else:
        print("ERROR: Static files directory not found. Frontend will not load.")

    # Use a custom config so we can hook into the startup lifecycle
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)

    # Signal the main thread the moment uvicorn has bound to its port
    original_startup = server.startup

    async def startup_with_signal(*args, **kwargs):
        await original_startup(*args, **kwargs)
        ready_event.set()

    server.startup = startup_with_signal

    # Blocks until the server shuts down
    import asyncio
    asyncio.run(server.serve())

def main():
    # 1. Generate secure dynamic key
    hmac_key = secrets.token_hex(32)

    # 2. Find a free port
    port = find_free_port()
    print(f"Launching secure local server on http://127.0.0.1:{port}...")

    # 3. Create a ready event so the webview only opens after the server is up
    ready_event = threading.Event()

    # 4. Spin up backend thread
    server_thread = threading.Thread(
        target=start_backend, args=(port, hmac_key, ready_event), daemon=True
    )
    server_thread.start()

    # 5. Wait for the server to be ready (up to 30 seconds)
    print("Waiting for backend server to start...")
    server_ready = ready_event.wait(timeout=30)

    if not server_ready:
        print("ERROR: Backend server failed to start within 30 seconds.")
        # Show a native error dialog before exiting
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "NovaPortfolio - Startup Error",
            "The local server failed to start.\n\n"
            "Please check that no other application is blocking port access, "
            "then restart NovaPortfolio."
        )
        root.destroy()
        sys.exit(1)

    # Extra safety margin: make sure the port is actually accepting TCP connections
    # (uvicorn's startup event fires slightly before the socket is fully bound)
    wait_for_server(port, timeout=5)

    print(f"Backend ready. Opening app window...")

    # 6. Build URL and create the window
    url = f"http://127.0.0.1:{port}/?api_port={port}&api_key={hmac_key}"

    window = webview.create_window(
        title="NovaPortfolio",
        url=url,
        width=1280,
        height=800,
        min_size=(1024, 768),
        background_color="#030712",
    )

    # 7. Start the GUI event loop (blocks until window is closed)
    # On Windows, force PyQt6 to avoid pythonnet dependency issues on Python 3.14
    gui_engine = "qt" if sys.platform == "win32" else None
    debug_mode = not getattr(sys, "frozen", False)
    webview.start(gui=gui_engine, debug=debug_mode)

    print("Application closed. Shutting down secure local server...")

if __name__ == "__main__":
    main()
