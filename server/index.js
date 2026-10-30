const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');
try { db.prepare('ALTER TABLE articles ADD COLUMN parent_id INTEGER').run(); } catch(e){}
try { db.prepare('ALTER TABLE articles ADD COLUMN tags TEXT NOT NULL DEFAULT \'\'').run(); } catch(e){}
db.exec('CREATE TABLE IF NOT EXISTS revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, saved_at INTEGER NOT NULL, saved_by TEXT NOT NULL);');
db.exec('CREATE TABLE IF NOT EXISTS chat_reads (username TEXT NOT NULL, chatroom_id INTEGER NOT NULL, last_read_at INTEGER NOT NULL, PRIMARY KEY (username, chatroom_id));');
require('./seed');

const app = express();
app.use(cors());
app.use(express.json());

// users
app.post('/api/users', (req,res)=>{
  const { username } = req.body;
  if(!username) return res.status(400).json({error:'username required'});
  const existing = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if(existing) return res.json(existing);
  const info = db.prepare('INSERT INTO users(username,created_at) VALUES(?,?)').run(username, Date.now());
  res.json({id:info.lastInsertRowid, username, created_at: Date.now()});
});
app.get('/api/users', (req,res)=> res.json(db.prepare('SELECT * FROM users').all()));

// requests
app.get('/api/requests', (req,res)=> res.json(db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all()));
app.post('/api/requests', (req,res)=>{
  const { text, requester } = req.body;
  const info = db.prepare('INSERT INTO requests(text,requester,created_at,upvotes) VALUES(?,?,?,0)').run(text, requester, Date.now());
  res.json({id:info.lastInsertRowid, text, requester, created_at:Date.now(), upvotes:0});
});
app.delete('/api/requests/:id', (req,res)=>{ db.prepare('DELETE FROM requests WHERE id=?').run(req.params.id); db.prepare('DELETE FROM request_votes WHERE request_id=?').run(req.params.id); res.json({ok:true}); });
app.post('/api/requests/:id/vote', (req,res)=>{
  const { username } = req.body;
  const id = req.params.id;
  try { db.prepare('INSERT INTO request_votes(request_id,username) VALUES(?,?)').run(id,username); } catch(e){}
  const c = db.prepare('SELECT COUNT(*) c FROM request_votes WHERE request_id=?').get(id).c;
  db.prepare('UPDATE requests SET upvotes=? WHERE id=?').run(c,id);
  res.json({upvotes:c});
});

// articles
app.get('/api/articles', (req,res)=>{
  if(req.query.author) return res.json(db.prepare('SELECT id,title,author,snippet,created_at,updated_at FROM articles WHERE author=? ORDER BY created_at DESC').all(req.query.author));
  res.json(db.prepare('SELECT id,title,author,snippet,created_at,updated_at FROM articles ORDER BY created_at DESC').all());
});
app.get('/api/articles/:id', (req,res)=>{
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  const collabs = db.prepare('SELECT * FROM article_collaborators WHERE article_id=?').all(req.params.id);
  res.json({...a, collaborators: collabs});
});
app.post('/api/articles', (req,res)=>{
  const { title, author, body, request_id, parent_id } = req.body;
  const snippet = (body||'').slice(0,120);
  const info = db.prepare('INSERT INTO articles(title,author,body,snippet,created_at,updated_at,request_id,parent_id) VALUES(?,?,?,?,?,?,?,?)').run(title, author, body||'', snippet, Date.now(), Date.now(), request_id||null, parent_id||null);
  db.prepare('INSERT INTO article_collaborators(article_id,username,role) VALUES(?,?,?)').run(info.lastInsertRowid, author, 'writer');
  res.json({id:info.lastInsertRowid});
});
app.delete('/api/articles/:id', (req,res)=>{ db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id); db.prepare('DELETE FROM article_collaborators WHERE article_id=?').run(req.params.id); db.prepare('DELETE FROM comments WHERE article_id=?').run(req.params.id); res.json({ok:true}); });
app.put('/api/articles/:id', (req,res)=>{
  const { body, title, tags, username } = req.body;
  const snippet = (body||'').slice(0,120);
  const cur = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  db.prepare('INSERT INTO revisions(article_id,title,body,saved_at,saved_by) VALUES(?,?,?,?,?)').run(req.params.id, cur.title, cur.body, Date.now(), username||'unknown');
  db.prepare('UPDATE articles SET body=?, snippet=?, title=COALESCE(?,title), tags=COALESCE(?,tags), updated_at=? WHERE id=?').run(body, snippet, title||null, tags||null, Date.now(), req.params.id);
  res.json({ok:true});
});
app.get('/api/articles/:id/revisions', (req,res)=> res.json(db.prepare('SELECT * FROM revisions WHERE article_id=? ORDER BY saved_at DESC LIMIT 20').all(req.params.id)));
app.post('/api/articles/:id/collaborators', (req,res)=>{
  const { username, role } = req.body;
  try { db.prepare('INSERT INTO article_collaborators(article_id,username,role) VALUES(?,?,?)').run(req.params.id, username, role); } catch(e){}
  res.json({ok:true});
});

// comments
app.get('/api/articles/:id/comments', (req,res)=>{
  const rows = db.prepare('SELECT * FROM comments WHERE article_id=? ORDER BY created_at ASC').all(req.params.id);
  res.json(rows);
});
app.post('/api/articles/:id/comments', (req,res)=>{
  const { parent_id, username, text } = req.body;
  if(!username || !text) return res.status(400).json({error:'username and text required'});
  const info = db.prepare('INSERT INTO comments(article_id,parent_id,username,text,created_at) VALUES(?,?,?,?,?)').run(req.params.id, parent_id||null, username, text, Date.now());
  // find thread root
  let root = parent_id || info.lastInsertRowid;
  let cur = parent_id;
  while(cur){ const row = db.prepare('SELECT parent_id FROM comments WHERE id=?').get(cur); if(!row) break; if(row.parent_id===null){ root=cur; break;} cur=row.parent_id; }
  if(!parent_id) root = info.lastInsertRowid;
  // count thread
  const all = db.prepare('SELECT id,parent_id FROM comments WHERE article_id=?').all(req.params.id);
  function rootOf(id){ let c=id; let p; do { const r=all.find(x=>x.id===c); p=r?r.parent_id:null; if(p) c=p; } while(p); return c; }
  const cnt = all.filter(c=>rootOf(c.id)===root).length;
  const TH = parseInt(process.env.CHAT_THRESHOLD||'4');
  let escalated=false;
  // depth of new comment
  let depth=0; let p=parent_id;
  while(p){ const row=db.prepare('SELECT parent_id FROM comments WHERE id=?').get(p); if(!row) break; depth++; p=row.parent_id; }
  if(cnt>=TH || depth>=3){
    const existing = db.prepare('SELECT * FROM chatrooms WHERE comment_id=?').get(root);
    if(!existing){ db.prepare('INSERT INTO chatrooms(comment_id,article_id,created_at) VALUES(?,?,?)').run(root, req.params.id, Date.now()); escalated=true; }
  }
  res.json({id:info.lastInsertRowid, threadCount:cnt, escalated});
});
app.put('/api/comments/:id', (req,res)=>{
  const { text } = req.body;
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
  db.prepare('INSERT INTO comment_edits(comment_id,text,edited_at) VALUES(?,?,?)').run(req.params.id, c.text, Date.now());
  db.prepare('UPDATE comments SET text=?, edited_at=? WHERE id=?').run(text, Date.now(), req.params.id);
  res.json({ok:true});
});
app.get('/api/comments/:id/history', (req,res)=> res.json(db.prepare('SELECT * FROM comment_edits WHERE comment_id=? ORDER BY edited_at DESC').all(req.params.id)));
app.delete('/api/comments/:id', (req,res)=>{ db.prepare('DELETE FROM comments WHERE id=?').run(req.params.id); db.prepare('DELETE FROM reactions WHERE comment_id=?').run(req.params.id); res.json({ok:true}); });
app.post('/api/comments/:id/reactions', (req,res)=>{
  const { username, emoji } = req.body;
  try { db.prepare('INSERT INTO reactions(comment_id,username,emoji) VALUES(?,?,?)').run(req.params.id, username, emoji); } catch(e){ db.prepare('DELETE FROM reactions WHERE comment_id=? AND username=? AND emoji=?').run(req.params.id,username,emoji); }
  res.json({ok:true});
});
app.get('/api/comments/:id/reactions', (req,res)=> res.json(db.prepare('SELECT * FROM reactions WHERE comment_id=?').all(req.params.id)));

// chatrooms
app.get('/api/chatrooms/by-comment/:commentId', (req,res)=>{
  const r = db.prepare('SELECT * FROM chatrooms WHERE comment_id=?').get(req.params.commentId);
  res.json(r||null);
});
app.get('/api/articles/:id/chatrooms', (req,res)=> res.json(db.prepare('SELECT * FROM chatrooms WHERE article_id=?').all(req.params.id)));
app.get('/api/chatrooms/:id/messages', (req,res)=> res.json(db.prepare('SELECT * FROM messages WHERE chatroom_id=? ORDER BY created_at ASC').all(req.params.id)));
app.post('/api/chatrooms/:id/read', (req,res)=>{ const { username } = req.body; db.prepare('INSERT INTO chat_reads(username,chatroom_id,last_read_at) VALUES(?,?,?) ON CONFLICT(username,chatroom_id) DO UPDATE SET last_read_at=excluded.last_read_at').run(username, req.params.id, Date.now()); res.json({ok:true}); });
app.get('/api/unread', (req,res)=>{
  const { username } = req.query;
  const rooms = db.prepare('SELECT * FROM chatrooms').all();
  let total=0;
  for(const rm of rooms){
    const lr = db.prepare('SELECT last_read_at FROM chat_reads WHERE username=? AND chatroom_id=?').get(username, rm.id);
    const since = lr? lr.last_read_at : 0;
    const c = db.prepare('SELECT COUNT(*) c FROM messages WHERE chatroom_id=? AND created_at>? AND username<>?').get(rm.id, since, username).c;
    total += c;
  }
  res.json({unread:total});
});
app.post('/api/chatrooms', (req,res)=>{
  const { comment_id, article_id } = req.body;
  const existing = db.prepare('SELECT * FROM chatrooms WHERE comment_id=?').get(comment_id);
  if(existing) return res.json(existing);
  const info = db.prepare('INSERT INTO chatrooms(comment_id,article_id,created_at) VALUES(?,?,?)').run(comment_id, article_id, Date.now());
  res.json({id:info.lastInsertRowid, comment_id, article_id, created_at:Date.now()});
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', (socket)=>{
  socket.on('join', (room)=> socket.join(room));
  socket.on('chat:message', (data)=>{
    const info = db.prepare('INSERT INTO messages(chatroom_id,username,text,created_at) VALUES(?,?,?,?)').run(data.chatroom_id, data.username, data.text, Date.now());
    io.to('chat:'+data.chatroom_id).emit('chat:message', {id:info.lastInsertRowid, ...data, created_at:Date.now()});
  });
  socket.on('editor:update', (data)=> socket.to('article:'+data.article_id).emit('editor:update', data));
  socket.on('presence', (data)=> socket.to('article:'+data.article_id).emit('presence', data));
});

// escalation check endpoint
app.get('/api/threads/:commentId/count', (req,res)=>{
  // count comments in thread (parent chain root)
  const root = req.params.commentId;
  // count all comments whose root ancestor is root
  const all = db.prepare('SELECT * FROM comments').all();
  function rootOf(id){ let cur=id; let parent; do { const r = all.find(x=>x.id===cur); parent = r? r.parent_id : null; if(parent) cur=parent; } while(parent); return cur; }
  const cnt = all.filter(c=> rootOf(c.id)===parseInt(root)).length;
  res.json({count:cnt});
});

const PORT = 4000;
server.listen(PORT, ()=> console.log('server on', PORT));
