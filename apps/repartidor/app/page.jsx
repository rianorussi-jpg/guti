'use client'
import { useEffect,useMemo,useState } from 'react'
import {
  Bike,LogOut,MapPin,Phone,Navigation,Clock3,PackageCheck,CheckCircle2,
  Wallet,CalendarDays,History,ChevronRight,RefreshCw,Store,AlertCircle,
  Map,Route,ReceiptText,TrendingUp,LockKeyhole,Bell,Landmark,CheckCheck,Send,WalletCards
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
  const [notifications,setNotifications]=useState([])
  const [showNotifications,setShowNotifications]=useState(false)
  const [cashDays,setCashDays]=useState([])
  const [cashDeposits,setCashDeposits]=useState([])
  const [settlements,setSettlements]=useState([])
  const [depositAmount,setDepositAmount]=useState('')
  const [depositReference,setDepositReference]=useState('')

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

  useEffect(()=>{
    if(!session?.user?.id)return
    const uid=session.user.id
    const channel=supabase.channel(`courier-notifications-${uid}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${uid}`},payload=>{
        const n=payload.new
        setNotifications(prev=>[n,...prev].slice(0,40))
        if('Notification' in window&&Notification.permission==='granted'){
          try{new Notification(n.title,{body:n.body||'',tag:n.dedupe_key||n.id})}catch{}
        }
      }).subscribe()
    return()=>supabase.removeChannel(channel)
  },[session?.user?.id])

  async function enableNotifications(){
    if(!('Notification' in window))return setMsg('Este navegador no permite notificaciones.')
    const p=await Notification.requestPermission()
    setMsg(p==='granted'?'Avisos del navegador activados.':'No se activaron los avisos.')
  }

  async function markNotificationsRead(){
    if(!session?.user?.id)return
    await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',session.user.id).is('read_at',null)
    await load(session.user.id)
  }

  async function submitDeposit(day){
    const due=Number(day.amount_due||0)
    const amount=Number(depositAmount||due)
    if(!amount||amount<=0)return setMsg('Escribe la cantidad depositada.')
    setBusy(true);setMsg('')
    const {error}=await supabase.rpc('submit_courier_cash_deposit',{p_business_date:day.business_date,p_amount:amount,p_reference:depositReference||null})
    setBusy(false)
    if(error)return setMsg(error.message)
    setDepositAmount('');setDepositReference('')
    setMsg(`Depósito de $${amount.toFixed(2)} enviado a revisión de Guti.`)
    await load(session.user.id)
  }

  async function login(e){
    e.preventDefault();setBusy(true);setMsg('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setBusy(false);if(error)setMsg(error.message)
  }

  async function load(uid){
    setMsg('')
    const [{data:p},{data:j,error:je},{data:m,error:me},{data:h,error:he},{data:notifs},{data:cash},{data:deps},{data:sets}]=await Promise.all([
      supabase.from('profiles').select('full_name,phone').eq('id',uid).maybeSingle(),
      supabase.rpc('get_available_orders_v34'),
      supabase.from('orders')
        .select('*,merchants(name,address,phone),addresses(formatted_address,instructions),profiles!orders_customer_id_fkey(full_name,phone)')
        .eq('courier_id',uid).in('status',['assigned','picked_up','on_the_way'])
        .order('created_at',{ascending:false}),
      supabase.from('orders')
        .select('id,status,delivery_fee,courier_earning,courier_payable,total,payment_method,created_at,delivered_at,merchants(name),addresses(formatted_address)')
        .eq('courier_id',uid).eq('status','delivered')
        .order('delivered_at',{ascending:false}).limit(120),
      supabase.from('notifications').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(40),
      supabase.from('courier_cash_daily').select('*').eq('courier_id',uid).order('business_date',{ascending:false}).limit(31),
      supabase.from('courier_cash_deposits').select('*').eq('courier_id',uid).order('submitted_at',{ascending:false}).limit(50),
      supabase.from('weekly_settlements').select('*').eq('courier_id',uid).order('week_start',{ascending:false}).limit(24)
    ])
    if(je)setMsg(je.message)
    else setJobs((j||[]).map(x=>({
      id:x.order_id,total:x.total,status:x.status,created_at:x.created_at,
      merchant_name:x.merchant_name,merchant_address:x.merchant_address,
      delivery_address:x.formatted_address,earning:Number(x.courier_earning??35)
    })))
    if(me)setMsg(me.message);else setMine(m||[])
    if(he)setMsg(he.message);else setHistory(h||[])
    setNotifications(notifs||[]);setCashDays(cash||[]);setCashDeposits(deps||[]);setSettlements(sets||[])
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
  const earningOf=o=>Number(o.courier_earning??o.courier_payable??35)
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
      <div className="courier-user"><div><b>{profile?.full_name||'Repartidor Guti'}</b><small>{jobs.length} pedido{jobs.length===1?'':'s'} disponible{jobs.length===1?'':'s'}</small></div><button className="courier-notify" onClick={()=>setShowNotifications(true)}><Bell/>{notifications.filter(n=>!n.read_at).length>0&&<i>{notifications.filter(n=>!n.read_at).length}</i>}</button><button onClick={()=>supabase.auth.signOut()}><LogOut/></button></div>
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

      {tab==='cash'&&<>
        <section className="courier-hero"><div><small>EFECTIVO GUTI</small><h1>Control de efectivo</h1><p>En pedidos en efectivo conservas tu parte de reparto y depositas el resto a Guti diariamente.</p></div></section>
        <section className="cash-summary-grid">
          <article><span><WalletCards/></span><div><small>Efectivo cobrado</small><b>${cashDays.reduce((s,d)=>s+Number(d.cash_collected||0),0).toFixed(2)}</b></div></article>
          <article><span><Bike/></span><div><small>Tu parte retenida</small><b>${cashDays.reduce((s,d)=>s+Number(d.courier_keeps||0),0).toFixed(2)}</b></div></article>
          <article><span><Landmark/></span><div><small>Pendiente de depositar</small><b>${cashDays.reduce((s,d)=>s+Number(d.amount_due||0),0).toFixed(2)}</b></div></article>
        </section>
        <section className="courier-section"><div className="courier-section-head"><div><small>POR DÍA</small><h2>Efectivo por depositar</h2></div></div>
          <div className="cash-days">{cashDays.map(day=><article key={day.business_date}>
            <div className="cash-day-head"><div><b>{new Date(day.business_date+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'short'})}</b><small>Cobrado ${Number(day.cash_collected).toFixed(2)} · Tu parte ${Number(day.courier_keeps).toFixed(2)}</small></div><strong>${Number(day.amount_due).toFixed(2)}</strong></div>
            {Number(day.pending_confirmation)>0&&<div className="deposit-pending"><Clock3/>${Number(day.pending_confirmation).toFixed(2)} pendiente de confirmación</div>}
            {Number(day.amount_due)>0&&<div className="deposit-form"><input inputMode="decimal" placeholder={`$${Number(day.amount_due).toFixed(2)}`} value={depositAmount} onChange={e=>setDepositAmount(e.target.value)}/><input placeholder="Referencia / folio (opcional)" value={depositReference} onChange={e=>setDepositReference(e.target.value)}/><button disabled={busy} onClick={()=>submitDeposit(day)}><Send/>Ya deposité</button></div>}
            {Number(day.amount_due)<=0&&<div className="deposit-ok"><CheckCircle2/>Sin efectivo pendiente por este día</div>}
          </article>)}
          {!cashDays.length&&<div className="courier-empty"><Wallet/><b>No tienes cobros en efectivo</b><span>Cuando entregues un pedido en efectivo aparecerá aquí.</span></div>}</div>
        </section>
        <section className="courier-section"><div className="courier-section-head"><div><small>LUNES</small><h2>Pagos semanales</h2></div></div>
          <div className="settlement-courier-list">{settlements.map(s=><article key={s.id}><div><b>{new Date(s.week_start+'T12:00:00').toLocaleDateString('es-MX')} – {new Date(s.week_end+'T12:00:00').toLocaleDateString('es-MX')}</b><small>{s.order_count} entregas no efectivo · {s.bank_name||'Banco sin registrar'} {s.bank_clabe?`••••${s.bank_clabe.slice(-4)}`:''}</small></div><strong>${Number(s.amount).toFixed(2)}</strong><span className={s.status}>{s.status==='paid'?'Pagado':'Pendiente'}</span></article>)}{!settlements.length&&<div className="courier-empty"><CalendarDays/><b>Aún no hay liquidaciones</b><span>Los pagos de tarjeta/transferencia se agrupan semanalmente.</span></div>}</div>
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
      <button className={tab==='cash'?'active':''} onClick={()=>setTab('cash')}><Wallet/><span>Efectivo</span>{cashDays.reduce((s,d)=>s+Number(d.amount_due||0),0)>0&&<i>$</i>}</button>
      <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><History/><span>Historial</span></button>
    </nav>

    {showNotifications&&<div className="courier-drawer-backdrop" onClick={()=>setShowNotifications(false)}><aside className="courier-drawer" onClick={e=>e.stopPropagation()}><header><div><small>AVISOS GUTI</small><h2>Notificaciones</h2></div><button onClick={()=>setShowNotifications(false)}>×</button></header><button className="drawer-read" onClick={markNotificationsRead}><CheckCheck/>Marcar todo leído</button><div>{notifications.map(n=><article className={!n.read_at?'unread':''} key={n.id}><Bell/><span><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('es-MX')}</small></span></article>)}</div><button className="drawer-enable" onClick={enableNotifications}>Activar avisos del navegador</button></aside></div>}
  </main>
}
