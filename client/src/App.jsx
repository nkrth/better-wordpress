import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './styles.css';

const API = '';

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('user'));
  const [view, setView] = useState('landing'); // landing | catalogue | editor | article
  const [selected, setSelected] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [articles, setArticles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch(API+'/api/requests').then(r=>r.json()).then(setRequests);
    fetch(API+'/api/articles').then(r=>r.json()).then(setArticles);
    const loadUnread = () => fetch(API+'/api/unread?username='+encodeURIComponent(user)).then(r=>r.json()).then(d=>setUnread(d.unread)).catch(()=>{});
    loadUnread();
    const iv = setInterval(loadUnread, 10000);
    return () => clearInterval(iv);
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
          <button onClick={()=>setView('sitemap')}>Sitemap</button>
          <button onClick={()=>{setSelected(null); setView('editor');}}>New Article</button>
          <span className="userbadge">{user} {unread>0 && <span className="unread-badge">{unread}</span>}</span>
        </div>
      </nav>
      {view==='landing' && <Landing requests={requests} setRequests={setRequests} user={user} setView={setView} setSelected={setSelected} articles={articles} />}
      {view==='catalogue' && <Catalogue articles={articles} onSelect={(a)=>{setSelected(a); setView('article');}} />}
      {view==='editor' && <Editor user={user} articleId={selected?.id} onPublish={(id)=>{setSelected({id}); setView('article');}} />}
      {view==='article' && <ArticleView id={selected?.id} user={user} setView={setView} setSelectedAuthor={setSelectedAuthor} />}
      {view==='author' && <AuthorArticles author={selectedAuthor} onSelect={(a)=>{setSelected(a); setView('article');}} />}
      {view==='sitemap' && <Sitemap />}
    </div>
  );
}

function UsernameEntry({ onLogin }) {
  const [name, setName] = useState('');
  return (
    <div className="username-entry">
      <h1>CollabPress</h1>
      <p className="tagline">collaborative publishing — sign in with a username</p>
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
              {r.requester===user && <button onClick={async()=>{ await fetch(API+'/api/requests/'+r.id,{method:'DELETE'}); setRequests(requests.filter(x=>x.id!==r.id)); }}>Delete</button>}
              <button onClick={async ()=>{ const rr = await fetch(API+'/api/articles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:r.text,author:user,body:'',request_id:r.id})}); const d=await rr.json(); setSelected({id:d.id}); setView('editor'); }}>Write this</button>
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
  const [tags, setTags] = useState('');
  const [id, setId] = useState(articleId);
  const [collabs, setCollabs] = useState([]);
  const [presence, setPresence] = useState([]);
  const editorRef = useRef(null);
  useEffect(() => {
    if (articleId) {
      fetch(API+'/api/articles/'+articleId).then(r=>r.json()).then(d=>{setTitle(d.title); setTags(d.tags||''); if(editorRef.current) editorRef.current.innerHTML=d.body; setCollabs(d.collaborators||[]);});
    }
  }, [articleId]);
  // socket realtime
  useEffect(() => {
    if (!id) return;
    const s = io(API);
    s.emit('join', 'article:'+id);
    s.on('editor:update', (d) => { if (d.username!==user && editorRef.current) { editorRef.current.innerHTML = d.body; } });
    s.on('presence', (d) => { setPresence(prev => Array.from(new Set([...prev.filter(x=>x!==d.username), d.username]))); });
    const iv = setInterval(() => s.emit('presence', {article_id:id, username:user}), 5000);
    return () => { clearInterval(iv); s.disconnect(); };
  }, [id, user]);
  const save = () => {
    if(!id || !editorRef.current) return;
    const body = editorRef.current.innerHTML;
    fetch(API+'/api/articles/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title, body, tags, username:user})});
  };
  useEffect(() => {
    if (!id) return;
    const t = setInterval(save, 2000);
    return () => clearInterval(t);
  }, [id, title, tags]);
  const onInput = () => {
    if(!id) return;
    const s = io(API);
    s.emit('editor:update', {article_id:id, body: editorRef.current.innerHTML, username:user});
    s.disconnect();
  };
  const publish = async () => {
    const body = editorRef.current ? editorRef.current.innerHTML : '';
    if (!id) {
      const r = await fetch(API+'/api/articles', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title, author:user, body, tags})});
      const d = await r.json();
      setId(d.id);
      onPublish(d.id);
    } else {
      await fetch(API+'/api/articles/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title, body, tags, username:user})});
      onPublish(id);
    }
  };
  const cmd = (c) => { document.execCommand(c, false, null); editorRef.current && editorRef.current.focus(); };

  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <input className="title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" />
        <input className="tags-input" value={tags} onChange={e=>setTags(e.target.value)} placeholder="tags" />
        <button onClick={()=>cmd('bold')}><b>B</b></button>
        <button onClick={()=>cmd('italic')}><i>I</i></button>
        <button onClick={()=>cmd('formatBlock','h2')}>H2</button>
        <button onClick={publish}>Publish</button>
        <div className="collab-avatars">
          {collabs.map(c=> <span key={c.username} className="avatar" title={c.username+' ('+c.role+')'}>{c.username[0].toUpperCase()}</span>)}
          {presence.map(p=> <span key={p} className="avatar presence" title={p+' editing'}>{p[0].toUpperCase()}</span>)}
        </div>
      </div>
      <div className="editor-body" contentEditable ref={editorRef} onInput={onInput} data-placeholder="Write here..."></div>
      <div className="editing-indicator">{presence.length>0 ? presence.join(', ')+' is editing' : ''}</div>
    </div>
  );
}

function ArticleView({ id, user, setView, setSelectedAuthor }) {
  const [article, setArticle] = useState(null);
  const [revisions, setRevisions] = useState([]);
  useEffect(() => {
    if (id) { fetch(API+'/api/articles/'+id).then(r=>r.json()).then(setArticle); fetch(API+'/api/articles/'+id+'/revisions').then(r=>r.json()).then(setRevisions); }
  }, [id]);
  if (!article) return <div>Loading...</div>;
  return (
    <div className="article-view">
      <h1>{article.title}</h1>
      <div className="article-meta">by <span className="author-link" onClick={()=>{ if(setSelectedAuthor){setSelectedAuthor(article.author); setView('author');} }}>{article.author}</span> · {new Date(article.created_at).toLocaleDateString()} {article.tags && <span className="tags">#{article.tags}</span>}</div>
      <div className="article-body" dangerouslySetInnerHTML={{__html: article.body}} />
      {article.parent_id && <div className="remix-note">Remixed from article #{article.parent_id}</div>}
      <button onClick={async()=>{ const rr=await fetch(API+'/api/articles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Remix: '+article.title,author:user,body:article.body,parent_id:article.id})}); const d=await rr.json(); setSelected({id:d.id}); setView('editor'); }}>Remix this article</button>
      {user===article.author && <button onClick={async()=>{ await fetch(API+'/api/articles/'+article.id,{method:'DELETE'}); setView('catalogue'); }}>Delete article</button>}
      {user===article.author && <button onClick={()=>{ setSelected({id:article.id}); setView('editor'); }}>Edit article</button>}
      {revisions.length>0 && <details><summary>Revisions ({revisions.length})</summary>{revisions.map(r=><div key={r.id}>{new Date(r.saved_at).toLocaleString()} by {r.saved_by}</div>)}</details>}
      <Comments articleId={id} user={user} setView={setView} setSelectedAuthor={setSelectedAuthor} />
    </div>
  );
}

function Comments({ articleId, user, setView, setSelectedAuthor }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sort, setSort] = useState('newest');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  useEffect(() => {
    fetch(API+'/api/articles/'+articleId+'/comments').then(r=>r.json()).then(setComments);
  }, [articleId]);
  const add = async (parentId=null) => {
    await fetch(API+'/api/articles/'+articleId+'/comments', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({parent_id:parentId, username:user, text})});
    const r = await fetch(API+'/api/articles/'+articleId+'/comments'); setComments(await r.json());
    const cr = await fetch(API+'/api/articles/'+articleId+'/chatrooms'); setChatrooms(await cr.json());
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
          <span className="username author-link" onClick={()=>{ if(setSelectedAuthor){setSelectedAuthor(c.username); setView('author');} }}>{c.username}</span>
          <span className="ts">{new Date(c.created_at).toLocaleString()}</span>
        </div>
        {editingId===c.id ? (
          <div>
            <div className="comment-edit" contentEditable suppressContentEditableWarning onInput={e=>setEditText(e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{__html: editText}} />
            <button onClick={async()=>{ await fetch(API+'/api/comments/'+c.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:editText})}); const r=await fetch(API+'/api/articles/'+articleId+'/comments'); setComments(await r.json()); setEditingId(null); }}>Save</button>
            <button onClick={()=>setEditingId(null)}>Cancel</button>
          </div>
        ) : (
          <div className="comment-text">{c.text}</div>
        )}
        {c.username===user && <button className="del" onClick={async()=>{ await fetch(API+'/api/comments/'+c.id,{method:'DELETE'}); const r=await fetch(API+'/api/articles/'+articleId+'/comments'); setComments(await r.json()); }}>Delete</button>}
        {c.username===user && <button onClick={()=>{setEditingId(c.id); setEditText(c.text);}}>Edit</button>}
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
      fetch(API+'/api/chatrooms/'+chatroomId+'/read', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:user})});
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

function AuthorArticles({ author, onSelect }) {
  const [items, setItems] = useState([]);
  useEffect(() => { fetch(API+'/api/articles?author='+encodeURIComponent(author)).then(r=>r.json()).then(setItems); }, [author]);
  return (
    <div className="catalogue">
      <h2>Articles by {author}</h2>
      <div className="grid">
        {items.map(a=>(
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

function Sitemap() {
  const steps = ['Landing: type request','Claim request -> Editor','Write & autosave','Publish -> Catalogue','Read article','Comment thread','Escalate to chatroom'];
  return (
    <div className="sitemap">
      <h2>Site Flow</h2>
      <div className="flow">
        {steps.map((s,i)=>(
          <div className="flow-step" key={i} style={{animationDelay: (i*0.2)+'s'}}>
            {s}
            {i<steps.length-1 && <span className="arrow">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}