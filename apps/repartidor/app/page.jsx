'use client'
import { useEffect,useMemo,useState } from 'react'
import {
  Bike,LogOut,MapPin,Phone,Navigation,Clock3,PackageCheck,CheckCircle2,
  Wallet,CalendarDays,History,ChevronRight,RefreshCw,Store,AlertCircle,
  Map,Route,ReceiptText,TrendingUp,LockKeyhole
} from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const statusLabel={
  assigned:'Ve por el pedido',
  picked_up:'Pedido recogido',
  on_the_way:'En camino al cliente',
  delivered:'Entregado'
}

export default function Page(){
  const supabase=useMemo(()=>getSupabaseBrowserClient(),[])
  const [session,setSession]=useState(null)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [jobs,setJobs]=useState([])
  const [mine,setMine]=useState([])
  const [history,setHistory]=useState([])
  const [profile,setProfile]=useState(null)
  const [msg,setMsg]=useState('')
  const [busy,setBusy]=useState(false)
  const [tab,setTab]=useState('home')

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session)
      if(data.session)load(data.session.user.id)
    })
    const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>{
      setSession(x)
      if(x)load(x.user.id)
      else{setJobs([]);setMine([]);setHistory([])}
    })
    return()=>s.subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!session?.user?.id)return
    const channel=supabase.channel('courier-orders-v34')
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>load(session.user.id))
      .subscribe()
    const timer=setInterval(()=>load(session.user.id),12000)
    return()=>{clearInterval(timer);supabase.removeChannel(channel)}
  },[session?.user?.id])

  async function login(e){
    e.preventDefault();setBusy(true);setMsg('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setBusy(false);if(error)setMsg(error.message)
  }

  async function load(uid){
    setMsg('')
    const [{data:p},{data:j,error:je},{data:m,error:me},{data:h,error:he}]=await Promise.all([
      supabase.from('profiles').select('full_name,phone').eq('id',uid).maybeSingle(),
      supabase.rpc('get_available_orders_v34'),
      supabase.from('orders')
        .select('*,merchants(name,address,phone),addresses(formatted_address,instructions),profiles!orders_customer_id_fkey(full_name,phone)')
        .eq('courier_id',uid).in('status',['assigned','picked_up','on_the_way'])
        .order('created_at',{ascending:false}),
      supabase.from('orders')
        .select('id,status,delivery_fee,courier_earning,created_at,delivered_at,merchants(name),addresses(formatted_address)')
        .eq('courier_id',uid).eq('status','delivered')
        .order('delivered_at',{ascending:false}).limit(120)
    ])
    if(je)setMsg(je.message)
    else setJobs((j||[]).map(x=>({
      id:x.order_id,total:x.total,status:x.status,created_at:x.created_at,
      merchant_name:x.merchant_name,merchant_address:x.merchant_address,
      delivery_address:x.formatted_address,earning:Number(x.courier_earning||45)
    })))
    if(me)setMsg(me.message);else setMine(m||[])
    if(he)setMsg(he.message);else setHistory(h||[])
    setProfile(p||null)
  }

  async function claim(id){
    if(hasActive)return setMsg('Termina tu entrega activa antes de tomar otro pedido.')
    setBusy(true);setMsg('')
    const {error}=await supabase.rpc('claim_order_v34',{p_order_id:id})
    setBusy(false)
    if(error)setMsg(error.message);else await load(session.user.id)
  }

  async function step(id,status){
    setBusy(true);setMsg('')
    const {error}=await supabase.rpc('courier_set_order_status',{p_order_id:id,p_status:status})
    setBusy(false)
    if(error)setMsg(error.message);else await load(session.user.id)
  }

  const active=mine[0]||null
  const hasActive=mine.length>0
  const now=new Date()
  const startToday=new Date(now);startToday.setHours(0,0,0,0)
  const startWeek=new Date(now);startWeek.setHours(0,0,0,0);startWeek.setDate(startWeek.getDate()-((startWeek.getDay()+6)%7))
  const earningOf=o=>Number(o.courier_earning??o.delivery_fee??45)
  const todayEarnings=history.filter(o=>new Date(o.delivered_at||o.created_at)>=startToday).reduce((s,o)=>s+earningOf(o),0)
  const weekEarnings=history.filter(o=>new Date(o.delivered_at||o.created_at)>=startWeek).reduce((s,o)=>s+earningOf(o),0)
  const todayTrips=history.filter(o=>new Date(o.delivered_at||o.created_at)>=startToday).length
  const weekTrips=history.filter(o=>new Date(o.delivered_at||o.created_at)>=startWeek).length

  const googleUrl=address=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address||'Gutiérrez Zamora, Veracruz')}`
  const wazeUrl=address=>`https://www.waze.com/ul?q=${encodeURIComponent(address||'Gutiérrez Zamora, Veracruz')}&navigate=yes`

  if(!session)return <main className="courier-login">
    <section className="courier-login-card">
      <div className="courier-brand"><span><Bike/></span><div><b>Guti</b><small>REPARTIDOR</small></div></div>
      <h1>Bienvenido</h1><p>Inicia sesión para ver los pedidos disponibles.</p>
      <form onSubmit={login}>
        <label>Correo</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="repartidor@email.com"/>
        <label>Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/>
        <button disabled={busy}>{busy?'Entrando...':'Entrar'}</button>
      </form>
      {msg&&<div className="courier-message"><AlertCircle/>{msg}</div>}
    </section>
  </main>

  return <main className="courier-app">
    <header className="courier-header">
      <div className="courier-brand"><span><Bike/></span><div><b>Guti</b><small>REPARTIDOR</small></div></div>
      <div className="courier-user"><div><b>{profile?.full_name||'Repartidor Guti'}</b><small>{jobs.length} pedido{jobs.length===1?'':'s'} disponible{jobs.length===1?'':'s'}</small></div><button onClick={()=>supabase.auth.signOut()}><LogOut/></button></div>
    </header>

    <section className="courier-content">
      {msg&&<div className="courier-message"><AlertCircle/>{msg}<button onClick={()=>setMsg('')}>×</button></div>}

      {tab==='home'&&<>
        <section className="courier-hero">
          <div><small>RESUMEN DE HOY</small><h1>Hola, {profile?.full_name?.split(' ')[0]||'repartidor'} 👋</h1><p>Todos los repartidores conectados pueden ver los pedidos disponibles.</p></div>
          <button onClick={()=>load(session.user.id)}><RefreshCw/></button>
        </section>

        <section className="earning-grid">
          <article><span><Wallet/></span><div><small>Ganancias hoy</small><b>${todayEarnings.toFixed(2)}</b><em>{todayTrips} entrega{todayTrips===1?'':'s'}</em></div></article>
          <article><span><TrendingUp/></span><div><small>Esta semana</small><b>${weekEarnings.toFixed(2)}</b><em>{weekTrips} entrega{weekTrips===1?'':'s'}</em></div></article>
        </section>

        <section className="courier-section">
          <div className="courier-section-head"><div><small>EN CURSO</small><h2>Mi entrega activa</h2></div>{hasActive&&<span className="active-delivery-badge">1 activa</span>}</div>
          {!active?<div className="courier-empty"><PackageCheck/><b>No tienes una entrega activa</b><span>Puedes tomar uno de los pedidos disponibles.</span></div>:<article className="active-order-card">
            <div className="active-order-top">
              <div><span className="status-orb"><Bike/></span><div><small>{statusLabel[active.status]||active.status}</small><h3>{active.merchants?.name}</h3></div></div>
              <strong>${earningOf(active).toFixed(2)}<small>tu entrega</small></strong>
            </div>

            <div className="delivery-progress">
              {['assigned','picked_up','on_the_way'].map((s,i)=>{
                const order=['assigned','picked_up','on_the_way'].indexOf(active.status)
                return <div className={i<=order?'done':''} key={s}><span>{i<order?<CheckCircle2/>:i+1}</span><small>{i===0?'Recoger':i===1?'Recogido':'Entregar'}</small></div>
              })}
            </div>

            <div className="active-route">
              <div><span className="route-dot store"/><div><small>RECOGER EN</small><b>{active.merchants?.name}</b><p>{active.merchants?.address||'Dirección del negocio'}</p></div></div>
              <span className="route-line"/>
              <div><span className="route-dot customer"/><div><small>ENTREGAR A</small><b>{active.profiles?.full_name||'Cliente Guti'}</b><p>{active.addresses?.formatted_address}</p>{active.addresses?.instructions&&<em>{active.addresses.instructions}</em>}</div></div>
            </div>

            <div className="customer-contact">
              <div><Phone/><span><small>Teléfono del cliente</small><b>{active.profiles?.phone||'No disponible'}</b></span></div>
              {active.profiles?.phone&&<a href={`tel:${active.profiles.phone}`}><Phone/>Llamar</a>}
            </div>

            <div className="map-actions">
              <a target="_blank" rel="noreferrer" href={googleUrl(active.status==='assigned'?(active.merchants?.address||active.addresses?.formatted_address):active.addresses?.formatted_address)}><Map/>Google Maps</a>
              <a target="_blank" rel="noreferrer" href={wazeUrl(active.status==='assigned'?(active.merchants?.address||active.addresses?.formatted_address):active.addresses?.formatted_address)}><Navigation/>Waze</a>
            </div>

            <div className="delivery-main-action">
              {active.status==='assigned'&&<button disabled={busy} onClick={()=>step(active.id,'picked_up')}><PackageCheck/>Confirmar recogida</button>}
              {active.status==='picked_up'&&<button disabled={busy} onClick={()=>step(active.id,'on_the_way')}><Route/>Iniciar entrega</button>}
              {active.status==='on_the_way'&&<button disabled={busy} onClick={()=>step(active.id,'delivered')}><CheckCircle2/>Confirmar entrega</button>}
            </div>
          </article>}
        </section>

        <section className="courier-section">
          <div className="courier-section-head"><div><small>COLA GUTI</small><h2>Pedidos disponibles</h2></div><span>{jobs.length}</span></div>
          {hasActive&&jobs.length>0&&<div className="queue-warning"><LockKeyhole/><div><b>Puedes ver los siguientes pedidos</b><span>Termina tu entrega actual antes de tomar otro.</span></div></div>}
          {!jobs.length?<div className="courier-empty"><ReceiptText/><b>No hay pedidos por ahora</b><span>Se actualiza automáticamente.</span></div>
          :<div className="available-list">{jobs.map(j=><article key={j.id}>
            <div className="available-store"><span><Store/></span><div><small>RECOGER</small><b>{j.merchant_name}</b><p>{j.merchant_address||'Gutiérrez Zamora'}</p></div><strong>${j.earning.toFixed(2)}</strong></div>
            <div className="available-destination"><MapPin/><span>{j.delivery_address}</span></div>
            <button disabled={hasActive||busy} onClick={()=>claim(j.id)}>{hasActive?'Termina tu entrega para tomarlo':'Tomar pedido'}<ChevronRight/></button>
          </article>)}</div>}
        </section>
      </>}

      {tab==='history'&&<>
        <section className="courier-hero"><div><small>TUS ENTREGAS</small><h1>Historial</h1><p>Consulta tus entregas y ganancias recientes.</p></div></section>
        <section className="history-summary"><div><CalendarDays/><span><small>Esta semana</small><b>${weekEarnings.toFixed(2)}</b></span></div><div><History/><span><small>Entregas</small><b>{weekTrips}</b></span></div></section>
        <div className="history-list">{history.map(o=><article key={o.id}><span className="history-check"><CheckCircle2/></span><div><b>{o.merchants?.name}</b><small>{new Date(o.delivered_at||o.created_at).toLocaleString('es-MX')}</small><p>{o.addresses?.formatted_address}</p></div><strong>+${earningOf(o).toFixed(2)}</strong></article>)}
        {!history.length&&<div className="courier-empty"><History/><b>Aún no tienes entregas</b><span>Cuando completes una aparecerá aquí.</span></div>}</div>
      </>}
    </section>

    <nav className="courier-bottom-nav">
      <button className={tab==='home'?'active':''} onClick={()=>setTab('home')}><Bike/><span>Pedidos</span>{jobs.length>0&&<i>{jobs.length}</i>}</button>
      <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><History/><span>Historial</span></button>
    </nav>
  </main>
}
