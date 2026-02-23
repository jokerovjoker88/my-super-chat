const socket = io();
let me = "", target = "", mediaRec, chunks = [];

function showForm(id) {
    document.getElementById('login-form').style.display = id==='login-form'?'flex':'none';
    document.getElementById('reg-form').style.display = id==='reg-form'?'flex':'none';
}

function doReg() {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pass = document.getElementById('r-pass').value;
    if(nick && email && pass) socket.emit('register', { nick, email, pass });
}

function doLogin() {
    const nick = document.getElementById('l-nick').value.trim();
    const pass = document.getElementById('l-pass').value;
    if(nick && pass) socket.emit('login', { nick, pass });
}

function changeAvatar() {
    const url = prompt("Введите прямую ссылку на фото:");
    if(url) socket.emit('update_avatar', url);
}

socket.on('avatar_updated', url => { document.getElementById('my-avatar').src = url; });

socket.on('auth_ok', d => {
    me = d.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = me;
    document.getElementById('my-avatar').src = d.avatar;
});

function search() {
    const n = document.getElementById('u-search').value.trim();
    if(n) socket.emit('search_user', n);
}

socket.on('user_found', u => openChat(u.username, u.avatar));

function openChat(name, avatar) {
    target = name;
    document.getElementById('no-chat').style.display = 'none';
    document.getElementById('chat-win').style.display = 'flex';
    document.getElementById('chat-with').innerText = name;
    document.getElementById('chat-avatar').src = avatar;
    socket.emit('load_chat', { me, him: name });

    if(!document.getElementById('c-'+name)) {
        const d = document.createElement('div');
        d.id = 'c-'+name; d.className = 'contact-item';
        d.innerHTML = `<img src="${avatar}" class="avatar-min"> <span>${name}</span>`;
        d.onclick = () => openChat(name, avatar);
        document.getElementById('contacts').appendChild(d);
    }
}

function send() {
    const i = document.getElementById('m-input');
    if(i.value.trim() && target) {
        socket.emit('send_msg', { from: me, to: target, content: i.value, type: 'text' });
        i.value = '';
    }
}

function uploadMedia(el) {
    const file = el.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const type = file.type.startsWith('image') ? 'image' : 'file';
        socket.emit('send_msg', { from: me, to: target, content: reader.result, type: type });
    };
    reader.readAsDataURL(file);
}

async function startVoice() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRec = new MediaRecorder(stream);
        chunks = [];
        mediaRec.ondataavailable = e => chunks.push(e.data);
        mediaRec.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/ogg' });
            const r = new FileReader();
            r.onload = () => socket.emit('send_msg', { from: me, to: target, content: r.result, type: 'audio' });
            r.readAsDataURL(blob);
        };
        mediaRec.start();
        document.getElementById('mic-btn').style.color = 'red';
    } catch(e) { alert("Доступ к микрофону запрещен"); }
}

function stopVoice() { if(mediaRec) mediaRec.stop(); document.getElementById('mic-btn').style.color = '#40a7e3'; }

socket.on('new_msg', d => { if(d.from === target || d.to === target) renderMsg(d); });
socket.on('chat_history', h => { document.getElementById('messages').innerHTML = ''; h.forEach(renderMsg); });

function renderMsg(m) {
    const b = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-bubble ${m.sender === me ? 'me' : 'them'}`;
    let body = '';
    const content = m.content || m.text;
    if(m.type === 'image') body = `<img src="${content}" class="chat-img" onclick="window.open(this.src)">`;
    else if(m.type === 'audio') body = `<audio src="${content}" controls></audio>`;
    else body = `<span>${content}</span>`;
    const tick = m.sender === me ? (m.is_read ? ' <i class="fa-solid fa-check-double" style="color:#40a7e3"></i>' : ' <i class="fa-solid fa-check"></i>') : '';
    d.innerHTML = `${body}<small>${m.time || ''}${tick}</small>`;
    b.appendChild(d);
    b.scrollTop = b.scrollHeight;
}

socket.on('auth_error', m => alert(m));
socket.on('auth_success', m => { alert(m); showForm('login-form'); });
