import { NextResponse } from 'next/server'

export async function GET(request){
  const key=process.env.CLIP_API_KEY||''
  const secret=process.env.CLIP_SECRET_KEY||''
  return NextResponse.json({
    ok:!!key,
    clip_api_key_present:!!key,
    clip_api_key_environment:key.startsWith('test_')?'test':key?'production':'missing',
    clip_api_key_prefix:key?`${key.slice(0,9)}••••`:null,
    clip_secret_present:!!secret,
    host:request.headers.get('host')||null,
    forwarded_host:request.headers.get('x-forwarded-host')||null,
    forwarded_proto:request.headers.get('x-forwarded-proto')||null
  },{
    headers:{'Cache-Control':'no-store, max-age=0'}
  })
}
