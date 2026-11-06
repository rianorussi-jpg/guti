function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4)
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/')
  const raw=atob(base64)
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))
}
export async function registerGutiServiceWorker(){
  if(typeof window==='undefined'||!('serviceWorker' in navigator))return null
  return navigator.serviceWorker.register('/sw.js',{scope:'/'})
}
export async function enableGutiPush(supabase,userId,app){
  if(typeof window==='undefined'||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))
    throw new Error('Este dispositivo no permite notificaciones push.')
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if(!publicKey)throw new Error('Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY.')
  const permission=await Notification.requestPermission()
  if(permission!=='granted')throw new Error('No se concedió permiso para notificaciones.')
  const reg=await registerGutiServiceWorker()
  let sub=await reg.pushManager.getSubscription()
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(publicKey)})
  const json=sub.toJSON()
  const {error}=await supabase.from('push_subscriptions').upsert({
    user_id:userId,endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,
    app,user_agent:navigator.userAgent,is_active:true,updated_at:new Date().toISOString()
  },{onConflict:'endpoint'})
  if(error)throw error
  return sub
}
