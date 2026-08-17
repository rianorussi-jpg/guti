import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime='nodejs'
const DELIVERY_FEE=45
const fail=(message,status=400,extra={})=>NextResponse.json({ok:false,message,...extra},{status})

export async function POST(request){
  try{
    const clipApiKey=process.env.CLIP_API_KEY
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY
    if(!clipApiKey)return fail('Falta CLIP_API_KEY en Vercel.',500)
    if(!supabaseUrl||!serviceRole)return fail('Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.',500)
    const auth=request.headers.get('authorization')||''
    const jwt=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!jwt)return fail('Sesión no válida.',401)
    const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:{user},error:userError}=await admin.auth.getUser(jwt)
    if(userError||!user)return fail('Tu sesión expiró. Inicia sesión de nuevo.',401)
    const body=await request.json()
    const cardToken=String(body.card_token||''), merchantId=String(body.merchant_id||''), addressId=String(body.address_id||'')
    const requestedItems=Array.isArray(body.items)?body.items:[]
    if(!cardToken||!merchantId||!addressId||!requestedItems.length)return fail('Faltan datos para procesar el pago.')
    const {data:address}=await admin.from('addresses').select('id').eq('id',addressId).eq('user_id',user.id).maybeSingle()
    if(!address)return fail('La dirección seleccionada no es válida.',403)
    const {data:merchant}=await admin.from('merchants').select('id,name,delivery_mode,is_active,accepts_orders').eq('id',merchantId).maybeSingle()
    if(!merchant||!merchant.is_active)return fail('Este negocio no está disponible.')
    if(merchant.accepts_orders===false)return fail('Este negocio está pausado y no recibe pedidos.')
    const productIds=[...new Set(requestedItems.map(i=>String(i.product_id||'')).filter(Boolean))]
    const {data:products,error:productsError}=await admin.from('products').select('id,merchant_id,name,price,is_available').in('id',productIds).eq('merchant_id',merchantId)
    if(productsError)return fail('No pudimos validar los productos.',500)
    const productMap=new Map((products||[]).map(p=>[p.id,p]))
    let subtotal=0; const normalizedItems=[]
    for(const reqItem of requestedItems){
      const product=productMap.get(String(reqItem.product_id)); const quantity=Math.max(1,Math.min(25,Number(reqItem.quantity)||1))
      if(!product||product.is_available===false)return fail('Uno de los productos ya no está disponible.')
      const selected=Array.isArray(reqItem.selected_options)?reqItem.selected_options:[];let optionsTotal=0;const cleanOptions=[]
      for(const chosen of selected){
        const optionId=String(chosen.option_id||'');if(!optionId)continue
        const {data:option}=await admin.from('product_options').select('id,name,extra_price,is_available,group_id,product_option_groups!inner(id,name,product_id)').eq('id',optionId).eq('product_option_groups.product_id',product.id).maybeSingle()
        if(!option||option.is_available===false)return fail(`Una opción de ${product.name} ya no está disponible.`)
        optionsTotal+=Number(option.extra_price||0);cleanOptions.push({group_id:option.group_id,group_name:option.product_option_groups?.name||'Opción',option_id:option.id,option_name:option.name,extra_price:Number(option.extra_price||0)})
      }
      const unitPrice=Number(product.price)+optionsTotal,lineTotal=unitPrice*quantity;subtotal+=lineTotal
      normalizedItems.push({product_id:product.id,product_name:product.name,unit_price:unitPrice,quantity,line_total:lineTotal,selected_options:cleanOptions})
    }
    subtotal=Math.round(subtotal*100)/100;const total=Math.round((subtotal+DELIVERY_FEE)*100)/100
    const clipResponse=await fetch('https://api.payclip.com/payments',{method:'POST',headers:{Authorization:`Bearer ${clipApiKey}`,'Content-Type':'application/json'},body:JSON.stringify({amount:total,currency:'MXN',description:`Guti.mx - ${merchant.name}`,external_reference:`guti-${user.id.slice(0,8)}-${Date.now()}`,payment_method:{token:cardToken},customer:{email:user.email||'',phone:''}})})
    const clip=await clipResponse.json().catch(()=>({}));const status=String(clip.status||'').toLowerCase()
    if(!clipResponse.ok||status==='rejected'||status==='cancelled')return fail(clip?.status_detail?.message||'Pago rechazado.',402,{clip_status:status,clip_code:clip?.status_detail?.code||null})
    if(status==='pending'||status==='authorized')return fail(status==='pending'?'Clip dejó el pago pendiente de autenticación adicional (3DS).':'El pago quedó autorizado pero no capturado.',409,{clip_status:status,clip_payment_id:clip.id||null,pending_action:clip.pending_action||null})
    if(status!=='approved')return fail('Clip devolvió un estado de pago no reconocido.',409,{clip_status:status})
    const {data:order,error:orderError}=await admin.from('orders').insert({customer_id:user.id,merchant_id:merchantId,address_id:addressId,status:'pending',delivery_mode:merchant.delivery_mode||'guti',subtotal,delivery_fee:DELIVERY_FEE,discount:0,total,payment_method:'card',payment_status:'paid',notes:String(body.notes||'').slice(0,500)}).select().single()
    if(orderError){console.error('Clip approved but order insert failed',clip.id,orderError);return fail('El pago fue aprobado, pero hubo un problema al crear el pedido. Contacta a soporte Guti y no vuelvas a pagar.',500,{clip_payment_id:clip.id})}
    const {error:itemsError}=await admin.from('order_items').insert(normalizedItems.map(i=>({...i,order_id:order.id})))
    if(itemsError){console.error('Clip approved / order created / items failed',clip.id,order.id,itemsError);return fail('El pago fue aprobado y el pedido creado, pero necesitamos revisar sus productos. Contacta a soporte Guti.',500,{order_id:order.id,clip_payment_id:clip.id})}
    await admin.from('payments').insert({order_id:order.id,user_id:user.id,provider:'clip',provider_payment_id:clip.id||null,amount:total,currency:'MXN',status:'paid',status_detail:clip?.status_detail?.code||null,last4:clip?.payment_method?.card?.last_digits||null,brand:clip?.payment_method?.id||null,paid_at:clip?.approved_at||new Date().toISOString(),raw_response:clip})
    return NextResponse.json({ok:true,order_id:order.id,payment_id:clip.id,amount:total,status:'paid'})
  }catch(error){console.error(error);return fail('Ocurrió un error inesperado al procesar el pago.',500)}
}
