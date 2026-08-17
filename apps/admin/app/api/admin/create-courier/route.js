import {NextResponse} from 'next/server'
import {getAdminClient,requireGutiAdmin} from '../_server'
export const runtime='nodejs'
const fail=(error,status=400)=>NextResponse.json({error},{status})
export async function POST(request){
 let createdUserId=null
 try{
  const admin=getAdminClient();const gate=await requireGutiAdmin(request,admin);if(gate.error)return fail(gate.error,gate.status)
  const b=await request.json(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),fullName=String(b.full_name||'').trim(),phone=String(b.phone||'').trim()
  if(!fullName||!email||!phone||password.length<8)return fail('Completa nombre, correo, teléfono y una contraseña de al menos 8 caracteres.')
  const {data:authData,error:authError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName,phone}})
  if(authError)return fail(authError.message)
  createdUserId=authData.user.id
  const {error:pError}=await admin.from('profiles').upsert({id:createdUserId,full_name:fullName,phone,role:'courier'},{onConflict:'id'});if(pError)throw pError
  const {error:cError}=await admin.from('courier_profiles').upsert({user_id:createdUserId,is_online:false,is_approved:true,vehicle_type:String(b.vehicle_type||'Moto'),rating:5,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(cError)throw cError
  return NextResponse.json({ok:true,courier:{user_id:createdUserId,full_name:fullName,email,phone,vehicle_type:String(b.vehicle_type||'Moto')}})
 }catch(e){
  try{if(createdUserId){const admin=getAdminClient();await admin.auth.admin.deleteUser(createdUserId)}}catch{}
  return fail(e?.message||'No se pudo registrar el repartidor.',500)
 }
}