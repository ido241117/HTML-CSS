const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const FINANCE_FILE = path.join(__dirname, '../finance.json');

// Helper to read data
const readData = () => {
    try {
        if (!fs.existsSync(FINANCE_FILE)) {
            const initialData = {
                wallets: [],
                transactions: [],
                categories: {
                    income: ["Lương", "Thưởng", "Tiền lãi", "Quà tặng", "Khác"],
                    expense: ["Ăn uống", "Di chuyển", "Nhà cửa", "Hóa đơn", "Mua sắm", "Giải trí", "Sức khỏe", "Giáo dục", "Khác"]
                }
            };
            fs.writeFileSync(FINANCE_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        return JSON.parse(fs.readFileSync(FINANCE_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading finance data:', error);
        return { wallets: [], transactions: [], categories: { income: [], expense: [] } };
    }
};

// Helper to write data
const writeData = (data) => {
    try {
        fs.writeFileSync(FINANCE_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing finance data:', error);
        return false;
    }
};

// GET all finance data
router.get('/finance', (req, res) => {
    const data = readData();
    res.json(data);
});

// POST new wallet
router.post('/finance/wallets', (req, res) => {
    const { name, balance, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Wallet name is required' });

    const data = readData();
    const newWallet = {
        id: Date.now().toString(),
        name,
        balance: parseFloat(balance) || 0,
        icon: icon || '💰',
        color: color || '#007acc'
    };
    data.wallets.push(newWallet);
    writeData(data);
    res.status(201).json(newWallet);
});

// POST new transaction
router.post('/finance/transactions', (req, res) => {
    const { walletId, type, amount, category, note, date } = req.body;

    if (!walletId || !type || !amount || !category) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const data = readData();
    const walletIndex = data.wallets.findIndex(w => w.id === walletId);

    if (walletIndex === -1) {
        return res.status(404).json({ error: 'Wallet not found' });
    }

    const numAmount = parseFloat(amount);
    const transaction = {
        id: Date.now().toString(),
        walletId,
        walletName: data.wallets[walletIndex].name,
        type, // 'income' or 'expense'
        amount: numAmount,
        category,
        note: note || '',
        date: date || new Date().toISOString()
    };

    // Update wallet balance
    if (type === 'income') {
        data.wallets[walletIndex].balance += numAmount;
    } else {
        data.wallets[walletIndex].balance -= numAmount;
    }

    data.transactions.unshift(transaction); // Add to beginning
    // Keep only last 1000 transactions to prevent file growth
    if (data.transactions.length > 1000) {
        data.transactions = data.transactions.slice(0, 1000);
    }

    writeData(data);
    res.status(201).json(transaction);
});

// POST transfer between wallets
router.post('/finance/transfer', (req, res) => {
    const { fromWalletId, toWalletId, amount, note, date } = req.body;

    if (!fromWalletId || !toWalletId || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (fromWalletId === toWalletId) {
        return res.status(400).json({ error: 'Source and destination wallets must be different' });
    }

    const data = readData();
    const fromIndex = data.wallets.findIndex(w => w.id === fromWalletId);
    const toIndex = data.wallets.findIndex(w => w.id === toWalletId);

    if (fromIndex === -1 || toIndex === -1) {
        return res.status(404).json({ error: 'One or both wallets not found' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    const timestamp = Date.now().toString();
    const transDate = date || new Date().toISOString();

    // Create withdrawal transaction
    const fromTransaction = {
        id: timestamp + '-out',
        walletId: fromWalletId,
        walletName: data.wallets[fromIndex].name,
        type: 'expense',
        amount: numAmount,
        category: 'Chuyển tiền',
        note: `Chuyển đến ${data.wallets[toIndex].name}${note ? ': ' + note : ''}`,
        date: transDate,
        isTransfer: true
    };

    // Create deposit transaction
    const toTransaction = {
        id: timestamp + '-in',
        walletId: toWalletId,
        walletName: data.wallets[toIndex].name,
        type: 'income',
        amount: numAmount,
        category: 'Chuyển tiền',
        note: `Nhận từ ${data.wallets[fromIndex].name}${note ? ': ' + note : ''}`,
        date: transDate,
        isTransfer: true
    };

    // Update balances
    data.wallets[fromIndex].balance -= numAmount;
    data.wallets[toIndex].balance += numAmount;

    // Add to transactions
    data.transactions.unshift(fromTransaction, toTransaction);

    if (data.transactions.length > 1000) {
        data.transactions = data.transactions.slice(0, 1000);
    }

    writeData(data);
    res.json({ success: true, fromTransaction, toTransaction });
});

// DELETE transaction
router.delete('/finance/transactions/:id', (req, res) => {
    const { id } = req.params;
    const data = readData();
    const index = data.transactions.findIndex(t => t.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = data.transactions[index];

    // Helper to update balance
    const updateBalance = (walletId, amount, isIncome, reverse = false) => {
        const wIndex = data.wallets.findIndex(w => w.id === walletId);
        if (wIndex === -1) return;

        let change = amount;
        if (!isIncome) change = -change; // Expense is negative
        if (reverse) change = -change;   // Reversing means opposite effect

        data.wallets[wIndex].balance += change;
    };

    if (transaction.isTransfer) {
        // Handle Transfer (delete both parts)
        const isOut = id.endsWith('-out');
        const partnerId = isOut ? id.replace('-out', '-in') : id.replace('-in', '-out');
        const partnerIndex = data.transactions.findIndex(t => t.id === partnerId);

        // Reverse THIS transaction
        updateBalance(transaction.walletId, transaction.amount, transaction.type === 'income', true);

        // Reverse PARTNER transaction (if exists)
        if (partnerIndex !== -1) {
            const partner = data.transactions[partnerIndex];
            updateBalance(partner.walletId, partner.amount, partner.type === 'income', true);
            data.transactions.splice(partnerIndex, 1);
            // Adjust index if partner was before current (though usually they are adjacent)
            if (partnerIndex < index) {
                data.transactions.splice(index - 1, 1);
            } else {
                data.transactions.splice(index, 1);
            }
        } else {
            // Just delete current if partner missing (shouldn't happen but safe to handle)
            data.transactions.splice(index, 1);
        }
    } else {
        // Handle Normal Transaction
        updateBalance(transaction.walletId, transaction.amount, transaction.type === 'income', true);
        data.transactions.splice(index, 1);
    }

    writeData(data);
    res.json({ success: true });
});

// PUT edit transaction
router.put('/finance/transactions/:id', (req, res) => {
    const { id } = req.params;
    const { amount, note, date, category } = req.body; // Wallet change not supported for simplicity yet
    const data = readData();
    const index = data.transactions.findIndex(t => t.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = data.transactions[index];

    // Helper to update balance
    const updateBalance = (walletId, val, isIncome, reverse = false) => {
        const wIndex = data.wallets.findIndex(w => w.id === walletId);
        if (wIndex === -1) return;

        let change = val;
        if (!isIncome) change = -change;
        if (reverse) change = -change;

        data.wallets[wIndex].balance += change;
    };

    const newAmount = parseFloat(amount);
    if (isNaN(newAmount) || newAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    if (transaction.isTransfer) {
        // Handle Transfer Edit
        // Only allow editing amount, note, date
        const isOut = id.endsWith('-out');
        const partnerId = isOut ? id.replace('-out', '-in') : id.replace('-in', '-out');
        const partnerIndex = data.transactions.findIndex(t => t.id === partnerId);

        if (partnerIndex === -1) {
            return res.status(404).json({ error: 'Linked transfer transaction not found' });
        }

        const partner = data.transactions[partnerIndex];

        // 1. Revert old amounts
        updateBalance(transaction.walletId, transaction.amount, transaction.type === 'income', true);
        updateBalance(partner.walletId, partner.amount, partner.type === 'income', true);

        // 2. Apply new amounts
        updateBalance(transaction.walletId, newAmount, transaction.type === 'income', false);
        updateBalance(partner.walletId, newAmount, partner.type === 'income', false);

        // 3. Update fields
        transaction.amount = newAmount;
        transaction.note = note || transaction.note; // Keep old if not provided? Or allow empty? Usually edit provides value.
        // Special note logic for transfer? "Chuyển đến..."
        // If user edits note, we might lose the "Chuyển đến/Nhận từ" prefix if we just overwrite.
        // For now, let's just update the note directly as user desires.
        if (note !== undefined) transaction.note = note;
        if (date) transaction.date = date;

        partner.amount = newAmount;
        if (note !== undefined) partner.note = note; // Sync note? Or keep them separate? Creating syncs them roughly. Let's sync for now.
        if (date) partner.date = date;

    } else {
        // Handle Normal Transaction
        // 1. Revert old amount
        updateBalance(transaction.walletId, transaction.amount, transaction.type === 'income', true);

        // 2. Apply new amount
        updateBalance(transaction.walletId, newAmount, transaction.type === 'income', false);

        // 3. Update fields
        transaction.amount = newAmount;
        if (category) transaction.category = category;
        if (note !== undefined) transaction.note = note;
        if (date) transaction.date = date;
    }

    writeData(data);
    res.json({ success: true, transaction });
});

module.exports = router;
