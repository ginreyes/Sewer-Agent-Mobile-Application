Restore Device App Frontend (Feb 23 changes)
============================================

If you discarded changes to the frontend, copy these 3 files back over www/:

  index.html       -> concertina-device-app/www/index.html
  index.js         -> concertina-device-app/www/index.js
  logo-server-ai.svg -> concertina-device-app/www/logo-server-ai.svg

This restores:
- Loading screen with Server AI logo + spinner on app open
- Permission prompt modal when camera is denied ("Open Settings" / "I'll do it later")
- Server AI logo in the app header and on loading screen

Then run: npx cap sync android
