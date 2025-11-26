import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️⚠️⚠️ ¡PEGA TU CONFIGURACIÓN DE FIREBASE AQUÍ! ⚠️⚠️⚠️
const firebaseConfig = {
    apiKey: "AIzaSyD...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let usuario = null;
let chartInstance = null; // Para guardar la referencia del gráfico
let barInstance = null;
const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// --- INICIO ---
window.onload = async () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElem = document.getElementById('current-date');
    if(dateElem) dateElem.innerText = new Date().toLocaleDateString('es-EC', options);
    
    const savedUser = localStorage.getItem('bep_active_user');
    if(savedUser) {
        await cargarDatosUsuario(savedUser);
    }
};

async function cargarDatosUsuario(username) {
    try {
        const docRef = doc(db, "usuarios", username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            usuario = docSnap.data();
            if(!usuario.solicitudes) usuario.solicitudes = [];
            if(!usuario.foto) usuario.foto = defaultAvatar;
            console.log("Sesión recuperada");
        }
    } catch (e) {
        console.error("Error cargando usuario", e);
    }
}

// --- NAVEGACIÓN ---
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    if(usuario) {
        entrarSistema();
    } else {
        document.getElementById('auth-screen').classList.remove('oculto');
    }
};

window.toggleAuth = (tab) => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registro').classList.add('oculto');
    document.getElementById('form-' + tab).classList.remove('oculto');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
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

window.toggleAdminCode = () => {
    const isChecked = document.getElementById('check-is-admin').checked;
    const container = document.getElementById('admin-code-container');
    if(isChecked) container.classList.remove('hidden'); else container.classList.add('hidden');
};

// --- REGISTRO Y LOGIN ---
window.previewImage = () => {
    const file = document.getElementById('reg-foto').files[0];
    const preview = document.getElementById('avatar-preview');
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => { preview.src = reader.result; preview.classList.remove('hidden'); }
        reader.readAsDataURL(file);
    }
};

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

window.registrarUsuario = async () => {
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const nombres = document.getElementById('reg-nombres').value.trim();
    const cedula = document.getElementById('reg-cedula').value.trim();
    const terms = document.getElementById('reg-terms').checked;
    const isAdminCheck = document.getElementById('check-is-admin').checked;
    const adminCode = document.getElementById('reg-admin-code').value.trim();
    const fotoInput = document.getElementById('reg-foto');

    if(!user || !pass || !nombres || !cedula) return mostrarToast('Complete campos', 'error');
    if(!terms) return mostrarToast('Acepte los términos', 'error');

    try {
        const docSnap = await getDoc(doc(db, "usuarios", user));
        if(docSnap.exists()) return mostrarToast('Usuario ya existe', 'error');
    } catch(e) { return mostrarToast('Error de conexión', 'error'); }

    let rol = 'cliente';
    if(isAdminCheck) {
        if(adminCode === "BEP2025") rol = 'admin';
        else return mostrarToast('Código Maestro incorrecto', 'error');
    }

    let fotoBase64 = defaultAvatar;
    if(fotoInput.files[0]) fotoBase64 = await toBase64(fotoInput.files[0]);

    const nuevoUsuario = {
        username: user,
        password: pass,
        nombres: nombres,
        apellidos: document.getElementById('reg-apellidos').value.trim(),
        cedula: cedula,
        telefono: document.getElementById('reg-telefono').value.trim(),
        foto: fotoBase64,
        rol: rol,
        cuenta: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        saldo: 0.00,
        movimientos: [],
        inversiones: [],
        solicitudes: []
    };

    try {
        await setDoc(doc(db, "usuarios", user), nuevoUsuario);
        mostrarToast('Cuenta creada', 'success');
        window.toggleAuth('login');
    } catch (e) {
        console.error(e);
        mostrarToast('Error guardando foto', 'error');
    }
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
                if(!usuario.solicitudes) usuario.solicitudes = [];
                if(!usuario.foto) usuario.foto = defaultAvatar;
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
        document.getElementById('admin-avatar-img').src = usuario.foto;
        cargarDashboardAdmin(); // Carga inicial
    } else {
        document.getElementById('dashboard').classList.remove('oculto');
        actualizarUI();
    }
}

window.cerrarSesion = () => {
    usuario = null;
    localStorage.removeItem('bep_active_user');
    location.reload();
};

// --- CLIENTE LÓGICA ---
async function guardarUsuario() {
    await updateDoc(doc(db, "usuarios", usuario.username), usuario);
    actualizarUI();
}

function actualizarUI() {
    document.getElementById('nav-user').innerText = `${usuario.nombres}`;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto || defaultAvatar;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;
    
    // Movimientos
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().slice(0, 10).forEach(mov => {
        const color = mov.monto > 0 ? 'text-green' : 'text-red';
        list.innerHTML += `<li><div><strong>${mov.desc}</strong><br><small>${mov.fecha}</small></div><div class="${color}">$${Math.abs(mov.monto).toFixed(2)}</div></li>`;
    });

    // Estado Préstamo
    const pending = usuario.solicitudes.find(s => s.estado === 'pendiente');
    const stBox = document.getElementById('estado-prestamo');
    if(pending) {
        stBox.innerText = `Solicitud de $${pending.monto} en revisión.`;
        stBox.style.color = '#f1c40f';
    } else {
        stBox.innerText = 'No hay solicitudes pendientes.';
        stBox.style.color = '#ccc';
    }
    
    // Inversiones
    const invList = document.getElementById('lista-inversiones');
    invList.innerHTML = '';
    usuario.inversiones.forEach(inv => invList.innerHTML += `<div style="padding:5px;border-bottom:1px solid #444;font-size:0.9rem">PF: $${inv.monto} (${inv.meses}M)</div>`);
}

window.operar = async (tipo) => {
    let monto = 0;
    if(tipo === 'deposito-propio') {
        monto = parseFloat(document.getElementById('op-deposito-monto').value);
        if(monto > 0) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: 'Depósito Ventanilla', monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            mostrarToast('Depósito exitoso', 'success');
            document.getElementById('op-deposito-monto').value = '';
        }
    } 
    else if (tipo === 'retiro') {
        monto = parseFloat(document.getElementById('op-retiro-monto').value);
        if(monto > 0 && monto <= usuario.saldo) {
            usuario.saldo -= monto;
            usuario.movimientos.push({ desc: 'Retiro Efectivo', monto: -monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            mostrarToast('Retiro exitoso', 'success');
            document.getElementById('op-retiro-monto').value = '';
        } else mostrarToast('Saldo insuficiente', 'error');
    }
    else if (tipo === 'cobrar-cheque') {
        monto = parseFloat(document.getElementById('cheque-monto').value);
        const benef = document.getElementById('cheque-beneficiario').value;
        if(monto > 0 && benef) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: `Cheque: ${benef}`, monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            mostrarToast('Cheque depositado', 'success');
        }
    }
    else if (tipo === 'transferencia' || tipo === 'deposito-tercero') {
        const destino = document.getElementById('tercero-cuenta').value.trim();
        const montoOp = parseFloat(document.getElementById('tercero-monto').value);
        
        if(!destino || montoOp <= 0) return mostrarToast('Datos inválidos', 'error');
        if(tipo === 'transferencia' && montoOp > usuario.saldo) return mostrarToast('Saldo insuficiente', 'error');
        if(destino === usuario.cuenta) return mostrarToast('Misma cuenta', 'error');

        const q = query(collection(db, "usuarios"), where("cuenta", "==", destino));
        const snapshot = await getDocs(q);

        if(snapshot.empty) return mostrarToast('Cuenta destino no encontrada', 'error');
        const targetDoc = snapshot.docs[0];
        const targetData = targetDoc.data();

        if(tipo === 'transferencia') {
            usuario.saldo -= montoOp;
            usuario.movimientos.push({ desc: `Transf. a ${targetData.nombres}`, monto: -montoOp, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
        }

        const descT = tipo === 'transferencia' ? `Transf. de ${usuario.nombres}` : `Depósito Tercero`;
        targetData.saldo += montoOp;
        if(!targetData.movimientos) targetData.movimientos = [];
        targetData.movimientos.push({ desc: descT, monto: montoOp, fecha: new Date().toLocaleDateString() });

        await updateDoc(doc(db, "usuarios", targetDoc.id), targetData);
        mostrarToast('Operación exitosa', 'success');
    }
};

window.crearPlazoFijo = async () => {
    const monto = parseFloat(document.getElementById('pf-monto').value);
    const meses = document.getElementById('pf-tiempo').value;
    if(monto > 0 && monto <= usuario.saldo) {
        usuario.saldo -= monto;
        usuario.inversiones.push({ monto: monto, meses: meses });
        usuario.movimientos.push({ desc: `Plazo Fijo (${meses}M)`, monto: -monto, fecha: new Date().toLocaleDateString() });
        await guardarUsuario();
        mostrarToast('Inversión creada', 'success');
    }
};

// NUEVA SOLICITUD DE PRÉSTAMO CON INTERÉS
window.solicitarPrestamo = async () => {
    const monto = parseFloat(document.getElementById('prestamo-monto').value);
    const plazoMeses = document.getElementById('prestamo-plazo').value;
    
    if(monto <= 0 || isNaN(monto)) return mostrarToast('Monto inválido', 'error');

    if(!usuario.solicitudes) usuario.solicitudes = [];
    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) return mostrarToast('Ya tienes solicitud pendiente', 'error');

    // Calcular Interés
    let interes = 0;
    if(plazoMeses == 3) interes = 0.05; // 5%
    if(plazoMeses == 6) interes = 0.10; // 10%
    if(plazoMeses == 12) interes = 0.15; // 15%

    const totalPagar = monto + (monto * interes);

    usuario.solicitudes.push({
        id: Date.now().toString(),
        monto: monto,
        plazo: plazoMeses,
        interes: interes * 100, // guardar como porcentaje entero
        totalPagar: totalPagar,
        estado: 'pendiente',
        fecha: new Date().toLocaleDateString()
    });
    
    await guardarUsuario();
    mostrarToast(`Solicitud enviada. Total a pagar: $${totalPagar.toFixed(2)}`, 'success');
    document.getElementById('prestamo-monto').value = '';
};

window.copiarCuenta = () => { navigator.clipboard.writeText(usuario.cuenta); mostrarToast('Copiado'); };


// --- ADMIN AVANZADO ---
window.cargarDashboardAdmin = async () => {
    const snapshot = await getDocs(collection(db, "usuarios"));
    let totalCapital = 0;
    let totalPrestamos = 0;
    let usuariosConSaldo = 0;
    let usuariosSinSaldo = 0;

    snapshot.forEach(doc => {
        const u = doc.data();
        if(u.rol !== 'admin') {
            totalCapital += u.saldo;
            // Contar préstamos aprobados si tuvieramos un array de préstamos activos
            // Por simplicidad, sumamos el saldo actual como "capital"
            if(u.saldo > 0) usuariosConSaldo++; else usuariosSinSaldo++;
        }
    });

    document.getElementById('total-capital').innerText = `$${totalCapital.toFixed(2)}`;
    document.getElementById('total-prestamos').innerText = "Activo"; 
    
    const estadoReserva = totalCapital > 5000 ? "Saludable" : "Baja";
    const estadoElem = document.getElementById('estado-reserva');
    estadoElem.innerText = estadoReserva;
    estadoElem.style.color = totalCapital > 5000 ? '#2ecc71' : '#e74c3c';

    renderCharts(usuariosConSaldo, usuariosSinSaldo, totalCapital);
};

function renderCharts(conSaldo, sinSaldo, capital) {
    const ctx1 = document.getElementById('graficoPastel').getContext('2d');
    const ctx2 = document.getElementById('graficoBarras').getContext('2d');

    if(chartInstance) chartInstance.destroy();
    if(barInstance) barInstance.destroy();

    chartInstance = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Con Saldo', 'Sin Saldo'],
            datasets: [{
                data: [conSaldo, sinSaldo],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderWidth: 0
            }]
        }
    });

    barInstance = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Capital Total', 'Reserva Objetivo'],
            datasets: [{
                label: 'USD',
                data: [capital, 10000],
                backgroundColor: ['#e6b333', '#3498db']
            }]
        },
        options: { scales: { y: { beginAtZero: true } } }
    });
}

window.cargarTransaccionesGlobales = async () => {
    const tbody = document.getElementById('tabla-transacciones-body');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    
    const snapshot = await getDocs(collection(db, "usuarios"));
    let transacciones = [];

    snapshot.forEach(doc => {
        const u = doc.data();
        if(u.movimientos) {
            u.movimientos.forEach(m => {
                transacciones.push({ ...m, usuario: u.username });
            });
        }
    });

    // Ordenar por fecha (esto es aproximado ya que la fecha es string, idealmente usar timestamp)
    // Para simplificar, mostramos las ultimas 20 tal cual vienen
    transacciones = transacciones.slice(-20).reverse();
    
    tbody.innerHTML = '';
    transacciones.forEach(t => {
        tbody.innerHTML += `<tr>
            <td>${t.fecha}</td>
            <td>${t.usuario}</td>
            <td>${t.desc}</td>
            <td style="color:${t.monto>0?'lightgreen':'red'}">$${Math.abs(t.monto).toFixed(2)}</td>
        </tr>`;
    });
};

// ... Resto de funciones admin (cargarUsuariosAdmin, eliminarUsuario, cargarSolicitudesAdmin, gestionarPrestamo) ...
// (Pega aquí las funciones cargarUsuariosAdmin y eliminarUsuario del código anterior, no cambian)

window.cargarUsuariosAdmin = async () => {
    const tbody = document.getElementById('tabla-usuarios-body');
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    const snap = await getDocs(collection(db, "usuarios"));
    tbody.innerHTML = '';
    snap.forEach(d => {
        const u = d.data();
        if(u.rol !== 'admin') {
            tbody.innerHTML += `<tr>
                <td><img src="${u.foto||defaultAvatar}" class="avatar-table"></td>
                <td>${u.nombres}<br><small>${u.username}</small></td>
                <td>${u.cedula}</td>
                <td>${u.cuenta}</td>
                <td>$${u.saldo.toFixed(2)}</td>
                <td><button onclick="eliminarUsuario('${u.username}')" class="btn-red"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }
    });
};

window.eliminarUsuario = async (u) => {
    if(confirm('¿Eliminar usuario?')) {
        await deleteDoc(doc(db, "usuarios", u));
        cargarUsuariosAdmin();
    }
};

window.cargarSolicitudesAdmin = async () => {
    const container = document.getElementById('lista-solicitudes-prestamo');
    container.innerHTML = 'Cargando...';
    const snap = await getDocs(collection(db, "usuarios"));
    container.innerHTML = '';
    
    snap.forEach(d => {
        const u = d.data();
        if(u.solicitudes) {
            u.solicitudes.forEach(s => {
                if(s.estado === 'pendiente') {
                    container.innerHTML += `<div class="request-card">
                        <h4>${u.nombres}</h4>
                        <p>Monto: $${s.monto} <br> Plazo: ${s.plazo} meses (${s.interes}%) <br> Total a Pagar: <strong>$${s.totalPagar.toFixed(2)}</strong></p>
                        <div style="margin-top:10px; display:flex; gap:10px">
                            <button onclick="gestionarPrestamo('${d.id}', '${s.id}', true)" class="btn-green" style="flex:1">Aprobar</button>
                            <button onclick="gestionarPrestamo('${d.id}', '${s.id}', false)" class="btn-red" style="flex:1">Rechazar</button>
                        </div>
                    </div>`;
                }
            });
        }
    });
};

window.gestionarPrestamo = async (userId, solId, aprobado) => {
    const ref = doc(db, "usuarios", userId);
    const snap = await getDoc(ref);
    const u = snap.data();
    const idx = u.solicitudes.findIndex(s => s.id === solId);
    if(idx === -1) return;

    if(aprobado) {
        u.saldo += u.solicitudes[idx].monto;
        u.movimientos.push({desc: 'Préstamo Aprobado', monto: u.solicitudes[idx].monto, fecha: new Date().toLocaleDateString()});
        u.solicitudes[idx].estado = 'aprobado';
        mostrarToast('Aprobado', 'success');
    } else {
        u.solicitudes[idx].estado = 'rechazado';
        mostrarToast('Rechazado', 'info');
    }
    await updateDoc(ref, u);
    cargarSolicitudesAdmin();
};

function mostrarToast(m, t) {
    const c = document.getElementById('toast-container');
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerText = m;
    d.style.borderLeftColor = t==='error'?'red':'green';
    c.appendChild(d);
    setTimeout(()=>d.remove(), 3000);
}