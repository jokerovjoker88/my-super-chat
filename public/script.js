const socket = io();
let myNick = "";
let currentEmail = "";

// Функция глаза
function toggleEye(id, icon) {
    const input = document.getElementById(id);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    }
}

// Переключение форм
function showForm(id) {
    const forms = ['login-form', 'reg-form', 'verify-form'];
    forms.forEach(f => {
        const el = document.getElementById(f);
        if (el) el.style.display = (f === id) ? 'flex' : 'none';
    });
}

// РЕГИСТРАЦИЯ
document.getElementById('btn-do-reg').onclick = () => {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pass = document.getElementById('r-pass').value;

    if (!nick || !email || !pass) return alert("Заполните все поля!");

    currentEmail = email;
    socket.emit('register', { nick, email, pass });
};

socket.on('code_sent', () => {
    alert("Код отправлен на вашу почту!");
    showForm('verify-form');
});

// ПОДТВЕРЖДЕНИЕ
document.getElementById('btn-verify').onclick = () => {
    const code = document.getElementById('v-code').value.trim();
    if (!code) return alert("Введите код!");
    socket.emit('verify_code', { email: currentEmail, code });
};

// ВХОД
document.getElementById('btn-do-login').onclick = () => {
    const nick = document.getElementById('l-nick').value.trim();
    const pass = document.getElementById('l-pass').value;
    if (!nick || !pass) return alert("Введите логин и пароль!");
    socket.emit('login', { nick, pass });
};

socket.on('auth_ok', d => {
    myNick = d.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = myNick;
});

socket.on('auth_success', m => {
    alert(m);
    showForm('login-form');
});

socket.on('auth_error', m => alert(m));
