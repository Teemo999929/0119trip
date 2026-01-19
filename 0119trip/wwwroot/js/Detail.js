const currentUser = '小蘇';
let appState = {
    members: ['小蘇', '小一', '小二'],
    budget: 3000,
    splitMode: 'avg',
    editingId: null,
    pendingSettle: null,
    pendingUndoId: null,
    expenses: [
        { id: 1, date: '2026-01-19', name: '安平老街早餐', cat: '食物', total: 200, payer: { '小一': 200 }, parts: { '小蘇': 67, '小一': 67, '小二': 66 } },
        { id: 2, date: '2026-01-19', name: '香格里拉飯店', cat: '住宿', total: 2000, payer: { '小蘇': 2000 }, parts: { '小蘇': 666, '小一': 667, '小二': 667 } }
    ]
};

window.onload = () => { renderAll(); };

function renderAll() {
    renderGroupTab();
    renderPersonalTab();
    renderBalanceTab();
    updateTotalHeader();
}

function switchTab(tabName) {
    document.querySelectorAll('.content-area').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    const btnIndex = tabName === 'group' ? 0 : tabName === 'personal' ? 1 : 2;
    document.querySelectorAll('.tab-btn')[btnIndex].classList.add('active');
}

function renderGroupTab() {
    const container = document.getElementById('group-content');
    container.innerHTML = '';
    const groups = {};
    appState.expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 修改：過濾掉 '轉帳/結清'，不顯示在群組花費
    const visibleExpenses = appState.expenses.filter(ex => ex.cat !== '轉帳/結清');

    visibleExpenses.forEach(ex => {
        if (!groups[ex.date]) groups[ex.date] = [];
        groups[ex.date].push(ex);
    });

    Object.keys(groups).forEach(date => {
        const dateObj = new Date(date);
        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        container.innerHTML += `<div class="date-header">${dateStr}</div>`;

        groups[date].forEach(item => {
            let icon = 'fa-utensils';
            if (item.cat === '住宿') icon = 'fa-bed';
            if (item.cat === '交通') icon = 'fa-car';
            if (item.cat === '購物') icon = 'fa-bag-shopping';
            if (item.cat === '娛樂') icon = 'fa-gamepad';

            let payerNames = Object.keys(item.payer);
            let payerText = payerNames.length > 1 ? `${payerNames[0]} 等人` : payerNames[0];

            container.innerHTML += `
                        <div class="expense-item">
                            <div class="cat-icon"><i class="fa-solid ${icon}"></i></div>
                            <div class="exp-details">
                                <span class="exp-name">${item.name}</span>
                                <span class="exp-sub">${payerText} 付款</span>
                            </div>
                            <div class="exp-right">
                                <span class="exp-amount">NT$${item.total}</span>
                                <div class="exp-actions">
                                    <button class="action-icon-btn" onclick="editExpense(${item.id})"><i class="fa-solid fa-pen"></i></button>
                                    <button class="action-icon-btn delete" onclick="deleteExpense(${item.id})"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        </div>
                    `;
        });
    });
    if (visibleExpenses.length === 0) container.innerHTML = '<div style="text-align:center; color:#999; margin-top:50px;">目前沒有支出紀錄<br>點擊右上角 + 記一筆</div>';
}

function renderPersonalTab() {
    let myTotal = 0;
    const personalList = document.getElementById('personal-list');
    personalList.innerHTML = '';

    appState.expenses.forEach(ex => {
        if (ex.cat === '轉帳/結清') return;
        const myShare = ex.parts[currentUser] || 0;
        if (myShare > 0) {
            myTotal += myShare;
            personalList.innerHTML += `
                        <div class="expense-item">
                            <div class="exp-details">
                                <span class="exp-name">${ex.name}</span>
                                <span class="exp-sub">總額 $${ex.total}</span>
                            </div>
                            <div class="exp-amount" style="color:var(--text-dark);">
                                -$${myShare.toFixed(0)}
                            </div>
                        </div>
                    `;
        }
    });

    const percent = Math.min((myTotal / appState.budget) * 100, 100);
    document.getElementById('budget-bar').style.width = `${percent}%`;
    document.getElementById('budget-bar').style.backgroundColor = percent > 90 ? '#ff5252' : 'var(--primary-mint)';
    document.getElementById('budget-text').innerHTML = `<span style="color:var(--dark-mint)">$${myTotal.toFixed(0)}</span> <span style="color:#94a3b8; font-size:14px; font-weight:normal;">/ $${appState.budget}</span>`;
}

function calculateDebts() {
    let balances = {};
    appState.members.forEach(m => balances[m] = 0);
    appState.expenses.forEach(ex => {
        for (let p in ex.payer) { balances[p] += ex.payer[p]; }
        for (let m in ex.parts) { balances[m] -= ex.parts[m]; }
    });

    let debtors = [], creditors = [];
    for (const [member, amount] of Object.entries(balances)) {
        if (amount < -1) debtors.push({ member, amount });
        else if (amount > 1) creditors.push({ member, amount });
    }
    debtors.sort((a, b) => a.amount - b.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let transactions = [], i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        let debtor = debtors[i], creditor = creditors[j];
        let amount = Math.min(Math.abs(debtor.amount), creditor.amount);
        transactions.push({ from: debtor.member, to: creditor.member, amount: amount });
        debtor.amount += amount; creditor.amount -= amount;
        if (Math.abs(debtor.amount) < 1) i++;
        if (creditor.amount < 1) j++;
    }
    return transactions;
}

function renderBalanceTab() {
    const debtContainer = document.getElementById('balance-list');
    const settledContainer = document.getElementById('settled-list');

    const debts = calculateDebts();
    if (debts.length === 0) {
        debtContainer.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">目前無待結清項目</div>';
    } else {
        debtContainer.innerHTML = debts.map(d => `
                    <div class="debt-card" onclick="openSettleModal('${d.from}', '${d.to}', ${d.amount})">
                        <div class="debt-info">
                            ${d.from} <i class="fa-solid fa-arrow-right arrow-icon"></i> ${d.to}
                        </div>
                        <div class="debt-amount">
                            NT$${Math.round(d.amount)}
                        </div>
                    </div>
                `).join('');
    }

    const settledItems = appState.expenses.filter(ex => ex.cat === '轉帳/結清');
    if (settledItems.length === 0) {
        settledContainer.innerHTML = '<div style="text-align:center; color:#ccc; font-size:13px;">尚無結清紀錄</div>';
    } else {
        settledItems.sort((a, b) => b.id - a.id);
        settledContainer.innerHTML = settledItems.map(item => {
            const payer = Object.keys(item.payer)[0];
            const receiver = Object.keys(item.parts)[0];
            return `
                        <div class="settled-card" onclick="openUndoSettleModal(${item.id})">
                            <div class="settled-info">
                                ${payer} <i class="fa-solid fa-check" style="color:var(--dark-mint);"></i> ${receiver}
                                <span class="settled-badge">已結清</span>
                            </div>
                            <div class="settled-amount">
                                NT$${item.total}
                            </div>
                        </div>
                    `;
        }).join('');
    }
}

function openSettleModal(from, to, amount) {
    appState.pendingSettle = { from, to, amount: Math.round(amount) };
    document.getElementById('settle-desc').innerHTML = `<b>${from}</b> 需支付 <b>${to}</b>`;
    document.getElementById('settle-amount').innerText = `NT$${Math.round(amount)}`;
    const modal = document.getElementById('settleModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

function confirmSettle() {
    if (!appState.pendingSettle) return;
    const { from, to, amount } = appState.pendingSettle;
    const newExpense = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        name: '結清款項',
        cat: '轉帳/結清',
        total: amount,
        payer: { [from]: amount },
        parts: { [to]: amount }
    };
    appState.expenses.push(newExpense);
    closeModal('settleModal');
    renderAll();
}

function openUndoSettleModal(id) {
    appState.pendingUndoId = id;
    const modal = document.getElementById('undoSettleModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

function confirmUndoSettle() {
    if (!appState.pendingUndoId) return;
    appState.expenses = appState.expenses.filter(e => e.id !== appState.pendingUndoId);
    closeModal('undoSettleModal');
    renderAll();
}

function updateTotalHeader() {
    const total = appState.expenses.filter(ex => ex.cat !== '轉帳/結清').reduce((sum, item) => sum + item.total, 0);
    document.getElementById('header-total').innerText = total.toLocaleString();
}

function deleteExpense(id) {
    if (confirm("確定要刪除這筆支出嗎？")) {
        appState.expenses = appState.expenses.filter(e => e.id !== id);
        renderAll();
    }
}

function editExpense(id) {
    const item = appState.expenses.find(e => e.id === id);
    if (!item) return;
    openExpenseModal(true);
    appState.editingId = id;
    document.getElementById('m-date').value = item.date;
    document.getElementById('m-name').value = item.name;
    document.getElementById('m-cat').value = item.cat;
    document.querySelectorAll('.pay-amt').forEach(input => {
        const user = input.dataset.user;
        const amt = item.payer[user] || 0;
        input.value = amt > 0 ? amt : '';
        input.closest('.checkbox-row').querySelector('.pay-check').checked = (amt > 0);
    });
    updatePayTotal();
    changeSplitMode('custom');
    document.querySelectorAll('.part-amt').forEach(input => {
        const user = input.dataset.user;
        const amt = item.parts[user] || 0;
        input.value = amt;
        input.closest('.checkbox-row').querySelector('.part-check').checked = (amt > 0);
    });
    updateSplitTotal();
}

function openExpenseModal(isEdit = false) {
    const modal = document.getElementById('expenseModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    renderAddForm();
    if (isEdit) {
        document.getElementById('modal-title-text').innerText = "編輯支出";
        document.getElementById('modal-submit-btn').innerText = "確認修改";
    } else {
        document.getElementById('modal-title-text').innerText = "新增支出";
        document.getElementById('modal-submit-btn').innerText = "確認新增";
        appState.editingId = null;
        document.getElementById('m-date').value = new Date().toISOString().split('T')[0];
        changeSplitMode('avg');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

function renderAddForm() {
    const payerList = document.getElementById('m-payer-list');
    payerList.innerHTML = appState.members.map(m => `
                <div class="checkbox-row">
                    <input type="checkbox" class="pay-check" value="${m}" onchange="updatePayTotal()">
                    <span>${m}</span>
                    <input type="number" class="pay-amt form-control" data-user="${m}" placeholder="金額" style="margin-left:10px;" oninput="updatePayTotal()">
                </div>
            `).join('');
    const splitList = document.getElementById('m-split-list');
    splitList.innerHTML = appState.members.map(m => `
                <div class="checkbox-row">
                    <input type="checkbox" class="part-check" checked value="${m}" onchange="handlePartCheck()">
                    <span>${m}</span>
                    <input type="number" class="part-amt form-control" data-user="${m}" placeholder="0" style="margin-left:10px;" disabled oninput="updateSplitTotal()">
                </div>
            `).join('');
    document.getElementById('m-name').value = '';
    document.getElementById('pay-total-val').innerText = '0';
    document.getElementById('split-total-val').innerText = '0';
}

function updatePayTotal() {
    let total = 0;
    document.querySelectorAll('.pay-amt').forEach(input => {
        const row = input.closest('.checkbox-row');
        const checkbox = row.querySelector('.pay-check');
        const val = Number(input.value);
        if (val > 0 && !checkbox.checked) checkbox.checked = true;
        if (checkbox.checked) total += val;
    });
    document.getElementById('pay-total-val').innerText = total;
    if (appState.splitMode === 'avg') calcAverageSplit();
}

function changeSplitMode(mode) {
    appState.splitMode = mode;
    document.getElementById('mode-avg').classList.toggle('active', mode === 'avg');
    document.getElementById('mode-custom').classList.toggle('active', mode === 'custom');
    document.querySelectorAll('.part-amt').forEach(input => input.disabled = (mode === 'avg'));
    if (mode === 'avg') calcAverageSplit();
}

function handlePartCheck() {
    if (appState.splitMode === 'avg') calcAverageSplit(); else updateSplitTotal();
}

function calcAverageSplit() {
    if (appState.splitMode !== 'avg') return;
    const total = Number(document.getElementById('pay-total-val').innerText);
    const checkedBoxes = document.querySelectorAll('.part-check:checked');
    const count = checkedBoxes.length;
    const avg = count > 0 ? (total / count).toFixed(0) : 0;
    document.querySelectorAll('.part-amt').forEach(inp => inp.value = 0);
    checkedBoxes.forEach(box => {
        box.closest('.checkbox-row').querySelector('.part-amt').value = avg;
    });
    updateSplitTotal();
}

function updateSplitTotal() {
    let total = 0;
    document.querySelectorAll('.part-amt').forEach(input => {
        if (input.closest('.checkbox-row').querySelector('.part-check').checked) {
            total += Number(input.value) || 0;
        }
    });
    document.getElementById('split-total-val').innerText = total;
}

function editMyBudget() {
    const newB = prompt("請輸入新的預算金額：", appState.budget);
    if (newB && !isNaN(newB)) {
        appState.budget = Number(newB);
        renderPersonalTab();
    }
}

function saveExpense() {
    const date = document.getElementById('m-date').value;
    const name = document.getElementById('m-name').value;
    const totalPay = Number(document.getElementById('pay-total-val').innerText);
    const totalSplit = Number(document.getElementById('split-total-val').innerText);
    if (!name || totalPay <= 0) { alert('請填寫完整資訊'); return; }
    if (Math.abs(totalPay - totalSplit) > 5) { alert('付款總額與分攤總額不符！'); return; }

    let payers = {};
    document.querySelectorAll('.pay-amt').forEach(input => {
        const val = Number(input.value);
        if (val > 0 && input.closest('.checkbox-row').querySelector('.pay-check').checked) {
            payers[input.dataset.user] = val;
        }
    });

    let parts = {};
    document.querySelectorAll('.part-amt').forEach(input => {
        const val = Number(input.value);
        if (val > 0 && input.closest('.checkbox-row').querySelector('.part-check').checked) {
            parts[input.dataset.user] = val;
        }
    });

    const newExpense = {
        id: appState.editingId ? appState.editingId : Date.now(),
        date: date,
        name: name,
        cat: document.getElementById('m-cat').value,
        total: totalPay,
        payer: payers,
        parts: parts
    };

    if (appState.editingId) {
        const idx = appState.expenses.findIndex(e => e.id === appState.editingId);
        if (idx !== -1) appState.expenses[idx] = newExpense;
    } else {
        appState.expenses.push(newExpense);
    }

    closeModal('expenseModal');
    renderAll();
    switchTab('group');
}