# Revathi Herbal ERP - Admin + Staff panel with Dynamic QR + Fingerprint Attendance (DEMO)

Only the Admin and Staff panel from the main project (React + Vite) plus a small mock API
(Express) so the admin laptop and staff phones share the same data.

## New / changed files
New:
- src/admin/pages/QrAttendance.jsx   (AdminQrPanel + StaffQrPanel)
- src/admin/lib/qrAttendance.js      (client calls, WebAuthn fingerprint, punch sync)
- server/app.js, server/store.js, server/index.js, api/index.js, vercel.json (API: QR tokens, phone approval, OTP, WebAuthn, punches; Upstash Redis on Vercel, data.json locally)
Changed:
- src/admin/pages/Attendance.jsx     (admin tab "Reception QR", staff tab "QR Punch", 3 s live sync)
- src/api/attendance.ts              (mergePunches, source 'QR', fake seed punches switched off)
- src/admin/lib/qrScan.js            (jsQR now bundled from npm, no CDN)
- src/admin/data/mockData.js, pages/Login.jsx (2 extra staff logins for the 2-3 staff demo)

## Run
    npm install
    npm run dev        # UI http://localhost:5173 + mock API :3001 (laptop only test)

## Deploy on Vercel (HTTPS link for phones)
1. Push this folder to GitHub (node_modules / dist are ignored).
2. vercel.com > Add New > Project > import the repo. Framework: Vite (auto). Build: npm run build. Output: dist. Deploy.
3. In the project: Storage tab > Create / Connect Database > Upstash (Redis) > free plan > connect to this project.
   (This adds KV_REST_API_URL and KV_REST_API_TOKEN automatically.)
4. Deployments > Redeploy (so the env vars are picked up).
5. Open https://<project>.vercel.app on the admin laptop AND on the staff phones.
Without step 3 the API cannot remember anything between requests (QR scan would say Invalid QR).

## Phone test without deploying (HTTPS needed for camera + fingerprint)
    npm run demo       # builds and serves everything on :3001
    npx ngrok http 3001   # open the https link on laptop (admin) and phones (staff)

## Logins
Admin: admin@revathiherbal.demo / Admin@123
Staff: staff@revathiherbal.demo, staff2@..., staff3@... / Staff@123

## Demo flow
1. Admin > Attendance > Reception QR (keep it on screen, rotates every 20 s).
2. Staff phone: login > Attendance > QR Punch > Register this phone.
3. Admin: Phone approvals > Approve phone.
4. Staff: Enrol fingerprint (one time) > Scan reception QR > fingerprint > punch IN/OUT.
5. Admin Live board / Punch log and the staff's own calendar update within ~3 s, for that staff ID only.
6. Same staff ID on another phone: red alert + OTP on admin; admin approves or shares OTP (fingerprint must be enrolled again).
7. WiFi check: OFF for demo; "Add my IP" then ON for the MD's office test.

Limit (tell MD): phone fingerprint proves a live unlock on the registered phone, not whose finger.
server/data.json = mock DB (delete to reset).

## Scanning options
- Phone's normal camera: the QR is a link (https://<your-link>/#/attendance/DQR-...). Opens the ERP, login, then it punches automatically.
  IMPORTANT: open the ADMIN panel using the ngrok https link (not localhost), otherwise the QR link points to localhost and phones cannot open it.
- In-app scanner (Attendance > QR Punch > Scan reception QR) also reads it.
- Use the SAME browser on the phone for register, enrol and scan (iPhone: Safari for everything).
