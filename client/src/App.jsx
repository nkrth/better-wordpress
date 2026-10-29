import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './styles.css';

const API = 'http://localhost:4000';

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('user'));
  const [view, setView] = useState('landing'); // landing | catalogue | editor | article
  const [selected, setSelected] = useState(null);
  const [articles, setArticles] = useState([]);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch(API+'/api/requests').then(r=>r.json()).then(setRequests);
    fetch(API+'/api/articles').then(r=>r.json()).then(setArticles);
  }, [user, view]);

  const login = async (name) => {
    await fetch(API+'/api/users', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:name})});
    localStorage.setItem('user', name);
    setUser(name);
  };

  if (!user) return <UsernameEntry onLogin={login} />;

  return (
    <div className="app">
      <nav className="nav">
        <span className="brand" onClick={()=>setView('landing')}>CollabPress</span>
        <div className="nav-links">
          <button onClick={()=>setView('landing')}>Home</button>
          <button onClick={()=>setView('catalogue')}>Catalogue</button>
          <button onClick={()=>{setSelected(null); setView('editor');}}>New Article</button>
          <span className="userbadge">{user}</span>
        </div>
      </nav>
      {view==='landing' && <Landing requests={requests} setRequests={setRequests} user={user} setView={setView} setSelected={setSelected} articles={articles} />}
      {view==='catalogue' && <Catalogue articles={articles} onSelect={(a)=>{setSelected(a); setView('article');}} />}
      {view==='editor' && <Editor user={user} articleId={selected?.id} onPublish={(id)=>{setSelected({id}); setView('article');}} />}
      {view==='article' && <ArticleView id={selected?.id} user={user} />}
    </div>
  );
}

function UsernameEntry({ onLogin }) {
  const [name, setName] = useState('');
  return (
    <div className="username-entry">
      <h1>CollabPress</h1>
      <p className="tagline">a utopian publishing platform — no passwords, no email, just a name</p>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="type a username" onKeyDown={e=>{if(e.key==='Enter' && name.trim()) onLogin(name.trim());}} />
      <button onClick={()=>name.trim() && onLogin(name.trim())}>Enter</button>
    </div>
  );
}

function Landing({ requests, setRequests, user, setView, setSelected, articles }) {
  const [text, setText] = useState('');
  const submit = async () => {
    if(!text.trim()) return;
    const r = await fetch(API+'/api/requests', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text, requester:user})});
    const nr = await r.json();
    setRequests([nr, ...requests]);
    setText('');
  };
  const vote = async (id) => {
    const r = await fetch(API+'/api/requests/'+id+'/vote', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:user})});
    const d = await r.json();
    setRequests(requests.map(x=> x.id===id ? {...x, upvotes:d.upvotes} : x));
  };
  return (
    <div className="landing">
      <h1 className="landing-title">What should we write about?</h1>
      <p className="tagline">millions of children, one platform — type a request below</p>
      <div className="input-row">
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="please write about X" onKeyDown={e=>{if(e.key==='Enter') submit();}} />
        <button onClick={submit}>Submit</button>
      </div>
      <div className="feed">
        {requests.sort((a,b)=>b.upvotes-a.upvotes).map(r=>(
          <div className="request-card" key={r.id}>
            <div className="req-text">{r.text}</div>
            <div className="req-meta">
              <span>by {r.requester}</span>
              <span>{new Date(r.created_at).toLocaleDateString()}</span>
              <button className="upvote" onClick={()=>vote(r.id)}>▲ {r.upvotes}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Catalogue({ articles, onSelect }) {
  return (
    <div className="catalogue">
      <h2>Article Catalogue</h2>
      <div className="grid">
        {articles.map(a=>(
          <div className="card" key={a.id} onClick={()=>onSelect(a)}>
            <h3>{a.title}</h3>
            <div className="card-meta">by {a.author} · {new Date(a.created_at).toLocaleDateString()}</div>
            <p>{a.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Editor({ user, articleId, onPublish }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [id, setId] = useState(articleId);
  const [collabs, setCollabs] = useState([]);
  useEffect(() => {
    if (articleId) {
      fetch(API+'/api/articles/'+articleId).then(r=>r.json()).then(d=>{setTitle(d.title); setBody(d.body); setCollabs(d.collaborators||[]);});
    }
  }, [articleId]);
  // autosave
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => {
      fetch(API+'/api/articles/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title, body})});
    }, 800);
    return () => clearTimeout(t);
  }, [title, body, id]);

  const publish = async () => {
    if (!id) {
      const r = await fetch(API+'/api/articles', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title, author:user, body})});
      const d = await r.json();
      setId(d.id);
      onPublish(d.id);
    } else {
      await fetch(API+'/api/articles/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title, body})});
      onPublish(id);
    }
  };

  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <input className="title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" />
        <button onClick={publish}>Publish</button>
        <div className="collab-avatars">
          {collabs.map(c=> <span key={c.username} className="avatar" title={c.username+' ('+c.role+')'}>{c.username[0].toUpperCase()}</span>)}
        </div>
      </div>
      <textarea className="editor-body" value={body} onChange={e=>setBody(e.target.value)} placeholder="Write here..." />
    </div>
  );
}

function ArticleView({ id, user }) {
  const [article, setArticle] = useState(null);
  useEffect(() => {
    if (id) fetch(API+'/api/articles/'+id).then(r=>r.json()).then(setArticle);
  }, [id]);
  if (!article) return <div>Loading...</div>;
  return (
    <div className="article-view">
      <h1>{article.title}</h1>
      <div className="article-meta">by {article.author} · {new Date(article.created_at).toLocaleDateString()}</div>
      <div className="article-body">{article.body.split('\n').map((p,i)=><p key={i}>{p}</p>)}</div>
      <Comments articleId={id} user={user} />
    </div>
  );
}

function Comments({ articleId, user }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sort, setSort] = useState('newest');
  useEffect(() => {
    fetch(API+'/api/articles/'+articleId+'/comments').then(r=>r.json()).then(setComments);
  }, [articleId]);
  const add = async (parentId=null) => {
    await fetch(API+'/api/articles/'+articleId+'/comments', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({parent_id:parentId, username:user, text})});
    const r = await fetch(API+'/api/articles/'+articleId+'/comments'); setComments(await r.json());
    setText('');
  };
  const sorted = [...comments].sort((a,b)=> sort==='newest' ? b.created_at-a.created_at : a.created_at-b.created_at);
  const roots = sorted.filter(c=>!c.parent_id);
  const children = (pid) => comments.filter(c=>c.parent_id===pid);

  // escalation check per root thread
  const [chatrooms, setChatrooms] = useState([]);
  useEffect(() => { fetch(API+'/api/articles/'+articleId+'/chatrooms').then(r=>r.json()).then(setChatrooms); }, [articleId]);

  const renderThread = (c, depth=0) => {
    const isEscalated = chatrooms.find(cr=>cr.comment_id===c.id);
    const cnt = comments.filter(x=> x.id===c.id || x.parent_id===c.id).length;
    return (
      <div className="comment" style={{marginLeft: Math.min(depth,3)*20}} key={c.id}>
        <div className="comment-head">
          <span className="avatar">{c.username[0].toUpperCase()}</span>
          <span className="username">{c.username}</span>
          <span className="ts">{new Date(c.created_at).toLocaleString()}</span>
        </div>
        <div className="comment-text">{c.text}</div>
        {isEscalated && <ChatroomEmbed chatroomId={isEscalated.id} articleId={articleId} user={user} />}
        {depth < 3 && children(c.id).map(ch=>renderThread(ch, depth+1))}
        {depth >= 3 && children(c.id).map(ch=>(
          <div key={ch.id} className="comment flat">@{ch.username}: {ch.text}</div>
        ))}
      </div>
    );
  };

  return (
    <div className="comments">
      <div className="comment-toolbar">
        <select value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>
      <div className="comment-input">
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Add a comment" />
        <button onClick={()=>add(null)}>Post</button>
      </div>
      {roots.map(c=>renderThread(c))}
    </div>
  );
}

function ChatroomEmbed({ chatroomId, articleId, user }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) {
      fetch(API+'/api/chatrooms/'+chatroomId+'/messages').then(r=>r.json()).then(setMsgs);
      const s = io(API);
      s.emit('join', 'chat:'+chatroomId);
      s.on('chat:message', (m) => setMsgs(prev=>[...prev, m]));
      return () => s.disconnect();
    }
  }, [open, chatroomId]);
  const send = () => {
    const s = io(API);
    s.emit('chat:message', {chatroom_id:chatroomId, username:user, text});
    setText('');
    s.disconnect();
  };
  return (
    <div className="chatroom-embed">
      <p>This discussion moved to live chat.</p>
      <button onClick={()=>setOpen(!open)}>{open?'Hide':'Join chat'}</button>
      {open && (
        <div className="chat-panel">
          {msgs.map(m=><div key={m.id}><b>{m.username}:</b> {m.text}</div>)}
          <div className="chat-input">
            <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') send();}} />
            <button onClick={send}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}