# Bairaq Al-Wafrah — Zero-Leak Password Login & Multi-Device Google Drive Auto-Sync Plan

অপারেটর প্রথমে সম্পূর্ণ নিরাপদ **Email ও Password** দিয়ে সফটওয়্যারে প্রবেশ করবেন (লগইন পেইজে কোনো পাসওয়ার্ড বা ইমেইল হিন্ট থাকবে না) এবং ভেতরে প্রবেশের পর **১-ক্লিকে Google Drive কানেক্ট** করলেই পুরো সফটওয়্যার ডাটাবেজ স্বয়ংক্রিয়ভাবে ব্যাকআপ ও যেকোনো ডিভাইসে অটো-সিঙ্ক হবে।

## User Review & Critical Decisions

> [!IMPORTANT]
> নিচের দুটি সিদ্ধান্ত আপনার নির্দেশনা অনুযায়ী চূড়ান্ত করা হয়েছে:

- **Confirmed Decision 1 (Zero-Leak Password Login)**: লগইন স্ক্রিনে শুধুমাত্র খালি Email এবং Password ইনপুট বক্স ও Sign In বাটন থাকবে। কোনো প্রি-ফিল্ড ইমেইল, কোনো অটো-ফিল বাটন, বা ফুটারে অপারেটরের ইমেইল/নাম প্রদর্শন করা হবে না।
- **Confirmed Decision 2 (Cross-Device Google Drive Auto-Sync)**: সফটওয়্যারের ভেতরে প্রবেশের পর Google Drive কানেক্ট করলে স্বয়ংক্রিয়ভাবে ড্রাইভে থাকা সর্বশেষ ব্যাকআপ (`bairaq_workspace_db.json`) লোড হবে (অথবা নতুন হলে ব্যাকআপ তৈরি হবে) এবং পরবর্তী প্রতিটি পরিবর্তন রিয়েল-টাইমে অটো-সিঙ্ক হবে।

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **প্রথম ধাপ (সফটওয়্যারে প্রবেশ)**: ইউজার শুধুমাত্র তার নির্ধারিত Email ও Password দিয়ে লগইন করবেন। ভুল ইমেইল বা পাসওয়ার্ড দিলে শুধুমাত্র জেনেরিক মেসেজ (`Invalid email or password`) দেখাবে—কোনো গোপন তথ্য ফাঁস হবে না।
  2. **দ্বিতীয় ধাপ (Google Drive কানেক্ট ও মাল্টি-ডিভাইস সিঙ্ক)**: লগইন করার পর হেডারের **Connect Google Drive** বাটনে ক্লিক করলে ইউজারের Google Drive-এর `/Bairaq_Al_Wafrah_ERP/bairaq_workspace_db.json` ফাইলের সাথে সরাসরি সংযোগ স্থাপিত হবে। অন্য যেকোনো ডিভাইসে একই Google একাউন্ট কানেক্ট করার সাথে সাথে সব ইনভয়েস, পেমেন্ট, কাস্টমার, কোম্পানি প্যাড ও হিসাব স্বয়ংক্রিয়ভাবে চলে আসবে।
- **Target Audience / Persona**: Bairaq Al-Wafrah General Trading Company-এর অনুমোদিত অপারেটর ও ম্যানেজমেন্ট।
- **Key Value**: শতভাগ পাসওয়ার্ড নিরাপত্তা (Zero Credential Leak) এবং ঝামেলামুক্ত মাল্টি-ডিভাইস ক্লাউড ব্যাকআপ।

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Zero-Leak Login Gate**:
     - পরিষ্কার কর্পোরেট কার্ডে শুধুমাত্র কোম্পানির নাম (`Bairaq Al-Wafrah General Trading Co.`), খালি `Email Address` ফিল্ড (`placeholder="name@company.com"`), খালি `Password` ফিল্ড (`placeholder="••••••••"`) এবং `Sign In` বাটন থাকবে।
  2. **1-Click Google Drive Sync Bar (Inside Workspace)**:
     - লগইনের পর উপরের হেডারে **Connect Google Drive** বাটন থাকবে।
     - কানেক্ট হওয়ার পর সেটি সবুজ **Drive Synced** ব্যাজে রূপান্তরিত হবে এবং সর্বশেষ সিঙ্কের সময় দেখাবে।
  3. **Operator Security Settings (`Settings -> Operator User Profile`)**:
     - শুধুমাত্র লগইন করা অবস্থায় ভেতরের সেটিংস থেকে বর্তমান পাসওয়ার্ড যাচাই করে ইমেইল বা পাসওয়ার্ড পরিবর্তন করা যাবে।

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: সম্পূর্ণ আলাদা (Separated) অ্যাপ লগইন ও ক্লাউড ব্যাকআপ**:
  - *Chosen Approach*: অ্যাপে প্রবেশের জন্য শুধুমাত্র পাসওয়ার্ড অথেনটিকেশন এবং ডাটা ব্যাকআপের জন্য ভেতরে Google Drive কানেকশন।
  - *Why*: ইউজারের দৈনন্দিন কাজ সহজ হয় এবং Google OAuth কখনোই সফটওয়্যারে প্রবেশের পথে বাধা হয়ে দাঁড়ায় না।
- **Decision 2: Smart Timestamp-Aware Cross-Device Sync**:
  - *Chosen Approach*: অন্য ডিভাইসে Google Drive কানেক্ট করলে ক্লাউডের `bairaq_workspace_db.json` স্বয়ংক্রিয়ভাবে পুল (Pull) হয়ে লোকাল স্টেট আপডেট করবে এবং এরপর প্রতিটি এডিট ১.২ সেকেন্ডের ডিবাউন্সে স্বয়ংক্রিয়ভাবে ড্রাইভে পুশ (Push) হবে।
  - *Why*: ইউজার কোনো ম্যানুয়াল বাটন চাপা ছাড়াই সব ডিভাইসে একই আপডেটেড ডাটা পাবেন।

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                STEP 1: ZERO-LEAK PASSWORD LOGIN GATE                    │
│  [ Empty Email Input ] + [ Empty Password Input ] ──► [ Sign In ]       │
│  (No hints, no autofill buttons, no Google buttons, no leaked emails)   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ Authenticated Session
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              STEP 2: BAIRAQ AL-WAFRAH WORKSPACE (12 MODULES)            │
│  Header: [ Sub-Contract Pad Switcher ]  [ Connect Drive / Drive Synced ]│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│         STEP 3: MULTI-DEVICE GOOGLE DRIVE AUTO-BACKUP ENGINE            │
│  On Connect ──► Check /Bairaq_Al_Wafrah_ERP/bairaq_workspace_db.json    │
│    ├─► Exists on Drive? Auto-Pull & Hydrate All Modules on This Device  │
│    └─► New Account? Create Initial Cloud Backup Automatically           │
│  On Any Edit ──► Auto-Push Updated Database JSON to Google Drive        │
└─────────────────────────────────────────────────────────────────────────┘
```
