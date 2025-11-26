import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, 
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PEGA AQUÍ TUS CREDENCIALES ---
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

// --- INICIO ---
window.onload = async () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('es-EC', options);
    
    // Auto-login
    const usuarioGuardado = localStorage.getItem('bep_session_user');
    if(usuarioGuardado) {
        await cargarDatosDeUsuario(usuarioGuardado);
    }
};

async function cargarDatosDeUsuario(username) {
    try {
        const docRef = doc(db, "usuarios", username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            usuario = docSnap.data();
            document.getElementById('auth-screen').classList.add('oculto');
            document.getElementById('intro-screen').style.display = 'none';
            document.getElementById('dashboard').classList.remove('oculto');
            actualizarUI();
        }
    } catch (e) {
        console.error(e);
    }
}

// --- UI HELPERS ---
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    if(!usuario) document.getElementById('auth-screen').classList.remove('oculto');
};

window.toggleAuth = (tab) => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registro').classList.add('oculto');
    document.getElementById('form-' + tab).classList.remove('oculto');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
};

window.mostrarPanel = (panelId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.add('oculto'));
    document.getElementById('panel-' + panelId).classList.remove('oculto');
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
};

// --- AUTH ---
window.registrarUsuario = async () => {
    const nombre = document.getElementById('reg-nombre').value;
    const user = document.getElementById('reg-user').value;
    const pass = document.getElementById('reg-pass').value;

    if(!nombre || !user || !pass) return alert('Complete todos los campos');

    const docSnap = await getDoc(doc(db, "usuarios", user));
    if (docSnap.exists()) return alert('Usuario ya existe');

    const nuevoUsuario = {
        nombre: nombre,
        username: user,
        password: pass,
        cuenta: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        saldo: 50.00,
        movimientos: [{ desc: 'Bono Bienvenida', monto: 50, fecha: new Date().toLocaleDateString() }],
        prestamos: 0,
        inversiones: []
    };

    await setDoc(doc(db, "usuarios", user), nuevoUsuario);
    alert('Cuenta creada. Inicia sesión.');
    window.toggleAuth('login');
};

window.iniciarSesion = async () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    const docSnap = await getDoc(doc(db, "usuarios", user));
    if (docSnap.exists() && docSnap.data().password === pass) {
        usuario = docSnap.data();
        localStorage.setItem('bep_session_user', usuario.username);
        document.getElementById('auth-screen').classList.add('oculto');
        document.getElementById('intro-screen').style.display = 'none';
        document.getElementById('dashboard').classList.remove('oculto');
        actualizarUI();
    } else {
        alert('Credenciales incorrectas');
    }
};

window.cerrarSesion = () => {
    localStorage.removeItem('bep_session_user');
    location.reload();
};

// --- LOGICA BANCARIA ---
async function guardarDatosUsuario() {
    await updateDoc(doc(db, "usuarios", usuario.username), usuario);
    actualizarUI();
}

function actualizarUI() {
    document.getElementById('nav-user').innerText = usuario.nombre;
    document.getElementById('nav-acc').innerText = 'Cta: ' + usuario.cuenta;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta;
    
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().forEach(mov => {
        const color = mov.monto > 0 ? 'monto-positivo' : 'monto-negativo';
        list.innerHTML += `<li><div><strong>${mov.desc}</strong><br><small>${mov.fecha}</small></div><div class="${color}">$${Math.abs(mov.monto).toFixed(2)}</div></li>`;
    });

    document.getElementById('stat-saldo').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('stat-prestamos').innerText = `$${usuario.prestamos.toFixed(2)}`;
    
    const invList = document.getElementById('lista-inversiones');
    invList.innerHTML = '';
    usuario.inversiones.forEach(inv => {
        invList.innerHTML += `<div style="padding:10px; border-bottom:1px solid #444">PF: $${inv.monto} (${inv.meses}M)</div>`;
    });
}

window.operar = async (tipo) => {
    let montoIngreso = parseFloat(document.getElementById('op-monto-ingreso').value);
    let montoEgreso = parseFloat(document.getElementById('op-monto-egreso').value);
    
    if(tipo === 'deposito' || tipo === 'cheque') {
        if(montoIngreso > 0) {
            usuario.saldo += montoIngreso;
            usuario.movimientos.push({ desc: tipo === 'deposito' ? 'Depósito Ventanilla' : 'Depósito Cheque', monto: montoIngreso, fecha: new Date().toLocaleDateString() });
            await guardarDatosUsuario();
            alert('Depósito realizado');
            document.getElementById('op-monto-ingreso').value = '';
        }
    } else if (tipo === 'retiro') {
        if(montoEgreso > 0 && montoEgreso <= usuario.saldo) {
            usuario.saldo -= montoEgreso;
            usuario.movimientos.push({ desc: 'Retiro ATM', monto: -montoEgreso, fecha: new Date().toLocaleDateString() });
            await guardarDatosUsuario();
            alert('Retiro realizado');
            document.getElementById('op-monto-egreso').value = '';
        }
    } else if (tipo === 'transferencia') {
        const cuentaDestino = document.getElementById('op-destino').value;
        if(montoEgreso > 0 && montoEgreso <= usuario.saldo && cuentaDestino) {
            const q = query(collection(db, "usuarios"), where("cuenta", "==", cuentaDestino));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) return alert('Cuenta destino no existe');

            const targetDoc = querySnapshot.docs[0];
            const targetData = targetDoc.data();

            // Descontar
            usuario.saldo -= montoEgreso;
            usuario.movimientos.push({ desc: `Transf. a ${cuentaDestino}`, monto: -montoEgreso, fecha: new Date().toLocaleDateString() });
            await guardarDatosUsuario();

            // Acreditar
            targetData.saldo += montoEgreso;
            targetData.movimientos.push({ desc: `Transf. de ${usuario.nombre}`, monto: montoEgreso, fecha: new Date().toLocaleDateString() });
            await updateDoc(doc(db, "usuarios", targetDoc.id), targetData);

            alert('Transferencia exitosa');
            document.getElementById('op-monto-egreso').value = '';
        } else {
            alert('Datos inválidos o saldo insuficiente');
        }
    }
};

window.crearPlazoFijo = async () => {
    const monto = parseFloat(document.getElementById('pf-monto').value);
    const meses = document.getElementById('pf-tiempo').value;
    if(monto > 0 && monto <= usuario.saldo) {
        usuario.saldo -= monto;
        usuario.inversiones.push({ monto: monto, meses: meses });
        usuario.movimientos.push({ desc: `Plazo Fijo (${meses}M)`, monto: -monto, fecha: new Date().toLocaleDateString() });
        await guardarDatosUsuario();
        alert('Inversión creada');
    }
};

window.pedirPrestamo = async () => {
    const monto = parseFloat(document.getElementById('prestamo-monto').value);
    if(monto > 0) {
        usuario.saldo += monto;
        usuario.prestamos += monto;
        usuario.movimientos.push({ desc: 'Préstamo BEP', monto: monto, fecha: new Date().toLocaleDateString() });
        await guardarDatosUsuario();
        alert('Préstamo acreditado');
    }
};

window.calcularArqueo = () => {
    let total = 0;
    document.querySelectorAll('.bill-input').forEach(input => {
        total += (parseFloat(input.getAttribute('data-val')) * (parseFloat(input.value) || 0));
    });
    document.getElementById('arqueo-total').innerText = `Total: $${total.toFixed(2)}`;
};

window.copiarCuenta = () => {
    navigator.clipboard.writeText(usuario.cuenta);
    alert('Copiado');
};