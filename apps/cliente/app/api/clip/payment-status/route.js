import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime='nodejs'
function fail(message,status=400,extra={}){return NextResponse.json({ok:false,message,...extra},{status})}

export async function GET(request){
  try{
    const clipApiKey=process.env.CLIP_API_KEY
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY
    if(!clipApiKey||!supabaseUrl||!serviceRole)return fail('Configuración incompleta del servidor.',500)

    const auth=request.headers.get('authorization')||''
    const jwt=auth.startsWith('Bearer ')?auth.slice(7):''
    const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:{user}}=await admin.auth.getUser(jwt)
    if(!user)return fail('Tu sesión expiró.',401)

    const paymentId=new URL(request.url).searchParams.get('payment_id')
    if(!paymentId)return fail('Falta payment_id.')

    const {data:payment}=await admin.from('payments').select('*').eq('provider','clip').eq('provider_payment_id',paymentId).eq('user_id',user.id).maybeSingle()
    if(!payment)return fail('No encontramos este pago.',404)
    if(payment.status==='paid'&&payment.order_id)return NextResponse.json({ok:true,status:'paid',order_id:payment.order_id})

    const clipRes=await fetch(`https://api.payclip.com/payments/${encodeURIComponent(paymentId)}`,{
      headers:{Authorization:`Bearer ${clipApiKey}`},cache:'no-store'
    })
    const clip=await clipRes.json().catch(()=>({}))
    const status=String(clip.status||'').toLowerCase()
    if(!clipRes.ok)return fail('No pudimos consultar el pago en Clip.',502,{clip_status:status})
    if(status==='pending')return NextResponse.json({ok:false,clip_status:'pending',message:'La autenticación todavía está pendiente.'},{status:202})
    if(status!=='approved'){
      await admin.from('payments').update({status:status||'failed',status_detail:clip?.status_detail?.code||null,raw_response:{...(payment.raw_response||{}),clip}}).eq('id',payment.id)
      return fail(clip?.status_detail?.message||'El pago no fue aprobado.',402,{clip_status:status})
    }

    const snapshot=payment.raw_response?.guti_checkout
    if(!snapshot)return fail('Pago aprobado, pero falta la información del pedido. Contacta a soporte Guti.',500)
    if(payment.order_id)return NextResponse.json({ok:true,status:'paid',order_id:payment.order_id})

    const {data:order,error:orderError}=await admin.from('orders').insert({
      customer_id:user.id,merchant_id:snapshot.merchant_id,address_id:snapshot.address_id,status:'pending',
      delivery_mode:snapshot.merchant_delivery_mode||'guti',subtotal:Number(snapshot.subtotal),
      delivery_fee:45,discount:0,total:Number(snapshot.total),payment_method:'card',payment_status:'paid',notes:snapshot.notes||''
    }).select().single()
    if(orderError)return fail('Pago aprobado, pero no pudimos crear el pedido. Contacta a soporte Guti.',500,{clip_payment_id:paymentId})

    const {error:itemsError}=await admin.from('order_items').insert((snapshot.items||[]).map(i=>({...i,order_id:order.id})))
    if(itemsError)return fail('Pago aprobado y pedido creado, pero hubo un problema con sus productos.',500,{order_id:order.id})

    await admin.from('payments').update({
      order_id:order.id,status:'paid',status_detail:clip?.status_detail?.code||null,
      last4:clip?.payment_method?.card?.last_digits||null,brand:clip?.payment_method?.id||null,
      paid_at:clip?.approved_at||new Date().toISOString(),raw_response:{...(payment.raw_response||{}),clip}
    }).eq('id',payment.id)

    return NextResponse.json({ok:true,status:'paid',order_id:order.id})
  }catch(error){
    console.error(error)
    return fail('Error inesperado verificando el pago.',500)
  }
}
