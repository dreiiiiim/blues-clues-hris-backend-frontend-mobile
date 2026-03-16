// Before you run it, do this:

// 1. Find your PC's local IP — run ipconfig in your terminal and look for the IPv4 address under your WiFi adapter (e.g., 192.168.1.5)
//    Look for the entry under "Wireless LAN adapter Wi-Fi" → IPv4 Address. It'll look like 192.168.1.x or 192.168.0.x.
//    ^^^^^ your Wi-Fi IPv4
// 2. Set it in src/lib/api.ts:
   export const API_BASE_URL = "http://192.168.1.4:5000/api/tribeX/auth/v1";
//    // ^^^^^^^^^^^^^ your actual IP
// 3. Make sure your backend is running (npm run start:dev in tribeX-hris-auth-api)
// 4. Start the mobile app and test login with a real account from your DB

// export const API_BASE_URL = "https://blues-clues-hris-backend-frontend-mobile-production.up.railway.app/api/tribeX/auth/v1";
