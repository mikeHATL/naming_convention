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

window.APS_CLIENT_ID     = 'pC2CdXV09qwiLNPwCBgd9uVfGX9YnQU0gH56VbGgOJglKup2';
window.APS_CLIENT_SECRET = 'Maq1UCReYfKhOVS1D62S4FSyG6jv7tacGmDf7UFfaDWYhOxafl5VEZgxFwmfQiSQ';

// Override the callback URL only if auto-detection doesn't work for you:
// window.APS_CALLBACK_URL = 'https://your-username.github.io/your-repo/';
