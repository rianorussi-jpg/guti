'use client'
import {useEffect,useMemo,useState} from 'react'
import {getSupabaseBrowserClient} from '../lib/supabase'

const money=n=>`$${Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2})}`
const labels={pending:'Pendiente',accepted:'Aceptado',preparing:'Preparando',ready:'Listo',assigned:'Asignado',picked_up:'Recogido',on_the_way:'En camino',delivered:'Entregado',cancelled:'Cancelado'}
const merchantInitial={name:'',slug:'',merchant_type:'restaurant',description:'',phone:'',address:'',delivery_mode:'guti',commission_percent:'10',prep_minutes:'25',owner_name:'',owner_email:'',owner_phone:'',owner_password:'',open_time:'09:00',close_time:'21:00',bank_name:'',bank_account_holder:'',bank_clabe:''}
const courierInitial={full_name:'',email:'',phone:'',password:'',vehicle_type:'Moto',bank_name:'',bank_account_holder:'',bank_clabe:''}

export default function Page(){
 const supabase=useMemo(()=>getSupabaseBrowserClient(),[])
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('')
 const [tab,setTab]=useState('home'),[orders,setOrders]=useState([]),[fin,setFin]=useState([]),[merchants,setMerchants]=useState([]),[couriers,setCouriers]=useState([]),[selected,setSelected]=useState(null),[msg,setMsg]=useState('')
 const [showMerchant,setShowMerchant]=useState(false),[merchantForm,setMerchantForm]=useState(merchantInitial),[merchantBusy,setMerchantBusy]=useState(false),[logoFile,setLogoFile]=useState(null),[coverFile,setCoverFile]=useState(null)
 const [showCourier,setShowCourier]=useState(false),[courierForm,setCourierForm]=useState(courierInitial),[courierBusy,setCourierBusy]=useState(false)
 const [settlements,setSettlements]=useState([]),[cashDeposits,setCashDeposits]=useState([]),[financeBusy,setFinanceBusy]=useState(false)

 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)load()})
  const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>{setSession(x);if(x)load()})
  const ch=supabase.channel('admin-live').on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>load()).subscribe()
  return()=>{s.subscription.unsubscribe();supabase.removeChannel(ch)}
 },[])

 async function login(e){e.preventDefault();setMsg('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMsg(error.message)}
 async function load(){
  const [o,f,m,c,s,d]=await Promise.all([
   supabase.from('orders').select('*,merchants(name)').order('created_at',{ascending:false}).limit(250),
   supabase.from('order_financials').select('*').order('created_at',{ascending:false}).limit(250),
   supabase.from('merchants').select('*').order('name'),
   supabase.from('courier_profiles').select('*,profiles!courier_profiles_user_id_fkey(full_name,phone)').order('updated_at',{ascending:false}),
   supabase.from('weekly_settlements').select('*,merchants(name),profiles!weekly_settlements_courier_id_fkey(full_name)').order('week_start',{ascending:false}).limit(300),
   supabase.from('courier_cash_deposits').select('*,profiles!courier_cash_deposits_courier_id_fkey(full_name,phone)').order('submitted_at',{ascending:false}).limit(200)
  ])
  if(o.error)return setMsg(o.error.message)
  setOrders(o.data||[]);setFin(f.data||[]);setMerchants(m.data||[]);setCouriers(c.data||[]);setSettlements(s.data||[]);setCashDeposits(d.data||[])
 }
 async function setStatus(o,status){const {error}=await supabase.from('orders').update({status,...(status==='delivered'?{delivered_at:new Date().toISOString()}:{})}).eq('id',o.id);if(error)return setMsg(error.message);setSelected(null);load()}
 async function assign(o,id){const {error}=await supabase.from('orders').update({courier_id:id||null,delivery_mode:'guti',status:id?'assigned':'ready'}).eq('id',o.id);if(error)return setMsg(error.message);setSelected(null);load()}

 async function apiPost(path,body){
  const token=session?.access_token
  if(!token)throw new Error('Tu sesión expiró.')
  const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)})
  const data=await res.json().catch(()=>({}))
  if(!res.ok)throw new Error(data.error||'No se pudo completar la operación.')
  return data
 }

 function slugify(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)}
 function merchantChange(k,v){setMerchantForm(p=>({...p,[k]:v,...(k==='name'&&!p.slug?{slug:slugify(v)}:{})}))}

 async function uploadMerchantMedia(merchantId,file,kind){
  if(!file)return null
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')
  const path=`${merchantId}/${kind}-${Date.now()}.${ext}`
  const {error}=await supabase.storage.from('merchant-media').upload(path,file,{upsert:true,contentType:file.type||undefined})
  if(error)throw error
  return supabase.storage.from('merchant-media').getPublicUrl(path).data.publicUrl
 }

 async function createMerchant(e){
  e.preventDefault();setMerchantBusy(true);setMsg('')
  try{
   const data=await apiPost('/api/admin/create-merchant',{
    ...merchantForm,
    commission_percent:Number(merchantForm.commission_percent||10),
    prep_minutes:Number(merchantForm.prep_minutes||25)
   })
   let logo_url=null,cover_url=null
   try{
    ;[logo_url,cover_url]=await Promise.all([uploadMerchantMedia(data.merchant.id,logoFile,'logo'),uploadMerchantMedia(data.merchant.id,coverFile,'cover')])
    if(logo_url||cover_url){
     const patch={};if(logo_url)patch.logo_url=logo_url;if(cover_url)patch.cover_url=cover_url
     const {error}=await supabase.from('merchants').update(patch).eq('id',data.merchant.id)
     if(error)throw error
    }
   }catch(mediaError){setMsg(`Negocio creado, pero no se pudieron subir una o más imágenes: ${mediaError.message}`)}
   if(!msg)setMsg(`Negocio “${merchantForm.name}” creado. El dueño ya puede entrar a Guti Negocios con ${merchantForm.owner_email}.`)
   setShowMerchant(false);setMerchantForm(merchantInitial);setLogoFile(null);setCoverFile(null);await load()
  }catch(err){setMsg(err.message)}finally{setMerchantBusy(false)}
 }

 async function createCourier(e){
  e.preventDefault();setCourierBusy(true);setMsg('')
  try{
   await apiPost('/api/admin/create-courier',courierForm)
   setMsg(`Repartidor ${courierForm.full_name} registrado y aprobado. Ya puede iniciar sesión.`)
   setShowCourier(false);setCourierForm(courierInitial);await load()
  }catch(err){setMsg(err.message)}finally{setCourierBusy(false)}
 }

 async function generateSettlements(){
  setFinanceBusy(true);setMsg('')
  const {data,error}=await supabase.rpc('admin_generate_weekly_settlements',{p_week_start:null})
  setFinanceBusy(false)
  if(error)return setMsg(error.message)
  setMsg(`Liquidaciones actualizadas: ${data||0}.`)
  await load()
 }
 async function markSettlementPaid(id){
  if(!confirm('¿Confirmar que esta transferencia ya fue enviada?'))return
  setFinanceBusy(true)
  const {error}=await supabase.rpc('admin_mark_settlement_paid',{p_settlement_id:id})
  setFinanceBusy(false)
  if(error)return setMsg(error.message)
  setMsg('Liquidación marcada como pagada.');await load()
 }
 async function reviewDeposit(id,approve){
  const note=approve?'':(prompt('Motivo del rechazo / nota para el repartidor:')||'Requiere revisión.')
  if(!approve&&!note)return
  setFinanceBusy(true)
  const {error}=await supabase.rpc('admin_confirm_cash_deposit',{p_deposit_id:id,p_confirm:approve,p_note:note})
  setFinanceBusy(false)
  if(error)return setMsg(error.message)
  setMsg(approve?'Depósito confirmado.':'Depósito rechazado y regresado al saldo del repartidor.')
  await load()
 }

 const sum=k=>fin.reduce((a,x)=>a+Number(x[k]||0),0),active=orders.filter(o=>!['delivered','cancelled'].includes(o.status))
 if(!session)return <main className="login"><form onSubmit={login}><div className="logo">Guti<span>.mx</span></div><small>PANEL ADMIN</small><h1>Centro de operación</h1><p>Gutiérrez Zamora</p><input type="email" placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/><button>Entrar</button>{msg&&<em>{msg}</em>}</form></main>

 return <div className="layout"><aside><div className="logo">Guti<span>.mx</span></div><i>● Operación en vivo</i>{[['home','Resumen'],['orders','Pedidos'],['money','Finanzas'],['settlements','Liquidaciones'],['merchants','Negocios'],['couriers','Repartidores']].map(([a,b])=><button key={a} className={tab===a?'on':''} onClick={()=>setTab(a)}>{b}</button>)}<button onClick={()=>supabase.auth.signOut()}>Salir</button></aside><main>
  <header><div><small>GUTIÉRREZ ZAMORA</small><h1>{{home:'Centro de operación',orders:'Pedidos',money:'Finanzas',settlements:'Liquidaciones y efectivo',merchants:'Negocios',couriers:'Repartidores'}[tab]}</h1></div><div className="header-actions">{tab==='merchants'&&<button className="primary" onClick={()=>setShowMerchant(true)}>+ Crear negocio</button>}{tab==='couriers'&&<button className="primary" onClick={()=>setShowCourier(true)}>+ Registrar repartidor</button>}<button onClick={load}>↻ Actualizar</button></div></header>
  {msg&&<div className="alert">{msg}<button onClick={()=>setMsg('')}>×</button></div>}
  {tab==='home'&&<><section className="kpis"><article><small>Venta procesada</small><b>{money(sum('customer_total'))}</b></article><article><small>Ingreso Guti</small><b>{money(sum('guti_revenue'))}</b></article><article><small>Neto negocios</small><b>{money(sum('merchant_net'))}</b></article><article><small>Reparto</small><b>{money(sum('courier_payable'))}</b></article></section><section className="panel"><div className="head"><h2>Pedidos activos</h2><span>{active.length}</span></div>{active.map(o=><button className="feed" key={o.id} onClick={()=>setSelected(o)}><div><b>{o.merchants?.name}</b><small>#{o.id.slice(0,7)}</small></div><mark>{labels[o.status]||o.status}</mark><strong>{money(o.total)}</strong></button>)}</section></>}
  {tab==='orders'&&<section className="panel table"><table><thead><tr><th>Pedido</th><th>Negocio</th><th>Pago</th><th>Total</th><th>Estado</th><th/></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>#{o.id.slice(0,7)}</td><td>{o.merchants?.name}</td><td>{o.payment_method}<small>{o.payment_status}</small></td><td>{money(o.total)}</td><td><mark>{labels[o.status]}</mark></td><td><button onClick={()=>setSelected(o)}>Gestionar</button></td></tr>)}</tbody></table></section>}
  {tab==='money'&&<><section className="kpis"><article><small>GMV</small><b>{money(sum('customer_total'))}</b></article><article><small>Comisión</small><b>{money(sum('commission_amount'))}</b></article><article><small>Negocios</small><b>{money(sum('merchant_net'))}</b></article><article><small>Repartidores</small><b>{money(sum('courier_payable'))}</b></article></section><section className="panel table"><table><thead><tr><th>Pedido</th><th>Subtotal</th><th>Envío</th><th>Comisión</th><th>Negocio</th><th>Repartidor</th><th>Guti</th></tr></thead><tbody>{fin.map(f=><tr key={f.order_id}><td>#{f.order_id.slice(0,7)}</td><td>{money(f.subtotal)}</td><td>{money(f.delivery_fee)}</td><td>{money(f.commission_amount)}</td><td>{money(f.merchant_net)}</td><td>{money(f.courier_payable)}</td><td><b>{money(f.guti_revenue)}</b></td></tr>)}</tbody></table></section></>}
  {tab==='settlements'&&<>
    <div className="section-intro"><div><b>Pagos de los lunes</b><span>Genera la semana anterior, revisa datos bancarios y confirma las transferencias.</span></div><button onClick={generateSettlements} disabled={financeBusy}>↻ Generar semana anterior</button></div>
    <section className="finance-mini-kpis"><article><small>Liquidaciones pendientes</small><b>${settlements.filter(s=>s.status==='pending').reduce((a,s)=>a+Number(s.amount||0),0).toFixed(2)}</b></article><article><small>Depósitos efectivo por confirmar</small><b>${cashDeposits.filter(d=>d.status==='pending').reduce((a,d)=>a+Number(d.amount||0),0).toFixed(2)}</b></article></section>
    <section className="panel table"><div className="head"><h2>Liquidaciones semanales</h2><span>{settlements.filter(s=>s.status==='pending').length} pendientes</span></div><table><thead><tr><th>Beneficiario</th><th>Semana</th><th>Pedidos</th><th>Banco</th><th>Monto</th><th>Estado</th><th/></tr></thead><tbody>{settlements.map(s=><tr key={s.id}><td><b>{s.beneficiary_type==='merchant'?(s.merchants?.name||'Negocio'):(s.profiles?.full_name||'Repartidor')}</b><small>{s.beneficiary_type==='merchant'?'Negocio':'Repartidor'}</small></td><td>{s.week_start} – {s.week_end}</td><td>{s.order_count}</td><td><b>{s.bank_name||'Sin banco'}</b><small>{s.bank_account_holder||''} {s.bank_clabe?`· ••••${s.bank_clabe.slice(-4)}`:'· Sin CLABE'}</small></td><td><b>{money(s.amount)}</b></td><td><mark>{s.status==='paid'?'Pagado':'Pendiente'}</mark></td><td>{s.status==='pending'&&<button onClick={()=>markSettlementPaid(s.id)}>Marcar pagado</button>}</td></tr>)}</tbody></table></section>
    <section className="panel table cash-admin-table"><div className="head"><h2>Depósitos diarios de repartidores</h2><span>{cashDeposits.filter(d=>d.status==='pending').length} por revisar</span></div><table><thead><tr><th>Repartidor</th><th>Día</th><th>Importe</th><th>Referencia</th><th>Estado</th><th/></tr></thead><tbody>{cashDeposits.map(d=><tr key={d.id}><td><b>{d.profiles?.full_name||'Repartidor'}</b><small>{d.profiles?.phone||''}</small></td><td>{d.business_date}</td><td><b>{money(d.amount)}</b></td><td>{d.reference||'—'}</td><td><mark>{d.status==='confirmed'?'Confirmado':d.status==='rejected'?'Rechazado':'Pendiente'}</mark></td><td>{d.status==='pending'&&<div className="deposit-admin-actions"><button onClick={()=>reviewDeposit(d.id,true)}>Confirmar recibido</button><button className="danger-mini" onClick={()=>reviewDeposit(d.id,false)}>Rechazar</button></div>}</td></tr>)}</tbody></table></section>
  </>}

  {tab==='merchants'&&<><div className="section-intro"><div><b>{merchants.length} negocios</b><span>Desde aquí puedes dar de alta un negocio completo y su cuenta de acceso.</span></div><button onClick={()=>setShowMerchant(true)}>+ Nuevo negocio</button></div><section className="cards merchant-cards">{merchants.map(m=><article key={m.id}><div className="entity-avatar">{m.logo_url?<img src={m.logo_url} alt=""/>:m.name?.[0]}</div><div className="entity-copy"><b>{m.name}</b><small>{m.merchant_type||'Negocio'} · {m.delivery_mode==='merchant'?'Reparto propio':'Reparto Guti'}</small><em>{m.phone||'Sin teléfono'} · {m.commission_percent||10}% comisión</em></div><span className={m.is_active?'entity-status active':'entity-status'}>{m.is_active?'Activo':'Inactivo'}</span></article>)}</section></>}
  {tab==='couriers'&&<><div className="section-intro"><div><b>{couriers.length} repartidores</b><span>Regístralos con su cuenta, teléfono, vehículo y aprobación.</span></div><button onClick={()=>setShowCourier(true)}>+ Nuevo repartidor</button></div><section className="cards courier-cards">{couriers.map(c=><article key={c.user_id}><div className="entity-avatar">{c.profiles?.full_name?.[0]||'R'}</div><div className="entity-copy"><b>{c.profiles?.full_name||'Repartidor'}</b><small>{c.vehicle_type||'Vehículo sin especificar'}</small><em>{c.profiles?.phone||'Sin teléfono'}</em></div><span className={c.is_approved?'entity-status active':'entity-status'}>{c.is_approved?'Aprobado':'Pendiente'}</span></article>)}</section></>}
 </main>
 {selected&&<div className="back" onClick={()=>setSelected(null)}><section className="modal" onClick={e=>e.stopPropagation()}><button className="x" onClick={()=>setSelected(null)}>×</button><small>PEDIDO #{selected.id.slice(0,8)}</small><h2>{selected.merchants?.name}</h2><h3>{money(selected.total)}</h3><div className={`admin-payment-summary ${selected.payment_method==='cash'?'cash':''}`}><b>{selected.payment_method==='cash'?'Efectivo':selected.payment_method}</b><span>{selected.payment_method==='cash'?(selected.cash_collected_at?`Cobrado por repartidor: ${money(selected.cash_collected_amount)}`:`Pendiente de cobrar: ${money(selected.total)}`):(selected.payment_status==='paid'?'Pago confirmado':'Pago no confirmado')}</span></div><label>Repartidor<select value={selected.courier_id||''} onChange={e=>assign(selected,e.target.value)}><option value="">Sin asignar</option>{couriers.map(c=><option key={c.user_id} value={c.user_id}>{c.profiles?.full_name||c.user_id.slice(0,8)}</option>)}</select></label><div className="actions"><button onClick={()=>setStatus(selected,'cancelled')}>Cancelar</button><button onClick={()=>setStatus(selected,'delivered')}>Marcar entregado</button></div></section></div>}
 {showMerchant&&<div className="back form-back" onClick={()=>!merchantBusy&&setShowMerchant(false)}><form className="create-modal merchant-form" onSubmit={createMerchant} onClick={e=>e.stopPropagation()}><button type="button" className="x" onClick={()=>setShowMerchant(false)}>×</button><small>ALTA DE NEGOCIO</small><h2>Crear negocio completo</h2><p>Se creará el negocio y también la cuenta del dueño para Guti Negocios.</p>
   <h3>Información del negocio</h3><div className="form-grid"><label>Nombre<input required value={merchantForm.name} onChange={e=>merchantChange('name',e.target.value)} placeholder="Ej. Tacos El Centro"/></label><label>Slug<input required value={merchantForm.slug} onChange={e=>merchantChange('slug',slugify(e.target.value))} placeholder="tacos-el-centro"/></label><label>Tipo<select value={merchantForm.merchant_type} onChange={e=>merchantChange('merchant_type',e.target.value)}><option value="restaurant">Restaurante</option><option value="store">Tienda / Súper</option><option value="pharmacy">Farmacia</option><option value="other">Otro</option></select></label><label>Teléfono<input value={merchantForm.phone} onChange={e=>merchantChange('phone',e.target.value)} placeholder="10 dígitos"/></label><label className="wide">Dirección<input required value={merchantForm.address} onChange={e=>merchantChange('address',e.target.value)} placeholder="Dirección completa en Gutiérrez Zamora"/></label><label className="wide">Descripción<textarea value={merchantForm.description} onChange={e=>merchantChange('description',e.target.value)} placeholder="Qué vende, especialidad, etc."/></label><label>Reparto<select value={merchantForm.delivery_mode} onChange={e=>merchantChange('delivery_mode',e.target.value)}><option value="guti">Repartidores Guti</option><option value="merchant">Reparto propio</option></select></label><label>Comisión Guti (%)<input type="number" min="0" max="100" step="0.5" value={merchantForm.commission_percent} onChange={e=>merchantChange('commission_percent',e.target.value)}/></label><label>Preparación estimada<input type="number" min="5" max="180" value={merchantForm.prep_minutes} onChange={e=>merchantChange('prep_minutes',e.target.value)}/></label><label>Horario inicial<div className="time-pair"><input type="time" value={merchantForm.open_time} onChange={e=>merchantChange('open_time',e.target.value)}/><input type="time" value={merchantForm.close_time} onChange={e=>merchantChange('close_time',e.target.value)}/></div></label></div>
   <h3>Imágenes</h3><div className="upload-grid"><label><span>Logo</span><input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files?.[0]||null)}/><em>{logoFile?.name||'PNG, JPG o WebP'}</em></label><label><span>Portada</span><input type="file" accept="image/*" onChange={e=>setCoverFile(e.target.files?.[0]||null)}/><em>{coverFile?.name||'Imagen horizontal'}</em></label></div>
   <h3>Cuenta bancaria para liquidaciones</h3><div className="form-grid"><label>Banco<input value={merchantForm.bank_name} onChange={e=>merchantChange('bank_name',e.target.value)} placeholder="BBVA, Santander..."/></label><label>Titular<input value={merchantForm.bank_account_holder} onChange={e=>merchantChange('bank_account_holder',e.target.value)} placeholder="Nombre del titular"/></label><label className="wide">CLABE (18 dígitos)<input inputMode="numeric" maxLength="18" value={merchantForm.bank_clabe} onChange={e=>merchantChange('bank_clabe',e.target.value.replace(/\D/g,'').slice(0,18))} placeholder="000000000000000000"/></label></div>
   <h3>Cuenta del dueño</h3><div className="form-grid"><label>Nombre completo<input required value={merchantForm.owner_name} onChange={e=>merchantChange('owner_name',e.target.value)}/></label><label>Celular<input required value={merchantForm.owner_phone} onChange={e=>merchantChange('owner_phone',e.target.value)}/></label><label>Correo<input required type="email" value={merchantForm.owner_email} onChange={e=>merchantChange('owner_email',e.target.value)}/></label><label>Contraseña temporal<input required minLength="8" type="text" value={merchantForm.owner_password} onChange={e=>merchantChange('owner_password',e.target.value)} placeholder="Mínimo 8 caracteres"/></label></div><div className="form-note">El dueño podrá iniciar sesión inmediatamente en gutinegocio.enla.mx y después cambiar su información, horarios, catálogo, logo y portada.</div><button className="submit-create" disabled={merchantBusy}>{merchantBusy?'Creando negocio...':'Crear negocio y cuenta'}</button>
  </form></div>}
 {showCourier&&<div className="back form-back" onClick={()=>!courierBusy&&setShowCourier(false)}><form className="create-modal courier-form" onSubmit={createCourier} onClick={e=>e.stopPropagation()}><button type="button" className="x" onClick={()=>setShowCourier(false)}>×</button><small>ALTA DE REPARTIDOR</small><h2>Registrar repartidor</h2><p>La cuenta quedará aprobada y podrá ver los pedidos disponibles al iniciar sesión.</p><div className="form-grid"><label className="wide">Nombre completo<input required value={courierForm.full_name} onChange={e=>setCourierForm(p=>({...p,full_name:e.target.value}))}/></label><label>Celular<input required value={courierForm.phone} onChange={e=>setCourierForm(p=>({...p,phone:e.target.value}))} placeholder="10 dígitos"/></label><label>Vehículo<select value={courierForm.vehicle_type} onChange={e=>setCourierForm(p=>({...p,vehicle_type:e.target.value}))}><option>Moto</option><option>Bicicleta</option><option>Automóvil</option><option>A pie</option><option>Otro</option></select></label><label>Correo<input required type="email" value={courierForm.email} onChange={e=>setCourierForm(p=>({...p,email:e.target.value}))}/></label><label>Contraseña temporal<input required minLength="8" type="text" value={courierForm.password} onChange={e=>setCourierForm(p=>({...p,password:e.target.value}))}/></label><label>Banco<input value={courierForm.bank_name} onChange={e=>setCourierForm(p=>({...p,bank_name:e.target.value}))}/></label><label>Titular<input value={courierForm.bank_account_holder} onChange={e=>setCourierForm(p=>({...p,bank_account_holder:e.target.value}))}/></label><label className="wide">CLABE (18 dígitos)<input inputMode="numeric" maxLength="18" value={courierForm.bank_clabe} onChange={e=>setCourierForm(p=>({...p,bank_clabe:e.target.value.replace(/\D/g,'').slice(0,18)}))}/></label></div><div className="form-note">No necesita activar estado Online/Offline. Al iniciar sesión verá la cola de pedidos, pero no podrá tomar otro mientras tenga una entrega activa.</div><button className="submit-create" disabled={courierBusy}>{courierBusy?'Registrando...':'Registrar y aprobar repartidor'}</button></form></div>}
 </div>
}