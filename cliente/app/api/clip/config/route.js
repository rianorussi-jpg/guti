import { NextResponse } from 'next/server'

export async function GET(){
  const apiKey=process.env.CLIP_API_KEY
  if(!apiKey){
    return NextResponse.json({ok:false,message:'Falta CLIP_API_KEY en Vercel.'},{status:500})
  }
  return NextResponse.json({
    ok:true,
    apiKey,
    environment:apiKey.startsWith('test_')?'test':'production'
  },{
    headers:{'Cache-Control':'no-store, max-age=0'}
  })
}
