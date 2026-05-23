from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
import yfinance as yf
import traceback
import json
import os
import hmac
import hashlib
import time
import re
from datetime import datetime, timezone

# Load or generate HMAC key
HMAC_SECRET_KEY = os.environ.get("NOVA_HMAC_KEY", "")
if not HMAC_SECRET_KEY:
    import secrets
    HMAC_SECRET_KEY = secrets.token_hex(32)
    print(f"WARNING: NOVA_HMAC_KEY environment variable not set. Generated ephemeral key: {HMAC_SECRET_KEY}")

app = FastAPI(
    title="NovaPortfolio Market Proxy",
    description="Secure stateless proxy for fetching live market data via yfinance.",
    version="2.1.0"
)

# CORS restriction - only allow localhost on any port
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input validation patterns
TICKER_REGEX = re.compile(r"^[a-zA-Z0-9^.= -]{1,15}$")
PERIOD_REGEX = re.compile(r"^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$")

def validate_symbol(symbol: str):
    if not TICKER_REGEX.match(symbol):
        raise HTTPException(status_code=400, detail=f"Invalid ticker symbol format: {symbol}")

def validate_period(period: str):
    if not PERIOD_REGEX.match(period):
        raise HTTPException(status_code=400, detail=f"Invalid period format: {period}")

# HMAC Middleware Replay Attack Protection variables
TIME_WINDOW_SECONDS = 15
used_nonces = {}  # nonce -> timestamp

def cleanup_nonces():
    now = time.time()
    to_delete = [n for n, t in used_nonces.items() if now - t > TIME_WINDOW_SECONDS]
    for n in to_delete:
        del used_nonces[n]

async def set_body(request: Request, body: bytes):
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}
    request._receive = receive

class HMACVerificationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only protect API endpoints (exclude docs, static files, and root /)
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Retrieve headers
        signature = request.headers.get("X-Signature")
        timestamp_str = request.headers.get("X-Timestamp")
        nonce = request.headers.get("X-Nonce")

        if not signature or not timestamp_str or not nonce:
            return JSONResponse(status_code=403, content={"detail": "Missing signature headers"})

        # Validate timestamp (anti-replay)
        try:
            clean_ts = timestamp_str.replace("Z", "+00:00")
            request_time = datetime.fromisoformat(clean_ts)
            now = datetime.now(timezone.utc)
            time_diff = abs((now - request_time).total_seconds())
            if time_diff > TIME_WINDOW_SECONDS:
                return JSONResponse(status_code=403, content={"detail": "Request timestamp expired (replay protection)"})
        except Exception:
            return JSONResponse(status_code=403, content={"detail": "Invalid timestamp format"})

        # Validate nonce (anti-replay)
        cleanup_nonces()
        if nonce in used_nonces:
            return JSONResponse(status_code=403, content={"detail": "Nonce already used (replay protection)"})
        used_nonces[nonce] = time.time()

        # Read body and reset it
        body = await request.body()
        await set_body(request, body)

        # Compute canonical string: METHOD:PATH:TIMESTAMP:NONCE:BODY
        body_str = body.decode("utf-8") if body else ""
        canonical = f"{request.method}:{request.url.path}:{timestamp_str}:{nonce}:{body_str}"

        # Compute expected HMAC
        expected_sig = hmac.new(
            HMAC_SECRET_KEY.encode("utf-8"),
            canonical.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            return JSONResponse(status_code=403, content={"detail": "Invalid signature"})

        return await call_next(request)

app.add_middleware(HMACVerificationMiddleware)

class TickerRequest(BaseModel):
    symbols: List[str]

@app.get("/api/status")
def read_root():
    return {"status": "secure_proxy_online", "mode": "hmac_verified"}

def fetch_single(symbol: str) -> dict | None:
    """
    Fetch quote for one symbol. Returns a result dict or None if not found.
    """
    try:
        t = yf.Ticker(symbol)
        info = t.info
        if info and info.get('regularMarketPrice'):
            return {
                "symbol": symbol,
                "currentPrice": info.get('regularMarketPrice', info.get('currentPrice', 0.0)),
                "prevClose": info.get('regularMarketPreviousClose', info.get('previousClose', 0.0)),
                "name": info.get('longName', info.get('shortName', symbol)),
                "currency": info.get('currency', 'USD'),
                "type": info.get('quoteType', 'EQUITY'),
                "sector": info.get('sector', 'Other'),
                "industry": info.get('industry', 'Other'),
            }
        # Fallback: try history
        hist = t.history(period="2d")
        if not hist.empty:
            return {
                "symbol": symbol,
                "currentPrice": float(hist['Close'].iloc[-1]),
                "prevClose": float(hist['Close'].iloc[0]) if len(hist) > 1 else float(hist['Close'].iloc[-1]),
                "name": symbol,
                "currency": "AUD" if symbol.endswith(".AX") else "USD",
                "type": "UNKNOWN",
                "sector": "Other",
                "industry": "Other",
            }
    except Exception as e:
        print(f"  fetch_single({symbol}) error: {e}")
    return None

@app.post("/api/market/quotes")
def get_market_quotes(request: TickerRequest):
    """
    Fetches the latest quotes for a list of ticker symbols.
    """
    if not request.symbols:
        return {"data": {}}

    # Sanitize symbols
    for s in request.symbols:
        validate_symbol(s)

    results = {}
    for symbol in request.symbols:
        data = fetch_single(symbol)
        if data:
            results[symbol] = {**data, "symbol": symbol}
        elif not symbol.endswith(".AX"):
            ax_symbol = symbol + ".AX"
            print(f"  {symbol}: not found, retrying as {ax_symbol}")
            data_ax = fetch_single(ax_symbol)
            if data_ax:
                results[symbol] = {
                    **data_ax,
                    "symbol": symbol,
                    "currency": "AUD",
                }
            else:
                print(f"  {symbol}: also not found as {ax_symbol}, skipping")
        else:
            print(f"  {symbol}: not found, skipping")

    return {"data": results}

@app.get("/api/market/fx")
def get_fx_rate():
    """
    Fetches the current AUD/USD exchange rate.
    """
    try:
        ticker = yf.Ticker("AUDUSD=X")
        info = ticker.info
        rate = info.get("regularMarketPrice") or info.get("currentPrice")
        if not rate:
            hist = ticker.history(period="2d")
            rate = float(hist["Close"].iloc[-1]) if not hist.empty else 0.645
        return {"AUDUSD": round(float(rate), 6)}
    except Exception as e:
        traceback.print_exc()
        return {"AUDUSD": 0.645, "error": str(e)}

class HistoryRequest(BaseModel):
    symbols: List[str]
    period: str

@app.post("/api/market/history")
def get_market_history(request: HistoryRequest):
    """
    Fetches historical close prices for a list of ticker symbols.
    """
    validate_period(request.period)
    for s in request.symbols:
        validate_symbol(s)

    additional_symbols = ["^GSPC", "^AXJO", "AUDUSD=X"]
    ax_fallbacks = {}
    query_symbols = []
    
    for s in request.symbols:
        if not s.startswith("^") and s != "AUDUSD=X":
            query_symbols.append(s)
            if not s.endswith(".AX"):
                ax_sym = s + ".AX"
                query_symbols.append(ax_sym)
                ax_fallbacks[s] = ax_sym
        else:
            query_symbols.append(s)
            
    query_symbols = list(set(query_symbols + additional_symbols))
    
    try:
        print(f"Fetching historical data for {query_symbols} over {request.period}")
        data = yf.download(query_symbols, period=request.period, group_by="ticker")
        
        results = {}
        for symbol in request.symbols + additional_symbols:
            if symbol in data and not data[symbol].empty:
                sym_df = data[symbol]
                if 'Close' in sym_df:
                    close_prices = sym_df['Close'].dropna()
                    if not close_prices.empty:
                        close_prices.index = close_prices.index.strftime("%Y-%m-%d")
                        results[symbol] = close_prices.to_dict()
                        continue
            
            if symbol in ax_fallbacks:
                ax_sym = ax_fallbacks[symbol]
                if ax_sym in data and not data[ax_sym].empty:
                    ax_df = data[ax_sym]
                    if 'Close' in ax_df:
                        close_prices = ax_df['Close'].dropna()
                        if not close_prices.empty:
                            close_prices.index = close_prices.index.strftime("%Y-%m-%d")
                            results[symbol] = close_prices.to_dict()
                            
        return {"data": results}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to download history: {str(e)}")
