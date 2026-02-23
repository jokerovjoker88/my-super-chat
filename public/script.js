const socket = io();
let myNick = "";
let currentEmail = "";

// Показать/Скрыть пароль
function toggleEye(inputId, icon) {
    const el = document.getElementById(inputId);
    if (el.type === "password") {
        el.type = "text";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    } else {
        el.type = "password";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    }
}

// Переключение форм
function showForm(id) {
    ['login-form', 'reg-form', 'verify-form'].forEach(f => {
        document.getElementById(f).style.display = (f === id) ? 'flex' : 'none';
    });
}

// Регистрация
document.getElementById('btn-do-reg').onclick = () => {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pass = document.getElementById('r-pass').value;
    if(!nick || !email || !pass) return alert("Заполните всё!");
    currentEmail = email;
    socket.emit('register', { nick, email, pass });
};

socket.on('code_sent', () => showForm('verify-form'));

// Подтверждение
document.getElementById('btn-verify').onclick = () => {
    const code = document.getElementById('v-code').value.trim();
    socket.emit('verify_code', { email: currentEmail, code });
};

// Вход
document.getElementById('btn-do-login').onclick = () => {
    const nick = document.getElementById('l-nick').value.trim();
    const pass = document.getElementById('l-pass').value;
    socket.emit('login', { nick, pass });
};

socket.on('auth_ok', d => {
    myNick = d.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = myNick;
});

socket.on('auth_success', m => { alert(m); showForm('login-form'); });
socket.on('auth_error', m => alert(m));
