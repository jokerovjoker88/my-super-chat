const socket = io();
let currentEmail = "";

function show(id) {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('reg-form').style.display = 'none';
    document.getElementById('verify-form').style.display = 'none';
    document.getElementById(id).style.display = 'flex';
}

function eye(id, icon) {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}

function doReg() {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pass = document.getElementById('r-pass').value;
    if(!nick || !email || !pass) return alert("Заполни все поля!");
    currentEmail = email;
    socket.emit('register', { nick, email, pass });
}

function doVerify() {
    const code = document.getElementById('v-code').value.trim();
    socket.emit('verify_code', { email: currentEmail, code });
}

function doLogin() {
    const nick = document.getElementById('l-nick').value.trim();
    const pass = document.getElementById('l-pass').value;
    socket.emit('login', { nick, pass });
}

socket.on('code_sent', () => {
    alert("Код отправлен!");
    show('verify-form');
});

socket.on('auth_success', () => {
    alert("Успех! Теперь войдите.");
    show('login-form');
});

socket.on('auth_ok', (d) => {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('user').innerText = d.nick;
});

socket.on('auth_error', (m) => alert(m));
