W&M Autoparadies – Dynamic Setup (Supabase + Vercel)

This version stores vehicles + forms in Supabase and serves data via Vercel Serverless Functions.

1) Supabase setup (free)
   - Create a new project.
   - Open SQL Editor and run: db/schema.sql
   - Go to Project Settings -> API
     Copy:
       SUPABASE_URL
       SUPABASE_SERVICE_ROLE_KEY  (keep private!)

2) Local test (optional)
   - Install Node.js (18+)
   - In this project folder:
       npm install
   - For local Vercel dev (optional):
       npm i -g vercel
       vercel dev

3) Deploy on Vercel
   - Push this folder to GitHub.
   - Import the repo in Vercel.
   - Add Environment Variables in Vercel:
       SUPABASE_URL
       SUPABASE_SERVICE_ROLE_KEY
       ADMIN_PASSWORD
       ADMIN_JWT_SECRET

4) Admin usage
   - Open the website.
   - Press Ctrl+Shift+A (Mac: Cmd+Shift+A)
   - Enter ADMIN_PASSWORD.
   - Now the + button appears and you can add/edit/delete cars.
   - Press the shortcut again to logout.

Important note about Willhaben import
   - This build supports a 'Willhaben Link' field per car.
   - Full automatic copying (1:1 data + images) from Willhaben by just pasting a link is not implemented here.
     Reason: willhaben explicitly forbids automated access (robots.txt) and copying.
   - Recommended: use Willhaben's official dealer integration/widget, or maintain your inventory in Supabase
     and link each car to the corresponding Willhaben listing.
