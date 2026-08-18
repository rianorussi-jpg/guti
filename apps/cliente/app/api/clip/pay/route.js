import { randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime='nodejs'
const DELIVERY_FEE=45

function fail(message,status=400,extra={}){
  return NextResponse.json({ok:false,message,...extra},{status})
}

export async function POST(request){
  try{
    const clipApiKey=process.env.CLIP_API_KEY
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY
    if(!clipApiKey||!supabaseUrl||!serviceRole)return fail('Configuración incompleta del servidor.',500)

    const auth=request.headers.get('authorization')||''
    const jwt=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!jwt)return fail('Sesión no válida.',401)

    const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
    const userClient=createClient(supabaseUrl,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false}})
    const {data:{user}}=await admin.auth.getUser(jwt)
    if(!user)return fail('Tu sesión expiró.',401)

    const body=await request.json()
    const cardToken=String(body.card_token||'')
    const merchantId=String(body.merchant_id||'')
    const addressId=String(body.address_id||'')
    const customerPhone=String(body.customer_phone||'').replace(/\D/g,'')
    const requestId=String(body.idempotency_key||'').trim()
    const requestedItems=Array.isArray(body.items)?body.items:[]
    if(!cardToken||!merchantId||!addressId||!requestedItems.length||!requestId)return fail('Faltan datos para procesar el pago.')
    if(customerPhone.length!==10)return fail('Clip requiere un número celular de 10 dígitos.')

    const {data:address}=await admin.from('addresses').select('id').eq('id',addressId).eq('user_id',user.id).maybeSingle()
    if(!address)return fail('La dirección seleccionada no es válida.',403)
    const {data:zoneRows,error:zoneError}=await admin.rpc('check_service_zone',{p_address_id:addressId})
    const zone=Array.isArray(zoneRows)?zoneRows[0]:zoneRows
    if(zoneError||!zone?.allowed)return fail('Por ahora Guti sólo entrega dentro de Gutiérrez Zamora. Ajusta el pin a una dirección dentro de la zona de servicio.',400,{code:'OUTSIDE_SERVICE_ZONE'})

    const {data:merchant}=await admin.from('merchants').select('id,name,delivery_mode,is_active,accepts_orders').eq('id',merchantId).maybeSingle()
    if(!merchant||!merchant.is_active)return fail('Este negocio no está disponible.')
    if(merchant.accepts_orders===false)return fail('Este negocio está pausado y no recibe pedidos.')

    const productIds=[...new Set(requestedItems.map(i=>String(i.product_id||'')).filter(Boolean))]
    const {data:products,error:productsError}=await admin.from('products').select('id,merchant_id,name,price,is_available').in('id',productIds).eq('merchant_id',merchantId)
    if(productsError)return fail('No pudimos validar los productos.',500)

    const productMap=new Map((products||[]).map(p=>[p.id,p]))
    let subtotal=0
    const normalizedItems=[]

    for(const reqItem of requestedItems){
      const product=productMap.get(String(reqItem.product_id))
      const quantity=Math.max(1,Math.min(25,Number(reqItem.quantity)||1))
      if(!product||product.is_available===false)return fail('Uno de los productos ya no está disponible.')

      let optionsTotal=0
      const cleanOptions=[]
      for(const chosen of (Array.isArray(reqItem.selected_options)?reqItem.selected_options:[])){
        const optionId=String(chosen.option_id||'')
        if(!optionId)continue
        const {data:option}=await admin
          .from('product_options')
          .select('id,name,extra_price,is_available,group_id,product_option_groups!inner(id,name,product_id)')
          .eq('id',optionId)
          .eq('product_option_groups.product_id',product.id)
          .maybeSingle()
        if(!option||option.is_available===false)return fail(`Una opción de ${product.name} ya no está disponible.`)
        optionsTotal+=Number(option.extra_price||0)
        cleanOptions.push({
          group_id:option.group_id,
          group_name:option.product_option_groups?.name||'Opción',
          option_id:option.id,
          option_name:option.name,
          extra_price:Number(option.extra_price||0)
        })
      }

      const unitPrice=Number(product.price)+optionsTotal
      const lineTotal=unitPrice*quantity
      subtotal+=lineTotal
      normalizedItems.push({
        product_id:product.id,
        product_name:product.name,
        unit_price:unitPrice,
        quantity,
        line_total:lineTotal,
        selected_options:cleanOptions
      })
    }

    subtotal=Math.round(subtotal*100)/100
    const couponCode=String(body.coupon_code||'').trim().toUpperCase()||null
    const pointsRequested=Math.max(0,Number(body.points_requested)||0)
    const {data:quoteData,error:quoteError}=await userClient.rpc('quote_checkout_v38',{
      p_merchant_id:merchantId,p_subtotal:subtotal,p_coupon_code:couponCode,p_points_requested:pointsRequested
    })
    if(quoteError)return fail(quoteError.message||'No pudimos calcular tus descuentos.')
    const quote=Array.isArray(quoteData)?quoteData[0]:quoteData
    const deliveryFee=Number(quote?.delivery_fee??DELIVERY_FEE)
    const total=Number(quote?.total??Math.round((subtotal+DELIVERY_FEE)*100)/100)
    const deliveryPin=String(randomInt(1000,10000))

    const {data:existingRequest}=await admin.from('payment_attempt_locks').select('*').eq('user_id',user.id).eq('request_id',requestId).maybeSingle()
    if(existingRequest?.order_id)return NextResponse.json({ok:true,status:'paid',order_id:existingRequest.order_id,payment_id:existingRequest.provider_payment_id,amount:total,idempotent:true})
    if(existingRequest?.state==='failed')await admin.from('payment_attempt_locks').delete().eq('user_id',user.id).eq('request_id',requestId)
    else if(existingRequest?.state==='pending'&&existingRequest.provider_payment_id){
      const {data:pendingPayment}=await admin.from('payments').select('raw_response').eq('user_id',user.id).eq('client_request_id',requestId).maybeSingle()
      return NextResponse.json({ok:false,message:'Tu banco necesita autenticación 3DS.',clip_status:'pending',clip_payment_id:existingRequest.provider_payment_id,pending_action:pendingPayment?.raw_response?.clip?.pending_action||null},{status:202})
    }
    else if(existingRequest)return fail('Este pago ya se está procesando. Espera antes de volver a intentar.',409,{code:'GUTI_DUPLICATE_PAYMENT',clip_payment_id:existingRequest.provider_payment_id||null})
    const {error:reserveError}=await admin.from('payment_attempt_locks').insert({user_id:user.id,request_id:requestId,state:'processing'})
    if(reserveError){const {data:x}=await admin.from('payment_attempt_locks').select('*').eq('user_id',user.id).eq('request_id',requestId).maybeSingle();if(x?.order_id)return NextResponse.json({ok:true,status:'paid',order_id:x.order_id,payment_id:x.provider_payment_id,amount:total,idempotent:true});return fail('Este pago ya se está procesando.',409,{code:'GUTI_DUPLICATE_PAYMENT'})}

    const clipRes=await fetch('https://api.payclip.com/payments',{
      method:'POST',
      headers:{Authorization:`Bearer ${clipApiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        amount:total,
        currency:'MXN',
        description:`Guti.mx - ${merchant.name}`,
        external_reference:`guti-${requestId.slice(0,48)}`,
        payment_method:{token:cardToken},
        customer:{email:user.email||'',phone:customerPhone},
        prevention_data:{...(body.prevention_data||{}),request_3ds:true},
        metadata:{website:'https://guti.enla.mx'}
      })
    })

    const clip=await clipRes.json().catch(()=>({}))
    const status=String(clip.status||'').toLowerCase()

    if(!clipRes.ok||status==='rejected'||status==='cancelled'){
      await admin.from('payment_attempt_locks').update({state:'failed',provider_payment_id:clip?.id||null,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('request_id',requestId)
      return fail(clip?.status_detail?.message||'Pago rechazado.',402,{clip_status:status,clip_code:clip?.status_detail?.code||null})
    }

    if(status==='pending'){
      if(!clip.id){
        return fail('Clip solicitó 3DS pero no devolvió un payment_id.',502,{
          clip_status:'pending',
          pending_action:clip.pending_action||null
        })
      }

      const paymentPayload={
        order_id:null,
        user_id:user.id,
        provider:'clip',
        provider_payment_id:clip.id,
        client_request_id:requestId,
        amount:total,
        currency:'MXN',
        status:'pending',
        status_detail:clip?.status_detail?.code||null,
        raw_response:{
          clip,
          guti_checkout:{
            merchant_id:merchantId,
            address_id:addressId,
            notes:String(body.notes||'').slice(0,500),
            merchant_delivery_mode:merchant.delivery_mode||'guti',
            subtotal,
            total,
            coupon_code:couponCode,
            points_requested:Number(quote?.points_used||0),
            items:normalizedItems,
            delivery_pin:deliveryPin
          }
        }
      }

      // No seguimos al 3DS hasta confirmar que el intento quedó guardado.
      const {data:existing}=await admin
        .from('payments')
        .select('id')
        .eq('provider','clip')
        .eq('client_request_id',requestId)
        .maybeSingle()

      let persistError=null
      if(existing?.id){
        const {error}=await admin.from('payments').update(paymentPayload).eq('id',existing.id)
        persistError=error
      }else{
        const {error}=await admin.from('payments').insert(paymentPayload)
        persistError=error
      }

      if(!persistError)await admin.from('payment_attempt_locks').update({state:'pending',provider_payment_id:clip.id,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('request_id',requestId)
      if(persistError){
        console.error('Could not persist pending Clip payment',clip.id,persistError)
        return fail('Clip inició la verificación bancaria, pero Guti no pudo guardar el intento de pago. Intenta nuevamente.',500,{
          clip_status:'pending',
          clip_payment_id:clip.id
        })
      }

      return NextResponse.json({
        ok:false,
        message:'Tu banco necesita autenticación 3DS.',
        clip_status:'pending',
        clip_payment_id:clip.id,
        pending_action:clip.pending_action||null
      },{status:202})
    }

    if(status==='authorized'){await admin.from('payment_attempt_locks').update({state:'authorized',provider_payment_id:clip.id||null,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('request_id',requestId);return fail('El pago quedó autorizado pero no capturado.',409,{clip_status:status,clip_payment_id:clip.id||null})}
    if(status!=='approved')return fail('Clip devolvió un estado de pago no reconocido.',409,{clip_status:status})

    const approvedBeforeOrder={order_id:null,user_id:user.id,provider:'clip',provider_payment_id:clip.id||null,client_request_id:requestId,amount:total,currency:'MXN',status:'paid',status_detail:clip?.status_detail?.code||null,last4:clip?.payment_method?.card?.last_digits||null,brand:clip?.payment_method?.id||null,paid_at:clip?.approved_at||new Date().toISOString(),provider_last_status:'approved',provider_checked_at:new Date().toISOString(),raw_response:{clip,guti_checkout:{merchant_id:merchantId,address_id:addressId,notes:String(body.notes||'').slice(0,500),subtotal,total,coupon_code:couponCode,points_requested:Number(quote?.points_used||0),items:normalizedItems,delivery_pin:deliveryPin}}}
    const {data:prePayment}=await admin.from('payments').select('id').eq('user_id',user.id).eq('client_request_id',requestId).maybeSingle()
    const {error:preAuditError}=prePayment?.id?await admin.from('payments').update(approvedBeforeOrder).eq('id',prePayment.id):await admin.from('payments').insert(approvedBeforeOrder)
    if(preAuditError)console.error('No se pudo guardar conciliación previa de Clip',preAuditError)
    await admin.from('payment_attempt_locks').update({state:'approved',provider_payment_id:clip.id||null,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('request_id',requestId)

    const {data:order,error:orderError}=await admin.from('orders').insert({
      customer_id:user.id,merchant_id:merchantId,address_id:addressId,status:'pending',
      delivery_mode:merchant.delivery_mode||'guti',subtotal,delivery_fee:deliveryFee,
      discount:0,total,coupon_code:couponCode,points_used:Number(quote?.points_used||0),
      payment_method:'card',payment_status:'paid',notes:String(body.notes||'').slice(0,500),idempotency_key:requestId,delivery_pin:deliveryPin
    }).select().single()
    if(orderError)return fail('El pago fue aprobado, pero no pudimos crear el pedido. Contacta a soporte Guti y no vuelvas a pagar.',500,{clip_payment_id:clip.id})

    const {error:itemsError}=await admin.from('order_items').insert(normalizedItems.map(i=>({...i,order_id:order.id})))
    if(itemsError)return fail('El pago fue aprobado y el pedido creado, pero hubo un problema con sus productos. Contacta a soporte.',500,{order_id:order.id})

    const paidPayload={
      order_id:order.id,
      user_id:user.id,
      provider:'clip',
      provider_payment_id:clip.id||null,
      client_request_id:requestId,
      amount:total,
      currency:'MXN',
      status:'paid',
      status_detail:clip?.status_detail?.code||null,
      last4:clip?.payment_method?.card?.last_digits||null,
      brand:clip?.payment_method?.id||null,
      paid_at:clip?.approved_at||new Date().toISOString(),
      raw_response:{clip,guti_checkout:{merchant_id:merchantId,address_id:addressId,notes:String(body.notes||'').slice(0,500),subtotal,total,coupon_code:couponCode,points_requested:Number(quote?.points_used||0),items:normalizedItems,delivery_pin:deliveryPin}}
    }

    if(clip.id){
      const {data:existingPayment}=await admin
        .from('payments')
        .select('id')
        .eq('provider','clip')
        .eq('client_request_id',requestId)
        .maybeSingle()

      const {error:paymentAuditError}=existingPayment?.id
        ? await admin.from('payments').update(paidPayload).eq('id',existingPayment.id)
        : await admin.from('payments').insert(paidPayload)

      if(paymentAuditError)console.error('Could not persist approved Clip payment audit',clip.id,paymentAuditError)
    }

    await admin.from('payment_attempt_locks').update({state:'paid',provider_payment_id:clip.id||null,order_id:order.id,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('request_id',requestId)
    return NextResponse.json({ok:true,status:'paid',order_id:order.id,payment_id:clip.id,amount:total})
  }catch(error){
    console.error(error)
    return fail('Ocurrió un error inesperado al procesar el pago.',500)
  }
}
