// IMPORTAR FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- TUS CREDENCIALES DE FIREBASE ---
const firebaseConfig = {
    // PEGA AQUI TUS KEYS
    apiKey: "AIzaSyD...",
    authDomain: "bancopeninsular.firebaseapp.com",
    projectId: "bancopeninsular...",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let usuario = null; // Usuario logueado actual

// --- INICIO ---
window.onload = async () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('es-EC', options);
    
    // Auto-login (Persistencia)
    const savedUser = localStorage.getItem('bep_user');
    if(savedUser) {
        await cargarUsuario(savedUser);
    }
};

async function cargarUsuario(username) {
    const docRef = doc(db, "usuarios", username);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        usuario = docSnap.data();
        entrarAlSistema();
    }
}

// --- UTILIDADES GLOBALES ---
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
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
};

window.mostrarPanelAdmin = (id) => {
    document.querySelectorAll('.view-admin').forEach(v => v.classList.add('oculto'));
    document.getElementById('admin-' + id).classList.remove('oculto');
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

// --- AUTH ---
window.registrarUsuario = async () => {
    const user = document.getElementById('reg-user').value;
    const pass = document.getElementById('reg-pass').value;
    const nombres = document.getElementById('reg-nombres').value;
    const apellidos = document.getElementById('reg-apellidos').value;
    const cedula = document.getElementById('reg-cedula').value;
    const telefono = document.getElementById('reg-telefono').value;
    const terms = document.getElementById('reg-terms').checked;
    const fotoInput = document.getElementById('reg-foto');

    if(!user || !pass || !nombres || !cedula || !terms) return alert("Complete campos obligatorios y términos");

    // Verificar si existe
    const docSnap = await getDoc(doc(db, "usuarios", user));
    if(docSnap.exists()) return alert("Usuario ya existe");

    // Procesar Imagen (Base64)
    let fotoBase64 = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; // Default
    if(fotoInput.files[0]) {
        fotoBase64 = await toBase64(fotoInput.files[0]);
    }

    // Rol: Si el usuario es 'admin', se le da rol admin.
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
        solicitudes: [] // Para préstamos
    };

    await setDoc(doc(db, "usuarios", user), nuevoUsuario);
    alert("Usuario creado. Inicie sesión.");
    window.toggleAuth('login');
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

    const docSnap = await getDoc(doc(db, "usuarios", user));
    if(docSnap.exists() && docSnap.data().password === pass) {
        usuario = docSnap.data();
        localStorage.setItem('bep_user', usuario.username);
        entrarAlSistema();
    } else {
        alert("Credenciales incorrectas");
    }
};

function entrarAlSistema() {
    document.getElementById('auth-screen').classList.add('oculto');
    document.getElementById('intro-screen').style.display = 'none';
    
    if(usuario.rol === 'admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        cargarUsuariosAdmin();
    } else {
        document.getElementById('dashboard').classList.remove('oculto');
        actualizarUI();
    }
}

window.cerrarSesion = () => {
    usuario = null;
    localStorage.removeItem('bep_user');
    location.reload(); // Recargar para limpiar todo
};

// --- LOGICA CLIENTE ---

async function guardarCambios() {
    await updateDoc(doc(db, "usuarios", usuario.username), usuario);
    actualizarUI();
}

function actualizarUI() {
    document.getElementById('nav-user').innerText = `${usuario.nombres} ${usuario.apellidos}`;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;

    // Movimientos
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().slice(0, 10).forEach(mov => {
        const color = mov.monto > 0 ? 'text-green' : 'text-red';
        list.innerHTML += `<li style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333">
            <span>${mov.desc}<br><small>${mov.fecha}</small></span>
            <span class="${color}">$${Math.abs(mov.monto).toFixed(2)}</span>
        </li>`;
    });

    // Préstamos status
    const pending = usuario.solicitudes.find(s => s.estado === 'pendiente');
    document.getElementById('estado-prestamo').innerText = pending 
        ? `Solicitud de $${pending.monto} pendiente de revisión.` 
        : 'Sin solicitudes activas.';
}

window.operar = async (tipo) => {
    let monto = 0;
    
    if(tipo === 'deposito-propio') {
        monto = parseFloat(document.getElementById('op-deposito-monto').value);
        if(monto > 0) {
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: 'Depósito Ventanilla', monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarCambios();
            alert("Depósito exitoso");
            document.getElementById('op-deposito-monto').value = '';
        }
    } 
    else if (tipo === 'retiro') {
        monto = parseFloat(document.getElementById('op-retiro-monto').value);
        if(monto > 0 && monto <= usuario.saldo) {
            usuario.saldo -= monto;
            usuario.movimientos.push({ desc: 'Retiro Efectivo', monto: -monto, fecha: new Date().toLocaleDateString() });
            await guardarCambios();
            alert("Retiro exitoso");
            document.getElementById('op-retiro-monto').value = '';
        } else {
            alert("Saldo insuficiente");
        }
    }
    else if (tipo === 'cobrar-cheque') {
        monto = parseFloat(document.getElementById('cheque-monto').value);
        const benef = document.getElementById('cheque-beneficiario').value;
        if(monto > 0 && benef) {
            // Simulación simple
            usuario.saldo += monto;
            usuario.movimientos.push({ desc: `Cheque: ${benef}`, monto: monto, fecha: new Date().toLocaleDateString() });
            await guardarCambios();
            alert("Cheque depositado correctamente");
        }
    }
    else if (tipo === 'transferencia' || tipo === 'deposito-tercero') {
        // Logica compleja de terceros
        const destino = document.getElementById('tercero-cuenta').value;
        const montoOp = parseFloat(document.getElementById('tercero-monto').value);
        
        if(!destino || montoOp <= 0) return alert("Datos inválidos");
        if(tipo === 'transferencia' && montoOp > usuario.saldo) return alert("Saldo insuficiente");

        // Buscar destino
        const q = query(collection(db, "usuarios"), where("cuenta", "==", destino));
        const snapshot = await getDocs(q);
        
        if(snapshot.empty) return alert("Cuenta destino no existe");

        const targetDoc = snapshot.docs[0];
        const targetUser = targetDoc.data();
        
        // Ejecutar
        if(tipo === 'transferencia') {
            usuario.saldo -= montoOp;
            usuario.movimientos.push({ desc: `Transf. a ${targetUser.nombres}`, monto: -montoOp, fecha: new Date().toLocaleDateString() });
            await guardarCambios();
        }

        // Acreditar al otro
        targetUser.saldo += montoOp;
        const descT = tipo === 'transferencia' ? `Transf. de ${usuario.nombres}` : `Depósito Efectivo (Tercero)`;
        targetUser.movimientos.push({ desc: descT, monto: montoOp, fecha: new Date().toLocaleDateString() });
        
        await updateDoc(doc(db, "usuarios", targetDoc.id), targetUser);
        alert("Operación exitosa a terceros");
    }
};

window.solicitarPrestamo = async () => {
    const monto = parseFloat(document.getElementById('prestamo-monto').value);
    if(monto <= 0) return alert("Monto inválido");
    
    // Verificar si ya tiene uno pendiente
    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) return alert("Ya tienes una solicitud pendiente");

    const solicitud = {
        id: Date.now().toString(), // ID único simple
        monto: monto,
        estado: 'pendiente',
        fecha: new Date().toLocaleDateString()
    };

    usuario.solicitudes.push(solicitud);
    await guardarCambios();
    alert("Solicitud enviada al administrador.");
};

// --- LOGICA ADMIN ---

window.cargarUsuariosAdmin = async () => {
    const table = document.getElementById('tabla-usuarios-body');
    table.innerHTML = 'Cargando...';
    
    const snap = await getDocs(collection(db, "usuarios"));
    table.innerHTML = '';
    
    snap.forEach(doc => {
        const u = doc.data();
        if(u.rol !== 'admin') {
            table.innerHTML += `<tr>
                <td>${u.username}</td>
                <td>${u.nombres} ${u.apellidos}</td>
                <td>${u.cedula}</td>
                <td>$${u.saldo.toFixed(2)}</td>
                <td>${u.cuenta}</td>
            </tr>`;
        }
    });
};

window.cargarSolicitudesAdmin = async () => {
    const container = document.getElementById('lista-solicitudes-prestamo');
    container.innerHTML = 'Buscando...';
    
    const snap = await getDocs(collection(db, "usuarios"));
    container.innerHTML = '';
    let found = false;

    snap.forEach(userDoc => {
        const u = userDoc.data();
        if(u.solicitudes && u.solicitudes.length > 0) {
            u.solicitudes.forEach(s => {
                if(s.estado === 'pendiente') {
                    found = true;
                    container.innerHTML += `
                    <div class="request-card">
                        <h4>Solicitante: ${u.nombres} ${u.apellidos}</h4>
                        <p>Monto: <strong class="text-gold">$${s.monto}</strong></p>
                        <p>Cédula: ${u.cedula}</p>
                        <div class="btn-row-small">
                            <button onclick="gestionarPrestamo('${userDoc.id}', '${s.id}', true)" class="btn-green btn-sm">Aprobar</button>
                            <button onclick="gestionarPrestamo('${userDoc.id}', '${s.id}', false)" class="btn-red btn-sm">Rechazar</button>
                        </div>
                    </div>`;
                }
            });
        }
    });

    if(!found) container.innerHTML = "<p>No hay solicitudes pendientes.</p>";
};

// Como las funciones se llaman desde HTML dinámico, las adjuntamos al window
window.gestionarPrestamo = async (userId, solId, aprobado) => {
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await getDoc(userRef);
    const targetUser = userSnap.data();

    // Buscar la solicitud
    const solIndex = targetUser.solicitudes.findIndex(s => s.id === solId);
    if(solIndex === -1) return;

    if(aprobado) {
        targetUser.solicitudes[solIndex].estado = 'aprobado';
        targetUser.saldo += targetUser.solicitudes[solIndex].monto;
        targetUser.movimientos.push({
            desc: 'Préstamo Aprobado', 
            monto: targetUser.solicitudes[solIndex].monto, 
            fecha: new Date().toLocaleDateString()
        });
        alert("Préstamo aprobado y acreditado.");
    } else {
        targetUser.solicitudes[solIndex].estado = 'rechazado';
        alert("Préstamo rechazado.");
    }

    // Limpiar solicitudes viejas si se desea, o dejarlas como historial
    // Aquí actualizamos el usuario
    await updateDoc(userRef, targetUser);
    cargarSolicitudesAdmin(); // Refrescar lista
};

window.copiarCuenta = () => {
    navigator.clipboard.writeText(usuario.cuenta);
    alert("Copiado");
};

window.cerrarIntro = () => document.getElementById('intro-screen').style.display = 'none';