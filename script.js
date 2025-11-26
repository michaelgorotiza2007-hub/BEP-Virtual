import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// --- INICIO ---
window.onload = async () => {
    const d = document.getElementById('current-date');
    if(d) d.innerText = new Date().toLocaleDateString('es-EC', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
    const s = localStorage.getItem('bep_active_user');
    if(s) await cargarDatosUsuario(s);
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

// --- NAVEGACIÓN GLOBAL ---
// Asignamos las funciones al objeto window para que el HTML pueda verlas
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

window.toggleStaffCode = () => {
    const chk = document.getElementById('check-is-staff');
    document.getElementById('staff-code-container').classList.toggle('hidden', !chk.checked);
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
    if(id==='usuarios') cargarUsuariosAdmin();
    if(id==='prestamos') cargarSolicitudesAdmin();
    if(id==='transacciones') cargarTransaccionesGlobales();
};

window.previewImage = () => {
    const file = document.getElementById('reg-foto').files[0];
    const reader = new FileReader();
    reader.onload = () => document.getElementById('avatar-preview').src = reader.result;
    if(file) reader.readAsDataURL(file);
};

// --- AUTH ---
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
    if(!terms) return toast('Acepte términos', 'error');

    // Validar existencia
    try {
        if((await getDoc(doc(db,"usuarios",u))).exists()) return toast('Usuario existe', 'error');
    } catch(e) { return toast('Error conexión', 'error'); }

    // Rol
    let rol = 'cliente';
    const isStaff = document.getElementById('check-is-staff').checked;
    const code = document.getElementById('reg-staff-code').value.trim();
    if(isStaff) {
        if(code === "BEP2025") rol = 'admin';
        else if(code === "CAJA2025") rol = 'cajero';
        else return toast('Código incorrecto', 'error');
    }

    let foto = defaultAvatar;
    const fIn = document.getElementById('reg-foto');
    if(fIn.files[0]) foto = await toBase64(fIn.files[0]);

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
        toast('Cuenta creada', 'success');
        window.toggleAuth('login');
    } catch(e) { toast('Error al crear', 'error'); }
};

window.iniciarSesion = async () => {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if(!u || !p) return toast('Ingrese datos', 'error');
    
    try {
        const snap = await getDoc(doc(db, "usuarios", u));
        if(snap.exists() && snap.data().password === p) {
            usuario = snap.data();
            localStorage.setItem('bep_active_user', usuario.username);
            entrarSistema();
        } else toast('Credenciales error', 'error');
    } catch(e) { toast('Error conexión', 'error'); }
};

function entrarSistema() {
    document.getElementById('auth-screen').classList.add('oculto');
    document.getElementById('intro-screen').style.display = 'none';

    if(usuario.rol === 'admin') {
        document.getElementById('admin-panel').classList.remove('oculto');
        cargarUsuariosAdmin();
    } else if (usuario.rol === 'cajero') {
        document.getElementById('cajero-panel').classList.remove('oculto');
        document.getElementById('cajero-name-display').innerText = usuario.nombres;
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

// --- CLIENTE ---
async function guardarUsuario() { await updateDoc(doc(db, "usuarios", usuario.username), usuario); actualizarUI(); }

function actualizarUI() {
    document.getElementById('nav-user').innerText = usuario.nombres;
    document.getElementById('nav-acc').innerText = usuario.cuenta;
    document.getElementById('nav-avatar').src = usuario.foto || defaultAvatar;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;

    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().slice(0, 10).forEach(m => {
        const c = m.monto > 0 ? 'text-green' : 'text-red';
        list.innerHTML += `<li><div><strong>${m.desc}</strong><br><small>${m.fecha}</small></div><div class="${c}">$${Math.abs(m.monto).toFixed(2)}</div></li>`;
    });

    const p = (usuario.solicitudes || []).find(s => s.estado === 'pendiente');
    document.getElementById('estado-prestamo').innerText = p ? `Solicitud $${p.monto} en revisión` : 'Sin solicitudes';
}

window.solicitarPrestamo = async () => {
    const m = parseFloat(document.getElementById('prestamo-monto').value);
    const ing = document.getElementById('prestamo-ingresos').value;
    const mot = document.getElementById('prestamo-motivo').value;
    const pl = document.getElementById('prestamo-plazo').value;

    if(m <= 0 || !ing || !mot) return toast('Complete datos', 'error');
    if(!usuario.solicitudes) usuario.solicitudes = [];
    if(usuario.solicitudes.some(s => s.estado === 'pendiente')) return toast('Ya tiene solicitud', 'error');

    let int = pl == 3 ? 0.05 : (pl == 6 ? 0.10 : 0.15);
    usuario.solicitudes.push({
        id: Date.now().toString(), monto: m, plazo: pl, interes: int*100,
        total: m + (m*int), motivo: mot, ingresos: ing, estado: 'pendiente', fecha: new Date().toLocaleDateString()
    });
    await guardarUsuario();
    toast('Solicitud enviada', 'success');
};

window.operar = async (tipo) => {
    if(tipo === 'transferencia') {
        const dest = document.getElementById('tercero-cuenta').value;
        const mont = parseFloat(document.getElementById('tercero-monto').value);
        if(!dest || mont <= 0) return toast('Datos mal', 'error');
        if(mont > usuario.saldo) return toast('Saldo bajo', 'error');

        const q = query(collection(db,"usuarios"), where("cuenta","==",dest));
        const snap = await getDocs(q);
        if(snap.empty) return toast('Cuenta no existe', 'error');
        const tDoc = snap.docs[0];
        const tUser = tDoc.data();

        usuario.saldo -= mont;
        usuario.movimientos.push({desc:`Transf a ${tUser.nombres}`, monto:-mont, fecha: new Date().toLocaleDateString()});
        
        tUser.saldo += mont;
        if(!tUser.movimientos) tUser.movimientos=[];
        tUser.movimientos.push({desc:`Transf de ${usuario.nombres}`, monto:mont, fecha: new Date().toLocaleDateString()});

        await updateDoc(doc(db,"usuarios",usuario.username), usuario);
        await updateDoc(doc(db,"usuarios",tDoc.id), tUser);
        toast('Éxito', 'success');
        actualizarUI();
    }
    // (Cobrar cheque igual que antes, simplificado aqui)
    if(tipo === 'cobrar-cheque') {
        const mt = parseFloat(document.getElementById('cheque-monto').value);
        if(mt > 0) {
            usuario.saldo += mt;
            usuario.movimientos.push({desc:'Cheque depositado', monto:mt, fecha: new Date().toLocaleDateString()});
            await guardarUsuario();
            toast('Cheque depositado', 'success');
        }
    }
};

window.copiarCuenta = () => { navigator.clipboard.writeText(usuario.cuenta); toast('Copiado'); };

// --- CAJERO ---
window.buscarClienteCajero = async () => {
    const val = document.getElementById('cajero-search-input').value.trim();
    if(!val) return toast('Ingrese dato', 'error');
    
    let q = query(collection(db,"usuarios"), where("cuenta","==",val));
    let s = await getDocs(q);
    if(s.empty) {
        q = query(collection(db,"usuarios"), where("cedula","==",val));
        s = await getDocs(q);
    }
    if(s.empty) return toast('No encontrado', 'error');

    const d = s.docs[0];
    clienteCajero = { ...d.data(), uid: d.id };
    
    document.getElementById('cajero-cliente-info').classList.remove('oculto');
    document.getElementById('cajero-client-nombre').innerText = clienteCajero.nombres;
    document.getElementById('cajero-client-cuenta').innerText = clienteCajero.cuenta;
    document.getElementById('cajero-client-saldo').innerText = `$${clienteCajero.saldo.toFixed(2)}`;
    document.getElementById('cajero-client-foto').src = clienteCajero.foto || defaultAvatar;
};

window.ejecutarOperacionCajero = async () => {
    if(!clienteCajero) return;
    const tipo = document.getElementById('cajero-tipo-op').value;
    const m = parseFloat(document.getElementById('cajero-monto-op').value);
    if(m <= 0) return toast('Monto mal', 'error');

    if(tipo === 'retiro') {
        if(m > clienteCajero.saldo) return toast('Saldo insuficiente', 'error');
        clienteCajero.saldo -= m;
        clienteCajero.movimientos.push({desc:'Retiro Caja', monto:-m, fecha: new Date().toLocaleDateString()});
    } else {
        clienteCajero.saldo += m;
        clienteCajero.movimientos.push({desc:'Depósito Caja', monto:m, fecha: new Date().toLocaleDateString()});
    }
    await updateDoc(doc(db,"usuarios",clienteCajero.uid), clienteCajero);
    toast('Operación lista', 'success');
    document.getElementById('cajero-client-saldo').innerText = `$${clienteCajero.saldo.toFixed(2)}`;
};

// --- ADMIN ---
window.cargarUsuariosAdmin = async () => {
    const t = document.getElementById('tabla-usuarios-body');
    t.innerHTML = 'Wait...';
    const s = await getDocs(collection(db,"usuarios"));
    t.innerHTML = '';
    s.forEach(d => {
        const u = d.data();
        if(u.rol==='cliente') {
            t.innerHTML += `<tr><td>${u.nombres}</td><td>${u.cedula}</td><td>${u.cuenta}</td><td>$${u.saldo.toFixed(2)}</td>
            <td><button class="btn-red" onclick="eliminarUsuario('${d.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
        }
    });
};

window.eliminarUsuario = async (id) => {
    if(confirm('Borrar?')) { await deleteDoc(doc(db,"usuarios",id)); cargarUsuariosAdmin(); }
};

window.cargarSolicitudesAdmin = async () => {
    const c = document.getElementById('lista-solicitudes-prestamo');
    c.innerHTML = 'Wait...';
    const s = await getDocs(collection(db,"usuarios"));
    c.innerHTML = '';
    s.forEach(d => {
        const u = d.data();
        (u.solicitudes||[]).forEach(sol => {
            if(sol.estado === 'pendiente') {
                c.innerHTML += `<div class="request-card"><h4>${u.nombres}</h4><p>Monto: $${sol.monto} | Ingresos: $${sol.ingresos}</p>
                <button class="btn-green" onclick="gestionarPrestamo('${d.id}','${sol.id}',true)">Aprobar</button>
                <button class="btn-red" onclick="gestionarPrestamo('${d.id}','${sol.id}',false)">Rechazar</button></div>`;
            }
        });
    });
};

window.gestionarPrestamo = async (uid, sid, ok) => {
    const r = doc(db,"usuarios",uid);
    const u = (await getDoc(r)).data();
    const idx = u.solicitudes.findIndex(s => s.id === sid);
    if(idx === -1) return;
    
    if(ok) {
        u.saldo += u.solicitudes[idx].monto;
        u.movimientos.push({desc:'Préstamo Aprobado', monto:u.solicitudes[idx].monto, fecha: new Date().toLocaleDateString()});
        u.solicitudes[idx].estado = 'aprobado';
    } else u.solicitudes[idx].estado = 'rechazado';
    
    await updateDoc(r, u);
    cargarSolicitudesAdmin();
};

window.cargarTransaccionesGlobales = async () => {
    const t = document.getElementById('tabla-transacciones-body');
    const s = await getDocs(collection(db,"usuarios"));
    let arr = [];
    s.forEach(d => { const u = d.data(); (u.movimientos||[]).forEach(m=>arr.push({...m, user:u.nombres})); });
    t.innerHTML = '';
    arr.slice(-20).reverse().forEach(x => t.innerHTML += `<tr><td>${x.fecha}</td><td>${x.user}</td><td>${x.desc}</td><td>$${Math.abs(x.monto)}</td></tr>`);
};

function toast(m, t) {
    const c = document.getElementById('toast-container');
    const d = document.createElement('div'); d.className='toast'; d.innerText=m;
    d.style.borderLeftColor = t==='error'?'red':'green';
    c.appendChild(d); setTimeout(()=>d.remove(),3000);
}