// IMPORTAR FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PEGA TUS CREDENCIALES AQUÍ ---
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

let usuario = null; // Usuario actual

// --- INICIO ---
window.onload = async () => {
    // Fecha
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('es-EC', options);
    
    // Auto-login
    const savedUser = localStorage.getItem('bep_active_user');
    if(savedUser) {
        await cargarDatosUsuario(savedUser);
    }
};

async function cargarDatosUsuario(username) {
    const docRef = doc(db, "usuarios", username);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        usuario = docSnap.data();
        entrarSistema();
    }
}

// --- UTILIDADES ---
window.toggleAuth = (tab) => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registro').classList.add('oculto');
    document.getElementById('form-' + tab).classList.remove('oculto');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
};

window.cerrarIntro = () => document.getElementById('intro-screen').style.display = 'none';

window.mostrarPanel = (id) => {
    document.querySelectorAll('#dashboard .view').forEach(v => v.classList.add('oculto'));
    document.getElementById('panel-' + id).classList.remove('oculto');
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
};

// Panel Admin Navegación
window.mostrarPanelAdmin = (id) => {
    document.querySelectorAll('.view-admin').forEach(v => v.classList.add('oculto'));
    document.getElementById('admin-' + id).classList.remove('oculto');
    document.querySelectorAll('.admin-sidebar .nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');

    if(id === 'usuarios') cargarUsuariosAdmin();
    if(id === 'prestamos') cargarSolicitudesAdmin();
};

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

// --- REGISTRO Y LOGIN ---
window.registrarUsuario = async () => {
    const user = document.getElementById('reg-user').value;
    const pass = document.getElementById('reg-pass').value;
    const nombres = document.getElementById('reg-nombres').value;
    const apellidos = document.getElementById('reg-apellidos').value;
    const cedula = document.getElementById('reg-cedula').value;
    const telefono = document.getElementById('reg-telefono').value;
    const terms = document.getElementById('reg-terms').checked;
    const fotoInput = document.getElementById('reg-foto');

    if(!user || !pass || !nombres || !cedula || !terms) return alert("Por favor complete todos los campos obligatorios y acepte los términos.");

    // Verificar existencia
    const docSnap = await getDoc(doc(db, "usuarios", user));
    if(docSnap.exists()) return alert("El nombre de usuario ya existe.");

    // Foto a Base64
    let fotoBase64 = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; // Default avatar
    if(fotoInput.files[0]) {
        fotoBase64 = await toBase64(fotoInput.files[0]);
    }

    // Rol (Si el usuario es "admin", se vuelve admin, sino cliente)
    const rol = (user === 'admin') ? 'admin' : 'cliente';

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
        solicitudes: [] // array para préstamos
    };

    try {
        await setDoc(doc(db, "usuarios", user), nuevoUsuario);
        alert("Cuenta creada exitosamente. Inicie sesión.");
        window.toggleAuth('login');
    } catch (e) {
        console.error(e);
        alert("Error al crear cuenta.");
    }
};

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

window.iniciarSesion = async () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    const docRef = doc(db, "usuarios", user);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        if(data.password === pass) {
            usuario = data;
            localStorage.setItem('bep_active_user', usuario.username);
            entrarSistema();
        } else {
            alert("Contraseña incorrecta");
        }
    } else {
        alert("Usuario no encontrado");
    }
};

function entrarSistema() {
    document.getElementById('auth-screen').classList.add('oculto');
    document.getElementById('intro-screen').style.display = 'none';

    if(usuario.rol === 'admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        cargarUsuariosAdmin(); // Carga inicial
    } else {
        document.getElementById('dashboard').classList.remove('oculto');
        actualizarUI();
    }
}

window.cerrarSesion = () => {
    localStorage.removeItem('bep_active_user');
    location.reload();
};

// --- LÓGICA CLIENTE ---

async function guardarUsuario() {
    await updateDoc(doc(db, "usuarios", usuario.username), usuario);
    actualizarUI();
}

function actualizarUI() {
    document.getElementById('nav-user').innerText = `${usuario.nombres}`;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;

    // Movimientos
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().slice(0, 10).forEach(mov => {
        const color = mov.monto > 0 ? 'text-green' : 'text-red';
        list.innerHTML += `<li>
            <div><strong>${mov.desc}</strong><br><small style="color:#aaa">${mov.fecha}</small></div>
            <div class="${color}">$${Math.abs(mov.monto).toFixed(2)}</div>
        </li>`;
    });

    // Estado prestamo
    const pending = usuario.solicitudes.find(s => s.estado === 'pendiente');
    document.getElementById('estado-prestamo').innerText = pending 
        ? `Solicitud de $${pending.monto} en revisión.` 
        : 'Sin solicitudes pendientes.';
    
    // Inversiones
    const invList = document.getElementById('lista-inversiones');
    invList.innerHTML = '';
    usuario.inversiones.forEach(inv => {
        invList.innerHTML += `<div style="padding:5px; border-bottom:1px solid #444; font-size:0.9rem">PF: $${inv.monto} (${inv.meses}M)</div>`;
    });
}

window.operar = async (tipo) => {
    if(tipo === 'deposito-propio') {
        const monto = parseFloat(document.getElementById('op-deposito-monto').value);
        if(monto > 0) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: 'Depósito Ventanilla', monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            alert("Depósito realizado.");
            document.getElementById('op-deposito-monto').value = '';
        }
    } 
    else if (tipo === 'retiro') {
        const monto = parseFloat(document.getElementById('op-retiro-monto').value);
        if(monto > 0 && monto <= usuario.saldo) {
            usuario.saldo -= monto;
            usuario.movimientos.push({ desc: 'Retiro Efectivo', monto: -monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            alert("Retiro realizado.");
            document.getElementById('op-retiro-monto').value = '';
        } else {
            alert("Saldo insuficiente.");
        }
    }
    else if (tipo === 'cobrar-cheque') {
        const monto = parseFloat(document.getElementById('cheque-monto').value);
        const benef = document.getElementById('cheque-beneficiario').value;
        if(monto > 0 && benef) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: `Cheque: ${benef}`, monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            alert("Cheque depositado.");
        }
    }
    else if (tipo === 'transferencia' || tipo === 'deposito-tercero') {
        const destino = document.getElementById('tercero-cuenta').value;
        const monto = parseFloat(document.getElementById('tercero-monto').value);
        
        if(!destino || monto <= 0) return alert("Datos inválidos");
        if(tipo === 'transferencia' && monto > usuario.saldo) return alert("Saldo insuficiente");

        // Buscar cuenta destino
        const q = query(collection(db, "usuarios"), where("cuenta", "==", destino));
        const querySnapshot = await getDocs(q);

        if(querySnapshot.empty) return alert("La cuenta destino no existe.");

        const targetDoc = querySnapshot.docs[0];
        const targetData = targetDoc.data();

        // Descontar si es transferencia
        if(tipo === 'transferencia') {
            usuario.saldo -= monto;
            usuario.movimientos.push({ desc: `Transf. a ${targetData.nombres}`, monto: -monto, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
        }

        // Acreditar al tercero
        const descT = tipo === 'transferencia' ? `Transf. de ${usuario.nombres}` : `Depósito Tercero (Ventanilla)`;
        targetData.saldo += monto;
        targetData.movimientos.push({ desc: descT, monto: monto, fecha: new Date().toLocaleDateString() });

        await updateDoc(doc(db, "usuarios", targetDoc.id), targetData);
        alert("Operación a terceros exitosa.");
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
        alert("Inversión creada.");
    }
};

window.solicitarPrestamo = async () => {
    const monto = parseFloat(document.getElementById('prestamo-monto').value);
    if(monto <= 0) return alert("Monto inválido");

    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) return alert("Ya tienes una solicitud pendiente.");

    usuario.solicitudes.push({
        id: Date.now().toString(),
        monto: monto,
        estado: 'pendiente',
        fecha: new Date().toLocaleDateString()
    });
    await guardarUsuario();
    alert("Solicitud enviada al Administrador.");
};

window.copiarCuenta = () => {
    navigator.clipboard.writeText(usuario.cuenta);
    alert("Copiado");
};

// --- LÓGICA ADMINISTRADOR ---

window.cargarUsuariosAdmin = async () => {
    const tbody = document.getElementById('tabla-usuarios-body');
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    
    const snapshot = await getDocs(collection(db, "usuarios"));
    tbody.innerHTML = '';
    
    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        if(u.rol !== 'admin') {
            tbody.innerHTML += `
                <tr>
                    <td>${u.username}</td>
                    <td>${u.nombres} ${u.apellidos}</td>
                    <td>${u.cedula}</td>
                    <td>${u.cuenta}</td>
                    <td style="color:${u.saldo>=0?'lightgreen':'red'}">$${u.saldo.toFixed(2)}</td>
                </tr>
            `;
        }
    });
};

window.cargarSolicitudesAdmin = async () => {
    const container = document.getElementById('lista-solicitudes-prestamo');
    container.innerHTML = 'Cargando solicitudes...';
    
    const snapshot = await getDocs(collection(db, "usuarios"));
    container.innerHTML = '';
    let haySolicitudes = false;

    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        if(u.solicitudes && u.solicitudes.length > 0) {
            u.solicitudes.forEach(sol => {
                if(sol.estado === 'pendiente') {
                    haySolicitudes = true;
                    container.innerHTML += `
                    <div class="request-card">
                        <h4>Solicitante: ${u.nombres} ${u.apellidos}</h4>
                        <p>Monto Solicitado: <strong class="text-gold">$${sol.monto}</strong></p>
                        <p><small>Cédula: ${u.cedula} | Cuenta: ${u.cuenta}</small></p>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button onclick="gestionarPrestamo('${docSnap.id}', '${sol.id}', true)" class="btn-green" style="flex:1">Aprobar</button>
                            <button onclick="gestionarPrestamo('${docSnap.id}', '${sol.id}', false)" class="btn-red" style="flex:1">Rechazar</button>
                        </div>
                    </div>`;
                }
            });
        }
    });

    if(!haySolicitudes) container.innerHTML = '<p>No hay solicitudes pendientes.</p>';
};

// Función global para los botones dinámicos del admin
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
        targetUser.movimientos.push({ desc: 'Préstamo Aprobado', monto: monto, fecha: new Date().toLocaleDateString() });
        alert("Préstamo aprobado.");
    } else {
        targetUser.solicitudes[index].estado = 'rechazado';
        alert("Préstamo rechazado.");
    }

    await updateDoc(userRef, targetUser);
    cargarSolicitudesAdmin(); // Refrescar lista
};