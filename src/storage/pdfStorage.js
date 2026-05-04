import * as Print   from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildLedger } from './ledgerStorage';

// ── Generate HTML for single customer ledger ──────────────
const generateCustomerHTML = (customer) => {
  const date = new Date().toLocaleDateString('en-PK', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const activeFarmers = customer.farmers.filter(f => f.outstanding > 0);

  const farmersHTML = activeFarmers.map(farmer => {
    const txRows = farmer.transactions.map((tx, idx) => `
      <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
        <td>${tx.date}</td>
        <td>${tx.type === 'bill' ? 'Bill' : 'Payment'}</td>
        <td class="r">${tx.debit  > 0 ? tx.debit.toLocaleString()  : '—'}</td>
        <td class="r">${tx.credit > 0 ? tx.credit.toLocaleString() : '—'}</td>
        <td class="r b">${tx.runningBalance.toLocaleString()}</td>
      </tr>
    `).join('');

    return `
      <tr class="farmer-row">
        <td colspan="5">
          ${farmer.farmerName}
          &nbsp;&nbsp;
          <span class="farmer-outstanding">
            Outstanding: Rs ${farmer.outstanding.toLocaleString()}
          </span>
        </td>
      </tr>
      ${txRows}
      <tr class="farmer-total">
        <td colspan="2">Subtotal — ${farmer.farmerName}</td>
        <td class="r">${farmer.totalBilled.toLocaleString()}</td>
        <td class="r">${farmer.totalPaid.toLocaleString()}</td>
        <td class="r b">${farmer.outstanding.toLocaleString()}</td>
      </tr>
      <tr class="spacer"><td colspan="5"></td></tr>
    `;
  }).join('');

  const grandDebit  = activeFarmers.reduce((s, f) => s + f.totalBilled, 0);
  const grandCredit = activeFarmers.reduce((s, f) => s + f.totalPaid,   0);
  const grandBal    = activeFarmers.reduce((s, f) => s + f.outstanding, 0);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
.center { text-align: center; }
.company { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
.sub { font-size: 11px; color: #555; margin-top: 2px; }
.title { font-size: 13px; font-weight: bold; margin: 6px 0 2px; }
.meta { font-size: 10px; color: #555; }
hr.thick { border: none; border-top: 2px solid #000; margin: 8px 0; }
table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
th { border-top: 1px solid #000; border-bottom: 1px solid #000;
     padding: 4px 6px; font-weight: bold; text-align: left; }
th.r { text-align: right; }
td { padding: 3px 6px; border-bottom: 0.5px solid #ddd; }
td.r { text-align: right; }
td.b { font-weight: bold; }
.even { background: #f9f9f9; }
.odd  { background: #fff; }
.farmer-row td {
  background: #e8e8e8; font-weight: bold;
  padding: 5px 6px; border-top: 1px solid #999;
  font-size: 10px;
}
.farmer-outstanding { font-weight: normal; color: #333; }
.farmer-total td {
  background: #f0f0f0; font-weight: bold;
  padding: 4px 6px; border-top: 0.5px solid #999;
  font-size: 10px; font-style: italic;
}
.spacer td { border: none; padding: 5px 0; }
.closing td { border-top: 2px solid #000; font-weight: bold; padding: 5px 6px; }
.footer {
  margin-top: 16px; border-top: 0.5px solid #ccc;
  padding-top: 6px; display: flex;
  justify-content: space-between;
  font-size: 9px; color: #777;
}
</style>
</head>
<body>
<div class="center">
  <div class="company">NAYA SAWERA</div>
  <div class="sub">Agricultural Products Distribution</div>
</div>
<hr class="thick">
<div class="center">
  <div class="title">CUSTOMER ACCOUNT STATEMENT</div>
  <div class="meta">Customer: ${customer.customerName}</div>
  <div class="meta">Printed: ${date}</div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:70px">Date</th>
      <th>Type</th>
      <th class="r" style="width:75px">Debit</th>
      <th class="r" style="width:75px">Credit</th>
      <th class="r" style="width:80px">Balance</th>
    </tr>
  </thead>
  <tbody>
    ${activeFarmers.length === 0
      ? '<tr><td colspan="5" style="text-align:center;padding:20px">No outstanding balances.</td></tr>'
      : farmersHTML}
    <tr class="closing">
      <td colspan="2">Total Outstanding</td>
      <td class="r">${grandDebit.toLocaleString()}</td>
      <td class="r">${grandCredit.toLocaleString()}</td>
      <td class="r">${grandBal.toLocaleString()}</td>
    </tr>
  </tbody>
</table>
${customer.advanceBalance > 0 ? `
<p style="margin-top:10px;font-size:10px;color:#333;">
  * Advance Credit Available: Rs ${customer.advanceBalance.toLocaleString()}
</p>` : ''}
<div class="footer">
  <span>NSBill — computer generated statement</span>
  <span>Page 1 of 1</span>
</div>
</body>
</html>`;
};
// ── Generate and share PDF for a customer ─────────────────
export const generateAndShareCustomerPDF = async (customerName) => {
  try {
    // Get fresh ledger data
    const ledger   = await buildLedger();
    const customer = ledger.find(
      c => c.customerName.toLowerCase() === customerName.toLowerCase()
    );

    if (!customer) {
      throw new Error('No outstanding balance found for this customer.');
    }

    const html = generateCustomerHTML(customer);

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Share it
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Sharing not available on this device.');

    const date     = new Date().toISOString().split('T')[0];
    const fileName = `${customerName.replace(/\s+/g, '_')}_Ledger_${date}.pdf`;

    await Sharing.shareAsync(uri, {
      mimeType:    'application/pdf',
      dialogTitle: `Share Ledger — ${customerName}`,
      UTI:         'com.adobe.pdf',
    });

    return fileName;
  } catch (e) {
    console.error('generateAndShareCustomerPDF error:', e);
    throw e;
  }
};
// ── Generate chronological ledger report for a customer ───
export const generateLedgerReport = async (customerName, fromDate, toDate) => {
  try {
    const { getAllBills }    = await import('./billStorage');
    const { getAllPayments } = await import('./paymentStorage');

    const allBills    = await getAllBills();
    const allPayments = await getAllPayments();

    // ── Filter to this customer ─────────────────────────
    const customerBills = allBills.filter(
      b => b.customerName.toLowerCase() === customerName.toLowerCase()
    );
    const customerPayments = allPayments.filter(
      p => p.customerName.toLowerCase() === customerName.toLowerCase()
    );

    // ── Date helpers ────────────────────────────────────
    const parseDate = (str) => {
      if (!str) return new Date(0);
      const [d, m, y] = str.split('/');
      return new Date(y, m - 1, d);
    };

    const formatDateDisplay = (d) => {
      const day   = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year  = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const fromD = fromDate ? parseDate(fromDate) : new Date(0);
    const toD   = toDate   ? parseDate(toDate)   : new Date(9999, 11, 31);
    toD.setHours(23, 59, 59);

    // ── Build transaction list ───────────────────────────
    const transactions = [];

    customerBills.forEach(bill => {
      const d = parseDate(bill.date);
      if (d >= fromD && d <= toD) {
        transactions.push({
          date:        bill.date,
          dateObj:     d,
          particulars: `${bill.farmerName || 'General'} — Bill`,
          farmerName:  bill.farmerName || 'General',
          debit:       bill.amount,
          credit:      0,
          type:        'bill',
          id:          bill.id,
        });
      }
    });

    customerPayments.forEach(payment => {
      const d = parseDate(payment.date);
      if (d >= fromD && d <= toD) {
        const particulars = payment.type === 'advance'
          ? 'Advance Received'
          : `Payment Received${payment.farmerName ? ' — ' + payment.farmerName : ''}`;
        transactions.push({
          date:        payment.date,
          dateObj:     d,
          particulars,
          farmerName:  payment.farmerName || (payment.type === 'advance' ? '__advance__' : 'General'),
          debit:       0,
          credit:      payment.amount,
          type:        payment.type === 'advance' ? 'advance' : 'payment',
          id:          payment.id,
        });
      }
    });

    // Sort chronologically
    transactions.sort((a, b) => a.dateObj - b.dateObj);

    // ── Compute running balance ──────────────────────────
    let running = 0;
    const txWithBalance = transactions.map(tx => {
      running += tx.debit - tx.credit;
      return { ...tx, balance: running };
    });

    const totalDebit  = transactions.reduce((s, t) => s + t.debit,  0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
    const closing     = totalDebit - totalCredit;

    // ── Farmer-wise summary ──────────────────────────────
    const farmerMap = {};
    transactions.forEach(tx => {
      const key = tx.farmerName;
      if (!farmerMap[key]) {
        farmerMap[key] = { name: key, debit: 0, credit: 0 };
      }
      farmerMap[key].debit  += tx.debit;
      farmerMap[key].credit += tx.credit;
    });
    const farmerSummaries = Object.values(farmerMap).map(f => ({
      ...f,
      balance: f.debit - f.credit,
    }));

    // ── Period label ─────────────────────────────────────
    const periodLabel = fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
        ? `From ${fromDate}`
        : toDate
          ? `Up to ${toDate}`
          : 'All Dates';

    const printedOn = formatDateDisplay(new Date());

    // ── HTML ─────────────────────────────────────────────
    const rowsHTML = txWithBalance.map(tx => `
      <tr>
        <td>${tx.date}</td>
        <td>${tx.particulars}</td>
        <td class="r">${tx.debit  > 0 ? tx.debit.toLocaleString()  : '—'}</td>
        <td class="r">${tx.credit > 0 ? tx.credit.toLocaleString() : '—'}</td>
        <td class="r b">${tx.balance.toLocaleString()}</td>
      </tr>
    `).join('');

    const farmerRowsHTML = farmerSummaries.map(f => `
      <tr>
        <td colspan="2">${f.name === '__advance__' ? 'Advance (General)' : f.name}</td>
        <td class="r">${f.debit  > 0 ? f.debit.toLocaleString()  : '—'}</td>
        <td class="r">${f.credit > 0 ? f.credit.toLocaleString() : '—'}</td>
        <td class="r b">${f.balance.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
.center { text-align: center; }
.company { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
.sub { font-size: 11px; color: #555; margin-top: 2px; }
.title { font-size: 13px; font-weight: bold; margin: 6px 0 2px; }
.meta { font-size: 10px; color: #555; }
hr.thick { border: none; border-top: 2px solid #000; margin: 8px 0; }
hr.thin  { border: none; border-top: 0.5px solid #ccc; margin: 0; }
table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 6px; font-weight: bold; text-align: left; }
th.r { text-align: right; }
td { padding: 3px 6px; border-bottom: 0.5px solid #ddd; }
td.r { text-align: right; }
td.b { font-weight: bold; }
.section-header td { background: #f0f0f0; font-weight: bold; padding: 4px 6px; border-top: 1px solid #000; border-bottom: 1px solid #000; letter-spacing: 0.5px; font-size: 9px; }
.closing td { border-top: 2px solid #000; font-weight: bold; padding: 5px 6px; }
.spacer td { border: none; padding: 8px 0; }
.footer { margin-top: 16px; border-top: 0.5px solid #ccc; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9px; color: #777; }
</style>
</head>
<body>

<div class="center">
  <div class="company">NAYA SAWERA</div>
  <div class="sub">Agricultural Products Distribution</div>
</div>
<hr class="thick">
<div class="center">
  <div class="title">CUSTOMER LEDGER STATEMENT</div>
  <div class="meta">Customer: ${customerName} &nbsp;|&nbsp; Period: ${periodLabel}</div>
  <div class="meta">Printed: ${printedOn}</div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:70px">Date</th>
      <th>Farmer / Particulars</th>
      <th class="r" style="width:75px">Debit</th>
      <th class="r" style="width:75px">Credit</th>
      <th class="r" style="width:80px">Balance</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${fromDate || '—'}</td>
      <td>Opening Balance</td>
      <td class="r">—</td>
      <td class="r">—</td>
      <td class="r b">0</td>
    </tr>
    ${rowsHTML}
    <tr class="spacer"><td colspan="5"></td></tr>
    <tr class="section-header">
      <td colspan="5">FARMER-WISE SUMMARY</td>
    </tr>
    ${farmerRowsHTML}
    <tr class="spacer"><td colspan="5"></td></tr>
    <tr class="closing">
      <td colspan="2">Closing Balance &nbsp;|&nbsp; ${toDate || printedOn}</td>
      <td class="r">${totalDebit.toLocaleString()}</td>
      <td class="r">${totalCredit.toLocaleString()}</td>
      <td class="r">${closing.toLocaleString()}</td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <span>NSBill — computer generated statement</span>
  <span>Page 1 of 1</span>
</div>

</body>
</html>`;

    // ── Generate PDF & Share ─────────────────────────────

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Sharing not available on this device.');

    const fileName = `${customerName.replace(/\s+/g, '_')}_Ledger_${periodLabel.replace(/\//g, '-').replace(/\s+/g, '_')}.pdf`;

    await Sharing.shareAsync(uri, {
      mimeType:    'application/pdf',
      dialogTitle: `Ledger Report — ${customerName}`,
      UTI:         'com.adobe.pdf',
    });

    return fileName;
  } catch (e) {
    console.error('generateLedgerReport error:', e);
    throw e;
  }
};
// ── Generate Farmer-wise Summary Report ───────────────────
export const generateFarmerSummaryReport = async (
  customerName, fromDate, toDate, showAllFarmers
) => {
  try {
    const { getAllBills }    = await import('./billStorage');
    const { getAllPayments } = await import('./paymentStorage');

    const allBills    = await getAllBills();
    const allPayments = await getAllPayments();

    const parseDate = (str) => {
      if (!str) return new Date(0);
      const [d, m, y] = str.split('/');
      return new Date(y, m - 1, d);
    };

    const formatDateDisplay = (d) => {
      const day   = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year  = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const fromD = fromDate ? parseDate(fromDate) : new Date(0);
    const toD   = toDate   ? parseDate(toDate)   : new Date(9999, 11, 31);
    toD.setHours(23, 59, 59);

    // Filter bills & payments for this customer and date range
    const bills = allBills.filter(b => {
      const d = parseDate(b.date);
      return b.customerName.toLowerCase() === customerName.toLowerCase()
        && d >= fromD && d <= toD;
    });

    const payments = allPayments.filter(p => {
      const d = parseDate(p.date);
      return p.customerName.toLowerCase() === customerName.toLowerCase()
        && d >= fromD && d <= toD
        && p.type !== 'advance';
    });

    const advances = allPayments.filter(p => {
      const d = parseDate(p.date);
      return p.customerName.toLowerCase() === customerName.toLowerCase()
        && d >= fromD && d <= toD
        && p.type === 'advance';
    });

    // Build farmer map
    const farmerMap = {};

    bills.forEach(b => {
      const key = (b.farmerName || 'General').trim();
      if (!farmerMap[key]) farmerMap[key] = { name: key, billed: 0, paid: 0 };
      farmerMap[key].billed += b.amount;
      farmerMap[key].paid   += (b.paidAmount || 0);
    });

    payments.forEach(p => {
      const key = (p.farmerName || 'General').trim();
      if (!farmerMap[key]) farmerMap[key] = { name: key, billed: 0, paid: 0 };
    });

    let farmers = Object.values(farmerMap).map(f => ({
      ...f,
      outstanding: f.billed - f.paid,
    }));

    // Filter if needed
    if (!showAllFarmers) {
      farmers = farmers.filter(f => f.outstanding !== 0);
    }

    // Sort by outstanding desc
    farmers.sort((a, b) => b.outstanding - a.outstanding);

    const totalAdvance  = advances.reduce((s, p) => s + p.amount, 0);
    const grandBilled   = farmers.reduce((s, f) => s + f.billed,      0);
    const grandPaid     = farmers.reduce((s, f) => s + f.paid,        0);
    const grandOutstanding = grandBilled - grandPaid - totalAdvance;

    const periodLabel = fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : 'All Dates';

    const printedOn = formatDateDisplay(new Date());

    const rowsHTML = farmers.map((f, idx) => `
      <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
        <td>${idx + 1}</td>
        <td>${f.name}</td>
        <td class="r">${f.billed.toLocaleString()}</td>
        <td class="r">${f.paid.toLocaleString()}</td>
        <td class="r b ${f.outstanding > 0 ? '' : 'zero'}">
          ${f.outstanding.toLocaleString()}
        </td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
.center { text-align: center; }
.company { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
.sub { font-size: 11px; color: #555; margin-top: 2px; }
.title { font-size: 13px; font-weight: bold; margin: 6px 0 2px; }
.meta { font-size: 10px; color: #555; }
hr.thick { border: none; border-top: 2px solid #000; margin: 8px 0; }
table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
th { border-top: 1px solid #000; border-bottom: 1px solid #000;
     padding: 4px 6px; font-weight: bold; text-align: left; }
th.r { text-align: right; }
td { padding: 4px 6px; border-bottom: 0.5px solid #ddd; }
td.r { text-align: right; }
td.b { font-weight: bold; }
td.zero { color: #555; }
.even { background: #f9f9f9; }
.odd  { background: #fff; }
.total-row td {
  border-top: 2px solid #000; font-weight: bold; padding: 5px 6px;
}
.advance-row td {
  border-top: 0.5px solid #999; font-style: italic;
  padding: 4px 6px; color: #333;
}
.net-row td {
  border-top: 2px solid #000; border-bottom: 2px solid #000;
  font-weight: bold; font-size: 11px; padding: 5px 6px;
}
.footer {
  margin-top: 16px; border-top: 0.5px solid #ccc;
  padding-top: 6px; display: flex;
  justify-content: space-between;
  font-size: 9px; color: #777;
}
</style>
</head>
<body>
<div class="center">
  <div class="company">NAYA SAWERA</div>
  <div class="sub">Agricultural Products Distribution</div>
</div>
<hr class="thick">
<div class="center">
  <div class="title">FARMER-WISE SUMMARY REPORT</div>
  <div class="meta">Customer: ${customerName} &nbsp;|&nbsp; Period: ${periodLabel}</div>
  <div class="meta">
    Printed: ${printedOn} &nbsp;|&nbsp;
    ${showAllFarmers ? 'Showing all farmers' : 'Showing non-zero balances only'}
  </div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:24px">#</th>
      <th>Farmer Name</th>
      <th class="r" style="width:80px">Total Billed</th>
      <th class="r" style="width:80px">Total Paid</th>
      <th class="r" style="width:85px">Outstanding</th>
    </tr>
  </thead>
  <tbody>
    ${farmers.length === 0
      ? '<tr><td colspan="5" style="text-align:center;padding:20px">No farmers found for this period.</td></tr>'
      : rowsHTML}
    <tr class="total-row">
      <td colspan="2">Subtotal (${farmers.length} farmers)</td>
      <td class="r">${grandBilled.toLocaleString()}</td>
      <td class="r">${grandPaid.toLocaleString()}</td>
      <td class="r">${(grandBilled - grandPaid).toLocaleString()}</td>
    </tr>
    ${totalAdvance > 0 ? `
    <tr class="advance-row">
      <td colspan="4">Less: Advance Credit</td>
      <td class="r">(${totalAdvance.toLocaleString()})</td>
    </tr>
    <tr class="net-row">
      <td colspan="4">Net Outstanding Balance</td>
      <td class="r">${grandOutstanding.toLocaleString()}</td>
    </tr>` : ''}
  </tbody>
</table>
<div class="footer">
  <span>NSBill — computer generated statement</span>
  <span>Page 1 of 1</span>
</div>
</body>
</html>`;

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Sharing not available.');

    await Sharing.shareAsync(uri, {
      mimeType:    'application/pdf',
      dialogTitle: `Farmer Summary — ${customerName}`,
      UTI:         'com.adobe.pdf',
    });
  } catch (e) {
    console.error('generateFarmerSummaryReport error:', e);
    throw e;
  }
};