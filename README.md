# DisciplineOS

**DisciplineOS** is an open-source, full-stack productivity ecosystem designed to turn daily habits and tasks into a quantifiable "Discipline Score." It combines rigorous tracking with behavioral science to help users build consistency and long-term mastery.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![React](https://img.shields.io/badge/react-18-61dafb.svg)

---

## 🚀 Key Features

- **Dynamic Scoring Engine**: A proprietary algorithm that calculates your daily "Discipline Score" based on habit completion, task execution, and mindful reflection.
- **Task Timer System**: Integrated focus timers that track actual vs. estimated time spent on planned tasks.
- **Automated Streak Maintenance**: Celery-powered workers that manage and reset streaks based on real-time activity.
- **Mindset Journaling**: Structured reflection templates to capture mood, energy levels, and daily wins.
- **Data Visualizations**: Beautiful Recharts-driven dashboard with score trends, heatmaps, and weekly categorical breakdowns.
- **Asynchronous Reporting**: Export your performance data into detailed textual reports via background workers.

---

## 🛠 Tech Stack

### Backend
- **FastAPI**: High-performance asynchronous API framework.
- **SQLAlchemy 2.0**: Async ORM for PostgreSQL.
- **Celery + Redis**: Distributed task queue for scoring, streaks, and reporting.
- **Pytest**: Comprehensive test suite for core domain logic.

### Frontend
- **React (Vite + TypeScript)**: Modern, type-safe UI development.
- **Tailwind CSS**: Utility-first styling for a clean, professional aesthetic.
- **Zustand**: Lightweight state management for auth and theme.
- **TanStack Query**: Efficient server-state synchronization.
- **Recharts**: Interactive performance visualizations.

---

## 📦 Getting Started

### Prerequisites
- Docker & Docker Compose
- *OR* using the longer route for edits (Python 3.11, Node 20+, PostgreSQL, Redis)

### Option 1: Quick Start with Docker (Recommended)
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/DisciplineOS.git
   cd DisciplineOS
   ```
2. Run the automated setup script:
   - **Linux/macOS**:
     ```bash
     chmod +x setup.sh stop.sh && ./setup.sh
     ```
   - **Windows (PowerShell)**:
     ```powershell
     .\setup.ps1
     ```
3. Access the application:
   - Frontend: `http://localhost:5173`
   - API Docs: `http://localhost:8000/docs`

4. To stop the application:
   - **Linux/macOS**:
     ```bash
     ./stop.sh
     ```
   - **Windows (PowerShell)**:
     ```powershell
     .\stop.ps1
     ```

*The script builds the images, starts the database/Redis, and seeds the database with a demo account (`test@example.com` / `password123`).*

### Option 2: Manual Setup
See the detailed [Backend Setup](backend/README.md) and [Frontend Setup](frontend/README.md) guides.

---

## 🛠 Docker Commands
- **Start All Services**: `docker compose up -d`
- **Stop All Services**: `docker compose down`
- **View Logs**: `docker compose logs -f`
- **Rebuild Containers**: `docker compose up -d --build`

---

## 📐 Architecture
For a deep dive into the system design, scoring algorithms, and data flow, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 🤝 Contributing
We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to get started.

---

## ⚖️ License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
