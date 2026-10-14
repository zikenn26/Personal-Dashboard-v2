# 🎬 Zikenn Dashboard — Demo Walkthrough & Media Assets

This guide outlines the authentic demonstration media recorded and captured directly from the live Zikenn Dashboard application.

## 📹 Video Demonstration

- **Primary Demo Video:** `docs/assets/demo/zikenn-dashboard-demo.mp4`
  - **Resolution:** 1280 × 720 (720p HD)
  - **Format:** MP4 (H.264 / AAC)
  - **Framerate:** 10 fps (optimized for crisp UI text fidelity and low bandwidth)
  - **Filesize:** ~504 KB
  - **Duration:** 13.7 seconds

- **Animated Teaser (for web & GitHub):** `docs/assets/demo/zikenn-dashboard-demo.gif`
  - **Resolution:** 720 × 405
  - **Palette:** Lanczos-filtered 256-color palette
  - **Framerate:** 8 fps
  - **Filesize:** ~1.6 MB

---

## 📸 Authentically Captured Screen Gallery

All screenshots were generated from the live running web application using headless Chromium with pixel-ratio 2.0.

### Web Workspaces (1440 × 900)
1. **Command Center Home:** `docs/assets/screenshots/01_command_center_dashboard.png`
   - Clock, Panchang Indian calendar, alarms, quick-capture bar, and active metric cards.
2. **Tasks & Kanban:** `docs/assets/screenshots/02_tasks_kanban.png`
   - Backlog, In Progress, Review, and Completed boards with priority badges.
3. **Habit Tracker:** `docs/assets/screenshots/03_habit_tracker.png`
   - Weekly matrix, streak counters, completion rates, and celebration states.
4. **Goals Roadmap:** `docs/assets/screenshots/04_goals_roadmap.png`
   - Milestone tracking, category groupings, and visual progress gauges.
5. **Spending & Finance:** `docs/assets/screenshots/05_spending_finance.png`
   - Transaction ledger, category budgets, credit/debit indicators, and quick-add modal.
6. **Screen Time Dashboard:** `docs/assets/screenshots/06_screentime_analytics.png`
   - Daily device screen time, 24-hour distribution curve, top app breakdown, and history.
7. **AI Assistant View:** `docs/assets/screenshots/07_ai_assistant.png`
   - Conversational assistant for autonomous task creation and life logging.
8. **Exam Preparation:** `docs/assets/screenshots/08_exam_preparation.png`
   - Study targets, countdown timers, syllabus trackers, and revision logs.
9. **Workfolio & Career:** `docs/assets/screenshots/09_workfolio_career.png`
   - Career achievements, work history, skill taxonomy, and project showcases.
10. **Password Vault:** `docs/assets/screenshots/10_password_vault.png`
    - Client-side encrypted credential store with quick-copy and search.

### Mobile & Android Viewports (412 × 915)
1. **Mobile Command Center:** `docs/assets/screenshots/mobile_01_home_dashboard.png`
2. **Mobile Spending Tracker:** `docs/assets/screenshots/mobile_02_spending_tracker.png`
3. **Mobile Screen Time Detail:** `docs/assets/screenshots/mobile_03_screentime_detail.png`
4. **Mobile Tasks Kanban:** `docs/assets/screenshots/mobile_04_tasks.png`
5. **Mobile Habit Tracker:** `docs/assets/screenshots/mobile_05_habits.png`

---

## 📱 Native Android Notes
- Android native widgets (`SpendingWidgetProvider`, `ScreenTimeWidgetProvider`, `ScratchPadWidgetProvider`) execute natively in Android's AppWidget framework (`android/app/src/main/res/layout/`).
- The mobile screenshots above demonstrate the responsive mobile UI inside the Capacitor shell. On-device Android widget screen captures require a connected physical Android device or Android Studio AVD emulator.
