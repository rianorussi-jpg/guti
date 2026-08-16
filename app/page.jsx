const negocios = [
  {name:'La Galera', type:'Restaurante', eta:'25–35 min', img:'🍽️'},
  {name:'Exprimidos', type:'Jugos y desayunos', eta:'20–30 min', img:'🥤'},
  {name:'OXXO', type:'Tienda', eta:'20–35 min', img:'🏪'},
  {name:'Bodega Aurrera', type:'Súper', eta:'35–55 min', img:'🛒'}
]
const cats=['🍔 Comida','🛒 Súper','💊 Farmacia','🛍️ Mandados','📦 Envíos','🥤 Bebidas','🍰 Postres','••• Más']
export default function Page(){
 return <main className="shell" style={{maxWidth:560}}>
  <div className="topbar"><div><div className="muted" style={{fontSize:12}}>Entregar en</div><b>Gutiérrez Zamora, Ver.</b></div><span>🔔</span></div>
  <div style={{textAlign:'center',margin:'22px 0'}}><div className="brand" style={{fontSize:48,fontStyle:'italic'}}>Guti.mx</div><div className="muted">Lo que necesites, te lo llevamos.</div></div>
  <input placeholder="¿Qué quieres pedir hoy?" />
  <div className="grid" style={{gridTemplateColumns:'repeat(4,1fr)',margin:'20px 0'}}>
   {cats.map(x=><div className="card" key={x} style={{padding:12,textAlign:'center',fontSize:12}}>{x}</div>)}
  </div>
  <div className="card" style={{background:'linear-gradient(135deg,#f4510b,#ff7a18)',color:'#fff',marginBottom:22}}>
   <span className="pill">GUTI PUNTOS</span><h2>Compra local y gana recompensas</h2><p>Acumula puntos en cada pedido y úsalos dentro de Guti.mx.</p>
  </div>
  <div className="between"><h2>Negocios cerca de ti</h2><span style={{color:'var(--orange)'}}>Ver todos</span></div>
  <div className="grid cols2" style={{gridTemplateColumns:'1fr 1fr'}}>
   {negocios.map(n=><div className="card" key={n.name}><div style={{fontSize:48}}>{n.img}</div><h3>{n.name}</h3><div className="muted">{n.type}</div><small>⭐ 4.7 · {n.eta}</small><p><b>Envío fijo $45</b></p></div>)}
  </div>
 </main>
}
