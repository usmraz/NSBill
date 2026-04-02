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
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${tx.date}</td>
        <td>${tx.type === 'bill' ? 'Bill' : 'Payment'}</td>
        <td class="right">${tx.debit  > 0 ? tx.debit.toLocaleString()  : ''}</td>
        <td class="right">${tx.credit > 0 ? tx.credit.toLocaleString() : ''}</td>
        <td class="right"><b>${tx.runningBalance.toLocaleString()}</b></td>
      </tr>
    `).join('');

    return `
      <tr class="farmer-row">
        <td colspan="4"><b>👨‍🌾 ${farmer.farmerName}</b></td>
        <td class="right"><b>Rs ${farmer.outstanding.toLocaleString()}</b></td>
      </tr>
      ${txRows}
      <tr class="spacer"><td colspan="5"></td></tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          color: #000;
          padding: 16px;
        }
        .header {
          border-bottom: 2px solid #000;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .header h2 { font-size: 14px; }
        .header p  { font-size: 11px; margin-top: 2px; }
        .summary {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 11px;
          border-bottom: 1px solid #000;
          padding-bottom: 6px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        th {
          background: #000;
          color: #fff;
          padding: 4px 6px;
          text-align: left;
        }
        th.right, td.right { text-align: right; }
        td { padding: 3px 6px; border-bottom: 1px solid #ddd; }
        .row-even { background: #f9f9f9; }
        .row-odd  { background: #fff; }
        .farmer-row td {
          background: #e0e0e0;
          padding: 4px 6px;
          font-size: 10px;
        }
        .spacer td { height: 4px; border: none; }
        .footer {
          margin-top: 12px;
          border-top: 1px solid #000;
          padding-top: 6px;
          font-size: 9px;
          color: #555;
        }
      </style>
    </head>
    <body>

      <div class="header">
        <h2>NSBill — Customer Ledger</h2>
        <p>${customer.customerName} &nbsp;|&nbsp; Generated: ${date}</p>
      </div>

      <div class="summary">
        <span>Farmers: ${activeFarmers.length}</span>
        <span>Total Billed: Rs ${customer.totalBilled.toLocaleString()}</span>
        <span>Total Paid: Rs ${customer.totalPaid.toLocaleString()}</span>
        ${customer.advanceBalance > 0
          ? `<span>Advance: Rs ${customer.advanceBalance.toLocaleString()}</span>`
          : ''}
        <span><b>Outstanding: Rs ${customer.outstanding.toLocaleString()}</b></span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th class="right">Debit</th>
            <th class="right">Credit</th>
            <th class="right">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${activeFarmers.length === 0
            ? '<tr><td colspan="5" style="text-align:center;padding:20px">No outstanding balances.</td></tr>'
            : farmersHTML}
        </tbody>
      </table>

      <div class="footer">
        NSBill — Agricultural Products Distribution &nbsp;|&nbsp; Computer generated statement
      </div>

    </body>
    </html>
  `;
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