import {NextResponse} from 'next/server'
import {getAdminClient,requireGutiAdmin} from '../_server'
export const runtime='nodejs'
export async function POST(request){
 try{
  const admin=getAdminClient();const gate=await requireGutiAdmin(request,admin);if(gate.error)return NextResponse.json({error:gate.error},{status:gate.status})
  const key=process.env.CLIP_API_KEY;if(!key)return NextResponse.json({error:'Falta CLIP_API_KEY en Guti Admin.'},{status:500})
  const body=await request.json().catch(()=>({}));const limit=Math.min(150,Math.max(1,Number(body.limit||80)))
  const {data:rows,error}=await admin.from('payments').select('id,provider_payment_id,order_id,status').eq('provider','clip').not('provider_payment_id','is',null).order('created_at',{ascending:false}).limit(limit)
  if(error)throw error
  let checked=0,mismatches=0
  for(const p of rows||[]){
   try{
    const res=await fetch(`https://api.payclip.com/payments/${encodeURIComponent(p.provider_payment_id)}`,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'})
    const clip=await res.json().catch(()=>({}));if(!res.ok)continue
    const clipStatus=String(clip.status||'').toLowerCase();checked++
    await admin.from('payments').update({provider_last_status:clipStatus,provider_checked_at:new Date().toISOString()}).eq('id',p.id)
    if(p.order_id){const {data:o}=await admin.from('orders').select('payment_status').eq('id',p.order_id).maybeSingle();if((clipStatus==='approved')!==(String(o?.payment_status||'')==='paid'))mismatches++}
    else if(clipStatus==='approved')mismatches++
   }catch{}
  }
  return NextResponse.json({ok:true,checked,mismatches})
 }catch(e){return NextResponse.json({error:e.message||'No se pudo conciliar Clip.'},{status:e.status||500})}
}
