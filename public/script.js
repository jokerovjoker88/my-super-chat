const socket = io();
let myNick = localStorage.getItem('tg_nick');

if (!myNick) {
    myNick = prompt("Введите ваш Никнейм:");
    if (myNick) localStorage.setItem('tg_nick', myNick);
}
document.getElementById('my-nick-display').innerText = myNick;

let activePartner = null;

// Старт
socket.emit('auth', myNick);
socket.on('auth_ok', () => socket.emit('get_my_dialogs', myNick));

// Поиск
document.getElementById('user-search').onkeypress = (e) => {
    if (e.key === 'Enter') {
        socket.emit('search_user', e.target.value.trim());
        e.target.value = '';
    }
};

socket.on('user_found', (name) => {
    if (name === myNick) return;
    openDialog(name);
});

socket.on('error_msg', (txt) => alert(txt));

// Список диалогов
socket.on('dialogs_list', list => {
    const box = document.getElementById('dialogs');
    box.innerHTML = '';
    list.forEach(d => {
        const item = document.createElement('div');
        item.className = `dialog-item ${activePartner === d.partner ? 'active' : ''}`;
        item.innerHTML = `<div class="ava">${d.partner[0].toUpperCase()}</div> <span>${d.partner}</span>`;
        item.onclick = () => openDialog(d.partner);
        box.appendChild(item);
    });
});

function openDialog(name) {
    activePartner = name;
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('chat-window').style.display = 'flex';
    document.getElementById('chat-with-name').innerText = name;
    socket.emit('load_chat', { me: myNick, him: name });
    socket.emit('get_my_dialogs', myNick);
}

// Сообщения
socket.on('chat_history', msgs => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name));
});

socket.on('new_msg', data => {
    if (data.from === activePartner || data.to === activePartner) {
        render(data.from, data.text, data.file, data.fileName);
    }
    socket.emit('get_my_dialogs', myNick);
});

function render(s, t, file, fileName) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    
    let content = `<div class="bubble">`;
    if (file) {
        if (file.startsWith('data:image')) {
            content += `<img src="${file}" class="chat-img"><br>`;
        } else {
            content += `<a href="${file}" download="${fileName}" class="file-link"><i class="fa-solid fa-file"></i> ${fileName}</a><br>`;
        }
    }
    content += `<span>${t}</span></div>`;
    
    d.innerHTML = content;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

// Отправка
async function send() {
    const inp = document.getElementById('msg-input');
    const fileInp = document.getElementById('file-input');
    const file = fileInp.files[0];
    
    let fileData = null;
    if (file) {
        fileData = await toBase64(file);
    }

    if ((inp.value.trim() || fileData) && activePartner) {
        socket.emit('send_msg', {
            from: myNick,
            to: activePartner,
            text: inp.value.trim(),
            file: fileData,
            fileName: file ? file.name : null
        });
        inp.value = '';
        fileInp.value = '';
    }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

document.getElementById('send-btn').onclick = send;
document.getElementById('msg-input').onkeypress = (e) => { if(e.key === 'Enter') send(); };
