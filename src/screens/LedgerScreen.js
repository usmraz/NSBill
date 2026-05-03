import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { buildLedger } from '../storage/ledgerStorage';
import { generateAndShareCustomerPDF } from '../storage/pdfStorage';

export default function LedgerScreen({ navigation}) {
  const [customers, setCustomers]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [expandedFarmer, setExpandedFarmer]     = useState(null);
  const [printingCustomer, setPrintingCustomer] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadLedger();
    }, [])
  );

  const loadLedger = async () => {
    try {
      const data = await buildLedger();
      setCustomers(data);
    } catch (e) {
      console.error('loadLedger error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleEditBill = async (billId) => {
  const { getAllBills } = await import('../storage/billStorage');
  const bills = await getAllBills();
  const bill  = bills.find(b => b.id === billId);
  if (bill) navigation.navigate('EditBill', { bill });
};

const handleEditPayment = async (paymentId) => {
  const { getAllPayments } = await import('../storage/paymentStorage');
  const payments = await getAllPayments();
  const payment  = payments.find(p => p.id === paymentId);
  if (payment) navigation.navigate('EditPayment', { payment });
};

  const onRefresh = () => {
    setRefreshing(true);
    loadLedger();
  };

  // ── Filter by search ───────────────────────────────────
  const filtered = customers.filter(c =>
    c.customerName.toLowerCase().includes(search.toLowerCase()) ||
    c.farmers.some(f =>
      f.farmerName.toLowerCase().includes(search.toLowerCase())
    )
  );

  // ── Toggle expand customer ────────────────────────────
  const toggleCustomer = (name) => {
    setExpandedCustomer(prev => prev === name ? null : name);
    setExpandedFarmer(null);
  };

  const toggleFarmer = (key) => {
    setExpandedFarmer(prev => prev === key ? null : key);
  };

  // ── Totals ─────────────────────────────────────────────
  const grandTotal = customers.reduce((s, c) => s + c.outstanding, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7A2B83" />
        <Text style={styles.loadingText}>Building ledger...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* ── HEADER SUMMARY ── */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerLabel}>TOTAL OUTSTANDING</Text>
          <Text style={styles.headerAmount}>
            Rs {grandTotal.toLocaleString()}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>{customers.length}</Text>
          <Text style={styles.headerCountLabel}>customers</Text>
        </View>
      </View>

      {/* ── SEARCH ── */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍  Search customer or farmer..."
          placeholderTextColor="#bbb"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#7A2B83']}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptySubtitle}>
              No outstanding balances found.
            </Text>
          </View>
        ) : (
          filtered.map(customer => (
  <CustomerCard
  key={customer.customerName}
  customer={customer}
  expanded={expandedCustomer === customer.customerName}
  expandedFarmer={expandedFarmer}
  onToggle={() => toggleCustomer(customer.customerName)}
  onToggleFarmer={toggleFarmer}
  onPrint={async () => {
    setPrintingCustomer(customer.customerName);
    try {
      await generateAndShareCustomerPDF(customer.customerName);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPrintingCustomer('');
    }
  }}
  printing={printingCustomer === customer.customerName}
  onEditBill={handleEditBill}
  onEditPayment={handleEditPayment}
  onLedgerReport={(name) => navigation.navigate('LedgerReport', { customerName: name })}
/>
            
          ))
        )}

        <Text style={styles.pullHint}>↓ Pull down to refresh</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Customer Card ─────────────────────────────────────────
function CustomerCard({
  customer, expanded, expandedFarmer,
  onToggle, onToggleFarmer, onPrint, printing,
  onEditBill, onEditPayment, onLedgerReport,
}) {
  return (
    <View style={styles.customerCard}>

      {/* Customer Header — tap to expand */}
      <TouchableOpacity
        style={styles.customerHeader}
        onPress={onToggle}
        activeOpacity={0.75}
      >
        <View style={styles.customerLeft}>
          <Text style={styles.customerName}>{customer.customerName}</Text>
          <Text style={styles.customerMeta}>
            {customer.farmers.length} farmer{customer.farmers.length !== 1 ? 's' : ''}
            {customer.advanceBalance > 0
              ? `  •  Advance: Rs ${customer.advanceBalance.toLocaleString()}`
              : ''}
          </Text>
        </View>
        <View style={styles.customerRight}>
          <Text style={styles.customerOutstanding}>
            Rs {customer.outstanding.toLocaleString()}
          </Text>
          <Text style={styles.expandHint}>
            {expanded ? '▲ Hide' : '▼ Show'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Expanded: Farmer List */}
      {expanded && (
        <View style={styles.farmerList}>

          {/* Print PDF Button */}
    <View style={styles.reportBtnRow}>
  <TouchableOpacity
    style={[styles.printBtn, { flex: 1 }, printing && { opacity: 0.6 }]}
    onPress={onPrint}
    disabled={printing}
  >
    {printing
      ? <ActivityIndicator color="#7A2B83" size="small" />
      : <Text style={styles.printBtnText}>📄 Customer PDF</Text>
    }
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.reportBtn, { flex: 1 }]}
    onPress={() => onLedgerReport(customer.customerName)}
  >
    <Text style={styles.reportBtnText}>📊 Ledger Report</Text>
  </TouchableOpacity>
</View>

          {/* Advance balance row */}
          {customer.advanceBalance > 0 && (
            <View style={styles.advanceRow}>
              <Text style={styles.advanceLabel}>⬆️ Advance Credit</Text>
              <Text style={styles.advanceAmount}>
                − Rs {customer.advanceBalance.toLocaleString()}
              </Text>
            </View>
          )}

          {customer.farmers.length === 0 ? (
            <Text style={styles.noFarmersText}>
              No active farmer balances.
            </Text>
          ) : (
            customer.farmers.map(farmer => {
              const fKey = `${customer.customerName}__${farmer.farmerName}`;
              return (
                <FarmerCard
                  key={fKey}
                  farmer={farmer}
                  expanded={expandedFarmer === fKey}
                  onToggle={() => onToggleFarmer(fKey)}
                  onEditBill={onEditBill}
                  onEditPayment={onEditPayment}
                />
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ── Farmer Card ───────────────────────────────────────────
function FarmerCard({ farmer, expanded, onToggle, onEditBill, onEditPayment  }) {
  return (
    <View style={styles.farmerCard}>

      {/* Farmer Header */}
      <TouchableOpacity
        style={styles.farmerHeader}
        onPress={onToggle}
        activeOpacity={0.75}
      >
        <View style={styles.farmerLeft}>
          <Text style={styles.farmerName}>👨‍🌾 {farmer.farmerName}</Text>
          <Text style={styles.farmerMeta}>
            {farmer.transactions.length} transaction
            {farmer.transactions.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.farmerRight}>
          <Text style={styles.farmerOutstanding}>
            Rs {farmer.outstanding.toLocaleString()}
          </Text>
          <Text style={styles.farmerSummary}>
            Billed: {farmer.totalBilled.toLocaleString()}
            {'  '}Paid: {farmer.totalPaid.toLocaleString()}
          </Text>
          <Text style={styles.expandHintSmall}>
            {expanded ? '▲' : '▼'} transactions
          </Text>
        </View>
      </TouchableOpacity>

      {/* Expanded: Transaction Rows */}
      {expanded && (
        <View style={styles.transactionList}>

          {/* Table Header */}
          <View style={styles.txHeader}>
            <Text style={[styles.txCol, styles.txColDate]}>Date</Text>
            <Text style={[styles.txCol, styles.txColDesc]}>Details</Text>
            <Text style={[styles.txCol, styles.txColDebit]}>Debit</Text>
            <Text style={[styles.txCol, styles.txColCredit]}>Credit</Text>
            <Text style={[styles.txCol, styles.txColBalance]}>Balance</Text>
            <Text style={[styles.txCol, { width: 28 }]}></Text>
          </View>

          {farmer.transactions.map((tx, idx) => (
  <TouchableOpacity
    key={tx.id + idx}
    style={[
      styles.txRow,
      tx.type === 'payment' && styles.txRowPayment,
    ]}
    onPress={() => {
      if (tx.type === 'bill') {
        onEditBill && onEditBill(tx.id);
      } else {
        onEditPayment && onEditPayment(tx.id);
      }
    }}
    activeOpacity={0.7}
  >
              <Text style={[styles.txCol, styles.txColDate, styles.txText]}>
                {tx.date}
              </Text>
              <View style={[styles.txCol, styles.txColDesc]}>
                <Text style={[
                  styles.txText,
                  tx.type === 'payment' && styles.txTextPayment,
                ]}>
                  {tx.type === 'bill' ? '🧾 Bill' : '💰 Payment'}
                </Text>
                {tx.notes ? (
                  <Text style={styles.txNote} numberOfLines={1}>
                    {tx.notes}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.txCol, styles.txColDebit, styles.txText,
                tx.debit > 0 && styles.txDebitText]}>
                {tx.debit > 0 ? tx.debit.toLocaleString() : '—'}
              </Text>
              <Text style={[styles.txCol, styles.txColCredit, styles.txText,
                tx.credit > 0 && styles.txCreditText]}>
                {tx.credit > 0 ? tx.credit.toLocaleString() : '—'}
              </Text>
              <Text style={[styles.txCol, styles.txColBalance,
                styles.txBalanceText,
                tx.runningBalance === 0 && styles.txBalanceZero]}>
                {tx.runningBalance.toLocaleString()}
              </Text>
              <Text style={[styles.txCol, { width: 28, textAlign: 'center' }]}>
      ✏️
    </Text>
            </TouchableOpacity>
          ))}

          {/* Farmer Total Row */}
          <View style={styles.txTotalRow}>
            <Text style={styles.txTotalLabel}>Outstanding Balance</Text>
            <Text style={styles.txTotalAmount}>
              Rs {farmer.outstanding.toLocaleString()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText:      { marginTop: 12, color: '#7A2B83', fontSize: 15 },

  // Header Bar
  headerBar: {
    backgroundColor: '#7A2B83',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabel:      { color: '#e8c5ec', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  headerAmount:     { color: '#F9E219', fontSize: 28, fontWeight: 'bold' },
  headerRight:      { alignItems: 'center' },
  headerCount:      { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerCountLabel: { color: '#e8c5ec', fontSize: 11 },

  // Search
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
  },

  scroll: { padding: 14, paddingBottom: 40 },

  // Customer Card
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  customerLeft:        { flex: 1 },
  customerName:        { fontSize: 17, fontWeight: 'bold', color: '#222' },
  customerMeta:        { fontSize: 12, color: '#999', marginTop: 3 },
  customerRight:       { alignItems: 'flex-end' },
  customerOutstanding: { fontSize: 20, fontWeight: 'bold', color: '#7A2B83' },
  expandHint:          { fontSize: 11, color: '#7A2B83', marginTop: 3, fontWeight: '600' },

  // Farmer List inside customer
  farmerList: {
    backgroundColor: '#fafafa',
    borderTopWidth: 1,
    borderTopColor: '#f0e0f4',
  },

  // Advance Row
  advanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#e8f5e9',
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
  },
  advanceLabel:  { fontSize: 13, color: '#2e7d32', fontWeight: '600' },
  advanceAmount: { fontSize: 14, color: '#2e7d32', fontWeight: 'bold' },

  noFarmersText: { padding: 16, color: '#aaa', textAlign: 'center', fontSize: 13 },

  // Farmer Card
  farmerCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  farmerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  farmerLeft:        { flex: 1 },
  farmerName:        { fontSize: 14, fontWeight: 'bold', color: '#444' },
  farmerMeta:        { fontSize: 11, color: '#aaa', marginTop: 2 },
  farmerRight:       { alignItems: 'flex-end' },
  farmerOutstanding: { fontSize: 16, fontWeight: 'bold', color: '#e53935' },
  farmerSummary:     { fontSize: 10, color: '#aaa', marginTop: 2 },
  expandHintSmall:   { fontSize: 10, color: '#7A2B83', marginTop: 3, fontWeight: '600' },

  // Transaction Table
  transactionList: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  txHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3e5f5',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  txRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
    alignItems: 'flex-start',
  },
  txRowPayment: { backgroundColor: '#f1f8f1' },

  // Columns
  txCol:        { fontSize: 11, paddingHorizontal: 2 },
  txColDate:    { width: 58 },
  txColDesc:    { flex: 1 },
  txColDebit:   { width: 54, textAlign: 'right' },
  txColCredit:  { width: 54, textAlign: 'right' },
  txColBalance: { width: 58, textAlign: 'right' },

  txText:        { fontSize: 11, color: '#333' },
  txTextPayment: { color: '#2e7d32', fontWeight: '600' },
  txNote:        { fontSize: 10, color: '#aaa', marginTop: 1 },
  txDebitText:   { color: '#e53935', fontWeight: '600' },
  txCreditText:  { color: '#2e7d32', fontWeight: '600' },
  txBalanceText: { color: '#7A2B83', fontWeight: 'bold', fontSize: 11 },
  txBalanceZero: { color: '#4caf50' },

  txTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f3e5f5',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  txTotalLabel:  { fontSize: 12, fontWeight: 'bold', color: '#7A2B83' },
  txTotalAmount: { fontSize: 13, fontWeight: 'bold', color: '#7A2B83' },

  // Empty State
  emptyState:    { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:     { fontSize: 56, marginBottom: 16 },
  emptyTitle:    { fontSize: 22, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center' },

  pullHint: { textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 16 },

  printBtn: {
  backgroundColor: '#f3e5f5',
  borderRadius: 10, paddingVertical: 12,
  alignItems: 'center', borderWidth: 1.5,
  borderColor: '#7A2B83',
},

printBtnText: {
  color: '#7A2B83', fontWeight: '700', fontSize: 14,
},
reportBtnRow: {
  flexDirection: 'row', gap: 8,
  margin: 12,
},
reportBtn: {
  backgroundColor: '#fff8e1',
  borderRadius: 10, paddingVertical: 12,
  alignItems: 'center', borderWidth: 1.5,
  borderColor: '#F9E219',
},
reportBtnText: {
  color: '#795548', fontWeight: '700', fontSize: 13,
},


});