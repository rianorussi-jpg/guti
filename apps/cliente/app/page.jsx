'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  Home, Search, ReceiptText, UserRound, ShoppingCart, MapPin, ChevronDown,
  Headphones, UtensilsCrossed, ShoppingBasket, Pill, Package, Bike, CupSoda,
  IceCreamBowl, Grid2X2, Store, Star, Clock3, ArrowRight, ArrowLeft,
  Plus, Minus, Trash2, X, WalletCards, Gift, Heart, MapPinned, LogOut,
  ChevronRight, LocateFixed, Check, Navigation, BadgePercent
} from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const categoryDefs = [
  {key:'food', label:'Comida', image:'/categories/comida.svg', types:['restaurant']},
  {key:'super', label:'Súper', image:'/categories/super.svg', types:['supermarket','convenience']},
  {key:'pharmacy', label:'Farmacias', image:'/categories/farmacia.svg', types:['pharmacy']},
  {key:'errands', label:'Mandados', image:'/categories/mandados.svg', coming:true},
  {key:'delivery', label:'Envíos', image:'/categories/envios.svg', coming:true},
  {key:'drinks', label:'Bebidas', image:'/categories/bebidas.svg', types:['restaurant','convenience']},
  {key:'desserts', label:'Postres', image:'/categories/postres.svg', types:['restaurant']},
  {key:'all', label:'Más', image:'/categories/mas.svg', types:[]}
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
  const [categories,setCategories]=useState([])
  const [merchantLoading,setMerchantLoading]=useState(false)

  const [cart,setCart]=useState([])
  const [showCart,setShowCart]=useState(false)
  const [customizingProduct,setCustomizingProduct]=useState(null)
  const [customGroups,setCustomGroups]=useState([])
  const [customSelections,setCustomSelections]=useState({})
  const [customQty,setCustomQty]=useState(1)
  const [customNotes,setCustomNotes]=useState('')
  const [customBusy,setCustomBusy]=useState(false)

  const [activeOrders,setActiveOrders]=useState([])
  const [orderHistory,setOrderHistory]=useState([])
  const [trackingOrderId,setTrackingOrderId]=useState(null)
  const [showTracking,setShowTracking]=useState(false)
  const [deliveredSuccess,setDeliveredSuccess]=useState(null)
  const [orderLoading,setOrderLoading]=useState(false)
  const activeOrder = activeOrders.find(o=>o.id===trackingOrderId) || activeOrders[0] || null

  const [tab,setTab]=useState('home')
  const [favoriteIds,setFavoriteIds]=useState([])
  const [promoIndex,setPromoIndex]=useState(0)
  const [query,setQuery]=useState('')
  const [category,setCategory]=useState('all')
  const [message,setMessage]=useState('')
  const [lastNotification,setLastNotification]=useState(null)

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
  const [checkoutMerchantId,setCheckoutMerchantId]=useState(null)
  const [showCheckout,setShowCheckout]=useState(false)
  const [checkoutStep,setCheckoutStep]=useState(1)
  const [paymentMethod,setPaymentMethod]=useState('cash')
  const [checkoutBusy,setCheckoutBusy]=useState(false)
  const [cardToken,setCardToken]=useState(null)
  const [cardReady,setCardReady]=useState(false)
  const [cardError,setCardError]=useState('')

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>applySession(data.session))
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>applySession(s))
    loadMerchants()
    return ()=>sub.subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!session?.user?.id)return
    const uid=session.user.id
    const channel=supabase.channel(`client-notifications-${uid}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${uid}`},payload=>{
        const n=payload.new
        setLastNotification(n)
        setMessage(`${n.title}${n.body?`: ${n.body}`:''}`)
        if(typeof window!=='undefined'&&'Notification' in window&&Notification.permission==='granted'){
          try{new Notification(n.title,{body:n.body||'',icon:'/brand/guti-logo.svg',tag:n.dedupe_key||n.id})}catch{}
        }
      }).subscribe()
    return()=>supabase.removeChannel(channel)
  },[session?.user?.id])

  async function enableClientNotifications(){
    if(!('Notification' in window))return setMessage('Este navegador no permite notificaciones.')
    const permission=await Notification.requestPermission()
    setMessage(permission==='granted'?'Avisos de Guti activados.':'No se activaron las notificaciones.')
  }

  function openSupport(){
    const text=encodeURIComponent('Hola Guti, necesito ayuda con mi pedido.')
    window.open(`https://wa.me/525623449135?text=${text}`,'_blank','noopener,noreferrer')
  }

  useEffect(()=>{
    try{
      const raw=sessionStorage.getItem('guti-clip-payment-result')
      if(!raw)return
      const result=JSON.parse(raw)
      if(result?.order_id){
        setTrackingOrderId(result.order_id)
        setShowTracking(true)
        setTab('home')
      }
      sessionStorage.removeItem('guti-clip-payment-result')
    }catch{}
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
    const key=session?.user?.id?`guti-favorites:${session.user.id}`:'guti-favorites:guest'
    try{
      const saved=JSON.parse(localStorage.getItem(key)||'[]')
      setFavoriteIds(Array.isArray(saved)?saved:[])
    }catch{setFavoriteIds([])}
  },[session?.user?.id])

  useEffect(()=>{
    const key=session?.user?.id?`guti-favorites:${session.user.id}`:'guti-favorites:guest'
    localStorage.setItem(key,JSON.stringify(favoriteIds))
  },[favoriteIds,session?.user?.id])

  function toggleFavorite(id){
    setFavoriteIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  }

  useEffect(()=>{
    const timer=setInterval(()=>setPromoIndex(i=>(i+1)%2),4500)
    return ()=>clearInterval(timer)
  },[])

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
    const [{data:productData,error:productError},{data:categoryData,error:categoryError}]=await Promise.all([
      supabase.from('products').select('*').eq('merchant_id',m.id).eq('is_available',true).order('sort_order').order('name'),
      supabase.from('categories').select('*').eq('merchant_id',m.id).eq('is_active',true).order('sort_order').order('name')
    ])
    setMerchantLoading(false)
    if(productError)return setMessage(productError.message)
    if(categoryError)return setMessage(categoryError.message)
    setProducts(productData||[])
    setCategories(categoryData||[])
  }

  async function add(p){
    setMessage('')
    setCustomBusy(true)
    const {data:groups,error}=await supabase
      .from('product_option_groups')
      .select('*,product_options(*)')
      .eq('product_id',p.id)
      .order('id')
    setCustomBusy(false)

    if(error){
      setMessage(error.message)
      return
    }

    const normalized=(groups||[]).map(g=>({
      ...g,
      product_options:(g.product_options||[]).filter(o=>o.is_available!==false)
    }))

    if(normalized.length){
      setCustomizingProduct(p)
      setCustomGroups(normalized)
      setCustomSelections({})
      setCustomQty(1)
      setCustomNotes('')
      return
    }

    addConfiguredItem(p,[],1,'')
  }

  function addConfiguredItem(p,selectedOptions,qty=1,notes=''){
    const optionsTotal=selectedOptions.reduce((s,o)=>s+Number(o.extra_price||0),0)
    const unitPrice=Number(p.price)+optionsTotal
    const signature=JSON.stringify(selectedOptions.map(o=>[o.group_id,o.option_id]).sort())
    const cartKey=`${p.id}:${signature}:${notes.trim()}`
    setCart(prev=>{
      const x=prev.find(i=>i.cart_key===cartKey)
      return x
        ? prev.map(i=>i.cart_key===cartKey?{...i,qty:i.qty+qty}:i)
        : [...prev,{
            ...p,
            cart_key:cartKey,
            qty,
            merchant_id:p.merchant_id,
            base_price:Number(p.price),
            price:unitPrice,
            selected_options:selectedOptions,
            item_notes:notes.trim()
          }]
    })
    setCustomizingProduct(null)
  }

  function toggleCustomOption(group,option){
    setCustomSelections(prev=>{
      const current=prev[group.id]||[]
      const exists=current.some(id=>id===option.id)
      let next
      if(exists) next=current.filter(id=>id!==option.id)
      else if(Number(group.max_select||1)===1) next=[option.id]
      else if(current.length<Number(group.max_select||1)) next=[...current,option.id]
      else next=current
      return {...prev,[group.id]:next}
    })
  }

  function confirmCustomization(){
    const selected=[]
    for(const group of customGroups){
      const ids=customSelections[group.id]||[]
      if(ids.length<Number(group.min_select||0)){
        setMessage(`Selecciona al menos ${group.min_select} en "${group.name}".`)
        return
      }
      for(const id of ids){
        const opt=(group.product_options||[]).find(o=>o.id===id)
        if(opt) selected.push({
          group_id:group.id,
          group_name:group.name,
          option_id:opt.id,
          option_name:opt.name,
          extra_price:Number(opt.extra_price||0)
        })
      }
    }
    addConfiguredItem(customizingProduct,selected,customQty,customNotes)
  }
  const changeQty=(key,d)=>setCart(prev=>prev.map(i=>i.cart_key===key?{...i,qty:i.qty+d}:i).filter(i=>i.qty>0))
  const removeItem=key=>setCart(prev=>prev.filter(i=>i.cart_key!==key))
  const clearCart=()=>setCart([])

  const subtotal=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0)
  const cartMerchantIds=[...new Set(cart.map(x=>x.merchant_id))]
  const delivery=cart.length?45*cartMerchantIds.length:0
  const total=subtotal+delivery
  const cartCount=cart.reduce((s,x)=>s+x.qty,0)

  const cartGroups=cartMerchantIds.map(merchantId=>{
    const items=cart.filter(x=>x.merchant_id===merchantId)
    const merchant=merchants.find(m=>m.id===merchantId)
    const groupSubtotal=items.reduce((s,x)=>s+Number(x.price)*x.qty,0)
    return {merchantId,merchant,items,subtotal:groupSubtotal,total:groupSubtotal+45}
  })

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

  function beginCheckout(merchantId){
    if(!session){
      setShowCart(false)
      setShowAuth(true)
      return
    }
    const group=cartGroups.find(g=>g.merchantId===merchantId)
    if(!group||!group.items.length)return
    setCheckoutMerchantId(merchantId)
    setCheckoutStep(selectedAddress?2:1)
    setPaymentMethod('cash')
    setShowCart(false)
    setShowCheckout(true)
  }

  function goToClipCardPayment(){
    const group=cartGroups.find(g=>g.merchantId===checkoutMerchantId)
    if(!group||!selectedAddress)return
    sessionStorage.setItem('guti-clip-checkout',JSON.stringify({
      merchant_id:group.merchantId,
      merchant_name:group.merchant?.name||'Negocio',
      merchant_logo:group.merchant?.logo_url||'',
      address_id:selectedAddress.id,
      address_label:selectedAddress.label||'Dirección',
      address_text:selectedAddress.formatted_address||'',
      notes:checkoutNotes,
      subtotal:group.subtotal,
      delivery_fee:45,
      total:group.total,
      items:group.items.map(x=>({
        product_id:x.id,
        name:x.name,
        quantity:x.qty,
        price:Number(x.price),
        selected_options:x.selected_options||[]
      }))
    }))
    window.location.href='/pago/tarjeta'
  }

  async function createOrderFromCheckout(){
    if(checkoutBusy)return
    const merchantId=checkoutMerchantId
    const group=cartGroups.find(g=>g.merchantId===merchantId)
    if(!session||!group||!group.items.length)return
    if(!selectedAddress){setCheckoutStep(1);return}

    if(paymentMethod==='guti_balance' && Number(profile?.guti_balance||0) < group.total){
      setMessage('No tienes suficiente Guti Balance para este pedido.')
      return
    }

    setCheckoutBusy(true)
    setMessage('')
    setCardError('')
    const merchant=group.merchant||merchants.find(m=>m.id===merchantId)

    if(paymentMethod==='card'){
      if(!cardToken){
        setCheckoutBusy(false)
        setCheckoutStep(2)
        setCardError('Completa los datos de tu tarjeta y pulsa “Usar esta tarjeta”.')
        return
      }

      const response=await fetch('/api/clip/pay',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({
          card_token:cardToken,
          merchant_id:merchantId,
          address_id:selectedAddress.id,
          notes:checkoutNotes,
          items:group.items.map(x=>({product_id:x.id,quantity:x.qty,selected_options:x.selected_options||[]}))
        })
      })
      const result=await response.json().catch(()=>({}))
      setCheckoutBusy(false)
      if(!response.ok||!result.ok){
        setCardToken(null);setCardReady(false)
        setCardError(result.message||'No pudimos procesar el pago con tarjeta.')
        setCheckoutStep(2)
        return
      }
      setCart(prev=>prev.filter(x=>x.merchant_id!==merchantId))
      setCheckoutNotes('');setCheckoutMerchantId(null);setShowCheckout(false)
      setCardToken(null);setCardReady(false)
      await Promise.all([loadActiveOrders(session.user.id),loadOrderHistory(session.user.id)])
      setTrackingOrderId(result.order_id);setTab('home');setShowTracking(true)
      return
    }

    const {data:order,error:oerr}=await supabase.from('orders').insert({
      customer_id:session.user.id,merchant_id:merchantId,address_id:selectedAddress.id,status:'pending',
      delivery_mode:merchant?.delivery_mode||'guti',subtotal:group.subtotal,delivery_fee:45,discount:0,total:group.total,
      payment_method:paymentMethod,payment_status:'pending',notes:checkoutNotes
    }).select().single()
    if(oerr){setCheckoutBusy(false);setMessage(oerr.message);return}
    const items=group.items.map(x=>({order_id:order.id,product_id:x.id,product_name:x.name,unit_price:Number(x.price),quantity:x.qty,line_total:Number(x.price)*x.qty,selected_options:x.selected_options||[]}))
    const {error:ierr}=await supabase.from('order_items').insert(items)
    if(ierr){setCheckoutBusy(false);setMessage(ierr.message);return}
    setCart(prev=>prev.filter(x=>x.merchant_id!==merchantId));setCheckoutNotes('');setCheckoutMerchantId(null);setShowCheckout(false);setCheckoutBusy(false)
    await Promise.all([loadActiveOrders(session.user.id),loadOrderHistory(session.user.id)])
    setTrackingOrderId(order.id);setTab('home');setShowTracking(true)
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
    return <div className="modal-backdrop address-backdrop" onClick={()=>setShowAddressPicker(false)}>
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
          <div><small className="eyebrow">TUS PEDIDOS</small><h2>Carrito</h2></div>
          <button className="cart-close" onClick={()=>setShowCart(false)}><X/></button>
        </div>

        {!cart.length?<div className="empty-state cart-empty">
          <span className="empty-icon"><ShoppingCart/></span><h3>Tu carrito está vacío</h3>
          <p>Explora los negocios de Guti y agrega algo que se te antoje.</p>
          <button className="primary-wide" onClick={()=>setShowCart(false)}>Explorar</button>
        </div>:<>
          <p className="multi-cart-note">{cartGroups.length>1
            ? `Tienes productos de ${cartGroups.length} negocios. Cada negocio se confirma como un pedido separado.`
            : 'Revisa tu pedido antes de confirmarlo.'}</p>

          <div className="merchant-cart-groups">
            {cartGroups.map(group=><section className="merchant-cart-section" key={group.merchantId}>
              <header>
                <span className="merchant-cart-logo">
                  {group.merchant?.logo_url?<img src={group.merchant.logo_url} alt=""/>:<Store/>}
                </span>
                <div><small>TU CARRITO DE</small><h3>{group.merchant?.name||'Negocio'}</h3><em>Envío $45</em></div>
                <strong>${group.total.toFixed(2)}</strong>
              </header>

              <div className="cart-items">
                {group.items.map(i=><article className="cart-item-v2" key={i.cart_key}>
                  <div className="cart-item-copy">
                    <b>{i.name}</b>
                    {(i.selected_options||[]).length>0&&<div className="selected-options-mini">
                      {i.selected_options.map((o,idx)=><span key={idx}>{o.group_name}: <b>{o.option_name}</b>{Number(o.extra_price)>0?` +$${Number(o.extra_price).toFixed(2)}`:''}</span>)}
                    </div>}
                    {i.item_notes&&<em>Nota: {i.item_notes}</em>}
                    <small>${Number(i.price).toFixed(2)} c/u</small>
                    <strong>${(Number(i.price)*i.qty).toFixed(2)}</strong>
                  </div>
                  <div className="qty-control">
                    <button onClick={()=>changeQty(i.cart_key,-1)}><Minus/></button><b>{i.qty}</b><button onClick={()=>changeQty(i.cart_key,1)}><Plus/></button>
                  </div>
                  <button className="trash-btn" onClick={()=>removeItem(i.cart_key)}><Trash2/></button>
                </article>)}
              </div>

              <div className="merchant-cart-totals">
                <div><span>Subtotal</span><b>${group.subtotal.toFixed(2)}</b></div>
                <div><span>Envío fijo</span><b>$45.00</b></div>
              </div>

              <button className="checkout-button" onClick={()=>beginCheckout(group.merchantId)}>
                <span><ShoppingCart/> Pedir en {group.merchant?.name||'este negocio'}</span>
                <b>${group.total.toFixed(2)}</b>
              </button>
            </section>)}
          </div>

          <button className="checkout-address" onClick={()=>{setShowCart(false);setShowAddressPicker(true)}}>
            <span className="checkout-address-icon"><MapPin/></span>
            <span><small>Dirección para los pedidos</small><b>{selectedAddress?.label||'Agregar dirección'}</b><em>{selectedAddress?.formatted_address||'Selecciona dónde recibirás tu pedido'}</em></span>
            <ChevronRight/>
          </button>

          <textarea className="cart-notes" rows="2" placeholder="Nota general para el pedido que confirmes" value={checkoutNotes} onChange={e=>setCheckoutNotes(e.target.value)}/>
          <button className="clear-cart-link" onClick={clearCart}>Vaciar todos los carritos</button>
        </>}
      </aside>
    </div>
  }


  function ProductCustomizationModal(){
    if(!customizingProduct)return null
    const extras=customGroups.reduce((sum,g)=>{
      const ids=customSelections[g.id]||[]
      return sum+(g.product_options||[]).filter(o=>ids.includes(o.id)).reduce((s,o)=>s+Number(o.extra_price||0),0)
    },0)
    const unit=Number(customizingProduct.price)+extras
    const totalCustom=unit*customQty

    return <div className="modal-backdrop" onClick={()=>setCustomizingProduct(null)}>
      <section className="customer-custom-modal" onClick={e=>e.stopPropagation()}>
        <header>
          <div><small>PERSONALIZA TU PEDIDO</small><h2>{customizingProduct.name}</h2></div>
          <button onClick={()=>setCustomizingProduct(null)}><X/></button>
        </header>

        <div className="custom-product-summary">
          <div className="custom-product-image">{customizingProduct.image_url?<img src={customizingProduct.image_url} alt=""/>:<UtensilsCrossed/>}</div>
          <div><p>{customizingProduct.description||'Personaliza este producto a tu gusto.'}</p><b>Desde ${Number(customizingProduct.price).toFixed(2)}</b></div>
        </div>

        <div className="custom-groups">
          {customGroups.map(group=>{
            const selectedIds=customSelections[group.id]||[]
            return <section className="custom-group" key={group.id}>
              <div className="custom-group-head">
                <div><h3>{group.name}</h3><p>{Number(group.min_select||0)>0?'Obligatorio':'Opcional'} · Elige {group.max_select>1?`hasta ${group.max_select}`:'1'}</p></div>
                {Number(group.min_select||0)>0&&<span>REQUERIDO</span>}
              </div>
              <div className="custom-options">
                {(group.product_options||[]).map(opt=>{
                  const active=selectedIds.includes(opt.id)
                  return <button className={active?'selected':''} key={opt.id} onClick={()=>toggleCustomOption(group,opt)}>
                    <span className="choice-circle">{active?<Check/>:null}</span>
                    <b>{opt.name}</b>
                    <em>{Number(opt.extra_price)>0?`+$${Number(opt.extra_price).toFixed(2)}`:'Incluido'}</em>
                  </button>
                })}
              </div>
            </section>
          })}
        </div>

        <div className="custom-notes">
          <label>Nota para este producto</label>
          <textarea rows="2" placeholder="Ej. Sin cebolla, bien tostado..." value={customNotes} onChange={e=>setCustomNotes(e.target.value)}/>
        </div>

        <footer className="custom-footer">
          <div className="custom-qty">
            <button onClick={()=>setCustomQty(q=>Math.max(1,q-1))}><Minus/></button>
            <b>{customQty}</b>
            <button onClick={()=>setCustomQty(q=>q+1)}><Plus/></button>
          </div>
          <button className="custom-add-button" onClick={confirmCustomization}>
            <span>Agregar al carrito</span><b>${totalCustom.toFixed(2)}</b>
          </button>
        </footer>
      </section>
    </div>
  }

  function CheckoutModal(){
    if(!showCheckout)return null
    const group=cartGroups.find(g=>g.merchantId===checkoutMerchantId)
    if(!group)return null
    const merchant=group.merchant
    const methods=[
      {id:'cash',label:'Efectivo',desc:'Paga al recibir tu pedido',icon:'💵'},
      {id:'transfer',label:'Transferencia',desc:'Pago por transferencia',icon:'🏦'},
      {id:'card',label:'Tarjeta',desc:'Crédito o débito con Clip',icon:'💳'},
      {id:'guti_balance',label:'Guti Balance',desc:`Saldo: $${Number(profile?.guti_balance||0).toFixed(2)}`,icon:'🧡',coming:Number(profile?.guti_balance||0)<group.total}
    ]
    return <div className="checkout-backdrop" onClick={()=>setShowCheckout(false)}>
      <section className="checkout-modal" onClick={e=>e.stopPropagation()}>
        <header className="checkout-top">
          <button onClick={()=>setShowCheckout(false)}><X/></button>
          <div><small>FINALIZAR PEDIDO</small><h2>{merchant?.name||'Tu pedido'}</h2></div>
          <span>{checkoutStep}/3</span>
        </header>
        <div className="checkout-progress">{[1,2,3].map(n=><span key={n} className={checkoutStep>=n?'active':''}/>)}</div>

        {checkoutStep===1&&<section className="checkout-step">
          <div className="checkout-step-title"><span><MapPin/></span><div><small>PASO 1</small><h3>¿Dónde lo entregamos?</h3><p>Selecciona una dirección guardada.</p></div></div>
          {selectedAddress?<button className="checkout-selected-address" onClick={()=>setShowAddressPicker(true)}>
            <span><MapPin/></span><div><b>{selectedAddress.label||'Dirección'}</b><small>{selectedAddress.formatted_address}</small></div><ChevronRight/>
          </button>:<button className="checkout-add-address" onClick={()=>setShowAddressPicker(true)}><Plus/>Agregar dirección</button>}
          <button className="checkout-next" disabled={!selectedAddress} onClick={()=>setCheckoutStep(2)}>Continuar <ArrowRight/></button>
        </section>}

        {checkoutStep===2&&<section className="checkout-step">
          <div className="checkout-step-title"><span><WalletCards/></span><div><small>PASO 2</small><h3>Método de pago</h3><p>Elige cómo quieres pagar.</p></div></div>
          <div className="payment-methods">
            {methods.map(m=><button key={m.id} disabled={m.id==='card'?false:!!m.coming} className={paymentMethod===m.id?'selected':''} onClick={()=>{setPaymentMethod(m.id);if(m.id!=='card'){setCardToken(null);setCardReady(false);setCardError('')}}}>
              <span className="payment-emoji">{m.icon}</span>
              <div><b>{m.label}</b><small>{m.desc}</small></div>
              {m.coming?<em>{m.id==='guti_balance'?'SIN SALDO':'PRÓXIMAMENTE'}</em>:<span className="payment-check">{paymentMethod===m.id?<Check/>:null}</span>}
            </button>)}
          </div>
          {paymentMethod==='card'&&<section className="clip-dedicated-choice">
            <div className="clip-dedicated-icon">💳</div>
            <div><b>Pago seguro con Clip</b><small>La tarjeta se captura en una pantalla dedicada y segura.</small></div>
            <button type="button" onClick={goToClipCardPayment}>Continuar con Clip <ArrowRight/></button>
          </section>} 
          <div className="checkout-nav-buttons">
            <button className="checkout-back" onClick={()=>setCheckoutStep(1)}><ArrowLeft/>Atrás</button>
            {paymentMethod==='card'
              ? <button className="checkout-next" onClick={goToClipCardPayment}>Continuar con Clip <ArrowRight/></button>
              : <button className="checkout-next" onClick={()=>setCheckoutStep(3)}>Revisar pedido <ArrowRight/></button>}
          </div>
        </section>}

        {checkoutStep===3&&<section className="checkout-step">
          <div className="checkout-step-title"><span><ReceiptText/></span><div><small>PASO 3</small><h3>Revisa y confirma</h3><p>Comprueba que todo esté correcto.</p></div></div>
          <div className="checkout-review-card">
            <div className="checkout-review-head">
              <span className="merchant-cart-logo">{merchant?.logo_url?<img src={merchant.logo_url} alt=""/>:<Store/>}</span>
              <div><small>PEDIDO EN</small><b>{merchant?.name||'Negocio'}</b></div>
              <strong>${group.total.toFixed(2)}</strong>
            </div>
            <div className="checkout-review-items">
              {group.items.map(i=><div key={i.cart_key}>
                <span>{i.qty}×</span>
                <div><b>{i.name}</b>{(i.selected_options||[]).map((o,idx)=><small key={idx}>{o.option_name}{Number(o.extra_price)>0?` +$${Number(o.extra_price).toFixed(2)}`:''}</small>)}</div>
                <strong>${(Number(i.price)*i.qty).toFixed(2)}</strong>
              </div>)}
            </div>
            <div className="checkout-review-line"><span>Dirección</span><b>{selectedAddress?.label} · {selectedAddress?.formatted_address}</b></div>
            <div className="checkout-review-line"><span>Pago</span><b>{paymentMethod==='card'?'Tarjeta · Clip seguro':methods.find(m=>m.id===paymentMethod)?.label}</b></div>
            <div className="checkout-review-line"><span>Subtotal</span><b>${group.subtotal.toFixed(2)}</b></div>
            <div className="checkout-review-line"><span>Envío</span><b>$45.00</b></div>
            <div className="checkout-review-line total"><span>Total</span><b>${group.total.toFixed(2)}</b></div>
          </div>

          <label className="checkout-note-label">Nota general</label>
          <textarea className="checkout-final-note" rows="2" placeholder="Instrucciones para el negocio (opcional)" value={checkoutNotes} onChange={e=>setCheckoutNotes(e.target.value)}/>

          <div className="checkout-nav-buttons">
            <button className="checkout-back" onClick={()=>setCheckoutStep(2)}><ArrowLeft/>Atrás</button>
            <button className="checkout-confirm" disabled={checkoutBusy} onClick={createOrderFromCheckout}>
              {checkoutBusy?'Enviando pedido...':<>Confirmar pedido <b>${group.total.toFixed(2)}</b></>}
            </button>
          </div>
        </section>}
        {message&&<div className="checkout-message">{message}</div>}
      </section>
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
      ['orders','Pedidos',ReceiptText],
      ['favorites','Favoritos',Heart],
      ['profile','Perfil',UserRound]
    ]
    return <nav className="bottom-nav-v3">
      {items.map(([key,label,Icon])=><button className={tab===key?'active':''} key={key} onClick={()=>{setSelectedMerchant(null);setTab(key)}}>
        <Icon/><span>{label}</span>
        {key==='orders'&&activeOrders.length>0&&<i>{activeOrders.length}</i>}
      </button>)}
    </nav>
  }


  function Header(){
    return <header className="home-header-v3">
      <button className="address-header-v3" onClick={()=>setShowAddressPicker(true)}>
        <MapPin/>
        <div>
          <b>{selectedAddress?.label||'Gutiérrez Zamora, Ver.'}</b>
          <small>{selectedAddress?.formatted_address||'Selecciona tu dirección'}</small>
        </div>
        <ChevronDown/>
      </button>
      <div className="header-actions-v3">
        <button className="support-btn-v36" onClick={openSupport} title="Soporte Guti"><Headphones/><span>Soporte</span></button>
        <button className="cart-btn-v3" onClick={()=>setShowCart(true)}>
          <ShoppingCart/>
          {cartCount>0&&<span>{cartCount}</span>}
        </button>
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

  function MerchantCard({m,compact=false}){
    const fav=favoriteIds.includes(m.id)
    return <article className={compact?'merchant-card-v3 compact':'merchant-card-v3'}>
      <button className="merchant-card-main" onClick={()=>openMerchant(m)}>
        <div className="merchant-image-v3">
          {m.cover_url?<img src={m.cover_url} alt={m.name}/>:<Store/>}
          <span className="merchant-delivery-badge">{m.delivery_mode==='merchant'?'Reparto propio':'Entrega Guti'}</span>
        </div>
        <div className="merchant-copy-v3">
          <h3>{m.name}</h3>
          <p>{m.description||'Negocio local'}</p>
          <div><span><Star/> 4.8</span><span><Clock3/> 25–40 min</span></div>
        </div>
      </button>
      <button className={fav?'favorite-heart active':'favorite-heart'} onClick={()=>toggleFavorite(m.id)}><Heart/></button>
    </article>
  }


  function HomeView(){
    const promoMerchant=merchants.find(m=>m.cover_url)||merchants[0]
    return <>
      <Header/>

      <section className="brand-hero-v3">
        <img src="/brand/guti-logo.svg" alt="Guti Delivery"/>
        <p>Lo que necesites, te lo llevamos.</p>
      </section>

      <div className="search-v3">
        <Search/>
        <input placeholder="¿Qué quieres pedir hoy?" value={query} onChange={e=>setQuery(e.target.value)}/>
      </div>

      <section className="category-grid-v3">
        {categoryDefs.map(c=><button key={c.key} onClick={()=>{
          if(c.coming){setMessage(`${c.label} estará disponible muy pronto.`);return}
          setCategory(c.key)
          if(c.key==='all') setTab('explore')
          else setTab('explore')
        }}>
          <span><img src={c.image} alt=""/></span>
          <b>{c.label}</b>
          {c.coming&&<em>Pronto</em>}
        </button>)}
      </section>

      <OrderCarousel/>

      <section className="promo-carousel-v31">
        <div className="promo-track-v31" style={{transform:`translateX(-${promoIndex*100}%)`}}>
          <article className="promo-slide-v31 promo-food-v31" onClick={()=>promoMerchant&&openMerchant(promoMerchant)}>
            {promoMerchant?.cover_url&&<img src={promoMerchant.cover_url} alt=""/>}
            <div className="promo-overlay-v3"/>
            <div className="promo-content-v3">
              <small>PROMO GUTI</small>
              <h2>Antojo resuelto en minutos</h2>
              <p>Pide local y recíbelo sin complicaciones.</p>
              <button>Ver promoción <ArrowRight/></button>
            </div>
          </article>
          <article className="promo-slide-v31 points-slide-v31">
            <div className="points-art-v31"><Gift/></div>
            <div className="points-copy-v31">
              <small>GUTI PUNTOS</small>
              <h2>Pide local. Gana recompensas.</h2>
              <p>Acumula puntos con tus pedidos y úsalos después en Guti.mx.</p>
              <button onClick={()=>setTab('profile')}>Ver mis puntos <ArrowRight/></button>
            </div>
          </article>
        </div>
        <div className="promo-dots-v31">
          {[0,1].map(i=><button aria-label={`Ir a promo ${i+1}`} key={i} className={promoIndex===i?'active':''} onClick={()=>setPromoIndex(i)}/>)}
        </div>
      </section>

      <section className="home-section-v3">
        <div className="home-section-head-v3">
          <h2>Restaurantes cerca de ti</h2>
          <button onClick={()=>{setCategory('food');setTab('explore')}}>Ver todos</button>
        </div>
        <div className="nearby-scroll-v3">
          {merchants.filter(m=>m.merchant_type==='restaurant').slice(0,6).map(m=><MerchantCard key={m.id} m={m} compact/>)}
        </div>
      </section>

      <section className="home-section-v3">
        <div className="home-section-head-v3">
          <h2>También puedes pedir</h2>
          <button onClick={()=>{setCategory('super');setTab('explore')}}>Ver todos</button>
        </div>
        <div className="merchant-grid-v3">
          {merchants.filter(m=>m.merchant_type!=='restaurant').slice(0,4).map(m=><MerchantCard key={m.id} m={m}/>)}
        </div>
      </section>

      {message&&<div className="toast-message">{message}<button onClick={()=>setMessage('')}><X/></button></div>}
    </>
  }


  function ExploreView(){
    return <>
      <Header/>
      <div className="explore-top-v31">
        <button className="explore-back-v31" onClick={()=>{setQuery('');setCategory('all');setTab('home')}}><ArrowLeft/></button>
        <div className="page-heading explore-heading-v31">
          <small>{category==='food'?'RESTAURANTES':category==='super'?'SÚPER Y TIENDAS':'DESCUBRE'}</small>
          <h1>{category==='food'?'Comida':category==='super'?'Súper':'Explorar'}</h1>
          <p>{category==='food'?'Restaurantes y comida disponible en Gutiérrez Zamora.':'Negocios disponibles en Gutiérrez Zamora.'}</p>
        </div>
      </div>

      <div className="search-v3 explore-search-v31">
        <Search/>
        <input placeholder={category==='food'?'Buscar restaurante o comida...':'Buscar negocio...'} value={query} onChange={e=>setQuery(e.target.value)}/>
        {query&&<button className="clear-search-v31" onClick={()=>setQuery('')}><X/></button>}
      </div>

      <div className="filter-row">
        <button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>Todos</button>
        <button className={category==='food'?'active':''} onClick={()=>setCategory('food')}>Comida</button>
        <button className={category==='super'?'active':''} onClick={()=>setCategory('super')}>Súper y tiendas</button>
      </div>

      <div className="merchant-grid-v3 explore-grid">
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

  function FavoritesView(){
    const favorites=merchants.filter(m=>favoriteIds.includes(m.id))
    return <>
      <Header/>
      <div className="page-heading"><small>TUS GUARDADOS</small><h1>Favoritos</h1><p>Accede rápido a los negocios que más te gustan.</p></div>
      {favorites.length?<div className="merchant-grid-v3 favorites-grid-v3">{favorites.map(m=><MerchantCard key={m.id} m={m}/>)}</div>
      :<div className="login-required"><span><Heart/></span><h1>Aún no tienes favoritos</h1><p>Toca el corazón de cualquier negocio para guardarlo aquí.</p><button className="primary-wide" onClick={()=>setTab('home')}>Explorar negocios</button></div>}
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
        <button onClick={async()=>{const code=profile?.referral_code||'';if(code){await navigator.clipboard?.writeText(code);setMessage(`Código ${code} copiado. Compártelo con tus amigos.`)}else setMessage('Tu código de referido se está preparando.')}}><span><Gift/></span><div><b>Invitar y ganar</b><small>{profile?.referral_code?`Tu código: ${profile.referral_code}`:'Referidos Guti · gana 100 puntos'}</small></div><ChevronRight/></button>
        <button onClick={enableClientNotifications}><span><Headphones/></span><div><b>Avisos de mis pedidos</b><small>Activa notificaciones del navegador</small></div><ChevronRight/></button>
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

    const categorySections=categories.map(cat=>({
      ...cat,
      products:products.filter(p=>p.category_id===cat.id)
    })).filter(cat=>cat.products.length)

    const uncategorized=products.filter(p=>!p.category_id || !categories.some(c=>c.id===p.category_id))

    const priceInfo=p=>{
      const regular=Number(p.regular_price??p.price)
      const current=Number(p.price)
      const promo=Number.isFinite(regular)&&Number.isFinite(current)&&current<regular
      return {regular,current,promo}
    }

    const ProductCard=({p})=>{
      const pricing=priceInfo(p)
      return <article className="merchant-product-card-v341">
        <div className="merchant-product-copy-v341">
          <h3>{p.name}</h3>
          <p>{p.description||'Disponible para pedir en Guti.mx'}</p>
          <div className="merchant-product-price-v341">
            {pricing.promo
              ? <><strong>${pricing.current.toFixed(2)}</strong><del>${pricing.regular.toFixed(2)}</del><span>OFERTA</span></>
              : <strong>${pricing.current.toFixed(2)}</strong>}
          </div>
        </div>
        <div className="merchant-product-image-v341">
          {p.image_url?<img src={p.image_url} alt={p.name}/>:<UtensilsCrossed/>}
          <button onClick={()=>add(p)}><Plus/></button>
        </div>
      </article>
    }

    return <main className="client-app merchant-page-v2">
      <div className="merchant-topbar">
        <button onClick={()=>setSelectedMerchant(null)}><ArrowLeft/></button>
        <b>{m.name}</b>
        <button className="cart-button-v2" onClick={()=>setShowCart(true)}><ShoppingCart/>{cartCount>0&&<span>{cartCount}</span>}</button>
      </div>

      <section className="merchant-hero-v2">
        {m.cover_url?<img src={m.cover_url} alt={m.name}/>:<span><Store/></span>}
        <div className="merchant-hero-overlay"/>
        <div className="merchant-hero-copy">
          <small>GUTI.MX</small><h1>{m.name}</h1><p>{m.description||'Negocio local'}</p>
          <div><span><Star/> 4.8</span><span><Clock3/> 25–40 min</span><span><Bike/> $45 envío</span></div>
        </div>
      </section>

      <section className="merchant-products-v341">
        <div className="section-title"><div><small>MENÚ</small><h2>Productos</h2></div></div>

        {merchantLoading&&<div className="loading-card">Cargando productos...</div>}
        {!merchantLoading&&!products.length&&<div className="empty-state"><Store/><h3>Aún no hay productos</h3><p>Este negocio todavía está preparando su catálogo.</p></div>}

        {!merchantLoading&&categorySections.map(cat=><section className="merchant-category-section-v341" key={cat.id}>
          <div className="merchant-category-heading-v341"><h2>{cat.name}</h2><span>{cat.products.length}</span></div>
          <div className="merchant-products-list-v341">{cat.products.map(p=><ProductCard key={p.id} p={p}/>)}</div>
        </section>)}

        {!merchantLoading&&uncategorized.length>0&&<section className="merchant-category-section-v341">
          <div className="merchant-category-heading-v341"><h2>Otros</h2><span>{uncategorized.length}</span></div>
          <div className="merchant-products-list-v341">{uncategorized.map(p=><ProductCard key={p.id} p={p}/>)}</div>
        </section>}
      </section>

      {cartCount>0&&<button className="floating-cart-bar" onClick={()=>setShowCart(true)}><span><ShoppingCart/><b>{cartCount} {cartCount===1?'artículo':'artículos'}</b></span><strong>${total.toFixed(2)}</strong></button>}
      {message&&<div className="toast-message">{message}<button onClick={()=>setMessage('')}><X/></button></div>}
      {CartDrawer()}{CheckoutModal()}{ProductCustomizationModal()}{AuthModal()}{AddressModal()}
    </main>
  }

  if(showTracking&&(activeOrder||deliveredSuccess))return <CurrentOrderView/>
  if(selectedMerchant)return <MerchantView/>

  return <main className="client-app">
    <div className="client-content">
      {tab==='home'&&HomeView()}
      {tab==='explore'&&ExploreView()}
      {tab==='orders'&&OrdersView()}
      {tab==='favorites'&&FavoritesView()}
      {tab==='profile'&&ProfileView()}
    </div>
    <BottomNav/>
    {CartDrawer()}{CheckoutModal()}{ProductCustomizationModal()}{AuthModal()}{AddressModal()}
  </main>
}


function CardPaymentBox({onToken,onReset,error}){
  const [loading,setLoading]=useState(true)
  const [tokenizing,setTokenizing]=useState(false)
  const [localError,setLocalError]=useState('')
  const [secured,setSecured]=useState(false)
  const [diagnostics,setDiagnostics]=useState({
    sdkScript:false,sdkGlobal:false,apiKey:false,apiKeyPrefix:'',
    cardCreated:false,mounted:false,mountNode:false,origin:'',
    iframeCount:0,lastError:''
  })
  const cardRef=useRef(null)
  const observerRef=useRef(null)

  useEffect(()=>{
    let cancelled=false
    const origin=typeof window!=='undefined'?window.location.origin:''
    setDiagnostics(d=>({...d,origin}))

    async function init(){
      try{
        setLoading(true)
        setLocalError('')

        const mountNode=document.getElementById('clip-card-checkout')
        setDiagnostics(d=>({...d,mountNode:!!mountNode}))
        if(!mountNode)throw new Error('No existe el contenedor #clip-card-checkout.')

        const configRes=await fetch('/api/clip/config',{cache:'no-store'})
        const config=await configRes.json()
        if(!configRes.ok||!config.apiKey)throw new Error(config.message||'Clip no está configurado.')

        setDiagnostics(d=>({...d,apiKey:true,apiKeyPrefix:String(config.apiKey).slice(0,9)}))

        if(!window.ClipSDK){
          await new Promise((resolve,reject)=>{
            const existing=document.querySelector('script[data-clip-sdk="true"]')
            if(existing){
              setDiagnostics(d=>({...d,sdkScript:true}))
              if(window.ClipSDK)return resolve()
              existing.addEventListener('load',resolve,{once:true})
              existing.addEventListener('error',()=>reject(new Error('No se pudo descargar clip-sdk.js.')),{once:true})
              return
            }
            const script=document.createElement('script')
            script.src='https://sdk.clip.mx/js/clip-sdk.js'
            script.async=true
            script.dataset.clipSdk='true'
            script.onload=()=>{setDiagnostics(d=>({...d,sdkScript:true}));resolve()}
            script.onerror=()=>reject(new Error('No se pudo descargar https://sdk.clip.mx/js/clip-sdk.js'))
            document.head.appendChild(script)
          })
        }else{
          setDiagnostics(d=>({...d,sdkScript:true}))
        }

        if(cancelled)return
        if(!window.ClipSDK)throw new Error('clip-sdk.js cargó, pero window.ClipSDK no existe.')
        setDiagnostics(d=>({...d,sdkGlobal:true}))

        const clip=new window.ClipSDK(config.apiKey)
        const card=clip.element.create("Card",{theme:"light",locale:"es"})
        setDiagnostics(d=>({...d,cardCreated:true}))

        card.mount("clip-card-checkout")
        cardRef.current=card
        setDiagnostics(d=>({...d,mounted:true}))

        observerRef.current=new MutationObserver(()=>{
          setDiagnostics(d=>({...d,iframeCount:mountNode.querySelectorAll('iframe').length}))
        })
        observerRef.current.observe(mountNode,{childList:true,subtree:true})

        setTimeout(()=>{
          if(cancelled)return
          setDiagnostics(d=>({...d,iframeCount:mountNode.querySelectorAll('iframe').length}))
        },1200)

        setLoading(false)
      }catch(err){
        const message=err?.message||String(err)||'Error desconocido iniciando Clip.'
        console.error('[Guti Clip SDK]',err)
        if(!cancelled){
          setLoading(false)
          setLocalError(message)
          setDiagnostics(d=>({...d,lastError:message}))
        }
      }
    }

    init()
    return ()=>{
      cancelled=true
      observerRef.current?.disconnect?.()
      observerRef.current=null
      cardRef.current=null
    }
  },[])

  async function tokenize(){
    if(!cardRef.current){
      setLocalError('El elemento Card de Clip todavía no está disponible.')
      return
    }
    try{
      setTokenizing(true)
      setLocalError('')
      onReset?.()
      const token=await cardRef.current.cardToken()
      if(!token?.id)throw new Error('Clip no devolvió un Card Token ID.')
      onToken(token.id)
      setSecured(true)
    }catch(err){
      const message=err?.message||'Revisa los datos de la tarjeta.'
      console.error('[Guti Clip cardToken]',err)
      setSecured(false)
      setLocalError(message)
      setDiagnostics(d=>({...d,lastError:`${err?.code?err.code+': ':''}${message}`}))
    }finally{
      setTokenizing(false)
    }
  }

  return <section className="clip-card-box">
    <div className="clip-card-head">
      <div><span>💳</span><div><b>Pago seguro con Clip</b><small>Clip captura los datos sensibles de tu tarjeta.</small></div></div>
      <span className="clip-secure-badge">SANDBOX</span>
    </div>

    {loading&&<div className="clip-loading">Inicializando Checkout Transparente de Clip...</div>}
    <div id="clip-card-checkout" className="clip-iframe-wrap"/>

    {secured
      ? <div className="clip-token-ok"><Check/><div><b>Tarjeta lista para cobrar</b><small>Token temporal de un solo uso.</small></div><button type="button" onClick={()=>{setSecured(false);onReset?.()}}>Cambiar</button></div>
      : <button type="button" className="clip-tokenize-btn" disabled={loading||tokenizing||!diagnostics.mounted} onClick={tokenize}>{tokenizing?'Generando token...':'Usar esta tarjeta'}</button>
    }

    {(localError||error)&&<div className="clip-error"><X/>{localError||error}</div>}

    <button type="button" className="clip-dedicated-test" onClick={()=>window.open('/pago/tarjeta','_blank','noopener,noreferrer')}>
      Abrir prueba aislada de Clip
    </button>

    <details className="clip-diagnostics" open>
      <summary>Diagnóstico Clip</summary>
      <div className="clip-diag-grid">
        <span>Origen</span><b>{diagnostics.origin||'—'}</b>
        <span>API Key</span><b>{diagnostics.apiKey?`${diagnostics.apiKeyPrefix}••••`:'No detectada'}</b>
        <span>Script SDK</span><b>{diagnostics.sdkScript?'Sí':'No'}</b>
        <span>window.ClipSDK</span><b>{diagnostics.sdkGlobal?'Sí':'No'}</b>
        <span>Card creado</span><b>{diagnostics.cardCreated?'Sí':'No'}</b>
        <span>Contenedor</span><b>{diagnostics.mountNode?'Sí':'No'}</b>
        <span>Card montado</span><b>{diagnostics.mounted?'Sí':'No'}</b>
        <span>iframes Clip</span><b>{diagnostics.iframeCount}</b>
        <span>Último error</span><b>{diagnostics.lastError||'Ninguno'}</b>
      </div>
      <p>Si Clip sigue mostrando “This page couldn’t load”, mándame una captura donde se vea este panel completo.</p>
    </details>
  </section>
}

