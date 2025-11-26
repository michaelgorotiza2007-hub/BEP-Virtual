// =========================================================
// 1. IMPORTACIONES DE FIREBASE (NO TOCAR)
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, 
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =========================================================
// 2. CONFIGURACIÓN (¡PEGA TUS DATOS REALES AQUÍ ABAJO!)
// =========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBpI16R6BI6gorLoW-I62RA09PJSUvuIY0",
  authDomain: "bancopeninsular.firebaseapp.com",
  projectId: "bancopeninsular",
  storageBucket: "bancopeninsular.firebasestorage.app",
  messagingSenderId: "218848309222",
  appId: "1:218848309222:web:603faf9cedb2c99caf7027"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado Global
let usuario = null;

// =========================================================
// 3. INICIO Y PERSISTENCIA DE SESIÓN
// =========================================================
window.onload = async () => {
    // Fecha
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElem = document.getElementById('current-date');
    if(dateElem) dateElem.innerText = new Date().toLocaleDateString('es-EC', options);
    
    // Auto-login (Recuperar sesión si existe)
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
            console.log("Sesión restaurada:", usuario.nombres);
        }
    } catch (e) {
        console.error("Error recuperando sesión", e);
    }
}

// =========================================================
// 4. NAVEGACIÓN Y PANTALLAS (FIX PANTALLA NEGRA)
// =========================================================

window.cerrarIntro = () => {
    // 1. Ocultar Intro
    document.getElementById('intro-screen').style.display = 'none';
    
    // 2. Decidir a dónde ir
    if (usuario) {
        // Si ya hay sesión cargada, ir directo adentro
        entrarSistema();
    } else {
        // Si no, mostrar Login (Corrección del error anterior)
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
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
};

window.mostrarPanelAdmin = (id) => {
    document.querySelectorAll('.view-admin').forEach(v => v.classList.add('oculto'));
    document.getElementById('admin-' + id).classList.remove('oculto');
    document.querySelectorAll('.admin-sidebar .nav-links li').forEach(l => l.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');

    if(id === 'usuarios') cargarUsuariosAdmin();
    if(id === 'prestamos') cargarSolicitudesAdmin();
};

window.toggleAdminCode = () => {
    const isChecked = document.getElementById('check-is-admin').checked;
    const container = document.getElementById('admin-code-container');
    if(isChecked) container.classList.remove('hidden');
    else container.classList.add('hidden');
};

// =========================================================
// 5. REGISTRO COMPLETO
// =========================================================

window.previewImage = () => {
    const file = document.getElementById('reg-foto').files[0];
    const preview = document.getElementById('avatar-preview');
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            preview.src = reader.result;
            preview.classList.remove('hidden');
        }
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
    // Obtener valores
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const nombres = document.getElementById('reg-nombres').value.trim();
    const apellidos = document.getElementById('reg-apellidos').value.trim();
    const cedula = document.getElementById('reg-cedula').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const terms = document.getElementById('reg-terms').checked;
    const isAdminCheck = document.getElementById('check-is-admin').checked;
    const adminCode = document.getElementById('reg-admin-code').value.trim();
    const fotoInput = document.getElementById('reg-foto');

    // Validaciones
    if(!user || !pass || !nombres || !cedula) return mostrarToast('Faltan campos obligatorios', 'error');
    if(!terms) return mostrarToast('Debe aceptar los términos', 'error');

    // Verificar duplicados
    try {
        const docSnap = await getDoc(doc(db, "usuarios", user));
        if(docSnap.exists()) return mostrarToast('El usuario ya existe', 'error');
    } catch(e) {
        return mostrarToast('Error de conexión. Verifique sus claves.', 'error');
    }

    // Rol Admin
    let rol = 'cliente';
    if(isAdminCheck) {
        if(adminCode === "BEP2025") { // CLAVE MAESTRA
            rol = 'admin';
        } else {
            return mostrarToast('Código administrativo incorrecto', 'error');
        }
    }

    // Foto
    let fotoBase64 = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    if(fotoInput.files[0]) {
        fotoBase64 = await toBase64(fotoInput.files[0]);
    }

    // Crear Objeto
    const nuevoUsuario = {
        username: user,
        password: pass,
        nombres: nombres,
        apellidos: apellidos,
        cedula: cedula,
        telefono: telefono,
        foto: fotoBase64,
        rol: rol,
        cuenta: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        saldo: 0.00,
        movimientos: [],
        inversiones: [],
        solicitudes: []
    };

    // Guardar
    try {
        await setDoc(doc(db, "usuarios", user), nuevoUsuario);
        mostrarToast('Cuenta creada exitosamente', 'success');
        window.toggleAuth('login');
    } catch (e) {
        console.error(e);
        mostrarToast('Error al guardar datos', 'error');
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
                localStorage.setItem('bep_active_user', usuario.username);
                entrarSistema();
            } else {
                mostrarToast('Contraseña incorrecta', 'error');
            }
        } else {
            mostrarToast('Usuario no encontrado', 'error');
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Error de conexión', 'error');
    }
};

function entrarSistema() {
    document.getElementById('auth-screen').classList.add('oculto');
    document.getElementById('intro-screen').style.display = 'none';

    if(usuario.rol === 'admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        document.getElementById('admin-name-display').innerText = usuario.nombres;
        document.getElementById('admin-avatar-img').src = usuario.foto;
        cargarUsuariosAdmin();
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

// =========================================================
// 6. LÓGICA DEL CLIENTE (ACTUALIZADA)
// =========================================================

async function guardarUsuario() {
    await updateDoc(doc(db, "usuarios", usuario.username), usuario);
    actualizarUI();
}

function actualizarUI() {
    document.getElementById('nav-user').innerText = `${usuario.nombres} ${usuario.apellidos}`;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;

    // Historial
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    const movs = [...usuario.movimientos].reverse().slice(0, 10);
    
    if(movs.length === 0) list.innerHTML = '<li style="justify-content:center; color:#ccc">Sin movimientos</li>';

    movs.forEach(mov => {
        const color = mov.monto > 0 ? 'text-green' : 'text-red';
        const symbol = mov.monto > 0 ? '+' : '';
        list.innerHTML += `<li>
            <div><strong>${mov.desc}</strong><br><small style="color:#aaa">${mov.fecha}</small></div>
            <div class="${color}">${symbol}$${Math.abs(mov.monto).toFixed(2)}</div>
        </li>`;
    });

    // Préstamos Pendientes
    const pending = usuario.solicitudes.find(s => s.estado === 'pendiente');
    const statusBox = document.getElementById('estado-prestamo');
    if(pending) {
        statusBox.innerText = `Solicitud de $${pending.monto} en revisión.`;
        statusBox.style.color = '#f1c40f';
    } else {
        statusBox.innerText = 'No hay solicitudes pendientes.';
        statusBox.style.color = '#ccc';
    }
    
    // Inversiones
    const invList = document.getElementById('lista-inversiones');
    invList.innerHTML = '';
    usuario.inversiones.forEach(inv => {
        invList.innerHTML += `<div style="padding:8px; border-bottom:1px solid #444; font-size:0.9rem; color:#fff">
            <i class="fas fa-piggy-bank text-gold"></i> PF: $${inv.monto} (${inv.meses} Meses)
        </div>`;
    });
}

// OPERACIONES
window.operar = async (tipo) => {
    let monto = 0;

    // 1. DEPÓSITO PROPIO
    if(tipo === 'deposito-propio') {
        monto = parseFloat(document.getElementById('op-deposito-monto').value);
        if(monto > 0) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: 'Depósito Ventanilla', monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            mostrarToast('Depósito exitoso', 'success');
            document.getElementById('op-deposito-monto').value = '';
        } else mostrarToast('Monto inválido', 'error');
    } 
    // 2. RETIRO
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
    // 3. CHEQUE
    else if (tipo === 'cobrar-cheque') {
        monto = parseFloat(document.getElementById('cheque-monto').value);
        const benef = document.getElementById('cheque-beneficiario').value;
        if(monto > 0 && benef) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: `Cheque: ${benef}`, monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            mostrarToast('Cheque depositado', 'success');
            document.getElementById('cheque-monto').value = '';
        } else mostrarToast('Datos incompletos', 'error');
    }
    // 4. TERCEROS
    else if (tipo === 'transferencia' || tipo === 'deposito-tercero') {
        const destino = document.getElementById('tercero-cuenta').value.trim();
        const montoOp = parseFloat(document.getElementById('tercero-monto').value);
        
        if(!destino || montoOp <= 0) return mostrarToast('Datos inválidos', 'error');
        if(tipo === 'transferencia' && montoOp > usuario.saldo) return mostrarToast('Saldo insuficiente', 'error');
        if(destino === usuario.cuenta) return mostrarToast('No puedes transferirte a ti mismo', 'error');

        // Buscar cuenta
        const q = query(collection(db, "usuarios"), where("cuenta", "==", destino));
        const snapshot = await getDocs(q);

        if(snapshot.empty) return mostrarToast('Cuenta destino no encontrada', 'error');

        const targetDoc = snapshot.docs[0];
        const targetData = targetDoc.data();

        // Descontar al usuario actual
        if(tipo === 'transferencia') {
            usuario.saldo -= montoOp;
            usuario.movimientos.push({ desc: `Transf. a ${targetData.nombres}`, monto: -montoOp, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
        }

        // Acreditar al destino
        const descT = tipo === 'transferencia' ? `Transf. de ${usuario.nombres}` : `Depósito Tercero (Ventanilla)`;
        targetData.saldo += montoOp;
        targetData.movimientos.push({ desc: descT, monto: montoOp, fecha: new Date().toLocaleDateString() });

        await updateDoc(doc(db, "usuarios", targetDoc.id), targetData);
        mostrarToast('Operación a terceros exitosa', 'success');
        
        document.getElementById('tercero-cuenta').value = '';
        document.getElementById('tercero-monto').value = '';
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
    } else {
        mostrarToast('Saldo insuficiente', 'error');
    }
};

window.solicitarPrestamo = async () => {
    const monto = parseFloat(document.getElementById('prestamo-monto').value);
    if(monto <= 0 || isNaN(monto)) return mostrarToast('Monto inválido', 'error');

    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) return mostrarToast('Ya tienes una solicitud pendiente', 'error');

    usuario.solicitudes.push({
        id: Date.now().toString(),
        monto: monto,
        estado: 'pendiente',
        fecha: new Date().toLocaleDateString()
    });
    
    await guardarUsuario();
    mostrarToast('Solicitud enviada al Administrador', 'success');
    document.getElementById('prestamo-monto').value = '';
};

window.copiarCuenta = () => {
    navigator.clipboard.writeText(usuario.cuenta);
    mostrarToast('Número copiado');
};

// =========================================================
// 7. LÓGICA DEL ADMINISTRADOR
// =========================================================

window.cargarUsuariosAdmin = async () => {
    const tbody = document.getElementById('tabla-usuarios-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Cargando...</td></tr>';
    
    const snapshot = await getDocs(collection(db, "usuarios"));
    tbody.innerHTML = '';
    
    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        if(u.rol !== 'admin') {
            tbody.innerHTML += `
                <tr>
                    <td><img src="${u.foto}" class="avatar-table"></td>
                    <td><strong>${u.nombres} ${u.apellidos}</strong><br><small style="color:#aaa">${u.username}</small></td>
                    <td>${u.cedula}</td>
                    <td>${u.cuenta}</td>
                    <td style="color:${u.saldo>=0?'#2ecc71':'#e74c3c'}">$${u.saldo.toFixed(2)}</td>
                </tr>
            `;
        }
    });
};

window.cargarSolicitudesAdmin = async () => {
    const container = document.getElementById('lista-solicitudes-prestamo');
    container.innerHTML = '<p style="text-align:center">Cargando...</p>';
    
    const snapshot = await getDocs(collection(db, "usuarios"));
    container.innerHTML = '';
    let found = false;

    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        if(u.solicitudes && u.solicitudes.length > 0) {
            u.solicitudes.forEach(sol => {
                if(sol.estado === 'pendiente') {
                    found = true;
                    container.innerHTML += `
                    <div class="request-card">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <img src="${u.foto}" class="avatar-table">
                            <div>
                                <h4>${u.nombres} ${u.apellidos}</h4>
                                <small>CI: ${u.cedula}</small>
                            </div>
                        </div>
                        <p>Solicita: <strong class="text-gold" style="font-size:1.4rem">$${sol.monto}</strong></p>
                        <p class="small-text">Saldo Actual: $${u.saldo.toFixed(2)}</p>
                        <div style="display:flex; gap:10px; margin-top:15px;">
                            <button onclick="gestionarPrestamo('${docSnap.id}', '${sol.id}', true)" class="btn-green" style="flex:1">Aprobar</button>
                            <button onclick="gestionarPrestamo('${docSnap.id}', '${sol.id}', false)" class="btn-red" style="flex:1">Rechazar</button>
                        </div>
                    </div>`;
                }
            });
        }
    });

    if(!found) container.innerHTML = '<p style="text-align:center; color:#ccc">No hay solicitudes pendientes.</p>';
};

window.gestionarPrestamo = async (userId, solId, aprobado) => {
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await getDoc(userRef);
    const targetUser = userSnap.data();

    const index = targetUser.solicitudes.findIndex(s => s.id === solId);
    if(index === -1) return;

    if(aprobado) {
        const monto = targetUser.solicitudes[index].monto;
        targetUser.solicitudes[index].estado = 'aprobado';
        targetUser.saldo += monto;
        targetUser.movimientos.push({ desc: 'Préstamo Aprobado (Gerencia)', monto: monto, fecha: new Date().toLocaleDateString() });
        mostrarToast('Préstamo Aprobado', 'success');
    } else {
        targetUser.solicitudes[index].estado = 'rechazado';
        mostrarToast('Préstamo Rechazado', 'info');
    }

    await updateDoc(userRef, targetUser);
    cargarSolicitudesAdmin();
};

function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let color = '#3b82f6';
    if(tipo === 'success') color = '#10b981';
    if(tipo === 'error') color = '#ef4444';
    
    toast.style.borderLeftColor = color;
    toast.innerHTML = `<i class="fas fa-info-circle" style="color:${color}; margin-right:8px"></i> ${mensaje}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}