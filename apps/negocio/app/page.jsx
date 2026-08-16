const orders=[
 {id:'#G-1042',customer:'Mariana',total:284,status:'Nuevo',delivery:'Repartidor del negocio'},
 {id:'#G-1041',customer:'Luis',total:196,status:'Preparando',delivery:'Guti'},
]
export default function Page(){
 return <main className="shell">
  <div className="topbar"><div><div className="brand">Guti.mx Negocios</div><span className="muted">La Galera</span></div><button className="btn">+ Producto</button></div>
  <div className="grid cols4" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
   <div className="card"><div className="muted">Pedidos hoy</div><div className="stat">18</div></div>
   <div className="card"><div className="muted">Ventas</div><div className="stat">$4,820</div></div>
   <div className="card"><div className="muted">Comisión Guti</div><div className="stat">10%</div></div>
   <div className="card"><div className="muted">Estado</div><div className="stat" style={{color:'var(--green)'}}>Abierto</div></div>
  </div>
  <div className="card" style={{marginBottom:20}}>
   <div className="between"><div><h2>Pedidos entrantes</h2><p className="muted">Los pedidos requieren aceptación manual.</p></div></div>
   <table><thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Entrega</th><th></th></tr></thead>
   <tbody>{orders.map(o=><tr key={o.id}><td><b>{o.id}</b></td><td>{o.customer}</td><td>${o.total}</td><td><span className="pill">{o.status}</span></td><td>{o.delivery}</td><td><button className="btn">Ver</button></td></tr>)}</tbody></table>
  </div>
  <div className="grid cols2" style={{gridTemplateColumns:'2fr 1fr'}}>
   <div className="card"><h2>Menú y productos</h2><p className="muted">Nombre, descripción, fotografía, precio, variantes, extras, disponibilidad y categoría.</p><button className="btn">Administrar catálogo</button></div>
   <div className="card"><h2>Reparto</h2><select><option>Usar repartidores propios</option><option>Ofrecer pedido a repartidores Guti</option></select><p className="muted">La Galera puede manejar sus propios repartidores.</p></div>
  </div>
 </main>
}
