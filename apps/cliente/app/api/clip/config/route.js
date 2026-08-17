import { NextResponse } from 'next/server'

export async function GET(){
  const apiKey=process.env.CLIP_API_KEY
  if(!apiKey)return NextResponse.json({message:'Falta CLIP_API_KEY en Vercel.'},{status:500})
  return NextResponse.json({apiKey})
}
