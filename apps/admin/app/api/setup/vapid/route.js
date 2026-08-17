import {NextResponse} from 'next/server'
import webpush from 'web-push'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(){
  try{
    const keys=webpush.generateVAPIDKeys()

    return NextResponse.json({
      ok:true,
      warning:'Copia estas claves a Vercel y después elimina esta ruta temporal.',
      variables:{
        NEXT_PUBLIC_VAPID_PUBLIC_KEY:keys.publicKey,
        VAPID_PRIVATE_KEY:keys.privateKey,
        VAPID_SUBJECT:'mailto:soporte@guti.mx'
      }
    },{
      headers:{
        'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma':'no-cache',
        'Expires':'0'
      }
    })
  }catch(error){
    console.error(error)
    return NextResponse.json({
      ok:false,
      message:error?.message||'No se pudieron generar las claves VAPID'
    },{status:500})
  }
}
