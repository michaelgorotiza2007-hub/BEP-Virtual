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
            console.log("Sesión recuperada");
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// FUNCIONES GLOBALES (Solución al error de botones)
// ==========================================

// NAVEGACIÓN
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    if(usuario) entrarSistema();
    else document.getElementById('auth-screen').classList.remove('oculto');
};

window.toggleAuth = (tab) => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registro').classList.add('oculto');
    document.getElementById('form-' + tab).classList.remove('oculto');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
};

window.toggleAdminCode = () => {
    const chk = document.getElementById('check-is-admin');
    const box = document.getElementById('admin-code-container');
    if(chk.checked) box.classList.remove('hidden'); else box.classList.add('hidden');
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
    const chk = document.getElementById('check-is-staff');
    document.getElementById('staff-code-container').classList.toggle('hidden', !chk.checked);
};

// IMAGEN
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

// AUTH
window.registrarUsuario = async () => {
    const u = document.getElementById('reg-user').value.trim();
    const p = document.getElementById('reg-pass').value.trim();
    const n = document.getElementById('reg-nombres').value.trim();
    const c = document.getElementById('reg-cedula').value.trim();
    const terms = document.getElementById('reg-terms').checked;
    
    if(!u || !p || !n || !c) return toast('Faltan datos', 'error');
    if(!terms) return toast('Acepte los términos', 'error');

    try {
        if((await getDoc(doc(db,"usuarios",u))).exists()) return toast('El usuario ya existe', 'error');
    } catch(e) { return toast('Error de conexión', 'error'); }

    let rol = 'cliente';
    // Revisar si es admin (usando el campo del HTML actualizado)
    const isStaff = document.getElementById('check-is-staff').checked;
    const code = document.getElementById('reg-staff-code').value.trim();
    if(isStaff) {
        if(code === "BEP2025") rol = 'admin';
        else return toast('Código incorrecto', 'error');
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
    } catch(e) { console.error(e); toast('Error al guardar', 'error'); }
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

    // Cargar foto
    const fotoUrl = usuario.foto || defaultAvatar;

    if(usuario.rol === 'admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        document.getElementById('admin-name-display').innerText = usuario.nombres;
        document.getElementById('admin-avatar-img').src = fotoUrl;
        cargarUsuariosAdmin();
    } else {
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

// CLIENTE
async function guardarUsuario() { await updateDoc(doc(db, "usuarios", usuario.username), usuario); actualizarUI(); }

function actualizarUI() {
    document.getElementById('nav-user').innerText = usuario.nombres;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;
    
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().slice(0, 10).forEach(m => {
        const color = m.monto > 0 ? 'text-green' : 'text-red';
        list.innerHTML += `<li><div><strong>${m.desc}</strong><br><small>${m.fecha}</small></div><div class="${color}">$${Math.abs(m.monto).toFixed(2)}</div></li>`;
    });

    const pending = (usuario.solicitudes || []).find(s => s.estado === 'pendiente');
    document.getElementById('estado-prestamo').innerText = pending 
        ? `Solicitud de $${pending.monto} en revisión.` 
        : 'Sin solicitudes pendientes.';
    
    // Lista inversiones (simple)
    const invList = document.getElementById('lista-inversiones');
    if(invList) {
        invList.innerHTML = '';
        usuario.inversiones.forEach(i => invList.innerHTML += `<div>PF: $${i.monto}</div>`);
    }
}

window.solicitarPrestamo = async () => {
    const m = parseFloat(document.getElementById('prestamo-monto').value);
    const ing = document.getElementById('prestamo-ingresos').value;
    const mot = document.getElementById('prestamo-motivo').value;
    const pl = document.getElementById('prestamo-plazo').value;

    if(m <= 0 || !ing || !mot) return toast('Complete todos los campos', 'error');
    if(!usuario.solicitudes) usuario.solicitudes = [];
    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) return toast('Ya tiene una solicitud pendiente', 'error');

    let interest = pl == 3 ? 0.05 : (pl == 6 ? 0.10 : 0.15);
    usuario.solicitudes.push({
        id: Date.now().toString(), monto: m, plazo: pl, interes: interest*100,
        total: m + (m*interest), motivo: mot, ingresos: ing, estado: 'pendiente', fecha: new Date().toLocaleDateString()
    });

    await guardarUsuario();
    toast('Solicitud enviada a Gerencia', 'success');
    document.getElementById('prestamo-monto').value = '';
};

window.operar = async (tipo) => {
    if(tipo === 'deposito-propio') {
        const m = parseFloat(document.getElementById('op-deposito-monto').value);
        if(m > 0) {
            usuario.saldo += m;
            usuario.movimientos.push({ desc: 'Depósito Ventanilla', monto: m, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            toast('Depósito exitoso', 'success');
            document.getElementById('op-deposito-monto').value = '';
        }
    }
    else if(tipo === 'retiro') {
        const m = parseFloat(document.getElementById('op-retiro-monto').value);
        if(m > 0 && m <= usuario.saldo) {
            usuario.saldo -= m;
            usuario.movimientos.push({ desc: 'Retiro Efectivo', monto: -m, fecha: new Date().toLocaleDateString() });
            await guardarUsuario();
            toast('Retiro exitoso', 'success');
            document.getElementById('op-retiro-monto').value = '';
        } else toast('Saldo insuficiente', 'error');
    }
    else if(tipo === 'transferencia') {
        const dest = document.getElementById('tercero-cuenta').value;
        const mont = parseFloat(document.getElementById('tercero-monto').value);
        
        if(!dest || mont <= 0) return toast('Datos inválidos', 'error');
        if(mont > usuario.saldo) return toast('Saldo insuficiente', 'error');

        const q = query(collection(db,"usuarios"), where("cuenta","==",dest));
        const snap = await getDocs(q);
        
        if(snap.empty) return toast('Cuenta destino no encontrada', 'error');
        
        const targetDoc = snap.docs[0];
        const targetUser = targetDoc.data();

        // Descontar
        usuario.saldo -= mont;
        usuario.movimientos.push({desc:`Transf. a ${targetUser.nombres}`, monto: -mont, fecha: new Date().toLocaleDateString()});
        
        // Acreditar
        targetUser.saldo += mont;
        if(!targetUser.movimientos) targetUser.movimientos = [];
        targetUser.movimientos.push({desc:`Transf. de ${usuario.nombres}`, monto: mont, fecha: new Date().toLocaleDateString()});

        await updateDoc(doc(db,"usuarios",usuario.username), usuario);
        await updateDoc(doc(db,"usuarios",targetDoc.id), targetUser);
        
        toast('Transferencia exitosa', 'success');
        actualizarUI();
    }
    else if(tipo === 'cobrar-cheque') {
        const m = parseFloat(document.getElementById('cheque-monto').value);
        const b = document.getElementById('cheque-beneficiario').value;
        if(m > 0 && b) {
            usuario.saldo += m;
            usuario.movimientos.push({desc:`Cheque: ${b}`, monto:m, fecha: new Date().toLocaleDateString()});
            await guardarUsuario();
            toast('Cheque depositado', 'success');
        }
    }
};

window.crearPlazoFijo = async () => {
    const m = parseFloat(document.getElementById('pf-monto').value);
    const t = document.getElementById('pf-tiempo').value;
    if(m > 0 && m <= usuario.saldo) {
        usuario.saldo -= m;
        usuario.inversiones.push({monto:m, meses:t});
        usuario.movimientos.push({desc:`Plazo Fijo (${t}M)`, monto:-m, fecha: new Date().toLocaleDateString()});
        await guardarUsuario();
        toast('Inversión creada', 'success');
    } else toast('Saldo insuficiente', 'error');
};

window.copiarCuenta = () => { navigator.clipboard.writeText(usuario.cuenta); toast('Copiado'); };

// ADMIN
window.cargarUsuariosAdmin = async () => {
    const t = document.getElementById('tabla-usuarios-body');
    t.innerHTML = 'Cargando...';
    const s = await getDocs(collection(db,"usuarios"));
    t.innerHTML = '';
    s.forEach(d => {
        const u = d.data();
        if(u.rol === 'cliente') {
            t.innerHTML += `<tr>
                <td><img src="${u.foto||defaultAvatar}" class="avatar-table"></td>
                <td>${u.nombres}<br><small>${u.username}</small></td>
                <td>${u.cedula}</td>
                <td>${u.cuenta}</td>
                <td>$${u.saldo.toFixed(2)}</td>
                <td><button class="btn-red" onclick="eliminarUsuario('${d.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }
    });
};

window.eliminarUsuario = async (id) => {
    if(confirm('¿Seguro que desea eliminar este usuario?')) {
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
                        <p>Solicita: <strong class="text-gold">$${sol.monto}</strong> (Plazo: ${sol.plazo} meses)</p>
                        <p class="small-text">Motivo: ${sol.motivo} | Ingresos: $${sol.ingresos}</p>
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