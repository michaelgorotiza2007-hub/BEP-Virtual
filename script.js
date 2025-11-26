import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️⚠️⚠️ ¡PEGA TU CONFIGURACIÓN DE FIREBASE AQUÍ! ⚠️⚠️⚠️
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
let clienteCajero = null; // Cliente seleccionado por el cajero
const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// --- INICIO ---
window.onload = async () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElem = document.getElementById('current-date');
    if(dateElem) dateElem.innerText = new Date().toLocaleDateString('es-EC', options);
    
    const savedUser = localStorage.getItem('bep_active_user');
    if(savedUser) await cargarDatosUsuario(savedUser);
    else document.getElementById('intro-screen').querySelector('button').classList.remove('oculto');
};

async function cargarDatosUsuario(username) {
    try {
        const docRef = doc(db, "usuarios", username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            usuario = docSnap.data();
            // Parches para datos antiguos
            if(!usuario.solicitudes) usuario.solicitudes = [];
            if(!usuario.foto) usuario.foto = defaultAvatar;
            
            // Redirigir según rol
            if(document.getElementById('intro-screen').style.display !== 'none') {
               cerrarIntro(); 
            }
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

window.toggleStaffCode = () => {
    const isChecked = document.getElementById('check-is-staff').checked;
    const container = document.getElementById('staff-code-container');
    if(isChecked) container.classList.remove('hidden'); else container.classList.add('hidden');
};

// --- AUTH ---
window.previewImage = () => {
    const file = document.getElementById('reg-foto').files[0];
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => document.getElementById('avatar-preview').src = reader.result;
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
    const isStaff = document.getElementById('check-is-staff').checked;
    const staffCode = document.getElementById('reg-staff-code').value.trim();
    const fotoInput = document.getElementById('reg-foto');

    if(!user || !pass || !nombres || !cedula) return mostrarToast('Faltan datos', 'error');

    // Roles
    let rol = 'cliente';
    if(isStaff) {
        if(staffCode === "BEP2025") rol = 'admin';
        else if(staffCode === "CAJA2025") rol = 'cajero';
        else return mostrarToast('Código de personal incorrecto', 'error');
    }

    let fotoBase64 = defaultAvatar;
    if(fotoInput.files[0]) fotoBase64 = await toBase64(fotoInput.files[0]);

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
        mostrarToast('Cuenta creada', 'success');
        window.toggleAuth('login');
    } catch(e) { mostrarToast('Error al crear usuario', 'error'); }
};

window.iniciarSesion = async () => {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if(!user || !pass) return mostrarToast('Ingrese datos', 'error');

    try {
        const docSnap = await getDoc(doc(db, "usuarios", user));
        if (docSnap.exists() && docSnap.data().password === pass) {
            usuario = docSnap.data();
            localStorage.setItem('bep_active_user', usuario.username);
            entrarSistema();
        } else mostrarToast('Credenciales incorrectas', 'error');
    } catch (e) { mostrarToast('Error de conexión', 'error'); }
};

function entrarSistema() {
    document.getElementById('auth-screen').classList.add('oculto');
    document.getElementById('intro-screen').style.display = 'none';

    if(usuario.rol === 'admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        document.getElementById('admin-name-display').innerText = usuario.nombres;
        cargarUsuariosAdmin();
    } 
    else if(usuario.rol === 'cajero') {
        document.getElementById('cajero-panel').classList.remove('oculto');
        document.getElementById('cajero-name-display').innerText = usuario.nombres;
    }
    else {
        document.getElementById('dashboard').classList.remove('oculto');
        actualizarUI();
    }
}

window.cerrarSesion = () => {
    usuario = null;
    localStorage.removeItem('bep_active_user');
    location.reload();
};

// --- LOGICA CLIENTE ---
function actualizarUI() {
    document.getElementById('nav-user').innerText = usuario.nombres;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto || defaultAvatar;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;
    
    // Movimientos
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().slice(0, 10).forEach(m => {
        const color = m.monto > 0 ? 'text-green' : 'text-red';
        list.innerHTML += `<li><div><strong>${m.desc}</strong><br><small>${m.fecha}</small></div><div class="${color}">$${Math.abs(m.monto).toFixed(2)}</div></li>`;
    });

    // Préstamos
    const pending = (usuario.solicitudes || []).find(s => s.estado === 'pendiente');
    document.getElementById('estado-prestamo').innerText = pending 
        ? `Solicitud de $${pending.monto} en revisión por gerencia.` 
        : 'No tienes solicitudes activas.';
}

// PRÉSTAMO DETALLADO
window.solicitarPrestamo = async () => {
    const monto = parseFloat(document.getElementById('prestamo-monto').value);
    const ingresos = document.getElementById('prestamo-ingresos').value;
    const motivo = document.getElementById('prestamo-motivo').value;
    const plazo = document.getElementById('prestamo-plazo').value;

    if(monto <= 0 || !ingresos || !motivo) return mostrarToast('Complete el formulario', 'error');
    
    if(!usuario.solicitudes) usuario.solicitudes = [];
    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) return mostrarToast('Ya tiene una solicitud en curso', 'error');

    // Calcular Interés
    let interes = plazo == 3 ? 0.05 : (plazo == 6 ? 0.10 : 0.15);
    const total = monto + (monto * interes);

    usuario.solicitudes.push({
        id: Date.now().toString(),
        monto: monto,
        plazo: plazo,
        interes: interes * 100,
        totalPagar: total,
        motivo: motivo,
        ingresos: ingresos,
        estado: 'pendiente',
        fecha: new Date().toLocaleDateString()
    });

    await updateDoc(doc(db, "usuarios", usuario.username), usuario);
    mostrarToast('Solicitud enviada exitosamente', 'success');
    actualizarUI();
};

window.operar = async (tipo) => {
    // ... (Lógica de transferencia cliente a cliente y cheques - IGUAL QUE ANTES) ...
    // Para no extender demasiado, usa la lógica del paso anterior para Transferencias y Cheques aquí.
    if(tipo === 'transferencia') {
        const destino = document.getElementById('tercero-cuenta').value;
        const monto = parseFloat(document.getElementById('tercero-monto').value);
        if(!destino || monto <= 0) return mostrarToast('Datos inválidos', 'error');
        if(monto > usuario.saldo) return mostrarToast('Saldo insuficiente', 'error');

        const q = query(collection(db, "usuarios"), where("cuenta", "==", destino));
        const snap = await getDocs(q);
        if(snap.empty) return mostrarToast('Cuenta no existe', 'error');
        
        const targetDoc = snap.docs[0];
        const targetUser = targetDoc.data();

        usuario.saldo -= monto;
        usuario.movimientos.push({ desc: `Transf. a ${targetUser.nombres}`, monto: -monto, fecha: new Date().toLocaleDateString() });
        
        targetUser.saldo += monto;
        if(!targetUser.movimientos) targetUser.movimientos = [];
        targetUser.movimientos.push({ desc: `Transf. de ${usuario.nombres}`, monto: monto, fecha: new Date().toLocaleDateString() });

        await updateDoc(doc(db, "usuarios", usuario.username), usuario);
        await updateDoc(doc(db, "usuarios", targetDoc.id), targetUser);
        mostrarToast('Transferencia realizada', 'success');
        actualizarUI();
    }
};

window.copiarCuenta = () => { navigator.clipboard.writeText(usuario.cuenta); mostrarToast('Copiado'); };

// --- LOGICA CAJERO ---
window.buscarClienteCajero = async () => {
    const busqueda = document.getElementById('cajero-search-input').value.trim();
    if(!busqueda) return mostrarToast('Ingrese cuenta o cédula', 'error');

    // Buscar por cuenta
    let q = query(collection(db, "usuarios"), where("cuenta", "==", busqueda));
    let snap = await getDocs(q);
    
    // Si no encuentra, buscar por cedula
    if(snap.empty) {
        q = query(collection(db, "usuarios"), where("cedula", "==", busqueda));
        snap = await getDocs(q);
    }

    if(snap.empty) return mostrarToast('Cliente no encontrado', 'error');

    const docCliente = snap.docs[0];
    clienteCajero = { ...docCliente.data(), uid: docCliente.id }; // Guardar ref

    // Mostrar datos
    document.getElementById('cajero-cliente-info').classList.remove('oculto');
    document.getElementById('cajero-client-nombre').innerText = `${clienteCajero.nombres} ${clienteCajero.apellidos}`;
    document.getElementById('cajero-client-cuenta').innerText = clienteCajero.cuenta;
    document.getElementById('cajero-client-saldo').innerText = `$${clienteCajero.saldo.toFixed(2)}`;
    document.getElementById('cajero-client-foto').src = clienteCajero.foto || defaultAvatar;
};

window.ejecutarOperacionCajero = async () => {
    if(!clienteCajero) return;
    const tipo = document.getElementById('cajero-tipo-op').value;
    const monto = parseFloat(document.getElementById('cajero-monto-op').value);

    if(monto <= 0) return mostrarToast('Monto inválido', 'error');

    if(tipo === 'retiro') {
        if(monto > clienteCajero.saldo) return mostrarToast('Saldo insuficiente en la cuenta del cliente', 'error');
        clienteCajero.saldo -= monto;
        clienteCajero.movimientos.push({ desc: 'Retiro en Ventanilla', monto: -monto, fecha: new Date().toLocaleDateString() });
    } else {
        clienteCajero.saldo += monto;
        clienteCajero.movimientos.push({ desc: 'Depósito en Ventanilla', monto: monto, fecha: new Date().toLocaleDateString() });
    }

    await updateDoc(doc(db, "usuarios", clienteCajero.uid), clienteCajero);
    mostrarToast('Transacción exitosa', 'success');
    
    // Actualizar vista
    document.getElementById('cajero-client-saldo').innerText = `$${clienteCajero.saldo.toFixed(2)}`;
    document.getElementById('cajero-monto-op').value = '';
};

// --- LOGICA ADMIN ---
window.cargarUsuariosAdmin = async () => {
    const tbody = document.getElementById('tabla-usuarios-body');
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    const snap = await getDocs(collection(db, "usuarios"));
    tbody.innerHTML = '';
    snap.forEach(d => {
        const u = d.data();
        if(u.rol === 'cliente') {
            tbody.innerHTML += `<tr>
                <td>${u.nombres}</td><td>${u.cedula}</td><td>${u.cuenta}</td><td>$${u.saldo.toFixed(2)}</td>
                <td><button class="btn-red" style="padding:5px" onclick="alert('Función de eliminar')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }
    });
};

window.cargarTransaccionesGlobales = async () => {
    const tbody = document.getElementById('tabla-transacciones-body');
    const snap = await getDocs(collection(db, "usuarios"));
    let transacciones = [];
    snap.forEach(d => {
        const u = d.data();
        if(u.movimientos) u.movimientos.forEach(m => transacciones.push({...m, user: u.nombres}));
    });
    tbody.innerHTML = '';
    transacciones.slice(-20).reverse().forEach(t => {
        tbody.innerHTML += `<tr><td>${t.fecha}</td><td>${t.user}</td><td>${t.desc}</td><td>$${Math.abs(t.monto).toFixed(2)}</td></tr>`;
    });
};

// (Mantener lógica de préstamos admin igual que antes...)

function mostrarToast(m, t) {
    const c = document.getElementById('toast-container');
    const d = document.createElement('div'); d.className = 'toast'; d.innerText = m;
    d.style.borderLeftColor = t==='error'?'red':'green';
    c.appendChild(d); setTimeout(()=>d.remove(),3000);
}