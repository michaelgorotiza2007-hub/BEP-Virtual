// =========================================================
// 1. IMPORTACIONES DE FIREBASE
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, 
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =========================================================
// 2. CONFIGURACIÓN (¡PEGA TUS DATOS REALES AQUÍ!)
// =========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBpI16R6BI6gorLoW-I62RA09PJSUvuIY0",
    authDomain: "bancopeninsular.firebaseapp.com",
    projectId: "bancopeninsular",
    storageBucket: "bancopeninsular.firebasestorage.app",
    messagingSenderId: "218848309222",
    appId: "1:218848309222:web:603faf9cedb2c99caf7027"
};

// Inicializar
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado Global
let usuario = null;

// =========================================================
// 3. INICIO Y PERSISTENCIA DE SESIÓN
// =========================================================
window.onload = async () => {
    // Poner fecha actual
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElement = document.getElementById('current-date');
    if(dateElement) dateElement.innerText = new Date().toLocaleDateString('es-EC', options);
    
    // Verificar si hay sesión guardada en este navegador
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
            console.log("Sesión restaurada para:", usuario.nombres);
        }
    } catch (e) {
        console.error("Error recuperando sesión:", e);
    }
}

// =========================================================
// 4. NAVEGACIÓN Y PANTALLAS (CORREGIDO)
// =========================================================

// CORRECCIÓN IMPORTANTE: Ahora verifica si mostrar Login o Dashboard directo
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    
    if (usuario) {
        // Si ya cargó el usuario del localStorage, entra directo
        entrarSistema();
    } else {
        // Si no hay usuario, muestra el Login
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
// 5. REGISTRO Y GESTIÓN DE FOTOS
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

    // Verificar si usuario ya existe en la Nube
    try {
        const docSnap = await getDoc(doc(db, "usuarios", user));
        if(docSnap.exists()) return mostrarToast('El nombre de usuario ya existe', 'error');
    } catch (e) {
        return mostrarToast('Error de conexión. Revise sus credenciales.', 'error');
    }

    // Validar Rol Administrativo
    let rol = 'cliente';
    if(isAdminCheck) {
        if(adminCode === "BEP2025") { // CONTRASEÑA MAESTRA
            rol = 'admin';
        } else {
            return mostrarToast('Código administrativo incorrecto', 'error');
        }
    }

    // Procesar Foto (o poner una por defecto)
    let fotoBase64 = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    if(fotoInput.files[0]) {
        fotoBase64 = await toBase64(fotoInput.files[0]);
    }

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

    try {
        await setDoc(doc(db, "usuarios", user), nuevoUsuario);
        mostrarToast('¡Cuenta creada! Por favor inicie sesión.', 'success');
        window.toggleAuth('login');
    } catch (e) {
        console.error(e);
        mostrarToast('Error al guardar datos', 'error');
    }
};

window.iniciarSesion = async () => {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    if(!user || !pass) return mostrarToast('Ingrese usuario y contraseña', 'error');

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
        // MODO ADMINISTRADOR
        document.getElementById('admin-panel').classList.remove('oculto');
        document.getElementById('admin-name-display').innerText = usuario.nombres;
        document.getElementById('admin-avatar-img').src = usuario.foto;
        cargarUsuariosAdmin();
    } else {
        // MODO CLIENTE
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
// 6. LÓGICA DEL CLIENTE
// =========================================================

async function guardarUsuario() {
    // Sincronizar cambios locales con la nube
    await updateDoc(doc(db, "usuarios", usuario.username), usuario);
    actualizarUI();
}

function actualizarUI() {
    // Actualizar Header y Sidebar
    document.getElementById('nav-user').innerText = `${usuario.nombres} ${usuario.apellidos}`;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;

    // Historial (Últimos 10)
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    const movs = [...usuario.movimientos].reverse().slice(0, 10);
    
    if(movs.length === 0) {
        list.innerHTML = '<li style="justify-content:center; color:#ccc">Sin movimientos aún</li>';
    }

    movs.forEach(mov => {
        const color = mov.monto > 0 ? 'text-green' : 'text-red';
        const symbol = mov.monto > 0 ? '+' : '';
        list.innerHTML += `<li>
            <div><strong>${mov.desc}</strong><br><small style="color:#aaa">${mov.fecha}</small></div>
            <div class="${color}">${symbol}$${Math.abs(mov.monto).toFixed(2)}</div>
        </li>`;
    });

    // Estado de Solicitudes
    const pending = usuario.solicitudes.find(s => s.estado === 'pendiente');
    const estadoElem = document.getElementById('estado-prestamo');
    if(pending) {
        estadoElem.innerText = `Solicitud de $${pending.monto} enviada. Esperando aprobación.`;
        estadoElem.style.color = '#f1c40f'; // Amarillo
    } else {
        estadoElem.innerText = 'No tienes solicitudes pendientes.';
        estadoElem.style.color = '#ccc';
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

// OPERACIONES BANCARIAS
window.operar = async (tipo) => {
    let monto = 0;

    // 1. DEPÓSITO PROPIO
    if(tipo === 'deposito-propio') {
        monto = parseFloat(document.getElementById('op-deposito-monto').value);
        if(monto > 0) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: 'Depósito en Ventanilla', monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            mostrarToast('Depósito realizado exitosamente', 'success');
            document.getElementById('op-deposito-monto').value = '';
        } else {
            mostrarToast('Monto inválido', 'error');
        }
    } 
    // 2. RETIRO
    else if (tipo === 'retiro') {
        monto = parseFloat(document.getElementById('op-retiro-monto').value);
        if(monto > 0 && monto <= usuario.saldo) {
            usuario.saldo -= monto;
            usuario.movimientos.push({ desc: 'Retiro de Efectivo', monto: -monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            mostrarToast('Retiro realizado exitosamente', 'success');
            document.getElementById('op-retiro-monto').value = '';
        } else {
            mostrarToast('Saldo insuficiente o monto inválido', 'error');
        }
    }
    // 3. COBRO DE CHEQUE
    else if (tipo === 'cobrar-cheque') {
        monto = parseFloat(document.getElementById('cheque-monto').value);
        const benef = document.getElementById('cheque-beneficiario').value;
        if(monto > 0 && benef) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: `Cheque Cobrado: ${benef}`, monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            mostrarToast('Cheque depositado correctamente', 'success');
            document.getElementById('cheque-monto').value = '';
        } else {
            mostrarToast('Complete los datos del cheque', 'error');
        }
    }
    // 4. OPERACIONES A TERCEROS
    else if (tipo === 'transferencia' || tipo === 'deposito-tercero') {
        const destino = document.getElementById('tercero-cuenta').value.trim();
        const montoOp = parseFloat(document.getElementById('tercero-monto').value);
        
        if(!destino || montoOp <= 0) return mostrarToast('Datos inválidos', 'error');
        if(tipo === 'transferencia' && montoOp > usuario.saldo) return mostrarToast('Saldo insuficiente', 'error');
        if(destino === usuario.cuenta) return mostrarToast('No puedes transferirte a ti mismo', 'error');

        // Buscar cuenta destino en Firebase
        const q = query(collection(db, "usuarios"), where("cuenta", "==", destino));
        const snapshot = await getDocs(q);

        if(snapshot.empty) return mostrarToast('La cuenta destino no existe', 'error');

        const targetDoc = snapshot.docs[0];
        const targetData = targetDoc.data();

        // Si es transferencia, descontamos primero
        if(tipo === 'transferencia') {
            usuario.saldo -= montoOp;
            usuario.movimientos.push({ desc: `Transf. a ${targetData.nombres}`, monto: -montoOp, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
        }

        // Acreditar al tercero
        const descT = tipo === 'transferencia' ? `Transf. de ${usuario.nombres}` : `Depósito Tercero (Ventanilla)`;
        targetData.saldo += montoOp;
        targetData.movimientos.push({ desc: descT, monto: montoOp, fecha: new Date().toLocaleDateString() });

        // Guardar cambios en la cuenta del tercero
        await updateDoc(doc(db, "usuarios", targetDoc.id), targetData);
        mostrarToast('Operación a terceros exitosa', 'success');
        
        // Limpiar
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
        mostrarToast('Inversión creada correctamente', 'success');
    } else {
        mostrarToast('Saldo insuficiente', 'error');
    }
};

window.solicitarPrestamo = async () => {
    const monto = parseFloat(document.getElementById('prestamo-monto').value);
    if(monto <= 0 || isNaN(monto)) return mostrarToast('Ingrese un monto válido', 'error');

    // Verificar si ya tiene uno pendiente
    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) {
        return mostrarToast('Ya tienes una solicitud pendiente de revisión', 'error');
    }

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
    mostrarToast('Número de cuenta copiado');
};

// =========================================================
// 7. LÓGICA DEL ADMINISTRADOR
// =========================================================

window.cargarUsuariosAdmin = async () => {
    const tbody = document.getElementById('tabla-usuarios-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Cargando datos...</td></tr>';
    
    const snapshot = await getDocs(collection(db, "usuarios"));
    tbody.innerHTML = '';
    
    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        if(u.rol !== 'admin') { // No mostrar otros admins
            tbody.innerHTML += `
                <tr>
                    <td><img src="${u.foto}" class="avatar-table"></td>
                    <td>
                        <strong>${u.nombres} ${u.apellidos}</strong><br>
                        <small style="color:#aaa">${u.username}</small>
                    </td>
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
    container.innerHTML = '<p style="text-align:center">Buscando solicitudes...</p>';
    
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
                                <small>Cédula: ${u.cedula} | Cuenta: ${u.cuenta}</small>
                            </div>
                        </div>
                        <p>Solicita: <strong class="text-gold" style="font-size:1.4rem">$${sol.monto}</strong></p>
                        <p class="small-text">Saldo Actual del Cliente: $${u.saldo.toFixed(2)}</p>
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

    // Encontrar la solicitud específica
    const index = targetUser.solicitudes.findIndex(s => s.id === solId);
    if(index === -1) return;

    if(aprobado) {
        const monto = targetUser.solicitudes[index].monto;
        targetUser.solicitudes[index].estado = 'aprobado';
        targetUser.saldo += monto;
        targetUser.movimientos.push({ desc: 'Préstamo Aprobado por Gerencia', monto: monto, fecha: new Date().toLocaleDateString() });
        mostrarToast(`Préstamo aprobado para ${targetUser.nombres}`, 'success');
    } else {
        targetUser.solicitudes[index].estado = 'rechazado';
        mostrarToast('Solicitud rechazada', 'info');
    }

    // Guardar cambios en la BD del usuario objetivo
    await updateDoc(userRef, targetUser);
    
    // Recargar la lista para que desaparezca la tarjeta
    cargarSolicitudesAdmin();
};

// =========================================================
// 8. NOTIFICACIONES (TOAST)
// =========================================================
function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let color = '#3b82f6'; // Azul default
    if(tipo === 'success') color = '#10b981';
    if(tipo === 'error') color = '#ef4444';
    
    toast.style.borderLeftColor = color;
    toast.innerHTML = `<i class="fas fa-info-circle" style="color:${color}; margin-right:8px"></i> ${mensaje}`;
    
    container.appendChild(toast);
    
    // Auto eliminar
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}