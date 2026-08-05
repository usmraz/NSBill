import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useFocusEffect }  from '@react-navigation/native';
import DateTimePicker      from '@react-native-community/datetimepicker';
import { getAllPayments, deletePayment } from '../storage/paymentStorage';
import { applyPaymentToBill, getAllBills, updateBill, computeStatus } from '../storage/billStorage';

export default function AllPaymentsScreen({ navigation }) {
  const [allPayments,    setAllPayments]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);

  // ── Filters ───────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [typeFilter,     setTypeFilter]     = useState('all');
  const [fromDate,       setFromDate]       = useState(null);
  const [toDate,         setToDate]         = useState(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker,   setShowToPicker]   = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [])
  );

  const loadPayments = async () => {
    try {
      const payments = await getAllPayments();
      // Sort newest first
      payments.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setAllPayments(payments);
    } catch (e) {
      console.error('loadPayments error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  // ── Helpers ───────────────────────────────────────────
  const formatDate = (d) => {
    if (!d) return '';
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const parseDate = (str) => {
    if (!str) return null;
    const [d, m, y] = str.split('/');
    return new Date(y, m - 1, d);
  };

  // ── Filter logic ──────────────────────────────────────
  const applyFilters = (payments) => {
    return payments.filter(p => {
      // Search
      const matchesSearch =
        p.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (p.farmerName || '').toLowerCase().includes(search.toLowerCase());

      // Type
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'advance' && p.type === 'advance') ||
        (typeFilter === 'payment' && p.type !== 'advance');

      // Date range
      const pDate = parseDate(p.date);
      const matchesFrom = fromDate ? pDate >= fromDate : true;
      const matchesTo   = toDate
        ? pDate <= new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59)
        : true;

      return matchesSearch && matchesType && matchesFrom && matchesTo;
    });
  };

  const filtered     = applyFilters(allPayments);
  const billPayments = filtered.filter(p => p.type !== 'advance');
  const advances     = filtered.filter(p => p.type === 'advance');

  const totalBillPayments = billPayments.reduce((s, p) => s + p.amount, 0);
  const totalAdvances     = advances.reduce((s, p) => s + p.amount, 0);

  // ── Recalculate bill after delete ─────────────────────
  const recalculateBill = async (billId) => {
    if (!billId) return;
    try {
      const allPay  = await getAllPayments();
      const allBills = await getAllBills();
      const bill    = allBills.find(b => b.id === billId);
      if (!bill) return;
      const totalPaid = allPay
        .filter(p => p.billId === billId)
        .reduce((s, p) => s + p.amount, 0);
      const newStatus = computeStatus(bill.amount, totalPaid);
      await updateBill(billId, { paidAmount: totalPaid, status: newStatus });
    } catch (e) {
      console.error('recalculateBill error:', e);
    }
  };

  // ── Delete ────────────────────────────────────────────
  const handleDelete = (payment) => {
    Alert.alert(
      '🗑️ Delete Payment',
      `Delete payment of Rs ${payment.amount.toLocaleString()} from ${payment.customerName}?\n\n` +
      (payment.billId
        ? 'This will update the linked bill balance.'
        : 'This advance will be removed from the ledger.'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePayment(payment.id);
              if (payment.billId) {
                await recalculateBill(payment.billId);
              }
              loadPayments();
              Alert.alert('✅ Deleted', 'Payment has been removed.');
            } catch (e) {
              Alert.alert('Error', 'Could not delete payment.');
            }
          },
        },
      ]
    );
  };

  // ── Clear filters ─────────────────────────────────────
  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setFromDate(null);
    setToDate(null);
  };

  const hasActiveFilters =
    search || typeFilter !== 'all' || fromDate || toDate;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7A2B83" />
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* ── TOP BAR ── */}
      <View style={styles.topBar}>

        {/* Search row */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search customer or farmer..."
            placeholderTextColor="#bbb"
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity
            style={[styles.filterBtn,
              showFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(p => !p)}
          >
            <Text style={styles.filterBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Filter panel */}
        {showFilters && (
          <View style={styles.filterPanel}>

            {/* Type chips */}
            <Text style={styles.filterPanelLabel}>Payment Type</Text>
            <View style={styles.chipRow}>
              {[
                { key: 'all',     label: 'All' },
                { key: 'payment', label: '💰 Bill Payments' },
                { key: 'advance', label: '⬆️ Advances' },
              ].map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.chip,
                    typeFilter === t.key && styles.chipActive]}
                  onPress={() => setTypeFilter(t.key)}
                >
                  <Text style={[styles.chipText,
                    typeFilter === t.key && styles.chipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date range */}
            <Text style={styles.filterPanelLabel}>Date Range</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.dateBtn,
                  fromDate && styles.dateBtnActive]}
                onPress={() => setShowFromPicker(true)}
              >
                <Text style={styles.dateBtnLabel}>From</Text>
                <Text style={styles.dateBtnText}>
                  {fromDate ? formatDate(fromDate) : 'Any'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.dateArrow}>→</Text>
              <TouchableOpacity
                style={[styles.dateBtn,
                  toDate && styles.dateBtnActive]}
                onPress={() => setShowToPicker(true)}
              >
                <Text style={styles.dateBtnLabel}>To</Text>
                <Text style={styles.dateBtnText}>
                  {toDate ? formatDate(toDate) : 'Any'}
                </Text>
              </TouchableOpacity>
              {(fromDate || toDate) && (
                <TouchableOpacity
                  style={styles.clearDateBtn}
                  onPress={() => { setFromDate(null); setToDate(null); }}
                >
                  <Text style={styles.clearDateBtnText}>✕ Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Clear all */}
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={clearFilters}
              >
                <Text style={styles.clearAllBtnText}>
                  ✕ Clear All Filters
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {showFromPicker && (
          <DateTimePicker
            value={fromDate || new Date()}
            mode="date" display="default"
            maximumDate={toDate || new Date()}
            onChange={(e, d) => {
              setShowFromPicker(false);
              if (d) setFromDate(d);
            }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={toDate || new Date()}
            mode="date" display="default"
            minimumDate={fromDate || undefined}
            maximumDate={new Date()}
            onChange={(e, d) => {
              setShowToPicker(false);
              if (d) setToDate(d);
            }}
          />
        )}

        {/* Count row */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {filtered.length} of {allPayments.length} payments
          </Text>
          <Text style={styles.totalText}>
            Total: Rs {(totalBillPayments + totalAdvances).toLocaleString()}
          </Text>
        </View>
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
        keyboardShouldPersistTaps="handled"
      >

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No Payments Found</Text>
            <Text style={styles.emptySubtitle}>
              {allPayments.length === 0
                ? 'No payments have been recorded yet.'
                : 'No payments match your filters.'}
            </Text>
          </View>
        ) : (
          <>
            {/* ── BILL PAYMENTS SECTION ── */}
            {(typeFilter === 'all' || typeFilter === 'payment') &&
              billPayments.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    💰 Bill Payments
                  </Text>
                  <View style={styles.sectionMeta}>
                    <Text style={styles.sectionCount}>
                      {billPayments.length}
                    </Text>
                    <Text style={styles.sectionTotal}>
                      Rs {totalBillPayments.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {billPayments.map(p => (
                  <PaymentCard
                    key={p.id}
                    payment={p}
                    onEdit={() => navigation.navigate('EditPayment', { payment: p })}
                    onDelete={() => handleDelete(p)}
                  />
                ))}
              </View>
            )}

            {/* ── ADVANCES SECTION ── */}
            {(typeFilter === 'all' || typeFilter === 'advance') &&
              advances.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    ⬆️ Advance Payments
                  </Text>
                  <View style={styles.sectionMeta}>
                    <Text style={styles.sectionCount}>
                      {advances.length}
                    </Text>
                    <Text style={styles.sectionTotal}>
                      Rs {totalAdvances.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {advances.map(p => (
                  <PaymentCard
                    key={p.id}
                    payment={p}
                    onEdit={() => navigation.navigate('EditPayment', { payment: p })}
                    onDelete={() => handleDelete(p)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <Text style={styles.pullHint}>↓ Pull down to refresh</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Payment Card ──────────────────────────────────────────
function PaymentCard({ payment, onEdit, onDelete }) {
  const isAdvance = payment.type === 'advance';
  return (
    <View style={styles.paymentCard}>
      <View style={styles.paymentCardBody}>
        <View style={styles.paymentCardLeft}>
          <Text style={styles.paymentCustomer} numberOfLines={1}>
            {payment.customerName}
          </Text>
          {payment.farmerName ? (
            <Text style={styles.paymentFarmer}>
              👨‍🌾 {payment.farmerName}
            </Text>
          ) : null}
          <Text style={styles.paymentDate}>📅 {payment.date}</Text>
          {payment.notes ? (
            <Text style={styles.paymentNotes} numberOfLines={1}>
              📝 {payment.notes}
            </Text>
          ) : null}
        </View>
        <View style={styles.paymentCardRight}>
          <Text style={styles.paymentAmount}>
            Rs {payment.amount.toLocaleString()}
          </Text>
          <View style={[styles.paymentTypeBadge,
            isAdvance && styles.paymentTypeBadgeAdvance]}>
            <Text style={[styles.paymentTypeBadgeText,
              isAdvance && styles.paymentTypeBadgeTextAdvance]}>
              {isAdvance ? '⬆️ Advance' : '💰 Payment'}
            </Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.paymentActions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={onEdit}
        >
          <Text style={styles.editBtnText}>✏️  Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
        >
          <Text style={styles.deleteBtnText}>🗑️  Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText:      { marginTop: 12, color: '#7A2B83', fontSize: 15 },

  // Top Bar
  topBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchInput: {
    flex: 1, backgroundColor: '#f5f5f5',
    borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, color: '#222',
    borderWidth: 1, borderColor: '#eee',
  },
  filterBtn: {
    backgroundColor: '#f5f5f5', borderRadius: 10,
    width: 44, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: '#eee',
  },
  filterBtnActive:  { backgroundColor: '#f3e5f5', borderColor: '#7A2B83' },
  filterBtnText:    { fontSize: 18 },

  // Filter Panel
  filterPanel: {
    backgroundColor: '#fafafa', borderRadius: 10,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#eee',
  },
  filterPanelLabel: {
    fontSize: 11, fontWeight: '700',
    color: '#888', marginBottom: 8,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  chipRow:      { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  chip: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#ddd',
  },
  chipActive:     { backgroundColor: '#7A2B83', borderColor: '#7A2B83' },
  chipText:       { fontSize: 12, color: '#666', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8,
  },
  dateBtn: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 8, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1,
    borderColor: '#ddd',
  },
  dateBtnActive:  { borderColor: '#7A2B83', backgroundColor: '#f3e5f5' },
  dateBtnLabel:   { fontSize: 10, color: '#aaa', marginBottom: 2 },
  dateBtnText:    { fontSize: 12, color: '#444', fontWeight: '600' },
  dateArrow:      { fontSize: 16, color: '#7A2B83', fontWeight: 'bold' },
  clearDateBtn: {
    backgroundColor: '#ffebee', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  clearDateBtnText: { color: '#e53935', fontSize: 12, fontWeight: '700' },

  clearAllBtn: {
    backgroundColor: '#ffebee', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: '#ef9a9a',
  },
  clearAllBtnText: { color: '#e53935', fontWeight: '700', fontSize: 13 },

  countRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  countText: { fontSize: 11, color: '#aaa' },
  totalText: { fontSize: 12, color: '#7A2B83', fontWeight: '700' },

  scroll: { padding: 14, paddingBottom: 40 },

  // Section
  section:       { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  sectionMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCount: {
    fontSize: 12, color: '#888',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10,
  },
  sectionTotal: {
    fontSize: 13, color: '#2e7d32', fontWeight: '700',
  },

  // Payment Card
  paymentCard: {
    backgroundColor: '#fff', borderRadius: 12,
    marginBottom: 8, overflow: 'hidden',
    elevation: 1, borderWidth: 0.5,
    borderColor: '#e0e0e0',
  },
  paymentCardBody: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 14,
  },
  paymentCardLeft:  { flex: 1, marginRight: 10 },
  paymentCardRight: { alignItems: 'flex-end' },
  paymentCustomer: {
    fontSize: 14, fontWeight: 'bold', color: '#222', marginBottom: 3,
  },
  paymentFarmer: { fontSize: 12, color: '#666', marginBottom: 2 },
  paymentDate:   { fontSize: 12, color: '#888', marginBottom: 2 },
  paymentNotes:  { fontSize: 11, color: '#aaa' },
  paymentAmount: {
    fontSize: 16, fontWeight: 'bold',
    color: '#2e7d32', marginBottom: 6,
  },
  paymentTypeBadge: {
    backgroundColor: '#e8f5e9', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#a5d6a7',
  },
  paymentTypeBadgeAdvance: {
    backgroundColor: '#e3f2fd', borderColor: '#90caf9',
  },
  paymentTypeBadgeText: {
    fontSize: 10, fontWeight: '700', color: '#2e7d32',
  },
  paymentTypeBadgeTextAdvance: { color: '#1565c0' },

  // Action buttons
  paymentActions: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
  },
  editBtn: {
    flex: 1, paddingVertical: 10,
    alignItems: 'center', backgroundColor: '#f3e5f5',
    borderRightWidth: 1, borderRightColor: '#f5f5f5',
  },
  editBtnText:   { color: '#7A2B83', fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    flex: 1, paddingVertical: 10,
    alignItems: 'center', backgroundColor: '#ffebee',
  },
  deleteBtnText: { color: '#e53935', fontWeight: '700', fontSize: 13 },

  // Empty
  emptyState:    { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIcon:     { fontSize: 56, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  pullHint:      { textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 16 },
});