import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import webpush from 'web-push'
export const runtime='nodejs'

function server(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey=process.env.VAPID_PRIVATE_KEY
  const subject=process.env.VAPID_SUBJECT||'mailto:soporte@guti.mx'
  if(!url||!service||!publicKey||!privateKey)throw new Error('Push env incompleto')
  webpush.setVapidDetails(subject,publicKey,privateKey)
  return createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
}

async function dispatch(notificationId=null){
  const admin=server()
  let query=admin.from('notifications').select('*').is('push_sent_at',null).order('created_at').limit(notificationId?1:100)
  if(notificationId)query=query.eq('id',notificationId)
  const {data:notifs,error}=await query
  if(error)throw error

  let sent=0,failed=0
  for(const n of notifs||[]){
    const {data:subs}=await admin.from('push_subscriptions').select('*').eq('user_id',n.user_id).eq('is_active',true)
    for(const s of subs||[]){
      try{
        await webpush.sendNotification(
          {endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
          JSON.stringify({title:n.title,body:n.body||'',url:n.action_url||'/',tag:n.dedupe_key||n.id})
        )
        sent++
      }catch(e){
        failed++
        if(e?.statusCode===404||e?.statusCode===410){
          await admin.from('push_subscriptions').update({is_active:false,last_error:String(e.statusCode)}).eq('id',s.id)
        }else{
          await admin.from('push_subscriptions').update({last_error:String(e?.message||e)}).eq('id',s.id)
        }
      }
    }
    await admin.from('notifications').update({push_sent_at:new Date().toISOString()}).eq('id',n.id)
  }
  return {ok:true,notifications:(notifs||[]).length,sent,failed}
}

export async function POST(request){
  try{
    const payload=await request.json().catch(()=>({}))
    const id=payload?.record?.id||payload?.id||null
    return NextResponse.json(await dispatch(id))
  }catch(e){
    console.error(e)
    return NextResponse.json({ok:false,message:e.message||'Push error'},{status:500})
  }
}

export async function GET(request){
  try{
    const secret=process.env.CRON_SECRET
    const auth=request.headers.get('authorization')||''
    if(secret&&auth!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401})
    return NextResponse.json(await dispatch())
  }catch(e){
    console.error(e)
    return NextResponse.json({ok:false,message:e.message||'Push error'},{status:500})
  }
}
