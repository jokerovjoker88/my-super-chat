const socket = io();
let myNick = localStorage.getItem('tg_nick');

// Проверка ника
if (!myNick) {
    myNick = prompt("Введите ваш Никнейм:");
    if (myNick) {
        localStorage.setItem('tg_nick', myNick);
    } else {
        myNick = "User" + Math.floor(Math.random() * 1000);
    }
}
document.getElementById('my-nick-display').innerText = myNick;

let activePartner = null;

// 1. Подключение и авторизация
socket.emit('auth', myNick);
socket.on('auth_ok', () => {
    console.log("Авторизация успешна");
    socket.emit('get_my_dialogs', myNick);
});

// 2. Поиск пользователя
const searchInput = document.getElementById('user-search');
searchInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
        const target = searchInput.value.trim();
        if (target && target !== myNick) {
            socket.emit('search_user', target);
        }
        searchInput.value = '';
    }
};

socket.on('user_found', (name) => {
    console.log("Пользователь найден:", name);
    openDialog(name);
});

socket.on('error_msg', (txt) => alert(txt));

// 3. Список диалогов (слева)
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

// 4. Открытие чата
function openDialog(name) {
    activePartner = name;
    document.getElementById('empty-state').style.display = 'none';
    const chatWin = document.getElementById('chat-window');
    chatWin.style.display = 'flex';
    document.getElementById('chat-with-name').innerText = name;
    
    // Загружаем историю
    socket.emit('load_chat', { me: myNick, him: name });
    // Обновляем список чатов, чтобы подсветить активный
    socket.emit('get_my_dialogs', myNick);
}

// 5. Загрузка истории
socket.on('chat_history', msgs => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name));
});

// 6. Получение нового сообщения
socket.on('new_msg', data => {
    // Если сообщение пришло в текущий открытый чат
    if ((data.from === activePartner && data.to === myNick) || 
        (data.from === myNick && data.to === activePartner)) {
        render(data.from, data.text, data.file, data.fileName);
    }
    // В любом случае обновляем список слева (чтобы видеть новые чаты)
    socket.emit('get_my_dialogs', myNick);
});

// 7. Функция отправки
async function send() {
    const inp = document.getElementById('msg-input');
    const fileInp = document.getElementById('file-input');
    const text = inp.value.trim();
    
    let fileData = null;
    let fileName = null;

    if (fileInp.files.length > 0) {
        const file = fileInp.files[0];
        fileData = await toBase64(file);
        fileName = file.name;
    }

    // Если есть что отправлять и выбран собеседник
    if ((text || fileData) && activePartner) {
        console.log("Отправка сообщения для:", activePartner);
        socket.emit('send_msg', {
            from: myNick,
            to: activePartner,
            text: text,
            file: fileData,
            fileName: fileName
        });
        
        // Очищаем поля
        inp.value = '';
        fileInp.value = '';
    }
}

// Вспомогательная функция для файлов
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// Слушатели кнопок
document.getElementById('send-btn').onclick = (e) => {
    e.preventDefault();
    send();
};

document.getElementById('msg-input').onkeypress = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        send();
    }
};

// Отображение сообщения на экране
function render(sender, text, file, fileName) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${sender === myNick ? 'me' : 'them'}`;
    
    let contentHtml = `<div class="bubble">`;
    
    // Если есть файл
    if (file) {
        if (file.startsWith('data:image')) {
            contentHtml += `<img src="${file}" class="chat-img" style="max-width:200px; border-radius:8px;"><br>`;
        } else {
            contentHtml += `<a href="${file}" download="${fileName}" class="file-link" style="color:#5085b1; display:block; margin-bottom:5px;">📁 ${fileName}</a>`;
        }
    }
    
    // Если есть текст
    if (text) {
        contentHtml += `<span>${text}</span>`;
    }
    
    contentHtml += `</div>`;
    d.innerHTML = contentHtml;
    
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}
