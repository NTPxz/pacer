<div align="center">

<img src="public/favicon.svg" width="64" alt="" />

# TAYAN <sub>ทะยาน</sub>

**ใส่เวลา 10K ที่ดีที่สุด — ได้เพซซ้อมทุกโซนและตารางซ้อมถึงวันแข่ง**

Turn your best 10K time into training paces and a week-by-week plan.

[![License: MIT](https://img.shields.io/badge/license-MIT-c2462a?style=flat-square)](LICENSE)
[![Deploy](https://img.shields.io/github/actions/workflow/status/NTPxz/pacer/pages.yml?branch=main&style=flat-square&label=deploy)](https://github.com/NTPxz/pacer/actions/workflows/pages.yml)
![React](https://img.shields.io/badge/React-18-161513?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-161513?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-161513?style=flat-square&logo=vite)

[**เปิดใช้งาน →**](https://ntpxz.github.io/pacer/)

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/hero-dark.jpg" />
  <img src="docs/hero-light.jpg" alt="หน้าแรกของ TAYAN: ช่องกรอกเวลา 10K และลู่วิ่งจำลองความเร็วของแต่ละโซน" />
</picture>

</div>

---

## ทำอะไรได้บ้าง

| | |
|---|---|
| **โซนเพซ 5 ระดับ** | Easy · Marathon · Threshold · Interval · Repetition พร้อมเวลาต่อ 400 ม. และ กม./ชม. |
| **คาดการณ์เวลาแข่ง** | 5K, 10K, ฮาล์ฟมาราธอน, มาราธอน จากความฟิตปัจจุบัน |
| **ตารางซ้อมอัตโนมัติ** | 8–20 สัปดาห์ · เป้า 5K–42K · วิ่ง 3–6 วัน/สัปดาห์ · ทุกวันมีเซ็ต ระยะ และเพซกำกับ |
| **ตู้ถ้วยรางวัล** | บันทึกสนามที่เคยแข่ง (ชื่อ วันที่ ระยะ เวลา เลขบิบ สถานที่ โน้ต) พร้อมรูปความทรงจำสูงสุด 8 รูป/รายการ หา PB ของแต่ละระยะให้อัตโนมัติ กราฟพัฒนาการ VDOT และกดใช้ผลแข่งไหนเป็นฐานคำนวณเพซก็ได้ · สำรอง/นำเข้าเป็นไฟล์ JSON |
| **ลู่วิ่งเคลื่อนไหว** | นักวิ่ง 5 คนในหน้าแรกวิ่งด้วยความเร็วจริงของแต่ละโซน (เร่ง ×10) |
| **ใช้ได้ทุกจอ** | มือถือ / เดสก์ท็อป · โหมดมืดตามระบบ · พิมพ์หรือบันทึก PDF ได้ |
| **ไม่ต้องสมัคร** | ทำงานในเบราว์เซอร์ล้วน ไม่มีเซิร์ฟเวอร์ ไม่เก็บข้อมูลออกนอกเครื่อง |

<table>
  <tr>
    <td width="62%"><img src="docs/zones.jpg" alt="ตารางโซนเพซ" /></td>
    <td rowspan="2"><img src="docs/mobile-hero.jpg" alt="หน้าแรกบนมือถือ" /></td>
  </tr>
  <tr>
    <td><img src="docs/plan.jpg" alt="ตัวสร้างตารางซ้อมและกราฟระยะรายสัปดาห์" /></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/trophy.jpg" alt="ตู้ถ้วยรางวัล: การ์ดบิบของแต่ละสนามพร้อมป้าย PB" /></td>
  </tr>
</table>

## คำนวณยังไง

ใช้โมเดล **VDOT** ของ Jack Daniels & Jimmy Gilbert จากหนังสือ *Daniels' Running Formula*

```
VO₂(v)   = −4.60 + 0.182258·v + 0.000104·v²                               v = ม./นาที
%max(t)  = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)   t = นาที
VDOT     = VO₂(v) / %max(t)
```

จาก VDOT ย้อนกลับไปหาความเร็วของแต่ละโซน:

| โซน | ความเข้มข้น | ใช้ทำอะไร |
|---|---|---|
| **E** Easy | 62–70% VDOT | วิ่งสบาย ลองรัน สร้างฐานแอโรบิก |
| **M** Marathon | เพซมาราธอนที่คาดการณ์ได้ | ฝึกเพซแข่งระยะยาว |
| **T** Threshold | ~88% VDOT | เทมโป / ครูซอินเทอร์วัล |
| **I** Interval | ~97.5% VDOT | เซ็ต 3–5 นาทีที่ VO₂max |
| **R** Repetition | I − ~6 วิ/400 ม. | ความเร็วและฟอร์ม |

ผลลัพธ์ตรงกับตาราง VDOT ต้นฉบับ เช่น 10K **50:00** → VDOT **40.0**, เทมโป **5:03–5:08/กม.**, อินเทอร์วัล **113″/400 ม.**

### โครงสร้างตารางซ้อม

```
สร้างฐาน ──▶ เพิ่มความหนัก ──▶ ช่วงพีค ──▶ ลดโหลด ──▶ วันแข่ง
  ~30%          ~35%           ที่เหลือ     1–2 สัปดาห์
```

- **ระยะรายสัปดาห์** ค่อย ๆ เพิ่มจากสัปดาห์แรกถึงพีค (×1.3 สำหรับ 5K ถึง ×1.55 สำหรับมาราธอน) และลดลง 20% ทุกสัปดาห์ที่ 4 เพื่อพักฟื้น
- **วันคุณภาพ 2 วัน/สัปดาห์** เลือกตามช่วงและระยะเป้าหมาย เช่น 10K: สปีด + เทมโปในช่วงเพิ่มความหนัก → อินเทอร์วัล + เทมโปในช่วงพีค
- **จำกัดปริมาณตามหลัก Daniels** T ≤ 10%, I ≤ 8%, R ≤ 5% ของระยะรายสัปดาห์ ลองรันไม่เกิน ~30%
- สัปดาห์สุดท้ายจบด้วยวันแข่งพร้อมเวลาเป้าหมายและเพซเฉลี่ย

## เริ่มพัฒนา

ต้องมี Node.js 20 ขึ้นไป

```bash
git clone https://github.com/NTPxz/pacer.git
cd pacer
npm install
npm run dev       # http://localhost:5173
```

| คำสั่ง | |
|---|---|
| `npm run dev` | เปิด dev server พร้อม hot reload |
| `npm run build` | type-check แล้ว build ไปที่ `dist/` |
| `npm run preview` | เปิดดูไฟล์ที่ build แล้ว |

### Deploy

Push ขึ้น `main` แล้ว GitHub Actions จะ build และ deploy ไป GitHub Pages ให้อัตโนมัติ
ครั้งแรกให้ตั้งค่า **Settings → Pages → Source = GitHub Actions**

ไฟล์ใน `dist/` เป็น static ล้วน (ใช้ relative path) จึงวางบน Netlify, Vercel, Cloudflare Pages หรือโฮสต์ไหนก็ได้

## โครงสร้างโปรเจกต์

```
src/
├── lib/
│   ├── vdot.ts          สูตร VDOT · โซนเพซ · คาดการณ์เวลา · format เวลา
│   ├── plan.ts          สร้างตารางซ้อมรายสัปดาห์
│   ├── races.ts         ข้อมูลตู้ถ้วย · หา PB · สำรอง/นำเข้า JSON
│   └── photos.ts        เก็บรูปใน IndexedDB · ย่อรูปในเบราว์เซอร์
├── components/
│   ├── TimeInput.tsx    ช่องกรอกเวลาแบบนาฬิกาจับเวลา
│   ├── Track.tsx        ลู่วิ่ง SVG ที่นักวิ่งวิ่งตามเพซจริง
│   ├── ZoneTable.tsx    ตารางโซนเพซ
│   ├── Predictions.tsx  คาดการณ์เวลาแข่ง
│   ├── PlanBuilder.tsx  ตัวเลือก · กราฟระยะ · การ์ดรายสัปดาห์
│   ├── TrophyCase.tsx   เหรียญ PB · กราฟ VDOT · การ์ดบิบ
│   ├── RaceForm.tsx     ฟอร์มเพิ่ม/แก้ไขรายการแข่ง + เลือกรูป
│   ├── Lightbox.tsx     ดูรูปเต็มจอ ปัดซ้าย-ขวาได้
│   ├── Segmented.tsx    ปุ่มเลือกแบบ segmented
│   └── Roll.tsx         ตัวเลขหมุนแบบเลขไมล์
├── App.tsx
└── styles.css           design tokens (light/dark) และ layout ทั้งหมด
```

**Stack:** React 18 · TypeScript · Vite · Framer Motion — ไม่ใช้ UI kit หรือ CSS framework

## ร่วมพัฒนา

ยินดีรับ issue และ pull request ทุกขนาด ไม่ว่าจะเป็นแก้คำผิด ปรับสูตร หรือเพิ่มฟีเจอร์

1. Fork แล้วสร้าง branch ใหม่ `git checkout -b feat/your-idea`
2. แก้ไข และตรวจว่า `npm run build` ผ่าน
3. เปิด pull request พร้อมอธิบายสั้น ๆ ว่าเปลี่ยนอะไร (มีภาพหน้าจอได้ยิ่งดี)

ไอเดียที่อยากได้: เชื่อม Strava · หน่วยไมล์ · export ไป Google Calendar (.ics) · ปรับเพซตามอุณหภูมิ/ความชื้น · ใส่ผลแข่งระยะอื่นนอกจาก 10K · ภาษาอังกฤษ

## หมายเหตุ

ตัวเลขทั้งหมดเป็น **แนวทาง** ไม่ใช่คำแนะนำทางการแพทย์ ฟังร่างกายตัวเองเสมอ
ในอากาศร้อนชื้นแบบเมืองไทย เพซช้ากว่าที่คำนวณ 10–20 วิ/กม. ถือว่าปกติ

## License

[MIT](LICENSE) © 2026 Nuthipong — นำไปใช้ แก้ไข หรือเผยแพร่ต่อได้อย่างอิสระ
