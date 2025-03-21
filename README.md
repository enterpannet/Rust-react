# Mouse & Keyboard Automation Desktop App

แอพลิเคชัน Desktop ที่ช่วยในการทำ Automation บนเครื่องคอมพิวเตอร์ โดยการแตะเมาส์และคีย์บอร์ด

## โครงสร้างโปรเจค

โปรเจคนี้ประกอบด้วย 3 ส่วนหลัก:

1. **react-vite-frontend**: UI ของแอพพลิเคชันที่สร้างด้วย React, Vite, TypeScript, Tailwind CSS และ Ant Design
2. **rust-backend**: Server-side logic ที่ทำงานด้านการควบคุมเมาส์และคีย์บอร์ด สร้างด้วย Rust
3. **src-tauri**: ส่วนที่ทำหน้าที่แปลง web app เป็น desktop app โดยใช้ Tauri

## การติดตั้ง

1. ติดตั้ง dependencies หลัก:
   ```
   npm install
   ```

2. ติดตั้ง dependencies ของ frontend:
   ```
   cd react-vite-frontend
   npm install
   ```

## การพัฒนา

เริ่มการพัฒนาโดยใช้คำสั่ง:

```
npm run dev
```

คำสั่งนี้จะ:
1. เริ่มการทำงานของ Vite dev server (frontend)
2. เริ่มการทำงานของ Rust backend
3. เปิดแอพพลิเคชันในโหมด development

### การพัฒนาเฉพาะ Frontend

หากต้องการพัฒนาเฉพาะส่วน Frontend:

```
npm run dev:react
```

## การสร้าง Production Build

สร้างไฟล์สำหรับนำไปใช้งานจริง:

```
npm run build
```

ไฟล์ที่ได้จะอยู่ใน `src-tauri/target/release`

## คุณสมบัติหลัก

- บันทึกการเคลื่อนไหวของเมาส์และคีย์บอร์ด
- เล่นซ้ำการเคลื่อนไหวที่บันทึกไว้
- ตั้งค่าการหน่วงเวลาระหว่างแต่ละขั้นตอน
- ตั้งค่าการสุ่มเวลาเพื่อทำให้การเคลื่อนไหวเหมือนมนุษย์มากขึ้น
- รองรับการวนซ้ำการทำงานหลายรอบ

## เทคโนโลยีที่ใช้

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, Ant Design 5
- **Backend**: Rust, Tokio, Warp
- **Desktop App Framework**: Tauri 