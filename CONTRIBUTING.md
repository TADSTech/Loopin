# Contributing to loopin

Thank you for your interest in contributing to **loopin**! To maintain a clean, readable, and robust codebase, please follow the guidelines and workflows detailed below.

---

## 1. Getting Started

1. **Fork the Repository**: Create a personal fork of the repository on GitHub.
2. **Clone Locally**: Clone your fork to your development machine:
   ```bash
   git clone https://github.com/your-username/loopin.git
   cd loopin
   ```
3. **Install Dependencies**: Install the project packages using Bun:
   ```bash
   bun install
   ```
4. **Create a Branch**: Create a descriptive feature branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## 2. Coding Conventions

- **Next.js & React**:
  - Keep components modular, accessible (WCAG AA compliant), and readable.
  - Rely on Next.js Server Actions for state updates, avoiding client-side credential transmission.
- **Styling**:
  - Use Tailwind CSS v4 variables and theme properties.
  - Implement dynamic viewports (`dvh`) for height dimensions and ensure mobile layouts do not scroll horizontally.
  - Utilize modern styling (glassmorphism overlays, border/outline shadows, transition transformations) for interactive controls.
- **Validation**:
  - Define Zod schemas inside [event-types.ts](file:///home/zenmi/Projects/Loopin/lib/event-types.ts) and validate response structures.

---

## 3. Formatting, Linting & Testing

We enforce automated checks to prevent pushing broken or unformatted code.

### Pre-commit Git Hook

A Husky git pre-commit hook runs before every commit. It enforces the following pipeline:

```bash
bun run format:check && bun run lint && bun test
```

If any step in the pipeline fails, the git commit is aborted.

### Development Commands

- **Run unit tests**:
  ```bash
  bun run test
  ```
- **Run format checks**:
  ```bash
  bun run format:check
  ```
- **Apply formatting**:
  ```bash
  bun run format
  ```
- **Run linter**:
  ```bash
  bun run lint
  ```

---

## 4. Submitting Pull Requests

1. **Keep Commits Clean**: Write meaningful commit messages.
2. **Push to Your Fork**: Push your feature branch up to your GitHub fork:
   ```bash
   git push origin feature/your-feature-name
   ```
3. **Open a PR**: Open a Pull Request from your branch to our `main` branch. Provide a clear description of the feature or bugfix, references to any issues, and instructions on how to test your changes.
