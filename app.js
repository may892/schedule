let rawData = [];
let currentMode = 'high'; // 'high' | 'junior' | 'teacher' | 'room'
let selectedItem = '';

const inputEl = document.getElementById('item-search');
const datalistEl = document.getElementById('item-options');

// 初始化
fetch('schedule.json?v=3')
  .then(res => res.json())
  .then(data => {
    rawData = data;
    updateStats();
    populateSelect();
  });

// 頁籤切換
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentMode = e.target.dataset.mode;
    selectedItem = '';
    inputEl.value = '';
    inputEl.placeholder = `-- 請搜尋或選擇 ${getModeLabel()} --`;
    populateSelect();
    renderSchedule();
  });
});

// 輸入或選擇變更事件
inputEl.addEventListener('input', (e) => {
  const val = e.target.value;
  const options = getOptions();
  
  // 檢查輸入值是否匹配選項（支援選單點選，或輸入名稱/代碼匹配）
  const match = options.find(opt => opt.value === val || opt.label === val || (opt.code && val.includes(opt.code)));
  
  if (match) {
    selectedItem = match.value;
    renderSchedule();
  } else if (val === '') {
    selectedItem = '';
    renderSchedule();
  }
});

// 點擊清空輸入框方便重新搜尋
inputEl.addEventListener('focus', () => {
  inputEl.value = '';
});

// 統計全校資料
function updateStats() {
  const teachers = new Set(rawData.map(d => d.teacher_name).filter(Boolean)).size;
  const classes = new Set(rawData.map(d => d.class_name).filter(Boolean)).size;
  document.getElementById('stats-info').innerText = `收錄 ${classes} 個班級・${teachers} 位教師`;
}

// 班級自然排序
function sortClassNames(classList) {
  return classList.sort((a, b) => {
    const matchA = a.match(/([JH]\d[A-Z0-9]+)/);
    const matchB = b.match(/([JH]\d[A-Z0-9]+)/);
    const codeA = matchA ? matchA[1] : a;
    const codeB = matchB ? matchB[1] : b;
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

// 取得當前 Mode 下的選項清單
function getOptions() {
  if (currentMode === 'high') {
    const set = new Set(rawData.filter(d => d.class_name && d.class_name.startsWith('高')).map(d => d.class_name));
    return sortClassNames(Array.from(set)).map(name => ({ label: name, value: name }));
  } else if (currentMode === 'junior') {
    const set = new Set(rawData.filter(d => d.class_name && d.class_name.startsWith('國')).map(d => d.class_name));
    return sortClassNames(Array.from(set)).map(name => ({ label: name, value: name }));
  } else if (currentMode === 'teacher') {
    const teacherMap = new Map();
    rawData.forEach(d => {
      if (d.teacher_name && !teacherMap.has(d.teacher_name)) {
        teacherMap.set(d.teacher_name, {
          name: d.teacher_name,
          code: d.teacher_code || '',
          order: d.teacher_order || 999
        });
      }
    });

    const sortedTeachers = Array.from(teacherMap.values()).sort((a, b) => a.order - b.order);
    return sortedTeachers.map(t => ({
      label: `${t.name} ${t.code ? '(' + t.code + ')' : ''}`,
      value: t.name,
      code: t.code
    }));
  } else if (currentMode === 'room') {
    const set = new Set(rawData.map(d => d.room).filter(Boolean));
    const sortedRooms = Array.from(set).sort();
    return sortedRooms.map(room => ({ label: room, value: room }));
  }
  return [];
}

// 填入下拉搜尋清單
function populateSelect() {
  datalistEl.innerHTML = '';
  const options = getOptions();

  options.forEach(opt => {
    const optionEl = document.createElement('option');
    optionEl.value = opt.value;
    optionEl.label = opt.label;
    datalistEl.appendChild(optionEl);
  });
}

function getModeLabel() {
  if (currentMode === 'high') return '高中班級';
  if (currentMode === 'junior') return '國中班級';
  if (currentMode === 'teacher') return '教師';
  if (currentMode === 'room') return '教室';
}

// 渲染課表表格
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
    tr.innerHTML = `<td class="col-period">第 ${period} 節</td>`;

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

// 點擊課表內連結跳轉
function jumpTo(mode, target) {
  currentMode = mode;
  selectedItem = target;
  
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });

  inputEl.value = target;
  populateSelect();
  renderSchedule();
}
