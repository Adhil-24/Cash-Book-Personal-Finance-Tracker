class CashBook {
    constructor() {
        this.transactions = JSON.parse(localStorage.getItem('cashbook_transactions')) || [];
        
        // Ensure backward compatibility
        this.transactions = this.transactions.map(transaction => {
            if (!transaction.time) {
                transaction.time = "00:00"; // Default time if not provided
            }
            return transaction;
        });
        this.currentFilter = 'all';
        this.currentEditingId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateSummary();
        this.renderTransactions();
        this.setCurrentDate();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        // Form submission
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            console.log('Form submitted');
            e.preventDefault();
            this.addTransaction();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Clear all transactions button
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllTransactions();
        });

        // Export CSV button
        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.exportToCSVWithDateSelection();
        });

        // Transaction list event delegation
        document.getElementById('transactionList').addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const id = e.target.dataset.id;
                this.deleteTransaction(id);
            }
            if (e.target.classList.contains('edit-btn')) {
                const id = e.target.dataset.id;
                this.editTransaction(id);
            }
        });
    }

    setCurrentDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }

    editTransaction(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (transaction) {
            document.getElementById('description').value = transaction.description;
            document.getElementById('time').value = transaction.time;
            document.getElementById('amount').value = Math.abs(transaction.amount);
            document.getElementById('type').value = transaction.amount > 0 ? 'income' : 'expense';
            document.getElementById('date').value = transaction.date;
            this.currentEditingId = id;
        }
    }

    addTransaction() {
        const description = document.getElementById('description').value.trim();
        const time = document.getElementById('time').value; // Get time input
        const amount = parseFloat(document.getElementById('amount').value);
        const type = document.getElementById('type').value;
        const date = document.getElementById('date').value;
        
        console.log('Adding transaction:', { description,time , amount, type, date });
        console.log('Transaction details:', { description,time , amount, type, date });

        if (!description || isNaN(amount) || amount <= 0) {
            alert('Please enter valid transaction details.');
            return;
        }

        const transaction = {
            id: this.currentEditingId || Date.now().toString(),
            description,
            amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
            type,
            date,
            time // Include time in the transaction object
        };

        if (this.currentEditingId) {
            // Update existing transaction
            this.transactions = this.transactions.map(t => t.id === this.currentEditingId ? transaction : t);
            this.currentEditingId = null;
        } else {
            // Add new transaction
            this.transactions.push(transaction);
        }

        this.saveTransactions();
        this.updateSummary();
        this.renderTransactions();
        this.resetForm();
    }

    deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveTransactions();
            this.updateSummary();
            this.renderTransactions();
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            }
        });

        this.renderTransactions();
    }

    getFilteredTransactions() {
        let filteredTransactions = this.transactions;
        
        // Apply type filter first
        switch (this.currentFilter) {
            case 'income':
                filteredTransactions = filteredTransactions.filter(t => t.amount > 0);
                break;
            case 'expense':
                filteredTransactions = filteredTransactions.filter(t => t.amount < 0);
                break;
            case 'daily':
            case 'weekly':
            case 'monthly':
            case 'yearly':
                filteredTransactions = this.getTimeFilteredTransactions(this.currentFilter);
                break;
            default:
                // 'all' filter - no additional filtering needed
                break;
        }

        return filteredTransactions;
    }

    getTimeFilteredTransactions(timeFilter) {
        const now = new Date();
        let startDate, endDate;

        switch (timeFilter) {
            case 'daily':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                break;
            case 'weekly':
                const dayOfWeek = now.getDay();
                const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
                endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 7);
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear() + 1, 0, 1);
                break;
            default:
                return this.transactions;
        }

        return this.transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate >= startDate && transactionDate < endDate;
        });
    }

    updateSummary() {
        // Use filtered transactions for summary when time filters are active
        const transactionsToUse = ['daily', 'weekly', 'monthly', 'yearly'].includes(this.currentFilter) 
            ? this.getTimeFilteredTransactions(this.currentFilter)
            : this.transactions;

        const totalIncome = transactionsToUse
            .filter(t => t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = transactionsToUse
            .filter(t => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const balance = totalIncome - totalExpense;

        document.getElementById('balance').textContent = this.formatCurrency(balance);
        document.getElementById('total-income').textContent = this.formatCurrency(totalIncome);
        document.getElementById('total-expense').textContent = this.formatCurrency(totalExpense);

        // Update colors based on balance
        const balanceElement = document.getElementById('balance');
        balanceElement.className = 'amount';
        if (balance > 0) {
            balanceElement.classList.add('positive');
        } else if (balance < 0) {
            balanceElement.classList.add('negative');
        }
    }

    renderTransactions() {
        const transactionList = document.getElementById('transactionList');
        const filteredTransactions = this.getFilteredTransactions();

        if (filteredTransactions.length === 0) {
            transactionList.innerHTML = '<p class="empty-message">No transactions found.</p>';
            return;
        }

        transactionList.innerHTML = filteredTransactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(transaction => this.createTransactionHTML(transaction))
            .join('');
    }

    createTransactionHTML(transaction) {
        const isIncome = transaction.amount > 0;
        const amountClass = isIncome ? 'positive' : 'negative';
        const formattedDate = new Date(transaction.date).toLocaleDateString();
        const formattedAmount = this.formatCurrency(Math.abs(transaction.amount));

        return `
            <div class="transaction-item ${transaction.type}">
                <div class="transaction-info">
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-date">${formattedDate} ${transaction.time}</div> <!-- Include time -->
                </div>
                <div class="transaction-details">
                    <span class="transaction-amount ${amountClass}">
                        ${isIncome ? '+' : '-'}${formattedAmount}
                    </span>
                    <button class="edit-btn" data-id="${transaction.id}">Edit</button>
                    <button class="delete-btn" data-id="${transaction.id}">Delete</button>
                </div>
            </div>
        `;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    resetForm() {
        document.getElementById('transactionForm').reset();
        this.setCurrentDate();
        document.getElementById('description').focus();
    }

    clearAllTransactions() {
        if (this.transactions.length === 0) {
            alert('No transactions to clear.');
            return;
        }

        if (confirm('Are you sure you want to clear ALL transactions? This action cannot be undone.')) {
            this.transactions = [];
            this.saveTransactions();
            this.updateSummary();
            this.renderTransactions();
            alert('All transactions have been cleared successfully.');
        }
    }

    saveTransactions() {
        localStorage.setItem('cashbook_transactions', JSON.stringify(this.transactions));
    }

    exportToCSVWithDateSelection() {
        // Create a modal for date selection
        const modal = document.createElement('div');
        modal.className = 'settings-modal active';
        modal.innerHTML = `
            <div class="settings-content">
                <div class="settings-header">
                    <h2>Export CSV with Date Range</h2>
                    <button class="close-btn" id="closeExportModal">×</button>
                </div>
                <div class="settings-body">
                    <div class="form-group">
                        <label for="startDate">Start Date</label>
                        <input type="date" id="startDate" required>
                    </div>
                    <div class="form-group">
                        <label for="endDate">End Date</label>
                        <input type="date" id="endDate" required>
                    </div>
                    <button id="confirmExport" class="use-result-btn">Export CSV</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Set default dates (current month)
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        document.getElementById('startDate').value = firstDayOfMonth.toISOString().split('T')[0];
        document.getElementById('endDate').value = lastDayOfMonth.toISOString().split('T')[0];

        // Event listeners
        document.getElementById('closeExportModal').addEventListener('click', () => {
            document.body.removeChild(modal);
            document.body.style.overflow = '';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                document.body.style.overflow = '';
            }
        });

        document.getElementById('confirmExport').addEventListener('click', () => {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            if (!startDate || !endDate) {
                alert('Please select both start and end dates.');
                return;
            }

            if (new Date(startDate) > new Date(endDate)) {
                alert('Start date cannot be after end date.');
                return;
            }

            this.exportFilteredCSV(startDate, endDate);
            document.body.removeChild(modal);
            document.body.style.overflow = '';
        });
    }

    exportFilteredCSV(startDate, endDate) {
        const filteredTransactions = this.transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1); // Include the end date

            return transactionDate >= start && transactionDate < end;
        });

        if (filteredTransactions.length === 0) {
            alert('No transactions found in the selected date range.');
            return;
        }

        const csvContent = [
            ['Date', 'Time', 'Description', 'Type', 'Amount'],
            ...filteredTransactions.map(t => [
                t.date,
                t.time,
                t.description,
                t.type,
                Math.abs(t.amount).toFixed(2)
            ])
        ].map(e => e.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cashbook_export_${startDate}_to_${endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        alert(`Exported ${filteredTransactions.length} transactions successfully!`);
    }
}

// Initialize the cash book when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CashBook();
});

// Additional utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Export functionality (optional)
function exportToCSV() {
    const transactions = JSON.parse(localStorage.getItem('cashbook_transactions')) || [];
    if (transactions.length === 0) {
        alert('No transactions to export.');
        return;
    }

    const csvContent = [
        ['Date','time' , 'Description', 'Type', 'Amount' ], // Add Time column
        ...transactions.map(t => [
            t.date,
            t.time,// Include time in export
            t.description,
            t.type,
            Math.abs(t.amount).toFixed(2)
    
        ])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashbook_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Add export button to the page
function addExportButton() {
    const header = document.querySelector('header');
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export CSV';
    exportBtn.style.marginTop = '10px';
    exportBtn.style.background = '#28a745';
    exportBtn.onclick = exportToCSV;
    header.appendChild(exportBtn);
}

// Initialize export button
document.addEventListener('DOMContentLoaded', addExportButton);

// Settings Modal Functionality
class SettingsManager {
    constructor() {
        this.modal = document.getElementById('settingsModal');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeBtn = document.getElementById('closeSettings');
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadNotes();
    }

    setupEventListeners() {
        // Modal toggle
        this.settingsBtn.addEventListener('click', () => this.openModal());
        this.closeBtn.addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Tab switching
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.closeModal();
            }
        });
    }

    openModal() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.saveNotes(); // Auto-save notes when closing
    }

    switchTab(tabName) {
        // Update active tab button
        this.tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Show corresponding tab content
        this.tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabName + 'Tab') {
                content.classList.add('active');
            }
        });
    }

    loadNotes() {
        const savedNotes = localStorage.getItem('cashbook_notes');
        if (savedNotes) {
            document.getElementById('notesArea').value = savedNotes;
        }
    }

    saveNotes() {
        const notes = document.getElementById('notesArea').value;
        localStorage.setItem('cashbook_notes', notes);
    }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
    
    // Add event listeners for notebook buttons
    document.getElementById('saveNotes').addEventListener('click', () => {
        const settingsManager = new SettingsManager();
        settingsManager.saveNotes();
        alert('Notes saved successfully!');
    });

    document.getElementById('clearNotes').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all notes?')) {
            document.getElementById('notesArea').value = '';
            localStorage.removeItem('cashbook_notes');
            alert('Notes cleared successfully!');
        }
    });

    // Add event listener for "Use Result" button
    document.getElementById('useCalcResult').addEventListener('click', () => {
        const calcDisplay = document.getElementById('calcDisplay');
        const amountInput = document.getElementById('amount');
        
        if (calcDisplay.value && !isNaN(calcDisplay.value)) {
            amountInput.value = calcDisplay.value;
            this.closeModal();
        } else {
            alert('Please calculate a valid amount first.');
        }
    });
});

// Calculator functionality
class Calculator {
    constructor() {
        this.display = document.getElementById('calcDisplay');
        this.buttons = document.querySelectorAll('.calc-btn');
        this.currentInput = '0';
        this.previousInput = '';
        this.operation = null;
        this.shouldResetDisplay = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
    }

    setupEventListeners() {
        this.buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.value;
                this.handleButtonClick(value);
            });
        });
    }

    handleButtonClick(value) {
        if (value >= '0' && value <= '9') {
            this.handleNumber(value);
        } else if (value === '.') {
            this.handleDecimal();
        } else if (value === 'C' || value === 'AC') {
            this.handleClear(value);
        } else if (value === '±') {
            this.handleSignChange();
        } else if (value === '%') {
            this.handlePercentage();
        } else if (value === '=') {
            this.handleEquals();
        } else {
            this.handleOperation(value);
        }
    }

    handleNumber(number) {
        if (this.shouldResetDisplay) {
            this.currentInput = '';
            this.shouldResetDisplay = false;
        }
        
        if (this.currentInput === '0' && number !== '.') {
            this.currentInput = number;
        } else if (this.currentInput.length < 12) { // Limit input length
            this.currentInput += number;
        }
        this.updateDisplay();
    }

    handleDecimal() {
        if (this.shouldResetDisplay) {
            this.currentInput = '0';
            this.shouldResetDisplay = false;
        }
        
        if (!this.currentInput.includes('.')) {
            this.currentInput += '.';
        }
        this.updateDisplay();
    }

    handleClear(type) {
        if (type === 'AC') {
            this.currentInput = '0';
            this.previousInput = '';
            this.operation = null;
        } else {
            this.currentInput = '0';
        }
        this.shouldResetDisplay = false;
        this.updateDisplay();
    }

    handleSignChange() {
        this.currentInput = (parseFloat(this.currentInput) * -1).toString();
        this.updateDisplay();
    }

    handlePercentage() {
        this.currentInput = (parseFloat(this.currentInput) / 100).toString();
        this.updateDisplay();
    }

    handleOperation(op) {
        if (this.operation !== null) {
            this.calculate();
        }
        this.previousInput = this.currentInput;
        this.operation = op;
        this.shouldResetDisplay = true;
    }

    handleEquals() {
        if (this.operation !== null) {
            this.calculate();
            this.operation = null;
        }
    }

    calculate() {
        let result;
        const prev = parseFloat(this.previousInput);
        const current = parseFloat(this.currentInput);
        
        if (isNaN(prev) || isNaN(current)) return;

        switch (this.operation) {
            case '+':
                result = prev + current;
                break;
            case '-':
                result = prev - current;
                break;
            case '*':
                result = prev * current;
                break;
            case '/':
                if (current === 0) {
                    alert('Cannot divide by zero');
                    this.handleClear('AC');
                    return;
                }
                result = prev / current;
                break;
            default:
                return;
        }

        // Round to avoid floating point precision issues
        result = Math.round(result * 100000000) / 100000000;
        this.currentInput = result.toString();
        this.shouldResetDisplay = true;
        this.updateDisplay();
    }

    updateDisplay() {
        // Format the display with commas for thousands
        let displayValue = this.currentInput;
        if (displayValue.includes('.')) {
            const parts = displayValue.split('.');
            parts[0] = this.formatNumberWithCommas(parts[0]);
            displayValue = parts.join('.');
        } else {
            displayValue = this.formatNumberWithCommas(displayValue);
        }
        this.display.value = displayValue;
    }

    formatNumberWithCommas(number) {
        return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

// Initialize calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Calculator();
});
