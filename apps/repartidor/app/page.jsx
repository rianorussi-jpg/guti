const jobs=[
 {id:'#G-1048',store:'Exprimidos',drop:'Col. Centro',pay:45},
 {id:'#G-1046',store:'OXXO',drop:'Col. Cuauhtémoc',pay:45},
 {id:'#G-1043',store:'Bodega Aurrera',drop:'Zona Centro',pay:45},
]
export default function Page(){
 return <main className="shell" style={{maxWidth:720}}>
  <div className="topbar"><div><div className="brand">Guti.mx Repartidor</div><span className="muted">Disponible para pedidos</span></div><span className="pill" style={{background:'#e8f7ed',color:'var(--green)'}}>EN LÍNEA</span></div>
  <div className="grid cols3" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:18}}>
   <div className="card"><div className="muted">Entregas hoy</div><div className="stat">7</div></div>
   <div className="card"><div className="muted">Ganado hoy</div><div className="stat">$315</div></div>
   <div className="card"><div className="muted">Calificación</div><div className="stat">4.9 ⭐</div></div>
  </div>
  <h2>Pedidos disponibles</h2>
  <p className="muted">Los repartidores Guti eligen los pedidos que quieren tomar.</p>
  <div className="grid">{jobs.map(j=><div className="card between" key={j.id}><div><b>{j.id} · {j.store}</b><p className="muted">Entrega: {j.drop}</p><b>Tarifa: ${j.pay}</b></div><button className="btn">Tomar pedido</button></div>)}</div>
 </main>
}
