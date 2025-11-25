// IMPORTAR FUNCIONES DE LA NUBE (FIREBASE)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE (Del Paso 2) ---
const firebaseConfig = {
    apiKey: "AIzaSyBpI16R6BI6gorLoW-I62RA09PJSUvuIY0",
  authDomain: "bancopeninsular.firebaseapp.com",
  projectId: "bancopeninsular",
  storageBucket: "bancopeninsular.firebasestorage.app",
  messagingSenderId: "218848309222",
  appId: "1:218848309222:web:603faf9cedb2c99caf7027"
};

// INICIALIZAR LA BASE DE DATOS
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ESTADO GLOBAL
let usuario = null;

// CARGA INICIAL
window.onload = function() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('es-EC', options);
};

// --- FUNCIONES QUE AHORA SON GLOBALES PARA EL HTML ---
// (Necesario porque al usar type="module", las funciones se vuelven privadas)
window.cerrarIntro = () => {
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('auth-screen').classList.remove('oculto');
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
    // Busca el elemento que disparó el evento (si existe)
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
};

// --- NUEVA LÓGICA DE REGISTRO EN LA NUBE ---
window.registrarUsuario = async () => {
    const nombre = document.getElementById('reg-nombre').value;
    const user = document.getElementById('reg-user').value; // Usaremos esto como ID único
    const pass = document.getElementById('reg-pass').value;

    if(!nombre || !user || !pass) return mostrarToast('Complete todos los campos', 'error');

    // Verificar si ya existe
    const docRef = doc(db, "usuarios", user);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        mostrarToast('El usuario ya existe. Intente otro.', 'error');
        return;
    }

    // Crear objeto usuario
    const nuevoUsuario = {
        nombre: nombre,
        username: user,
        password: pass, // Nota: En producción real, esto debería encriptarse
        cuenta: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        saldo: 50.00,
        movimientos: [{ desc: 'Apertura Cuenta BEP', monto: 50, fecha: new Date().toLocaleDateString() }],
        prestamos: 0,
        inversiones: []
    };

    try {
        // GUARDAR EN FIREBASE
        await setDoc(doc(db, "usuarios", user), nuevoUsuario);
        mostrarToast('¡Cuenta creada en la nube! Inicie sesión.', 'success');
        window.toggleAuth('login');
    } catch (e) {
        console.error("Error: ", e);
        mostrarToast('Error de conexión con base de datos', 'error');
    }
};

// --- NUEVA LÓGICA DE LOGIN DESDE LA NUBE ---
window.iniciarSesion = async () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if(!user || !pass) return mostrarToast('Ingrese usuario y contraseña', 'error');

    try {
        // BUSCAR EN FIREBASE
        const docRef = doc(db, "usuarios", user);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if(data.password === pass) {
                usuario = data; // Cargar datos en memoria
                document.getElementById('auth-screen').classList.add('oculto');
                document.getElementById('dashboard').classList.remove('oculto');
                actualizarUI();
                mostrarToast(`Bienvenido al BEP, ${data.nombre}`, 'success');
            } else {
                mostrarToast('Contraseña incorrecta', 'error');
            }
        } else {
            mostrarToast('Usuario no encontrado', 'error');
        }
    } catch (e) {
        mostrarToast('Error al conectar con el servidor', 'error');
    }
};

window.cerrarSesion = () => {
    usuario = null;
    document.getElementById('dashboard').classList.add('oculto');
    document.getElementById('auth-screen').classList.remove('oculto');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
};

// --- GUARDADO AUTOMÁTICO EN LA NUBE ---
async function guardarDatosEnNube() {
    if(!usuario) return;
    try {
        const userRef = doc(db, "usuarios", usuario.username);
        await updateDoc(userRef, usuario);
        actualizarUI();
        console.log("Datos sincronizados con la nube");
    } catch (e) {
        console.error("Error guardando datos: ", e);
        mostrarToast('Error al sincronizar transacción', 'error');
    }
}

// --- LÓGICA BANCARIA (ACTUALIZADA PARA USAR ASYNC) ---
function actualizarUI() {
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

    // Stats Admin
    document.getElementById('stat-saldo').innerText = `$${usuario.saldo.toFixed(2)}`;
    document.getElementById('stat-prestamos').innerText = `$${usuario.prestamos.toFixed(2)}`;
    const totalInv = usuario.inversiones.reduce((acc, curr) => acc + curr.monto, 0);
    document.getElementById('stat-inversiones').innerText = `$${totalInv.toFixed(2)}`;

    // Inversiones
    const invList = document.getElementById('lista-inversiones');
    if(usuario.inversiones.length > 0) {
        invList.innerHTML = '';
        usuario.inversiones.forEach(inv => {
            invList.innerHTML += `<div class="glass-panel" style="padding:10px; margin-bottom:5px">PF: $${inv.monto} (${inv.meses}M)</div>`;
        });
        invList.classList.remove('empty-state');
    }
}

window.operar = async (tipo) => {
    let monto = 0;
    let desc = '';
    let esIngreso = false;

    if(tipo === 'deposito') {
        monto = parseFloat(document.getElementById('op-monto-ingreso').value);
        desc = 'Depósito Ventanilla'; esIngreso = true;
    } else if (tipo === 'cheque') {
        monto = parseFloat(document.getElementById('op-monto-ingreso').value);
        desc = 'Depósito Cheque'; esIngreso = true;
    } else if (tipo === 'retiro') {
        monto = parseFloat(document.getElementById('op-monto-egreso').value);
        desc = 'Retiro ATM'; esIngreso = false;
    } else if (tipo === 'transferencia') {
        monto = parseFloat(document.getElementById('op-monto-egreso').value);
        const destino = document.getElementById('op-destino').value;
        if(!destino || destino.length < 5) return mostrarToast('Destino inválido', 'error');
        desc = `Transf. a ${destino}`; esIngreso = false;
    }

    if(isNaN(monto) || monto <= 0) return mostrarToast('Monto inválido', 'error');
    if(!esIngreso && monto > usuario.saldo) return mostrarToast('Fondos insuficientes', 'error');

    // Modificar estado local
    if(esIngreso) usuario.saldo += monto;
    else usuario.saldo -= monto;

    usuario.movimientos.push({ desc: desc, monto: esIngreso ? monto : -monto, fecha: new Date().toLocaleDateString() });

    // Sincronizar con DB
    await guardarDatosEnNube();
    
    mostrarToast('Operación exitosa', 'success');
    document.getElementById('op-monto-ingreso').value = '';
    document.getElementById('op-monto-egreso').value = '';
};

window.crearPlazoFijo = async () => {
    const monto = parseFloat(document.getElementById('pf-monto').value);
    const meses = document.getElementById('pf-tiempo').value;
    if(monto > 0 && monto <= usuario.saldo) {
        usuario.saldo -= monto;
        usuario.inversiones.push({ monto: monto, meses: meses });
        usuario.movimientos.push({ desc: `Plazo Fijo (${meses}M)`, monto: -monto, fecha: new Date().toLocaleDateString() });
        await guardarDatosEnNube();
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
        await guardarDatosEnNube();
        mostrarToast('Préstamo acreditado', 'success');
    }
};

// Herramientas locales (no requieren DB)
window.calcularArqueo = () => {
    let total = 0;
    document.querySelectorAll('.bill-input').forEach(input => {
        total += (parseFloat(input.dataset.val) * (parseFloat(input.value) || 0));
    });
    document.getElementById('arqueo-total').innerText = `Total Físico: $${total.toFixed(2)}`;
};

window.copiarCuenta = () => {
    navigator.clipboard.writeText(usuario.cuenta);
    mostrarToast('Copiado al portapapeles');
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

// Las funciones de importación/exportación ya no son necesarias 
// porque la base de datos centraliza todo, pero las dejamos vacías para que no de error.
window.generarCodigoExportacion = () => alert("Ya no es necesario. Tus datos están en la nube.");
window.copiarCodigo = () => {};
window.importarDatos = () => alert("Solo inicia sesión con tu usuario y contraseña.");