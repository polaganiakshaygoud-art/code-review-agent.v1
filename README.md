# Incident Response AI Agent

Hackathon-ready starter project for an AI incident response system.

## What it does

- Accepts an error/log from user input
- Checks in-memory history for similar incidents
- Returns historical solution when available
- Falls back to Groq LLM if no memory match
- Stores new incident + solution for future reuse
- Designed to plug into Hindsight later

## Project structure

```text
incident-response-ai-agent/
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── routes/
│       │   └── incident.js
│       └── services/
│           ├── groqService.js
│           └── memoryService.js
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── api.js
└── README.md
```

## Backend setup (Node.js + Express)

```bash
cd backend
npm install
copy .env.example .env
```

Add your Groq key in `.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Run backend:

```bash
npm run dev
```

Backend URL: `http://localhost:4000`

## Frontend setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## API endpoint

- `POST /api/incidents/analyze`
  - Body:
    ```json
    {
      "errorLog": "Error: database connection refused ..."
    }
    ```
  - Returns:
    - `source: "memory"` when match found
    - `source: "groq"` when LLM is used
