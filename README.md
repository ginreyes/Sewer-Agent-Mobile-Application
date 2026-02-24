# Concertina Device App

Android companion app for Concertina. Scans a connection QR code, reads real device info (model, manufacturer, battery, signal), sends it to Concertina, and uploads inspection video.

---

## What it does

1. **Scan QR** — Admin generates a connection QR from Concertina Admin → Device data
2. **Auto-reads device info** — model, manufacturer, battery, signal, serial
3. **Sends to Concertina** — `POST /api/devices/:id/ingest`
4. **Upload video** — send inspection footage directly from the device

---

## Requirements

- Node.js 18+
- Android Studio (Hedgehog or newer)
- Java 17 (bundled with Android Studio)
- Android SDK (API 22+)

The app **requires** these Android permissions (declared in `android/app/src/main/AndroidManifest.xml`):

- `android.permission.INTERNET` — to talk to Concertina
- `android.permission.CAMERA` — to scan QR and record video

To **check** that the manifest still declares them (e.g. after editing the manifest or adding features):

```bash
npm run check:permissions
```

If any are missing, the script exits with an error and lists what to add.

The app shows the **Server AI** logo on the loading screen and in the header. Logo asset: `www/logo-server-ai.svg` (you can replace it with your own image; keep the same filename or update references in `www/index.html`).

---

## Setup (first time)

```bash
# 1. Install dependencies
npm install

# 2. Add Android platform + sync
npx cap add android
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

---

## Build APK

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
