'use client'
import { useEffect, useRef, useState } from 'react'

export default function ClipIsolatedTest(){
  const [state,setState]=useState({
    loading:true,
    apiKey:false,
    apiPrefix:'',
    sdk:false,
    global:false,
    card:false,
    mounted:false,
    iframes:0,
    error:'',
    token:'',
    prevention:''
  })
  const cardRef=useRef(null)

  useEffect(()=>{
    let cancelled=false
    let observer=null

    async function run(){
      try{
        const cfgRes=await fetch('/api/clip/config',{cache:'no-store'})
        const cfg=await cfgRes.json()
        if(!cfgRes.ok||!cfg.apiKey)throw new Error(cfg.message||'No se encontró CLIP_API_KEY.')
        if(cancelled)return
        setState(s=>({...s,apiKey:true,apiPrefix:String(cfg.apiKey).slice(0,9)}))

        if(!window.ClipSDK){
          await new Promise((resolve,reject)=>{
            const script=document.createElement('script')
            script.src='https://sdk.clip.mx/js/clip-sdk.js'
            script.async=true
            script.onload=resolve
            script.onerror=()=>reject(new Error('No se pudo cargar clip-sdk.js'))
            document.head.appendChild(script)
          })
        }
        if(cancelled)return

        setState(s=>({...s,sdk:true,global:!!window.ClipSDK}))
        if(!window.ClipSDK)throw new Error('window.ClipSDK no existe después de cargar el script.')

        const clip=new window.ClipSDK(cfg.apiKey)
        const card=clip.element.create("Card",{theme:"light",locale:"es"})
        cardRef.current=card
        setState(s=>({...s,card:true}))

        const mount=document.getElementById('clip-isolated-card')
        if(!mount)throw new Error('No existe #clip-isolated-card')

        card.mount("clip-isolated-card")
        setState(s=>({...s,mounted:true,loading:false}))

        observer=new MutationObserver(()=>{
          setState(s=>({...s,iframes:mount.querySelectorAll('iframe').length}))
        })
        observer.observe(mount,{childList:true,subtree:true})

        setTimeout(()=>{
          if(cancelled)return
          setState(s=>({...s,iframes:mount.querySelectorAll('iframe').length}))
        },1200)
      }catch(err){
        if(!cancelled)setState(s=>({...s,loading:false,error:err?.message||String(err)}))
      }
    }

    run()
    return ()=>{
      cancelled=true
      observer?.disconnect?.()
      cardRef.current=null
    }
  },[])

  async function makeToken(){
    if(!cardRef.current)return
    try{
      setState(s=>({...s,error:'',token:'',prevention:''}))
      const token=await cardRef.current.cardToken()
      let prevention=''
      try{
        if(typeof cardRef.current.preventionData==='function'){
          const pd=await cardRef.current.preventionData()
          prevention=typeof pd==='string'?pd:JSON.stringify(pd)
        }
      }catch{}
      setState(s=>({...s,token:token?.id||'',prevention}))
    }catch(err){
      setState(s=>({...s,error:`${err?.code?err.code+': ':''}${err?.message||String(err)}`}))
    }
  }

  return <main className="clip-isolated-page">
    <section className="clip-isolated-card">
      <small>GUTI.MX · DIAGNÓSTICO</small>
      <h1>Prueba aislada de Clip</h1>
      <p>Esta página no usa el modal del checkout. Solo carga el SDK oficial de Clip y monta el elemento Card.</p>

      <div id="clip-isolated-card" className="clip-isolated-mount"/>

      <button disabled={!state.mounted} onClick={makeToken}>Generar Card Token</button>

      <div className="clip-isolated-status">
        <div><span>Origen</span><b>{typeof window!=='undefined'?window.location.origin:'—'}</b></div>
        <div><span>API Key</span><b>{state.apiKey?`${state.apiPrefix}••••`:'No'}</b></div>
        <div><span>SDK script</span><b>{state.sdk?'Sí':'No'}</b></div>
        <div><span>window.ClipSDK</span><b>{state.global?'Sí':'No'}</b></div>
        <div><span>Card creado</span><b>{state.card?'Sí':'No'}</b></div>
        <div><span>Card montado</span><b>{state.mounted?'Sí':'No'}</b></div>
        <div><span>iframes</span><b>{state.iframes}</b></div>
        <div><span>Card Token</span><b>{state.token?`${state.token.slice(0,18)}••••`:'—'}</b></div>
        <div><span>Prevention Data</span><b>{state.prevention?'Generado':'—'}</b></div>
        <div><span>Error</span><b>{state.error||'Ninguno'}</b></div>
      </div>

      <p className="clip-isolated-note">Si dentro del recuadro aparece “This page couldn’t load” y todos los valores anteriores salen en Sí, el fallo está ocurriendo dentro del iframe servido por Clip, no en el modal de Guti.</p>
    </section>
  </main>
}
