import {createClient} from '@supabase/supabase-js'

export function getAdminClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en Guti Admin.')
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
}

export async function requireGutiAdmin(request,admin){
 const auth=request.headers.get('authorization')||''
 const jwt=auth.startsWith('Bearer ')?auth.slice(7):''
 if(!jwt)return {error:'Sesión no válida.',status:401}
 const {data:{user},error}=await admin.auth.getUser(jwt)
 if(error||!user)return {error:'Tu sesión expiró.',status:401}
 const {data:ga}=await admin.from('guti_admins').select('user_id').eq('user_id',user.id).maybeSingle()
 if(ga)return {user}
 const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).maybeSingle()
 if(profile?.role!=='admin')return {error:'No tienes permisos de administrador.',status:403}
 return {user}
}

export function slugify(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)}
