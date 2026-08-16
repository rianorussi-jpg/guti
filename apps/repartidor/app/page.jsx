'use client'
import { useEffect,useMemo,useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase'

export default function Page(){
 const supabase=useMemo(()=>getSupabaseBrowserClient(),[])
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('')
 const [jobs,setJobs]=useState([]),[mine,setMine]=useState([]),[msg,setMsg]=useState('')
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)load(data.session.user.id)})
 const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>{setSession(x);if(x)load(x.user.id)});return()=>s.subscription.unsubscribe()},[])
 async function login(e){e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMsg(error.message)}
 async function load(uid){
  const {data:j,error}=await supabase.from('orders').select('*,merchants(name),addresses(formatted_address)').eq('delivery_mode','guti').is('courier_id',null).in('status',['accepted','preparing','ready']).order('created_at')
  if(error)setMsg(error.message); setJobs(j||[])
  const {data:m}=await supabase.from('orders').select('*,merchants(name),addresses(formatted_address)').eq('courier_id',uid).in('status',['assigned','picked_up','on_the_way']).order('created_at',{ascending:false})
  setMine(m||[])
 }
 async function claim(id){const {error}=await supabase.rpc('claim_order',{p_order_id:id});if(error)setMsg(error.message);else load(session.user.id)}
 async function step(id,status){const {error}=await supabase.rpc('courier_set_order_status',{p_order_id:id,p_status:status});if(error)setMsg(error.message);else load(session.user.id)}
 if(!session)return <main className="shell" style={{maxWidth:480}}><div className="brand">Guti.mx Repartidor</div><form className="card grid" onSubmit={login}><input type="email" placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/><button className="btn">Entrar</button></form>{msg&&<p>{msg}</p>}</main>
 return <main className="shell" style={{maxWidth:760}}><div className="topbar"><div><div className="brand">Guti.mx Repartidor</div><span className="pill">EN LÍNEA</span></div><button className="btn secondary" onClick={()=>supabase.auth.signOut()}>Salir</button></div>
 {msg&&<div className="card">{msg}</div>}
 <h2>Mi entrega activa</h2>{mine.length===0&&<div className="card muted">No tienes una entrega activa.</div>}
 {mine.map(o=><div className="card" key={o.id}><div className="between"><div><b>{o.merchants?.name}</b><p>{o.addresses?.formatted_address}</p><span className="pill">{o.status}</span></div><div className="grid">
  {o.status==='assigned'&&<button className="btn" onClick={()=>step(o.id,'picked_up')}>Ya recogí</button>}
  {o.status==='picked_up'&&<button className="btn" onClick={()=>step(o.id,'on_the_way')}>Voy en camino</button>}
  {o.status==='on_the_way'&&<button className="btn" onClick={()=>step(o.id,'delivered')}>Entregado</button>}
 </div></div></div>)}
 <h2>Pedidos disponibles</h2><div className="grid">{jobs.map(j=><div className="card between" key={j.id}><div><b>{j.merchants?.name}</b><p className="muted">{j.addresses?.formatted_address}</p><b>Entrega $45</b></div><button className="btn" onClick={()=>claim(j.id)}>Tomar pedido</button></div>)}</div>
 </main>
}
