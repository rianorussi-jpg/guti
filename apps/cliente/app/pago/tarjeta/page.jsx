'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, LockKeyhole, ShieldCheck, Store, MapPin, AlertCircle } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../../lib/supabase'

export default function CardPaymentPage(){
  const supabase=useMemo(()=>getSupabaseBrowserClient(),[])
  const cardRef=useRef(null)
  const [checkout,setCheckout]=useState(null)
  const [session,setSession]=useState(null)
  const [loading,setLoading]=useState(true)
  const [sdkReady,setSdkReady]=useState(false)
  const [processing,setProcessing]=useState(false)
  const [error,setError]=useState('')
  const [phone,setPhone]=useState('')
  const [threeDS,setThreeDS]=useState(null)
  const [paymentId,setPaymentId]=useState(null)
  const [statusText,setStatusText]=useState('')

  useEffect(()=>{
    let cancelled=false
    async function boot(){
      try{
        const raw=sessionStorage.getItem('guti-clip-checkout')
        if(!raw)throw new Error('No encontramos un pedido pendiente de pago.')
        const payload=JSON.parse(raw)
        setCheckout(payload)

        const {data:{session:s}}=await supabase.auth.getSession()
        if(!s)throw new Error('Tu sesión expiró. Regresa a Guti e inicia sesión.')
        setSession(s)

        const {data:profile}=await supabase.from('profiles').select('phone').eq('id',s.user.id).maybeSingle()
        if(profile?.phone)setPhone(String(profile.phone).replace(/\D/g,'').slice(-10))

        const cfgRes=await fetch('/api/clip/config',{cache:'no-store'})
        const cfg=await cfgRes.json()
        if(!cfgRes.ok||!cfg.apiKey)throw new Error(cfg.message||'Clip no está configurado.')

        if(!window.ClipSDK){
          await new Promise((resolve,reject)=>{
            const existing=document.querySelector('script[data-clip-sdk="true"]')
            if(existing){
              if(window.ClipSDK)return resolve()
              existing.addEventListener('load',resolve,{once:true})
              existing.addEventListener('error',()=>reject(new Error('No se pudo cargar Clip.')),{once:true})
              return
            }
            const script=document.createElement('script')
            script.src='https://sdk.clip.mx/js/clip-sdk.js'
            script.async=true
            script.dataset.clipSdk='true'
            script.onload=resolve
            script.onerror=()=>reject(new Error('No se pudo cargar el SDK de Clip.'))
            document.head.appendChild(script)
          })
        }

        if(cancelled)return
        const clip=new window.ClipSDK(cfg.apiKey)
        const card=clip.element.create('Card',{theme:'light',locale:'es'})
        card.mount('guti-clip-card')
        cardRef.current=card
        setSdkReady(true)
        setLoading(false)
      }catch(err){
        if(!cancelled){
          setLoading(false)
          setError(err?.message||'No pudimos iniciar el pago.')
        }
      }
    }
    boot()
    return ()=>{cancelled=true;cardRef.current=null}
  },[])

  useEffect(()=>{
    if(!threeDS?.url||!paymentId)return
    const expectedOrigin=new URL(threeDS.url).origin
    const listener=async event=>{
      if(event.origin!==expectedOrigin)return
      if(event.data?.paymentId)await verifyPayment(event.data.paymentId)
    }
    window.addEventListener('message',listener)
    return ()=>window.removeEventListener('message',listener)
  },[threeDS?.url,paymentId,session?.access_token])

  function finish(orderId){
    sessionStorage.setItem('guti-clip-payment-result',JSON.stringify({order_id:orderId}))
    sessionStorage.removeItem('guti-clip-checkout')
    window.location.replace('/')
  }

  async function verifyPayment(id=paymentId){
    if(!id||!session)return
    setStatusText('Verificando pago con Clip...')
    const res=await fetch(`/api/clip/payment-status?payment_id=${encodeURIComponent(id)}`,{
      headers:{Authorization:`Bearer ${session.access_token}`},
      cache:'no-store'
    })
    const result=await res.json().catch(()=>({}))
    if(result.ok&&result.status==='paid'&&result.order_id)return finish(result.order_id)
    if(result.clip_status==='pending'){
      setStatusText('Esperando autenticación del banco...')
      return
    }
    setThreeDS(null);setProcessing(false);setStatusText('')
    setError(result.message||'No pudimos confirmar el pago.')
  }

  async function pay(){
    if(processing||!checkout||!session||!cardRef.current)return
    const cleanPhone=phone.replace(/\D/g,'')
    if(cleanPhone.length!==10){
      setError('Escribe un número celular de 10 dígitos.')
      return
    }

    setProcessing(true);setError('');setStatusText('Protegiendo los datos de tu tarjeta...')
    try{
      const token=await cardRef.current.cardToken()
      if(!token?.id)throw new Error('Clip no pudo generar el token de la tarjeta.')

      let preventionData={user_agent:navigator.userAgent,request_3ds:true}
      try{
        const pd=await cardRef.current.preventionData()
        preventionData={
          session_id:pd?.session_id||undefined,
          user_agent:pd?.user_agent||navigator.userAgent,
          request_3ds:true
        }
      }catch{}

      setStatusText('Procesando pago con Clip...')
      const res=await fetch('/api/clip/pay',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({
          card_token:token.id,
          prevention_data:preventionData,
          customer_phone:cleanPhone,
          merchant_id:checkout.merchant_id,
          address_id:checkout.address_id,
          notes:checkout.notes||'',
          items:checkout.items.map(x=>({
            product_id:x.product_id,
            quantity:x.quantity,
            selected_options:x.selected_options||[]
          }))
        })
      })
      const result=await res.json().catch(()=>({}))

      if(result.ok&&result.status==='paid'&&result.order_id)return finish(result.order_id)

      if(result.clip_status==='pending'&&result.pending_action?.url&&result.clip_payment_id){
        setPaymentId(result.clip_payment_id)
        setThreeDS(result.pending_action)
        setStatusText('Tu banco necesita verificar la compra.')
        return
      }

      setProcessing(false);setStatusText('')
      setError(result.message||'Clip no pudo aprobar el pago.')
    }catch(err){
      setProcessing(false);setStatusText('')
      setError(err?.message||'Revisa los datos de tu tarjeta.')
    }
  }

  if(!checkout&&!loading)return <main className="card-pay-page"><section className="card-pay-shell"><div className="card-pay-error"><AlertCircle/><b>{error||'No hay un checkout pendiente.'}</b><button onClick={()=>window.location.replace('/')}>Volver a Guti</button></div></section></main>

  return <main className="card-pay-page">
    <section className="card-pay-shell">
      <header className="card-pay-header">
        <button onClick={()=>window.history.back()}><ArrowLeft/></button>
        <div><small>PAGO SEGURO</small><h1>Tarjeta con Clip</h1></div>
        <span><LockKeyhole/></span>
      </header>

      {checkout&&<section className="card-order-summary">
        <div className="card-merchant">
          <span>{checkout.merchant_logo?<img src={checkout.merchant_logo} alt=""/>:<Store/>}</span>
          <div><small>PEDIDO EN</small><b>{checkout.merchant_name}</b></div>
          <strong>${Number(checkout.total).toFixed(2)}</strong>
        </div>
        <div className="card-address"><MapPin/><div><small>Entregar en</small><b>{checkout.address_label}</b><span>{checkout.address_text}</span></div></div>
      </section>}

      <section className="card-form-panel">
        <div className="card-secure-title"><ShieldCheck/><div><b>Datos protegidos por Clip</b><small>Guti no recibe tu número completo de tarjeta ni CVV.</small></div></div>
        {loading&&<div className="card-pay-loading">Cargando formulario seguro...</div>}
        <div id="guti-clip-card" className="card-clip-mount"/>
        <label className="card-phone-label">Celular del titular</label>
        <input className="card-phone-input" inputMode="numeric" maxLength="10" placeholder="10 dígitos" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}/>
        <p className="card-phone-help">Clip usa correo y teléfono como datos del comprador para el procesamiento y prevención de fraude.</p>
      </section>

      {error&&<div className="card-pay-message error"><AlertCircle/>{error}</div>}
      {statusText&&<div className="card-pay-message status"><ShieldCheck/>{statusText}</div>}

      <button className="card-pay-button" disabled={!sdkReady||processing} onClick={pay}>
        {processing?<span>Procesando...</span>:<><span>Pagar con tarjeta</span><b>${Number(checkout?.total||0).toFixed(2)}</b></>}
      </button>
      <div className="card-powered"><LockKeyhole/> Pago procesado de forma segura por Clip</div>
    </section>

    {threeDS?.url&&<div className="three-ds-overlay">
      <section className="three-ds-shell">
        <header><div><small>VERIFICACIÓN BANCARIA</small><h2>Confirma tu compra</h2></div><button onClick={()=>{setThreeDS(null);setProcessing(false)}}>×</button></header>
        <iframe title="Verificación 3DS" src={threeDS.url}/>
        <footer><span>{statusText||'Esperando a tu banco...'}</span><button onClick={()=>verifyPayment()}>Ya confirmé</button></footer>
      </section>
    </div>}
  </main>
}
