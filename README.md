# Decision Diary

Decision Diary is a local-first decision reflection app built for the GITA Chakravyuh Hackathon. It helps users think through a choice in a calm conversational flow, turns that conversation into a structured decision summary, and saves past decisions as reusable memory cards.

The app is designed to feel reflective rather than prescriptive: AI supports the thinking process, but the final choice stays with the user.

## What The App Does

- Runs a guided conversation to help a user unpack a decision.
- Extracts structured fields from the conversation:
  - decision
  - intent
  - constraints
  - alternatives
  - reasoning
- Moves the user into a review flow once enough context is gathered.
- Lets the user edit, confirm, ask for deeper reflection, and save the decision.
- Stores saved decisions in the browser using `localStorage`.
- Suggests relevant past decisions using a lightweight keyword-vector similarity approach.
- Allows users to search, filter, select, and delete saved decision memories.

## Core Product Flow

1. The user starts a conversation in the main chat panel.
2. The app sends the conversation to a local Ollama model running on `http://localhost:11434`.
3. The model responds as a reflective assistant and also helps infer structured decision data.
4. The inferred data is shown in the Decision Summary panel.
5. Once the conversation is mature enough, the app enters review mode.
6. The user can edit the summary, confirm it, ask AI for further reflection, or save it.
7. Saved decisions appear in the sidebar as memory cards and can be reused as context in future conversations.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind/PostCSS tooling
- `lucide-react`
- Ollama for local AI inference

## Local-First AI Setup

This project currently expects Ollama to be installed and running locally.

The frontend sends requests to:

```txt
http://localhost:11434/api/generate
```

The configured model in the app is:

```txt
llama3.1:8b
```

Before starting the app, make sure Ollama is available and that this model has been pulled locally.

Example:

```powershell
ollama pull llama3.1:8b
ollama serve
```

If Ollama is not running, the app will fail to generate responses and show fallback error messaging in the conversation.

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm
- Ollama installed locally
- `llama3.1:8b` downloaded in Ollama

### Install Dependencies

```powershell
npm install
```

### Start The Development Server

```powershell
npm run dev
```

Then open the local Vite URL shown in the terminal, usually:

```txt
http://localhost:5173
```

### Create A Production Build

```powershell
npm run build
```

### Preview The Production Build

```powershell
npm run preview
```

## Available Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` runs TypeScript build checks and creates a production bundle.
- `npm run lint` runs ESLint.
- `npm run preview` serves the built app locally for preview.

## Project Structure

```txt
decision-diary/
├─ public/
│  ├─ bin.png
│  ├─ sidebar.png
│  └─ vite.svg
├─ src/
│  ├─ App.tsx
│  ├─ App.css
│  ├─ ErrorBoundary.tsx
│  ├─ Sidebar.tsx
│  ├─ index.css
│  ├─ main.tsx
│  └─ style.css
├─ index.html
├─ package.json
├─ tailwind.config.js
├─ tsconfig.json
└─ vite.config.ts
```

## Important Implementation Notes

- The app is frontend-only at the moment.
- Decision memories are stored in browser `localStorage`, not a database.
- Two local storage keys are used:
  - `thinkly_memories`
  - `thinkly_vectors`
- Similarity suggestions are based on simple keyword frequency vectors, not embeddings.
- The current AI integration is hardcoded inside [`src/App.tsx`](/d:/Chakravyuh/decision-diary/src/App.tsx).

## Current Limitations

- No backend or user authentication.
- No cloud sync across devices.
- No automated tests are set up yet.
- The Ollama endpoint and model name are hardcoded.
- Most application logic currently lives in a single main component, so the codebase would benefit from refactoring into smaller modules.

## Future Improvement Ideas

- Move AI logic into a dedicated service layer.
- Add persistent storage beyond browser `localStorage`.
- Make model and endpoint configuration environment-driven.
- Add tests for conversation flow, memory persistence, and suggestion logic.
- Split the large `App.tsx` file into feature-focused components and hooks.

## Status

This repository contains a working prototype / hackathon project rather than a production-hardened system.
