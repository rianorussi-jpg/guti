'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard, ReceiptText, PackageSearch, Store, Clock3, Settings, LogOut,
  Plus, Search, Bell, ChevronRight, X, Check, Image as ImageIcon, Upload, Trash2,
  Pencil, Eye, EyeOff, GripVertical, UtensilsCrossed, DollarSign, TrendingUp,
  ShoppingBag, Bike, Users, Star, CalendarDays, Save, ToggleLeft, ToggleRight,
  Camera, MapPin, Phone, FileText, BadgePercent, AlertCircle, ChevronDown,
  CircleDollarSign, Boxes, Tag, ListPlus, CheckCircle2, XCircle, Loader2,
  RefreshCw, Menu, ArrowLeft, Copy, ExternalLink
} from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const statusMeta = {
  pending:{label:'Nuevo',tone:'orange'},
  accepted:{label:'Aceptado',tone:'blue'},
  preparing:{label:'Preparando',tone:'purple'},
  ready:{label:'Listo',tone:'green'},
  assigned:{label:'Repartidor asignado',tone:'blue'},
  picked_up:{label:'Recogido',tone:'blue'},
  on_the_way:{label:'En camino',tone:'green'},
  delivered:{label:'Entregado',tone:'gray'},
  cancelled:{label:'Cancelado',tone:'red'}
}

const dayNames = [
  ['monday','Lunes'],['tuesday','Martes'],['wednesday','Miércoles'],
  ['thursday','Jueves'],['friday','Viernes'],['saturday','Sábado'],['sunday','Domingo']
]

const emptyProduct = {
  id:null,name:'',description:'',price:'',category_id:'',image_url:'',
  is_available:true,sort_order:0
}

export default function Page(){
  const supabase=useMemo(()=>getSupabaseBrowserClient(),[])
  const [session,setSession]=useState(null)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [merchant,setMerchant]=useState(null)
  const [orders,setOrders]=useState([])
  const [products,setProducts]=useState([])
  const [categories,setCategories]=useState([])
  const [hours,setHours]=useState([])
  const [tab,setTab]=useState('dashboard')
  const [msg,setMsg]=useState('')
  const [busy,setBusy]=useState(false)
  const [search,setSearch]=useState('')
  const [orderFilter,setOrderFilter]=useState('active')
  const [selectedOrder,setSelectedOrder]=useState(null)
  const [orderItems,setOrderItems]=useState([])
  const [newOrderIds,setNewOrderIds]=useState([])
  const seenOrderIds=useRef(new Set())

  const [showProduct,setShowProduct]=useState(false)
  const [productForm,setProductForm]=useState(emptyProduct)
  const [productBusy,setProductBusy]=useState(false)
  const [optionGroups,setOptionGroups]=useState([])
  const [newCategory,setNewCategory]=useState('')

  const [merchantForm,setMerchantForm]=useState({
    name:'',description:'',phone:'',address:'',cover_url:'',logo_url:'',
    delivery_mode:'guti',accepts_orders:true
  })
  const [uploading,setUploading]=useState('')

  const [sidebarOpen,setSidebarOpen]=useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session)
      if(data.session)loadAll(data.session.user.id)
    })
    const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>{
      setSession(x)
      if(x)loadAll(x.user.id)
      else{setMerchant(null);setOrders([]);setProducts([])}
    })
    return()=>s.subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!merchant?.id||!session?.user?.id)return
    const channel=supabase
      .channel(`merchant-live-${merchant.id}`)
      .on('postgres_changes',{
        event:'INSERT',schema:'public',table:'orders',
        filter:`merchant_id=eq.${merchant.id}`
      },payload=>{
        setNewOrderIds(prev=>prev.includes(payload.new.id)?prev:[payload.new.id,...prev])
        loadOrders(merchant.id)
      })
      .on('postgres_changes',{
        event:'UPDATE',schema:'public',table:'orders',
        filter:`merchant_id=eq.${merchant.id}`
      },()=>loadOrders(merchant.id))
      .subscribe()

    const fallback=setInterval(()=>loadOrders(merchant.id),12000)
    return()=>{clearInterval(fallback);supabase.removeChannel(channel)}
  },[merchant?.id,session?.user?.id])

  async function loadAll(uid){
    setBusy(true);setMsg('')
    let {data:m,error:me}=await supabase.from('merchants').select('*').eq('owner_id',uid).maybeSingle()
    if(!m){
      const {data:staff}=await supabase.from('merchant_staff').select('merchant_id,merchants(*)').eq('user_id',uid).maybeSingle()
      m=staff?.merchants
    }
    if(me&&!m){setMsg(me.message);setBusy(false);return}
    if(!m){setMsg('Tu usuario todavía no está ligado a un negocio.');setBusy(false);return}

    setMerchant(m)
    setMerchantForm({
      name:m.name||'',description:m.description||'',phone:m.phone||'',address:m.address||'',
      cover_url:m.cover_url||'',logo_url:m.logo_url||'',delivery_mode:m.delivery_mode||'guti',
      accepts_orders:m.accepts_orders!==false
    })

    await Promise.all([
      loadOrders(m.id),loadProducts(m.id),loadCategories(m.id),loadHours(m.id)
    ])
    setBusy(false)
  }

  async function loadOrders(merchantId){
    const {data,error}=await supabase
      .from('orders')
      .select('*,profiles!orders_customer_id_fkey(full_name,phone),addresses(formatted_address,instructions)')
      .eq('merchant_id',merchantId)
      .order('created_at',{ascending:false})
      .limit(100)
    if(error){setMsg(error.message);return}
    const rows=data||[]
    if(seenOrderIds.current.size){
      const justNew=rows.filter(o=>!seenOrderIds.current.has(o.id)&&o.status==='pending').map(o=>o.id)
      if(justNew.length)setNewOrderIds(prev=>[...new Set([...justNew,...prev])])
    }
    seenOrderIds.current=new Set(rows.map(o=>o.id))
    setOrders(rows)
  }

  async function loadProducts(merchantId){
    const {data,error}=await supabase
      .from('products')
      .select('*,categories(name)')
      .eq('merchant_id',merchantId)
      .order('sort_order')
      .order('created_at',{ascending:false})
    if(error){setMsg(error.message);return}
    setProducts(data||[])
  }

  async function loadCategories(merchantId){
    const {data,error}=await supabase.from('categories').select('*').eq('merchant_id',merchantId).order('sort_order').order('name')
    if(error){setMsg(error.message);return}
    setCategories(data||[])
  }

  async function loadHours(merchantId){
    const {data,error}=await supabase.from('merchant_hours').select('*').eq('merchant_id',merchantId)
    if(error){
      if(!String(error.message).includes('merchant_hours'))setMsg(error.message)
      return
    }
    const map=new Map((data||[]).map(x=>[x.day_of_week,x]))
    setHours(dayNames.map(([key,label],i)=>map.get(i)||{
      merchant_id:merchantId,day_of_week:i,day_key:key,day_label:label,
      is_closed:i===6,open_time:'09:00',close_time:'21:00'
    }))
  }

  async function login(e){
    e.preventDefault();setMsg('');setBusy(true)
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setBusy(false)
    if(error)setMsg(error.message)
  }

  async function signOut(){await supabase.auth.signOut()}

  async function status(order,status){
    setMsg('')
    const {error}=await supabase.rpc('merchant_set_order_status',{p_order_id:order.id,p_status:status})
    if(error)return setMsg(error.message)
    setNewOrderIds(prev=>prev.filter(id=>id!==order.id))
    await loadOrders(merchant.id)
    if(selectedOrder?.id===order.id)setSelectedOrder(prev=>({...prev,status}))
  }

  async function openOrder(order){
    setSelectedOrder(order)
    setNewOrderIds(prev=>prev.filter(id=>id!==order.id))
    const {data,error}=await supabase.from('order_items').select('*').eq('order_id',order.id)
    if(error)return setMsg(error.message)
    setOrderItems(data||[])
  }

  async function openProduct(p=null){
    setMsg('')
    if(!p){
      setProductForm({...emptyProduct,category_id:categories[0]?.id||''})
      setOptionGroups([])
      setShowProduct(true)
      return
    }
    setProductForm({
      id:p.id,name:p.name||'',description:p.description||'',price:String(p.price??''),
      category_id:p.category_id||'',image_url:p.image_url||'',
      is_available:p.is_available!==false,sort_order:p.sort_order||0
    })
    const {data:groups}=await supabase
      .from('product_option_groups')
      .select('*,product_options(*)')
      .eq('product_id',p.id)
      .order('id')
    setOptionGroups((groups||[]).map(g=>({
      id:g.id,name:g.name,min_select:g.min_select,max_select:g.max_select,
      options:(g.product_options||[]).map(o=>({id:o.id,name:o.name,extra_price:Number(o.extra_price),is_available:o.is_available}))
    })))
    setShowProduct(true)
  }

  function updateOptionGroup(index,patch){
    setOptionGroups(prev=>prev.map((g,i)=>i===index?{...g,...patch}:g))
  }

  function addOptionGroup(){
    setOptionGroups(prev=>[...prev,{id:null,name:'Elige una opción',min_select:0,max_select:1,options:[]}])
  }

  function addOption(groupIndex){
    setOptionGroups(prev=>prev.map((g,i)=>i===groupIndex?{
      ...g,options:[...g.options,{id:null,name:'Nueva opción',extra_price:0,is_available:true}]
    }:g))
  }

  function updateOption(groupIndex,optionIndex,patch){
    setOptionGroups(prev=>prev.map((g,i)=>i===groupIndex?{
      ...g,options:g.options.map((o,j)=>j===optionIndex?{...o,...patch}:o)
    }:g))
  }

  function removeOption(groupIndex,optionIndex){
    setOptionGroups(prev=>prev.map((g,i)=>i===groupIndex?{
      ...g,options:g.options.filter((_,j)=>j!==optionIndex)
    }:g))
  }

  async function saveProduct(){
    if(!merchant)return
    if(!productForm.name.trim())return setMsg('Escribe el nombre del producto.')
    if(!productForm.price||Number(productForm.price)<0)return setMsg('Escribe un precio válido.')
    setProductBusy(true);setMsg('')
    const payload={
      merchant_id:merchant.id,
      category_id:productForm.category_id||null,
      name:productForm.name.trim(),
      description:productForm.description.trim(),
      price:Number(productForm.price),
      image_url:productForm.image_url||null,
      is_available:productForm.is_available,
      sort_order:Number(productForm.sort_order)||0
    }
    let productId=productForm.id
    if(productId){
      const {error}=await supabase.from('products').update(payload).eq('id',productId)
      if(error){setProductBusy(false);return setMsg(error.message)}
    }else{
      const {data,error}=await supabase.from('products').insert(payload).select().single()
      if(error){setProductBusy(false);return setMsg(error.message)}
      productId=data.id
    }

    // Rebuild modifiers for predictable editing.
    const {data:oldGroups}=await supabase.from('product_option_groups').select('id').eq('product_id',productId)
    const oldIds=(oldGroups||[]).map(x=>x.id)
    if(oldIds.length)await supabase.from('product_options').delete().in('group_id',oldIds)
    await supabase.from('product_option_groups').delete().eq('product_id',productId)

    for(const group of optionGroups){
      if(!group.name.trim())continue
      const {data:g,error:ge}=await supabase.from('product_option_groups').insert({
        product_id:productId,name:group.name.trim(),
        min_select:Number(group.min_select)||0,max_select:Math.max(1,Number(group.max_select)||1)
      }).select().single()
      if(ge){setProductBusy(false);return setMsg(ge.message)}
      const opts=group.options
        .filter(o=>o.name.trim())
        .map(o=>({group_id:g.id,name:o.name.trim(),extra_price:Number(o.extra_price)||0,is_available:o.is_available!==false}))
      if(opts.length){
        const {error:oe}=await supabase.from('product_options').insert(opts)
        if(oe){setProductBusy(false);return setMsg(oe.message)}
      }
    }

    setProductBusy(false);setShowProduct(false)
    await loadProducts(merchant.id)
  }

  async function toggleProduct(p){
    const {error}=await supabase.from('products').update({is_available:!p.is_available}).eq('id',p.id)
    if(error)return setMsg(error.message)
    await loadProducts(merchant.id)
  }

  async function deleteProduct(p){
    if(!confirm(`¿Eliminar "${p.name}"?`))return
    const {error}=await supabase.from('products').delete().eq('id',p.id)
    if(error)return setMsg(error.message)
    await loadProducts(merchant.id)
  }

  async function addCategory(){
    if(!newCategory.trim()||!merchant)return
    const {error}=await supabase.from('categories').insert({
      merchant_id:merchant.id,name:newCategory.trim(),sort_order:categories.length,is_active:true
    })
    if(error)return setMsg(error.message)
    setNewCategory('');await loadCategories(merchant.id)
  }

  async function deleteCategory(c){
    const {error}=await supabase.from('categories').delete().eq('id',c.id)
    if(error)return setMsg(error.message)
    await loadCategories(merchant.id);await loadProducts(merchant.id)
  }

  async function uploadMedia(file,type){
    if(!file||!merchant)return
    setUploading(type);setMsg('')
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase()
    const path=`${merchant.id}/${type}-${Date.now()}.${ext}`
    const {error}=await supabase.storage.from('merchant-media').upload(path,file,{upsert:false,contentType:file.type})
    if(error){setUploading('');return setMsg(error.message)}
    const {data}=supabase.storage.from('merchant-media').getPublicUrl(path)
    const url=data.publicUrl
    if(type==='product')setProductForm(prev=>({...prev,image_url:url}))
    else setMerchantForm(prev=>({...prev,[type==='cover'?'cover_url':'logo_url']:url}))
    setUploading('')
  }

  async function saveMerchant(){
    if(!merchant)return
    setBusy(true);setMsg('')
    const payload={
      name:merchantForm.name.trim(),
      description:merchantForm.description.trim(),
      phone:merchantForm.phone.trim(),
      address:merchantForm.address.trim(),
      cover_url:merchantForm.cover_url||null,
      logo_url:merchantForm.logo_url||null,
      delivery_mode:merchantForm.delivery_mode,
      accepts_orders:merchantForm.accepts_orders
    }
    const {data,error}=await supabase.from('merchants').update(payload).eq('id',merchant.id).select().single()
    setBusy(false)
    if(error)return setMsg(error.message)
    setMerchant(data);setMsg('Cambios guardados.')
  }

  async function saveHours(){
    if(!merchant)return
    setBusy(true);setMsg('')
    const payload=hours.map((h,i)=>({
      merchant_id:merchant.id,day_of_week:i,is_closed:!!h.is_closed,
      open_time:h.open_time||'09:00',close_time:h.close_time||'21:00'
    }))
    const {error}=await supabase.from('merchant_hours').upsert(payload,{onConflict:'merchant_id,day_of_week'})
    setBusy(false)
    if(error)return setMsg(error.message)
    setMsg('Horarios guardados.')
  }

  function updateHour(index,patch){setHours(prev=>prev.map((h,i)=>i===index?{...h,...patch}:h))}

  const todayStart=new Date();todayStart.setHours(0,0,0,0)
  const ordersToday=orders.filter(o=>new Date(o.created_at)>=todayStart)
  const deliveredToday=ordersToday.filter(o=>o.status==='delivered')
  const salesToday=deliveredToday.reduce((s,o)=>s+Number(o.subtotal||0),0)
  const pendingCount=orders.filter(o=>o.status==='pending').length
  const activeCount=orders.filter(o=>!['delivered','cancelled'].includes(o.status)).length

  const shownOrders=orders.filter(o=>{
    if(orderFilter==='active')return !['delivered','cancelled'].includes(o.status)
    if(orderFilter==='completed')return o.status==='delivered'
    if(orderFilter==='cancelled')return o.status==='cancelled'
    return true
  }).filter(o=>{
    const q=search.toLowerCase()
    return !q||o.id.toLowerCase().includes(q)||(o.profiles?.full_name||'').toLowerCase().includes(q)
  })

  const shownProducts=products.filter(p=>{
    const q=search.toLowerCase()
    return !q||p.name.toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q)
  })

  const nav=[
    ['dashboard','Resumen',LayoutDashboard],
    ['orders','Pedidos',ReceiptText],
    ['catalog','Catálogo',PackageSearch],
    ['appearance','Mi negocio',Store],
    ['hours','Horarios',Clock3],
    ['settings','Configuración',Settings]
  ]

  if(!session)return <main className="login-page">
    <section className="login-card">
      <div className="login-brand">Guti.mx <span>NEGOCIOS</span></div>
      <h1>Administra tu negocio</h1>
      <p>Pedidos, catálogo, horarios y tu presencia dentro de Guti.mx.</p>
      <form onSubmit={login}>
        <label>Correo</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="negocio@correo.com"/>
        <label>Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/>
        <button disabled={busy}>{busy?<Loader2 className="spin"/>:'Entrar a Guti Negocios'}</button>
      </form>
      {msg&&<div className="notice error"><AlertCircle/>{msg}</div>}
    </section>
  </main>

  return <main className="business-app">
    <aside className={`sidebar ${sidebarOpen?'open':''}`}>
      <div className="sidebar-brand">Guti.mx <span>NEGOCIOS</span></div>
      <div className="merchant-mini">
        <div className="merchant-mini-logo">
          {merchant?.logo_url?<img src={merchant.logo_url} alt=""/>:<Store/>}
        </div>
        <div><b>{merchant?.name||'Mi negocio'}</b><small>{merchant?.accepts_orders?'Recibiendo pedidos':'Pausado'}</small></div>
      </div>
      <nav>{nav.map(([key,label,Icon])=><button className={tab===key?'active':''} key={key} onClick={()=>{setTab(key);setSidebarOpen(false)}}>
        <Icon/><span>{label}</span>
        {key==='orders'&&pendingCount>0&&<i>{pendingCount}</i>}
      </button>)}</nav>
      <div className="sidebar-bottom">
        <button onClick={signOut}><LogOut/>Cerrar sesión</button>
      </div>
    </aside>

    <section className="business-main">
      <header className="business-topbar">
        <button className="mobile-menu" onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu/></button>
        <div className="topbar-title">
          <small>{merchant?.name}</small>
          <h1>{nav.find(x=>x[0]===tab)?.[1]}</h1>
        </div>
        <div className="topbar-actions">
          <button className={`order-live ${pendingCount?'has-new':''}`} onClick={()=>setTab('orders')}><Bell/>{pendingCount>0&&<span>{pendingCount}</span>}</button>
          <button className={`store-switch ${merchant?.accepts_orders?'on':'off'}`} onClick={async()=>{
            const next=!merchant.accepts_orders
            const {data,error}=await supabase.from('merchants').update({accepts_orders:next}).eq('id',merchant.id).select().single()
            if(error)return setMsg(error.message)
            setMerchant(data);setMerchantForm(prev=>({...prev,accepts_orders:next}))
          }}>
            {merchant?.accepts_orders?<ToggleRight/>:<ToggleLeft/>}
            <span>{merchant?.accepts_orders?'Abierto':'Pausado'}</span>
          </button>
        </div>
      </header>

      <div className="business-content">
        {msg&&<div className={`notice ${msg.includes('guardad')?'success':''}`}><AlertCircle/>{msg}<button onClick={()=>setMsg('')}><X/></button></div>}

        {tab==='dashboard'&&<>
          <section className="welcome-panel">
            <div><small>HOY EN GUTI</small><h2>Hola, {merchant?.name} 👋</h2><p>Todo lo importante de tu negocio, en un solo lugar.</p></div>
            <button onClick={()=>setTab('orders')}><ReceiptText/>Ver pedidos</button>
          </section>

          <div className="stats-grid">
            <article><span className="stat-icon orange"><ReceiptText/></span><div><small>Pedidos hoy</small><b>{ordersToday.length}</b><em>{pendingCount} nuevos</em></div></article>
            <article><span className="stat-icon green"><DollarSign/></span><div><small>Ventas entregadas</small><b>${salesToday.toFixed(0)}</b><em>Hoy</em></div></article>
            <article><span className="stat-icon blue"><ShoppingBag/></span><div><small>Pedidos activos</small><b>{activeCount}</b><em>En proceso</em></div></article>
            <article><span className="stat-icon purple"><Boxes/></span><div><small>Productos</small><b>{products.length}</b><em>{products.filter(p=>!p.is_available).length} agotados</em></div></article>
          </div>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-head"><div><small>PEDIDOS</small><h3>Pedidos recientes</h3></div><button onClick={()=>setTab('orders')}>Ver todos <ChevronRight/></button></div>
              <div className="compact-orders">
                {orders.slice(0,6).map(o=><button className={newOrderIds.includes(o.id)?'new':''} key={o.id} onClick={()=>openOrder(o)}>
                  <span className={`status-dot ${statusMeta[o.status]?.tone||'gray'}`}/>
                  <div><b>#{o.id.slice(0,8)} · {o.profiles?.full_name||'Cliente'}</b><small>{new Date(o.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</small></div>
                  <strong>${Number(o.total).toFixed(2)}</strong>
                  <span className={`status-pill ${statusMeta[o.status]?.tone||'gray'}`}>{statusMeta[o.status]?.label||o.status}</span>
                </button>)}
                {!orders.length&&<Empty icon={ReceiptText} title="Todavía no hay pedidos" text="Los nuevos pedidos aparecerán aquí en tiempo real."/>}
              </div>
            </section>

            <section className="panel quick-panel">
              <div className="panel-head"><div><small>ACCESOS RÁPIDOS</small><h3>Tu negocio</h3></div></div>
              <button onClick={()=>openProduct()}><span><Plus/></span><div><b>Agregar producto</b><small>Precio, foto, extras y variantes</small></div><ChevronRight/></button>
              <button onClick={()=>setTab('appearance')}><span><Camera/></span><div><b>Editar portada</b><small>Así te ven los clientes</small></div><ChevronRight/></button>
              <button onClick={()=>setTab('hours')}><span><Clock3/></span><div><b>Horarios</b><small>Configura cuándo recibes pedidos</small></div><ChevronRight/></button>
              <button onClick={()=>setTab('catalog')}><span><PackageSearch/></span><div><b>Administrar catálogo</b><small>{products.length} productos</small></div><ChevronRight/></button>
            </section>
          </div>
        </>}

        {tab==='orders'&&<>
          <section className="page-intro"><div><small>OPERACIÓN EN VIVO</small><h2>Pedidos</h2><p>Acepta, prepara y entrega pedidos sin refrescar la página.</p></div><button className="secondary-btn" onClick={()=>loadOrders(merchant.id)}><RefreshCw/>Actualizar</button></section>
          <div className="toolbar">
            <div className="segmented">
              {['active','completed','cancelled','all'].map(k=><button className={orderFilter===k?'active':''} key={k} onClick={()=>setOrderFilter(k)}>
                {k==='active'?'Activos':k==='completed'?'Entregados':k==='cancelled'?'Cancelados':'Todos'}
              </button>)}
            </div>
            <div className="search-box"><Search/><input placeholder="Buscar pedido o cliente" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          </div>
          <section className="orders-board">
            {shownOrders.map(o=><article className={`order-card ${newOrderIds.includes(o.id)?'new-order':''}`} key={o.id}>
              <div className="order-card-top">
                <div><span className={`status-pill ${statusMeta[o.status]?.tone||'gray'}`}>{statusMeta[o.status]?.label||o.status}</span>{newOrderIds.includes(o.id)&&<em>NUEVO</em>}</div>
                <small>{new Date(o.created_at).toLocaleString('es-MX')}</small>
              </div>
              <div className="order-customer">
                <span><Users/></span><div><b>{o.profiles?.full_name||'Cliente Guti'}</b><small>{o.profiles?.phone||'Sin teléfono'}</small></div><strong>${Number(o.total).toFixed(2)}</strong>
              </div>
              <div className="order-address"><MapPin/><span>{o.addresses?.formatted_address||'Dirección de entrega'}{o.addresses?.instructions&&<small>{o.addresses.instructions}</small>}</span></div>
              <div className="order-actions">
                <button className="secondary-btn" onClick={()=>openOrder(o)}>Ver detalle</button>
                {o.status==='pending'&&<>
                  <button className="danger-btn" onClick={()=>status(o,'cancelled')}>Rechazar</button>
                  <button className="primary-btn" onClick={()=>status(o,'accepted')}>Aceptar</button>
                </>}
                {o.status==='accepted'&&<button className="primary-btn" onClick={()=>status(o,'preparing')}>Empezar a preparar</button>}
                {o.status==='preparing'&&<button className="primary-btn" onClick={()=>status(o,'ready')}>Marcar listo</button>}
                {merchant.delivery_mode==='merchant'&&o.status==='ready'&&<button className="primary-btn" onClick={()=>status(o,'on_the_way')}>Salió a entrega</button>}
                {merchant.delivery_mode==='merchant'&&o.status==='on_the_way'&&<button className="primary-btn" onClick={()=>status(o,'delivered')}>Marcar entregado</button>}
              </div>
            </article>)}
            {!shownOrders.length&&<Empty icon={ReceiptText} title="No hay pedidos aquí" text="Cambia el filtro o espera un nuevo pedido."/>}
          </section>
        </>}

        {tab==='catalog'&&<>
          <section className="page-intro"><div><small>MENÚ Y PRODUCTOS</small><h2>Catálogo</h2><p>Administra fotos, precios, categorías, disponibilidad, extras y variantes.</p></div><button className="primary-btn" onClick={()=>openProduct()}><Plus/>Nuevo producto</button></section>
          <div className="catalog-layout">
            <aside className="category-panel">
              <h3>Categorías</h3>
              <div className="category-add"><input placeholder="Nueva categoría" value={newCategory} onChange={e=>setNewCategory(e.target.value)}/><button onClick={addCategory}><Plus/></button></div>
              <button className="category-filter active">Todos <span>{products.length}</span></button>
              {categories.map(c=><div className="category-row" key={c.id}><span>{c.name}</span><b>{products.filter(p=>p.category_id===c.id).length}</b><button onClick={()=>deleteCategory(c)}><Trash2/></button></div>)}
            </aside>
            <section className="panel catalog-panel">
              <div className="toolbar catalog-toolbar">
                <div className="search-box"><Search/><input placeholder="Buscar producto" value={search} onChange={e=>setSearch(e.target.value)}/></div>
                <span>{shownProducts.length} productos</span>
              </div>
              <div className="product-table">
                {shownProducts.map(p=><article key={p.id}>
                  <div className="product-thumb">{p.image_url?<img src={p.image_url} alt=""/>:<UtensilsCrossed/>}</div>
                  <div className="product-main"><b>{p.name}</b><small>{p.categories?.name||'Sin categoría'} · {p.description||'Sin descripción'}</small></div>
                  <strong>${Number(p.price).toFixed(2)}</strong>
                  <button className={`availability ${p.is_available?'on':'off'}`} onClick={()=>toggleProduct(p)}>{p.is_available?<><Eye/>Disponible</>:<><EyeOff/>Agotado</>}</button>
                  <button className="icon-btn" onClick={()=>openProduct(p)}><Pencil/></button>
                  <button className="icon-btn danger" onClick={()=>deleteProduct(p)}><Trash2/></button>
                </article>)}
                {!shownProducts.length&&<Empty icon={PackageSearch} title="Aún no hay productos" text="Agrega tu primer producto y empezará a aparecer en Guti.mx."/>}
              </div>
            </section>
          </div>
        </>}

        {tab==='appearance'&&<>
          <section className="page-intro"><div><small>ASÍ TE VEN LOS CLIENTES</small><h2>Mi negocio</h2><p>Personaliza tu portada, logo, descripción y datos públicos.</p></div><button className="primary-btn" disabled={busy} onClick={saveMerchant}><Save/>Guardar cambios</button></section>
          <div className="appearance-grid">
            <section className="panel">
              <h3>Identidad del negocio</h3>
              <label>Nombre público</label><input value={merchantForm.name} onChange={e=>setMerchantForm({...merchantForm,name:e.target.value})}/>
              <label>Descripción</label><textarea rows="4" placeholder="Cuéntale a tus clientes qué vendes..." value={merchantForm.description} onChange={e=>setMerchantForm({...merchantForm,description:e.target.value})}/>
              <div className="two-cols"><div><label>Teléfono</label><input value={merchantForm.phone} onChange={e=>setMerchantForm({...merchantForm,phone:e.target.value})}/></div><div><label>Dirección</label><input value={merchantForm.address} onChange={e=>setMerchantForm({...merchantForm,address:e.target.value})}/></div></div>

              <label>Logo</label>
              <div className="media-upload-row">
                <div className="logo-preview">{merchantForm.logo_url?<img src={merchantForm.logo_url} alt=""/>:<Store/>}</div>
                <label className="upload-button">{uploading==='logo'?<Loader2 className="spin"/>:<Upload/>}Subir logo<input type="file" accept="image/*" onChange={e=>uploadMedia(e.target.files?.[0],'logo')}/></label>
              </div>

              <label>Imagen de portada</label>
              <div className="cover-editor">
                {merchantForm.cover_url?<img src={merchantForm.cover_url} alt=""/>:<div><ImageIcon/><span>Tu portada aparecerá aquí</span></div>}
                <label className="cover-upload">{uploading==='cover'?<Loader2 className="spin"/>:<Camera/>}Cambiar portada<input type="file" accept="image/*" onChange={e=>uploadMedia(e.target.files?.[0],'cover')}/></label>
              </div>
              <p className="help-text">Recomendado: imagen horizontal, bien iluminada y sin demasiado texto. Esta es la imagen que sale en Inicio y en la portada de tu negocio.</p>
            </section>

            <section className="preview-phone">
              <small>VISTA PREVIA</small>
              <div className="phone-frame">
                <div className="phone-cover">{merchantForm.cover_url?<img src={merchantForm.cover_url} alt=""/>:<Store/>}<span className="phone-gradient"/></div>
                <div className="phone-store-info">
                  <div className="phone-logo">{merchantForm.logo_url?<img src={merchantForm.logo_url} alt=""/>:<Store/>}</div>
                  <h3>{merchantForm.name||'Tu negocio'}</h3>
                  <p>{merchantForm.description||'Tu descripción aparecerá aquí.'}</p>
                  <div><span><Star/>4.8</span><span><Clock3/>25–40 min</span><span><Bike/>$45</span></div>
                </div>
              </div>
            </section>
          </div>
        </>}

        {tab==='hours'&&<>
          <section className="page-intro"><div><small>DISPONIBILIDAD</small><h2>Horarios</h2><p>Define los días y horas en los que tu negocio recibe pedidos.</p></div><button className="primary-btn" disabled={busy} onClick={saveHours}><Save/>Guardar horarios</button></section>
          <section className="panel hours-panel">
            {hours.map((h,i)=><article key={i}>
              <div className="day-name"><CalendarDays/><b>{dayNames[i][1]}</b></div>
              <button className={`closed-toggle ${h.is_closed?'closed':'open'}`} onClick={()=>updateHour(i,{is_closed:!h.is_closed})}>{h.is_closed?<><XCircle/>Cerrado</>:<><CheckCircle2/>Abierto</>}</button>
              <input type="time" disabled={h.is_closed} value={h.open_time?.slice(0,5)||'09:00'} onChange={e=>updateHour(i,{open_time:e.target.value})}/>
              <span>a</span>
              <input type="time" disabled={h.is_closed} value={h.close_time?.slice(0,5)||'21:00'} onChange={e=>updateHour(i,{close_time:e.target.value})}/>
            </article>)}
          </section>
        </>}

        {tab==='settings'&&<>
          <section className="page-intro"><div><small>OPERACIÓN</small><h2>Configuración</h2><p>Controla cómo recibe y entrega pedidos tu negocio.</p></div><button className="primary-btn" onClick={saveMerchant}><Save/>Guardar</button></section>
          <div className="settings-grid">
            <section className="panel">
              <h3>Pedidos</h3>
              <button className="setting-row" onClick={()=>setMerchantForm(p=>({...p,accepts_orders:!p.accepts_orders}))}>
                <span className="setting-icon"><ReceiptText/></span>
                <div><b>Recibir pedidos</b><small>Si lo pausas, tu negocio seguirá visible pero no aceptará pedidos.</small></div>
                {merchantForm.accepts_orders?<ToggleRight className="toggle-on"/>:<ToggleLeft/>}
              </button>
              <div className="setting-row no-button">
                <span className="setting-icon"><Bike/></span>
                <div><b>Tipo de reparto</b><small>Elige quién entrega tus pedidos.</small></div>
                <select value={merchantForm.delivery_mode} onChange={e=>setMerchantForm({...merchantForm,delivery_mode:e.target.value})}>
                  <option value="guti">Repartidores Guti</option>
                  <option value="merchant">Mis repartidores</option>
                </select>
              </div>
            </section>

            <section className="panel financial-card">
              <h3>Condiciones Guti</h3>
              <div><CircleDollarSign/><span><small>Comisión de plataforma</small><b>{Number(merchant?.commission_percent||10)}%</b></span></div>
              <div><Bike/><span><small>Envío estándar Guti</small><b>$45</b></span></div>
              <p>Estas condiciones las administra Guti.mx. Si necesitas un cambio, contacta a soporte.</p>
            </section>
          </div>
        </>}
      </div>
    </section>

    {selectedOrder&&<OrderModal order={selectedOrder} items={orderItems} onClose={()=>setSelectedOrder(null)} onStatus={status} merchant={merchant}/>}
    {showProduct&&ProductModal()}
  </main>

  function ProductModal(){
    return <div className="modal-backdrop" onClick={()=>setShowProduct(false)}>
      <section className="product-modal" onClick={e=>e.stopPropagation()}>
        <header><div><small>{productForm.id?'EDITAR PRODUCTO':'NUEVO PRODUCTO'}</small><h2>{productForm.id?'Editar producto':'Agregar producto'}</h2></div><button onClick={()=>setShowProduct(false)}><X/></button></header>
        <div className="product-editor-grid">
          <div className="product-editor-main">
            <section className="editor-card">
              <h3>Información</h3>
              <label>Nombre del producto</label><input placeholder="Ej. Hamburguesa especial" value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/>
              <label>Descripción</label><textarea rows="3" placeholder="Ingredientes, tamaño, acompañamientos..." value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})}/>
              <div className="two-cols">
                <div><label>Precio</label><div className="money-input"><span>$</span><input type="number" step="0.01" min="0" value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></div></div>
                <div><label>Categoría</label><select value={productForm.category_id} onChange={e=>setProductForm({...productForm,category_id:e.target.value})}><option value="">Sin categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
            </section>

            <section className="editor-card">
              <div className="editor-card-head"><div><h3>Variantes y extras</h3><p>Salsas, tamaños, complementos, sabores, etc.</p></div><button onClick={addOptionGroup}><Plus/>Agregar grupo</button></div>
              {optionGroups.map((g,gi)=><div className="option-group" key={gi}>
                <div className="option-group-head"><GripVertical/><input value={g.name} onChange={e=>updateOptionGroup(gi,{name:e.target.value})}/><button onClick={()=>setOptionGroups(prev=>prev.filter((_,i)=>i!==gi))}><Trash2/></button></div>
                <div className="option-rules"><label>Mínimo <input type="number" min="0" value={g.min_select} onChange={e=>updateOptionGroup(gi,{min_select:e.target.value})}/></label><label>Máximo <input type="number" min="1" value={g.max_select} onChange={e=>updateOptionGroup(gi,{max_select:e.target.value})}/></label></div>
                <div className="option-list">
                  {g.options.map((o,oi)=><div className="option-row" key={oi}>
                    <input placeholder="Opción" value={o.name} onChange={e=>updateOption(gi,oi,{name:e.target.value})}/>
                    <div className="option-price"><span>+$</span><input type="number" step="0.01" value={o.extra_price} onChange={e=>updateOption(gi,oi,{extra_price:e.target.value})}/></div>
                    <button className={o.is_available?'option-on':'option-off'} onClick={()=>updateOption(gi,oi,{is_available:!o.is_available})}>{o.is_available?<Eye/>:<EyeOff/>}</button>
                    <button onClick={()=>removeOption(gi,oi)}><Trash2/></button>
                  </div>)}
                  <button className="add-option" onClick={()=>addOption(gi)}><Plus/>Agregar opción</button>
                </div>
              </div>)}
              {!optionGroups.length&&<div className="empty-options"><ListPlus/><b>Este producto no tiene variantes</b><span>Agrega un grupo si el cliente debe elegir salsa, tamaño, extras, etc.</span></div>}
            </section>
          </div>

          <aside className="product-editor-side">
            <section className="editor-card">
              <h3>Fotografía</h3>
              <div className="product-image-editor">
                {productForm.image_url?<img src={productForm.image_url} alt=""/>:<div><ImageIcon/><span>Sin fotografía</span></div>}
              </div>
              <label className="upload-button full">{uploading==='product'?<Loader2 className="spin"/>:<Upload/>}Subir imagen<input type="file" accept="image/*" onChange={e=>uploadMedia(e.target.files?.[0],'product')}/></label>
              <p className="help-text">Usa una foto cuadrada o horizontal, clara y con el producto al centro.</p>
            </section>
            <section className="editor-card">
              <h3>Disponibilidad</h3>
              <button className="availability-card" onClick={()=>setProductForm({...productForm,is_available:!productForm.is_available})}>
                <span>{productForm.is_available?<Eye/>:<EyeOff/>}</span>
                <div><b>{productForm.is_available?'Disponible':'Agotado'}</b><small>{productForm.is_available?'Los clientes pueden pedirlo':'No aparecerá disponible para pedir'}</small></div>
                {productForm.is_available?<ToggleRight className="toggle-on"/>:<ToggleLeft/>}
              </button>
              <label>Orden en el menú</label><input type="number" min="0" value={productForm.sort_order} onChange={e=>setProductForm({...productForm,sort_order:e.target.value})}/>
            </section>
          </aside>
        </div>
        <footer><button className="secondary-btn" onClick={()=>setShowProduct(false)}>Cancelar</button><button className="primary-btn" disabled={productBusy} onClick={saveProduct}>{productBusy?<Loader2 className="spin"/>:<Save/>}{productBusy?'Guardando...':'Guardar producto'}</button></footer>
      </section>
    </div>
  }
}

function OrderModal({order,items,onClose,onStatus,merchant}){
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="order-modal" onClick={e=>e.stopPropagation()}>
      <header><div><small>PEDIDO #{order.id.slice(0,8)}</small><h2>{order.profiles?.full_name||'Cliente Guti'}</h2></div><button onClick={onClose}><X/></button></header>
      <div className="order-modal-grid">
        <section>
          <h3>Productos</h3>
          <div className="modal-items">{items.map(i=><article key={i.id}><span>{i.quantity}×</span><div><b>{i.product_name}</b>{Array.isArray(i.selected_options)&&i.selected_options.length>0&&<small>{JSON.stringify(i.selected_options)}</small>}</div><strong>${Number(i.line_total).toFixed(2)}</strong></article>)}</div>
          <div className="modal-total"><span>Total</span><b>${Number(order.total).toFixed(2)}</b></div>
        </section>
        <aside>
          <h3>Entrega</h3>
          <div className="info-row"><MapPin/><div><b>Dirección</b><span>{order.addresses?.formatted_address||'—'}</span>{order.addresses?.instructions&&<small>{order.addresses.instructions}</small>}</div></div>
          <div className="info-row"><Phone/><div><b>Teléfono</b><span>{order.profiles?.phone||'No registrado'}</span></div></div>
          <div className="info-row"><Bike/><div><b>Reparto</b><span>{order.delivery_mode==='merchant'?'Repartidor del negocio':'Repartidor Guti'}</span></div></div>
          <div className="info-row"><DollarSign/><div><b>Pago</b><span>{order.payment_method==='cash'?'Efectivo':order.payment_method}</span></div></div>
        </aside>
      </div>
      <footer>
        {order.status==='pending'&&<><button className="danger-btn" onClick={()=>onStatus(order,'cancelled')}>Rechazar</button><button className="primary-btn" onClick={()=>onStatus(order,'accepted')}>Aceptar pedido</button></>}
        {order.status==='accepted'&&<button className="primary-btn" onClick={()=>onStatus(order,'preparing')}>Empezar a preparar</button>}
        {order.status==='preparing'&&<button className="primary-btn" onClick={()=>onStatus(order,'ready')}>Pedido listo</button>}
        {merchant.delivery_mode==='merchant'&&order.status==='ready'&&<button className="primary-btn" onClick={()=>onStatus(order,'on_the_way')}>Salió a entrega</button>}
        {merchant.delivery_mode==='merchant'&&order.status==='on_the_way'&&<button className="primary-btn" onClick={()=>onStatus(order,'delivered')}>Marcar entregado</button>}
      </footer>
    </section>
  </div>
}

function Empty({icon:Icon,title,text}){
  return <div className="empty"><span><Icon/></span><b>{title}</b><p>{text}</p></div>
}
