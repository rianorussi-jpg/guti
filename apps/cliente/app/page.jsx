'use client'
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const cats=['🍔 Comida','🛒 Súper','💊 Farmacia','🛍️ Mandados','📦 Envíos','🥤 Bebidas','🍰 Postres','••• Más']

export default function Page(){
  const supabase = useMemo(()=>getSupabaseBrowserClient(),[])
  const [session,setSession]=useState(null)
  const [merchants,setMerchants]=useState([])
  const [selected,setSelected]=useState(null)
  const [products,setProducts]=useState([])
  const [cart,setCart]=useState([])
  const [showAuth,setShowAuth]=useState(false)
  const [authMode,setAuthMode]=useState('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [fullName,setFullName]=useState('')
  const [authBusy,setAuthBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [address,setAddress]=useState('')
  const [notes,setNotes]=useState('')

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    loadMerchants()
    try{setCart(JSON.parse(localStorage.getItem('guti-cart')||'[]'))}catch{}
    return ()=>sub.subscription.unsubscribe()
  },[])

  useEffect(()=>{localStorage.setItem('guti-cart',JSON.stringify(cart))},[cart])

  async function loadMerchants(){
    const {data,error}=await supabase.from('merchants').select('*').eq('is_active',true).order('name')
    if(error) return setMessage(error.message)
    setMerchants(data||[])
  }

  async function openMerchant(m){
    setSelected(m)
    const {data,error}=await supabase.from('products').select('*').eq('merchant_id',m.id).eq('is_available',true).order('name')
    if(error) return setMessage(error.message)
    setProducts(data||[])
  }

  function add(p){
    setCart(prev=>{
      const x=prev.find(i=>i.id===p.id)
      return x?prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):[...prev,{...p,qty:1,merchant_id:p.merchant_id}]
    })
  }

  const subtotal=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0)
  const delivery=cart.length?45:0
  const total=subtotal+delivery

  async function signIn(e){
    e?.preventDefault()
    if(authBusy) return
    if(!email.trim()) return setMessage('Escribe tu correo.')
    if(!password) return setMessage('Escribe tu contraseña.')
    setAuthBusy(true); setMessage('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setAuthBusy(false)
    if(error) setMessage(error.message)
    else { setShowAuth(false); setAuthMode('login') }
  }

  async function signUp(e){
    e?.preventDefault()
    if(authBusy) return
    if(!fullName.trim()) return setMessage('Escribe tu nombre.')
    if(!email.trim()) return setMessage('Escribe tu correo.')
    if(password.length < 6) return setMessage('La contraseña debe tener al menos 6 caracteres.')
    setAuthBusy(true); setMessage('')
    const {data,error}=await supabase.auth.signUp({
      email,
      password,
      options:{ data:{ full_name: fullName.trim() } }
    })
    setAuthBusy(false)
    if(error) return setMessage(error.message)

    if(data?.session){
      setMessage('Cuenta creada correctamente. Ya puedes hacer tu pedido.')
      setShowAuth(false)
      setAuthMode('login')
    }else{
      setMessage('Cuenta creada. Revisa tu correo para confirmar la cuenta y después inicia sesión.')
      setAuthMode('login')
    }
  }

  async function signOut(){ await supabase.auth.signOut() }

  async function checkout(){
    if(!session){setShowAuth(true);return}
    if(!cart.length)return
    if(!address.trim()){setMessage('Escribe tu dirección de entrega.');return}
    const merchantId=cart[0].merchant_id
    if(cart.some(x=>x.merchant_id!==merchantId)){setMessage('Por ahora cada pedido debe ser de un solo negocio.');return}

    const {data:addr,error:aerr}=await supabase.from('addresses').insert({
      user_id:session.user.id,label:'Casa',formatted_address:address,lat:20.45,lng:-97.08,instructions:notes
    }).select().single()
    if(aerr){setMessage(aerr.message);return}

    const merchant=merchants.find(m=>m.id===merchantId) || selected
    const {data:order,error:oerr}=await supabase.from('orders').insert({
      customer_id:session.user.id, merchant_id:merchantId, address_id:addr.id,
      status:'pending', delivery_mode:merchant?.delivery_mode || 'guti',
      subtotal, delivery_fee:45, discount:0, total,
      payment_method:'cash', payment_status:'pending', notes
    }).select().single()
    if(oerr){setMessage(oerr.message);return}

    const items=cart.map(x=>({
      order_id:order.id,product_id:x.id,product_name:x.name,unit_price:x.price,
      quantity:x.qty,line_total:Number(x.price)*x.qty,selected_options:[]
    }))
    const {error:ierr}=await supabase.from('order_items').insert(items)
    if(ierr){setMessage(ierr.message);return}

    setCart([]); setAddress(''); setNotes('')
    setMessage(`Pedido ${order.id.slice(0,8)} creado. El negocio debe aceptarlo.`)
  }

  function AuthPanel(){
    return <div className="auth-card">
      <div className="auth-tabs">
        <button type="button" className={authMode==='login'?'auth-tab active':'auth-tab'} onClick={()=>{setAuthMode('login');setMessage('')}}>Entrar</button>
        <button type="button" className={authMode==='register'?'auth-tab active':'auth-tab'} onClick={()=>{setAuthMode('register');setMessage('')}}>Crear cuenta</button>
      </div>

      {authMode==='register' && <input
        type="text"
        placeholder="Tu nombre"
        value={fullName}
        onChange={e=>setFullName(e.target.value)}
        autoComplete="name"
      />}

      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={e=>setEmail(e.target.value)}
        autoComplete="email"
      />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={e=>setPassword(e.target.value)}
        autoComplete={authMode==='login'?'current-password':'new-password'}
      />

      {authMode==='login'
        ? <button type="button" className="btn auth-main" disabled={authBusy} onClick={signIn}>
            {authBusy?'Entrando...':'Entrar'}
          </button>
        : <button type="button" className="btn auth-main" disabled={authBusy} onClick={signUp}>
            {authBusy?'Creando...':'Crear mi cuenta'}
          </button>
      }

      <div className="auth-switch">
        {authMode==='login'
          ? <>¿No tienes cuenta? <button type="button" onClick={()=>{setAuthMode('register');setMessage('')}}>Crear cuenta</button></>
          : <>¿Ya tienes cuenta? <button type="button" onClick={()=>{setAuthMode('login');setMessage('')}}>Entrar</button></>
        }
      </div>
    </div>
  }

  if(selected){
    return <main className="shell" style={{maxWidth:560}}>
      <div className="topbar"><button className="btn secondary" onClick={()=>setSelected(null)}>← Volver</button><div className="brand">{selected.name}</div><span/></div>
      <div className="card"><h2>{selected.name}</h2><p className="muted">{selected.description||selected.merchant_type}</p><span className="pill">{selected.delivery_mode==='merchant'?'Reparto propio':'Reparto Guti'}</span></div>
      <h2>Productos</h2>
      <div className="grid">
        {products.length===0&&<div className="card muted">Este negocio todavía no ha cargado productos.</div>}
        {products.map(p=><div className="card between" key={p.id}><div><b>{p.name}</b><p className="muted">{p.description}</p><strong>${Number(p.price).toFixed(2)}</strong></div><button className="btn" onClick={()=>add(p)}>Agregar</button></div>)}
      </div>
      {cart.length>0&&<div className="card" style={{position:'sticky',bottom:12,marginTop:20,boxShadow:'0 10px 40px #0002'}}>
        <div className="between"><b>Carrito ({cart.reduce((s,x)=>s+x.qty,0)})</b><strong>${total.toFixed(2)}</strong></div>
        <input style={{marginTop:10}} placeholder="Dirección escrita en Gutiérrez Zamora" value={address} onChange={e=>setAddress(e.target.value)}/>
        <textarea style={{marginTop:10}} placeholder="Referencias / instrucciones" value={notes} onChange={e=>setNotes(e.target.value)}/>
        <button className="btn" style={{width:'100%',marginTop:10}} onClick={checkout}>Confirmar pedido · Efectivo · Envío $45</button>
      </div>}
      {message&&<p className="card">{message}</p>}
      {showAuth&&AuthPanel()}
    </main>
  }

  return <main className="shell" style={{maxWidth:560}}>
    <div className="topbar">
      <div><div className="muted" style={{fontSize:12}}>Entregar en</div><b>Gutiérrez Zamora, Ver.</b></div>
      {session?<button className="btn secondary" onClick={signOut}>Salir</button>:<button type="button" className="btn secondary" onClick={()=>{setAuthMode('login');setShowAuth(!showAuth)}}>Entrar</button>}
    </div>
    <div style={{textAlign:'center',margin:'22px 0'}}><div className="brand" style={{fontSize:48,fontStyle:'italic'}}>Guti.mx</div><div className="muted">Lo que necesites, te lo llevamos.</div></div>
    {showAuth&&AuthPanel()}
    <input placeholder="¿Qué quieres pedir hoy?" />
    <div className="grid" style={{gridTemplateColumns:'repeat(4,1fr)',margin:'20px 0'}}>{cats.map(x=><div className="card" key={x} style={{padding:12,textAlign:'center',fontSize:12}}>{x}</div>)}</div>
    <div className="card" style={{background:'linear-gradient(135deg,#f4510b,#ff7a18)',color:'#fff',marginBottom:22}}><span className="pill">GUTI PUNTOS</span><h2>Compra local y gana recompensas</h2><p>Acumula puntos y recibe beneficios.</p></div>
    <div className="between"><h2>Negocios</h2><span className="pill">Envío fijo $45</span></div>
    <div className="grid cols2" style={{gridTemplateColumns:'1fr 1fr'}}>
      {merchants.map(m=><button key={m.id} className="card" onClick={()=>openMerchant(m)} style={{textAlign:'left',cursor:'pointer'}}><div style={{fontSize:42}}>{m.merchant_type==='restaurant'?'🍽️':m.merchant_type==='supermarket'?'🛒':'🏪'}</div><h3>{m.name}</h3><p className="muted">{m.description}</p><b>Ver productos →</b></button>)}
    </div>
    {message&&<p className="card">{message}</p>}
  </main>
}
