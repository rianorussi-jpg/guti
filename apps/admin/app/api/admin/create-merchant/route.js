import {NextResponse} from 'next/server'
import {getAdminClient,requireGutiAdmin,slugify} from '../_server'
export const runtime='nodejs'
const fail=(error,status=400)=>NextResponse.json({error},{status})
export async function POST(request){
 let createdUserId=null
 try{
  const admin=getAdminClient();const gate=await requireGutiAdmin(request,admin);if(gate.error)return fail(gate.error,gate.status)
  const b=await request.json();const name=String(b.name||'').trim(),slug=slugify(b.slug||name),ownerEmail=String(b.owner_email||'').trim().toLowerCase(),ownerPassword=String(b.owner_password||'')
  if(!name||!slug||!ownerEmail||ownerPassword.length<8)return fail('Completa nombre, slug, correo y una contraseña de al menos 8 caracteres.')
  const {data:existing}=await admin.from('merchants').select('id').eq('slug',slug).maybeSingle();if(existing)return fail('Ese slug ya está en uso.')
  const {data:authData,error:authError}=await admin.auth.admin.createUser({email:ownerEmail,password:ownerPassword,email_confirm:true,user_metadata:{full_name:String(b.owner_name||name),phone:String(b.owner_phone||'')}})
  if(authError)return fail(authError.message)
  createdUserId=authData.user.id
  const {error:profileError}=await admin.from('profiles').upsert({id:createdUserId,full_name:String(b.owner_name||name).trim(),phone:String(b.owner_phone||'').trim(),role:'merchant_owner'},{onConflict:'id'})
  if(profileError)throw profileError
  const {data:merchant,error:merchantError}=await admin.from('merchants').insert({owner_id:createdUserId,name,slug,merchant_type:String(b.merchant_type||'restaurant'),description:String(b.description||'').trim()||null,phone:String(b.phone||'').trim()||null,address:String(b.address||'').trim()||null,is_active:true,accepts_orders:true,delivery_mode:b.delivery_mode==='merchant'?'merchant':'guti',commission_percent:Math.max(0,Math.min(100,Number(b.commission_percent||10))),manual_pause:false,schedule_enabled:true,prep_minutes:Math.max(5,Math.min(180,Number(b.prep_minutes||25))),bank_name:String(b.bank_name||'').trim()||null,bank_account_holder:String(b.bank_account_holder||'').trim()||null,bank_clabe:String(b.bank_clabe||'').replace(/\D/g,'').slice(0,18)||null}).select().single()
  if(merchantError)throw merchantError
  const open=String(b.open_time||'09:00'),close=String(b.close_time||'21:00')
  await admin.from('merchant_hours').insert(Array.from({length:7},(_,day)=>({merchant_id:merchant.id,day_of_week:day,is_closed:false,open_time:open,close_time:close})))
  return NextResponse.json({ok:true,merchant:{id:merchant.id,name:merchant.name,slug:merchant.slug},owner:{id:createdUserId,email:ownerEmail}})
 }catch(e){
  try{if(createdUserId){const admin=getAdminClient();await admin.auth.admin.deleteUser(createdUserId)}}catch{}
  return fail(e?.message||'No se pudo crear el negocio.',500)
 }
}