// IMPORTAR FUNCIONES DE LA NUBE (FIREBASE)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, 
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE (¡No olvides esto!) ---
const firebaseConfig = {
    apiKey: "AIzaSyBpI16R6BI6gorLoW-I62RA09PJSUvuIY0",
  authDomain: "bancopeninsular.firebaseapp.com",
  projectId: "bancopeninsular",
  storageBucket: "bancopeninsular.firebasestorage.app",
  messagingSenderId: "218848309222",
  appId: "1:218848309222:web:603faf9cedb2c99caf7027"
};

// INICIALIZAR
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ESTADO GLOBAL
let usuario = null;

// --- 1. CARGA INICIAL Y PERSISTENCIA DE SESIÓN ---
window.onload = async function() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('es-EC', options);
    
    // VERIFICAR SI HAY UNA SESIÓN GUARDADA
    const usuarioGuardado = localStorage.getItem('bep_session_user');
    if(usuarioGuardado) {
        // Si existe, cargamos los datos de la nube automáticamente
        await cargarDatosDeUsuario(usuarioGuardado);
    }
};

// Función auxiliar para descargar datos frescos
async function cargarDatosDeUsuario(username) {
    try {
        const docRef = doc(db, "usuarios", username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            usuario = docSnap.data();
            document.getElementById('auth-screen').classList.add('oculto');
            document.getElementById('dashboard').classList.remove('oculto');
            actualizarUI();
            mostrarToast(`Sesión restaurada: ${usuario.nombre}`, 'success');
        }
    } catch (e) {
        console.error(e);
    }
}

// --- NAVEGACIÓN ---
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    if(!usuario) document.getElementById('auth-screen').classList.remove('oculto');
};

window.toggleAuth = (tab) => {
    document.querySelectorAll('#auth-screen .form-group').forEach(el => el.classList.add('oculto'));
    document.getElementById('form-' + tab).classList.remove('oculto');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
};

window.mostrarPanel = (panelId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.add('oculto'));
    document.getElementById('panel-' + panelId).classList.remove('oculto');
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
};

// --- AUTHENTICACIÓN ---

window.registrarUsuario = async () => {
    const nombre = document.getElementById('reg-nombre').value;
    const user = document.getElementById('reg-user').value; 
    const pass = document.getElementById('reg-pass').value;

    if(!nombre || !user || !pass) return mostrarToast('Complete campos', 'error');

    const docRef = doc(db, "usuarios", user);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) return mostrarToast('Usuario ya existe', 'error');

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
    mostrarToast('Cuenta creada. Inicia sesión.', 'success');
    window.toggleAuth('login');
};

window.iniciarSesion = async () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if(!user || !pass) return mostrarToast('Faltan datos', 'error');

    const docRef = doc(db, "usuarios", user);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        if(data.password === pass) {
            usuario = data;
            // GUARDAR SESIÓN EN EL NAVEGADOR
            localStorage.setItem('bep_session_user', usuario.username);
            
            document.getElementById('auth-screen').classList.add('oculto');
            document.getElementById('dashboard').classList.remove('oculto');
            actualizarUI();
            mostrarToast(`Bienvenido ${data.nombre}`, 'success');
        } else {
            mostrarToast('Contraseña incorrecta', 'error');
        }
    } else {
        mostrarToast('Usuario no encontrado', 'error');
    }
};

window.cerrarSesion = () => {
    usuario = null;
    localStorage.removeItem('bep_session_user'); // BORRAR SESIÓN
    document.getElementById('dashboard').classList.add('oculto');
    document.getElementById('auth-screen').classList.remove('oculto');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    mostrarToast('Sesión cerrada correctamente');
};

// --- OPERACIONES AVANZADAS (TRANSFERENCIA REAL) ---

window.operar = async (tipo) => {
    if(!usuario) return;

    // Obtener valores
    let montoIngreso = parseFloat(document.getElementById('op-monto-ingreso').value);
    let montoEgreso = parseFloat(document.getElementById('op-monto-egreso').value);
    
    // Lógica para Depósitos y Retiros (Local -> Nube)
    if(tipo === 'deposito' || tipo === 'cheque') {
        if(isNaN(montoIngreso) || montoIngreso <= 0) return mostrarToast('Monto inválido', 'error');
        
        usuario.saldo += montoIngreso;
        usuario.movimientos.push({ 
            desc: tipo === 'deposito' ? 'Depósito Ventanilla' : 'Depósito Cheque', 
            monto: montoIngreso, 
            fecha: new Date().toLocaleDateString() 
        });
        await guardarDatosUsuario();
        mostrarToast('Depósito realizado', 'success');
        document.getElementById('op-monto-ingreso').value = '';

    } else if (tipo === 'retiro') {
        if(isNaN(montoEgreso) || montoEgreso <= 0) return mostrarToast('Monto inválido', 'error');
        if(montoEgreso > usuario.saldo) return mostrarToast('Saldo insuficiente', 'error');

        usuario.saldo -= montoEgreso;
        usuario.movimientos.push({ desc: 'Retiro ATM', monto: -montoEgreso, fecha: new Date().toLocaleDateString() });
        await guardarDatosUsuario();
        mostrarToast('Retiro realizado', 'success');
        document.getElementById('op-monto-egreso').value = '';

    } else if (tipo === 'transferencia') {
        // --- LÓGICA DE TRANSFERENCIA REAL ---
        const cuentaDestino = document.getElementById('op-destino').value;
        
        if(isNaN(montoEgreso) || montoEgreso <= 0) return mostrarToast('Monto inválido', 'error');
        if(montoEgreso > usuario.saldo) return mostrarToast('Saldo insuficiente', 'error');
        if(!cuentaDestino) return mostrarToast('Ingrese cuenta destino', 'error');
        if(cuentaDestino === usuario.cuenta) return mostrarToast('No puedes transferirte a ti mismo', 'error');

        mostrarToast('Procesando transferencia...', 'info');

        try {
            // 1. BUSCAR AL DESTINATARIO EN LA NUBE POR SU NÚMERO DE CUENTA
            const usuariosRef = collection(db, "usuarios");
            const q = query(usuariosRef, where("cuenta", "==", cuentaDestino));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return mostrarToast('La cuenta destino no existe', 'error');
            }

            // 2. OBTENER DATOS DEL DESTINATARIO
            let destinatarioDoc = querySnapshot.docs[0]; // Tomamos el primer resultado
            let destinatarioData = destinatarioDoc.data();
            let destinatarioId = destinatarioDoc.id;

            // 3. ACTUALIZAR AL REMITENTE (TÚ)
            usuario.saldo -= montoEgreso;
            usuario.movimientos.push({ 
                desc: `Transf. enviada a ${cuentaDestino}`, 
                monto: -montoEgreso, 
                fecha: new Date().toLocaleDateString() 
            });
            await guardarDatosUsuario(); // Guardamos tus datos

            // 4. ACTUALIZAR AL DESTINATARIO (EL OTRO)
            destinatarioData.saldo += montoEgreso;
            destinatarioData.movimientos.push({
                desc: `Transf. recibida de ${usuario.nombre}`,
                monto: montoEgreso,
                fecha: new Date().toLocaleDateString()
            });
            
            // Guardar cambios en la cuenta del destinatario
            await updateDoc(doc(db, "usuarios", destinatarioId), destinatarioData);

            mostrarToast('¡Transferencia enviada con éxito!', 'success');
            document.getElementById('op-monto-egreso').value = '';
            document.getElementById('op-destino').value = '';

        } catch (error) {
            console.error(error);
            mostrarToast('Error en la transferencia', 'error');
            // Nota: En un sistema bancario real aquí se haría un "rollback"
        }
    }
};

// --- OTRAS FUNCIONES (INVERSIONES, PRESTAMOS, ETC) ---

async function guardarDatosUsuario() {
    const userRef = doc(db, "usuarios", usuario.username);
    await updateDoc(userRef, usuario);
    actualizarUI();
}

window.actualizarUI = () => {
    if(!usuario) return;
    document.getElementById('nav-user').innerText = usuario.nombre;
    document.getElementById('nav-acc').innerText = 'Cta: ' + usuario.cuenta;
    document.getElementById('main-balance').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('display-acc-number').innerText = usuario.cuenta.replace(/(\d{4})(\d{4})(\d{2})/, "$1 $2 $3");
    
    const list = document.getElementById('activity-list');
    list.innerHTML = '';
    [...usuario.movimientos].reverse().forEach(mov => {
        const li = document.createElement('li');
        const colorClass = mov.monto > 0 ? 'monto-positivo' : 'monto-negativo';
        li.innerHTML = `<div><strong>${mov.desc}</strong><br><small style="color:#aaa">${mov.fecha}</small></div><div class="${colorClass}">$${Math.abs(mov.monto).toFixed(2)}</div>`;
        list.appendChild(li);
    });

    // Admin Stats
    document.getElementById('stat-saldo').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('stat-prestamos').innerText = `$${usuario.prestamos.toFixed(2)}`;
    const totalInv = usuario.inversiones.reduce((acc, curr) => acc + curr.monto, 0);
    document.getElementById('stat-inversiones').innerText = `$${totalInv.toFixed(2)}`;

    // Inversiones List
    const invList = document.getElementById('lista-inversiones');
    if(usuario.inversiones.length > 0) {
        invList.innerHTML = '';
        usuario.inversiones.forEach(inv => {
            invList.innerHTML += `<div class="glass-panel" style="padding:10px; margin-bottom:5px">PF: $${inv.monto} (${inv.meses}M)</div>`;
        });
        invList.classList.remove('empty-state');
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
        mostrarToast('Inversión creada', 'success');
    } else {
        mostrarToast('Saldo insuficiente', 'error');
    }
};

window.pedirPrestamo = async () => {
    const monto = parseFloat(document.getElementById('prestamo-monto').value);
    if(monto > 0) {
        usuario.saldo += monto;
        usuario.prestamos += monto;
        usuario.movimientos.push({ desc: 'Préstamo BEP', monto: monto, fecha: new Date().toLocaleDateString() });
        await guardarDatosUsuario();
        mostrarToast('Préstamo acreditado', 'success');
    }
};

window.calcularArqueo = () => {
    let total = 0;
    document.querySelectorAll('.bill-input').forEach(input => {
        total += (parseFloat(input.dataset.val) * (parseFloat(input.value) || 0));
    });
    document.getElementById('arqueo-total').innerText = `Total Físico: $${total.toFixed(2)}`;
};

window.copiarCuenta = () => {
    if(usuario) {
        navigator.clipboard.writeText(usuario.cuenta);
        mostrarToast('Copiado al portapapeles');
    }
};

function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = tipo === 'error' ? '#ef4444' : (tipo === 'success' ? '#10b981' : '#3b82f6');
    toast.innerText = mensaje;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Funciones obsoletas de importación (ya no se usan)
window.generarCodigoExportacion = () => {};
window.copiarCodigo = () => {};
window.importarDatos = () => {};