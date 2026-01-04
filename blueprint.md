# Blueprint: CHECKINOUT System

## Overview
CHECKINOUT is a web application for managing employee attendance, leave, and overtime. It features a modern, responsive admin dashboard. The project is built with Next.js (App Router), Tailwind CSS, and TypeScript, extending the design aesthetics of the "JONGNUT" project.

## Design & Aesthetics
- **Theme**: Light theme with soft colors (Primary: #EBDACA, Secondary: #F5F2ED, Text: #7F7679).
- **Style**: Modern, clean, with glassmorphism effects (`glass-card`) and rounded corners.
- **Typography**: Barlow, Noto Sans Thai.
- **Layout**: Sidebar navigation, top header with search and user profile.

## Features
### Admin Dashboard
- **Overview**: Stats for daily attendance, leave, late arrivals, and overtime.
- **Data Table**: List of employees with status (Check-in/out times).
- **Employee Management**: Add/Edit employees, view details.
- **Leave Management**: Approve/Reject leave requests.
- **OT Management**: Approve/Reject overtime requests.
- **Analytics**: Visual reports (charts/graphs).

## Implementation Plan
1.  **Project Setup**: Initialize Next.js app, configure Tailwind CSS with JONGNUT theme variables.
2.  **Core Components**:
    -   `Sidebar`: Navigation menu.
    -   `Header`: Search bar, User profile.
    -   `Card`: Reusable card component with glassmorphism.
    -   `Button`: Styled buttons.
    -   `StatusBadge`: For displaying status (Present, Leave, Late).
3.  **Pages (Admin Routes)**:
    -   `/` (Dashboard): Overview stats and recent activity.
    -   `/employee`: Employee list and management.
    -   `/leave`: Leave requests.
    -   `/ot`: Overtime requests.
    -   `/analytics`: Reports.
4.  **Data Integration**: Mock data initially, then Firebase integration (if requested).

## Current Task: Initial Setup & Admin Dashboard
-   [x] Create Next.js project.
-   [x] Configure `globals.css` and Tailwind theme.
-   [x] Create Admin Layout (Sidebar, Header).
-   [x] Implement Dashboard Page (UI only).

## Current Task: Employee Management
-   [x] Create Employee List Page (`/employee`).
-   [x] Implement Employee Stats Cards.
-   [x] Implement Employee Table with specific columns (Leave info, Type, etc.).
-   [x] Add "Add Employee" button and modal (UI only).

## Current Task: OT Management
-   [x] Create OT List Page (`/ot`).
-   [x] Implement OT Stats Cards.
-   [x] Implement OT Table with status actions (Approve/Reject).

## Current Task: Leave Management
-   [x] Create Leave List Page (`/leave`).
-   [x] Implement Leave Stats Cards.
-   [x] Implement Leave Table.

## Current Task: Analytics & Polish
-   [x] Create Analytics Page (`/analytics`).
-   [ ] Review all pages for design consistency.
-   [x] Connect to Firebase (if requested).

## Current Task: Employee Mobile App (User Facing)
-   [x] Create Mobile Layout (`(employee)` route group).
-   [x] Implement Home Page with 4 main menu buttons.
-   [x] Implement "Register Employee" button.
-   [x] Style with deep blue theme as per image.
-   [x] Fix route conflicts (moved admin to `/admin` path).

## Summary
- **Admin Dashboard**: Available at `/admin` with all pages (Dashboard, Employee, OT, Leave, Analytics)
- **Employee Mobile App**: Available at `/` (root) with mobile-optimized UI
- **Firebase Integration**: Connected with Auth, Firestore, and Storage
  - Created service layer for CRUD operations (employees, attendance, leave, OT)
  - Ready to replace mock data with real Firebase data
- **Admin Authentication**: 
  - Login page at `/admin/login`
  - Protected admin routes with AuthProvider
  - Logout functionality in Sidebar

## Current Task: Holiday Overtime & PDF Reports
-   [x] Configure Overtime Pay for Holidays (Settings Page).
-   [x] Define Weekly Holidays (Settings Page).
-   [x] Integrate Holiday OT logic into Payroll Calculation.
-   [x] Improve PDF Generation for Payslips and Attendance (Thai support via HTML print).
-   [x] Separate Normal and Holiday OT in Payroll Calculation and Reports.
-   [x] Update Payslip PDF to show OT breakdown and reduce font size.
-   [x] Fix Analytics OT Trends chart to use real data.
-   [x] Add GPS coordinates tracking for check-in/check-out with map view button in Admin Dashboard.
-   [x] Implement Firebase Storage for attendance photos with configurable photo requirement setting.
    -   [x] Add photo preview modal in AttendanceTable (click to expand).
    -   [x] Change default camera to front-facing for check-in.
    -   [x] Add storage usage monitoring with 5GB limit and visual progress bar in Settings page.

## Current Task: Admin Management
-   [x] Create `admins` collection in Firestore.
-   [x] Create Admin Management Page (`/admin/admins`).
-   [x] Implement Admin Table and Form Modal.
-   [x] Update Login to track `lastLogin` time.
-   [x] Implement Role-Based Access Control (RBAC):
    -   `super_admin`: Full access (Add/Edit/Delete).
    -   `admin`: Read-only access for Employees and Admins pages.

## Current Task: UI Improvements & Refactoring
-   [x] Resolve TypeScript error in `src/app/admin/search/page.tsx` (optional email).
-   [x] Refresh employee data immediately after registration/connection.
-   [x] Remove "Email" column from Admin Employee Table.
-   [x] Replace `window.alert` with `CustomAlert` component in `src/app/(employee)/check-in/page.tsx`.
-   [x] Add distance information to LINE Flex Message in `src/app/(employee)/check-in/page.tsx`.
-   [x] Hide distance and note in Check-in UI and LINE Message when location check is disabled.

## Current Task: Photo Storage Migration (Firebase Storage → Firestore Base64)
-   [x] Migrate from Firebase Storage to Base64 in Firestore for photo storage.
    -   **Reason**: Reduce Firebase costs by eliminating Storage usage and staying within Firestore free tier.
    -   **New Limit**: 800MB soft limit (to stay under Firestore 1GB free tier).
-   [x] Update `src/lib/storage.ts`:
    -   Removed Firebase Storage upload functions.
    -   Added `compressBase64Image()` for image compression (640x480, 60% quality).
    -   Added `canUploadPhoto()` for checking storage limit before saving.
    -   Added `calculateBase64Size()` for calculating photo sizes.
    -   Updated `getStorageUsage()` to count Base64 photo sizes in Firestore.
    -   Updated `deleteOldPhotos()` to set photo field to null instead of deleting from Storage.
-   [x] Update `src/app/(employee)/check-in/page.tsx`:
    -   Changed from `uploadAttendancePhoto()` to saving Base64 directly.
    -   Added storage limit check before saving photos.
    -   Added image compression before saving.
-   [x] Update `src/app/admin/settings/page.tsx`:
    -   Changed storage display from 5GB to 800MB limit.
    -   Added info box explaining Base64 storage in Firestore.
    -   Added warning when near limit and error when at capacity.
-   [x] **Backwards Compatibility**: AttendanceTable already supports both URL and Base64 (no changes needed).

## Current Task: Firestore Index Checker
-   [x] Create `src/lib/indexChecker.ts` utility:
    -   Define all composite queries that require indexes.
    -   `checkAllIndexes()` function to test all queries.
    -   Extract Firebase Console URLs from error messages.
-   [x] Add Index Checker section in Settings page (`/admin/settings`):
    -   Button to check all required indexes.
    -   Modal showing results with status (ok/missing).
    -   Direct links to Firebase Console for creating missing indexes.
    -   Step-by-step instructions for users.

## Current Task: Analytics Export Improvement
-   [x] Add Export Modal to Analytics page (`/admin/analytics`):
    -   Modal with checkboxes to select data types to export.
    -   Export options: Summary, Attendance, Late List, Leave Stats, OT Data.
    -   "Select All" / "Deselect All" buttons.
    -   UTF-8 BOM for proper Thai character support in Excel.
    -   Combined CSV file with section headers.
-   [x] **Raw Data Export Modal** (Separate modal):
    -   Dedicated button "Export ข้อมูลดิบ" (green) in toolbar.
    -   Quick date selection: วันนี้ / 7 วัน / เดือนนี้ / ปีนี้ / กำหนดเอง
    -   Custom date range picker.
    -   Real-time data count preview.
    -   Full attendance fields: ชื่อพนักงาน, สถานะ, วันที่, เวลาเข้างาน, เวลาออกงาน, สถานที่, ละติจูด, ลองจิจูด, ระยะห่าง(เมตร), หมายเหตุ
