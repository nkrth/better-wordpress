const db = require('./db');

function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) return;
  const now = Date.now();
  const users = ['alice','bob','charlie','daisy','edward'];
  for (const u of users) db.prepare('INSERT INTO users(username,created_at) VALUES(?,?)').run(u, now);
  const reqs = [
    ['please write about the history of the floppy disk', 'alice'],
    ['an article on cassette tapes and mixtapes', 'bob'],
    ['write about dial-up internet sounds', 'charlie'],
  ];
  for (const [t,u] of reqs) db.prepare('INSERT INTO requests(text,requester,created_at,upvotes) VALUES(?,?,?,?)').run(t,u,now, Math.floor(Math.random()*5));
  const body = 'In the beginning, there was the floppy disk. A small square of plastic and magnetic film that held 1.44 megabytes of wonder.\n\nThe floppy disk taught a generation that data could be held in your hand.';
  const info = db.prepare('INSERT INTO articles(title,author,body,snippet,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('The Floppy Disk: A Love Letter', 'alice', body, body.slice(0,120), now, now);
  const aid = info.lastInsertRowid;
  db.prepare('INSERT INTO article_collaborators(article_id,username,role) VALUES(?,?,?)').run(aid,'alice','writer');
  db.prepare('INSERT INTO article_collaborators(article_id,username,role) VALUES(?,?,?)').run(aid,'bob','editor');
  const c1 = db.prepare('INSERT INTO comments(article_id,parent_id,username,text,created_at) VALUES(?,?,?,?,?)').run(aid,null,'bob','This is wonderful, I remember my first floppy!', now).lastInsertRowid;
  for (let i=0;i<31;i++){
    db.prepare('INSERT INTO comments(article_id,parent_id,username,text,created_at) VALUES(?,?,?,?,?)').run(aid, c1, i%2===0?'charlie':'daisy', 'reply '+i, now+i);
  }
  const cr = db.prepare('INSERT INTO chatrooms(comment_id,article_id,created_at) VALUES(?,?,?)').run(c1, aid, now).lastInsertRowid;
  db.prepare('INSERT INTO messages(chatroom_id,username,text,created_at) VALUES(?,?,?,?)').run(cr,'bob','hello from chat', now);
  console.log('seeded');
}
seed();