const API_BASE = '/api/finance';
let financeData = { wallets: [], transactions: [], categories: { income: [], expense: [] } };
let isPrivacyMode = localStorage.getItem('financePrivacy') === 'true';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    applyPrivacyMode();
    fetchData();

    // Privacy toggle
    const privacyBtn = document.getElementById('privacy-toggle');
    privacyBtn.addEventListener('click', togglePrivacy);

    // Form submissions
    document.getElementById('walletForm').addEventListener('submit', handleWalletSubmit);
    document.getElementById('transForm').addEventListener('submit', handleTransSubmit);
    document.getElementById('transferForm').addEventListener('submit', handleTransferSubmit);
});

async function handleTransferSubmit(e) {
    e.preventDefault();
    const fromWalletId = document.getElementById('transferFrom').value;
    const toWalletId = document.getElementById('transferTo').value;
    const amount = document.getElementById('transferAmount').value;
    const note = document.getElementById('transferNote').value;

    if (fromWalletId === toWalletId) {
        alert('Vui lòng chọn hai ví khác nhau');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromWalletId, toWalletId, amount, note })
        });
        if (res.ok) {
            closeModal('transferModal');
            e.target.reset();
            fetchData();
        } else {
            const err = await res.json();
            alert(err.error || 'Có lỗi xảy ra khi thực hiện chuyển tiền');
        }
    } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra khi thực hiện chuyển tiền');
    }
}

function openTransferModal() {
    const fromSelect = document.getElementById('transferFrom');
    const toSelect = document.getElementById('transferTo');

    const options = financeData.wallets.map(w =>
        `<option value="${w.id}">${w.name} (${formatCurrency(w.balance)})</option>`
    ).join('');

    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;

    openModal('transferModal');
}

function togglePrivacy() {
    isPrivacyMode = !isPrivacyMode;
    localStorage.setItem('financePrivacy', isPrivacyMode);
    applyPrivacyMode();
}

function applyPrivacyMode() {
    const privacyBtn = document.getElementById('privacy-toggle');
    if (privacyBtn) {
        privacyBtn.textContent = isPrivacyMode ? '🙈' : '👁️';
    }
    document.body.classList.toggle('privacy-mode', isPrivacyMode);
}

async function fetchData() {
    try {
        const res = await fetch(API_BASE);
        financeData = await res.json();
        renderSummary();
        renderWallets();
        renderFilterOptions();
        renderTransactions();
    } catch (err) {
        console.error('Failed to fetch finance data:', err);
    }
}

function handleTypeFilterChange() {
    renderFilterOptions();
    renderTransactions();
}

function renderFilterOptions() {
    const catSelect = document.getElementById('filter-category');
    const typeFilter = document.getElementById('filter-type').value;

    let categories = [];
    if (typeFilter === 'income') {
        categories = financeData.categories.income;
    } else if (typeFilter === 'expense') {
        categories = financeData.categories.expense;
    } else if (typeFilter === 'transfer') {
        categories = ['Chuyển tiền'];
    } else {
        // Build a sorted unique list of all categories + "Chuyển tiền"
        // But maintain system order for income then expense then others
        categories = [...financeData.categories.income, ...financeData.categories.expense, 'Chuyển tiền'];
        categories = [...new Set(categories)]; // Unique
    }

    const currentVal = catSelect.value;
    catSelect.innerHTML = '<option value="all">Tất cả danh mục</option>' +
        categories.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function renderSummary() {
    const totalBalanceEl = document.getElementById('total-balance');
    const monthlyIncomeEl = document.getElementById('monthly-income');
    const monthlyExpenseEl = document.getElementById('monthly-expense');

    const total = financeData.wallets.reduce((sum, w) => sum + w.balance, 0);
    totalBalanceEl.textContent = formatCurrency(total);

    // Filter transactions for current month and exclude transfers
    const now = new Date();
    const currentMonthTransactions = financeData.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear() &&
            !t.isTransfer;
    });

    const income = currentMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const expense = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    monthlyIncomeEl.textContent = formatCurrency(income);
    monthlyExpenseEl.textContent = formatCurrency(expense);
}

function renderWallets() {
    const grid = document.getElementById('wallet-grid');
    grid.innerHTML = '';

    if (financeData.wallets.length === 0) {
        grid.innerHTML = '<p style="color: #888; grid-column: 1/-1;">Chưa có nguồn tiền nào. Hãy thêm ví mới!</p>';
        return;
    }

    financeData.wallets.forEach(w => {
        const card = document.createElement('div');
        card.className = 'wallet-card';
        card.style.borderLeftColor = w.color;
        card.innerHTML = `
            <div class="name">${w.icon} ${w.name}</div>
            <div class="balance privacy-masked">${formatCurrency(w.balance)}</div>
        `;
        grid.appendChild(card);
    });
}

function renderTransactions() {
    const list = document.getElementById('transaction-list');
    const typeFilter = document.getElementById('filter-type').value;
    const catFilter = document.getElementById('filter-category').value;

    list.innerHTML = '';

    let filtered = financeData.transactions;

    if (typeFilter !== 'all') {
        if (typeFilter === 'transfer') {
            filtered = filtered.filter(t => t.isTransfer);
        } else {
            filtered = filtered.filter(t => t.type === typeFilter && !t.isTransfer);
        }
    }

    if (catFilter !== 'all') {
        filtered = filtered.filter(t => t.category === catFilter);
    }

    if (filtered.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Không tìm thấy giao dịch nào.</div>';
        return;
    }

    // If filtering, show more results (up to 100)
    const limit = (typeFilter === 'all' && catFilter === 'all') ? 20 : 100;

    filtered.slice(0, limit).forEach(t => {
        const date = new Date(t.date);
        const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' +
            date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        const item = document.createElement('div');
        item.className = 'transaction-item';

        // Specific styling for transfers
        const displayType = t.isTransfer ? 'transfer' : t.type;
        const colorClass = t.isTransfer ? '' : (t.type === 'income' ? 't-income' : 't-expense');
        const prefix = t.isTransfer ? '⇅' : (t.type === 'income' ? '+' : '-');

        item.innerHTML = `
            <div class="t-info">
                <span class="t-cat">${t.category}</span>
                <span class="t-details">${dateStr} • ${t.walletName}${t.note ? ' • ' + t.note : ''}</span>
            </div>
            <div class="t-amount ${colorClass} privacy-masked">
                ${prefix} ${formatCurrency(t.amount).replace('₫', '').trim()}
            </div>
            <div class="t-actions" style="margin-left: 15px; display: flex; gap: 5px;">
                <button onclick="openEditModal('${t.id}')" style="padding: 5px; background: transparent; color: var(--text-secondary); border: 1px solid var(--border-color);" title="Sửa">✏️</button>
                <button onclick="deleteTransaction('${t.id}')" style="padding: 5px; background: transparent; color: #e74c3c; border: 1px solid var(--border-color);" title="Xóa">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Modal handling
function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function openTransactionModal(type) {
    const walletSelect = document.getElementById('transWallet');
    const catSelect = document.getElementById('transCategory');
    const title = document.getElementById('transModalTitle');
    const btn = document.getElementById('transSubmitBtn');

    // Reset edit state
    document.getElementById('transEditId').value = '';
    document.getElementById('transSubmitBtn').textContent = 'Lưu giao dịch';

    document.getElementById('transType').value = type;
    title.textContent = type === 'income' ? 'Nhận tiền' : 'Chi tiền';
    btn.className = type === 'income' ? 'btn-income' : 'btn-expense';

    // Populate wallets
    walletSelect.innerHTML = financeData.wallets.map(w =>
        `<option value="${w.id}">${w.name} (${formatCurrency(w.balance)})</option>`
    ).join('');

    // Populate categories
    catSelect.innerHTML = financeData.categories[type].map(c =>
        `<option value="${c}">${c}</option>`
    ).join('');

    openModal('transactionModal');
}

async function handleWalletSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('walletName').value;
    const balance = document.getElementById('walletBalance').value;

    try {
        const res = await fetch(`${API_BASE}/wallets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, balance })
        });
        if (res.ok) {
            closeModal('walletModal');
            e.target.reset();
            fetchData();
        }
    } catch (err) {
        alert('Có lỗi xảy ra khi thêm ví');
    }
}

async function handleTransSubmit(e) {
    e.preventDefault();
    const walletId = document.getElementById('transWallet').value;
    const type = document.getElementById('transType').value;
    const amount = document.getElementById('transAmount').value;
    const category = document.getElementById('transCategory').value;
    const note = document.getElementById('transNote').value;
    const editId = document.getElementById('transEditId').value;

    const body = { walletId, type, amount, category, note };

    // If editing, use PUT
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API_BASE}/transactions/${editId}` : `${API_BASE}/transactions`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            closeModal('transactionModal');
            e.target.reset();
            fetchData();
        } else {
            const err = await res.json();
            alert(err.error || 'Có lỗi xảy ra');
        }
    } catch (err) {
        alert('Có lỗi xảy ra khi lưu giao dịch');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Bạn có chắc muốn xóa giao dịch này? Nếu là chuyển khoản, cả hai giao dịch liên quan sẽ bị xóa.')) return;
    try {
        const res = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            fetchData();
        } else {
            alert('Có lỗi xảy ra khi xóa');
        }
    } catch (err) {
        alert('Có lỗi xảy ra');
    }
}

function openEditModal(id) {
    const t = financeData.transactions.find(x => x.id === id);
    if (!t) return;

    openTransactionModal(t.type);

    // Fill data
    document.getElementById('transEditId').value = t.id;
    document.getElementById('transWallet').value = t.walletId;
    document.getElementById('transAmount').value = t.amount;
    document.getElementById('transCategory').value = t.category;
    document.getElementById('transNote').value = t.note;

    // Change Title/Button
    document.getElementById('transModalTitle').textContent = 'Sửa giao dịch';
    document.getElementById('transSubmitBtn').textContent = 'Lưu thay đổi';

    // If transfer, maybe disable wallet/category change? 
    // For simplicity, user should be careful. Backend ignores wallet change anyway for now.
}
