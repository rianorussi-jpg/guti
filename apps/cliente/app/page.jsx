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
  const [showCart,setShowCart]=useState(false)
  const [activeOrder,setActiveOrder]=useState(null)
  const [orderLoading,setOrderLoading]=useState(false)
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
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session)
      if(data.session?.user?.id) loadActiveOrder(data.session.user.id)
      else setActiveOrder(null)
      const key = data.session?.user?.id ? `guti-cart:${data.session.user.id}` : 'guti-cart:guest'
      try{ setCart(JSON.parse(localStorage.getItem(key)||'[]')) }catch{ setCart([]) }
    })
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{
      setSession(s)
      if(s?.user?.id) loadActiveOrder(s.user.id)
      else setActiveOrder(null)
      const key = s?.user?.id ? `guti-cart:${s.user.id}` : 'guti-cart:guest'
      try{ setCart(JSON.parse(localStorage.getItem(key)||'[]')) }catch{ setCart([]) }
    })
    loadMerchants()
    return ()=>sub.subscription.unsubscribe()
  },[])

  useEffect(()=>{
    const key = session?.user?.id ? `guti-cart:${session.user.id}` : 'guti-cart:guest'
    localStorage.setItem(key,JSON.stringify(cart))
  },[cart,session])

  useEffect(()=>{
    if(!session?.user?.id) return
    const channel = supabase
      .channel(`customer-order-${session.user.id}`)
      .on('postgres_changes',{
        event:'*',
        schema:'public',
        table:'orders',
        filter:`customer_id=eq.${session.user.id}`
      },()=>loadActiveOrder(session.user.id))
      .subscribe()

    const fallback=setInterval(()=>loadActiveOrder(session.user.id),12000)
    return ()=>{
      clearInterval(fallback)
      supabase.removeChannel(channel)
    }
  },[session?.user?.id])

  async function loadActiveOrder(userId){
    if(!userId) return
    setOrderLoading(true)
    const {data,error}=await supabase
      .from('orders')
      .select('*,merchants(name,delivery_mode)')
      .eq('customer_id',userId)
      .neq('status','delivered')
      .neq('status','cancelled')
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle()
    setOrderLoading(false)
    if(error){ console.error('active order',error); return }
    setActiveOrder(data||null)
  }

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

  function changeQty(id,delta){
    setCart(prev=>prev.map(i=>i.id===id?{...i,qty:i.qty+delta}:i).filter(i=>i.qty>0))
  }

  function removeItem(id){
    setCart(prev=>prev.filter(i=>i.id!==id))
  }

  function clearCart(){
    setCart([])
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

  async function signOut(){ setActiveOrder(null); await supabase.auth.signOut() }

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

    setCart([]); setAddress(''); setNotes(''); setShowCart(false); setSelected(null)
    await loadActiveOrder(session.user.id)
    setMessage('')
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

  function CurrentOrderView(){
    if(!activeOrder) return null
    const status=activeOrder.status
    const merchantDelivery=activeOrder.delivery_mode==='merchant'
    const map={
      pending:{title:'Esperando al negocio',subtitle:`Enviamos tu pedido a ${activeOrder.merchants?.name||'el negocio'}. En cuanto lo acepten te avisamos.`,icon:'⏳',step:1},
      accepted:{title:'¡Pedido aceptado!',subtitle:`${activeOrder.merchants?.name||'El negocio'} confirmó tu pedido.`,icon:'✅',step:2},
      preparing:{title:'Están preparando tu pedido',subtitle:'Todo va en orden. Te avisaremos cuando esté listo.',icon:'👨‍🍳',step:2},
      ready:{title:merchantDelivery?'Tu pedido está listo':'Buscando repartidor',subtitle:merchantDelivery?'El negocio preparará la salida de su repartidor.':'Tu pedido ya está listo y está disponible para los repartidores Guti.',icon:merchantDelivery?'🛍️':'🔎',step:3},
      assigned:{title:'¡Ya tienes repartidor!',subtitle:'Un repartidor Guti tomó tu pedido y pronto irá por él.',icon:'🛵',step:3},
      picked_up:{title:'El repartidor ya recogió tu pedido',subtitle:'Tu pedido salió del negocio.',icon:'📦',step:4},
      on_the_way:{title:'Tu pedido va en camino',subtitle:'Ya falta poco. Mantente pendiente para recibirlo.',icon:'🛵',step:4}
    }
    const info=map[status]||{title:'Pedido en curso',subtitle:'Estamos actualizando el estado de tu pedido.',icon:'🧡',step:1}
    const steps=['Pedido enviado','Aceptado','Listo / repartidor','En camino']
    return <main className="shell current-order-shell" style={{maxWidth:560}}>
      <div className="between current-order-top">
        <div className="brand">Guti.mx</div>
        <span className="pill">Pedido #{activeOrder.id.slice(0,8)}</span>
      </div>

      <section className="order-wait-card">
        <div className="order-big-icon">{info.icon}</div>
        <div className="order-live-dot"><i/> ACTUALIZACIÓN EN VIVO</div>
        <h1>{info.title}</h1>
        <p className="muted order-subtitle">{info.subtitle}</p>

        {status==='pending'&&<div className="waiting-animation"><span/><span/><span/></div>}

        <div className="order-progress">
          {steps.map((x,i)=><div className={i<info.step?'done':''} key={x}>
            <i>{i<info.step?'✓':i+1}</i>
            <span>{x}</span>
          </div>)}
        </div>

        <div className="order-info-box">
          <div className="between"><span>Negocio</span><b>{activeOrder.merchants?.name||'—'}</b></div>
          <div className="between"><span>Entrega</span><b>{merchantDelivery?'Repartidor del negocio':'Repartidor Guti'}</b></div>
          <div className="between"><span>Total</span><b>${Number(activeOrder.total).toFixed(2)}</b></div>
          <div className="between"><span>Pago</span><b>{activeOrder.payment_method==='cash'?'Efectivo':activeOrder.payment_method}</b></div>
        </div>

        <p className="order-persist-note">Puedes cerrar Guti.mx. Cuando vuelvas, este pedido seguirá apareciendo hasta que sea entregado.</p>
        <button type="button" className="btn secondary" onClick={()=>loadActiveOrder(session.user.id)}>{orderLoading?'Actualizando...':'Actualizar estado'}</button>
      </section>
    </main>
  }

  function CartDrawer(){
    if(!showCart) return null
    return <div className="cart-overlay" onClick={()=>setShowCart(false)}>
      <div className="cart-drawer" onClick={e=>e.stopPropagation()}>
        <div className="between">
          <div>
            <h2 style={{marginBottom:4}}>Tu carrito</h2>
            <div className="muted">{session?'Guardado para esta cuenta':'Guardado como invitado en este dispositivo'}</div>
          </div>
          <button type="button" className="cart-close" onClick={()=>setShowCart(false)}>×</button>
        </div>

        {cart.length===0 ? <div className="empty-cart">
          <div style={{fontSize:42}}>🛒</div>
          <h3>Tu carrito está vacío</h3>
          <p className="muted">Agrega productos para empezar.</p>
        </div> : <>
          <div className="cart-items">
            {cart.map(i=><div className="cart-line" key={i.id}>
              <div className="cart-line-main">
                <b>{i.name}</b>
                <span className="muted">${Number(i.price).toFixed(2)} c/u</span>
                <strong>${(Number(i.price)*i.qty).toFixed(2)}</strong>
              </div>
              <div className="cart-actions">
                <button type="button" onClick={()=>changeQty(i.id,-1)}>−</button>
                <span>{i.qty}</span>
                <button type="button" onClick={()=>changeQty(i.id,1)}>+</button>
                <button type="button" className="remove" onClick={()=>removeItem(i.id)}>Quitar</button>
              </div>
            </div>)}
          </div>
          <div className="cart-summary">
            <div className="between"><span>Subtotal</span><b>${subtotal.toFixed(2)}</b></div>
            <div className="between"><span>Envío</span><b>${delivery.toFixed(2)}</b></div>
            <div className="between total-row"><span>Total</span><strong>${total.toFixed(2)}</strong></div>
          </div>
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
            <button type="button" className="btn secondary" onClick={clearCart}>Vaciar carrito</button>
            <button type="button" className="btn" onClick={()=>setShowCart(false)}>Seguir comprando</button>
          </div>
        </>}
      </div>
    </div>
  }

  if(activeOrder) return <CurrentOrderView/>

  if(selected){
    return <main className="shell" style={{maxWidth:560}}>{CartDrawer()}
      <div className="topbar"><button className="btn secondary" onClick={()=>setSelected(null)}>← Volver</button><div className="brand">{selected.name}</div><span/></div>
      <div className="card"><h2>{selected.name}</h2><p className="muted">{selected.description||selected.merchant_type}</p><span className="pill">{selected.delivery_mode==='merchant'?'Reparto propio':'Reparto Guti'}</span></div>
      <h2>Productos</h2>
      <div className="grid">
        {products.length===0&&<div className="card muted">Este negocio todavía no ha cargado productos.</div>}
        {products.map(p=><div className="card between" key={p.id}><div><b>{p.name}</b><p className="muted">{p.description}</p><strong>${Number(p.price).toFixed(2)}</strong></div><button className="btn" onClick={()=>add(p)}>Agregar</button></div>)}
      </div>
      {cart.length>0&&<div className="card" style={{position:'sticky',bottom:12,marginTop:20,boxShadow:'0 10px 40px #0002'}}>
        <div className="between"><b>Carrito ({cart.reduce((s,x)=>s+x.qty,0)})</b><strong>${total.toFixed(2)}</strong></div>
        <button type="button" className="btn secondary" style={{width:'100%',marginTop:10}} onClick={()=>setShowCart(true)}>Ver y editar carrito</button>
        <input style={{marginTop:10}} placeholder="Dirección escrita en Gutiérrez Zamora" value={address} onChange={e=>setAddress(e.target.value)}/>
        <textarea style={{marginTop:10}} placeholder="Referencias / instrucciones" value={notes} onChange={e=>setNotes(e.target.value)}/>
        <button className="btn" style={{width:'100%',marginTop:10}} onClick={checkout}>Confirmar pedido · Efectivo · Envío $45</button>
      </div>}
      {message&&<p className="card">{message}</p>}
      {showAuth&&AuthPanel()}
    </main>
  }

  return <main className="shell" style={{maxWidth:560}}>{CartDrawer()}
    <div className="topbar">
      <div><div className="muted" style={{fontSize:12}}>Entregar en</div><b>Gutiérrez Zamora, Ver.</b></div>
      <div className="row">
        <button type="button" className="btn secondary" onClick={()=>setShowCart(true)}>Carrito ({cart.reduce((s,x)=>s+x.qty,0)})</button>
        {session?<button className="btn secondary" onClick={signOut}>Salir</button>:<button type="button" className="btn secondary" onClick={()=>{setAuthMode('login');setShowAuth(!showAuth)}}>Entrar</button>}
      </div>
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
