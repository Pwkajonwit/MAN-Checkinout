import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'payrolls'));
  console.log('Total saved payroll records:', snap.docs.length);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log('ID:', d.id, 'Label:', data.periodLabel, 'employeeType:', data.employeeType);
    const p005 = (data.items || []).find(i => i.employeeId === 'P005');
    if (p005) {
      console.log('P005 in record', d.id, ':', {
        name: p005.name,
        payrollBaseDeduction: p005.payrollBaseDeduction,
        lateMinutes: p005.lateMinutes,
        manualDeductions: p005.manualDeductions,
        installmentDeductions: p005.installmentDeductions,
        totalDeduction: p005.totalDeduction,
        netTotal: p005.netTotal
      });
    }
  });
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
