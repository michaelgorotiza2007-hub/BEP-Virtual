import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ PEGA TU CONFIGURACIÓN DE FIREBASE AQUÍ ⚠️
const firebaseConfig = {
    apiKey: "AIzaSyBpI16R6BI6gorLoW-I62RA09PJSUvuIY0",
  authDomain: "bancopeninsular.firebaseapp.com",
  projectId: "bancopeninsular",
  storageBucket: "bancopeninsular.firebasestorage.app",
  messagingSenderId: "218848309222",
  appId: "1:218848309222:web:603faf9cedb2c99caf7027"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let usuario = null;
let clienteCajero = null;
let clientePrestamoCajero = null;
let chartInstance = null;
let barInstance = null;
const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let rolSeleccionadoRegistro = 'cliente';

// --- UTILIDADES ---
// 1. FORMATO DINERO CON SEPARACIÓN DE DÍGITOS
const formatoDinero = (monto) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monto);
};

// --- GESTIÓN DE FONDO DE BANCO ---
// Usaremos un documento en la colección 'usuarios' con ID 'banco_central' para guardar el capital.
async function obtenerFondoBanco() {
    try {
        const docRef = doc(db, "usuarios", "banco_central");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data();
        else {
            // Si no existe, lo creamos con capital inicial 0
            const nuevoFondo = { saldo: 100000, rol: 'sistema', nombres: 'Banco Central' }; // Capital semilla
            await setDoc(docRef, nuevoFondo);
            return nuevoFondo;
        }
    } catch (e) { console.error("Error obteniendo fondo:", e); return { saldo: 0 }; }
}

async function actualizarFondoBanco(nuevoSaldo) {
    try {
        await updateDoc(doc(db, "usuarios", "banco_central"), { saldo: nuevoSaldo });
    } catch (e) { console.error("Error actualizando fondo:", e); }
}

// --- INICIO ---
window.onload = async () => {
    const d = document.getElementById('current-date');
    if(d) d.innerText = new Date().toLocaleDateString('es-EC', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
    const saved = localStorage.getItem('bep_active_user');
    if(saved) await cargarDatosUsuario(saved);
};

async function cargarDatosUsuario(u) {
    try {
        const s = await getDoc(doc(db,"usuarios",u));
        if(s.exists()) {
            usuario = s.data();
            if(!usuario.solicitudes) usuario.solicitudes = [];
            if(!usuario.foto) usuario.foto = defaultAvatar;
        }
    } catch(e) { console.error(e); }
}

// --- NAVEGACIÓN ---
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    if(usuario) entrarSistema(); else document.getElementById('auth-screen').classList.remove('oculto');
};
window.toggleAuth = (tab) => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registro').classList.add('oculto');
    document.getElementById('form-'+tab).classList.remove('oculto');
    document.querySelectorAll('.tabs-modern button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    if(tab==='registro'){
        document.getElementById('registro-paso-1').classList.remove('oculto');
        document.getElementById('registro-paso-2').classList.add('oculto');
    }
};
window.mostrarPanel = (id) => {
    document.querySelectorAll('#dashboard .view').forEach(v => v.classList.add('oculto'));
    document.getElementById('panel-'+id).classList.remove('oculto');
    document.querySelectorAll('.sidebar .nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
};
window.mostrarPanelAdmin = (id) => {
    document.querySelectorAll('.view-admin').forEach(v => v.classList.add('oculto'));
    document.getElementById('admin-'+id).classList.remove('oculto');
    document.querySelectorAll('.admin-sidebar .nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
    if(id==='usuarios') cargarUsuariosAdmin();
    if(id==='prestamos') cargarSolicitudesAdmin();
    if(id==='dashboard') cargarDashboardAdmin();
    if(id==='transacciones') cargarTransaccionesGlobales();
};
window.mostrarPanelCajero = (id) => {
    document.querySelectorAll('.view-cajero').forEach(v => v.classList.add('oculto'));
    document.getElementById('cajero-'+id).classList.remove('oculto');
    document.querySelectorAll('.sidebar .nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
};

// --- REGISTRO Y LOGIN ---
window.seleccionarPerfil = (p) => {
    rolSeleccionadoRegistro = p;
    document.getElementById('registro-paso-1').classList.add('oculto');
    document.getElementById('registro-paso-2').classList.remove('oculto');
    const area = document.getElementById('staff-code-area');
    if(p==='staff') area.classList.remove('hidden'); else area.classList.add('hidden');
};
window.volverSeleccion = () => {
    document.getElementById('registro-paso-2').classList.add('oculto');
    document.getElementById('registro-paso-1').classList.remove('oculto');
};
window.previewImage = () => {
    const f = document.getElementById('reg-foto').files[0];
    const r = new FileReader();
    r.onload = () => { document.getElementById('avatar-preview').src = r.result; document.getElementById('avatar-preview').classList.remove('hidden'); }
    if(f) r.readAsDataURL(f);
};
const toBase64 = f => new Promise((res,rej)=>{const r=new FileReader();r.readAsDataURL(f);r.onload=()=>res(r.result);r.onerror=e=>rej(e);});

window.registrarUsuario = async () => {
    const u=document.getElementById('reg-user').value.trim();
    const p=document.getElementById('reg-pass').value.trim();
    const n=document.getElementById('reg-nombres').value.trim();
    const c=document.getElementById('reg-cedula').value.trim();
    const terms=document.getElementById('reg-terms').checked;
    
    if(!u||!p||!n||!c) return toast('Faltan datos','error');
    if(!terms) return toast('Acepte términos','error');

    let rol='cliente';
    if(rolSeleccionadoRegistro==='staff'){
        const code=document.getElementById('reg-staff-code').value.trim();
        if(code==="BEP2025") rol='admin';
        else if(code==="CAJA2025") rol='cajero';
        else return toast('Código inválido','error');
    }
    let foto=defaultAvatar;
    if(document.getElementById('reg-foto').files[0]) foto=await toBase64(document.getElementById('reg-foto').files[0]);

    const obj={
        username:u, password:p, nombres:n, apellidos:document.getElementById('reg-apellidos').value,
        cedula:c, telefono:document.getElementById('reg-telefono').value, foto:foto, rol:rol,
        cuenta:Math.floor(1000000000+Math.random()*9000000000).toString(),
        saldo:0.00, movimientos:[], solicitudes:[]
    };
    try {
        await setDoc(doc(db,"usuarios",u), obj);
        toast('Cuenta creada','success'); window.toggleAuth('login');
    } catch(e) { toast('Error','error'); }
};

window.iniciarSesion = async () => {
    const u=document.getElementById('login-user').value.trim();
    const p=document.getElementById('login-pass').value.trim();
    try {
        const s=await getDoc(doc(db,"usuarios",u));
        if(s.exists() && s.data().password===p) {
            usuario=s.data();
            localStorage.setItem('bep_active_user', usuario.username);
            entrarSistema();
        } else toast('Credenciales incorrectas','error');
    } catch(e) { toast('Error de conexión','error'); }
};
function entrarSistema() {
    document.getElementById('auth-screen').classList.add('oculto');
    document.getElementById('intro-screen').style.display = 'none';
    if(usuario.rol==='admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        cargarDashboardAdmin();
    } else if(usuario.rol==='cajero') {
        document.getElementById('cajero-panel').classList.remove('oculto');
        document.getElementById('cajero-name-display').innerText = usuario.nombres;
    } else {
        document.getElementById('dashboard').classList.remove('oculto');
        actualizarUI();
    }
}
window.cerrarSesion = () => { usuario=null; localStorage.removeItem('bep_active_user'); location.reload(); };

// --- CLIENTE LÓGICA ---
async function guardarUsuario() { await updateDoc(doc(db,"usuarios",usuario.username), usuario); actualizarUI(); }

function actualizarUI() {
    document.getElementById('nav-user').innerText = usuario.nombres;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto || defaultAvatar;
    // FORMATO DINERO SEPARADO
    document.getElementById('main-balance').innerText = formatoDinero(usuario.saldo);
    document.getElementById('display-acc-number').innerText = usuario.cuenta;

    const list = document.getElementById('activity-list');
    list.innerHTML='';
    (usuario.movimientos||[]).slice().reverse().slice(0,10).forEach(m=>{
        list.innerHTML+=`<li><div><strong>${m.desc}</strong><br><small>${m.fecha}</small></div><div class="${m.monto>0?'text-green':'text-red'}">${formatoDinero(Math.abs(m.monto))}</div></li>`;
    });

    // PRÉSTAMO
    const prestamo = (usuario.solicitudes||[]).find(s=>s.estado==='aprobado');
    const pendiente = (usuario.solicitudes||[]).find(s=>s.estado==='pendiente');
    
    document.getElementById('estado-prestamo').innerText = pendiente ? 'Solicitud en revisión.' : (prestamo ? 'Crédito Activo.' : 'Sin solicitudes.');
    
    // TABLA AMORTIZACIÓN
    const amortBox = document.getElementById('amortizacion-user-container');
    if(prestamo) {
        amortBox.classList.remove('hidden');
        generarHTMLAmortizacion(prestamo, 'tabla-amortizacion-user');
    } else {
        amortBox.classList.add('hidden');
    }

    // PANEL PAGO
    const deudaBox = document.getElementById('info-deuda-display');
    const inputPago = document.getElementById('form-pago-inputs');
    if(prestamo) {
        if(prestamo.saldoPendiente === undefined) prestamo.saldoPendiente = prestamo.totalPagar;
        deudaBox.innerHTML = `Deuda Pendiente: <strong class="text-red">${formatoDinero(prestamo.saldoPendiente)}</strong>`;
        inputPago.classList.remove('hidden');
    } else {
        deudaBox.innerHTML = `<i class="fas fa-check-circle text-green"></i> Sin deudas.`;
        inputPago.classList.add('hidden');
    }
}

window.solicitarPrestamo = async () => {
    const m = parseFloat(document.getElementById('prestamo-monto').value);
    const pl = document.getElementById('prestamo-plazo').value;
    if(m<=0) return toast('Monto inválido','error');
    if((usuario.solicitudes||[]).some(s=>s.estado==='pendiente' || s.estado==='aprobado')) return toast('Ya tienes una solicitud activa','error');
    
    const interes = pl==3?0.05 : (pl==6?0.10:0.15);
    const total = m + (m*interes);
    
    usuario.solicitudes.push({
        id: Date.now().toString(), monto: m, plazo: pl, interes: interes*100,
        totalPagar: total, saldoPendiente: total, estado: 'pendiente',
        motivo: document.getElementById('prestamo-motivo').value,
        trabajo: document.getElementById('prestamo-trabajo').value,
        ingresos: document.getElementById('prestamo-ingresos').value,
        fecha: new Date().toLocaleDateString()
    });
    await guardarUsuario();
    toast('Solicitud enviada','success');
};

// 1. PAGO PRÉSTAMO USUARIO (TRANSFERENCIA AL BANCO)
window.pagarPrestamoUser = async () => {
    const monto = parseFloat(document.getElementById('monto-pago-prestamo').value);
    if(monto <= 0) return toast('Monto inválido','error');
    if(monto > usuario.saldo) return toast('Saldo insuficiente','error');
    
    const idx = usuario.solicitudes.findIndex(s=>s.estado==='aprobado');
    if(idx===-1) return;
    const p = usuario.solicitudes[idx];
    
    // Verificación de cuota
    if(monto > p.saldoPendiente + 1) return toast('El monto excede la deuda total','error');
    
    // A. Descontar al Usuario
    usuario.saldo -= monto;
    p.saldoPendiente -= monto;
    usuario.movimientos.push({desc:'Pago Préstamo (Transferencia)', monto: -monto, fecha: new Date().toLocaleDateString()});
    
    // B. Ingresar al Fondo del Banco
    const banco = await obtenerFondoBanco();
    await actualizarFondoBanco(banco.saldo + monto);

    if(p.saldoPendiente < 0.1) {
        p.estado = 'pagado';
        p.saldoPendiente = 0;
        toast('¡Deuda Pagada!','success');
    } else {
        toast('Transferencia realizada','success');
    }
    await guardarUsuario();
    document.getElementById('monto-pago-prestamo').value = '';
};

// OPERACIONES
window.operar = async (tipo) => {
    if(tipo==='transferencia'){
        const dest = document.getElementById('tercero-cuenta').value;
        const mont = parseFloat(document.getElementById('tercero-monto').value);
        if(mont > usuario.saldo) return toast('Saldo insuficiente','error');
        const q = query(collection(db,"usuarios"), where("cuenta","==",dest));
        const s = await getDocs(q);
        if(s.empty) return toast('Destino no existe','error');
        const tDoc = s.docs[0]; const tData = tDoc.data();
        
        usuario.saldo -= mont;
        usuario.movimientos.push({desc:`Transf. a ${tData.nombres}`, monto:-mont, fecha:new Date().toLocaleDateString()});
        tData.saldo += mont;
        if(!tData.movimientos) tData.movimientos=[];
        tData.movimientos.push({desc:`Transf. de ${usuario.nombres}`, monto:mont, fecha:new Date().toLocaleDateString()});
        
        await updateDoc(doc(db,"usuarios",usuario.username), usuario);
        await updateDoc(doc(db,"usuarios",tDoc.id), tData);
        toast('Transferencia exitosa','success');
        actualizarUI();
    }
    if(tipo==='cobrar-cheque'){
         const m = parseFloat(document.getElementById('cheque-monto').value);
         if(m>0){
             usuario.saldo+=m; 
             usuario.movimientos.push({desc:'Cheque',monto:m,fecha:new Date().toLocaleDateString()});
             await guardarUsuario(); toast('Depositado','success');
         }
    }
};

window.copiarCuenta = () => { navigator.clipboard.writeText(usuario.cuenta); toast('Copiado','success'); };

// --- CAJERO ---
window.buscarClienteCajero = async () => {
    const v = document.getElementById('cajero-search-input').value.trim();
    let q = query(collection(db,"usuarios"), where("cuenta","==",v));
    let s = await getDocs(q);
    if(s.empty) { q=query(collection(db,"usuarios"), where("cedula","==",v)); s=await getDocs(q); }
    if(s.empty) return toast('No encontrado','error');
    const d = s.docs[0];
    clienteCajero = { ...d.data(), uid: d.id };
    
    document.getElementById('cajero-cliente-info').classList.remove('oculto');
    document.getElementById('cajero-client-nombre').innerText = clienteCajero.nombres;
    document.getElementById('cajero-client-saldo').innerText = formatoDinero(clienteCajero.saldo);
    document.getElementById('cajero-client-foto').src = clienteCajero.foto || defaultAvatar;
};

window.ejecutarOperacionCajero = async () => {
    if(!clienteCajero) return;
    const tipo = document.getElementById('cajero-tipo-op').value;
    const m = parseFloat(document.getElementById('cajero-monto-op').value);
    if(m<=0) return toast('Monto inválido','error');

    if(tipo==='retiro'){
        if(m>clienteCajero.saldo) return toast('Saldo insuficiente','error');
        clienteCajero.saldo -= m;
        clienteCajero.movimientos.push({desc:'Retiro Ventanilla', monto:-m, fecha:new Date().toLocaleDateString()});
    } else {
        clienteCajero.saldo += m;
        clienteCajero.movimientos.push({desc:'Depósito Ventanilla', monto:m, fecha:new Date().toLocaleDateString()});
    }
    await updateDoc(doc(db,"usuarios",clienteCajero.uid), clienteCajero);
    toast('Éxito','success');
    document.getElementById('cajero-client-saldo').innerText = formatoDinero(clienteCajero.saldo);
    document.getElementById('cajero-monto-op').value='';
};

// 2. PAGO PRÉSTAMO CAJERO (EFECTIVO -> FONDO BANCO)
window.buscarClientePrestamo = async () => {
    const v = document.getElementById('cajero-search-loan').value.trim();
    let q = query(collection(db,"usuarios"), where("cuenta","==",v));
    let s = await getDocs(q);
    if(s.empty) { q=query(collection(db,"usuarios"), where("cedula","==",v)); s=await getDocs(q); }
    if(s.empty) return toast('No encontrado','error');
    
    const d = s.docs[0];
    clientePrestamoCajero = { ...d.data(), uid: d.id };
    
    const prestamo = (clientePrestamoCajero.solicitudes||[]).find(p=>p.estado==='aprobado');
    if(!prestamo) return toast('El cliente no tiene deuda activa','error');
    
    if(prestamo.saldoPendiente===undefined) prestamo.saldoPendiente = prestamo.totalPagar;
    
    document.getElementById('cajero-loan-info').classList.remove('oculto');
    document.getElementById('cajero-loan-client').innerText = `Cliente: ${clientePrestamoCajero.nombres}`;
    document.getElementById('cajero-loan-amount').innerText = formatoDinero(prestamo.saldoPendiente);
};

window.pagarPrestamoCajero = async () => {
    if(!clientePrestamoCajero) return;
    const monto = parseFloat(document.getElementById('cajero-loan-pay').value);
    const prestamo = clientePrestamoCajero.solicitudes.find(p=>p.estado==='aprobado');
    
    if(monto<=0 || monto > prestamo.saldoPendiente + 1) return toast('Monto inválido','error');
    
    // CAJERO: El cliente paga en efectivo. No se descuenta de su saldo personal.
    // Solo se reduce la deuda y el dinero entra al banco.
    prestamo.saldoPendiente -= monto;
    clientePrestamoCajero.movimientos.push({desc:'Pago Préstamo (Efectivo Ventanilla)', monto:0, fecha:new Date().toLocaleDateString()}); 
    
    // Ingresar al Fondo del Banco
    const banco = await obtenerFondoBanco();
    await actualizarFondoBanco(banco.saldo + monto);
    
    if(prestamo.saldoPendiente < 0.1) {
        prestamo.estado = 'pagado';
        prestamo.saldoPendiente = 0;
        toast('Deuda liquidada','success');
    } else {
        toast('Abono registrado','success');
    }
    await updateDoc(doc(db,"usuarios",clientePrestamoCajero.uid), clientePrestamoCajero);
    document.getElementById('cajero-loan-info').classList.add('oculto');
    document.getElementById('cajero-loan-pay').value='';
    document.getElementById('cajero-search-loan').value='';
};

// --- ADMIN ---
window.cargarUsuariosAdmin = async () => {
    const tCli = document.getElementById('tabla-clientes-body');
    const tEmp = document.getElementById('tabla-trabajadores-body');
    tCli.innerHTML='<tr><td>Cargando...</td></tr>'; tEmp.innerHTML='<tr><td>Cargando...</td></tr>';
    
    const s = await getDocs(collection(db,"usuarios"));
    tCli.innerHTML=''; tEmp.innerHTML='';
    
    s.forEach(d => {
        const u = d.data();
        if(u.rol === 'sistema') return; // Ocultar usuario sistema/banco

        const foto = u.foto || defaultAvatar;
        // SEPARACIÓN DE LISTAS
        if(u.rol === 'cliente') {
            tCli.innerHTML += `<tr>
                <td><img src="${foto}" class="avatar-table"></td>
                <td>${u.nombres}<br><small>${u.username}</small></td>
                <td>${u.cedula}</td>
                <td>${formatoDinero(u.saldo)}</td>
                <td>
                    <button class="btn-blue" onclick="verDetalleCliente('${u.username}')" title="Ver Detalle"><i class="fas fa-eye"></i></button>
                    <button class="btn-red" onclick="eliminarUsuario('${u.username}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        } 
        else if(u.rol === 'admin' || u.rol === 'cajero') {
            tEmp.innerHTML += `<tr>
                <td><img src="${foto}" class="avatar-table"></td>
                <td>${u.nombres}</td>
                <td><span class="account-badge">${u.rol.toUpperCase()}</span></td>
                <td>${u.telefono||'-'}</td>
                <td><button class="btn-red" onclick="eliminarUsuario('${u.username}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }
    });
};

window.verDetalleCliente = async (uid) => {
    const s = await getDoc(doc(db,"usuarios",uid));
    if(!s.exists()) return;
    const u = s.data();
    
    document.getElementById('admin-usuarios').classList.add('oculto');
    document.getElementById('admin-detalle-cliente').classList.remove('oculto');
    
    document.getElementById('detalle-nombre').innerText = u.nombres;
    document.getElementById('detalle-cedula').innerText = "C.I: "+u.cedula;
    document.getElementById('detalle-cuenta').innerText = "Cta: "+u.cuenta;
    document.getElementById('detalle-saldo').innerText = formatoDinero(u.saldo);
    document.getElementById('detalle-foto').src = u.foto || defaultAvatar;
    
    const p = (u.solicitudes||[]).find(x=>x.estado==='aprobado');
    const infoDiv = document.getElementById('detalle-info-prestamo');
    const tablaDiv = document.getElementById('detalle-amortizacion-container');
    
    if(p) {
        if(p.saldoPendiente===undefined) p.saldoPendiente = p.totalPagar;
        infoDiv.innerHTML = `<div class="stat-card" style="border:1px solid #2ecc71;">
            <h4 class="text-green">Préstamo Activo</h4>
            <p>Monto Original: ${formatoDinero(p.monto)}</p>
            <p>Saldo Pendiente: <strong class="text-red">${formatoDinero(p.saldoPendiente)}</strong></p>
        </div>`;
        tablaDiv.classList.remove('hidden');
        generarHTMLAmortizacion(p, 'tabla-amortizacion-admin');
    } else {
        infoDiv.innerHTML = '<p class="text-center text-gray">El cliente no tiene deudas activas.</p>';
        tablaDiv.classList.add('hidden');
    }
};

window.cerrarDetalleCliente = () => {
    document.getElementById('admin-detalle-cliente').classList.add('oculto');
    document.getElementById('admin-usuarios').classList.remove('oculto');
};

function generarHTMLAmortizacion(solicitud, elementId) {
    const tbody = document.getElementById(elementId);
    tbody.innerHTML = '';
    const cuota = solicitud.totalPagar / parseInt(solicitud.plazo);
    let saldo = solicitud.totalPagar;
    
    for(let i=1; i<=solicitud.plazo; i++) {
        saldo -= cuota;
        if(saldo<0) saldo=0;
        tbody.innerHTML += `<tr>
            <td>Mes ${i}</td>
            <td class="text-gold">${formatoDinero(cuota)}</td>
            <td>${formatoDinero(saldo)}</td>
        </tr>`;
    }
}

window.eliminarUsuario = async(u)=>{ if(confirm('¿Eliminar?')) { await deleteDoc(doc(db,"usuarios",u)); cargarUsuariosAdmin(); }};

window.cargarSolicitudesAdmin = async () => {
    const c = document.getElementById('lista-solicitudes-prestamo');
    c.innerHTML='Cargando...';
    const s = await getDocs(collection(db,"usuarios"));
    c.innerHTML='';
    s.forEach(d=>{
        const u=d.data();
        (u.solicitudes||[]).forEach(sol=>{
            if(sol.estado==='pendiente'){
                c.innerHTML+=`<div class="request-card">
                    <h4>${u.nombres}</h4>
                    <p>Monto: ${formatoDinero(sol.monto)} (${sol.plazo} meses)</p>
                    <p>Total a Pagar: <strong>${formatoDinero(sol.totalPagar)}</strong></p>
                    <div style="display:flex;gap:10px;margin-top:10px">
                        <button class="btn-green" style="flex:1" onclick="gestionarPrestamo('${d.id}','${sol.id}',true)">Aprobar</button>
                        <button class="btn-red" style="flex:1" onclick="gestionarPrestamo('${d.id}','${sol.id}',false)">Rechazar</button>
                    </div>
                </div>`;
            }
        });
    });
};

window.gestionarPrestamo = async (uid, sid, ok) => {
    const ref = doc(db,"usuarios",uid);
    const u = (await getDoc(ref)).data();
    const idx = u.solicitudes.findIndex(s=>s.id===sid);
    if(idx===-1) return;
    
    if(ok) {
        // VALIDAR FONDO DEL BANCO
        const banco = await obtenerFondoBanco();
        const montoPrestamo = u.solicitudes[idx].monto;

        if(banco.saldo < montoPrestamo) {
            return toast('Error: El banco no tiene fondos suficientes','error');
        }

        // Transferir del Banco al Usuario
        await actualizarFondoBanco(banco.saldo - montoPrestamo);
        u.saldo += montoPrestamo;

        u.movimientos.push({desc:'Préstamo Aprobado', monto: montoPrestamo, fecha:new Date().toLocaleDateString()});
        u.solicitudes[idx].estado = 'aprobado';
        u.solicitudes[idx].saldoPendiente = u.solicitudes[idx].totalPagar;
        toast('Aprobado','success');
    } else {
        u.solicitudes[idx].estado = 'rechazado';
        toast('Rechazado','info');
    }
    await updateDoc(ref, u);
    cargarSolicitudesAdmin();
};

window.cargarTransaccionesGlobales = async () => {
    const t = document.getElementById('tabla-transacciones-body');
    const s = await getDocs(collection(db,"usuarios"));
    let arr=[];
    s.forEach(d=>{ const u=d.data(); if(u.rol!=='sistema')(u.movimientos||[]).forEach(m=>arr.push({...m,user:u.nombres})); });
    t.innerHTML='';
    arr.slice(-20).reverse().forEach(x=>{
        t.innerHTML+=`<tr><td>${x.fecha}</td><td>${x.user}</td><td>${x.desc}</td><td>${formatoDinero(Math.abs(x.monto))}</td></tr>`;
    });
};

window.cargarDashboardAdmin = async () => {
    const s = await getDocs(collection(db,"usuarios"));
    let capClientes=0, con=0, sin=0;
    
    // Obtener Fondo del Banco
    const banco = await obtenerFondoBanco();

    s.forEach(d=>{ 
        const u=d.data(); 
        if(u.rol==='cliente'){ 
            capClientes+=u.saldo; 
            if(u.saldo>0) con++; else sin++; 
        } 
    });
    
    document.getElementById('total-capital').innerText = formatoDinero(banco.saldo);
    document.getElementById('dinero-clientes').innerText = formatoDinero(capClientes);
    document.getElementById('estado-reserva').innerText = banco.saldo>50000?'Saludable':'Baja';
    
    if(chartInstance) chartInstance.destroy(); if(barInstance) barInstance.destroy();
    chartInstance = new Chart(document.getElementById('graficoPastel'), { type:'doughnut', data:{labels:['Con Saldo','Sin Saldo'], datasets:[{data:[con,sin], backgroundColor:['#2ecc71','#e74c3c']}]} });
    barInstance = new Chart(document.getElementById('graficoBarras'), { type:'bar', data:{labels:['Fondo Banco','Dinero Clientes'], datasets:[{label:'USD',data:[banco.saldo,capClientes], backgroundColor:['#e6b333','#3498db']}]} });
};

function toast(m,t){const c=document.getElementById('toast-container');const d=document.createElement('div');d.className='toast';d.innerText=m;d.style.borderLeftColor=t==='error'?'red':'green';c.appendChild(d);setTimeout(()=>d.remove(),3000);}