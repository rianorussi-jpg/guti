const merchants=['La Galera','Exprimidos','OXXO','Bodega Aurrera']
export default function Page(){
 return <main className="shell">
  <div className="topbar"><div><div className="brand">Guti.mx Admin</div><span className="muted">Operación Gutiérrez Zamora</span></div><span>Soporte: 5623449135</span></div>
  <div className="grid cols4" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
   <div className="card"><div className="muted">Pedidos hoy</div><div className="stat">63</div></div>
   <div className="card"><div className="muted">GMV hoy</div><div className="stat">$15,240</div></div>
   <div className="card"><div className="muted">Comisión</div><div className="stat">10%</div></div>
   <div className="card"><div className="muted">Envío estándar</div><div className="stat">$45</div></div>
  </div>
  <div className="grid cols2" style={{gridTemplateColumns:'2fr 1fr'}}>
   <div className="card"><h2>Operación en vivo</h2><table><thead><tr><th>Negocio</th><th>Estado</th><th>Tipo reparto</th></tr></thead><tbody>
    {merchants.map((m,i)=><tr key={m}><td><b>{m}</b></td><td><span className="pill">Activo</span></td><td>{i===0?'Propio':'Guti / mixto'}</td></tr>)}
   </tbody></table></div>
   <div className="card"><h2>Configuración</h2><label>Tarifa fija de envío</label><input defaultValue="$45"/><br/><br/><label>Comisión plataforma</label><input defaultValue="10%"/><br/><br/><button className="btn">Guardar</button></div>
  </div>
 </main>
}
