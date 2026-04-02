import AsyncStorage from '@react-native-async-storage/async-storage';

const BILLS_KEY = 'naya_sawera_bills';

const generateId = () =>
  'bill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// ── Save a new bill ───────────────────────────────────────
export const saveBill = async (billData) => {
  try {
    const existing = await getAllBills();
    const newBill = {
      ...billData,
      id:            generateId(),
      amount:        Number(billData.amount),
      paidAmount:    Number(billData.paidAmount || 0),
      status:        billData.status || 'unpaid',
      createdAt:     new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    };
    // Auto-set status if partial payment at time of entry
    newBill.status = computeStatus(newBill.amount, newBill.paidAmount);
    const updated = [newBill, ...existing];
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(updated));
    return newBill;
  } catch (e) {
    console.error('saveBill error:', e);
    throw e;
  }
};

// ── Get all bills ─────────────────────────────────────────
export const getAllBills = async () => {
  try {
    const json = await AsyncStorage.getItem(BILLS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    return [];
  }
};

// ── Update a bill ─────────────────────────────────────────
export const updateBill = async (id, updatedFields) => {
  try {
    const bills   = await getAllBills();
    const updated = bills.map(b =>
      b.id === id
        ? { ...b, ...updatedFields, updatedAt: new Date().toISOString() }
        : b
    );
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('updateBill error:', e);
    throw e;
  }
};

// ── Apply a payment to a bill — auto updates paidAmount & status ──
export const applyPaymentToBill = async (billId, newPaymentAmount) => {
  try {
    const bills = await getAllBills();
    const bill  = bills.find(b => b.id === billId);
    if (!bill) throw new Error('Bill not found');

    const newPaid   = (bill.paidAmount || 0) + Number(newPaymentAmount);
    const newStatus = computeStatus(bill.amount, newPaid);

    await updateBill(billId, {
      paidAmount: newPaid,
      status:     newStatus,
    });
    return { newPaid, newStatus };
  } catch (e) {
    console.error('applyPaymentToBill error:', e);
    throw e;
  }
};

// ── Compute status from amounts ───────────────────────────
export const computeStatus = (totalAmount, paidAmount) => {
  if (!paidAmount || paidAmount <= 0)          return 'unpaid';
  if (paidAmount >= totalAmount)               return 'paid';
  return 'partial';
};

// ── Delete a bill ─────────────────────────────────────────
export const deleteBill = async (id) => {
  try {
    const bills   = await getAllBills();
    const updated = bills.filter(b => b.id !== id);
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('deleteBill error:', e);
    throw e;
  }
};

// ── Get total outstanding (unpaid + partial only) ─────────
export const getTotalReceivable = async () => {
  try {
    const bills = await getAllBills();
    return bills
      .filter(b => b.status !== 'paid')
      .reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);
  } catch (e) {
    return 0;
  }
};

// ── Get bills for a specific customer ─────────────────────
export const getBillsForCustomer = async (customerName) => {
  try {
    const all = await getAllBills();
    return all.filter(
      b => b.customerName.toLowerCase() === customerName.toLowerCase()
    );
  } catch (e) {
    return [];
  }
};

// ── Get bills for a specific farmer under a customer ─────
export const getBillsForFarmer = async (customerName, farmerName) => {
  try {
    const all = await getAllBills();
    return all.filter(
      b =>
        b.customerName.toLowerCase() === customerName.toLowerCase() &&
        b.farmerName.toLowerCase()   === farmerName.toLowerCase()
    );
  } catch (e) {
    return [];
  }
};
// ── Compute due date from bill date + days ────────────────
export const computeDueDate = (billDateStr, dueDays) => {
  if (!billDateStr || !dueDays) return null;
  const [day, month, year] = billDateStr.split('/');
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(dueDays));
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

// ── Check if a bill is overdue ────────────────────────────
export const isBillOverdue = (bill) => {
  if (!bill.dueDate)           return false;
  if (bill.status === 'paid')  return false;
  const [day, month, year] = bill.dueDate.split('/');
  const due   = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
};

// ── Days overdue (negative = days remaining) ──────────────
export const daysOverdue = (bill) => {
  if (!bill.dueDate) return null;
  const [day, month, year] = bill.dueDate.split('/');
  const due   = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff;
};

// ── Get all due/overdue bills sorted oldest due date first ─
export const getDueBills = async () => {
  try {
    const all = await getAllBills();
    return all
      .filter(b => b.status !== 'paid' && b.dueDate)
      .sort((a, b) => {
        const parseDate = str => {
          const [d, m, y] = str.split('/');
          return new Date(y, m - 1, d);
        };
        return parseDate(a.dueDate) - parseDate(b.dueDate);
      });
  } catch (e) {
    return [];
  }
};