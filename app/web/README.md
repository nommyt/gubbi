# Gubbi Web

Web interface for Gubbi built with Vite + TanStack Start.

## Setup Instructions

This package is a placeholder. To set it up:

1. Navigate to this directory:

   ```bash
   cd app/web
   ```

2. Create a new Vite + React + TypeScript project:

   ```bash
   npm create vite@latest . -- --template react-ts
   ```

3. Install TanStack Start:

   ```bash
   npm install @tanstack/react-start
   ```

4. Follow the TanStack Start setup guide at:
   https://tanstack.com/start/latest/docs/overview

## Architecture

The web app will use the same plugin packages as the CLI:

- `@gubbi/core` — Plugin API and state management
- `@gubbi/git` — Git operations (server-side)
- `@gubbi/github` — GitHub API operations

## Future Features

- [ ] Repository browser
- [ ] Pull request management
- [ ] Issue tracking
- [ ] Stack visualization
- [ ] Code review interface
