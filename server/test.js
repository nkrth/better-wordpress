const BASE='http://localhost:4000';
async function req(path,opt){const r=await fetch(BASE+path,opt); const t=await r.text(); let j; try{j=JSON.parse(t)}catch{j=t}; return {status:r.status,body:j};}
(async()=>{
  let pass=0,fail=0;
  function check(name,cond){ if(cond){pass++;console.log('PASS',name);}else{fail++;console.log('FAIL',name);} }
  // users
  let u=await req('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'testuser'})});
  check('create user', u.status===200 && u.body.username==='testuser');
  // requests
  let r=await req('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'test req',requester:'testuser'})});
  check('create request', r.status===200);
  const rid=r.body.id;
  let v=await req('/api/requests/'+rid+'/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'testuser'})});
  check('vote', v.status===200);
  // articles
  let a=await req('/api/articles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Test Art',author:'testuser',body:'<p>hello</p>',tags:'t1'})});
  check('create article', a.status===200);
  const aid=a.body.id;
  let g=await req('/api/articles/'+aid);
  check('get article', g.status===200 && g.body.title==='Test Art');
  let up=await req('/api/articles/'+aid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Test Art2',body:'<p>updated</p>',tags:'t2',username:'testuser'})});
  check('update article', up.status===200);
  let rev=await req('/api/articles/'+aid+'/revisions');
  check('revisions created', rev.status===200 && rev.body.length>=1);
  // comments
  let c=await req('/api/articles/'+aid+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'testuser',text:'comment1'})});
  check('create comment', c.status===200);
  const cid=c.body.id;
  let ce=await req('/api/comments/'+cid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'edited'})});
  check('edit comment', ce.status===200);
  let ch=await req('/api/comments/'+cid+'/history');
  check('comment history', ch.status===200 && ch.body.length>=1);
  // chatroom escalation threshold count
  let cnt=await req('/api/threads/'+cid+'/count');
  check('thread count', cnt.status===200);
  // chatroom create
  let cr=await req('/api/chatrooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({comment_id:cid,article_id:aid})});
  check('create chatroom', cr.status===200);
  // delete
  let dc=await req('/api/comments/'+cid,{method:'DELETE'});
  check('delete comment', dc.status===200);
  let da=await req('/api/articles/'+aid,{method:'DELETE'});
  check('delete article', da.status===200);
  let dr=await req('/api/requests/'+rid,{method:'DELETE'});
  check('delete request', dr.status===200);
  console.log('PASS',pass,'FAIL',fail);
  process.exit(fail?1:0);
})();
