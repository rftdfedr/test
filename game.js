// game.js - весь JavaScript код вынесен в отдельный файл

// Флаг блокировки переподключения
let reconnectInProgress = new Set();

// Звуки - убраны заглушки, будут работать при наличии файлов
const ambientAudio = new Audio('sound/ambient.mp3');
const priemAudio = new Audio('sound/priem-obrabotra.mp3');
const radiooffAudio = new Audio('sound/radiooff.mp3');
const decryptAudio1 = new Audio('sound/random_dechifrator_1.mp3');
const decryptAudio2 = new Audio('sound/random_dechifrator_2.mp3');
const transitionAudio = new Audio('sound/transition.mp3');

// Устанавливаем громкость
ambientAudio.volume = 0.3;
priemAudio.volume = 0.5;
radiooffAudio.volume = 0.5;
decryptAudio1.volume = 0.5;
decryptAudio2.volume = 0.5;
transitionAudio.volume = 0.6;

// Данные сигналов (будут загружены из файлов)
let NORMAL_SIGNALS = [];
let CREEPY_SIGNALS = [];

// Радиотелескопы
const TELESCOPES = [
  {name: "РАТАН-600 (САО РАН)", status: "online", connection: "Хорошее"},
  {name: "РТ-70 (Пущино)", status: "online", connection: "Хорошее"},
  {name: "Радиотелескоп Звезда (Калязин)", status: "online", connection: "Хорошее"},
  {name: "Радиотелескоп Квазар-КВО (Крым)", status: "online", connection: "Хорошее"}
];

// Элементы
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const receiveBtn = document.getElementById('receive-btn');
const statusText = document.getElementById('status-text');
const binaryText = document.getElementById('binary-text');
const resultText = document.getElementById('result-text');
const telescopesBody = document.getElementById('telescopes-body');
const historyList = document.getElementById('history-list');
const deleteButton = document.getElementById('delete-button');
const loadingStatus = document.getElementById('loading-status');
const decryptBtn = document.getElementById('decrypt-btn');
const filterToggle = document.getElementById('filter-toggle');
const filterStatus = document.getElementById('filter-status');

// Элементы сцены стола
const deskScene = document.getElementById('desk-scene');
const paper = document.querySelector('.paper');
const paperContent = document.querySelector('.paper-content');
const flashlight = document.getElementById('flashlight');
const paperFlashlight = document.getElementById('paper-flashlight');
const deskHint = document.getElementById('desk-hint');
const transitionOverlay = document.getElementById('transition-overlay');
const toDeskBtn = document.getElementById('to-desk-btn');
const toComputerBtn = document.getElementById('to-computer-btn');

// История сигналов
let signalHistory = [];
let creepyActive = false;
let currentBinarySignal = '';
let currentResultSignal = '';
let currentDecryptAudio = null;

// Отслеживание использованных сигналов
let usedNormalSignals = new Set();
let usedCreepySignals = new Set();

// Флаг для отслеживания процесса расшифровки
let isDecrypting = false;

// Переменные для управления листком
let isDragging = false;
let startX, startY;
let initialX, initialY;

// Функция для определения времени суток
function getTimeOfDay() {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 6 && hours < 20 ? 'day' : 'night';
}

// Функция обновления освещения стола и бумаги
function updateDeskLighting() {
  const timeOfDay = getTimeOfDay();
  
  // Убираем все классы освещения
  deskScene.classList.remove('desk-daytime', 'desk-nighttime');
  paper.classList.remove('paper-dark');
  paperContent.classList.remove('paper-content-dark');
  deskHint.classList.remove('controls-hint-dark');
  
  if (timeOfDay === 'day') {
    // Дневное освещение
    deskScene.classList.add('desk-daytime');
    flashlight.style.display = 'none';
    paperFlashlight.style.display = 'none';
    deskHint.textContent = 'Перемещайте листок мышью • Редактируйте текст кликом • Нажмите ↑ для возврата к компьютеру';
  } else {
    // Ночное освещение - в 3 раза темнее
    deskScene.classList.add('desk-nighttime');
    flashlight.style.display = 'block';
    paperFlashlight.style.display = 'block';
    
    // Темный режим для бумаги
    paper.classList.add('paper-dark');
    paperContent.classList.add('paper-content-dark');
    deskHint.classList.add('controls-hint-dark');
    
    deskHint.textContent = 'Ночной режим • Фонарик следует за курсором • Нажмите ↑ для возврата к компьютеру';
  }
}

// Функция обновления позиции фонарика
function updateFlashlightPosition(e) {
  if (getTimeOfDay() === 'night' && deskScene.style.display === 'flex') {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    
    // Обновляем позицию фонарика для стола
    flashlight.style.setProperty('--mouse-x', `${x}%`);
    flashlight.style.setProperty('--mouse-y', `${y}%`);
    
    // Обновляем позицию фонарика для бумаги
    const paperRect = paper.getBoundingClientRect();
    const paperX = ((e.clientX - paperRect.left) / paperRect.width) * 100;
    const paperY = ((e.clientY - paperRect.top) / paperRect.height) * 100;
    
    paperFlashlight.style.setProperty('--mouse-x', `${paperX}%`);
    paperFlashlight.style.setProperty('--mouse-y', `${paperY}%`);
    
    // Синхронизируем позицию бумажного фонарика с бумагой
    paperFlashlight.style.left = paper.style.left;
    paperFlashlight.style.top = paper.style.top;
    paperFlashlight.style.width = paper.style.width;
    paperFlashlight.style.height = paper.style.height;
  }
}

// Функция для получения случайного неповторяющегося сигнала
function getRandomSignal(signalArray, usedSet) {
    // Если фильтр выключен, возвращаем любой случайный сигнал
    if (!filterToggle.checked) {
        return signalArray[Math.floor(Math.random() * signalArray.length)];
    }
    
    // Если все сигналы использованы, сбрасываем счётчик
    if (usedSet.size >= signalArray.length) {
        usedSet.clear();
    }
    
    let availableSignals = signalArray.filter((_, index) => !usedSet.has(index));
    
    if (availableSignals.length === 0) {
        // Если почему-то нет доступных сигналов, сбрасываем и используем любой
        usedSet.clear();
        availableSignals = [...signalArray];
    }
    
    const randomIndex = Math.floor(Math.random() * availableSignals.length);
    const signalIndex = signalArray.indexOf(availableSignals[randomIndex]);
    
    usedSet.add(signalIndex);
    return availableSignals[randomIndex];
}

// Функция загрузки файлов
async function loadSignals() {
  try {
    loadingStatus.textContent = 'Загрузка нормальных сигналов...';
    
    // Загрузка normal_signals.txt
    const normalResponse = await fetch('normal_signals.txt');
    if (!normalResponse.ok) throw new Error('Не удалось загрузить normal_signals.txt');
    const normalText = await normalResponse.text();
    NORMAL_SIGNALS = normalText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    loadingStatus.textContent = 'Загрузка аномальных сигналов...';
    
    // Загрузка creepy_signals.txt
    const creepyResponse = await fetch('creepy_signals.txt');
    if (!creepyResponse.ok) throw new Error('Не удалось загрузить creepy_signals.txt');
    const creepyText = await creepyResponse.text();
    CREEPY_SIGNALS = creepyText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Проверяем, что файлы не пустые
    if (NORMAL_SIGNALS.length === 0) throw new Error('Файл normal_signals.txt пуст');
    if (CREEPY_SIGNALS.length === 0) throw new Error('Файл creepy_signals.txt пуст');

    // Вместо информации о количестве сигналов просто очищаем статус загрузки
    loadingStatus.textContent = '';
    receiveBtn.disabled = false;
    receiveBtn.textContent = 'Принять сигнал';
    
    // Устанавливаем статус "Система готова к работе" в верхней консоли
    statusText.value = 'Система готова к работе.';
    
    console.log('Нормальные сигналы:', NORMAL_SIGNALS);
    console.log('Аномальные сигналы:', CREEPY_SIGNALS);

  } catch (error) {
    console.error('Ошибка загрузки сигналов:', error);
    loadingStatus.textContent = `Ошибка загрузки: ${error.message}`;
    loadingStatus.style.color = 'var(--creepy-red)';
    
    // Используем резервные данные если файлы не загрузились
    NORMAL_SIGNALS = ["Резервный нормальный сигнал: система работает в штатном режиме"];
    CREEPY_SIGNALS = ["Резервный аномальный сигнал: ОШИБКА СИСТЕМЫ"];
    receiveBtn.disabled = false;
    receiveBtn.textContent = 'Принять сигнал (резервный режим)';
    statusText.value = 'Система готова к работе. (резервный режим)';
  }
}

// Обработчик переключателя фильтра
filterToggle.addEventListener('change', function() {
    if (this.checked) {
        filterStatus.textContent = 'ВКЛ';
        filterStatus.classList.add('active');
        statusText.value = 'Фильтр активирован. Повторяющиеся частоты блокируются.';
    } else {
        filterStatus.textContent = 'ВЫКЛ';
        filterStatus.classList.remove('active');
        statusText.value = 'Фильтр деактивирован. Все частоты доступны.';
    }
});

// Эффект Залго (упрощённый)
function zalgo(text, intensity=5) {
  const zalgoChars = [
    '\u030d','\u030e','\u0304','\u0305','\u033f','\u0311','\u0306','\u0310',
    '\u0352','\u0357','\u0351','\u0307','\u0308','\u030a','\u0342','\u0343',
    '\u0344','\u034a','\u034b','\u034c','\u0303','\u0302','\u030c','\u0350',
    '\u0300','\u0301','\u030b','\u030f','\u0312','\u0313','\u0314','\u033d',
    '\u0309','\u0363','\u0364','\u0365','\u0366','\u0367','\u0368','\u0369',
    '\u036a','\u036b','\u036c','\u036d','\u036e','\u036f','\u033e','\u035b',
    '\u0346','\u031a'
  ];
  let result = '';
  for (let c of text) {
    result += c;
    if (/[a-zA-Z0-9:. ]/.test(c)) {
      let count = Math.floor(Math.random() * intensity);
      for (let i=0; i<count; i++) {
        result += zalgoChars[Math.floor(Math.random() * zalgoChars.length)];
      }
    }
  }
  return result;
}

// Переключение вкладок
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    tabContents.forEach(tc => {
      tc.style.display = (tc.id === target) ? 'flex' : 'none';
    });
  });
});

// Обновление значка на вкладке "Радиотелескопы"
function updateTelescopeTabBadge() {
  const tab = document.querySelector('.tab[data-tab="telescopes"]');
  const hasBroken = TELESCOPES.some(t => t.status === 'offline');
  if (hasBroken) {
    if (!tab.querySelector('.badge')) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '●';
      tab.appendChild(badge);
    }
  } else {
    const badge = tab.querySelector('.badge');
    if (badge) badge.remove();
  }
}

// Заполнение таблицы радиотелескопов
function renderTelescopes() {
  telescopesBody.innerHTML = '';
  TELESCOPES.forEach((t, i) => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = t.name;
    tr.appendChild(tdName);

    const tdStatus = document.createElement('td');
    tdStatus.textContent = t.status === 'online' ? 'Онлайн' : 'Оффлайн';
    tdStatus.className = t.status === 'online' ? 'status-online' : 'status-offline';
    tr.appendChild(tdStatus);

    const tdConn = document.createElement('td');
    tdConn.textContent = t.connection;
    tdConn.className = t.connection === 'Хорошее' ? 'connection-good' : 'connection-bad';
    tr.appendChild(tdConn);

    const tdAction = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Переподключить';
    btn.className = 'reconnect-btn';
    btn.disabled = t.status === 'online' || reconnectInProgress.has(i);
    btn.addEventListener('click', () => reconnectTelescope(i));
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);

    telescopesBody.appendChild(tr);
  });
  updateTelescopeTabBadge();
}

// Обновление статуса кнопки "Принять сигнал"
function updateReceiveButton() {
  const allOnline = TELESCOPES.every(t => t.status === 'online');
  const signalsLoaded = NORMAL_SIGNALS.length > 0 && CREEPY_SIGNALS.length > 0;
  receiveBtn.disabled = !allOnline || !signalsLoaded || isDecrypting;
}

// Анимация "загрузка" с точками
function animateStatusLoading(baseMessage, duration = 3000) {
  let dots = 0;
  statusText.value = baseMessage;
  return new Promise(resolve => {
    const interval = setInterval(() => {
      dots = (dots + 1) % 6;
      statusText.value = baseMessage + '.'.repeat(dots);
    }, 400);
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, duration);
  });
}

// Анимация текста по символам с задержкой (эффект печати)
function animateText(element, text, creepy = false) {
  return new Promise(resolve => {
    element.value = '';
    let i = 0;
    const lines = text.split('\\n'); // Разделяем по \n
    let currentLine = 0;
    let currentChar = 0;
    
    function step() {
      if (currentLine >= lines.length) {
        resolve();
        return;
      }
      
      if (currentChar < lines[currentLine].length) {
        // Добавляем символ к текущей строке
        element.value += lines[currentLine][currentChar];
        currentChar++;
      } else {
        // Переходим на новую строку
        element.value += '\n';
        currentLine++;
        currentChar = 0;
      }
      
      if (creepy) {
        element.style.color = 'var(--creepy-red)';
      } else {
        element.style.color = 'var(--soft-yellow)';
      }
      element.scrollTop = element.scrollHeight;
      
      setTimeout(step, 10); // Увеличил скорость для ASCII-артов
    }
    
    step();
  });
}

// Анимация бинарного сигнала с шумом (добавление случайных символов после битов)
function animateBinaryWithNoise(element, binaryStr) {
  return new Promise(resolve => {
    element.value = '';
    let i = 0;
    const noiseChars = ['|', '-', '~', '*'];
    function step() {
      if (i >= binaryStr.length) {
        resolve();
        return;
      }
      element.value += binaryStr[i];
      // С вероятностью 50% добавляем шум
      if (Math.random() < 0.5) {
        element.value += noiseChars[Math.floor(Math.random() * noiseChars.length)];
      }
      element.scrollTop = element.scrollHeight;
      i++;
      setTimeout(step, 30);
    }
    step();
  });
}

// Очистка бинарного кода от шумов
function cleanBinaryFromNoise(element, binaryStr) {
  return new Promise(resolve => {
    let i = 0;
    const cleanBinary = binaryStr.replace(/[^01]/g, ''); // Убираем все символы кроме 0 и 1
    
    function step() {
      if (i >= cleanBinary.length) {
        resolve();
        return;
      }
      // Заменяем текущий символ на чистый
      const currentText = element.value;
      const newText = cleanBinary.substring(0, i + 1);
      element.value = newText;
      element.scrollTop = element.scrollHeight;
      i++;
      setTimeout(step, 20);
    }
    step();
  });
}

// Анимация починки телескопа
function animateConnectionLoading(telescopeIndex) {
  const frames = [
    "░ ░ ░ ░",
    "▓ ░ ░ ░",
    "▓ ▓ ░ ░",
    "▓ ▓ ▓ ░",
    "▓ ▓ ▓ ▓"
  ];
  const telescope = TELESCOPES[telescopeIndex];
  let repeatCount = Math.floor(Math.random() * 3) + 1; // от 1 до 3 повторов
  let frameIndex = 0;
  let repeatsDone = 0;

  return new Promise(resolve => {
    function nextFrame() {
      telescope.connection = frames[frameIndex];
      renderTelescopes();
      frameIndex++;
      if (frameIndex >= frames.length) {
        frameIndex = 0;
        repeatsDone++;
      }
      if (repeatsDone < repeatCount) {
        setTimeout(nextFrame, 1000); // 1 секунда между кадрами
      } else {
        // Завершение анимации — восстановление соединения
        telescope.status = "online";
        telescope.connection = "Хорошее";
        renderTelescopes();
        updateReceiveButton();
        statusText.value = "Соединение восстановлено.";
        resolve();
      }
    }
    nextFrame();
  });
}

// Функция переподключения телескопа с блокировкой повторного запуска
async function reconnectTelescope(index) {
  if (reconnectInProgress.has(index)) return;
  reconnectInProgress.add(index);

  const telescope = TELESCOPES[index];
  if (telescope.status === "online") {
    reconnectInProgress.delete(index);
    return;
  }
  telescope.connection = "Переподключение...";
  renderTelescopes();
  updateReceiveButton();

  await animateConnectionLoading(index);

  reconnectInProgress.delete(index);
}

// Запуск ambient.mp3 при первом клике
let ambientStarted = false;
function startAmbient() {
  if (!ambientStarted) {
    ambientAudio.loop = true;
    ambientAudio.play().catch((e) => {
      console.log('Ambient audio error:', e);
    });
    ambientStarted = true;
  }
}

// Поломка случайного телескопа
function breakRandomTelescope() {
  const onlineTelescopes = TELESCOPES.filter(t => t.status === 'online');
  if (onlineTelescopes.length === 0) return;
  const broken = onlineTelescopes[Math.floor(Math.random() * onlineTelescopes.length)];
  broken.status = 'offline';
  broken.connection = 'Нет связи';
  renderTelescopes();
  updateReceiveButton(); // ДОБАВЛЕНО: обновляем состояние кнопки
  radiooffAudio.play().catch(e => console.log('Radio off audio error:', e));
}

// Процесс расшифровки сигнала
async function decryptSignal() {
  isDecrypting = true;
  updateReceiveButton();
  decryptBtn.disabled = true;
  
  // Выбираем случайный звук расшифровки
  currentDecryptAudio = Math.random() < 0.5 ? decryptAudio1 : decryptAudio2;
  currentDecryptAudio.play().catch(e => console.log('Decrypt audio error:', e));
  
  // Анимация точек во время очистки от шумов
  statusText.value = 'Очистка сигнала от шумов';
  await animateStatusLoading('Очистка сигнала от шумов', 2000);

  // Очищаем бинарный код от шумов
  await cleanBinaryFromNoise(binaryText, binaryText.value);

  // Анимация точек во время декодирования
  statusText.value = 'Декодирование сигнала';
  await animateStatusLoading('Декодирование сигнала', 2000);
  
  // Останавливаем звук расшифровки перед выводом результата
  currentDecryptAudio.pause();
  currentDecryptAudio.currentTime = 0;
  
  // Выводим результат
  await animateText(resultText, currentResultSignal, creepyActive);

  // Завершение расшифровки
  if (creepyActive) {
    statusText.value = 'Расшифровка завершена. Обнаружена аномалия.';
    breakRandomTelescope();
  } else {
    statusText.value = 'Расшифровка завершена.';
  }

  // Добавляем в историю
  addSignalToHistory(currentBinarySignal, currentResultSignal, creepyActive);
  
  // Обновляем состояние кнопок
  isDecrypting = false;
  updateReceiveButton();
}

// Приём сигнала
async function receiveSignal() {
  // В начале функции проверяем, все ли телескопы онлайн
  const allOnline = TELESCOPES.every(t => t.status === 'online');
  if (!allOnline) {
    statusText.value = 'Ошибка: не все телескопы онлайн';
    return;
  }

  // Проверяем, что сигналы загружены
  if (NORMAL_SIGNALS.length === 0 || CREEPY_SIGNALS.length === 0) {
    statusText.value = 'Ошибка: сигналы не загружены';
    return;
  }

  receiveBtn.disabled = true;
  decryptBtn.disabled = true;
  binaryText.value = '';
  resultText.value = '';
  statusText.value = '';

  priemAudio.play().catch(e => console.log('Priem audio error:', e));

  // Генерируем сигнал
  currentBinarySignal = Array.from({length: 100}, () => Math.random() < 0.5 ? '0' : '1').join('');
  
  creepyActive = Math.random() < 0.3;
  
  // Используем неповторяющиеся сигналы
  currentResultSignal = creepyActive
    ? getRandomSignal(CREEPY_SIGNALS, usedCreepySignals)
    : getRandomSignal(NORMAL_SIGNALS, usedNormalSignals);

  // Получение сигнала с шумом
  await Promise.all([
    animateStatusLoading('Получение сигнала'),
    animateBinaryWithNoise(binaryText, currentBinarySignal)
  ]);

  priemAudio.pause();

  // Активируем кнопку расшифровки
  statusText.value = 'Сигнал получен. Ожидание расшифровки.';
  decryptBtn.disabled = false;
  
  // Обновляем состояние кнопки приёма
  updateReceiveButton();
}

// История сигналов - кастомный список
function addSignalToHistory(binary, result, creepy) {
  const now = new Date();
  let dtStr = now.toLocaleDateString('ru-RU') + ' ' + now.toLocaleTimeString('ru-RU');
  if (creepy) {
    dtStr = zalgo(dtStr, 7);
  }
  const id = signalHistory.length + 1;
  signalHistory.push({id, datetime: dtStr, binary, result, creepy});
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  signalHistory.forEach(signal => {
    const div = document.createElement('div');
    div.className = 'option';
    div.textContent = `${signal.id}. ${signal.datetime}`;
    div.dataset.id = signal.id;
    div.addEventListener('click', () => {
      // Снимаем выделение со всех
      historyList.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
      // Выделяем текущий
      div.classList.add('selected');
      // Отображаем данные сигнала
      showSignal(signal.id);
    });
    historyList.appendChild(div);
  });
}

function showSignal(id) {
  const signal = signalHistory.find(s => s.id === id);
  if (!signal) return;
  statusText.value = 'Сигнал из истории.';
  binaryText.value = signal.binary;
  resultText.value = signal.result;
  decryptBtn.disabled = true; // Блокируем кнопку расшифровки при просмотре истории
  if (signal.creepy) {
    resultText.style.color = 'var(--creepy-red)';
  } else {
    resultText.style.color = 'var(--soft-yellow)';
  }
}

deleteButton.addEventListener('click', () => {
  const selected = historyList.querySelector('.option.selected');
  if (!selected) return;
  const selectedId = parseInt(selected.dataset.id);
  signalHistory = signalHistory.filter(s => s.id !== selectedId);
  // Перенумеруем id
  signalHistory.forEach((s, i) => s.id = i + 1);
  renderHistory();
  statusText.value = 'Система готова к работе.';
  binaryText.value = '';
  resultText.value = '';
  decryptBtn.disabled = true;
});

// Управление листком бумаги (2D перемещение)
function initPaperControls() {
  // Начальная позиция листка по центру
  paper.style.left = '50%';
  paper.style.top = '50%';
  paper.style.transform = 'translate(-50%, -50%)';
  
  // Синхронизируем позицию бумажного фонарика
  paperFlashlight.style.left = paper.style.left;
  paperFlashlight.style.top = paper.style.top;
  paperFlashlight.style.width = paper.style.width;
  paperFlashlight.style.height = paper.style.height;
  
  // Обработчики событий для перемещения
  paper.addEventListener('mousedown', startDrag);
  paper.addEventListener('touchstart', startDragTouch);
  
  document.addEventListener('mousemove', drag);
  document.addEventListener('touchmove', dragTouch);
  
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchend', stopDrag);
  
  // Включаем редактирование текста
  paperContent.setAttribute('contenteditable', 'true');
}

function startDrag(e) {
  if (e.target === paperContent) {
    // Если кликнули на текст, разрешаем редактирование
    return;
  }
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  initialX = parseInt(paper.style.left) || 0;
  initialY = parseInt(paper.style.top) || 0;
  paper.style.cursor = 'grabbing';
  e.preventDefault();
}

function startDragTouch(e) {
  isDragging = true;
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
  initialX = parseInt(paper.style.left) || 0;
  initialY = parseInt(paper.style.top) || 0;
  e.preventDefault();
}

function drag(e) {
  if (!isDragging) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  // Простое 2D перемещение
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  
  paper.style.left = `${initialX + deltaX}px`;
  paper.style.top = `${initialY + deltaY}px`;
  
  // Синхронизируем позицию бумажного фонарика
  paperFlashlight.style.left = paper.style.left;
  paperFlashlight.style.top = paper.style.top;
  
  e.preventDefault();
}

function dragTouch(e) {
  if (!isDragging) return;
  
  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;
  
  // Простое 2D перемещение
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  
  paper.style.left = `${initialX + deltaX}px`;
  paper.style.top = `${initialY + deltaY}px`;
  
  // Синхронизируем позицию бумажного фонарика
  paperFlashlight.style.left = paper.style.left;
  paperFlashlight.style.top = paper.style.top;
  
  e.preventDefault();
}

function stopDrag() {
  isDragging = false;
  paper.style.cursor = 'grab';
}

// Переходы между сценами
async function transitionToDesk() {
  // Останавливаем ambient звук
  ambientAudio.pause();
  
  // Сразу скрываем компьютер
  document.getElementById('left-panel').style.display = 'none';
  document.getElementById('right-panel').style.display = 'none';
  toDeskBtn.style.display = 'none';
  
  // Показываем оверлей перехода
  transitionOverlay.style.display = 'flex';
  transitionOverlay.textContent = 'ПЕРЕХОД К СТОЛУ...';
  transitionOverlay.classList.add('eye-close');
  
  // Воспроизводим звук перехода
  transitionAudio.play().catch(e => console.log('Transition audio error:', e));
  
  // Ждём завершения анимации
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Показываем сцену стола
  deskScene.style.display = 'flex';
  toComputerBtn.style.display = 'block';
  
  // Обновляем освещение при переходе
  updateDeskLighting();
  
  // Анимация открытия глаз
  transitionOverlay.textContent = '';
  transitionOverlay.classList.remove('eye-close');
  transitionOverlay.classList.add('eye-open');
  
  // Ждём завершения анимации
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Скрываем оверлей
  transitionOverlay.style.display = 'none';
  transitionOverlay.classList.remove('eye-open');
}

async function transitionToComputer() {
  // Показываем оверлей перехода
  transitionOverlay.style.display = 'flex';
  transitionOverlay.textContent = 'ВОЗВРАТ К КОМПЬЮТЕРУ...';
  transitionOverlay.classList.add('eye-close');
  
  // Воспроизводим звук перехода
  transitionAudio.play().catch(e => console.log('Transition audio error:', e));
  
  // Сразу скрываем стол
  deskScene.style.display = 'none';
  toComputerBtn.style.display = 'none';
  
  // Ждём завершения анимации
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Показываем основной интерфейс
  document.getElementById('left-panel').style.display = 'flex';
  document.getElementById('right-panel').style.display = 'flex';
  toDeskBtn.style.display = 'block';
  
  // Анимация открытия глаз
  transitionOverlay.textContent = '';
  transitionOverlay.classList.remove('eye-close');
  transitionOverlay.classList.add('eye-open');
  
  // Ждём завершения анимации
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Скрываем оверлей
  transitionOverlay.style.display = 'none';
  transitionOverlay.classList.remove('eye-open');
  
  // Возобновляем ambient звук
  if (ambientStarted) {
    ambientAudio.play().catch(e => console.log('Ambient audio error:', e));
  }
}

// Обработчики кнопок перехода
toDeskBtn.addEventListener('click', transitionToDesk);
toComputerBtn.addEventListener('click', transitionToComputer);

// Обработчики клавиш для переходов
document.addEventListener('keydown', (e) => {
  // Переход к столу с компьютера (стрелка вниз)
  if (e.key === 'ArrowDown' && deskScene.style.display === 'none') {
    transitionToDesk();
  }
  // Возврат к компьютеру со стола (стрелка вверх)
  else if (e.key === 'ArrowUp' && deskScene.style.display === 'flex') {
    transitionToComputer();
  }
});

// Инициализация при загрузке страницы
async function init() {
  renderTelescopes();
  updateReceiveButton();
  await loadSignals();
  updateReceiveButton();
  initPaperControls();
  
  // Скрываем кнопку возврата к компьютеру изначально
  toComputerBtn.style.display = 'none';
  
  // Обновляем освещение каждую минуту
  setInterval(updateDeskLighting, 60000);
  
  // Следим за движением мыши для фонарика
  document.addEventListener('mousemove', updateFlashlightPosition);
  
  // Изначальное обновление освещения
  updateDeskLighting();
}

// Обработчики событий
receiveBtn.addEventListener('click', () => {
  startAmbient();
  receiveSignal();
});

decryptBtn.addEventListener('click', () => {
  decryptSignal();
});

// Запускаем инициализацию при загрузке страницы
document.addEventListener('DOMContentLoaded', init);
