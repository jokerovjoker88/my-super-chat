const socket = io();

// Показать/скрыть пароль
function togglePass(inputId, icon) {
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
    document.getElementById('login-form').style.display = (id === 'login-form') ? 'flex' : 'none';
    document.getElementById('reg-form').style.display = (id === 'reg-form') ? 'flex' : 'none';
}

// Функция регистрации
function doReg() {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pass = document.getElementById('r-pass').value;

    if (!nick || !email || !pass) return alert("Заполните все поля!");
    
    console.log("Отправка данных регистрации...");
    socket.emit('register', { nick, email, pass });
}

// Функция входа
function doLogin() {
    const nick = document.getElementById('l-nick').value.trim();
    const pass = document.getElementById('l-pass').value;

    if (!nick || !pass) return alert("Введите данные для входа!");
    socket.emit('login', { nick, pass });
}

// Слушатели ответов сервера
socket.on('auth_success', (msg) => {
    alert(msg);
    showForm('login-form');
});

socket.on('auth_ok', (data) => {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = data.nick;
});

socket.on('auth_error', (msg) => alert(msg));
