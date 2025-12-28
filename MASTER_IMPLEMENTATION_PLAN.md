# 📑 MASTER IMPLEMENTATION PLAN: THE AFFILIATE HUB (V1.0)

**Project Status:** 🟢 Planning Phase | **Target Markets:** Nigeria (Primary) + Global  
**Focus:** Full-Stack Implementation with Frontend Emphasis | **Version:** 1.0.0  
**Last Updated:** 2025-12-28  

**Expert Skeptic Notes:**  
- Accuracy-driven: Features included only if they solve real problems for Nigerian/global affiliates.  
- Network-aware: All assets lazy-loaded; offline states cached.  
- Payment-focused: Multi-currency (NGN/USD), local payouts (Paystack/Flutterwave), crypto (USDT).  
- WhatsApp-centric: Share buttons everywhere for Nigerian market dominance.  
- Bundle size: Keep under 500KB for expensive data plans.  

---

## 🏗 MODULE 1: The Gateway (Authentication & Trust)

**User Story:** As a new user, I want a frictionless sign-up so I can start browsing products in under 60 seconds.  

**Screens & Components:**  
- **S1: Unified Entry (Login/Signup Toggle)**  
  *Components:* Phone/Email Input, Password Field, Social Auth Buttons (Google/Apple).  
- **S2: The "Know Your Affiliate" (Onboarding)**  
  *Components:* Country Picker, Niche Selector (e.g., Tech, Health, Finance), WhatsApp Number Link.  

**Flows:**  
- Flow 1: New User Signup → Onboarding → Dashboard.  
- Flow 2: Existing User Login → Dashboard.  
- Flow 3: Social Auth → Onboarding (if new).  

**Meticulous Task Breakdown:**  

1. **Task: Build the Input Shell**  
   * [ ] Sub-step: Create a reusable `CustomInput` component with error validation states.  
   * [ ] Sub-step: Build the `CountryDropdown` with flag support and "Nigeria" pinned to top.  

2. **Task: Build the Auth Logic Flow**  
   * [ ] Sub-step: Create the "Toggle" animation between Login and Signup.  
   * [ ] Sub-step: Implement "Show/Hide Password" eye icon.  
   * [ ] Sub-step: Design a "Success" splash screen with a "Welcome [Name]" message.  

---

## 🎡 MODULE 2: Discovery (The Marketplace)

**User Story:** As an affiliate, I want to find high-paying products quickly so I can start promoting.  

**Screens & Components:**  
- **S3: The "Mall" (Product Listing)**  
  *Components:* Search Bar, Category Chips, Product Cards.  
- **S4: Product Detail View (The "Pitch")**  
  *Components:* Image Carousel, Commission Badge, "Why Promote This" bullet points.  

**Flows:**  
- Flow 1: Browse Products → Filter/Search → Select Product → Detail View.  
- Flow 2: Save Product → Access from Saved List.  

**Meticulous Task Breakdown:**  

1. **Task: The "Snackable" Product Card**  
   * [ ] Sub-step: Build card layout: Thumbnail (Left), Title/Price (Top Right), Commission % (Green Badge).  
   * [ ] Sub-step: Add a "Quick Save" heart icon.  

2. **Task: Filtering System**  
   * [ ] Sub-step: Build a horizontal scrolling "Category" list (e.g., "High Commission," "New," "Digital").  
   * [ ] Sub-step: Implement a "Sort by" modal (Price: Low to High, etc.).  

---

## 🔗 MODULE 3: The Engine (Link Management & Assets)

**User Story:** As a marketer, I want to copy my link and download promo images in one tap to share on WhatsApp.  

**Screens & Components:**  
- **S5: The "Affiliate Toolkit" (Modal or Page)**  
  *Components:* Unique Link Generator, "Copy" Button, Downloadable Images Grid, Swipe Copy (Text).  

**Flows:**  
- Flow 1: Select Product → Open Toolkit → Copy Link/Download Assets → Share.  

**Meticulous Task Breakdown:**  

1. **Task: The "One-Tap" Link Copy**  
   * [ ] Sub-step: Create a read-only input box showing the link.  
   * [ ] Sub-step: Add a "Copy" button that changes to "Copied! ✅" for 2 seconds when clicked.  

2. **Task: Asset Downloader**  
   * [ ] Sub-step: Create a thumbnail grid for "Promo Posters."  
   * [ ] Sub-step: Add a "Share to WhatsApp" button that triggers the native share sheet.  

---

## 💰 MODULE 4: The Wallet (Earnings & Payouts)

**User Story:** As a Nigerian user, I want to see my balance in Naira and USD and withdraw to my local bank without stress.  

**Screens & Components:**  
- **S6: The Finance Hub**  
  *Components:* Balance Cards (Multi-currency), Transaction History List.  
- **S7: Withdrawal Flow**  
  *Components:* Amount Input, Method Selector (Bank, USDT, PayPal), Confirmation Modal.  

**Flows:**  
- Flow 1: View Balance → Initiate Withdrawal → Select Method → Confirm → Success.  
- Flow 2: View Transaction History → Tap for Details.  

**Meticulous Task Breakdown:**  

1. **Task: Multi-Currency Card**  
   * [ ] Sub-step: Build a "Swipeable Card" to switch between NGN and USD views.  
   * [ ] Sub-step: Add a "Hide Balance" (Eye icon) for privacy.  

2. **Task: Transaction List**  
   * [ ] Sub-step: Create a "Status Tag" component (Pending, Completed, Failed).  
   * [ ] Sub-step: Build a "Detail Modal" when a transaction is tapped.  

---

## 📈 MODULE 5: The Command Center (Dashboard & Stats)

**User Story:** As a serious affiliate, I want to see which of my links are clicking so I can adjust my strategy.  

**Screens & Components:**  
- **S8: Performance Dashboard**  
  *Components:* Mini-Chart (Clicks vs Sales), Top Products List, Goal Tracker.  

**Flows:**  
- Flow 1: View Dashboard → Analyze Charts → Adjust Strategy.  

**Meticulous Task Breakdown:**  

1. **Task: Visual Data Small-Scale**  
   * [ ] Sub-step: Implement a simple Bar Chart for "Weekly Clicks."  
   * [ ] Sub-step: Build a "Leaderboard" snippet to show top-performing affiliates (Social Proof).  

---

## ⚙️ MODULE 6: Profile & Infrastructure

**User Story:** As a user, I want to manage my settings and get help if I'm stuck.  

**Screens & Components:**  
- **S9: Profile/Settings**  
  *Components:* Profile Header, Settings List (Bank Details, Security, Dark Mode).  
- **S10: Help/Support**  
  *Components:* FAQ Accordion, "Chat with Us" WhatsApp Link.  

**Flows:**  
- Flow 1: Access Profile → Update Settings → Save.  
- Flow 2: Need Help → Browse FAQ → Contact Support.  

**Meticulous Task Breakdown:**  

1. **Task: Settings List**  
   * [ ] Sub-step: Build a reusable "Menu Item" component with an icon, text, and arrow.  

2. **Task: Support Flow**  
   * [ ] Sub-step: Add a "Report a Problem" text area with image upload.  

---

## 🛠 INFRASTRUCTURE MODULE: Common Layouts & Utilities

**User Story:** As a developer, I want reusable components so building new screens is fast.  

**Screens & Components:**  
- **Global Navigation:** Bottom Nav, Side Bar, Header with Notifications.  
- **Skeleton Loaders:** Gray pulsing boxes for loading states.  
- **Offline State:** Cached data display with reconnect message.  

**Flows:**  
- Flow 1: App Load → Check Network → Show Offline/Cached if needed.  

**Meticulous Task Breakdown:**  

1. **Task: Unified Navigation**  
   * [ ] Sub-step: Create bottom navigation bar (Home, Marketplace, Wallet, Profile).  
   * [ ] Sub-step: Create responsive side-bar for desktop.  
   * [ ] Sub-step: Add "Quick Action" floating button for "Generate Link."  

2. **Task: Global Header**  
   * [ ] Sub-step: Implement "Notification Bell" with red dot.  
   * [ ] Sub-step: Add "Balance Toggle" (Show/Hide earnings).  

3. **Task: Polish Features**  
   * [ ] Sub-step: Build skeleton loaders.  
   * [ ] Sub-step: Implement offline state handling.  

---

## 🔧 BACKEND INTEGRATION MODULE (High-Level)

**Note:** Since this is frontend-focused, backend is outlined minimally. Assume REST API with endpoints for auth, products, wallet, etc.  

**Key Endpoints:**  
- Auth: /login, /signup, /social-auth.  
- Products: /products, /product/:id.  
- Wallet: /balance, /transactions, /withdraw.  
- Stats: /dashboard-data.  

**Meticulous Task Breakdown:**  
1. **Task: API Integration**  
   * [ ] Sub-step: Set up Axios/Fetch for API calls.  
   * [ ] Sub-step: Implement error handling and retries.  

---

## 🧐 Skeptic's Final Accuracy Checks:

- **Harmonization:** All similar screens (e.g., modals for details) use shared components to avoid duplication.  
- **Simplification:** Tasks broken into tiny substeps; no complex logic without clear purpose.  
- **Progress Tracking:** This file will be updated with [x] as tasks complete.  
- **Testing:** Each module tested for mobile-first, offline, and multi-currency.  

**Next Steps:** Begin with Module 1, Task 1. Update this file after each completion.