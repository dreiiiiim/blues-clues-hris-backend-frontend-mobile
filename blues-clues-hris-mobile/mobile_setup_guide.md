# 📱 Blue's Clues HRIS - Mobile Setup & Testing Guide

Welcome! This guide will help you set up and run the **Blue's Clues HRIS Mobile Application** on your physical phone (Android or iOS) so you can test all features and identify any errors.

Since the mobile app is built with **Expo SDK 54**, running it on your phone is incredibly simple and does not require complex Android Studio or Xcode setups.

---

## 🛠️ Step 1: Prerequisites

1. **Install Expo Go on your Phone:**
   - **Android:** Search for [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) on the Google Play Store and install it.
   - **iOS:** Search for [Expo Go](https://apps.apple.com/us/app/expo-go/id984023395) on the Apple App Store and install it.

2. **Connect to the Same Wi-Fi:**
   - Your PC/laptop and your phone **MUST** be connected to the exact same Wi-Fi network. 
   - *(Note: If your network isolates devices, like some university, hotel, or office networks, don't worry! We have a solution for this in Step 4 below.)*

---

## 🔗 Step 2: Configure Your Backend Connection

For the mobile app to talk to your backend server running on your PC, you need to point the app to your computer's local IP address.

### A. Find Your PC's Local IP Address
1. Open **Command Prompt** or **PowerShell** on your Windows PC.
2. Type the following command and press Enter:
   ```cmd
   ipconfig
   ```
3. Look for the adapter you are currently using to connect to the internet (usually **Wireless LAN adapter Wi-Fi**).
4. Locate the **IPv4 Address**. It will look something like `192.168.1.XX` or `10.0.0.XX` (for example: `192.168.1.15`).

### B. Update the Mobile Environment Config
1. In the `blues-clues-hris-mobile` folder, make sure you have a `.env` file (we verified it exists).
2. Open the `.env` file and update `EXPO_PUBLIC_API_BASE_URL` with your PC's IP address:
   ```env
   # Local dev (Replace with your own Wi-Fi IPv4 address):
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XX:5000/api/tribeX/auth/v1
   ```
   *(Replace `192.168.1.XX` with your actual IPv4 address from the `ipconfig` command).*
3. Save the file.

---

## 🚀 Step 3: Run the Backend & Database
Before testing the mobile app, make sure your backend is running so it can handle logins:
1. Navigate to your backend directory (e.g., `tribeX-hris-auth-api`).
2. Ensure your local database/services are started.
3. Start the dev server:
   ```bash
   npm run start:dev
   ```

---

## 📲 Step 4: Launch & Test on Your Phone

1. Open a terminal in the `blues-clues-hris-mobile` folder.
2. Run the Expo start command:
   ```bash
   npm start
   ```
   *Alternatively, if your Wi-Fi uses client isolation (common on public networks) or you get connection errors, run:*
   ```bash
   npm run start -- --tunnel
   ```
   *(This starts Expo in **Tunnel Mode**, routing the connection through the internet so your phone can connect even if the local Wi-Fi prevents direct peer-to-peer connections!)*

3. Once the server starts, you will see a large **QR Code** printed directly in your terminal.
4. **Scan the QR Code:**
   - **Android:** Open the **Expo Go** app and tap **"Scan QR Code"** at the top.
   - **iOS:** Open your phone's native **Camera app**, point it at the QR code, and tap the notification banner to open it in **Expo Go**.
5. The Expo Go app will download and bundle the Javascript. You'll see a progress bar (`Building JavaScript bundle...`). Once it completes, the app will launch!

---

## 🚨 Troubleshooting Common Errors

### 1. "Network request failed" or Login hangs indefinitely
* **Cause:** The mobile app is trying to talk to the backend, but the connection is blocked or misconfigured.
* **Fixes:**
  1. Double check your `.env` file's `EXPO_PUBLIC_API_BASE_URL`. Did you replace the IP with your *current* IP? (IPs can change when you reconnect to Wi-Fi).
  2. Make sure your backend server is active and listening on port `5000`.
  3. Ensure both devices are on the exact same Wi-Fi.
  4. **Firewall Block:** Windows Firewall might be blocking incoming connections to your node backend. You can temporarily turn off the private network firewall, or allow Node.js through the firewall.

### 2. "Metro Bundler has disconnected" or QR code fails to load the app
* **Cause:** Your phone cannot reach your computer's local Metro server.
* **Fix:** Use **Tunnel Mode** to bypass local network restrictions. Run:
  ```bash
  npx expo start --clear --tunnel
  ```
  This creates a secure Ngrok tunnel, allowing Expo Go to connect from anywhere in the world!

### 3. Red Screen Error: "Invalid element..." or raw text outside `<Text>` component
* **Cause:** React Native doesn't allow bare strings outside of `<Text>` components.
* **Note:** We have a custom patch active in `App.tsx` (`patchJsxRuntime`) that automatically wraps raw strings in `<Text>` components to prevent crashes, keeping the code highly compatible and robust!

---

## 📋 Recommended Testing Checklist

Once you're in, test the following flows to verify everything works:
- [ ] **Sign In (Staff):** Test with an HR, Manager, Employee, or System Admin account.
- [ ] **Portal Select:** Verify that roles with multiple portals (like System Admin or Manager) are prompted to choose a portal.
- [ ] **Sign In (Applicant):** Test the applicant login.
- [ ] **Sign Up:** Create a new applicant account and verify they can register.
- [ ] **Dashboard Browsing:** Switch between screens and make sure lists and graphics render beautifully.
- [ ] **Async Storage Check:** Close the app completely and reopen it. Verify that your session is remembered and you don't have to log back in.
