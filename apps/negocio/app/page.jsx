'use client'
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase'

export default function Page(){
 const supabase=useMemo(()=>getSupabaseBrowserClient(),[])
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('')
 const [merchant,setMerchant]=useState(null),[orders,setOrders]=useState([]),[products,setProducts]=useState([])
 const [name,setName]=useState(''),[price,setPrice]=useState(''),[desc,setDesc]=useState(''),[msg,setMsg]=useState('')

 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)load(data.session.user.id)})
 const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>{setSession(x);if(x)load(x.user.id)})
 return()=>s.subscription.unsubscribe()},[])

 async function load(uid){
  let {data:m}=await supabase.from('merchants').select('*').eq('owner_id',uid).maybeSingle()
  if(!m){
   const {data:staff}=await supabase.from('merchant_staff').select('merchant_id,merchants(*)').eq('user_id',uid).maybeSingle()
   m=staff?.merchants
  }
  if(!m){setMsg('Tu usuario todavía no está ligado a un negocio. Desde Supabase asigna este usuario como owner_id del negocio.');return}
  setMerchant(m)
  const [{data:o},{data:p}]=await Promise.all([
   supabase.from('orders').select('*,profiles!orders_customer_id_fkey(full_name,phone)').eq('merchant_id',m.id).order('created_at',{ascending:false}),
   supabase.from('products').select('*').eq('merchant_id',m.id).order('created_at',{ascending:false})
  ])
  setOrders(o||[]);setProducts(p||[])
 }

 useEffect(()=>{
  if(!merchant?.id) return
  const channel=supabase
    .channel(`merchant-orders-${merchant.id}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'orders',
      filter:`merchant_id=eq.${merchant.id}`
    },()=>load(session.user.id))
    .subscribe()

  const fallback=setInterval(()=>load(session.user.id),12000)
  return()=>{
    clearInterval(fallback)
    supabase.removeChannel(channel)
  }
 },[merchant?.id,session?.user?.id])

 async function login(e){e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMsg(error.message)}
 async function addProduct(e){e.preventDefault();if(!merchant)return
  const {error}=await supabase.from('products').insert({merchant_id:merchant.id,name,description:desc,price:Number(price),is_available:true})
  if(error)return setMsg(error.message);setName('');setPrice('');setDesc('');load(session.user.id)
 }
 async function status(order,status){
  const {error}=await supabase.rpc('merchant_set_order_status',{p_order_id:order.id,p_status:status})
  if(error)setMsg(error.message);else load(session.user.id)
 }

 if(!session)return <main className="shell" style={{maxWidth:480}}><div className="brand">Guti.mx Negocios</div><h2>Acceso de negocio</h2><form className="card grid" onSubmit={login}><input type="email" placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/><button className="btn">Entrar</button></form>{msg&&<p>{msg}</p>}</main>

 return <main className="shell">
  <div className="topbar"><div><div className="brand">Guti.mx Negocios</div><span className="muted">{merchant?.name||'Cargando...'}</span> <span className="pill" style={{marginLeft:8,background:'#e7f8ed',color:'#158c45'}}>● En vivo</span></div><button className="btn secondary" onClick={()=>supabase.auth.signOut()}>Salir</button></div>
  {msg&&<div className="card">{msg}</div>}
  {merchant&&<>
   <div className="grid cols4" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
    <div className="card"><div className="muted">Pedidos</div><div className="stat">{orders.length}</div></div>
    <div className="card"><div className="muted">Productos</div><div className="stat">{products.length}</div></div>
    <div className="card"><div className="muted">Comisión Guti</div><div className="stat">10%</div></div>
    <div className="card"><div className="muted">Reparto</div><div className="stat" style={{fontSize:18}}>{merchant.delivery_mode==='merchant'?'Propio':'Guti'}</div></div>
   </div>
   <div className="card" style={{marginBottom:20}}><h2>Pedidos</h2><table><thead><tr><th>Pedido</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
    {orders.map(o=><tr key={o.id}><td>{o.id.slice(0,8)}</td><td>${Number(o.total).toFixed(2)}</td><td><span className="pill">{o.status}</span></td><td className="row">
      {o.status==='pending'&&<><button className="btn" onClick={()=>status(o,'accepted')}>Aceptar</button><button className="btn secondary" onClick={()=>status(o,'cancelled')}>Rechazar</button></>}
      {o.status==='accepted'&&<button className="btn" onClick={()=>status(o,'preparing')}>Preparando</button>}
      {o.status==='preparing'&&<button className="btn" onClick={()=>status(o,'ready')}>Pedido listo</button>}
      {merchant.delivery_mode==='merchant'&&o.status==='ready'&&<button className="btn" onClick={()=>status(o,'on_the_way')}>Salió a entrega</button>}
      {merchant.delivery_mode==='merchant'&&o.status==='on_the_way'&&<button className="btn" onClick={()=>status(o,'delivered')}>Entregado</button>}
    </td></tr>)}
   </tbody></table></div>
   <div className="grid cols2" style={{gridTemplateColumns:'1fr 1.5fr'}}>
    <form className="card grid" onSubmit={addProduct}><h2>Nuevo producto</h2><input placeholder="Nombre" value={name} onChange={e=>setName(e.target.value)} required/><textarea placeholder="Descripción" value={desc} onChange={e=>setDesc(e.target.value)}/><input type="number" step="0.01" placeholder="Precio" value={price} onChange={e=>setPrice(e.target.value)} required/><button className="btn">Guardar producto</button></form>
    <div className="card"><h2>Catálogo</h2>{products.map(p=><div className="between" style={{padding:'10px 0',borderBottom:'1px solid #eee'}} key={p.id}><div><b>{p.name}</b><div className="muted">{p.description}</div></div><strong>${Number(p.price).toFixed(2)}</strong></div>)}</div>
   </div>
  </>}
 </main>
}
