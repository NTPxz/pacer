# ตั้งค่า Login (Google / Facebook) + Supabase + Vercel

แอปใช้แบบ guest ได้เสมอ — ถ้ายังไม่ใส่ค่าด้านล่าง ปุ่ม "เข้าสู่ระบบ" จะไม่แสดง

## 1. Supabase (ฟรี)
1. สร้างโปรเจกต์ที่ <https://supabase.com/dashboard> (แนะนำ region Singapore)
2. **SQL Editor** → วางไฟล์ [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) แล้ว Run (สร้างตาราง `user_docs` + bucket รูป `race-photos` พร้อม Row Level Security)
3. **Project Settings → API**: จด `Project URL`, `anon / publishable key` และ `service_role / secret key` (ตัวหลังห้ามใส่ในฝั่งเว็บ)
4. **Authentication → URL Configuration**
   - Site URL: `https://<โดเมน vercel ของคุณ>`
   - Redirect URLs: `https://<โดเมน vercel>/**`, `https://ntpxz.github.io/pacer/**`, `http://localhost:5173/**`

## 2. Google login (ฟรี)
1. <https://console.cloud.google.com/apis/credentials> → **Create credentials → OAuth client ID** → Web application
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. OAuth consent screen: ใส่ชื่อแอป TAYAN, privacy policy `https://<โดเมน>/privacy.html`, scope แค่ `email`, `profile`, `openid` แล้วกด Publish
4. Supabase → **Authentication → Providers → Google**: เปิด แล้ววาง Client ID / Client Secret

## 3. Facebook login (ฟรี)
1. <https://developers.facebook.com/apps> → Create app → use case **Authenticate and request data from users with Facebook Login**
2. Facebook Login → Settings → Valid OAuth Redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
3. App settings → Basic: Privacy Policy URL `https://<โดเมน>/privacy.html`, User data deletion → Data deletion instructions URL `https://<โดเมน>/privacy.html#delete`
4. ขอสิทธิ์แค่ `public_profile` และ `email` แล้วสลับแอปเป็น **Live**
5. Supabase → **Authentication → Providers → Facebook**: วาง App ID / App Secret

## 4. Vercel
**Settings → Environment Variables** (Production + Preview):

| ชื่อ | ค่า | ใช้ที่ |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL | หน้าเว็บ |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key | หน้าเว็บ |
| `SUPABASE_URL` | Project URL | `api/delete-account` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key | `api/delete-account` (ฝั่งเซิร์ฟเวอร์เท่านั้น) |

แล้ว Redeploy — ปุ่มเข้าสู่ระบบจะขึ้นมุมขวาบน

รันในเครื่อง: คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า (`npm run dev`)

## การซิงก์ทำงานยังไง
- แอปยังเก็บข้อมูลในเครื่อง (localStorage + IndexedDB) เหมือนโหมด guest ทุกประการ
- เข้าสู่ระบบครั้งแรกบนเครื่องที่มีข้อมูล guest → **รวม** กับข้อมูลในบัญชี (รายการแข่ง / บันทึกซ้อมรวมกัน, การตั้งค่าใช้ของบัญชี)
- หลังจากนั้น ทุกการแก้ไขถูกส่งขึ้นคลาวด์ภายใน ~1 วินาที เปิดเครื่องอื่นจะได้เวอร์ชันล่าสุด (การลบก็ซิงก์ด้วย)
- รูปในตู้ถ้วยอัปโหลดไป bucket ส่วนตัว `race-photos/<user id>/` และดาวน์โหลดกลับเมื่อจำเป็น
- ออกจากระบบ → ลบข้อมูลส่วนตัวออกจากเครื่องนั้น (ยังอยู่บนคลาวด์)
- ลบบัญชี → `POST /api/delete-account` (Vercel Function) ลบผู้ใช้ เอกสาร และรูปทั้งหมดถาวร
