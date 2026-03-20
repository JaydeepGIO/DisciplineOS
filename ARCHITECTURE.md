# Architecture & Design: DisciplineOS

This document provides a high-level overview of the DisciplineOS architecture, including its core components, data flow, and the logic behind the "Discipline Score" algorithm.

---

## 🏗 System Overview

DisciplineOS follows a modern, distributed architecture composed of four main layers:

1.  **Frontend (React/Vite)**: A responsive, type-safe single-page application (SPA) that serves as the user interface.
2.  **API Backend (FastAPI)**: An asynchronous REST API that handles business logic, authentication, and database interactions.
3.  **Background Workers (Celery)**: Distributed workers that handle time-intensive or scheduled tasks (scoring, streaks, reporting).
4.  **Persistent Storage (PostgreSQL & Redis)**: PostgreSQL stores structured domain data, while Redis acts as the message broker for Celery and a cache for transient state.

---

## 🧠 The "Discipline Score" Engine

At the heart of DisciplineOS is the **Dynamic Scoring Algorithm**. This engine calculates a daily score (0-100) based on three primary inputs:

### 1. Habits (Weighted)
Each habit has a user-defined weight. Completing a habit contributes to the daily score relative to its weight and total habits planned for the day.

### 2. Planned Tasks
Tasks are scored based on completion status and timer data. 
- **Binary Completion**: 50% of the task's score contribution.
- **Efficiency Bonus**: Up to 50% based on actual time vs. estimated time (only if the timer was used).

### 3. Mindset Reflections
Completing a daily reflection (mood, energy, journaling) provides a fixed "Reflection Bonus" to the total daily score, encouraging mindfulness.

---

## 🔄 Core Data Flows

### Action -> Score Update
1.  **User Event**: A user marks a habit as "Complete" in the React UI.
2.  **API Notification**: The frontend sends a `PATCH` request to the FastAPI backend.
3.  **Task Trigger**: The API updates the `HabitLog` in PostgreSQL and triggers an asynchronous Celery task (`recompute_daily_scores`).
4.  **Score Calculation**: The worker fetches all daily logs, applies the scoring algorithm, and updates the `DailyScore` table.
5.  **UI Sync**: The frontend, using TanStack Query, refetches the analytics state and updates the "ScoreRing" visualization.

### Automated Streak Maintenance
1.  **Scheduled Task**: Every day at midnight (system time), Celery Beat triggers the `check_broken_streaks` task.
2.  **Validation**: The task scans for active streaks where the `last_completed_date` is before "yesterday."
3.  **Atomic Reset**: The system performs a single atomic database update to reset broken streaks to zero, ensuring data integrity.

---

## 🛠 Project Structure

- `backend/app/models.py`: Defines the SQLAlchemy domain models.
- `backend/app/services/scoring_service.py`: Contains the core scoring logic.
- `backend/app/workers/tasks/`: Modular Celery tasks for streaks, analytics, and reports.
- `frontend/src/api/`: Typed API client interfaces.
- `frontend/src/store/`: Zustand stores for global state (auth, theme).

---

## 🔒 Security & Performance
- **Auth**: JWT-based authentication with secure password hashing (bcrypt).
- **Concurrency**: Fully asynchronous database drivers (`asyncpg`) to handle high-volume I/O.
- **Scalability**: Stateless API design and distributed workers allow horizontal scaling of both layers independently.
