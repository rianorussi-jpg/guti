'use client'
import { useEffect,useMemo,useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase'
export default function Page(){
 const supabase=useMemo(()=>getSupabaseBrowserClient(),[])
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('')
 const [stats,setStats]=useState({orders:0,gmv:0,merchants:0,couriers:0}),[orders,setOrders]=useState([]),[msg,setMsg]=useState('')
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)load()})
 const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>{setSession(x);if(x)load()});return()=>s.subscription.unsubscribe()},[])
 async function login(e){e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMsg(error.message)}
 async function load(){
  const {data:o,error}=await supabase.from('orders').select('*,merchants(name)').order('created_at',{ascending:false}).limit(50)
  if(error){setMsg('Si ves este mensaje, falta aplicar la migración backend_v1.sql o tu usuario no tiene role=admin. '+error.message);return}
  const {count:mc}=await supabase.from('merchants').select('*',{count:'exact',head:true})
  const {count:cc}=await supabase.from('courier_profiles').select('*',{count:'exact',head:true})
  const arr=o||[];setOrders(arr);setStats({orders:arr.length,gmv:arr.reduce((s,x)=>s+Number(x.total),0),merchants:mc||0,couriers:cc||0})
 }
 if(!session)return <main className="shell" style={{maxWidth:480}}><div className="brand">Guti.mx Admin</div><form className="card grid" onSubmit={login}><input type="email" placeholder="Correo admin" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/><button className="btn">Entrar</button></form>{msg&&<p>{msg}</p>}</main>
 return <main className="shell"><div className="topbar"><div><div className="brand">Guti.mx Admin</div><span className="muted">Operación Gutiérrez Zamora</span></div><button className="btn secondary" onClick={()=>supabase.auth.signOut()}>Salir</button></div>
 {msg&&<div className="card">{msg}</div>}<div className="grid cols4" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
 <div className="card"><div className="muted">Pedidos cargados</div><div className="stat">{stats.orders}</div></div><div className="card"><div className="muted">GMV</div><div className="stat">${stats.gmv.toFixed(0)}</div></div><div className="card"><div className="muted">Negocios</div><div className="stat">{stats.merchants}</div></div><div className="card"><div className="muted">Repartidores</div><div className="stat">{stats.couriers}</div></div></div>
 <div className="card"><div className="between"><h2>Pedidos recientes</h2><button className="btn" onClick={load}>Actualizar</button></div><table><thead><tr><th>ID</th><th>Negocio</th><th>Total</th><th>Estado</th><th>Reparto</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.id.slice(0,8)}</td><td>{o.merchants?.name}</td><td>${Number(o.total).toFixed(2)}</td><td><span className="pill">{o.status}</span></td><td>{o.delivery_mode}</td></tr>)}</tbody></table></div>
 </main>
}
