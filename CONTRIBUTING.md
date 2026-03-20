# Contributing to DisciplineOS

First off, thank you for considering contributing to DisciplineOS! It's people like you who make it a great tool for everyone.

DisciplineOS is built with **FastAPI**, **React**, and **Celery**. Whether you are fixing a bug, improving documentation, or adding a new feature, your help is appreciated.

---

## 🛠 Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/DisciplineOS.git
    cd DisciplineOS
    ```
3.  **Set up the development environment**:
    - We recommend using **Docker Compose** for the easiest setup:
      ```bash
      docker-compose up --build
      ```
    - Alternatively, follow the manual setup guides in `backend/README.md` and `frontend/README.md`.

---

## 🌿 Branching Strategy

- Always create a new branch for your work: `git checkout -b feat/my-new-feature` or `git checkout -b fix/resolved-issue`.
- Keep your branch updated with the `main` branch: `git pull origin main`.

---

## 📝 Coding Standards

### Backend (Python/FastAPI)
- Follow **PEP 8** style guidelines.
- Use **Type Hints** for all function signatures and variables.
- Write tests for any new logic using `pytest`. Run them with `pytest backend/tests`.

### Frontend (React/TypeScript)
- Use **Functional Components** and Hooks.
- Ensure all new components are fully typed with **TypeScript**.
- Follow the existing Tailwind CSS patterns for styling.

---

## 🚀 Submitting a Pull Request

1.  **Commit your changes** with clear, descriptive messages.
2.  **Push to your fork** and submit a Pull Request (PR) to our `main` branch.
3.  **Provide context**: In your PR description, explain *what* you changed and *why*. Link any related issues.
4.  **Wait for review**: A maintainer will review your PR and may suggest changes.

---

## 🐞 Reporting Issues

- Use the **GitHub Issues** tab to report bugs or suggest features.
- Provide as much detail as possible: steps to reproduce, expected vs. actual behavior, and environment details.

---

## ⚖️ License
By contributing, you agree that your contributions will be licensed under the project's **MIT License**.
