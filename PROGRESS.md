# Progress

## Done
- Username-only access (no passwords)
- Landing page with request queue + upvotes
- Article catalogue + WYSIWYG editor (contenteditable)
- Autosave, revisions, tags, remix lineage
- Collaborator roles + presence indicators + invite
- Threaded comments with depth cap flattening, edit history, reactions, sorting (newest/oldest/top)
- Reply to comments
- Comment-to-chatroom escalation (threshold 4 / depth 4)
- Real-time chat (Socket.io) + unread counts
- High-contrast VS Code theme
- Icons throughout
- System log page (xterm.js) + /api/logs
- Author article listing on username click
- Sitemap with animation
- CRUD for articles/requests/comments
- Tests (15 passing)

## Mocked / simplified
- No real authentication/security
- Real-time collab uses last-write-wins, not OT
- Chat unread counts basic, no per-message read receipts beyond timestamp
- No media uploads
- No pagination

## Decisions
- Threshold default lowered to 4 for visible escalation
- Used contenteditable for WYSIWYG
- High contrast dark theme per user request
- Tunnel provided for live testing (temporary)
`