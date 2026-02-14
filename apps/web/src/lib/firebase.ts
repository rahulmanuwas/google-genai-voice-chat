'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyB34N82NPuUwXlsvYVbKBCDhu3IqdM1eEc",
  authDomain: "riyaan-xyz.firebaseapp.com",
  projectId: "riyaan-xyz",
  storageBucket: "riyaan-xyz.firebasestorage.app",
  messagingSenderId: "90723777634",
  appId: "1:90723777634:web:e2f7e92c8f4cb85713e53b",
  measurementId: "G-VTJ5NWC34H",
};

// Initialize Firebase only once (avoid duplicate app errors)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Analytics only in browser (not during SSR)
let analyticsPromise: ReturnType<typeof isSupported> | null = null;

export function initAnalytics() {
  if (typeof window === 'undefined') return;
  if (!analyticsPromise) {
    analyticsPromise = isSupported().then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
      return supported;
    });
  }
}

const auth = getAuth(app);

export { app, auth };
