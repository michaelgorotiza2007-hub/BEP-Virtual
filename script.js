import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE ⚠️
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
let clientePrestamoCajero = null; // Para el cajero al cobrar préstamos
let chartInstance = null;
let barInstance = null;
const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let rolSeleccionadoRegistro = 'cliente';

// --- INICIO ---
window.onload = async () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElem = document.getElementById('current-date');
    if(dateElem) dateElem.innerText = new Date().toLocaleDateString('es-EC', options);
    const savedUser = localStorage.getItem('bep_active_user');
    if(savedUser) await cargarDatosUsuario(savedUser);
};

async function cargarDatosUsuario(username) {
    try {
        const docRef = doc(db, "usuarios", username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            usuario = docSnap.data();
            if(!usuario.solicitudes) usuario.solicitudes = [];
            if(!usuario.foto) usuario.foto = defaultAvatar;
        }
    } catch (e) { console.error(e); }
}

// --- NAVEGACIÓN ---
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    if(usuario) entrarSistema(); else document.getElementById('auth-screen').classList.remove('oculto');
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
    if(id === 'dashboard') cargarDashboardAdmin();
    if(id === 'transacciones') cargarTransaccionesGlobales();
};
window.mostrarPanelCajero = (id) => {
    document.querySelectorAll('.view-cajero').forEach(v => v.classList.add('oculto'));
    document.getElementById('cajero-' + id).classList.remove('oculto');
    document.querySelectorAll('.sidebar .nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
};

// --- REGISTRO Y LOGIN ---
window.seleccionarPerfil = (perfil) => {
    rolSeleccionadoRegistro = perfil;
    document.getElementById('registro-paso-1').classList.add('oculto');
    document.getElementById('registro-paso-2').classList.remove('oculto');
    const area = document.getElementById('staff-code-area');
    if(perfil === 'staff') area.classList.remove('hidden'); else area.classList.add('hidden');
};
window.volverSeleccion = () => {
    document.getElementById('registro-paso-2').classList.add('oculto');
    document.getElementById('registro-paso-1').classList.remove('oculto');
};
window.previewImage = () => {
    const file = document.getElementById('reg-foto').files[0];
    const preview = document.getElementById('avatar-preview');
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => { preview.src = reader.result; preview.classList.remove('hidden'); }
        reader.readAsDataURL(file);
    }
};
const toBase64 = file => new Promise((res, rej) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = () => res(reader.result); reader.onerror = e => rej(e);
});
window.registrarUsuario = async () => {
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const nombres = document.getElementById('reg-nombres').value.trim();
    const cedula = document.getElementById('reg-cedula').value.trim();
    const terms = document.getElementById('reg-terms').checked;
    
    if(!user || !pass || !nombres || !cedula) return mostrarToast('Complete campos', 'error');
    if(!terms) return mostrarToast('Acepte los términos', 'error');
    
    try {
        const docSnap = await getDoc(doc(db, "usuarios", user));
        if(docSnap.exists()) return mostrarToast('Usuario ya existe', 'error');
    } catch(e) { return mostrarToast('Error de conexión', 'error'); }

    let rol = 'cliente';
    if(rolSeleccionadoRegistro === 'staff') {
        const code = document.getElementById('reg-staff-code').value.trim();
        if(code === "BEP2025") rol = 'admin';
        else if(code === "CAJA2025") rol = 'cajero';
        else return mostrarToast('Código inválido', 'error');
    }

    let fotoBase64 = defaultAvatar;
    if(document.getElementById('reg-foto').files[0]) fotoBase64 = await toBase64(document.getElementById('reg-foto').files[0]);

    const nuevoUsuario = {
        username: user, password: pass, nombres: nombres,
        apellidos: document.getElementById('reg-apellidos').value.trim(),
        cedula: cedula, telefono: document.getElementById('reg-telefono').value.trim(),
        foto: fotoBase64, rol: rol,
        cuenta: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        saldo: 0.00, movimientos: [], inversiones: [], solicitudes: []
    };

    try {
        await setDoc(doc(db, "usuarios", user), nuevoUsuario);
        mostrarToast('Cuenta creada', 'success'); window.toggleAuth('login');
    } catch (e) { mostrarToast('Error guardando', 'error'); }
};
window.iniciarSesion = async () => {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if(!user || !pass) return mostrarToast('Ingrese credenciales', 'error');
    try {
        const docSnap = await getDoc(doc(db, "usuarios", user));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(data.password === pass) {
                usuario = data;
                localStorage.setItem('bep_active_user', usuario.username);
                entrarSistema();
            } else mostrarToast('Contraseña incorrecta', 'error');
        } else mostrarToast('Usuario no encontrado', 'error');
    } catch (e) { mostrarToast('Error de conexión', 'error'); }
};
function entrarSistema() {
    document.getElementById('auth-screen').classList.add('oculto');
    document.getElementById('intro-screen').style.display = 'none';
    if(usuario.rol === 'admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        document.getElementById('admin-name-display').innerText = usuario.nombres;
        document.getElementById('admin-avatar-img').src = usuario.foto || defaultAvatar;
        cargarDashboardAdmin();
    } else if (usuario.rol === 'cajero') {
        document.getElementById('cajero-panel').classList.remove('oculto');
        document.getElementById('cajero-name-display').innerText = usuario.nombres;
    } else {
        document.getElementById('dashboard').classList.remove('oculto');
        actualizarUI();
    }
}
window.cerrarSesion = () => { usuario = null; localStorage.removeItem('bep_active_user'); location.reload(); };

// --- CLIENTE LÓGICA ---
async function guardarUsuario() { await updateDoc(doc(db, "usuarios", usuario.username), usuario); actualizarUI(); }
function actualizarUI() {
    document.getElementById('nav-user').innerText = `${usuario.nombres}`;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto || defaultAvatar;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;
    
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    (usuario.movimientos || []).slice().reverse().slice(0, 10).forEach(mov => {
        const color = mov.monto > 0 ? 'text-green' : 'text-red';
        list.innerHTML += `<li><div><strong>${mov.desc}</strong><br><small>${mov.fecha}</small></div><div class="${color}">$${Math.abs(mov.monto).toFixed(2)}</div></li>`;
    });

    // PRÉSTAMO Y TABLA AMORTIZACIÓN AUTOMÁTICA
    const prestamo = (usuario.solicitudes || []).find(s => s.estado === 'aprobado');
    const pendiente = (usuario.solicitudes || []).find(s => s.estado === 'pendiente');
    
    document.getElementById('estado-prestamo').innerText = pendiente ? 'En revisión.' : (prestamo ? 'Crédito Activo.' : 'Sin solicitudes.');
    
    const amortBox = document.getElementById('amortizacion-user-container');
    if(prestamo) {
        amortBox.classList.remove('hidden');
        generarHTMLAmortizacion(prestamo, 'tabla-amortizacion-user');
    } else {
        amortBox.classList.add('hidden');
    }

    // LISTA INVERSIONES
    const invList = document.getElementById('lista-inversiones');
    invList.innerHTML = '';
    usuario.inversiones.forEach(inv => invList.innerHTML += `<div style="padding:5px;border-bottom:1px solid #444;font-size:0.9rem">PF: $${inv.monto} (${inv.meses}M)</div>`);

    // PANEL PAGO (OTROS SERVICIOS)
    const deudaBox = document.getElementById('info-deuda-display');
    const inputPago = document.getElementById('form-pago-inputs');
    if(prestamo) {
        if(prestamo.saldoPendiente === undefined) prestamo.saldoPendiente = prestamo.totalPagar;
        deudaBox.innerHTML = `Deuda Pendiente: <strong class="text-red">$${prestamo.saldoPendiente.toFixed(2)}</strong>`;
        inputPago.classList.remove('hidden');
    } else {
        deudaBox.innerHTML = `<i class="fas fa-check-circle text-green"></i> Sin deudas.`;
        inputPago.classList.add('hidden');
    }
}

// NUEVA FUNCIÓN: PAGO DE PRÉSTAMO (USUARIO)
window.pagarPrestamoUser = async () => {
    const monto = parseFloat(document.getElementById('monto-pago-prestamo').value);
    if (!monto || monto <= 0) return mostrarToast('Monto inválido', 'error');
    if (monto > usuario.saldo) return mostrarToast('Saldo insuficiente', 'error');
    
    const idx = (usuario.solicitudes || []).findIndex(s => s.estado === 'aprobado');
    if(idx === -1) return;
    
    let p = usuario.solicitudes[idx];
    if(monto > p.saldoPendiente) return mostrarToast('Excede la deuda', 'error');
    
    // Descuento de saldo y deuda
    usuario.saldo -= monto;
    p.saldoPendiente -= monto;
    usuario.movimientos.push({ desc: 'Pago de Préstamo', monto: -monto, fecha: new Date().toLocaleDateString() });
    
    if(p.saldoPendiente < 0.1) {
        p.estado = 'pagado';
        p.saldoPendiente = 0;
        mostrarToast('¡Deuda Pagada!', 'success');
    } else {
        mostrarToast('Pago realizado', 'success');
    }
    
    await guardarUsuario();
    document.getElementById('monto-pago-prestamo').value = '';
};

window.operar = async (tipo) => {
    let monto = 0;
    if(tipo === 'deposito-propio') {
        monto = parseFloat(document.getElementById('op-deposito-monto').value);
        if(monto > 0) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: 'Depósito Ventanilla', monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario(); mostrarToast('Depósito exitoso', 'success'); document.getElementById('op-deposito-monto').value = '';
        }
    } else if (tipo === 'retiro') {
        monto = parseFloat(document.getElementById('op-retiro-monto').value);
        if(monto > 0 && monto <= usuario.saldo) {
            usuario.saldo -= monto;
            usuario.movimientos.push({ desc: 'Retiro Efectivo', monto: -monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario(); mostrarToast('Retiro exitoso', 'success'); document.getElementById('op-retiro-monto').value = '';
        } else mostrarToast('Saldo insuficiente', 'error');
    } else if (tipo === 'cobrar-cheque') {
        monto = parseFloat(document.getElementById('cheque-monto').value);
        if(monto > 0) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: 'Cheque', monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario(); mostrarToast('Depositado', 'success');
        }
    } else if (tipo === 'transferencia' || tipo === 'deposito-tercero') {
        const dest = document.getElementById('tercero-cuenta').value;
        const mont = parseFloat(document.getElementById('tercero-monto').value);
        if(!dest || mont <= 0) return mostrarToast('Datos inválidos', 'error');
        if(tipo === 'transferencia' && mont > usuario.saldo) return mostrarToast('Saldo insuficiente', 'error');
        
        const q = query(collection(db,"usuarios"), where("cuenta","==",dest));
        const s = await getDocs(q);
        if(s.empty) return mostrarToast('Destino no existe', 'error');
        
        const tDoc = s.docs[0]; const tData = tDoc.data();
        if(tipo === 'transferencia') {
            usuario.saldo -= mont;
            usuario.movimientos.push({desc:`Transf. a ${tData.nombres}`, monto:-mont, fecha:new Date().toLocaleDateString()});
            await guardarUsuario();
        }
        tData.saldo += mont;
        if(!tData.movimientos) tData.movimientos = [];
        const desc = tipo === 'transferencia' ? `Transf. de ${usuario.nombres}` : 'Depósito Tercero';
        tData.movimientos.push({desc:desc, monto:mont, fecha:new Date().toLocaleDateString()});
        await updateDoc(doc(db,"usuarios",tDoc.id), tData);
        mostrarToast('Éxito', 'success');
    }
};

window.crearPlazoFijo = async () => {
    const monto = parseFloat(document.getElementById('pf-monto').value);
    const meses = document.getElementById('pf-tiempo').value;
    if(monto > 0 && monto <= usuario.saldo) {
        usuario.saldo -= monto;
        usuario.inversiones.push({ monto: monto, meses: meses });
        usuario.movimientos.push({ desc: `Plazo Fijo (${meses}M)`, monto: -monto, fecha: new Date().toLocaleDateString() });
        await guardarUsuario(); mostrarToast('Inversión creada', 'success');
    }
};

window.solicitarPrestamo = async () => {
    const m = parseFloat(document.getElementById('prestamo-monto').value);
    const pl = document.getElementById('prestamo-plazo').value;
    if(m <= 0) return mostrarToast('Monto inválido', 'error');
    if((usuario.solicitudes || []).some(s => s.estado === 'pendiente' || s.estado === 'aprobado')) return mostrarToast('Ya tienes solicitud activa', 'error');
    
    let i = pl == 3 ? 0.05 : (pl == 6 ? 0.10 : 0.15);
    const total = m + (m * i);
    
    usuario.solicitudes.push({
        id: Date.now().toString(), monto: m, plazo: pl, interes: i * 100,
        totalPagar: total, saldoPendiente: total, estado: 'pendiente',
        motivo: document.getElementById('prestamo-motivo').value,
        ingresos: document.getElementById('prestamo-ingresos').value,
        trabajo: document.getElementById('prestamo-trabajo').value,
        fecha: new Date().toLocaleDateString()
    });
    await guardarUsuario();
    mostrarToast(`Solicitud enviada. Total: $${total.toFixed(2)}`, 'success');
    document.getElementById('prestamo-monto').value = '';
};

window.copiarCuenta = () => { navigator.clipboard.writeText(usuario.cuenta); mostrarToast('Copiado', 'success'); };

// --- CAJERO ---
window.buscarClienteCajero = async () => {
    const v = document.getElementById('cajero-search-input').value.trim();
    let q = query(collection(db,"usuarios"), where("cuenta","==",v));
    let s = await getDocs(q);
    if(s.empty) { q = query(collection(db,"usuarios"), where("cedula","==",v)); s = await getDocs(q); }
    if(s.empty) return mostrarToast('No encontrado', 'error');
    const d = s.docs[0];
    clienteCajero = { ...d.data(), uid: d.id };
    document.getElementById('cajero-cliente-info').classList.remove('oculto');
    document.getElementById('cajero-client-nombre').innerText = clienteCajero.nombres;
    document.getElementById('cajero-client-saldo').innerText = `$${clienteCajero.saldo.toFixed(2)}`;
    document.getElementById('cajero-client-foto').src = clienteCajero.foto || defaultAvatar;
};

window.ejecutarOperacionCajero = async () => {
    if(!clienteCajero) return;
    const tipo = document.getElementById('cajero-tipo-op').value;
    const m = parseFloat(document.getElementById('cajero-monto-op').value);
    if(m <= 0) return mostrarToast('Monto inválido', 'error');
    
    if(tipo === 'retiro') {
        if(m > clienteCajero.saldo) return mostrarToast('Saldo insuficiente', 'error');
        clienteCajero.saldo -= m;
        clienteCajero.movimientos.push({ desc: 'Retiro Ventanilla', monto: -m, fecha: new Date().toLocaleDateString() });
    } else {
        clienteCajero.saldo += m;
        clienteCajero.movimientos.push({ desc: 'Depósito Ventanilla', monto: m, fecha: new Date().toLocaleDateString() });
    }
    await updateDoc(doc(db,"usuarios",clienteCajero.uid), clienteCajero);
    mostrarToast('Éxito', 'success');
    document.getElementById('cajero-client-saldo').innerText = `$${clienteCajero.saldo.toFixed(2)}`;
    document.getElementById('cajero-monto-op').value = '';
};

// NUEVO: CAJERO COBRO PRÉSTAMO
window.buscarClientePrestamo = async () => {
    const v = document.getElementById('cajero-search-loan').value.trim();
    let q = query(collection(db,"usuarios"), where("cuenta","==",v));
    let s = await getDocs(q);
    if(s.empty) { q = query(collection(db,"usuarios"), where("cedula","==",v)); s = await getDocs(q); }
    if(s.empty) return mostrarToast('No encontrado', 'error');
    
    const d = s.docs[0];
    clientePrestamoCajero = { ...d.data(), uid: d.id };
    const p = (clientePrestamoCajero.solicitudes || []).find(x => x.estado === 'aprobado');
    if(!p) return mostrarToast('Sin deuda activa', 'error');
    
    if(p.saldoPendiente === undefined) p.saldoPendiente = p.totalPagar;
    document.getElementById('cajero-loan-info').classList.remove('oculto');
    document.getElementById('cajero-loan-client').innerText = `Cliente: ${clientePrestamoCajero.nombres}`;
    document.getElementById('cajero-loan-amount').innerText = `$${p.saldoPendiente.toFixed(2)}`;
};

window.pagarPrestamoCajero = async () => {
    if(!clientePrestamoCajero) return;
    const monto = parseFloat(document.getElementById('cajero-loan-pay').value);
    const p = clientePrestamoCajero.solicitudes.find(x => x.estado === 'aprobado');
    
    if(monto <= 0 || monto > p.saldoPendiente) return mostrarToast('Monto inválido', 'error');
    
    p.saldoPendiente -= monto;
    clientePrestamoCajero.movimientos.push({ desc: 'Pago Préstamo (Ventanilla)', monto: 0, fecha: new Date().toLocaleDateString() }); // Solo registro
    
    if(p.saldoPendiente < 0.1) {
        p.estado = 'pagado';
        p.saldoPendiente = 0;
        mostrarToast('Deuda liquidada', 'success');
    } else {
        mostrarToast('Abono registrado', 'success');
    }
    await updateDoc(doc(db,"usuarios",clientePrestamoCajero.uid), clientePrestamoCajero);
    document.getElementById('cajero-loan-info').classList.add('oculto');
    document.getElementById('cajero-loan-pay').value = '';
    document.getElementById('cajero-search-loan').value = '';
};

// --- ADMIN ---
window.cargarDashboardAdmin = async () => {
    const s = await getDocs(collection(db, "usuarios"));
    let cap = 0, con = 0, sin = 0;
    s.forEach(d => { const u = d.data(); if(u.rol !== 'admin') { cap += u.saldo; if(u.saldo > 0) con++; else sin++; } });
    document.getElementById('total-capital').innerText = `$${cap.toFixed(2)}`;
    document.getElementById('estado-reserva').innerText = cap > 5000 ? 'Saludable' : 'Baja';
    renderCharts(con, sin, cap);
};
function renderCharts(con, sin, cap) {
    const ctx1 = document.getElementById('graficoPastel').getContext('2d');
    const ctx2 = document.getElementById('graficoBarras').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    if(barInstance) barInstance.destroy();
    chartInstance = new Chart(ctx1, { type: 'doughnut', data: { labels: ['Con Saldo', 'Sin Saldo'], datasets: [{ data: [con, sin], backgroundColor: ['#2ecc71', '#e74c3c'], borderWidth: 0 }] } });
    barInstance = new Chart(ctx2, { type: 'bar', data: { labels: ['Capital', 'Meta'], datasets: [{ label: 'USD', data: [cap, 10000], backgroundColor: ['#e6b333', '#3498db'] }] }, options: { scales: { y: { beginAtZero: true } } } });
}

window.cargarUsuariosAdmin = async () => {
    const tCli = document.getElementById('tabla-clientes-body');
    const tTra = document.getElementById('tabla-trabajadores-body');
    tCli.innerHTML = '<tr><td>Cargando...</td></tr>'; tTra.innerHTML = '<tr><td>Cargando...</td></tr>';
    const s = await getDocs(collection(db, "usuarios"));
    tCli.innerHTML = ''; tTra.innerHTML = '';
    
    s.forEach(d => {
        const u = d.data();
        const f = u.foto || defaultAvatar;
        if(u.rol === 'cliente') {
            tCli.innerHTML += `<tr>
                <td><img src="${f}" class="avatar-table"></td>
                <td>${u.nombres}<br><small>${u.username}</small></td>
                <td>${u.cedula}</td>
                <td>$${u.saldo.toFixed(2)}</td>
                <td>
                    <button class="btn-blue" onclick="verDetalleCliente('${u.username}')" title="Ver Detalle"><i class="fas fa-eye"></i></button>
                    <button class="btn-red" onclick="eliminarUsuario('${u.username}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        } else if (u.rol === 'admin' || u.rol === 'cajero') {
            tTra.innerHTML += `<tr>
                <td><img src="${f}" class="avatar-table"></td>
                <td>${u.nombres}</td>
                <td><span class="account-badge">${u.rol.toUpperCase()}</span></td>
                <td>${u.telefono || '-'}</td>
                <td><button class="btn-red" onclick="eliminarUsuario('${u.username}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }
    });
};

// NUEVO: VER DETALLE CLIENTE (ADMIN + AMORTIZACIÓN)
window.verDetalleCliente = async (uid) => {
    const s = await getDoc(doc(db, "usuarios", uid));
    if(!s.exists()) return;
    const u = s.data();
    
    document.getElementById('admin-usuarios').classList.add('oculto');
    document.getElementById('admin-detalle-cliente').classList.remove('oculto');
    
    document.getElementById('detalle-nombre').innerText = u.nombres;
    document.getElementById('detalle-cedula').innerText = "C.I: " + u.cedula;
    document.getElementById('detalle-cuenta').innerText = "Cta: " + u.cuenta;
    document.getElementById('detalle-saldo').innerText = "$" + u.saldo.toFixed(2);
    document.getElementById('detalle-foto').src = u.foto || defaultAvatar;
    
    const p = (u.solicitudes || []).find(x => x.estado === 'aprobado');
    const infoDiv = document.getElementById('detalle-info-prestamo');
    const tablaDiv = document.getElementById('detalle-amortizacion-container');
    
    if(p) {
        if(p.saldoPendiente === undefined) p.saldoPendiente = p.totalPagar;
        infoDiv.innerHTML = `<div class="stat-card" style="border:1px solid #2ecc71;">
            <h4 class="text-green">Préstamo Activo</h4>
            <p>Monto Original: $${p.monto}</p>
            <p>Saldo Pendiente: <strong class="text-red">$${p.saldoPendiente.toFixed(2)}</strong></p>
        </div>`;
        tablaDiv.classList.remove('hidden');
        generarHTMLAmortizacion(p, 'tabla-amortizacion-admin');
    } else {
        infoDiv.innerHTML = '<p class="text-center text-gray">Sin deudas activas.</p>';
        tablaDiv.classList.add('hidden');
    }
};

window.cerrarDetalleCliente = () => {
    document.getElementById('admin-detalle-cliente').classList.add('oculto');
    document.getElementById('admin-usuarios').classList.remove('oculto');
};

// GENERADOR AUTOMÁTICO DE TABLA
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

window.eliminarUsuario = async (u) => { if(confirm('¿Borrar?')) { await deleteDoc(doc(db, "usuarios", u)); cargarUsuariosAdmin(); } };

window.cargarSolicitudesAdmin = async () => {
    const c = document.getElementById('lista-solicitudes-prestamo');
    c.innerHTML = 'Cargando...';
    const s = await getDocs(collection(db, "usuarios"));
    c.innerHTML = '';
    s.forEach(d => {
        const u = d.data();
        (u.solicitudes || []).forEach(sol => {
            if(sol.estado === 'pendiente') {
                c.innerHTML += `<div class="request-card">
                    <h4>${u.nombres}</h4>
                    <p>Monto: $${sol.monto} (${sol.plazo} meses)</p>
                    <p>Total: <strong>$${sol.totalPagar.toFixed(2)}</strong></p>
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
    const ref = doc(db, "usuarios", uid);
    const u = (await getDoc(ref)).data();
    const idx = u.solicitudes.findIndex(s => s.id === sid);
    if(idx === -1) return;
    
    if(ok) {
        u.saldo += u.solicitudes[idx].monto;
        u.movimientos.push({ desc: 'Préstamo Aprobado', monto: u.solicitudes[idx].monto, fecha: new Date().toLocaleDateString() });
        u.solicitudes[idx].estado = 'aprobado';
        u.solicitudes[idx].saldoPendiente = u.solicitudes[idx].totalPagar; // Inicializar deuda
        mostrarToast('Aprobado', 'success');
    } else {
        u.solicitudes[idx].estado = 'rechazado';
        mostrarToast('Rechazado', 'info');
    }
    await updateDoc(ref, u);
    cargarSolicitudesAdmin();
};

window.cargarTransaccionesGlobales = async () => {
    const t = document.getElementById('tabla-transacciones-body');
    const s = await getDocs(collection(db, "usuarios"));
    let arr = [];
    s.forEach(d => { const u = d.data(); (u.movimientos || []).forEach(m => arr.push({ ...m, user: u.nombres })); });
    t.innerHTML = '';
    arr.slice(-20).reverse().forEach(x => {
        t.innerHTML += `<tr><td>${x.fecha}</td><td>${x.user}</td><td>${x.desc}</td><td>$${Math.abs(x.monto)}</td></tr>`;
    });
};

function mostrarToast(m, t) {
    const c = document.getElementById('toast-container');
    const d = document.createElement('div');
    d.className = 'toast'; d.innerText = m; d.style.borderLeftColor = t === 'error' ? 'red' : 'green';
    c.appendChild(d); setTimeout(() => d.remove(), 3000);
}