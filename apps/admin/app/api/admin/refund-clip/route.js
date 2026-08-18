import {NextResponse} from 'next/server'
import {randomUUID} from 'node:crypto'
import {getAdminClient,requireGutiAdmin} from '../_server'
export const runtime='nodejs'
export async function POST(request){
 try{
  const admin=getAdminClient();const gate=await requireGutiAdmin(request,admin);if(gate.error)return NextResponse.json({error:gate.error},{status:gate.status})
  const key=process.env.CLIP_API_KEY;if(!key)return NextResponse.json({error:'Falta CLIP_API_KEY en Guti Admin.'},{status:500})
  const {order_id,reason}=await request.json();if(!order_id)return NextResponse.json({error:'Falta order_id.'},{status:400})
  const {data:order}=await admin.from('orders').select('id,total,payment_method,payment_status,refund_status').eq('id',order_id).maybeSingle()
  if(!order||order.payment_method!=='card'||order.payment_status!=='paid')return NextResponse.json({error:'El pedido no tiene un pago de tarjeta reembolsable.'},{status:409})
  const {data:payment}=await admin.from('payments').select('*').eq('order_id',order_id).eq('provider','clip').order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(!payment?.provider_payment_id)return NextResponse.json({error:'No encontramos el ID de pago de Clip.'},{status:404})
  const {data:existing}=await admin.from('payment_refunds').select('*').eq('order_id',order_id).in('status',['requested','approved']).limit(1).maybeSingle()
  if(existing)return NextResponse.json({error:'Este pedido ya tiene un reembolso solicitado o aprobado.'},{status:409})
  const idem=randomUUID();const body={amount:Number(payment.amount||order.total),currency:'MXN',reference:{type:'payment',id:payment.provider_payment_id},reason:String(reason||'Reembolso autorizado por Guti Admin').slice(0,180)}
  const res=await fetch('https://api.payclip.com/refunds',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','idempotency-key':idem},body:JSON.stringify(body),cache:'no-store'})
  const clip=await res.json().catch(()=>({}));const status=String(clip.status||'declined').toLowerCase()
  await admin.from('payment_refunds').insert({order_id,payment_id:payment.id,provider_refund_id:clip.id||null,amount:body.amount,reason:body.reason,status,status_message:clip.status_message||clip.message||null,requested_by:gate.user.id,processed_at:new Date().toISOString(),raw_response:clip})
  if(res.ok&&status==='approved'){
   await admin.from('orders').update({refund_status:'refunded',refunded_at:new Date().toISOString()}).eq('id',order_id)
   await admin.from('payments').update({status:'refunded',provider_last_status:'refunded',provider_checked_at:new Date().toISOString()}).eq('id',payment.id)
  }
  if(!res.ok||status!=='approved')return NextResponse.json({error:clip.detail?.[0]||clip.message||clip.status_message||'Clip no aprobó el reembolso.',clip},{status:409})
  return NextResponse.json({ok:true,refund:clip})
 }catch(e){return NextResponse.json({error:e.message||'No se pudo procesar el reembolso.'},{status:500})}
}