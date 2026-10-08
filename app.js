let rawData = [];
let currentMode = 'high'; // 'high' | 'junior' | 'teacher' | 'room'
let selectedItem = '';

const searchInput = document.getElementById('search-input');
const itemListEl = document.getElementById('item-list');

// 初始化
fetch('schedule.json?v=3')
  .then(res => res.json())
  .then(data => {
    rawData = data;
    updateStats();
    renderList();
  });

// 頁籤切換
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentMode = e.target.dataset.mode;
    selectedItem = '';
    searchInput.value = '';
    searchInput.placeholder = `搜尋${getModeLabel()}...`;

    renderList();
    renderSchedule();
  });
});

// 即時搜尋與點擊搜尋框監聽
searchInput.addEventListener('input', () => renderList());
searchInput.addEventListener('focus', () => renderList());

// 統計全校資料
function updateStats() {
  const teachers = new Set(rawData.map(d => d.teacher_name).filter(Boolean)).size;
  const classes = new Set(rawData.map(d => d.class_name).filter(Boolean)).size;
  document.getElementById('stats-info').innerText = `收錄 ${classes} 個班級・${teachers} 位教師`;
}

// 自然排序
function sortClassNames(classList) {
  return classList.sort((a, b) => {
    const matchA = a.match(/([JH]\d[A-Z0-9]+)/);
    const matchB = b.match(/([JH]\d[A-Z0-9]+)/);
    const codeA = matchA ? matchA[1] : a;
    const codeB = matchB ? matchB[1] : b;
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

// 取得當前模式的選項
function getOptions() {
  if (currentMode === 'high') {
    const set = new Set(rawData.filter(d => d.class_name && d.class_name.startsWith('高')).map(d => d.class_name));
    return sortClassNames(Array.from(set)).map(name => ({ label: name, value: name, code: '' }));
  } else if (currentMode === 'junior') {
    const set = new Set(rawData.filter(d => d.class_name && d.class_name.startsWith('國')).map(d => d.class_name));
    return sortClassNames(Array.from(set)).map(name => ({ label: name, value: name, code: '' }));
  } else if (currentMode === 'teacher') {
    const teacherMap = new Map();
    rawData.forEach(d => {
      if (d.teacher_name && !teacherMap.has(d.teacher_name)) {
        teacherMap.set(d.teacher_name, {
          name: d.teacher_name,
          code: d.teacher_code || '',
          order: d.teacher_order !== undefined ? d.teacher_order : null
        });
      }
    });

    // 排序邏輯：有 order 用 order，沒有 order 則按代碼 (code) 排序 (修復 T010001 掉到最後的問題)
    const sortedTeachers = Array.from(teacherMap.values()).sort((a, b) => {
      if (a.order !== null && b.order !== null) {
        return a.order - b.order;
      }
      if (a.code && b.code) {
        return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
      }
      return a.name.localeCompare(b.name, 'zh-TW');
    });

    return sortedTeachers.map(t => ({
      label: t.name,
      value: t.name,
      code: t.code
    }));
  } else if (currentMode === 'room') {
    const set = new Set(rawData.map(d => d.room).filter(Boolean));
    const sortedRooms = Array.from(set).sort();
    return sortedRooms.map(room => ({ label: room, value: room, code: '' }));
  }
  return [];
}

// 渲染選單清單 (直接顯示可滾動完整清單)
function renderList() {
  itemListEl.innerHTML = '';
  const options = getOptions();
  const keyword = searchInput.value.trim().toLowerCase();

  const filteredOptions = options.filter(opt => {
    const matchLabel = opt.label.toLowerCase().includes(keyword);
    const matchCode = opt.code ? opt.code.toLowerCase().includes(keyword) : false;
    return matchLabel || matchCode;
  });

  if (filteredOptions.length === 0) {
    itemListEl.innerHTML = `<li class="no-data">查無資料</li>`;
    return;
  }

  filteredOptions.forEach(opt => {
    const li = document.createElement('li');
    li.className = 'item-node';
    if (opt.value === selectedItem) li.classList.add('active');

    li.innerHTML = `
      <span class="item-name">${opt.label}</span>
      ${opt.code ? `<span class="item-code">${opt.code}</span>` : ''}
    `;

    li.addEventListener('click', () => {
      selectedItem = opt.value;
      document.querySelectorAll('.item-node').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
      renderSchedule();
    });

    itemListEl.appendChild(li);
  });

  // 自動平滑滾動到目前選中的項目
  const activeLi = itemListEl.querySelector('.item-node.active');
  if (activeLi) {
    activeLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function getModeLabel() {
  if (currentMode === 'high') return '高中班級';
  if (currentMode === 'junior') return '國中班級';
  if (currentMode === 'teacher') return '教師';
  if (currentMode === 'room') return '教室';
}

// 渲染課表
function renderSchedule() {
  const titleEl = document.getElementById('current-title');
  const tbody = document.getElementById('schedule-body');
  tbody.innerHTML = '';

  if (!selectedItem) {
    titleEl.innerText = '請選擇查詢項目';
    return;
  }

  titleEl.innerText = `${selectedItem} 的課表`;

  const filtered = rawData.filter(d => {
    if (currentMode === 'high' || currentMode === 'junior') return d.class_name === selectedItem;
    if (currentMode === 'teacher') return d.teacher_name === selectedItem;
    if (currentMode === 'room') return d.room === selectedItem;
  });

  for (let period = 1; period <= 8; period++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="col-period">${period}</td>`;

    for (let day = 1; day <= 5; day++) {
      const matches = filtered.filter(d => d.day === day && d.period === period);
      const td = document.createElement('td');

      if (matches.length > 0 && matches.some(m => m.subject)) {
        const subject = matches[0].subject;
        const room = matches.find(m => m.room)?.room || '';

        const teachers = Array.from(new Set(matches.map(m => m.teacher_name).filter(Boolean)));
        const classes = Array.from(new Set(matches.map(m => m.class_name).filter(Boolean)));

        let linksHtml = '';

        if (currentMode === 'high' || currentMode === 'junior') {
          const tLinks = teachers.map(t => `<span class="cell-link" onclick="jumpTo('teacher', '${t}')">${t}</span>`).join(' ');
          const rLink = room ? `<span class="cell-link" onclick="jumpTo('room', '${room}')">${room}</span>` : '';
          linksHtml = `<div class="cell-teachers">${tLinks} ${rLink}</div>`;
        } else if (currentMode === 'teacher') {
          const cLinks = classes.map(c => {
            const targetMode = c.startsWith('國') ? 'junior' : 'high';
            return `<span class="cell-link" onclick="jumpTo('${targetMode}', '${c}')">${c}</span>`;
          }).join(' ');
          const rLink = room ? `<span class="cell-link" onclick="jumpTo('room', '${room}')">${room}</span>` : '';
          linksHtml = `<div class="cell-teachers">${cLinks} ${rLink}</div>`;
        } else {
          const cLinks = classes.map(c => {
            const targetMode = c.startsWith('國') ? 'junior' : 'high';
            return `<span class="cell-link" onclick="jumpTo('${targetMode}', '${c}')">${c}</span>`;
          }).join(' ');
          const tLinks = teachers.map(t => `<span class="cell-link" onclick="jumpTo('teacher', '${t}')">${t}</span>`).join(' ');
          linksHtml = `<div class="cell-teachers">${cLinks} ${tLinks}</div>`;
        }

        td.innerHTML = `
          <div class="cell-box">
            <div class="cell-subject">${subject}</div>
            ${linksHtml}
          </div>
        `;
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// 課表內超連結跳轉連動
function jumpTo(mode, target) {
  currentMode = mode;
  selectedItem = target;
  
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });

  searchInput.value = '';
  renderList();
  renderSchedule();
}
