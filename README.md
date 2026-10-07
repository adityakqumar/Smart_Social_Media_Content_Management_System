# Pulse Studio

Pulse Studio is an AI-powered social media content management system. It includes a responsive planning dashboard, content library, calendar, analytics view, team view, JWT authentication, role-aware APIs, SQLite persistence, caption generation, and scheduled publishing.

## Run locally

```bash
cd backend
npm install
npm start
```

Open `http://localhost:4000`.

The demo workspace signs in automatically using `maya@pulse.studio` and password `demo1234`. The same account can be used with the API login endpoint.

## Useful scripts

```bash
npm run dev
npm start
```

The server initializes the demo data automatically; `npm run seed` is available to initialize it by itself. The publishing engine checks due posts every eight seconds. The generated local campaign visual is stored at `backend/public/assets/lumen-campaign.png`.
