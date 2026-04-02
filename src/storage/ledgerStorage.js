import { getAllBills }     from './billStorage';
import { getAllPayments }  from './paymentStorage';

// ── Build complete ledger data ────────────────────────────
// Structure:
// customers: [
//   {
//     customerName,
//     totalBilled,
//     totalPaid,
//     advanceBalance,
//     outstanding,        ← totalBilled - totalPaid - advanceBalance
//     farmers: [
//       {
//         farmerName,
//         totalBilled,
//         totalPaid,
//         outstanding,
//         transactions: [ ...bills and payments sorted by date ]
//       }
//     ]
//   }
// ]

export const buildLedger = async () => {
  const [allBills, allPayments] = await Promise.all([
    getAllBills(),
    getAllPayments(),
  ]);

  // ── Group by customer ─────────────────────────────────
  const customerMap = {};

  // Process bills
  allBills.forEach(bill => {
    const cKey = bill.customerName.trim().toLowerCase();
    const fKey = (bill.farmerName || 'General').trim().toLowerCase();

    if (!customerMap[cKey]) {
      customerMap[cKey] = {
        customerName:    bill.customerName.trim(),
        totalBilled:     0,
        totalPaid:       0,
        advanceBalance:  0,
        outstanding:     0,
        farmerMap:       {},
      };
    }

    const customer = customerMap[cKey];
    customer.totalBilled += bill.amount;
    customer.totalPaid   += (bill.paidAmount || 0);

    // farmer level
    if (!customer.farmerMap[fKey]) {
      customer.farmerMap[fKey] = {
        farmerName:    (bill.farmerName || 'General').trim(),
        totalBilled:   0,
        totalPaid:     0,
        outstanding:   0,
        transactions:  [],
      };
    }

    const farmer = customer.farmerMap[fKey];
    farmer.totalBilled += bill.amount;
    farmer.totalPaid   += (bill.paidAmount || 0);

    // Add bill as a transaction
    farmer.transactions.push({
      id:          bill.id,
      type:        'bill',
      date:        bill.date,
      dateSort:    bill.createdAt,
      description: `Bill`,
      amount:      bill.amount,
      credit:      0,
      debit:       bill.amount,
      status:      bill.status,
      notes:       bill.notes || '',
    });
  });

  // Process payments (non-advance)
  allPayments
    .filter(p => p.type !== 'advance' && p.billId)
    .forEach(payment => {
      const cKey = payment.customerName.trim().toLowerCase();
      const fKey = (payment.farmerName || 'General').trim().toLowerCase();

      if (!customerMap[cKey]) return; // orphan payment, skip

      const customer = customerMap[cKey];

      if (!customer.farmerMap[fKey]) {
        customer.farmerMap[fKey] = {
          farmerName:   (payment.farmerName || 'General').trim(),
          totalBilled:  0,
          totalPaid:    0,
          outstanding:  0,
          transactions: [],
        };
      }

      const farmer = customer.farmerMap[fKey];

      // Add payment as a transaction
      farmer.transactions.push({
        id:          payment.id,
        type:        'payment',
        date:        payment.date,
        dateSort:    payment.createdAt,
        description: `Payment Received`,
        amount:      payment.amount,
        credit:      payment.amount,
        debit:       0,
        notes:       payment.notes || '',
      });
    });

  // Process advance payments
  allPayments
    .filter(p => p.type === 'advance')
    .forEach(payment => {
      const cKey = payment.customerName.trim().toLowerCase();
      if (!customerMap[cKey]) return;
      customerMap[cKey].advanceBalance += payment.amount;
    });

  // ── Compute running balances & sort ───────────────────
  const customers = Object.values(customerMap).map(customer => {
    // Compute outstanding per farmer
    const farmers = Object.values(customer.farmerMap).map(farmer => {
      // Sort transactions by date
      farmer.transactions.sort(
        (a, b) => new Date(a.dateSort) - new Date(b.dateSort)
      );

      // Add running balance to each transaction
      let running = 0;
      farmer.transactions = farmer.transactions.map(tx => {
        running += tx.debit - tx.credit;
        return { ...tx, runningBalance: running };
      });

      farmer.outstanding = farmer.totalBilled - farmer.totalPaid;
      return farmer;
    });

    // Filter out zero-balance farmers
    const activeFarmers = farmers.filter(f => f.outstanding > 0);

    customer.outstanding =
      customer.totalBilled - customer.totalPaid - customer.advanceBalance;

    return {
      customerName:   customer.customerName,
      totalBilled:    customer.totalBilled,
      totalPaid:      customer.totalPaid,
      advanceBalance: customer.advanceBalance,
      outstanding:    customer.outstanding,
      farmers:        activeFarmers,
    };
  });

  // Filter out zero-balance customers, sort by outstanding desc
  return customers
    .filter(c => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
};