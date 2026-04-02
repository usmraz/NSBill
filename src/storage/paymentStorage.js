import AsyncStorage from '@react-native-async-storage/async-storage';

const PAYMENTS_KEY = 'naya_sawera_payments';

// ── Generate unique ID ────────────────────────────────────
const generateId = () =>
  'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// ── Save a new payment ────────────────────────────────────
export const savePayment = async (paymentData) => {
  try {
    const existing = await getAllPayments();
    const newPayment = {
      id:           generateId(),
      billId:       paymentData.billId       || null, // null = advance
      customerName: paymentData.customerName,
      farmerName:   paymentData.farmerName   || '',
      amount:       Number(paymentData.amount),
      date:         paymentData.date,
      type:         paymentData.type         || 'payment', // 'payment' | 'advance'
      notes:        paymentData.notes        || '',
      createdAt:    new Date().toISOString(),
    };
    const updated = [newPayment, ...existing];
    await AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(updated));
    return newPayment;
  } catch (e) {
    console.error('savePayment error:', e);
    throw e;
  }
};

// ── Get all payments ──────────────────────────────────────
export const getAllPayments = async () => {
  try {
    const json = await AsyncStorage.getItem(PAYMENTS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('getAllPayments error:', e);
    return [];
  }
};

// ── Get payments for a specific bill ─────────────────────
export const getPaymentsForBill = async (billId) => {
  try {
    const all = await getAllPayments();
    return all.filter(p => p.billId === billId);
  } catch (e) {
    return [];
  }
};

// ── Get payments for a specific customer ─────────────────
export const getPaymentsForCustomer = async (customerName) => {
  try {
    const all = await getAllPayments();
    return all.filter(
      p => p.customerName.toLowerCase() === customerName.toLowerCase()
    );
  } catch (e) {
    return [];
  }
};

// ── Get advance balance for a customer ───────────────────
// Advance = payments with no billId
export const getAdvanceBalance = async (customerName) => {
  try {
    const all = await getAllPayments();
    return all
      .filter(
        p =>
          p.customerName.toLowerCase() === customerName.toLowerCase() &&
          p.type === 'advance'
      )
      .reduce((sum, p) => sum + p.amount, 0);
  } catch (e) {
    return 0;
  }
};

// ── Get total paid against a specific bill ────────────────
export const getTotalPaidForBill = async (billId) => {
  try {
    const payments = await getPaymentsForBill(billId);
    return payments.reduce((sum, p) => sum + p.amount, 0);
  } catch (e) {
    return 0;
  }
};

// ── Delete a payment ──────────────────────────────────────
export const deletePayment = async (id) => {
  try {
    const all     = await getAllPayments();
    const updated = all.filter(p => p.id !== id);
    await AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('deletePayment error:', e);
    throw e;
  }
};