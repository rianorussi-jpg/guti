'use client'
import { createBrowserClient } from '@supabase/ssr'

let client
export function getSupabaseBrowserClient(){
  if (!client){
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
    client = createBrowserClient(url, key)
  }
  return client
}
