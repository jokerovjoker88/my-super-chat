const socket = io();
let me = "", target = "";

// Авторизация
function toggleAuth(reg) {
    document.getElementById('login-form').style.display = reg ? 'none' : 'flex';
    document.getElementById('reg-form').style.display = reg ? 'flex' : 'none';
}

function doLogin() {
    const nick = document.getElementById('l-nick').value;
    const pass = document.getElementById('l-pass').value;
    if(nick && pass) socket.emit('login', { nick, pass });
}

function doReg() {
    const nick = document.getElementById('r-nick').value;
    const email = document.getElementById('r-email').value;
    const pass = document.getElementById('r-pass').value;
    if(nick && email && pass) socket.emit('register', { nick, email, pass });
}

socket.on('auth_ok', d => {
    me = d.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = me;
    document.getElementById('my-avatar').src = d.avatar;
});

// ПОИСК (ИСПРАВЛЕНО)
function search() {
    const sInput = document.getElementById('u-search');
    if(sInput.value) {
        socket.emit('search_user', sInput.value);
        sInput.value = ''; // очистить после поиска
    }
}

socket.on('user_found', u => {
    openChat(u.username, u.avatar);
});

// ЧАТ
function openChat(name, avatar) {
    target = name;
    document.getElementById('no-chat').style.display = 'none';
    document.getElementById('chat-win').style.display = 'flex';
    document.getElementById('chat-with').innerText = name;
    document.getElementById('chat-avatar').src = avatar;
    
    socket.emit('load_chat', { me, him: name });
    
    // Добавление в список контактов слева, если еще нет
    if(!document.getElementById('c-' + name)) {
        const item = document.createElement('div');
        item.id = 'c-' + name;
        item.className = 'contact-item';
        item.innerHTML = `<img src="${avatar}" class="avatar-min"> <span>${name}</span>`;
        item.onclick = () => openChat(name, avatar);
        document.getElementById('contacts').appendChild(item);
    }
}

// ОТПРАВКА (ИСПРАВЛЕНО)
function send() {
    const input = document.getElementById('m-input');
    if(input.value.trim() !== "" && target !== "") {
        socket.emit('send_msg', { 
            from: me, 
            to: target, 
            content: input.value, 
            type: 'text' 
        });
        input.value = '';
    }
}

function upload(el) {
    const file = el.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = () => socket.emit('send_msg', { from: me, to: target, content: reader.result, type: 'image' });
        reader.readAsDataURL(file);
    }
}

// ПРИЕМ СООБЩЕНИЙ
socket.on('new_msg', d => {
    if(d.from === target || d.to === target || d.from === me) {
        renderMsg(d);
    }
});

socket.on('chat_history', h => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    h.forEach(renderMsg);
});

function renderMsg(m) {
    const box = document.getElementById('messages');
    const div = document.createElement('div');
    // Проверяем отправителя: если m.sender (из базы) или m.from (новое сообщение)
    const sender = m.sender || m.from;
    div.className = `msg-bubble ${sender === me ? 'me' : 'them'}`;
    
    let contentHtml = m.type === 'image' ? `<img src="${m.content}" class="chat-img">` : `<span>${m.content}</span>`;
    div.innerHTML = `${contentHtml}<small>${m.time || ''}</small>`;
    
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// Аватарка
function changeAvatar() {
    const url = prompt("Введите прямую ссылку на фото:");
    if(url) socket.emit('update_avatar', url);
}

socket.on('avatar_updated', url => {
    document.getElementById('my-avatar').src = url;
});

socket.on('auth_error', m => alert(m || "Ошибка"));
socket.on('auth_success', () => {
    alert("Регистрация успешна! Войдите.");
    toggleAuth(false);
});
