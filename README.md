# CollabPress

Collaborative article publishing platform.

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

## Features
- Username-based access (no passwords)
- Request queue with upvotes
- Article catalogue and WYSIWYG editor
- Real-time collaboration and presence
- Threaded comments with reactions and edit history
- Comment-to-chatroom escalation
- Revisions, tags, remix lineage
- Unread chat counts

## Security
This build intentionally uses username-only access with no passwords or encryption, as specified. Not for production use.

## Tests
```
cd server && npm test
```
`