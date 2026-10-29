const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  requester TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS request_votes (
  request_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  PRIMARY KEY (request_id, username)
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  request_id INTEGER
);
CREATE TABLE IF NOT EXISTS article_collaborators (
  article_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (article_id, username)
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  parent_id INTEGER,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);
CREATE TABLE IF NOT EXISTS comment_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  edited_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reactions (
  comment_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  emoji TEXT NOT NULL,
  PRIMARY KEY (comment_id, username, emoji)
);
CREATE TABLE IF NOT EXISTS chatrooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL UNIQUE,
  article_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chatroom_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

module.exports = db;
`<|end|><|start|> assistant to=write<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="content">
const db = require('./db');

function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) return;
  const now = Date.now();
  const users = ['alice','bob','charlie','daisy','edward'];
  for (const u of users) db.prepare('INSERT INTO users(username,created_at) VALUES(?,?)').run(u, now);
  // requests
  const reqs = [
    ['please write about the history of the floppy disk', 'alice'],
    ['an article on cassette tapes and mixtapes', 'bob'],
    ['write about dial-up internet sounds', 'charlie'],
  ];
  for (const [t,u] of reqs) db.prepare('INSERT INTO requests(text,requester,created_at,upvotes) VALUES(?,?,?,?)').run(t,u,now, Math.floor(Math.random()*5));
  // article
  const body = 'In the beginning, there was the floppy disk. A small square of plastic and magnetic film that held 1.44 megabytes of wonder. Children carried them in backpacks. Schools had drawers full of them. Each one a tiny universe of saved games and homework.\n\nThe floppy disk taught a generation that data could be held in your hand. That information was physical, tangible, and losable. You could drop one in a puddle and lose a book report forever.\n\nWe remember them fondly.';
  const info = db.prepare('INSERT INTO articles(title,author,body,snippet,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('The Floppy Disk: A Love Letter', 'alice', body, body.slice(0,120), now, now);
  const aid = info.lastInsertRowid;
  db.prepare('INSERT INTO article_collaborators(article_id,username,role) VALUES(?,?,?)').run(aid,'alice','writer');
  db.prepare('INSERT INTO article_collaborators(article_id,username,role) VALUES(?,?,?)').run(aid,'bob','editor');
  // comments thread escalated
  const c1 = db.prepare('INSERT INTO comments(article_id,parent_id,username,text,created_at) VALUES(?,?,?,?,?)').run(aid,null,'bob','This is wonderful, I remember my first floppy!', now).lastInsertRowid;
  for (let i=0;i<31;i++){
    db.prepare('INSERT INTO comments(article_id,parent_id,username,text,created_at) VALUES(?,?,?,?,?)').run(aid, c1, i%2===0?'charlie':'daisy', 'reply '+i, now+i);
  }
  const cr = db.prepare('INSERT INTO chatrooms(comment_id,article_id,created_at) VALUES(?,?,?)').run(c1, aid, now).lastInsertRowid;
  db.prepare('INSERT INTO messages(chatroom_id,username,text,created_at) VALUES(?,?,?,?)').run(cr,'bob','hello from chat', now);
  console.log('seeded');
}
seed();
