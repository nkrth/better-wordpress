const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');
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
app.post('/api/requests/:id/vote', (req,res)=>{
  const { username } = req.body;
  const id = req.params.id;
  try { db.prepare('INSERT INTO request_votes(request_id,username) VALUES(?,?)').run(id,username); } catch(e){}
  const c = db.prepare('SELECT COUNT(*) c FROM request_votes WHERE request_id=?').get(id).c;
  db.prepare('UPDATE requests SET upvotes=? WHERE id=?').run(c,id);
  res.json({upvotes:c});
});

// articles
app.get('/api/articles', (req,res)=> res.json(db.prepare('SELECT id,title,author,snippet,created_at,updated_at FROM articles ORDER BY created_at DESC').all()));
app.get('/api/articles/:id', (req,res)=>{
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  const collabs = db.prepare('SELECT * FROM article_collaborators WHERE article_id=?').all(req.params.id);
  res.json({...a, collaborators: collabs});
});
app.post('/api/articles', (req,res)=>{
  const { title, author, body, request_id } = req.body;
  const snippet = (body||'').slice(0,120);
  const info = db.prepare('INSERT INTO articles(title,author,body,snippet,created_at,updated_at,request_id) VALUES(?,?,?,?,?,?,?)').run(title, author, body||'', snippet, Date.now(), Date.now(), request_id||null);
  db.prepare('INSERT INTO article_collaborators(article_id,username,role) VALUES(?,?,?)').run(info.lastInsertRowid, author, 'writer');
  res.json({id:info.lastInsertRowid});
});
app.put('/api/articles/:id', (req,res)=>{
  const { body, title } = req.body;
  const snippet = (body||'').slice(0,120);
  db.prepare('UPDATE articles SET body=?, snippet=?, title=COALESCE(?,title), updated_at=? WHERE id=?').run(body, snippet, title||null, Date.now(), req.params.id);
  res.json({ok:true});
});
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
  const info = db.prepare('INSERT INTO comments(article_id,parent_id,username,text,created_at) VALUES(?,?,?,?,?)').run(req.params.id, parent_id||null, username, text, Date.now());
  const c = db.prepare('SELECT COUNT(*) c FROM comments WHERE parent_id=?').get(parent_id||null)?.c || 0;
  // check escalation threshold for thread root
  let rootId = parent_id;
  // find root
  let cur = parent_id;
  while(cur){ const row = db.prepare('SELECT parent_id FROM comments WHERE id=?').get(cur); cur = row? row.parent_id : null; if(cur===null && row) { /* root found */ } }
  // simpler: root is top-level parent chain
  res.json({id:info.lastInsertRowid});
});
app.put('/api/comments/:id', (req,res)=>{
  const { text } = req.body;
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
  db.prepare('INSERT INTO comment_edits(comment_id,text,edited_at) VALUES(?,?,?)').run(req.params.id, c.text, Date.now());
  db.prepare('UPDATE comments SET text=?, edited_at=? WHERE id=?').run(text, Date.now(), req.params.id);
  res.json({ok:true});
});
app.get('/api/comments/:id/history', (req,res)=> res.json(db.prepare('SELECT * FROM comment_edits WHERE comment_id=? ORDER BY edited_at DESC').all(req.params.id)));
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
