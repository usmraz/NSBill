import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllBills, updateBill } from './billStorage';
import { getAllPayments }          from './paymentStorage';
import AsyncStorageLib            from '@react-native-async-storage/async-storage';

const CUSTOMERS_KEY = 'naya_sawera_customers';

// ── Helpers ───────────────────────────────────────────────
const generateId = () =>
  'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// ── Get all customers (with their farmers) ────────────────
export const getAllCustomers = async () => {
  try {
    const json = await AsyncStorage.getItem(CUSTOMERS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    return [];
  }
};

// ── Save full customer list ───────────────────────────────
const saveAllCustomers = async (customers) => {
  await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
};

// ── Add a new customer ────────────────────────────────────
export const addCustomer = async (name) => {
  const customers = await getAllCustomers();
  const exists = customers.find(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) throw new Error('Customer already exists');
  const newCustomer = {
    id:        generateId(),
    name:      name.trim(),
    farmers:   [],
    createdAt: new Date().toISOString(),
  };
  await saveAllCustomers([...customers, newCustomer]);
  return newCustomer;
};

// ── Add a farmer under a customer ─────────────────────────
export const addFarmer = async (customerName, farmerName) => {
  const customers = await getAllCustomers();
  const idx = customers.findIndex(
    c => c.name.toLowerCase() === customerName.toLowerCase()
  );
  if (idx === -1) throw new Error('Customer not found');

  const alreadyExists = customers[idx].farmers.find(
    f => f.name.toLowerCase() === farmerName.toLowerCase()
  );
  if (alreadyExists) throw new Error('Farmer already exists under this customer');

  const newFarmer = {
    id:        generateId(),
    name:      farmerName.trim(),
    createdAt: new Date().toISOString(),
  };
  customers[idx].farmers.push(newFarmer);
  await saveAllCustomers(customers);
  return newFarmer;
};

// ── Rename a customer + update all bills & payments ───────
export const renameCustomer = async (oldName, newName) => {
  const trimmedNew = newName.trim();

  // 1. Update customer list
  const customers = await getAllCustomers();
  const duplicate = customers.find(
    c => c.name.toLowerCase() === trimmedNew.toLowerCase() &&
         c.name.toLowerCase() !== oldName.toLowerCase()
  );
  if (duplicate) throw new Error('A customer with this name already exists');

  const updated = customers.map(c =>
    c.name.toLowerCase() === oldName.toLowerCase()
      ? { ...c, name: trimmedNew }
      : c
  );
  await saveAllCustomers(updated);

  // 2. Update all bills
  const bills = await getAllBills();
  for (const bill of bills) {
    if (bill.customerName.toLowerCase() === oldName.toLowerCase()) {
      await updateBill(bill.id, { customerName: trimmedNew });
    }
  }

  // 3. Update all payments
  const allPayments = await getAllPayments();
  const updatedPayments = allPayments.map(p =>
    p.customerName.toLowerCase() === oldName.toLowerCase()
      ? { ...p, customerName: trimmedNew }
      : p
  );
  await AsyncStorageLib.setItem(
    'naya_sawera_payments',
    JSON.stringify(updatedPayments)
  );
};

// ── Rename a farmer + update all bills & payments ─────────
export const renameFarmer = async (customerName, oldFarmerName, newFarmerName) => {
  const trimmedNew = newFarmerName.trim();

  // 1. Update farmer in customer list
  const customers = await getAllCustomers();
  const custIdx = customers.findIndex(
    c => c.name.toLowerCase() === customerName.toLowerCase()
  );
  if (custIdx === -1) throw new Error('Customer not found');

  const duplicate = customers[custIdx].farmers.find(
    f => f.name.toLowerCase() === trimmedNew.toLowerCase() &&
         f.name.toLowerCase() !== oldFarmerName.toLowerCase()
  );
  if (duplicate) throw new Error('A farmer with this name already exists');

  customers[custIdx].farmers = customers[custIdx].farmers.map(f =>
    f.name.toLowerCase() === oldFarmerName.toLowerCase()
      ? { ...f, name: trimmedNew }
      : f
  );
  await saveAllCustomers(customers);

  // 2. Update all bills
  const bills = await getAllBills();
  for (const bill of bills) {
    if (
      bill.customerName.toLowerCase() === customerName.toLowerCase() &&
      (bill.farmerName || '').toLowerCase() === oldFarmerName.toLowerCase()
    ) {
      await updateBill(bill.id, { farmerName: trimmedNew });
    }
  }

  // 3. Update all payments
  const allPayments = await getAllPayments();
  const updatedPayments = allPayments.map(p =>
    p.customerName.toLowerCase() === customerName.toLowerCase() &&
    (p.farmerName || '').toLowerCase() === oldFarmerName.toLowerCase()
      ? { ...p, farmerName: trimmedNew }
      : p
  );
  await AsyncStorageLib.setItem(
    'naya_sawera_payments',
    JSON.stringify(updatedPayments)
  );
};

// ── Sync customers from bills ─────────────────────────────
// Call this to auto-populate customers from existing bill data
export const syncCustomersFromBills = async () => {
  const bills     = await getAllBills();
  const customers = await getAllCustomers();

  // Build a map of existing customers
  const custMap = {};
  customers.forEach(c => {
    custMap[c.name.toLowerCase()] = c;
  });

  // Add missing customers and farmers from bills
  bills.forEach(bill => {
    const cKey = bill.customerName.trim().toLowerCase();
    if (!custMap[cKey]) {
      custMap[cKey] = {
        id:        generateId(),
        name:      bill.customerName.trim(),
        farmers:   [],
        createdAt: new Date().toISOString(),
      };
    }
    if (bill.farmerName?.trim()) {
      const fKey = bill.farmerName.trim().toLowerCase();
      const alreadyHas = custMap[cKey].farmers.find(
        f => f.name.toLowerCase() === fKey
      );
      if (!alreadyHas) {
        custMap[cKey].farmers.push({
          id:        generateId(),
          name:      bill.farmerName.trim(),
          createdAt: new Date().toISOString(),
        });
      }
    }
  });

  await saveAllCustomers(Object.values(custMap));
};

// ── Get all unique customer names (for autocomplete) ──────
export const getCustomerNames = async () => {
  const customers = await getAllCustomers();
  return customers.map(c => c.name).sort();
};

// ── Get all farmer names under a customer ─────────────────
export const getFarmerNames = async (customerName) => {
  const customers = await getAllCustomers();
  const customer  = customers.find(
    c => c.name.toLowerCase() === customerName.toLowerCase()
  );
  return customer ? customer.farmers.map(f => f.name).sort() : [];
};