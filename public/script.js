const socket = io();
let me = "", myAvatar = "", target = "";

function showForm(id) {
    document.getElementById('login-form').style.display = id==='login-form'?'flex':'none';
    document.getElementById('reg-form').style.display = id==='reg-form'?'flex':'none';
}

function doReg() {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pass = document.getElementById('r-pass').value;
    socket.emit('register', { nick, email, pass });
}

function doLogin() {
    const nick = document.getElementById('l-nick').value.trim();
    const pass = document.getElementById('l-pass').value;
    socket.emit('login', { nick, pass });
}

socket.on('auth_ok', d => {
    me = d.nick; myAvatar = d.avatar;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = me;
    document.getElementById('my-avatar').src = myAvatar;
});

// ПОИСК
function search() {
    const n = document.getElementById('u-search').value.trim();
    if(n) socket.emit('search_user', n);
}

socket.on('user_found', u => openChat(u.username, u.avatar_url));

function openChat(name, avatar) {
    target = name;
    document.getElementById('no-chat').style.display = 'none';
    document.getElementById('chat-win').style.display = 'flex';
    document.getElementById('chat-with').innerText = name;
    document.getElementById('chat-avatar').src = avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    socket.emit('load_chat', { me, him: name });

    if(!document.getElementById('c-'+name)) {
        const d = document.createElement('div');
        d.id = 'c-'+name; d.className = 'contact';
        d.innerHTML = `<img src="${avatar}" class="avatar-min"> <span>${name}</span>`;
        d.onclick = () => openChat(name, avatar);
        document.getElementById('contacts').appendChild(d);
    }
}

// ОТПРАВКА ПО ENTER
function handleEnter(e) {
    if(e.key === 'Enter') send();
}

function send() {
    const i = document.getElementById('m-input');
    if(i.value.trim() && target) {
        socket.emit('send_msg', { from: me, to: target, text: i.value });
        i.value = '';
    }
}

socket.on('new_msg', d => {
    if(d.from === target || d.to === target) renderMsg(d);
});

socket.on('chat_history', h => {
    const b = document.getElementById('messages'); b.innerHTML = '';
    h.forEach(renderMsg);
});

function renderMsg(m) {
    const b = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `bubble ${m.sender === me ? 'me' : 'them'}`;
    
    // ГАЛОЧКИ: Одна (чек) - отправлено, Две (чек-дабл) - прочитано
    let ticks = '';
    if(m.sender === me) {
        ticks = m.is_read ? '<i class="fa-solid fa-check-double status-tick"></i>' : '<i class="fa-solid fa-check status-tick"></i>';
    }

    d.innerHTML = `<div class="msg-text">${m.content}</div>
                   <div class="msg-info">${m.time} ${ticks}</div>`;
    b.appendChild(d);
    b.scrollTop = b.scrollHeight;
}

socket.on('auth_error', m => alert(m));
socket.on('auth_success', m => { alert(m); showForm('login-form'); });
