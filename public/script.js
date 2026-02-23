const socket = io();
let me = "", target = "";

function toggleAuth(reg) {
    document.getElementById('login-form').style.display = reg ? 'none' : 'flex';
    document.getElementById('reg-form').style.display = reg ? 'flex' : 'none';
}

function doLogin() {
    socket.emit('login', { nick: document.getElementById('l-nick').value, pass: document.getElementById('l-pass').value });
}

function doReg() {
    socket.emit('register', { 
        nick: document.getElementById('r-nick').value, 
        email: document.getElementById('r-email').value, 
        pass: document.getElementById('r-pass').value 
    });
}

socket.on('auth_ok', d => {
    me = d.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = me;
    document.getElementById('my-avatar').src = d.avatar;
});

function search() { socket.emit('search_user', document.getElementById('u-search').value); }
socket.on('user_found', u => openChat(u.username, u.avatar));

function openChat(name, avatar) {
    target = name;
    document.getElementById('no-chat').style.display = 'none';
    document.getElementById('chat-win').style.display = 'flex';
    document.getElementById('chat-with').innerText = name;
    document.getElementById('chat-avatar').src = avatar;
    socket.emit('load_chat', { me, him: name });
    
    if(!document.getElementById('c-'+name)) {
        const item = document.createElement('div');
        item.id = 'c-'+name; item.className = 'contact-item';
        item.innerHTML = `<img src="${avatar}" class="avatar-min"> <span>${name}</span>`;
        item.onclick = () => openChat(name, avatar);
        document.getElementById('contacts').appendChild(item);
    }
}

function send() {
    const input = document.getElementById('m-input');
    if(input.value && target) {
        socket.emit('send_msg', { from: me, to: target, content: input.value, type: 'text' });
        input.value = '';
    }
}

function upload(el) {
    const file = el.files[0];
    const reader = new FileReader();
    reader.onload = () => socket.emit('send_msg', { from: me, to: target, content: reader.result, type: 'image' });
    reader.readAsDataURL(file);
}

socket.on('new_msg', d => { if(d.from === target || d.to === target) renderMsg(d); });
socket.on('chat_history', h => {
    document.getElementById('messages').innerHTML = '';
    h.forEach(renderMsg);
});

function renderMsg(m) {
    const box = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `msg-bubble ${m.sender === me ? 'me' : 'them'}`;
    let html = m.type === 'image' ? `<img src="${m.content}" class="chat-img">` : `<span>${m.content}</span>`;
    div.innerHTML = `${html}<small>${m.time || ''}</small>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function changeAvatar() {
    const url = prompt("Вставьте прямую ссылку на фото (например, из ВК или Pinterest):");
    if(url) socket.emit('update_avatar', url);
}

socket.on('avatar_updated', url => { document.getElementById('my-avatar').src = url; });
socket.on('auth_error', m => alert(m || "Ошибка"));
socket.on('auth_success', () => { alert("Успешно! Теперь войдите."); toggleAuth(false); });
