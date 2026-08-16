'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  Home, Search, ReceiptText, UserRound, ShoppingCart, MapPin, ChevronDown,
  Bell, UtensilsCrossed, ShoppingBasket, Pill, Package, Bike, CupSoda,
  IceCreamBowl, Grid2X2, Store, Star, Clock3, ArrowRight, ArrowLeft,
  Plus, Minus, Trash2, X, WalletCards, Gift, Heart, MapPinned, LogOut,
  ChevronRight, LocateFixed, Check, Navigation, BadgePercent
} from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const categoryDefs = [
  {key:'food', label:'Comida', icon:UtensilsCrossed, types:['restaurant']},
  {key:'super', label:'Súper', icon:ShoppingBasket, types:['supermarket','convenience']},
  {key:'pharmacy', label:'Farmacia', icon:Pill, types:['pharmacy']},
  {key:'errands', label:'Mandados', icon:Package, coming:true},
  {key:'delivery', label:'Envíos', icon:Bike, coming:true},
  {key:'drinks', label:'Bebidas', icon:CupSoda, types:['restaurant','convenience']},
  {key:'desserts', label:'Postres', icon:IceCreamBowl, types:['restaurant']},
  {key:'all', label:'Más', icon:Grid2X2, types:[]}
]

const statusLabel = s => ({
  pending:'Esperando aceptación',
  accepted:'Pedido aceptado',
  preparing:'Preparando',
  ready:'Pedido listo',
  assigned:'Repartidor asignado',
  picked_up:'Pedido recogido',
  on_the_way:'En camino',
  delivered:'Entregado',
  cancelled:'Cancelado'
}[s] || s)

export default function Page(){
  const supabase = useMemo(()=>getSupabaseBrowserClient(),[])

  const [session,setSession]=useState(null)
  const [profile,setProfile]=useState(null)
  const [addresses,setAddresses]=useState([])
  const [selectedAddressId,setSelectedAddressId]=useState(null)
  const selectedAddress = addresses.find(a=>a.id===selectedAddressId) || addresses.find(a=>a.is_default) || addresses[0] || null

  const [merchants,setMerchants]=useState([])
  const [selectedMerchant,setSelectedMerchant]=useState(null)
  const [products,setProducts]=useState([])
  const [merchantLoading,setMerchantLoading]=useState(false)

  const [cart,setCart]=useState([])
  const [showCart,setShowCart]=useState(false)

  const [activeOrders,setActiveOrders]=useState([])
  const [orderHistory,setOrderHistory]=useState([])
  const [trackingOrderId,setTrackingOrderId]=useState(null)
  const [showTracking,setShowTracking]=useState(false)
  const [deliveredSuccess,setDeliveredSuccess]=useState(null)
  const [orderLoading,setOrderLoading]=useState(false)
  const activeOrder = activeOrders.find(o=>o.id===trackingOrderId) || activeOrders[0] || null

  const [tab,setTab]=useState('home')
  const [query,setQuery]=useState('')
  const [category,setCategory]=useState('all')
  const [message,setMessage]=useState('')

  const [showAuth,setShowAuth]=useState(false)
  const [authMode,setAuthMode]=useState('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [fullName,setFullName]=useState('')
  const [authBusy,setAuthBusy]=useState(false)

  const [showAddressPicker,setShowAddressPicker]=useState(false)
  const [showAddressForm,setShowAddressForm]=useState(false)
  const [addressLabel,setAddressLabel]=useState('Casa')
  const [addressText,setAddressText]=useState('')
  const [addressNotes,setAddressNotes]=useState('')
  const [addressBusy,setAddressBusy]=useState(false)

  const [checkoutNotes,setCheckoutNotes]=useState('')

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>applySession(data.session))
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>applySession(s))
    loadMerchants()
    return ()=>sub.subscription.unsubscribe()
  },[])

  useEffect(()=>{
    const key=session?.user?.id?`guti-cart:${session.user.id}`:'guti-cart:guest'
    try{
      const saved=JSON.parse(localStorage.getItem(key)||'[]')
      setCart(Array.isArray(saved)?saved:[])
    }catch{setCart([])}
  },[session?.user?.id])

  useEffect(()=>{
    const key=session?.user?.id?`guti-cart:${session.user.id}`:'guti-cart:guest'
    localStorage.setItem(key,JSON.stringify(cart))
  },[cart,session?.user?.id])

  useEffect(()=>{
    if(!session?.user?.id) return
    const channel=supabase
      .channel(`guti-customer-${session.user.id}`)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'orders',
        filter:`customer_id=eq.${session.user.id}`
      },async payload=>{
        if(payload.eventType==='UPDATE' && payload.new?.status==='delivered'){
          const previous=activeOrders.find(o=>o.id===payload.new.id)
          setDeliveredSuccess(previous?{...previous,...payload.new}:payload.new)
          setTrackingOrderId(payload.new.id)
          setShowTracking(true)
        }
        await Promise.all([loadActiveOrders(session.user.id),loadOrderHistory(session.user.id)])
      })
      .subscribe()
    const fallback=setInterval(()=>{
      loadActiveOrders(session.user.id)
      loadOrderHistory(session.user.id)
    },15000)
    return ()=>{clearInterval(fallback);supabase.removeChannel(channel)}
  },[session?.user?.id,trackingOrderId])

  async function applySession(s){
    setSession(s)
    if(!s?.user?.id){
      setProfile(null);setAddresses([]);setSelectedAddressId(null)
      setActiveOrders([]);setOrderHistory([])
      return
    }
    await Promise.all([
      loadProfile(s.user.id),
      loadAddresses(s.user.id),
      loadActiveOrders(s.user.id),
      loadOrderHistory(s.user.id)
    ])
  }

  async function loadProfile(uid){
    const {data}=await supabase.from('profiles').select('*').eq('id',uid).maybeSingle()
    setProfile(data||null)
  }

  async function loadAddresses(uid){
    const {data,error}=await supabase.from('addresses').select('*').eq('user_id',uid).order('is_default',{ascending:false}).order('created_at',{ascending:false})
    if(error){console.error(error);return}
    const rows=data||[]
    setAddresses(rows)
    setSelectedAddressId(prev=>prev && rows.some(a=>a.id===prev) ? prev : (rows.find(a=>a.is_default)?.id || rows[0]?.id || null))
  }

  async function loadMerchants(){
    const {data,error}=await supabase.from('merchants').select('*').eq('is_active',true).order('name')
    if(error)return setMessage(error.message)
    setMerchants(data||[])
  }

  async function loadActiveOrders(uid){
    if(!uid)return
    setOrderLoading(true)
    const {data,error}=await supabase
      .from('orders')
      .select('*,merchants(name,delivery_mode)')
      .eq('customer_id',uid)
      .neq('status','delivered')
      .neq('status','cancelled')
      .order('created_at',{ascending:false})
    setOrderLoading(false)
    if(error){console.error(error);return}
    const rows=data||[]
    setActiveOrders(rows)
    setTrackingOrderId(prev=>prev && rows.some(o=>o.id===prev)?prev:(rows[0]?.id||null))
  }

  async function loadOrderHistory(uid){
    if(!uid)return
    const {data,error}=await supabase
      .from('orders')
      .select('*,merchants(name)')
      .eq('customer_id',uid)
      .order('created_at',{ascending:false})
      .limit(40)
    if(error){console.error(error);return}
    setOrderHistory(data||[])
  }

  async function openMerchant(m){
    setSelectedMerchant(m);setMerchantLoading(true);setMessage('')
    const {data,error}=await supabase.from('products').select('*').eq('merchant_id',m.id).eq('is_available',true).order('sort_order').order('name')
    setMerchantLoading(false)
    if(error)return setMessage(error.message)
    setProducts(data||[])
  }

  function add(p){
    if(cart.length && cart[0].merchant_id!==p.merchant_id){
      setMessage('Tu carrito tiene productos de otro negocio. Vacíalo antes de pedir aquí.')
      setShowCart(true)
      return
    }
    setCart(prev=>{
      const x=prev.find(i=>i.id===p.id)
      return x?prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):[...prev,{...p,qty:1,merchant_id:p.merchant_id}]
    })
  }
  const changeQty=(id,d)=>setCart(prev=>prev.map(i=>i.id===id?{...i,qty:i.qty+d}:i).filter(i=>i.qty>0))
  const removeItem=id=>setCart(prev=>prev.filter(i=>i.id!==id))
  const clearCart=()=>setCart([])

  const subtotal=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0)
  const delivery=cart.length?45:0
  const total=subtotal+delivery
  const cartCount=cart.reduce((s,x)=>s+x.qty,0)

  async function signIn(){
    if(authBusy)return
    if(!email.trim()||!password)return setMessage('Escribe correo y contraseña.')
    setAuthBusy(true);setMessage('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setAuthBusy(false)
    if(error)setMessage(error.message)
    else{setShowAuth(false);setAuthMode('login')}
  }

  async function signUp(){
    if(authBusy)return
    if(!fullName.trim())return setMessage('Escribe tu nombre.')
    if(!email.trim())return setMessage('Escribe tu correo.')
    if(password.length<6)return setMessage('La contraseña debe tener al menos 6 caracteres.')
    setAuthBusy(true);setMessage('')
    const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName.trim()}}})
    setAuthBusy(false)
    if(error)return setMessage(error.message)
    setMessage(data?.session?'Cuenta creada correctamente.':'Cuenta creada. Revisa tu correo si se requiere confirmación.')
    setAuthMode('login')
    if(data?.session)setShowAuth(false)
  }

  async function signOut(){
    setProfile(null);setAddresses([]);setSelectedAddressId(null)
    setActiveOrders([]);setOrderHistory([]);setTrackingOrderId(null)
    setShowTracking(false);setDeliveredSuccess(null);setTab('home')
    await supabase.auth.signOut()
  }

  async function saveAddress(){
    if(!session){setShowAddressPicker(false);setShowAuth(true);return}
    if(!addressText.trim())return setMessage('Escribe tu dirección.')
    setAddressBusy(true);setMessage('')
    const makeDefault=addresses.length===0
    const {data,error}=await supabase.from('addresses').insert({
      user_id:session.user.id,
      label:addressLabel.trim()||'Casa',
      formatted_address:addressText.trim(),
      instructions:addressNotes.trim(),
      lat:20.45,lng:-97.08,
      is_default:makeDefault
    }).select().single()
    setAddressBusy(false)
    if(error)return setMessage(error.message)
    await loadAddresses(session.user.id)
    setSelectedAddressId(data.id)
    setAddressText('');setAddressNotes('');setAddressLabel('Casa')
    setShowAddressForm(false);setShowAddressPicker(false)
  }

  async function makeDefaultAddress(id){
    if(!session)return
    await supabase.from('addresses').update({is_default:false}).eq('user_id',session.user.id)
    await supabase.from('addresses').update({is_default:true}).eq('id',id)
    setSelectedAddressId(id)
    await loadAddresses(session.user.id)
  }

  async function deleteAddress(id){
    if(!session)return
    const {error}=await supabase.from('addresses').delete().eq('id',id)
    if(error)return setMessage(error.message)
    await loadAddresses(session.user.id)
  }

  async function checkout(){
    if(!session){setShowCart(false);setShowAuth(true);return}
    if(!cart.length)return
    if(!selectedAddress){setShowCart(false);setShowAddressPicker(true);return}
    const merchantId=cart[0].merchant_id
    const merchant=merchants.find(m=>m.id===merchantId)||selectedMerchant
    const {data:order,error:oerr}=await supabase.from('orders').insert({
      customer_id:session.user.id,
      merchant_id:merchantId,
      address_id:selectedAddress.id,
      status:'pending',
      delivery_mode:merchant?.delivery_mode||'guti',
      subtotal,delivery_fee:45,discount:0,total,
      payment_method:'cash',payment_status:'pending',
      notes:checkoutNotes
    }).select().single()
    if(oerr)return setMessage(oerr.message)

    const items=cart.map(x=>({
      order_id:order.id,product_id:x.id,product_name:x.name,unit_price:x.price,
      quantity:x.qty,line_total:Number(x.price)*x.qty,selected_options:[]
    }))
    const {error:ierr}=await supabase.from('order_items').insert(items)
    if(ierr)return setMessage(ierr.message)

    clearCart();setCheckoutNotes('');setShowCart(false);setSelectedMerchant(null)
    await Promise.all([loadActiveOrders(session.user.id),loadOrderHistory(session.user.id)])
    setTab('home')
    setMessage('Pedido enviado. Ya puedes rastrearlo desde Inicio.')
  }

  const filteredMerchants=merchants.filter(m=>{
    const q=query.trim().toLowerCase()
    const matchesQuery=!q || `${m.name} ${m.description||''} ${m.merchant_type||''}`.toLowerCase().includes(q)
    const c=categoryDefs.find(x=>x.key===category)
    const matchesCategory=category==='all'||!c?.types?.length||c.types.includes(m.merchant_type)
    return matchesQuery&&matchesCategory
  })

  function AuthModal(){
    if(!showAuth)return null
    return <div className="modal-backdrop" onClick={()=>setShowAuth(false)}>
      <section className="modal-card auth-modern" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={()=>setShowAuth(false)}><X/></button>
        <div className="auth-logo">Guti.mx</div>
        <h2>{authMode==='login'?'Bienvenido de vuelta':'Crea tu cuenta'}</h2>
        <p className="muted">{authMode==='login'?'Entra para pedir y ver tus pedidos.':'Compra local, acumula puntos y rastrea tus pedidos.'}</p>
        <div className="auth-tabs">
          <button className={authMode==='login'?'active':''} onClick={()=>setAuthMode('login')}>Entrar</button>
          <button className={authMode==='register'?'active':''} onClick={()=>setAuthMode('register')}>Crear cuenta</button>
        </div>
        {authMode==='register'&&<input placeholder="Nombre completo" value={fullName} onChange={e=>setFullName(e.target.value)}/>}
        <input type="email" placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/>
        <button className="primary-wide" disabled={authBusy} onClick={authMode==='login'?signIn:signUp}>
          {authBusy?'Espera...':authMode==='login'?'Entrar':'Crear mi cuenta'}
        </button>
        {message&&<div className="inline-message">{message}</div>}
      </section>
    </div>
  }

  function AddressModal(){
    if(!showAddressPicker)return null
    return <div className="modal-backdrop" onClick={()=>setShowAddressPicker(false)}>
      <section className="modal-card address-modal" onClick={e=>e.stopPropagation()}>
        <div className="between">
          <div><small className="eyebrow">ENTREGAR EN</small><h2>Mis direcciones</h2></div>
          <button className="modal-close static" onClick={()=>setShowAddressPicker(false)}><X/></button>
        </div>

        {!session&&<div className="empty-state">
          <MapPinned size={38}/><h3>Inicia sesión para guardar direcciones</h3>
          <button className="primary-wide" onClick={()=>{setShowAddressPicker(false);setShowAuth(true)}}>Entrar</button>
        </div>}

        {session&&!showAddressForm&&<>
          <div className="address-list">
            {addresses.map(a=><article className={`address-choice ${selectedAddressId===a.id?'selected':''}`} key={a.id}>
              <button className="address-main" onClick={()=>{setSelectedAddressId(a.id);setShowAddressPicker(false)}}>
                <span className="address-icon"><MapPin/></span>
                <span><b>{a.label||'Dirección'}</b><small>{a.formatted_address}</small>{a.instructions&&<em>{a.instructions}</em>}</span>
                {selectedAddressId===a.id&&<Check className="address-check"/>}
              </button>
              <div className="address-actions">
                {!a.is_default&&<button onClick={()=>makeDefaultAddress(a.id)}>Hacer principal</button>}
                {addresses.length>1&&<button className="danger" onClick={()=>deleteAddress(a.id)}>Eliminar</button>}
              </div>
            </article>)}
          </div>
          <button className="add-address-btn" onClick={()=>setShowAddressForm(true)}><Plus/> Agregar otra dirección</button>
        </>}

        {session&&showAddressForm&&<div className="address-form">
          <button className="text-back" onClick={()=>setShowAddressForm(false)}><ArrowLeft/> Volver</button>
          <label>Nombre</label>
          <div className="label-pills">
            {['Casa','Trabajo','Otro'].map(x=><button className={addressLabel===x?'active':''} key={x} onClick={()=>setAddressLabel(x)}>{x}</button>)}
          </div>
          <label>Dirección escrita</label>
          <textarea rows="3" placeholder="Ej. Calle Juárez #123, Centro, a un lado de..." value={addressText} onChange={e=>setAddressText(e.target.value)}/>
          <label>Referencias</label>
          <textarea rows="2" placeholder="Casa color azul, portón negro..." value={addressNotes} onChange={e=>setAddressNotes(e.target.value)}/>
          <button className="primary-wide" disabled={addressBusy} onClick={saveAddress}>{addressBusy?'Guardando...':'Guardar dirección'}</button>
        </div>}
      </section>
    </div>
  }

  function CartDrawer(){
    if(!showCart)return null
    return <div className="cart-overlay" onClick={()=>setShowCart(false)}>
      <aside className="cart-drawer cart-v2" onClick={e=>e.stopPropagation()}>
        <div className="between cart-head">
          <div><small className="eyebrow">TU PEDIDO</small><h2>Carrito</h2></div>
          <button className="cart-close" onClick={()=>setShowCart(false)}><X/></button>
        </div>
        {!cart.length?<div className="empty-state cart-empty">
          <span className="empty-icon"><ShoppingCart/></span><h3>Tu carrito está vacío</h3><p>Explora los negocios de Guti y agrega algo que se te antoje.</p>
          <button className="primary-wide" onClick={()=>setShowCart(false)}>Explorar</button>
        </div>:<>
          <div className="cart-items">
            {cart.map(i=><article className="cart-item-v2" key={i.id}>
              <div className="cart-item-copy"><b>{i.name}</b><small>${Number(i.price).toFixed(2)} c/u</small><strong>${(Number(i.price)*i.qty).toFixed(2)}</strong></div>
              <div className="qty-control">
                <button onClick={()=>changeQty(i.id,-1)}><Minus/></button><b>{i.qty}</b><button onClick={()=>changeQty(i.id,1)}><Plus/></button>
              </div>
              <button className="trash-btn" onClick={()=>removeItem(i.id)}><Trash2/></button>
            </article>)}
          </div>

          <button className="checkout-address" onClick={()=>setShowAddressPicker(true)}>
            <span className="checkout-address-icon"><MapPin/></span>
            <span><small>Entregar en</small><b>{selectedAddress?.label||'Agregar dirección'}</b><em>{selectedAddress?.formatted_address||'Selecciona dónde recibirás tu pedido'}</em></span>
            <ChevronRight/>
          </button>

          <textarea className="cart-notes" rows="2" placeholder="Nota para el negocio (opcional)" value={checkoutNotes} onChange={e=>setCheckoutNotes(e.target.value)}/>

          <div className="cart-total-box">
            <div><span>Subtotal</span><b>${subtotal.toFixed(2)}</b></div>
            <div><span>Envío fijo</span><b>${delivery.toFixed(2)}</b></div>
            <div className="grand-total"><span>Total</span><strong>${total.toFixed(2)}</strong></div>
          </div>

          <button className="checkout-button" onClick={checkout}>
            <span><ShoppingCart/> Hacer pedido</span><b>${total.toFixed(2)}</b>
          </button>
          <button className="clear-cart-link" onClick={clearCart}>Vaciar carrito</button>
        </>}
      </aside>
    </div>
  }

  function CurrentOrderView(){
    const order=activeOrder
    if(!order&&!deliveredSuccess)return null
    const delivered=deliveredSuccess||(order?.status==='delivered'?order:null)
    if(delivered){
      return <main className="tracking-page">
        <div className="tracking-top"><button onClick={()=>{setDeliveredSuccess(null);setShowTracking(false);setTab('home')}}><ArrowLeft/></button><b>Pedido completado</b><span/></div>
        <section className="delivered-panel">
          <span className="delivered-check"><Check/></span>
          <small>ENTREGADO</small><h1>¡Pedido entregado con éxito!</h1>
          <p>Gracias por pedir con Guti.mx. Esperamos que lo disfrutes.</p>
          <div className="tracking-summary"><div><span>Pedido</span><b>#{delivered.id?.slice(0,8)}</b></div><div><span>Total</span><b>${Number(delivered.total||0).toFixed(2)}</b></div></div>
          <button className="primary-wide" onClick={()=>{setDeliveredSuccess(null);setShowTracking(false);setTab('home')}}>Volver al inicio</button>
        </section>
      </main>
    }

    const info={
      pending:['Esperando al negocio','Enviamos tu pedido. Te avisamos apenas lo acepten.',Clock3,1],
      accepted:['¡Pedido aceptado!','El negocio confirmó tu pedido.',Check,2],
      preparing:['Preparando tu pedido','El negocio ya está trabajando en tu pedido.',UtensilsCrossed,2],
      ready:[order.delivery_mode==='merchant'?'Pedido listo':'Buscando repartidor',order.delivery_mode==='merchant'?'El negocio está preparando la salida de su repartidor.':'Tu pedido está disponible para repartidores Guti.',Search,3],
      assigned:['Ya tienes repartidor','Un repartidor Guti tomó tu pedido.',Bike,3],
      picked_up:['Pedido recogido','El repartidor ya salió del negocio con tu pedido.',Package,4],
      on_the_way:['Tu pedido va en camino','Ya falta poco para que llegue.',Navigation,4]
    }[order.status]||['Pedido en curso','Estamos actualizando tu pedido.',Clock3,1]
    const Icon=info[2]
    const steps=['Enviado','Aceptado','Listo','En camino']

    return <main className="tracking-page">
      <div className="tracking-top"><button onClick={()=>setShowTracking(false)}><ArrowLeft/></button><b>Rastrear pedido</b><span className="tracking-id">#{order.id.slice(0,8)}</span></div>
      <section className="live-order-panel">
        <span className="live-icon"><Icon/></span>
        <div className="live-badge"><i/> ACTUALIZACIÓN EN VIVO</div>
        <h1>{info[0]}</h1><p>{info[1]}</p>
        <div className="tracking-steps">
          {steps.map((s,i)=><div className={i<info[3]?'done':''} key={s}><span>{i<info[3]?<Check/>:i+1}</span><b>{s}</b></div>)}
        </div>
        <div className="tracking-summary">
          <div><span>Negocio</span><b>{order.merchants?.name||'—'}</b></div>
          <div><span>Entrega</span><b>{order.delivery_mode==='merchant'?'Repartidor del negocio':'Guti'}</b></div>
          <div><span>Total</span><b>${Number(order.total).toFixed(2)}</b></div>
          <div><span>Estado</span><b className="green">{statusLabel(order.status)}</b></div>
        </div>
        <button className="secondary-wide" onClick={()=>loadActiveOrders(session.user.id)}>{orderLoading?'Actualizando...':'Actualizar estado'}</button>
      </section>
    </main>
  }

  function BottomNav(){
    const items=[
      ['home','Inicio',Home],
      ['explore','Explorar',Search],
      ['orders','Pedidos',ReceiptText],
      ['profile','Perfil',UserRound]
    ]
    return <nav className="bottom-nav-v2">{items.map(([key,label,Icon])=><button className={tab===key?'active':''} key={key} onClick={()=>{setSelectedMerchant(null);setTab(key)}}><Icon/><span>{label}</span>{key==='orders'&&activeOrders.length>0&&<i>{activeOrders.length}</i>}</button>)}</nav>
  }

  function Header(){
    return <header className="home-header">
      <button className="address-header" onClick={()=>setShowAddressPicker(true)}>
        <span><MapPin/></span>
        <div><small>Entregar en</small><b>{selectedAddress?.label||'Agregar dirección'}</b><em>{selectedAddress?.formatted_address||'Gutiérrez Zamora, Ver.'}</em></div>
        <ChevronDown/>
      </button>
      <div className="header-actions">
        <button className="round-action"><Bell/></button>
        <button className="cart-button-v2" onClick={()=>setShowCart(true)}><ShoppingCart/>{cartCount>0&&<span>{cartCount}</span>}</button>
      </div>
    </header>
  }

  function OrderCarousel(){
    if(!activeOrders.length)return null
    return <section className="orders-carousel-section-v2">
      <div className="section-title"><div><small>EN CURSO</small><h2>{activeOrders.length===1?'Tu pedido':'Tus pedidos'}</h2></div>{activeOrders.length>1&&<span>Desliza →</span>}</div>
      <div className="active-orders-carousel-v2">
        {activeOrders.map((o,index)=><article className="active-order-card-v2" key={o.id}>
          <div className="active-order-top"><span className="status-dot"/><small>{statusLabel(o.status)}</small><em>{index+1}/{activeOrders.length}</em></div>
          <div className="active-order-main">
            <span className="order-store-icon"><Store/></span>
            <div><b>{o.merchants?.name}</b><small>Pedido #{o.id.slice(0,8)}</small></div>
            <strong>${Number(o.total).toFixed(2)}</strong>
          </div>
          <button onClick={()=>{setTrackingOrderId(o.id);setShowTracking(true)}}>Rastrear pedido <ArrowRight/></button>
        </article>)}
      </div>
    </section>
  }

  function MerchantCard({m}){
    return <button className="merchant-card-v2" onClick={()=>openMerchant(m)}>
      <div className="merchant-cover-v2">
        {m.cover_url?<img src={m.cover_url} alt=""/>:<Store/>}
        <span>{m.delivery_mode==='merchant'?'Reparto propio':'Entrega Guti'}</span>
      </div>
      <div className="merchant-body-v2">
        <div><h3>{m.name}</h3><p>{m.description||'Negocio local en Gutiérrez Zamora'}</p></div>
        <div className="merchant-meta"><span><Star/> 4.8</span><span><Clock3/> 25–40 min</span></div>
      </div>
    </button>
  }

  function HomeView(){
    return <>
      <Header/>
      <section className="welcome-row">
        <div><small>{session?'HOLA DE NUEVO':'BIENVENIDO A'}</small><h1>{session?(profile?.full_name?.split(' ')[0]||'Guti'):'Guti.mx'} <span>👋</span></h1></div>
        <span className="delivery-chip">Envío fijo $45</span>
      </section>

      <div className="search-v2"><Search/><input placeholder="¿Qué se te antoja hoy?" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <OrderCarousel/>

      <section className="category-section">
        <div className="section-title"><div><small>TODO EN UN LUGAR</small><h2>¿Qué necesitas?</h2></div></div>
        <div className="category-grid-v2">
          {categoryDefs.map(c=>{
            const Icon=c.icon
            return <button key={c.key} className={category===c.key?'active':''} onClick={()=>{
              if(c.coming){setMessage(`${c.label} estará disponible muy pronto.`);return}
              setCategory(c.key)
              if(c.key!=='all')setTab('explore')
            }}>
              <span><Icon/></span><b>{c.label}</b>{c.coming&&<em>Pronto</em>}
            </button>
          })}
        </div>
      </section>

      <section className="points-banner">
        <div><span className="points-icon"><Gift/></span><div><small>GUTI PUNTOS</small><h2>Pide local. Gana recompensas.</h2><p>Acumula puntos con tus pedidos y úsalos después.</p></div></div>
        <ArrowRight/>
      </section>

      <section>
        <div className="section-title"><div><small>CERCA DE TI</small><h2>Negocios en Guti</h2></div><button onClick={()=>setTab('explore')}>Ver todos</button></div>
        <div className="merchant-grid-v2">{merchants.slice(0,4).map(m=><MerchantCard key={m.id} m={m}/>)}</div>
      </section>

      {message&&<div className="toast-message">{message}<button onClick={()=>setMessage('')}><X/></button></div>}
    </>
  }

  function ExploreView(){
    return <>
      <Header/>
      <div className="page-heading"><small>DESCUBRE</small><h1>Explorar</h1><p>Restaurantes, tiendas y súper de Gutiérrez Zamora.</p></div>
      <div className="search-v2"><Search/><input autoFocus placeholder="Buscar negocio..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="filter-row">
        <button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>Todos</button>
        <button className={category==='food'?'active':''} onClick={()=>setCategory('food')}>Comida</button>
        <button className={category==='super'?'active':''} onClick={()=>setCategory('super')}>Súper y tiendas</button>
      </div>
      <div className="merchant-grid-v2 explore-grid">
        {filteredMerchants.map(m=><MerchantCard key={m.id} m={m}/>)}
        {!filteredMerchants.length&&<div className="empty-state full"><Search/><h3>No encontramos negocios</h3><p>Prueba con otra búsqueda.</p></div>}
      </div>
    </>
  }

  function OrdersView(){
    if(!session)return <LoginRequired icon={ReceiptText} title="Tus pedidos viven aquí" text="Inicia sesión para rastrear pedidos activos y consultar tu historial."/>
    return <>
      <Header/>
      <div className="page-heading"><small>TU ACTIVIDAD</small><h1>Mis pedidos</h1><p>Rastrea los que están en curso y consulta pedidos anteriores.</p></div>
      <OrderCarousel/>
      <div className="orders-history">
        <div className="section-title"><div><small>HISTORIAL</small><h2>Pedidos anteriores</h2></div></div>
        {orderHistory.filter(o=>['delivered','cancelled'].includes(o.status)).map(o=><article className="history-order" key={o.id}>
          <span className={`history-icon ${o.status}`}><ReceiptText/></span>
          <div><b>{o.merchants?.name||'Negocio'}</b><small>#{o.id.slice(0,8)} · {new Date(o.created_at).toLocaleDateString('es-MX')}</small><em>{statusLabel(o.status)}</em></div>
          <strong>${Number(o.total).toFixed(2)}</strong>
        </article>)}
        {!orderHistory.some(o=>['delivered','cancelled'].includes(o.status))&&<div className="empty-state small"><ReceiptText/><h3>Aún no hay historial</h3><p>Tus pedidos completados aparecerán aquí.</p></div>}
      </div>
    </>
  }

  function ProfileView(){
    if(!session)return <LoginRequired icon={UserRound} title="Tu cuenta Guti" text="Guarda direcciones, consulta puntos y administra tus pedidos."/>
    return <>
      <Header/>
      <section className="profile-hero-v2">
        <span className="profile-avatar">{(profile?.full_name||session.user.email||'G').charAt(0).toUpperCase()}</span>
        <div><small>MI CUENTA</small><h1>{profile?.full_name||'Usuario Guti'}</h1><p>{session.user.email}</p></div>
      </section>

      <div className="profile-stats">
        <article><WalletCards/><div><small>Guti Balance</small><b>${Number(profile?.guti_balance||0).toFixed(2)}</b></div></article>
        <article><Gift/><div><small>Guti Puntos</small><b>{profile?.points||0}</b></div></article>
      </div>

      <section className="profile-menu-card">
        <button onClick={()=>setShowAddressPicker(true)}><span><MapPinned/></span><div><b>Mis direcciones</b><small>{addresses.length} guardada{addresses.length===1?'':'s'}</small></div><ChevronRight/></button>
        <button onClick={()=>setTab('orders')}><span><ReceiptText/></span><div><b>Mis pedidos</b><small>Historial y seguimiento</small></div><ChevronRight/></button>
        <button><span><Gift/></span><div><b>Invitar y ganar</b><small>Referidos Guti</small></div><ChevronRight/></button>
        <button><span><Heart/></span><div><b>Favoritos</b><small>Muy pronto</small></div><ChevronRight/></button>
      </section>

      <button className="logout-button" onClick={signOut}><LogOut/> Cerrar sesión</button>
    </>
  }

  function LoginRequired({icon:Icon,title,text}){
    return <>
      <Header/>
      <div className="login-required"><span><Icon/></span><h1>{title}</h1><p>{text}</p><button className="primary-wide" onClick={()=>setShowAuth(true)}>Entrar o crear cuenta</button></div>
    </>
  }

  function MerchantView(){
    const m=selectedMerchant
    return <main className="client-app merchant-page-v2">
      <div className="merchant-topbar"><button onClick={()=>setSelectedMerchant(null)}><ArrowLeft/></button><b>{m.name}</b><button className="cart-button-v2" onClick={()=>setShowCart(true)}><ShoppingCart/>{cartCount>0&&<span>{cartCount}</span>}</button></div>
      <section className="merchant-hero-v2">
        {m.cover_url?<img src={m.cover_url} alt={m.name}/>:<span><Store/></span>}
        <div className="merchant-hero-overlay"/>
        <div className="merchant-hero-copy"><small>GUTI.MX</small><h1>{m.name}</h1><p>{m.description||'Negocio local'}</p><div><span><Star/> 4.8</span><span><Clock3/> 25–40 min</span><span><Bike/> $45 envío</span></div></div>
      </section>
      <section className="merchant-products">
        <div className="section-title"><div><small>MENÚ</small><h2>Productos</h2></div></div>
        {merchantLoading&&<div className="loading-card">Cargando productos...</div>}
        {!merchantLoading&&!products.length&&<div className="empty-state"><Store/><h3>Aún no hay productos</h3><p>Este negocio todavía está preparando su catálogo.</p></div>}
        <div className="products-list-v2">
          {products.map(p=><article key={p.id}>
            <div className="product-image-v2">{p.image_url?<img src={p.image_url} alt={p.name}/>:<UtensilsCrossed/>}</div>
            <div className="product-copy-v2"><h3>{p.name}</h3><p>{p.description||'Disponible para pedir en Guti.mx'}</p><b>${Number(p.price).toFixed(2)}</b></div>
            <button className="product-add" onClick={()=>add(p)}><Plus/></button>
          </article>)}
        </div>
      </section>
      {cartCount>0&&<button className="floating-cart-bar" onClick={()=>setShowCart(true)}><span><ShoppingCart/><b>{cartCount} {cartCount===1?'artículo':'artículos'}</b></span><strong>${total.toFixed(2)}</strong></button>}
      {message&&<div className="toast-message">{message}<button onClick={()=>setMessage('')}><X/></button></div>}
      {CartDrawer()}{AuthModal()}{AddressModal()}
    </main>
  }

  if(showTracking&&(activeOrder||deliveredSuccess))return <CurrentOrderView/>
  if(selectedMerchant)return <MerchantView/>

  return <main className="client-app">
    <div className="client-content">
      {tab==='home'&&<HomeView/>}
      {tab==='explore'&&<ExploreView/>}
      {tab==='orders'&&<OrdersView/>}
      {tab==='profile'&&<ProfileView/>}
    </div>
    <BottomNav/>
    {CartDrawer()}{AuthModal()}{AddressModal()}
  </main>
}
