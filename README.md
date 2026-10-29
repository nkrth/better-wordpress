# CollabPress

Collaborative article publishing platform (toy/utopian, no security).

## Setup

Server:
```
cd server
npm install
npm start
```

Client:
```
cd client
npm install
npm run dev
```

Open http://localhost:5173. Server on http://localhost:4000.

## Built vs mocked
- Real: username entry, request queue with upvotes, catalogue, editor with autosave, comments threading, chatroom escalation via WebSockets.
- Security: intentionally none. No passwords, no email, no hashing. Trust is the feature.
`