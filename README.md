# Concertina Device App

Android companion app for Concertina. **React + Tailwind CSS**, **white theme**. Scans a connection QR code, reads real device info (model, manufacturer, battery, signal), sends it to Concertina, and uploads inspection video.

---

## What it does

1. **Scan QR** — Admin generates a connection QR from Concertina Admin → Device data (or Add Device → “Use with Concertina Device app”)
2. **Auto-reads device info** — model, manufacturer, battery, signal, serial
3. **Sends to Concertina** — `POST /api/devices/:id/ingest` (same Node.js API as the web app)
4. **Upload video** — send inspection footage directly from the device

**Using the web app API:** The app talks to the same Node.js backend as the Concertina web app. The connection URL includes `apiBase` (backend URL). Use the API client in `src/api/client.js` to call any backend endpoint from the app (e.g. `createApiClient(connection).ingest(...)`, `.uploadVideo(...)`, or `.request(method, path, options)` for custom routes).

---

## Requirements

- Node.js 18+
- Android Studio (Hedgehog or newer)
- Java 17 (bundled with Android Studio)
- Android SDK (API 22+)

The app **requires** these Android permissions (declared in `android/app/src/main/AndroidManifest.xml`):

- **`android.permission.INTERNET`** — required so the app can connect to the Concertina backend (same Node.js API as the web app). Without it, ingest and upload will fail.
- `android.permission.CAMERA` — to scan QR and record video

To **check** that the manifest still declares them (e.g. after editing the manifest or adding features):

```bash
npm run check:permissions
```

If any are missing, the script exits with an error and lists what to add.

The app is built with **React** and **Tailwind CSS** (Vite). It uses a **white/light theme**. The **Server AI** logo appears on the loading screen and in the header. Logo: `public/logo-server-ai.svg` (replace it or update references in `src/App.jsx`).

---

## Setup (first time)

```bash
# 1. Install dependencies
npm install

# 2. Build the web app (React + Vite)
npm run build

# 3. Add Android platform + sync (sync copies dist/ into the native project)
npx cap add android
npm run cap:sync

# 4. Open in Android Studio
npx cap open android
```

**Development:** Run `npm run dev` for a local dev server with hot reload. Use `npm run build` before `npx cap sync android` (or `npm run cap:sync`) so the Android app gets the latest UI.

---

## Environment variables (env)

You can use a `.env` file (copy from `.env.example`) to configure the app without changing code.

| Variable | Used by | Description |
|----------|---------|-------------|
| `VITE_DEFAULT_API_BASE` | Vite (app) | Default backend URL when the user doesn’t enter one (e.g. `https://api.yourserver.com`). Pre-fills the “API Base URL” in Advanced settings. |
| `VITE_APP_TITLE` | Vite (app) | App title in the header (e.g. `Sewer Agent Ai App Device Registration`). |
| `CAPACITOR_APP_NAME` | Capacitor/Android | App name on the Android launcher and activity title. Set before `npm run build` and `npx cap sync android`. |
| `CAPACITOR_APP_ID` | Capacitor/Android | Android application id (optional; default `ai.concertina.device`). |

- **Vite** loads `.env` automatically; only variables starting with `VITE_` are exposed to the app (e.g. `import.meta.env.VITE_APP_TITLE`).
- **Capacitor** reads `.env` when running `cap sync` or `cap run`, so `CAPACITOR_APP_NAME` and `CAPACITOR_APP_ID` affect the native Android project.
- Do not commit `.env` (it’s in `.gitignore`). Commit `.env.example` as a template.

---

## Build APK

The build script runs `npm run build` (Vite) then syncs to Android and runs Gradle.

### On Mac / Linux:
```bash
npm run android:build
```

### On Windows:
```bash
npm run android:build:win
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Run on device (USB)

1. Enable Developer Options on Android phone:
   - Settings → About Phone → tap **MIUI Version** 7 times
2. Enable USB Debugging:
   - Settings → Additional Settings → Developer Options → USB Debugging ON
3. Connect phone via USB, tap **Allow** on phone
4. Run:
```bash
npm run cap:run
```

---

## How to view app logs

Logs from the app (including `console.log` in React/JS) go to **Android’s log system**. You can see them in two ways.

### Option 1: Android Studio (easiest)

1. Open the Android project:
   ```bash
   npx cap open android
   ```
2. Run the app on a device or emulator (green Run button or **Run → Run 'app'**).
3. Open **Logcat**: bottom toolbar **Logcat**, or **View → Tool Windows → Logcat**.
4. In the filter box you can narrow by:
   - **App**: choose your app (e.g. “Sewer Agent Ai App”) to see only its logs.
   - **Tag**: e.g. `Capacitor`, `Console`, `chromium` (WebView/JS often use these).
   - **Search**: e.g. `Sewer Agent` or `ingest` to find your messages.

**JavaScript `console.log`** from your React app appears in Logcat under tags like **Console** or **Capacitor/Console**. So any `console.log(...)` in `App.jsx` or other JS will show there when the app runs.

### Option 2: Command line (adb logcat)

With the phone connected via USB and USB debugging on:

```bash
# All logs (very noisy)
adb logcat

# Only your app’s process (replace with your package name if different)
adb logcat --pid=$(adb shell pidof ai.concertina.device)

# Filter by tag (e.g. Capacitor / WebView console)
adb logcat -s "Capacitor:V" "Console:V" "chromium:V"

# Save to a file
adb logcat -d > app-logs.txt
```

- **Package name** is in `capacitor.config.ts` (`appId`) or `android/app/src/main/AndroidManifest.xml` (e.g. `ai.concertina.device`).
- To see **backend** logs (Node.js when the app sends “Send to Sewer AI” or uploads), check the terminal or process where you run the Concertina backend (e.g. the `[Send to Concertina]` console.log we added).

### Quick reference

| What you want           | Where to look                                      |
|-------------------------|-----------------------------------------------------|
| JS `console.log` in app | Android Studio Logcat or `adb logcat` (tag Console/Capacitor) |
| Native Android logs    | Logcat filtered by your app or package             |
| Backend (ingest/API)    | Terminal / logs of the Node.js backend process     |

---

## Troubleshooting: "Network error: Failed to fetch"

If you get this when tapping **Send to Sewer AI** (or when uploading), check the following.

### 1. Use your computer’s IP, not `localhost`

On the **phone**, `localhost` is the phone itself, not your dev machine. The **API Base URL** must be the machine where the backend runs.

- Find your computer’s IP (e.g. Windows: `ipconfig`, look for IPv4 like `192.168.1.100`).
- In the app, use that IP and port, e.g. **`http://192.168.1.100:5000`** (replace with your backend port).
- If you use the connection QR/link from the web admin, ensure **NEXT_PUBLIC_BACKEND_URL** (or the link’s `apiBase`) is set to that same `http://YOUR_IP:PORT`, not `http://localhost:5000`, when generating the QR for use on a real device.

### 2. Backend must be reachable from the phone

- Backend should listen on **0.0.0.0** (not only 127.0.0.1), e.g. `app.listen(5000, '0.0.0.0')`.
- Phone and computer must be on the **same Wi‑Fi** (or same network).
- Firewall on the computer must allow incoming connections on the backend port (e.g. 5000).

### 3. HTTP is allowed on Android

The app has **`android:usesCleartextTraffic="true"`** in the manifest so **HTTP** (non-HTTPS) URLs work. If you use **HTTPS**, ensure the certificate is valid (no self‑signed issues, or add a network security config if you need to allow a specific cert).

### 4. Backend CORS

The backend allows requests with **no origin** and from **Capacitor**-style origins (`capacitor://`, `file://`). If you run a custom backend, ensure CORS allows your app’s requests.

After changing the API Base URL or backend, **rebuild and sync** the app if needed: `npm run build` then `npx cap sync android`, and run the app again.

---

## Host the APK (no Play Store needed)

1. Build the APK
2. Copy to your frontend's public folder:
   ```
   concertina_front_end/public/downloads/concertina-device.apk
   ```
3. Set env variable:
   ```
   NEXT_PUBLIC_DEVICE_APP_DOWNLOAD_URL=https://your-domain.com/downloads/concertina-device.apk
   ```
4. Users download directly from your Concertina app — no Play Store needed

---

## Connection URL format

```
https://your-app.com/device-connect?deviceId=DEVICE_ID&secret=SECRET
```

If backend is on a different host/port add `&apiBase=http://192.168.1.1:5000`

---

## Backend endpoints needed

| Endpoint | Method | Description |
|---|---|---|
| `/api/devices/:id/ingest` | POST | Receive device info |
| `/api/devices/:id/upload-video` | POST | Receive video upload |

### Ingest body:
```json
{
  "deviceSecret": "...",
  "battery": 85,
  "signal": "4g",
  "status": "active",
  "serialNumber": "...",
  "model": "Poco F4",
  "manufacturer": "Xiaomi",
  "platform": "android",
  "osVersion": "13"
}
```

---

## View logs in Android Studio

To see the app logs (including **camera debug** messages like `[Concertina Device Camera]`):

1. **Open the project in Android Studio**  
   `npx cap open android`

2. **Run the app** on a device or emulator (Run ▶ or `Shift+F10`).

3. **Open Logcat**  
   - Bottom toolbar: click **Logcat**, or  
   - Menu: **View → Tool Windows → Logcat**

4. **Filter so you see only your app’s logs**
   - **Package / process:** In the Logcat toolbar, use the dropdown and select your app (e.g. **ai.concertina.device**).  
   - **Search:** In the Logcat filter box, type:  
     `Concertina`  
     so you see lines containing “Concertina” (including `[Concertina Device Camera]`).
   - Optional: filter by tag `chromium` or `Console` to see WebView/JS console output if your app tag filter hides it.

5. **What you’ll see**
   - JS `console.log` from the WebView (including camera logs) usually appear in Logcat with tag **chromium** or **Console** and the message.  
   - So either:
     - Leave the process set to **ai.concertina.device** and search for **Concertina**, or  
     - In the filter box use: `Concertina|chromium|Console` (if your Logcat supports regex) to include WebView console lines.

6. **When the camera fails**
   - Check Logcat for lines like:  
     `[Concertina Device Camera] In-app scanner failed`  
     and the next lines for **Error name** and **Error message** (e.g. `NotAllowedError`, `Permission denied`).

7. **Xiaomi / MIUI: “Access denied” and “ignore the status update of camera”**
   - Logs like `Access denied finding property "vendor.camera.aux.packagelist"` and `CameraExtImplXiaoMi ... ignore the status update of camera: 2` are **normal** on Xiaomi. They come from the vendor camera layer and do **not** mean the main camera failed. If the in-app scanner or “take photo” still doesn’t work, the real error is usually from the WebView (see step 6 or use **chrome://inspect** → inspect your app → Console).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Camera not working` | Check camera permission in phone settings (Settings → Apps → Concertina Device → Permissions). On Xiaomi, also allow “Camera” in App permissions. |
| `Network error` | Make sure phone and server on same network, or server is on internet |
| `Device not found in Android Studio` | Change USB mode to File Transfer (MTP) |
| `Build failed` | Make sure Java 17 is selected in Android Studio |
| `cleartext http blocked` | Add `&apiBase=https://...` (use HTTPS) or set `allowMixedContent: true` in capacitor.config.json |
