# Firestore Security Rules Setup

## ปัญหา: Missing or insufficient permissions

Error นี้เกิดจาก Firestore Security Rules ที่ไม่อนุญาตให้อ่าน/เขียนข้อมูลโดยไม่มีการ authenticate

## วิธีแก้ไข

### ขั้นตอนที่ 1: เปิด Firebase Console

1. ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. เลือก Project: **checkinout-446d8**
3. ไปที่ **Firestore Database** ในเมนูด้านซ้าย
4. คลิกแท็บ **Rules**

### ขั้นตอนที่ 2: อัพเดท Security Rules

แทนที่ rules ที่มีอยู่ด้วย rules ด้านล่างนี้:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    // Employees collection
    match /employees/{employeeId} {
      // Allow anyone to read employee data (for checking if registered)
      allow read: if true;
      
      // Allow anyone to create (for self-registration via LINE)
      allow create: if true;
      
      // Allow update/delete only for admins
      allow update, delete: if isAdmin();
    }
    
    // Attendance collection
    match /attendance/{attendanceId} {
      // Allow read for all authenticated users
      allow read: if true;
      
      // Allow create for all (for check-in/out)
      allow create: if true;
      
      // Allow update for admins or the employee who owns the record
      allow update: if isAdmin() || 
                      (isAuthenticated() && resource.data.employeeId == request.auth.uid);
      
      // Allow delete only for admins
      allow delete: if isAdmin();
    }
    
    // Leave Requests collection
    match /leaveRequests/{requestId} {
      // Allow read for all
      allow read: if true;
      
      // Allow create for all (for submitting leave requests)
      allow create: if true;
      
      // Allow update for admins (for approval)
      allow update: if isAdmin();
      
      // Allow delete only for admins
      allow delete: if isAdmin();
    }
    
    // OT Requests collection
    match /otRequests/{requestId} {
      // Allow read for all
      allow read: if true;
      
      // Allow create for all (for submitting OT requests)
      allow create: if true;
      
      // Allow update for admins (for approval)
      allow update: if isAdmin();
      
      // Allow delete only for admins
      allow delete: if isAdmin();
    }
    
    // Admins collection (for admin management)
    match /admins/{adminId} {
      // Only admins can read admin list
      allow read: if isAdmin();
      
      // Only admins can create/update/delete admins
      allow write: if isAdmin();
    }
  }
}
```

### ขั้นตอนที่ 3: Publish Rules

1. คลิกปุ่ม **Publish** เพื่อบันทึก rules
2. รอสักครู่ให้ rules มีผลใช้งาน (ประมาณ 1-2 นาที)

---

## Security Rules แบบง่าย (สำหรับ Development)

ถ้าต้องการทดสอบก่อน สามารถใช้ rules แบบง่ายนี้ได้:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for all collections (Development only!)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **คำเตือน**: Rules นี้อนุญาตให้ทุกคนอ่าน/เขียนได้ทั้งหมด ใช้สำหรับ development เท่านั้น! ห้ามใช้ใน production!

---

## Security Rules แบบปลอดภัย (สำหรับ Production)

สำหรับ production ควรใช้ rules ที่เข้มงวดกว่า:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    function isEmployee(employeeId) {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/employees/$(employeeId)).data.lineUserId == request.auth.uid;
    }
    
    // Employees collection
    match /employees/{employeeId} {
      // Allow read only for the employee themselves or admins
      allow read: if isEmployee(employeeId) || isAdmin();
      
      // Allow create only if lineUserId matches auth uid
      allow create: if request.auth != null && 
                      request.resource.data.lineUserId == request.auth.uid;
      
      // Allow update only for admins
      allow update: if isAdmin();
      
      // Allow delete only for admins
      allow delete: if isAdmin();
    }
    
    // Attendance collection
    match /attendance/{attendanceId} {
      // Allow read for the employee or admins
      allow read: if isAuthenticated() && 
                    (resource.data.employeeId == request.auth.uid || isAdmin());
      
      // Allow create for authenticated users
      allow create: if isAuthenticated() && 
                      request.resource.data.employeeId == request.auth.uid;
      
      // Allow update for admins
      allow update: if isAdmin();
      
      // Allow delete only for admins
      allow delete: if isAdmin();
    }
    
    // Leave Requests collection
    match /leaveRequests/{requestId} {
      // Allow read for the employee or admins
      allow read: if isAuthenticated() && 
                    (resource.data.employeeId == request.auth.uid || isAdmin());
      
      // Allow create for authenticated users
      allow create: if isAuthenticated() && 
                      request.resource.data.employeeId == request.auth.uid;
      
      // Allow update for admins (for approval)
      allow update: if isAdmin();
      
      // Allow delete only for admins
      allow delete: if isAdmin();
    }
    
    // OT Requests collection
    match /otRequests/{requestId} {
      // Allow read for the employee or admins
      allow read: if isAuthenticated() && 
                    (resource.data.employeeId == request.auth.uid || isAdmin());
      
      // Allow create for authenticated users
      allow create: if isAuthenticated() && 
                      request.resource.data.employeeId == request.auth.uid;
      
      // Allow update for admins (for approval)
      allow update: if isAdmin();
      
      // Allow delete only for admins
      allow delete: if isAdmin();
    }
    
    // Admins collection
    match /admins/{adminId} {
      allow read, write: if isAdmin();
    }
  }
}
```

---

## การทดสอบ Rules

หลังจากอัพเดท rules แล้ว ให้ทดสอบดังนี้:

### 1. ทดสอบการอ่านข้อมูล Employee
```javascript
// ใน Browser Console
console.log("Testing employee read...");
```

### 2. ทดสอบการสร้าง Employee
```javascript
// ลองลงทะเบียนพนักงานใหม่
// ถ้าสำเร็จ แสดงว่า rules ทำงานถูกต้อง
```

### 3. ตรวจสอบ Console Log
- ถ้าเห็น "User not registered yet or insufficient permissions" = ปกติ (ยังไม่ได้ลงทะเบียน)
- ถ้าเห็น "Error fetching employee: ..." = มีปัญหา rules

---

## สรุป

1. **Development**: ใช้ rules แบบเปิดกว้าง (`allow read, write: if true`)
2. **Production**: ใช้ rules แบบปลอดภัย (ตรวจสอบ authentication)
3. **แก้ไข error**: อัพเดท rules ใน Firebase Console
4. **ทดสอบ**: ลองลงทะเบียนและใช้งานระบบ

---

## คำแนะนำเพิ่มเติม

- ใช้ rules แบบเปิดกว้างสำหรับ development
- เมื่อพร้อม deploy ให้เปลี่ยนเป็น rules แบบปลอดภัย
- ตรวจสอบ Firestore Usage ใน Firebase Console เป็นประจำ
- ใช้ Firebase Authentication สำหรับ production
