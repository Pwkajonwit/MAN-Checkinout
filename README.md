# CheckInOut - Employee Check-in/out System

ระบบบันทึกเวลาเข้า-ออกงานสำหรับพนักงาน พร้อมระบบจัดการลาและ OT ผ่าน LINE LIFF

## 🚀 Features

- ✅ ระบบเช็คอิน/เช็คเอาท์ผ่าน LINE
- ✅ ประวัติการเข้า-ออกงาน
- ✅ ระบบขอลา (Leave Request)
- ✅ ระบบขอทำงานล่วงเวลา (OT Request)
- ✅ ระบบลงทะเบียนพนักงานผ่าน LINE Profile
- ✅ Admin Dashboard สำหรับจัดการพนักงาน

## 📋 Prerequisites

- Node.js 18+ 
- npm หรือ yarn
- LINE Developers Account
- Firebase Project

## 🔧 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd checkinout
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup Environment Variables

สร้างไฟล์ `.env.local` จาก template:

```bash
cp env.template .env.local
```

แก้ไขไฟล์ `.env.local` และใส่ค่าที่ถูกต้อง:

```env
# LINE LIFF ID (จาก LINE Developers Console)
NEXT_PUBLIC_LIFF_ID=your-liff-id-here

# Firebase Configuration (จาก Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 4. Setup LINE LIFF

ดูคู่มือการตั้งค่าโดยละเอียดที่: **[LIFF_SETUP.md](./LIFF_SETUP.md)**

สรุปขั้นตอน:
1. สร้าง LINE Login Channel ที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง LIFF App และคัดลอก LIFF ID
3. ใส่ LIFF ID ใน `.env.local`

### 5. Setup Firebase

1. สร้าง Firebase Project ที่ [Firebase Console](https://console.firebase.google.com/)
2. เปิดใช้งาน Firestore Database
3. เปิดใช้งาน Authentication (Email/Password)
4. คัดลอก Configuration และใส่ใน `.env.local`

### 6. Run Development Server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) ในเบราว์เซอร์

## 📱 Usage

### สำหรับพนักงาน (Employee)

1. เปิดแอปผ่าน LINE LIFF URL: `https://liff.line.me/{LIFF_ID}`
2. ลงทะเบียนครั้งแรก (หน้า `/register`)
3. ใช้งานระบบเช็คอิน/เช็คเอาท์

### สำหรับผู้ดูแลระบบ (Admin)

1. เข้าสู่ระบบที่ `/admin/login`
2. จัดการข้อมูลพนักงาน, อนุมัติคำขอลา/OT

## 🧪 Development Mode

### Mock Login (ทดสอบโดยไม่ใช้ LINE)

ในหน้า `/register` มีปุ่ม "Mock Login" (ไอคอน Bug) สำหรับทดสอบระบบโดยไม่ต้องเปิดผ่าน LINE

### Debug LIFF

เปิด Browser Console (F12) เพื่อดู log:
- ✅ "LIFF initialized successfully" = สำเร็จ
- ❌ "LIFF SDK not loaded" = LIFF SDK ยังไม่โหลด
- ❌ "LIFF ID not found" = ไม่มี LIFF ID ใน .env.local

## 📂 Project Structure

```
checkinout/
├── src/
│   ├── app/
│   │   ├── (admin)/          # Admin pages
│   │   ├── (employee)/       # Employee pages
│   │   └── page.tsx          # Home page
│   ├── components/
│   │   └── ui/               # UI components
│   ├── contexts/
│   │   └── EmployeeContext.tsx  # LIFF & Employee state
│   ├── lib/
│   │   ├── firebase.ts       # Firebase config
│   │   └── firestore.ts      # Firestore services
│   └── types/
├── public/                   # Static files
├── LIFF_SETUP.md            # LIFF setup guide
├── env.template             # Environment template
└── README.md
```

## 🔒 Security

- ไม่ commit ไฟล์ `.env.local` ลง Git
- ใช้ Firebase Security Rules เพื่อป้องกันการเข้าถึงข้อมูล
- LIFF ต้องใช้ HTTPS (ยกเว้น localhost)

## 🚀 Deployment

### Vercel (แนะนำ)

1. Push code ไปยัง GitHub
2. Import project ใน [Vercel](https://vercel.com)
3. เพิ่ม Environment Variables ใน Vercel Dashboard
4. Deploy!

อย่าลืมอัพเดท LIFF Endpoint URL ใน LINE Developers Console ให้ตรงกับ production URL

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [Firebase Documentation](https://firebase.google.com/docs)

## 🐛 Troubleshooting

ดูคู่มือแก้ปัญหาโดยละเอียดที่: **[LIFF_SETUP.md](./LIFF_SETUP.md)**

### ปัญหาที่พบบ่อย:

1. **ไม่สามารถ get user ได้**
   - ตรวจสอบ LIFF ID ใน `.env.local`
   - ตรวจสอบว่าเปิดผ่าน LINE App
   - ดู Console Log เพื่อหาสาเหตุ

2. **LIFF SDK not loaded**
   - รอให้ LIFF SDK โหลดเสร็จก่อน
   - ตรวจสอบ internet connection

3. **Firebase error**
   - ตรวจสอบ Firebase Configuration
   - ตรวจสอบ Firestore Security Rules

## 📞 Support

หากพบปัญหาหรือต้องการความช่วยเหลือ:
1. ตรวจสอบ [LIFF_SETUP.md](./LIFF_SETUP.md)
2. เปิด Browser Console เพื่อดู error
3. ลอง Mock Login เพื่อทดสอบระบบ