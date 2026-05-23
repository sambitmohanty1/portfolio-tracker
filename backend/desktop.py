import os
import sys
import socket
import secrets
import threading
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

def start_backend(port: int, hmac_key: str):
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
        
    # Start server (bind only to loopback for security)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")

def main():
    # 1. Generate secure dynamic key
    hmac_key = secrets.token_hex(32)
    
    # 2. Find a free port
    port = find_free_port()
    print(f"Launching secure local server on http://127.0.0.1:{port}...")
    
    # 3. Spin up backend thread
    server_thread = threading.Thread(target=start_backend, args=(port, hmac_key))
    server_thread.daemon = True
    server_thread.start()
    
    # 4. Start the native Desktop window
    # Enable debug mode if we run in development
    debug_mode = not getattr(sys, "frozen", False)
    
    url = f"http://127.0.0.1:{port}/?api_port={port}&api_key={hmac_key}"
    
    window = webview.create_window(
        title="NovaPortfolio",
        url=url,
        width=1280,
        height=800,
        min_size=(1024, 768),
        background_color="#030712"
    )
    
    # Start loop (will block until window is closed)
    # On Windows, we explicitly force PyQt6 ('qt') to avoid pythonnet dependency issues on Python 3.14
    gui_engine = "qt" if sys.platform == "win32" else None
    webview.start(gui=gui_engine, debug=debug_mode)
    print("Application closed. Shutting down secure local server...")

if __name__ == "__main__":
    main()
