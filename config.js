// ═══════════════════════════════════════════════════════════════════
//  ATL BIM Naming Convention Checker — APS Configuration
// ═══════════════════════════════════════════════════════════════════
//
//  SETUP STEPS:
//  1. Go to https://aps.autodesk.com/myapps/ and create (or open) your app
//  2. Under "APIs & Services", enable Data Management API
//  3. Set the callback URL to your GitHub Pages URL:
//       https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
//     (for local testing also add: http://localhost:8080/)
//  4. Paste your Client ID below — no client secret needed (PKCE flow)
//  5. Commit and push — GitHub Pages will serve the updated config
//
// ═══════════════════════════════════════════════════════════════════

window.APS_CLIENT_ID     = 'YOUR_CLIENT_ID_PLACEHOLDER';
window.APS_CLIENT_SECRET = 'YOUR_CLIENT_SECRET_PLACEHOLDER';

// Override the callback URL only if auto-detection fails.
// Must end with "callback.html" and match exactly what is registered in your APS app.
// window.APS_CALLBACK_URL = 'https://your-username.github.io/your-repo/callback.html';
