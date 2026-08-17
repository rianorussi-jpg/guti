'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard, ReceiptText, PackageSearch, Store, Clock3, Settings, LogOut,
  Plus, Search, Bell, ChevronRight, X, Check, Image as ImageIcon, Upload, Trash2,
  Pencil, Eye, EyeOff, GripVertical, UtensilsCrossed, DollarSign, TrendingUp,
  ShoppingBag, Bike, Users, Star, CalendarDays, Save, ToggleLeft, ToggleRight,
  Camera, MapPin, Phone, FileText, BadgePercent, AlertCircle, ChevronDown,
  CircleDollarSign, Boxes, Tag, ListPlus, CheckCircle2, XCircle, Loader2,
  RefreshCw, Menu, ArrowLeft, Copy, ExternalLink, Volume2, VolumeX, Timer, PauseCircle,
  PlayCircle, Percent, Sparkles, AlarmClock, Layers3, Wallet, Landmark, CheckCheck, Banknote, CreditCard, ChefHat, Smartphone
} from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'
import { registerGutiServiceWorker, enableGutiPush } from '../lib/push'

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
  is_available:true,sort_order:0,promo_price:'',promo_starts_at:'',promo_ends_at:''
}

export default function Page(){
  const supabase=useMemo(()=>getSupabaseBrowserClient(),[])

  function mediaUrl(url){
    if(!url)return ''
    if(/^https?:\/\//i.test(url)||url.startsWith('data:')||url.startsWith('blob:'))return url
    const base=process.env.NEXT_PUBLIC_GUTI_CLIENT_URL||'https://guti.enla.mx'
    try{return new URL(url,base).toString()}catch{return url}
  }
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
  const [notifications,setNotifications]=useState([])
  const [showNotifications,setShowNotifications]=useState(false)
  const [settlements,setSettlements]=useState([])
  const [kitchenItems,setKitchenItems]=useState({})
  const [latestNewOrder,setLatestNewOrder]=useState(null)
  const [soundEnabled,setSoundEnabled]=useState(false)
  const [showCategoryCreator,setShowCategoryCreator]=useState(false)
  const seenOrderIds=useRef(new Set())
  const audioCtxRef=useRef(null)

  const [showProduct,setShowProduct]=useState(false)
  const [productForm,setProductForm]=useState(emptyProduct)
  const [productBusy,setProductBusy]=useState(false)
  const [optionGroups,setOptionGroups]=useState([])
  const [newCategory,setNewCategory]=useState('')

  const [merchantForm,setMerchantForm]=useState({
    name:'',description:'',phone:'',address:'',cover_url:'',logo_url:'',
    delivery_mode:'guti',accepts_orders:true,manual_pause:false,schedule_enabled:true,prep_minutes:25
  })
  const [uploading,setUploading]=useState('')

  const [sidebarOpen,setSidebarOpen]=useState(false)

  useEffect(()=>{registerGutiServiceWorker().catch(()=>{})},[])
  useEffect(()=>{const h=e=>{e.preventDefault();window.__gutiBusinessInstallPrompt=e};window.addEventListener('beforeinstallprompt',h);return()=>window.removeEventListener('beforeinstallprompt',h)},[])

  useEffect(()=>{
    try{setSoundEnabled(localStorage.getItem('guti-merchant-sound')==='1')}catch{}
  },[])

  function playOrderSound(){
    if(!soundEnabled)return
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext
      if(!AudioCtx)return
      const ctx=audioCtxRef.current||new AudioCtx()
      audioCtxRef.current=ctx
      if(ctx.state==='suspended')ctx.resume()
      const now=ctx.currentTime
      ;[0,0.18,0.36].forEach((offset,i)=>{
        const osc=ctx.createOscillator()
        const gain=ctx.createGain()
        osc.type='sine'
        osc.frequency.value=i===1?880:1040
        gain.gain.setValueAtTime(0.0001,now+offset)
        gain.gain.exponentialRampToValueAtTime(0.16,now+offset+0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.13)
        osc.connect(gain);gain.connect(ctx.destination)
        osc.start(now+offset);osc.stop(now+offset+0.15)
      })
    }catch{}
  }

  function toggleSound(){
    const next=!soundEnabled
    setSoundEnabled(next)
    try{localStorage.setItem('guti-merchant-sound',next?'1':'0')}catch{}
    if(next)setTimeout(()=>playOrderSound(),20)
  }

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
        setLatestNewOrder(payload.new)
        playOrderSound()
        loadOrders(merchant.id)
      })
      .on('postgres_changes',{
        event:'UPDATE',schema:'public',table:'orders',
        filter:`merchant_id=eq.${merchant.id}`
      },()=>loadOrders(merchant.id))
      .subscribe()

    const refreshOperations=async()=>{
      await supabase.rpc('sync_merchant_operational_state',{p_merchant_id:merchant.id})
      await Promise.all([loadOrders(merchant.id),loadProducts(merchant.id)])
      const {data:fresh}=await supabase.from('merchants').select('*').eq('id',merchant.id).maybeSingle()
      if(fresh){
        setMerchant(fresh)
        setMerchantForm(prev=>({...prev,
          accepts_orders:fresh.accepts_orders!==false,
          manual_pause:!!fresh.manual_pause,
          schedule_enabled:fresh.schedule_enabled!==false,
          prep_minutes:Number(fresh.prep_minutes||25)
        }))
      }
    }
    refreshOperations()
    const fallback=setInterval(refreshOperations,30000)
    return()=>{clearInterval(fallback);supabase.removeChannel(channel)}
  },[merchant?.id,session?.user?.id])

  async function loadKitchenItems(){
    const activeIds=orders.filter(o=>!['delivered','cancelled','on_the_way'].includes(o.status)).map(o=>o.id)
    if(!activeIds.length){setKitchenItems({});return}
    const {data}=await supabase.from('order_items').select('*').in('order_id',activeIds).order('id')
    const map={}
    for(const item of data||[]){(map[item.order_id]||(map[item.order_id]=[])).push(item)}
    setKitchenItems(map)
  }

  async function installBusinessApp(){
    try{
      const e=window.__gutiBusinessInstallPrompt
      if(e){await e.prompt();window.__gutiBusinessInstallPrompt=null;setMsg('Guti Negocios listo para instalarse.')}
      else setMsg('En iPhone usa Compartir → Agregar a pantalla de inicio. En Android usa Instalar app.')
    }catch{}
  }

  async function loadNotifications(uid){
    const {data}=await supabase.from('notifications').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(40)
    setNotifications(data||[])
  }

  async function markNotificationsRead(){
    if(!session?.user?.id)return
    await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',session.user.id).is('read_at',null)
    await loadNotifications(session.user.id)
  }

  async function enableBusinessNotifications(){
    if(!session?.user?.id)return setMsg('Inicia sesión para activar avisos.')
    try{await enableGutiPush(supabase,session.user.id,'negocio');setMsg('Push activado. Los pedidos nuevos podrán avisarte aunque cierres el panel.')}
    catch(e){setMsg(e.message||'No se pudieron activar los avisos.')}
  }

  async function loadSettlements(merchantId){
    const {data}=await supabase.from('weekly_settlements').select('*').eq('merchant_id',merchantId).order('week_start',{ascending:false}).limit(24)
    setSettlements(data||[])
  }

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
      accepts_orders:m.accepts_orders!==false,manual_pause:!!m.manual_pause,
      schedule_enabled:m.schedule_enabled!==false,prep_minutes:Number(m.prep_minutes||25)
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
    await supabase.rpc('sync_product_operational_state',{p_merchant_id:merchantId})
    const {data,error}=await supabase
      .from('products')
      .select('*,categories(name)')
      .eq('merchant_id',merchantId)
      .is('deleted_at',null)
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

  async function acceptOrderWithDelivery(order,deliveryMode,prepMinutes=merchantForm.prep_minutes){
    setMsg('')
    const {error}=await supabase.rpc('merchant_accept_order_v2',{
      p_order_id:order.id,
      p_delivery_mode:deliveryMode,
      p_prep_minutes:Math.max(5,Number(prepMinutes)||25)
    })
    if(error)return setMsg(error.message)
    setNewOrderIds(prev=>prev.filter(id=>id!==order.id))
    await loadOrders(merchant.id)
    if(selectedOrder?.id===order.id)setSelectedOrder(prev=>({...prev,status:'accepted',delivery_mode:deliveryMode}))
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
      is_available:p.is_available!==false,sort_order:p.sort_order||0,
      promo_price:p.promo_price==null?'':String(p.promo_price),
      promo_starts_at:p.promo_starts_at?String(p.promo_starts_at).slice(0,16):'',
      promo_ends_at:p.promo_ends_at?String(p.promo_ends_at).slice(0,16):''
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
      regular_price:Number(productForm.price),
      image_url:productForm.image_url||null,
      is_available:productForm.is_available,
      paused_until:null,
      pause_reason:null,
      promo_price:productForm.promo_price===''?null:Number(productForm.promo_price),
      promo_starts_at:productForm.promo_starts_at?new Date(productForm.promo_starts_at).toISOString():null,
      promo_ends_at:productForm.promo_ends_at?new Date(productForm.promo_ends_at).toISOString():null,
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

    await supabase.rpc('sync_product_operational_state',{p_merchant_id:merchant.id})
    setProductBusy(false);setShowProduct(false)
    await loadProducts(merchant.id)
  }

  async function toggleProduct(p){
    const next=!p.is_available
    const {error}=await supabase.from('products').update({
      is_available:next,paused_until:null,pause_reason:next?null:'manual'
    }).eq('id',p.id)
    if(error)return setMsg(error.message)
    await loadProducts(merchant.id)
  }

  async function pauseProduct(p,minutes){
    const until=minutes?new Date(Date.now()+minutes*60000).toISOString():null
    const {error}=await supabase.from('products').update({
      is_available:false,paused_until:until,pause_reason:minutes?'temporary':'manual'
    }).eq('id',p.id)
    if(error)return setMsg(error.message)
    setMsg(minutes?`${p.name} se reactivará automáticamente en ${minutes<60?minutes+' min':minutes/60+' h'}.`:`${p.name} quedó pausado hasta que lo reactives.`)
    await loadProducts(merchant.id)
  }

  async function duplicateProduct(p){
    setMsg('')
    const {data:copy,error}=await supabase.from('products').insert({
      merchant_id:p.merchant_id,category_id:p.category_id,name:`${p.name} copia`,
      description:p.description,price:Number(p.regular_price??p.price),regular_price:Number(p.regular_price??p.price),
      image_url:p.image_url,is_available:false,sort_order:Number(p.sort_order||0)+1,
      promo_price:null,promo_starts_at:null,promo_ends_at:null
    }).select().single()
    if(error)return setMsg(error.message)

    const {data:groups}=await supabase.from('product_option_groups').select('*,product_options(*)').eq('product_id',p.id)
    for(const g of groups||[]){
      const {data:newGroup,error:ge}=await supabase.from('product_option_groups').insert({
        product_id:copy.id,name:g.name,min_select:g.min_select,max_select:g.max_select
      }).select().single()
      if(ge)continue
      const options=(g.product_options||[]).map(o=>({
        group_id:newGroup.id,name:o.name,extra_price:o.extra_price,is_available:o.is_available
      }))
      if(options.length)await supabase.from('product_options').insert(options)
    }
    setMsg('Producto duplicado. Quedó pausado para que lo revises antes de publicarlo.')
    await loadProducts(merchant.id)
  }

  async function deleteProduct(p){
    if(!confirm(`¿Eliminar "${p.name}" del catálogo?\n\nLos pedidos anteriores conservarán este producto en su historial.`))return
    setMsg('')
    const {error}=await supabase.from('products').update({
      is_available:false,
      deleted_at:new Date().toISOString(),
      paused_until:null,
      pause_reason:'archived'
    }).eq('id',p.id)
    if(error)return setMsg(error.message)
    setMsg(`"${p.name}" se eliminó del catálogo. Los pedidos anteriores se conservan.`)
    await loadProducts(merchant.id)
  }

  async function addCategory(){
    if(!newCategory.trim()||!merchant)return
    setMsg('')
    const {error}=await supabase.rpc('merchant_create_category',{
      p_merchant_id:merchant.id,p_name:newCategory.trim()
    })
    if(error)return setMsg(error.message)
    setNewCategory('');setShowCategoryCreator(false)
    await loadCategories(merchant.id)
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
      manual_pause:!!merchantForm.manual_pause,
      schedule_enabled:merchantForm.schedule_enabled!==false,
      prep_minutes:Math.max(5,Number(merchantForm.prep_minutes)||25)
    }
    const {data,error}=await supabase.from('merchants').update(payload).eq('id',merchant.id).select().single()
    setBusy(false)
    if(error)return setMsg(error.message)
    await supabase.rpc('sync_merchant_operational_state',{p_merchant_id:merchant.id})
    const {data:fresh}=await supabase.from('merchants').select('*').eq('id',merchant.id).single()
    setMerchant(fresh||data);setMerchantForm(prev=>({...prev,accepts_orders:(fresh||data).accepts_orders!==false}))
    setMsg('Cambios guardados.')
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
    await supabase.rpc('sync_merchant_operational_state',{p_merchant_id:merchant.id})
    const {data:fresh}=await supabase.from('merchants').select('*').eq('id',merchant.id).single()
    if(fresh){setMerchant(fresh);setMerchantForm(prev=>({...prev,accepts_orders:fresh.accepts_orders!==false}))}
    setMsg('Horarios guardados y apertura automática actualizada.')
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

  useEffect(()=>{if(tab==='kitchen'&&orders.length)loadKitchenItems()},[tab,orders.map(o=>`${o.id}:${o.status}`).join('|')])

  const nav=[
    ['dashboard','Resumen',LayoutDashboard],
    ['orders','Pedidos',ReceiptText],
    ['kitchen','Modo cocina',ChefHat],
    ['catalog','Catálogo',PackageSearch],
    ['appearance','Mi negocio',Store],
    ['hours','Horarios',Clock3],
    ['payments','Pagos',Wallet],
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
          <button className={`sound-toggle ${soundEnabled?'on':''}`} onClick={toggleSound} title="Sonido de pedidos">{soundEnabled?<Volume2/>:<VolumeX/>}</button>
          <button className={`notify-center-btn ${notifications.some(n=>!n.read_at)?'has-new':''}`} onClick={()=>setShowNotifications(true)}><Bell/>{notifications.filter(n=>!n.read_at).length>0&&<span>{notifications.filter(n=>!n.read_at).length}</span>}</button>
          <button className={`order-live ${pendingCount?'has-new':''}`} onClick={()=>setTab('orders')}><ReceiptText/>{pendingCount>0&&<span>{pendingCount}</span>}</button>
          <button className={`store-switch ${merchant?.accepts_orders?'on':'off'}`} onClick={async()=>{
            const manualPause=!merchantForm.manual_pause
            const {error}=await supabase.from('merchants').update({manual_pause:manualPause}).eq('id',merchant.id)
            if(error)return setMsg(error.message)
            await supabase.rpc('sync_merchant_operational_state',{p_merchant_id:merchant.id})
            const {data}=await supabase.from('merchants').select('*').eq('id',merchant.id).single()
            setMerchant(data);setMerchantForm(prev=>({...prev,manual_pause:!!data.manual_pause,accepts_orders:data.accepts_orders!==false}))
          }}>
            {merchant?.accepts_orders?<ToggleRight/>:<ToggleLeft/>}
            <span>{merchant?.accepts_orders?'Abierto':'Pausado/Cerrado'}</span>
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

        {tab==='kitchen'&&<>
          <section className="page-intro kitchen-intro"><div><small>MODO COCINA</small><h2>Comandas en vivo</h2><p>Pantalla simple para tablet: nuevos → preparando → listos.</p></div><button className="secondary-btn" onClick={()=>{loadOrders(merchant.id);loadKitchenItems()}}><RefreshCw/>Actualizar</button></section>
          <section className="kitchen-board">
            {[
              {key:'new',title:'Nuevos',statuses:['pending','accepted']},
              {key:'preparing',title:'Preparando',statuses:['preparing']},
              {key:'ready',title:'Listos',statuses:['ready','assigned','picked_up']}
            ].map(col=><div className={`kitchen-column ${col.key}`} key={col.key}>
              <header><h3>{col.title}</h3><span>{orders.filter(o=>col.statuses.includes(o.status)).length}</span></header>
              <div className="kitchen-stack">
                {orders.filter(o=>col.statuses.includes(o.status)).map(o=><article className={`kitchen-ticket ${newOrderIds.includes(o.id)?'fresh':''}`} key={o.id}>
                  <div className="kitchen-ticket-top"><div><small>#{o.id.slice(0,6)}</small><b>{o.profiles?.full_name||'Cliente Guti'}</b></div><strong>{new Date(o.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</strong></div>
                  <div className="kitchen-products">{(kitchenItems[o.id]||[]).map(i=><div key={i.id}><b>{i.quantity}× {i.product_name}</b>{(i.selected_options||[]).map((op,idx)=><small key={idx}>{op.option_name}</small>)}</div>)}</div>
                  {o.notes&&<p className="kitchen-note">Nota: {o.notes}</p>}
                  <div className="kitchen-actions">
                    {o.status==='pending'&&<button onClick={()=>openOrder(o)}>Abrir y aceptar</button>}
                    {o.status==='accepted'&&<button onClick={()=>status(o,'preparing')}>Empezar preparación</button>}
                    {o.status==='preparing'&&<button onClick={()=>status(o,'ready')}>Marcar listo</button>}
                    {['ready','assigned','picked_up'].includes(o.status)&&<span>✓ Esperando salida</span>}
                  </div>
                </article>)}
                {!orders.some(o=>col.statuses.includes(o.status))&&<div className="kitchen-empty">Sin pedidos</div>}
              </div>
            </div>)}
          </section>
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
              {o.estimated_ready_at&&<div className="order-eta"><Timer/><span>Listo aprox. <b>{new Date(o.estimated_ready_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</b> · {o.preparation_minutes||merchantForm.prep_minutes} min</span></div>}
              <div className="order-actions">
                <button className="secondary-btn" onClick={()=>openOrder(o)}>Ver detalle</button>
                {o.status==='pending'&&<>
                  <button className="danger-btn" onClick={()=>status(o,'cancelled')}>Rechazar</button>
                  <button className="secondary-btn" onClick={()=>acceptOrderWithDelivery(o,'merchant')}>Aceptar · Lo entregamos</button>
                  <button className="primary-btn" onClick={()=>acceptOrderWithDelivery(o,'guti')}>Aceptar · Pedir Guti</button>
                </>}
                {o.status==='accepted'&&<button className="primary-btn" onClick={()=>status(o,'preparing')}>Empezar a preparar</button>}
                {o.status==='preparing'&&<button className="primary-btn" onClick={()=>status(o,'ready')}>Marcar listo</button>}
                {o.delivery_mode==='merchant'&&o.status==='ready'&&<button className="primary-btn" onClick={()=>status(o,'on_the_way')}>Salió a entrega</button>}
                {o.delivery_mode==='merchant'&&o.status==='on_the_way'&&<button className="primary-btn" onClick={()=>status(o,'delivered')}>Marcar entregado</button>}
              </div>
            </article>)}
            {!shownOrders.length&&<Empty icon={ReceiptText} title="No hay pedidos aquí" text="Cambia el filtro o espera un nuevo pedido."/>}
          </section>
        </>}

        {tab==='catalog'&&<>
          <section className="page-intro"><div><small>MENÚ Y PRODUCTOS</small><h2>Catálogo</h2><p>Administra fotos, precios, categorías, disponibilidad, extras y variantes.</p></div><button className="primary-btn" onClick={()=>openProduct()}><Plus/>Nuevo producto</button></section>
          <div className="catalog-layout">
            <aside className="category-panel">
              <div className="category-title-row"><h3>Categorías</h3><button className="mini-primary" onClick={()=>setShowCategoryCreator(v=>!v)}><Plus/>Agregar</button></div>
              {showCategoryCreator&&<div className="category-add category-add-open">
                <input autoFocus placeholder="Ej. Hamburguesas" value={newCategory} onChange={e=>setNewCategory(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addCategory()}}/>
                <button onClick={addCategory}><Check/></button>
              </div>}
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
                  <div className="product-thumb">{p.image_url?<img src={mediaUrl(p.image_url)} alt={p.name}/>:<UtensilsCrossed/>}</div>
                  <div className="product-main"><b>{p.name} {p.promo_price&&<em className="promo-chip"><Percent/>Promo</em>}</b><small>{p.categories?.name||'Sin categoría'} · {p.description||'Sin descripción'}</small>{p.paused_until&&<span className="pause-until">Pausado hasta {new Date(p.paused_until).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</span>}</div>
                  <strong>${Number(p.price).toFixed(2)}</strong>
                  <button className={`availability ${p.is_available?'on':'off'}`} onClick={()=>toggleProduct(p)}>{p.is_available?<><Eye/>Disponible</>:<><EyeOff/>Agotado</>}</button>
                  <div className="pause-menu">
                    <button title="Pausar 30 min" onClick={()=>pauseProduct(p,30)}>30m</button>
                    <button title="Pausar 1 hora" onClick={()=>pauseProduct(p,60)}>1h</button>
                    <button title={p.is_available?'Pausar hasta reactivar':'Reactivar'} onClick={()=>p.is_available?pauseProduct(p,null):toggleProduct(p)}>{p.is_available?<PauseCircle/>:<PlayCircle/>}</button>
                  </div>
                  <div className="product-quick-actions">
                    <button className="icon-btn" title="Duplicar" onClick={()=>duplicateProduct(p)}><Copy/></button>
                    <button className="icon-btn" title="Editar" onClick={()=>openProduct(p)}><Pencil/></button>
                    <button className="icon-btn danger" title="Eliminar" onClick={()=>deleteProduct(p)}><Trash2/></button>
                  </div>
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

        {tab==='payments'&&<>
          <section className="page-intro"><div><small>LIQUIDACIONES GUTI</small><h2>Pagos semanales</h2><p>Guti libera las liquidaciones los lunes a la cuenta bancaria registrada.</p></div><button className="secondary-btn" onClick={enableBusinessNotifications}><Bell/>Activar avisos</button></section>
          <div className="settlement-summary-grid">
            <article><span><Wallet/></span><div><small>Pendiente de pago</small><b>${settlements.filter(s=>s.status==='pending').reduce((a,s)=>a+Number(s.amount||0),0).toFixed(2)}</b></div></article>
            <article><span><CheckCheck/></span><div><small>Pagado históricamente</small><b>${settlements.filter(s=>s.status==='paid').reduce((a,s)=>a+Number(s.amount||0),0).toFixed(2)}</b></div></article>
          </div>
          <section className="panel">
            <div className="panel-head"><div><small>HISTORIAL</small><h3>Liquidaciones</h3></div></div>
            <div className="settlement-list">
              {settlements.map(s=><article key={s.id}><div><b>{new Date(s.week_start+'T12:00:00').toLocaleDateString('es-MX')} – {new Date(s.week_end+'T12:00:00').toLocaleDateString('es-MX')}</b><small>{s.order_count} pedidos · {s.bank_name||'Banco sin registrar'} · {s.bank_clabe?`•••• ${s.bank_clabe.slice(-4)}`:'Sin CLABE'}</small></div><strong>${Number(s.amount).toFixed(2)}</strong><span className={`settlement-status ${s.status}`}>{s.status==='paid'?'Pagado':'Pendiente'}</span></article>)}
              {!settlements.length&&<Empty icon={Wallet} title="Aún no hay liquidaciones" text="Al cerrar tu primera semana aparecerá aquí el pago correspondiente."/>}
            </div>
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

            <section className="panel operation-settings">
              <h3>Operación automática</h3>
              <label>Tiempo estimado de preparación</label>
              <div className="prep-selector">
                {[15,20,25,30,45,60].map(n=><button className={Number(merchantForm.prep_minutes)===n?'active':''} key={n} onClick={()=>setMerchantForm(p=>({...p,prep_minutes:n}))}>{n} min</button>)}
              </div>
              <button className="setting-row" onClick={()=>setMerchantForm(p=>({...p,schedule_enabled:!p.schedule_enabled}))}>
                <span><AlarmClock/></span><div><b>Abrir/cerrar según horarios</b><small>Actualiza automáticamente el estado del negocio.</small></div>
                {merchantForm.schedule_enabled?<ToggleRight className="toggle-on"/>:<ToggleLeft/>}
              </button>
              <p className="help-text">El botón superior funciona como pausa manual. Aunque el horario diga abierto, una pausa manual mantiene el negocio cerrado.</p>
              <button className="primary-btn" onClick={saveMerchant}><Save/>Guardar operación</button>
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

    {latestNewOrder&&<div className="new-order-alert">
      <div className="new-order-alert-icon"><Bell/></div>
      <div><small>NUEVO PEDIDO</small><b>¡Entró un pedido nuevo!</b><span>Revísalo y confirma el tiempo estimado.</span></div>
      <button onClick={()=>{setTab('orders');setLatestNewOrder(null)}}>Ver pedido</button>
      <button className="alert-close" onClick={()=>setLatestNewOrder(null)}><X/></button>
    </div>}

    {showNotifications&&<div className="notification-drawer-backdrop" onClick={()=>setShowNotifications(false)}><aside className="notification-drawer" onClick={e=>e.stopPropagation()}>
      <header><div><small>AVISOS GUTI</small><h2>Notificaciones</h2></div><button onClick={()=>setShowNotifications(false)}><X/></button></header>
      <button className="mark-read" onClick={markNotificationsRead}><CheckCheck/>Marcar todo leído</button>
      <div className="notification-list">{notifications.map(n=><article className={!n.read_at?'unread':''} key={n.id}><span><Bell/></span><div><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('es-MX')}</small></div></article>)}{!notifications.length&&<p className="empty-notifications">Todavía no tienes avisos.</p>}</div>
      <button className="enable-notifs" onClick={enableBusinessNotifications}>Activar avisos del navegador</button>
    </aside></div>}

    {selectedOrder&&<OrderModal order={selectedOrder} items={orderItems} onClose={()=>setSelectedOrder(null)} onStatus={status} onAccept={acceptOrderWithDelivery} merchant={merchant}/>}
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
                {productForm.image_url?<img src={mediaUrl(productForm.image_url)} alt={productForm.name||'Producto'}/>:<div><ImageIcon/><span>Sin fotografía</span></div>}
              </div>
              <label className="upload-button full">{uploading==='product'?<Loader2 className="spin"/>:<Upload/>}Subir imagen<input type="file" accept="image/*" onChange={e=>uploadMedia(e.target.files?.[0],'product')}/></label>
              <p className="help-text">Usa una foto cuadrada o horizontal, clara y con el producto al centro.</p>
            </section>
            <section className="editor-card promo-editor-card">
              <div className="editor-card-head"><div><h3>Promoción</h3><p>Programa un precio especial.</p></div><BadgePercent/></div>
              <label>Precio promocional</label>
              <div className="money-input"><span>$</span><input type="number" step="0.01" min="0" placeholder="Sin promoción" value={productForm.promo_price} onChange={e=>setProductForm({...productForm,promo_price:e.target.value})}/></div>
              <div className="two-cols">
                <div><label>Inicia</label><input type="datetime-local" value={productForm.promo_starts_at} onChange={e=>setProductForm({...productForm,promo_starts_at:e.target.value})}/></div>
                <div><label>Termina</label><input type="datetime-local" value={productForm.promo_ends_at} onChange={e=>setProductForm({...productForm,promo_ends_at:e.target.value})}/></div>
              </div>
              <p className="help-text">Si dejas las fechas vacías, la promoción se activa inmediatamente y permanece hasta que la quites.</p>
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

function OrderModal({order,items,onClose,onStatus,onAccept,merchant}){
  const [prep,setPrep]=useState(Number(order.preparation_minutes||merchant?.prep_minutes||25))
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="order-modal" onClick={e=>e.stopPropagation()}>
      <header><div><small>PEDIDO #{order.id.slice(0,8)}</small><h2>{order.profiles?.full_name||'Cliente Guti'}</h2></div><button onClick={onClose}><X/></button></header>
      <div className="order-modal-body">
        <div className="order-detail-hero">
          <div><span className={`status-pill ${statusMeta[order.status]?.tone||'gray'}`}>{statusMeta[order.status]?.label||order.status}</span><small>{new Date(order.created_at).toLocaleString('es-MX')}</small></div>
          <strong>${Number(order.total).toFixed(2)}</strong>
        </div>
        <div className={`merchant-payment-info ${order.payment_method==='cash'&&order.payment_status!=='paid'?'cash':'paid'}`}>
          <span>{order.payment_method==='cash'?<Banknote/>:<CreditCard/>}</span>
          <div><small>PAGO</small><b>{order.payment_method==='cash'&&order.payment_status!=='paid'?`Efectivo · el repartidor cobrará $${Number(order.total||0).toFixed(2)}`:`${({card:'Tarjeta',transfer:'Transferencia',guti_balance:'Guti Balance',cash:'Efectivo'}[order.payment_method]||order.payment_method)} · Pagado`}</b></div>
        </div>
        <section className="detail-section"><h3>Productos</h3>
          {items.map(i=><div className="detail-item" key={i.id}><span>{i.quantity}×</span><div><b>{i.product_name}</b>{(i.selected_options||[]).map((o,idx)=><small key={idx}>{o.group_name}: {o.option_name}{Number(o.extra_price)>0?` +$${Number(o.extra_price).toFixed(2)}`:''}</small>)}</div><strong>${Number(i.line_total).toFixed(2)}</strong></div>)}
        </section>
        <section className="detail-section info-list">
          <div><Phone/><span><small>Cliente</small><b>{order.profiles?.phone||'Sin teléfono'}</b></span></div>
          <div><MapPin/><span><small>Entrega</small><b>{order.addresses?.formatted_address||'Sin dirección'}</b>{order.addresses?.instructions&&<em>{order.addresses.instructions}</em>}</span></div>
          {order.estimated_ready_at&&<div><Timer/><span><small>Tiempo estimado</small><b>{order.preparation_minutes} min · {new Date(order.estimated_ready_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</b></span></div>}
        </section>

        {order.status==='pending'&&<section className="accept-estimate">
          <div><Timer/><span><b>¿En cuánto estará listo?</b><small>Este tiempo queda guardado en el pedido.</small></span></div>
          <div className="prep-selector">{[15,20,25,30,45,60].map(n=><button key={n} className={prep===n?'active':''} onClick={()=>setPrep(n)}>{n} min</button>)}</div>
        </section>}
      </div>
      <footer className="order-modal-actions">
        {order.status==='pending'&&<>
          <button className="danger-btn" onClick={()=>onStatus(order,'cancelled')}>Rechazar</button>
          <button className="secondary-btn" onClick={()=>onAccept(order,'merchant',prep)}>Aceptar · Repartidor propio</button>
          <button className="primary-btn" onClick={()=>onAccept(order,'guti',prep)}>Aceptar · Solicitar Guti</button>
        </>}
        {order.status==='accepted'&&<button className="primary-btn" onClick={()=>onStatus(order,'preparing')}>Empezar preparación</button>}
        {order.status==='preparing'&&<button className="primary-btn" onClick={()=>onStatus(order,'ready')}>Marcar listo</button>}
        {order.delivery_mode==='merchant'&&order.status==='ready'&&<button className="primary-btn" onClick={()=>onStatus(order,'on_the_way')}>Salió a entrega</button>}
        {order.delivery_mode==='merchant'&&order.status==='on_the_way'&&<button className="primary-btn" onClick={()=>onStatus(order,'delivered')}>Entregado</button>}
        <button className="secondary-btn" onClick={onClose}>Cerrar</button>
      </footer>
    </section>
  </div>
}

function Empty({icon:Icon,title,text}){
  return <div className="empty"><span><Icon/></span><b>{title}</b><p>{text}</p></div>
}
