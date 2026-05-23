import CryptoJS from 'crypto-js';

// Retrieve from URL parameters and cache in sessionStorage
const urlParams = new URLSearchParams(window.location.search);
const queryPort = urlParams.get('api_port');
const queryKey = urlParams.get('api_key');

if (queryPort) sessionStorage.setItem('nova_api_port', queryPort);
if (queryKey) sessionStorage.setItem('nova_api_key', queryKey);

const API_PORT = sessionStorage.getItem('nova_api_port') || '8000';
const HMAC_KEY = sessionStorage.getItem('nova_api_key') || '';
const API_URL = `http://127.0.0.1:${API_PORT}/api`;

/**
 * Computes signature and returns authentication headers.
 * @param {string} path - Request endpoint path (e.g., '/api/market/quotes')
 * @param {string} method - Request method (e.g., 'POST')
 * @param {Object|null} body - Request body object or null
 * @returns {Object} - Header object with X-Signature, X-Timestamp, and X-Nonce
 */
const getAuthHeaders = (path, method, body = null) => {
    if (!HMAC_KEY) {
        // Fallback for development/unconfigured mode
        return {};
    }

    const timestamp = new Date().toISOString();
    // Cryptographically random-like nonce string
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const bodyStr = body ? JSON.stringify(body) : '';

    // Canonical string: METHOD:PATH:TIMESTAMP:NONCE:BODY
    const canonical = `${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${bodyStr}`;

    // Compute HMAC-SHA256 signature
    const signature = CryptoJS.HmacSHA256(canonical, HMAC_KEY).toString(CryptoJS.enc.Hex);

    return {
        'X-Signature': signature,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce
    };
};

/**
 * Fetch real-time market data quotes from the stateless backend proxy.
 * @param {Array<string>} symbols - Array of ticker symbols to query (e.g. ['AAPL', 'VAS.AX'])
 * @returns {Object} - Key-value map of symbol -> asset data
 */
export const fetchMarketQuotes = async (symbols) => {
    if (!symbols || symbols.length === 0) return {};
    
    try {
        const path = '/api/market/quotes';
        const method = 'POST';
        const body = { symbols };
        const authHeaders = getAuthHeaders(path, method, body);

        const response = await fetch(`${API_URL}/market/quotes`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error(`Market Proxy Error: ${response.status}`);
        }
        
        const json = await response.json();
        return json.data || {};
    } catch (error) {
        console.error("Failed to fetch market quotes:", error);
        throw error;
    }
};

/**
 * Fetch the live AUD/USD exchange rate from the backend proxy.
 * Falls back to 0.645 if the backend is unreachable.
 * @returns {number} - AUDUSD rate (e.g. 0.6431)
 */
export const fetchFxRate = async () => {
    try {
        const path = '/api/market/fx';
        const method = 'GET';
        const authHeaders = getAuthHeaders(path, method);

        const response = await fetch(`${API_URL}/market/fx`, {
            method: method,
            headers: {
                ...authHeaders
            }
        });
        if (!response.ok) throw new Error('FX fetch failed');
        const json = await response.json();
        return json.AUDUSD || 0.645;
    } catch (error) {
        console.warn("FX proxy unavailable, using fallback rate 0.645:", error);
        return 0.645;
    }
};

/**
 * Fetch historical data for a list of ticker symbols over a given period.
 * @param {Array<string>} symbols - Array of ticker symbols
 * @param {string} period - Historical period (e.g. '1mo', '3mo', '6mo', '1y', 'ytd', '3y', 'max')
 * @returns {Object} - Key-value map of symbol -> date -> close price
 */
export const fetchMarketHistory = async (symbols, period) => {
    if (!symbols || symbols.length === 0) return {};
    
    try {
        const path = '/api/market/history';
        const method = 'POST';
        const body = { symbols, period };
        const authHeaders = getAuthHeaders(path, method, body);

        const response = await fetch(`${API_URL}/market/history`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error(`History Proxy Error: ${response.status}`);
        }
        
        const json = await response.json();
        return json.data || {};
    } catch (error) {
        console.error("Failed to fetch market history:", error);
        throw error;
    }
};
