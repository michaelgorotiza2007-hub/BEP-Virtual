import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// ⚠️ PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE ⚠️
// ==========================================
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
let rolSeleccionadoRegistro = 'cliente'; 
const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// --- INICIO ---
window.onload = async () => {
    const d = document.getElementById('current-date');
    if(d) d.innerText = new Date().toLocaleDateString('es-EC', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
    
    const savedUser = localStorage.getItem('bep_active_user');
    if(savedUser) await cargarDatosUsuario(savedUser);
};

async function cargarDatosUsuario(username) {
    try {
        const docRef = doc(db, "usuarios", username);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            usuario = snap.data();
            if(!usuario.solicitudes) usuario.solicitudes = [];
            if(!usuario.foto) usuario.foto = defaultAvatar;
        }
    } catch (e) { console.error(e); }
}

// --- NAVEGACIÓN ---
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    if(usuario) entrarSistema();
    else document.getElementById('auth-screen').classList.remove('oculto');
};

window.toggleAuth = (tab) => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registro').classList.add('oculto');
    document.getElementById('form-' + tab).classList.remove('oculto');
    document.querySelectorAll('.tabs-modern button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    
    if(tab === 'registro') {
        document.getElementById('registro-paso-1').classList.remove('oculto');
        document.getElementById('registro-paso-2').classList.add('oculto');
    }
};

window.mostrarPanel = (id) => {
    document.querySelectorAll('#dashboard .view').forEach(v => v.classList.add('oculto'));
    document.getElementById('panel-' + id).classList.remove('oculto');
    document.querySelectorAll('.sidebar .nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
};

window.mostrarPanelAdmin = (id) => {
    document.querySelectorAll('.view-admin').forEach(v => v.classList.add('oculto'));
    document.getElementById('admin-' + id).classList.remove('oculto');
    document.querySelectorAll('.admin-sidebar .nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
    
    if(id === 'usuarios') cargarUsuariosAdmin();
    if(id === 'prestamos') cargarSolicitudesAdmin();
    if(id === 'transacciones') cargarTransaccionesGlobales();
};

// --- REGISTRO ---
window.seleccionarPerfil = (perfil) => {
    rolSeleccionadoRegistro = perfil;
    document.getElementById('registro-paso-1').classList.add('oculto');
    document.getElementById('registro-paso-2').classList.remove('oculto');
    
    const titulo = document.getElementById('titulo-registro');
    const staffCodeArea = document.getElementById('staff-code-area');
    
    if(perfil === 'staff') {
        titulo.innerText = "Registro de Personal";
        staffCodeArea.classList.remove('hidden');
    } else {
        titulo.innerText = "Registro de Cliente";
        staffCodeArea.classList.add('hidden');
    }
};

window.volverSeleccion = () => {
    document.getElementById('registro-paso-2').classList.add('oculto');
    document.getElementById('registro-paso-1').classList.remove('oculto');
};

window.previewImage = () => {
    const file = document.getElementById('reg-foto').files[0];
    const reader = new FileReader();
    reader.onload = () => {
        document.getElementById('avatar-preview').src = reader.result;
        document.getElementById('avatar-preview').classList.remove('hidden');
    }
    if(file) reader.readAsDataURL(file);
};

const toBase64 = f => new Promise((res, rej) => {
    const r = new FileReader(); r.readAsDataURL(f);
    r.onload = () => res(r.result); r.onerror = e => rej(e);
});

window.registrarUsuario = async () => {
    const u = document.getElementById('reg-user').value.trim();
    const p = document.getElementById('reg-pass').value.trim();
    const n = document.getElementById('reg-nombres').value.trim();
    const c = document.getElementById('reg-cedula').value.trim();
    const terms = document.getElementById('reg-terms').checked;
    
    if(!u || !p || !n || !c) return toast('Faltan datos', 'error');
    if(!terms) return toast('Acepte los términos', 'error');

    try {
        if((await getDoc(doc(db,"usuarios",u))).exists()) return toast('Usuario ya existe', 'error');
    } catch(e) { return toast('Error de conexión', 'error'); }

    let rol = 'cliente';
    if(rolSeleccionadoRegistro === 'staff') {
        const code = document.getElementById('reg-staff-code').value.trim();
        if(code === "BEP2025") rol = 'admin';
        else if(code === "CAJA2025") rol = 'cajero';
        else return toast('Código de acceso inválido', 'error');
    }

    let foto = defaultAvatar;
    const fInput = document.getElementById('reg-foto');
    if(fInput.files[0]) foto = await toBase64(fInput.files[0]);

    const obj = {
        username: u, password: p, nombres: n,
        apellidos: document.getElementById('reg-apellidos').value.trim(),
        cedula: c, telefono: document.getElementById('reg-telefono').value.trim(),
        foto: foto, rol: rol,
        cuenta: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        saldo: 0.00, movimientos: [], inversiones: [], solicitudes: []
    };

    try {
        await setDoc(doc(db, "usuarios", u), obj);
        toast('Cuenta creada con éxito', 'success');
        window.toggleAuth('login');
    } catch(e) { toast('Error al guardar', 'error'); }
};

window.iniciarSesion = async () => {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if(!u || !p) return toast('Ingrese usuario y contraseña', 'error');

    try {
        const snap = await getDoc(doc(db, "usuarios", u));
        if (snap.exists() && snap.data().password === p) {
            usuario = snap.data();
            localStorage.setItem('bep_active_user', usuario.username);
            entrarSistema();
        } else toast('Credenciales incorrectas', 'error');
    } catch(e) { toast('Error de conexión', 'error'); }
};

function entrarSistema() {
    document.getElementById('auth-screen').classList.add('oculto');
    document.getElementById('intro-screen').style.display = 'none';

    const fotoUrl = usuario.foto || defaultAvatar;

    if(usuario.rol === 'admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        cargarUsuariosAdmin();
    } 
    else if(usuario.rol === 'cajero') {
        document.getElementById('cajero-panel').classList.remove('oculto');
        document.getElementById('cajero-name-display').innerText = usuario.nombres;
    }
    else {
        document.getElementById('dashboard').classList.remove('oculto');
        document.getElementById('nav-avatar').src = fotoUrl;
        actualizarUI();
    }
}

window.cerrarSesion = () => {
    usuario = null;
    localStorage.removeItem('bep_active_user');
    location.reload();
};

// --- CLIENTE ---
async function guardarUsuario() { await updateDoc(doc(db, "usuarios", usuario.username), usuario); actualizarUI(); }

function actualizarUI() {
    document.getElementById('nav-user').innerText = usuario.nombres;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto || defaultAvatar;
    
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().slice(0, 10).forEach(m => {
        const color = m.monto > 0 ? 'text-green' : 'text-red';
        list.innerHTML += `<li><div><strong>${m.desc}</strong><br><small>${m.fecha}</small></div><div class="${color}">$${Math.abs(m.monto).toFixed(2)}</div></li>`;
    });

    // PRÉSTAMOS
    const solicitud = (usuario.solicitudes || []).find(s => s.estado === 'pendiente' || s.estado === 'aprobado');
    const formContainer = document.getElementById('form-prestamo-container');
    const statusBox = document.getElementById('estado-prestamo');
    const tablaAmortContainer = document.getElementById('amortizacion-user-container');

    if(!solicitud) {
        formContainer.classList.remove('hidden');
        statusBox.innerText = 'No tienes solicitudes activas.';
        tablaAmortContainer.classList.add('hidden');
    } else if (solicitud.estado === 'pendiente') {
        formContainer.classList.add('hidden');
        statusBox.innerText = `Solicitud de $${solicitud.monto} en revisión.`;
        statusBox.style.color = '#f1c40f';
        tablaAmortContainer.classList.add('hidden');
    } else if (solicitud.estado === 'aprobado') {
        formContainer.classList.add('hidden');
        statusBox.innerText = `Tienes un crédito activo de $${solicitud.monto}.`;
        statusBox.style.color = '#2ecc71';
        tablaAmortContainer.classList.remove('hidden');
        generarHTMLAmortizacion(solicitud, 'tabla-amortizacion-user');
    }

    // OTROS SERVICIOS (PAGO)
    const deudaDisplay = document.getElementById('info-deuda-display');
    const inputsPago = document.getElementById('form-pago-inputs');
    const prestamoActivo = (usuario.solicitudes || []).find(s => s.estado === 'aprobado');

    if (prestamoActivo) {
        const deudaTotal = prestamoActivo.saldoPendiente !== undefined ? prestamoActivo.saldoPendiente : prestamoActivo.totalPagar;
        deudaDisplay.innerHTML = `Tienes un préstamo activo.<br>Deuda Pendiente: <strong class="text-red">$${deudaTotal.toFixed(2)}</strong>`;
        inputsPago.classList.remove('hidden');
    } else {
        deudaDisplay.innerHTML = `<i class="fas fa-check-circle text-green"></i> No tienes deudas pendientes.`;
        inputsPago.classList.add('hidden');
    }
}

window.solicitarPrestamo = async () => {
    const m = parseFloat(document.getElementById('prestamo-monto').value);
    const ing = document.getElementById('prestamo-ingresos').value;
    const mot = document.getElementById('prestamo-motivo').value;
    const trab = document.getElementById('prestamo-trabajo').value;
    const pl = document.getElementById('prestamo-plazo').value;

    if(m <= 0 || !ing || !mot || !trab) return toast('Complete todos los campos', 'error');
    if(!usuario.solicitudes) usuario.solicitudes = [];
    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) return toast('Ya tiene una solicitud pendiente', 'error');

    let interest = pl == 3 ? 0.05 : (pl == 6 ? 0.10 : 0.15);
    const total = m + (m*interest);
    
    usuario.solicitudes.push({
        id: Date.now().toString(), monto: m, plazo: pl, interes: interest*100,
        totalPagar: total, saldoPendiente: total, 
        motivo: mot, ingresos: ing, trabajo: trab, 
        estado: 'pendiente', fecha: new Date().toLocaleDateString()
    });

    await guardarUsuario();
    toast(`Solicitud enviada.`, 'success');
};

window.pagarPrestamo = async () => {
    const monto = parseFloat(document.getElementById('monto-pago-prestamo').value);
    if (!monto || monto <= 0) return toast('Ingresa un monto válido', 'error');
    if (monto > usuario.saldo) return toast('Saldo insuficiente', 'error');

    const idx = (usuario.solicitudes || []).findIndex(s => s.estado === 'aprobado');
    if (idx === -1) return toast('No hay préstamo activo', 'error');
    
    let prestamo = usuario.solicitudes[idx];
    if (prestamo.saldoPendiente === undefined) prestamo.saldoPendiente = prestamo.totalPagar;

    if (monto > prestamo.saldoPendiente) return toast(`El monto excede tu deuda ($${prestamo.saldoPendiente.toFixed(2)})`, 'error');

    usuario.saldo -= monto;
    prestamo.saldoPendiente -= monto;
    usuario.movimientos.push({ desc: 'Pago de Préstamo', monto: -monto, fecha: new Date().toLocaleDateString() });

    if (prestamo.saldoPendiente < 0.1) {
        prestamo.estado = 'pagado';
        prestamo.saldoPendiente = 0;
        toast('¡Felicidades! Has liquidado tu préstamo.', 'success');
    } else {
        toast('Abono realizado exitosamente', 'success');
    }

    await guardarUsuario();
    document.getElementById('monto-pago-prestamo').value = '';
};

window.operar = async (tipo) => {
    if(tipo === 'transferencia') {
        const dest = document.getElementById('tercero-cuenta').value;
        const mont = parseFloat(document.getElementById('tercero-monto').value);
        if(!dest || mont <= 0) return toast('Datos inválidos', 'error');
        if(mont > usuario.saldo) return toast('Saldo insuficiente', 'error');

        const q = query(collection(db,"usuarios"), where("cuenta","==",dest));
        const snap = await getDocs(q);
        if(snap.empty) return toast('Cuenta destino no encontrada', 'error');
        
        const targetDoc = snap.docs[0];
        const targetUser = targetDoc.data();

        usuario.saldo -= mont;
        usuario.movimientos.push({desc:`Transf. a ${targetUser.nombres}`, monto: -mont, fecha: new Date().toLocaleDateString()});
        
        targetUser.saldo += mont;
        if(!targetUser.movimientos) targetUser.movimientos = [];
        targetUser.movimientos.push({desc:`Transf. de ${usuario.nombres}`, monto: mont, fecha: new Date().toLocaleDateString()});

        await updateDoc(doc(db,"usuarios",usuario.username), usuario);
        await updateDoc(doc(db,"usuarios",targetDoc.id), targetUser);
        toast('Transferencia exitosa', 'success');
        actualizarUI();
    }
    if(tipo === 'cobrar-cheque') {
        const m = parseFloat(document.getElementById('cheque-monto').value);
        if(m > 0) {
            usuario.saldo += m;
            usuario.movimientos.push({desc:'Cheque Depositado', monto:m, fecha: new Date().toLocaleDateString()});
            await guardarUsuario();
            toast('Cheque depositado', 'success');
        }
    }
};

window.copiarCuenta = () => { navigator.clipboard.writeText(usuario.cuenta); toast('Copiado'); };

// --- CAJERO ---
window.buscarClienteCajero = async () => {
    const val = document.getElementById('cajero-search-input').value.trim();
    if(!val) return toast('Ingrese cuenta o cédula', 'error');
    
    let q = query(collection(db,"usuarios"), where("cuenta","==",val));
    let s = await getDocs(q);
    if(s.empty) {
        q = query(collection(db,"usuarios"), where("cedula","==",val));
        s = await getDocs(q);
    }
    if(s.empty) return toast('Cliente no encontrado', 'error');

    const d = s.docs[0];
    clienteCajero = { ...d.data(), uid: d.id };
    
    document.getElementById('cajero-cliente-info').classList.remove('oculto');
    document.getElementById('cajero-client-nombre').innerText = `${clienteCajero.nombres} ${clienteCajero.apellidos}`;
    document.getElementById('cajero-client-cuenta').innerText = clienteCajero.cuenta;
    document.getElementById('cajero-client-saldo').innerText = `$${clienteCajero.saldo.toFixed(2)}`;
    document.getElementById('cajero-client-foto').src = clienteCajero.foto || defaultAvatar;
};

window.ejecutarOperacionCajero = async () => {
    if(!clienteCajero) return;
    const tipo = document.getElementById('cajero-tipo-op').value;
    const m = parseFloat(document.getElementById('cajero-monto-op').value);
    
    if(m <= 0) return toast('Monto inválido', 'error');

    if(tipo === 'retiro') {
        if(m > clienteCajero.saldo) return toast('Saldo insuficiente', 'error');
        clienteCajero.saldo -= m;
        clienteCajero.movimientos.push({desc:'Retiro en Ventanilla', monto:-m, fecha: new Date().toLocaleDateString()});
    } else {
        clienteCajero.saldo += m;
        clienteCajero.movimientos.push({desc:'Depósito en Ventanilla', monto:m, fecha: new Date().toLocaleDateString()});
    }
    
    await updateDoc(doc(db,"usuarios",clienteCajero.uid), clienteCajero);
    toast('Transacción completada', 'success');
    document.getElementById('cajero-client-saldo').innerText = `$${clienteCajero.saldo.toFixed(2)}`;
    document.getElementById('cajero-monto-op').value = '';
};

// --- ADMIN ---
window.cargarUsuariosAdmin = async () => {
    const tClientes = document.getElementById('tabla-clientes-body');
    const tTrabajadores = document.getElementById('tabla-trabajadores-body');
    tClientes.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';
    tTrabajadores.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';

    const snap = await getDocs(collection(db, "usuarios"));
    tClientes.innerHTML = ''; tTrabajadores.innerHTML = '';

    snap.forEach(d => {
        const u = d.data();
        const foto = u.foto || defaultAvatar;
        
        if(u.rol === 'cliente') {
            tClientes.innerHTML += `<tr>
                <td><img src="${foto}" class="avatar-sidebar" style="width:40px;height:40px;"></td>
                <td>${u.nombres} ${u.apellidos}<br><small style="color:#aaa">${u.username}</small></td>
                <td>${u.cedula}</td>
                <td>${u.cuenta}</td>
                <td>$${u.saldo.toFixed(2)}</td>
                <td>
                    <button class="btn-blue" style="padding:5px 10px;" onclick="verDetalleCliente('${d.id}')" title="Ver Datos"><i class="fas fa-eye"></i></button>
                    <button class="btn-red" style="padding:5px 10px;" onclick="eliminarUsuario('${d.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        } 
        else if (u.rol === 'admin' || u.rol === 'cajero') {
            const rolStyle = u.rol === 'admin' ? 'border:1px solid #e6b333;color:#e6b333' : 'border:1px solid #2ecc71;color:#2ecc71';
            tTrabajadores.innerHTML += `<tr>
                <td><img src="${foto}" class="avatar-sidebar" style="width:40px;height:40px;"></td>
                <td>${u.nombres} ${u.apellidos}</td>
                <td>${u.cedula}</td>
                <td><span class="account-badge" style="${rolStyle}">${u.rol.toUpperCase()}</span></td>
                <td>${u.telefono || '-'}</td>
                <td><button class="btn-red" style="padding:5px 10px;" onclick="eliminarUsuario('${d.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }
    });
};

window.verDetalleCliente = async (uid) => {
    try {
        const docSnap = await getDoc(doc(db, "usuarios", uid));
        if(!docSnap.exists()) return;
        const u = docSnap.data();

        document.getElementById('detalle-nombre').innerText = `${u.nombres} ${u.apellidos}`;
        document.getElementById('detalle-cedula').innerText = `C.I: ${u.cedula}`;
        document.getElementById('detalle-cuenta').innerText = `Cta: ${u.cuenta}`;
        document.getElementById('detalle-saldo').innerText = `$${u.saldo.toFixed(2)}`;
        document.getElementById('detalle-foto').src = u.foto || defaultAvatar;

        const prestamo = (u.solicitudes || []).find(s => s.estado === 'aprobado');
        const infoDiv = document.getElementById('detalle-info-prestamo');
        const tableDiv = document.getElementById('detalle-amortizacion-container');

        if(prestamo) {
            // Asegurar que saldoPendiente exista
            const deuda = prestamo.saldoPendiente !== undefined ? prestamo.saldoPendiente : prestamo.totalPagar;
            infoDiv.innerHTML = `<p class="text-green"><i class="fas fa-check-circle"></i> Crédito activo.</p>
                                 <p>Monto Original: $${prestamo.monto} | Saldo Pendiente: <strong>$${deuda.toFixed(2)}</strong></p>`;
            tableDiv.classList.remove('hidden');
            generarHTMLAmortizacion(prestamo, 'tabla-amortizacion-admin');
        } else {
            infoDiv.innerHTML = `<p class="text-gray">Sin créditos activos.</p>`;
            tableDiv.classList.add('hidden');
        }

        document.getElementById('admin-usuarios').classList.add('oculto');
        document.getElementById('admin-detalle-cliente').classList.remove('oculto');
    } catch(e) { console.error(e); toast('Error', 'error'); }
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
    
    for(let i = 1; i <= solicitud.plazo; i++) {
        saldo -= cuota;
        if(saldo < 0) saldo = 0;
        tbody.innerHTML += `<tr><td>Mes ${i}</td><td class="text-gold">$${cuota.toFixed(2)}</td><td>$${saldo.toFixed(2)}</td></tr>`;
    }
}

window.eliminarUsuario = async (id) => {
    if(confirm('¿Eliminar usuario?')) {
        await deleteDoc(doc(db,"usuarios",id));
        cargarUsuariosAdmin();
    }
};

window.cargarSolicitudesAdmin = async () => {
    const c = document.getElementById('lista-solicitudes-prestamo');
    c.innerHTML = 'Cargando...';
    const s = await getDocs(collection(db,"usuarios"));
    c.innerHTML = '';
    s.forEach(d => {
        const u = d.data();
        if(u.solicitudes) {
            u.solicitudes.forEach(sol => {
                if(sol.estado === 'pendiente') {
                    c.innerHTML += `<div class="request-card">
                        <h4>${u.nombres} ${u.apellidos}</h4>
                        <p>Solicita: <strong class="text-gold">$${sol.monto}</strong> (${sol.plazo} meses)</p>
                        <p class="small-text">Motivo: ${sol.motivo} | Ing: $${sol.ingresos}</p>
                        <div style="margin-top:10px; display:flex; gap:10px;">
                            <button class="btn-green" style="flex:1" onclick="gestionarPrestamo('${d.id}','${sol.id}',true)">Aprobar</button>
                            <button class="btn-red" style="flex:1" onclick="gestionarPrestamo('${d.id}','${sol.id}',false)">Rechazar</button>
                        </div>
                    </div>`;
                }
            });
        }
    });
};

window.gestionarPrestamo = async (uid, sid, ok) => {
    const ref = doc(db,"usuarios",uid);
    const u = (await getDoc(ref)).data();
    const idx = u.solicitudes.findIndex(s => s.id === sid);
    if(idx === -1) return;

    if(ok) {
        u.saldo += u.solicitudes[idx].monto;
        u.movimientos.push({desc:'Préstamo Aprobado', monto:u.solicitudes[idx].monto, fecha: new Date().toLocaleDateString()});
        u.solicitudes[idx].estado = 'aprobado';
        // Inicializar deuda
        u.solicitudes[idx].saldoPendiente = u.solicitudes[idx].totalPagar;
        toast('Préstamo aprobado', 'success');
    } else {
        u.solicitudes[idx].estado = 'rechazado';
        toast('Préstamo rechazado', 'info');
    }
    await updateDoc(ref, u);
    cargarSolicitudesAdmin();
};

window.cargarTransaccionesGlobales = async () => {
    const t = document.getElementById('tabla-transacciones-body');
    const s = await getDocs(collection(db,"usuarios"));
    let arr = [];
    s.forEach(d => { const u = d.data(); if(u.movimientos) u.movimientos.forEach(m => arr.push({...m, user:u.nombres})); });
    t.innerHTML = '';
    arr.slice(-20).reverse().forEach(x => {
        t.innerHTML += `<tr><td>${x.fecha}</td><td>${x.user}</td><td>${x.desc}</td><td>$${Math.abs(x.monto)}</td></tr>`;
    });
};

function toast(m, t) {
    const c = document.getElementById('toast-container');
    const d = document.createElement('div'); d.className='toast'; d.innerText=m;
    d.style.borderLeftColor = t==='error'?'red':'green';
    c.appendChild(d); setTimeout(()=>d.remove(),3000);
}