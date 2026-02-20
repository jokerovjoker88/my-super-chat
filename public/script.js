const socket = io();
let myNick = localStorage.getItem('tg_nick') || prompt("Ваш ник:");
localStorage.setItem('tg_nick', myNick);
document.getElementById('my-name').innerText = myNick;

let activeChat = null, typingTimeout, replyId = null, editId = null;
const sound = document.getElementById('notif-sound');

socket.emit('auth', myNick);
socket.on('auth_ok', d => { if(d?.avatar) document.getElementById('my-ava').src = d.avatar; });

const search = () => {
    const n = document.getElementById('user-search').value.trim();
    if(n && n !== myNick) socket.emit('search_user', n);
};
document.getElementById('search-btn').onclick = search;
socket.on('user_found', u => openChat(u.username));

function openChat(name) {
    activeChat = name;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('target-name').innerText = name;
    cancelReply();
    if(window.innerWidth <= 600) document.getElementById('sidebar').style.display = 'none';
    socket.emit('load_chat', { me: myNick, him: name });
}

document.getElementById('msg-input').oninput = () => socket.emit('typing', { to: activeChat, from: myNick });
socket.on('user_typing', ({ from }) => {
    if(from === activeChat) {
        const s = document.getElementById('target-status');
        s.innerText = 'печатает...';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => s.innerText = '', 2000);
    }
});

socket.on('new_msg', data => {
    if(data.from === activeChat || data.to === activeChat) {
        render(data.from, data.text, data.file, data.fileName, data.time, data.id, data.is_read, data.replyText);
        if(data.from !== myNick) socket.emit('load_chat', { me: myNick, him: activeChat });
    } else if(data.from !== myNick) sound.play().catch(()=>{});
    socket.emit('get_my_dialogs', myNick);
});

socket.on('chat_history', msgs => {
    const b = document.getElementById('messages'); b.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time, m.id, m.is_read, m.reply_text));
    b.scrollTop = b.scrollHeight;
});

function render(s, t, f, fn, time, id, isRead, replyText) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    d.id = `msg-${id}`;
    d.innerHTML = `
        <div class="bubble" onclick="showMenu(${id}, '${t}', '${s}')">
            ${replyText ? `<div class="reply-q">${replyText}</div>` : ''}
            ${f ? (f.startsWith('data:image') ? `<img src="${f}">` : `<a href="${f}" download="${fn}">📁 ${fn}</a>`) : ''}
            <span class="txt">${t || ''}</span>
            <div class="meta">${time} ${s===myNick ? `<i class="fa-solid fa-check${isRead?'-double':''} tick"></i>`:''}</div>
        </div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

function showMenu(id, txt, s) {
    const act = prompt("1-Ответить, 2-Удалить" + (s===myNick?", 3-Изменить":""));
    if(act==="1") { replyId=id; document.getElementById('reply-preview').style.display='flex'; document.getElementById('reply-text-preview').innerText=txt; }
    if(act==="2") socket.emit('delete_msg', {id, from:myNick, to:activeChat});
    if(act==="3" && s===myNick) { editId=id; document.getElementById('msg-input').value=txt; document.getElementById('msg-input').focus(); }
}

function cancelReply() { replyId=null; editId=null; document.getElementById('reply-preview').style.display='none'; }

async function send() {
    const i = document.getElementById('msg-input'), fI = document.getElementById('file-input');
    if(!i.value.trim() && !fI.files[0]) return;
    if(editId) {
        socket.emit('edit_msg', { id: editId, newText: i.value, from: myNick, to: activeChat });
        editId = null;
    } else {
        let f = fI.files[0] ? await toBase64(fI.files[0]) : null;
        socket.emit('send_msg', { from: myNick, to: activeChat, text: i.value, file: f, fileName: fI.files[0]?.name, replyToId: replyId });
    }
    i.value = ''; fI.value = ''; cancelReply();
}

socket.on('msg_edited', ({ id, newText }) => {
    const el = document.querySelector(`#msg-${id} .txt`);
    if(el) el.innerText = newText + " (изм.)";
});

socket.on('msg_deleted', ({ id }) => document.getElementById(`msg-${id}`)?.remove());
socket.on('messages_seen', () => socket.emit('load_chat', { me: myNick, him: activeChat }));

const toBase64 = f => new Promise(res => {
    const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result);
});

document.getElementById('send-btn').onclick = send;
document.getElementById('msg-input').onkeypress = e => { if(e.key==='Enter') send(); };
document.getElementById('back-btn').onclick = () => { document.getElementById('sidebar').style.display='flex'; document.getElementById('chat-box').style.display='none'; };
socket.on('dialogs_list', list => {
    const b = document.getElementById('dialogs'); b.innerHTML = '';
    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `dialog-item ${activeChat === d.partner ? 'active' : ''}`;
        el.innerHTML = `<div class="ava-wrap ${d.is_online?'on':''}"><img src="${d.avatar||'https://cdn-icons-png.flaticon.com/512/149/149071.png'}"></div>
            <div class="d-info"><b>${d.partner}</b>${d.unread > 0 ? `<span class="badge">${d.unread}</span>` : ''}</div>`;
        el.onclick = () => openChat(d.partner);
        b.appendChild(el);
    });
});
socket.on('status_update', () => socket.emit('get_my_dialogs', myNick));
