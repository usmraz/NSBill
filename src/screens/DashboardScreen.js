import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, RefreshControl,
  ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView as SafeArea } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getTotalReceivable, getDueBills, isBillOverdue } from '../storage/billStorage';
import { buildLedger } from '../storage/ledgerStorage';

export default function DashboardScreen({ navigation }) {
  const [dueBills,          setDueBills]          = useState([]);
  const [totalReceivable,   setTotalReceivable]   = useState(0);
  const [customerSummaries, setCustomerSummaries] = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [refreshing,        setRefreshing]        = useState(false);
  const [search,            setSearch]            = useState('');
  const [statusFilter,      setStatusFilter]      = useState('all');
  const [showFilters,       setShowFilters]       = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [total, ledger, due] = await Promise.all([
        getTotalReceivable(),
        buildLedger(),
        getDueBills(),
      ]);
      setTotalReceivable(total);
      setCustomerSummaries(ledger);
      setDueBills(due);
    } catch (e) {
      console.error('loadData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':    return '#4caf50';
      case 'partial': return '#ff9800';
      default:        return '#e53935';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid':    return 'Paid ✓';
      case 'partial': return 'Partial';
      default:        return 'Unpaid';
    }
  };

  // Filter due bills
  const filteredBills = dueBills.filter(bill => {
    const matchesSearch =
      bill.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (bill.farmerName || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const overdueBills  = dueBills.filter(b => isBillOverdue(b));
  const overdueAmount = overdueBills.reduce(
    (s, b) => s + (b.amount - (b.paidAmount || 0)), 0
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7A2B83" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeArea style={styles.container}>
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

        {/* ── SUMMARY CARD ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL RECEIVABLES</Text>
          <Text style={styles.summaryAmount}>
            Rs {totalReceivable.toLocaleString()}
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>
                {dueBills.length} due bills
              </Text>
            </View>
            {overdueBills.length > 0 && (
              <View style={[styles.summaryPill, styles.summaryPillRed]}>
                <Text style={styles.summaryPillText}>
                  ⚠️ {overdueBills.length} overdue
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── OVERDUE ALERT ── */}
        {overdueBills.length > 0 && (
          <View style={styles.overdueAlert}>
            <Text style={styles.overdueAlertText}>
              ⚠️ {overdueBills.length} bill{overdueBills.length !== 1 ? 's' : ''} overdue
              — Rs {overdueAmount.toLocaleString()} pending
            </Text>
          </View>
        )}

        {/* ── ACTION BUTTONS ── */}
        <View style={styles.actionRow}>
  <TouchableOpacity
    style={styles.addButton}
    onPress={() => navigation.navigate('AddBillTab')}
  >
    <Text style={styles.addButtonIcon}>➕</Text>
    <Text style={styles.addButtonText}>Add Bill</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={styles.paymentButton}
    onPress={() => navigation.navigate('ReceivePayment')}
  >
    <Text style={styles.addButtonIcon}>💰</Text>
    <Text style={styles.paymentButtonText}>Receive Payment</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={styles.allBillsButton}
    onPress={() => navigation.navigate('AllBills')}
  >
    <Text style={styles.addButtonIcon}>📋</Text>
    <Text style={styles.allBillsButtonText}>All Bills</Text>
  </TouchableOpacity>
</View>
        {/* ── SEARCH BAR ── */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search customer or farmer..."
            placeholderTextColor="#bbb"
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity
            style={[styles.filterToggleBtn,
              showFilters && styles.filterToggleBtnActive]}
            onPress={() => setShowFilters(p => !p)}
          >
            <Text style={styles.filterToggleBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filterRow}>
            {['all', 'unpaid', 'partial'].map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip,
                  statusFilter === s && styles.filterChipActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text style={[styles.filterChipText,
                  statusFilter === s && styles.filterChipTextActive]}>
                  {s === 'all'    ? 'All Due'
                  : s === 'unpaid' ? '✕ Unpaid'
                  :                  '◑ Partial'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── CUSTOMER BALANCE CARDS ── */}
        {customerSummaries.length > 0 && (
          <View style={styles.customerSummarySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Customer Balances</Text>
              <Text style={styles.sectionCount}>
                {customerSummaries.length} active
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.customerSummaryScroll}
              keyboardShouldPersistTaps="handled"
            >
              {customerSummaries.map(c => (
                <TouchableOpacity
                  key={c.customerName}
                  style={styles.customerSummaryCard}
                  onPress={() => navigation.navigate('LedgerTab')}
                >
                  <Text style={styles.customerSummaryName} numberOfLines={1}>
                    {c.customerName}
                  </Text>
                  <Text style={styles.customerSummaryAmount}>
                    Rs {c.outstanding.toLocaleString()}
                  </Text>
                  <Text style={styles.customerSummaryFarmers}>
                    {c.farmers.length} farmer{c.farmers.length !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.customerSummaryHint}>
                    Tap to view ledger →
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── DUE BILLS SECTION ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Due Bills</Text>
          <Text style={styles.sectionCount}>
            {filteredBills.length} of {dueBills.length}
          </Text>
        </View>

        {dueBills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>No Due Bills</Text>
            <Text style={styles.emptySubtitle}>
              All bills are either paid or have no due date set.
              Add a bill with a due date to see it here.
            </Text>
          </View>
        ) : filteredBills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No Results</Text>
            <Text style={styles.emptySubtitle}>
              No bills match your search or filter.
            </Text>
          </View>
        ) : (
          filteredBills.map(bill => {
            const overdue  = isBillOverdue(bill);
            const outstanding = bill.amount - (bill.paidAmount || 0);
            return (
              <TouchableOpacity
                key={bill.id}
                style={[styles.billCard, overdue && styles.billCardOverdue]}
                onPress={() => navigation.navigate('BillDetail', { bill })}
                activeOpacity={0.75}
              >
                {/* Overdue banner */}
                {overdue && (
                  <View style={styles.overdueBanner}>
                    <Text style={styles.overdueBannerText}>
                      ⚠️ OVERDUE — Due: {bill.dueDate}
                    </Text>
                  </View>
                )}

                <View style={styles.billCardTop}>
                  <View style={styles.billCardLeft}>
                    <Text style={styles.billCustomer} numberOfLines={1}>
                      {bill.customerName}
                    </Text>
                    {bill.farmerName ? (
                      <Text style={styles.billFarmer} numberOfLines={1}>
                        👨‍🌾 {bill.farmerName}
                      </Text>
                    ) : null}
                    <Text style={styles.billDate}>
                      📅 Bill: {bill.date}
                    </Text>
                    {!overdue && bill.dueDate && (
                      <Text style={styles.dueDateText}>
                        🗓️ Due: {bill.dueDate}
                      </Text>
                    )}
                  </View>
                  <View style={styles.billCardRight}>
                    <Text style={[
                      styles.billAmount,
                      overdue && styles.billAmountOverdue,
                    ]}>
                      Rs {outstanding.toLocaleString()}
                    </Text>
                    <Text style={styles.billAmountLabel}>outstanding</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(bill.status) + '20',
                        borderColor:      getStatusColor(bill.status) }
                    ]}>
                      <Text style={[styles.statusText,
                        { color: getStatusColor(bill.status) }]}>
                        {getStatusLabel(bill.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                {bill.notes ? (
                  <Text style={styles.billNotes} numberOfLines={1}>
                    📝 {bill.notes}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.pullToRefresh}>↓ Pull down to refresh</Text>

      </ScrollView>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText:      { marginTop: 12, color: '#7A2B83', fontSize: 15 },
  scroll:           { padding: 16, paddingBottom: 40 },

  // Summary Card
  summaryCard: {
    backgroundColor: '#7A2B83', borderRadius: 20,
    padding: 24, marginBottom: 12, alignItems: 'center',
    elevation: 6,
    shadowColor: '#7A2B83',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  summaryLabel: {
    color: '#e8c5ec', fontSize: 12,
    fontWeight: '700', letterSpacing: 1.5, marginBottom: 6,
  },
  summaryAmount: {
    color: '#F9E219', fontSize: 44,
    fontWeight: 'bold', marginBottom: 12,
  },
  summaryRow:        { flexDirection: 'row', gap: 8 },
  summaryPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  summaryPillRed: { backgroundColor: 'rgba(229,57,53,0.5)' },
  summaryPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Overdue Alert
  overdueAlert: {
    backgroundColor: '#ffebee', borderRadius: 10,
    padding: 12, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#e53935',
  },
  overdueAlertText: {
    color: '#c62828', fontWeight: '700', fontSize: 13,
  },

  // Action Buttons
  actionRow:    { flexDirection: 'row', gap: 10, marginBottom: 14 },
  addButton: {
    flex: 1, backgroundColor: '#F9E219',
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', elevation: 4,
  },
  addButtonIcon: { fontSize: 22, marginBottom: 4 },
  addButtonText: { color: '#1a1a1a', fontSize: 14, fontWeight: 'bold' },
  paymentButton: {
    flex: 1, backgroundColor: '#2e7d32',
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', elevation: 4,
  },
  paymentButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },

  // Search & Filter
  searchRow:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchInput: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: '#222',
    borderWidth: 1.5, borderColor: '#ddd',
  },
  filterToggleBtn: {
    backgroundColor: '#fff', borderRadius: 12,
    width: 48, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#ddd',
  },
  filterToggleBtnActive: {
    backgroundColor: '#f3e5f5', borderColor: '#7A2B83',
  },
  filterToggleBtnText: { fontSize: 20 },
  filterRow: {
    flexDirection: 'row', gap: 8,
    marginBottom: 14, flexWrap: 'wrap',
  },
  filterChip: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: '#ddd',
  },
  filterChipActive:     { backgroundColor: '#7A2B83', borderColor: '#7A2B83' },
  filterChipText:       { fontSize: 13, color: '#666', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },

  // Customer Summary Cards
  customerSummarySection: { marginBottom: 20 },
  customerSummaryScroll:  { paddingBottom: 4, gap: 10 },
  customerSummaryCard: {
    backgroundColor: '#7A2B83', borderRadius: 14,
    padding: 16, width: 160, elevation: 3,
    shadowColor: '#7A2B83',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 5,
  },
  customerSummaryName: {
    color: '#e8c5ec', fontSize: 13,
    fontWeight: '600', marginBottom: 6,
  },
  customerSummaryAmount: {
    color: '#F9E219', fontSize: 20,
    fontWeight: 'bold', marginBottom: 4,
  },
  customerSummaryFarmers: { color: '#fff', fontSize: 11, marginBottom: 8 },
  customerSummaryHint:    { color: 'rgba(255,255,255,0.5)', fontSize: 10 },

  // Section Header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sectionCount: {
    fontSize: 13, color: '#888',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
  },

  // Bill Cards
  billCard: {
    backgroundColor: '#fff', borderRadius: 14,
    marginBottom: 10, overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3,
  },
  billCardOverdue: {
    borderWidth: 2, borderColor: '#e53935',
    backgroundColor: '#fff8f8',
  },
  overdueBanner: {
    backgroundColor: '#e53935',
    paddingHorizontal: 14, paddingVertical: 6,
  },
  overdueBannerText: {
    color: '#fff', fontWeight: 'bold', fontSize: 12,
  },
  billCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: 14,
  },
  billCardLeft:  { flex: 1, marginRight: 12 },
  billCardRight: { alignItems: 'flex-end' },
  billCustomer: {
    fontSize: 16, fontWeight: 'bold',
    color: '#222', marginBottom: 3,
  },
  billFarmer:   { fontSize: 13, color: '#666', marginBottom: 3 },
  billDate:     { fontSize: 12, color: '#888' },
  dueDateText:  { fontSize: 12, color: '#7A2B83', fontWeight: '600', marginTop: 2 },
  billAmount: {
    fontSize: 18, fontWeight: 'bold', color: '#7A2B83',
  },
  billAmountOverdue: { color: '#e53935' },
  billAmountLabel:   { fontSize: 10, color: '#aaa', marginBottom: 4 },
  statusBadge: {
    borderRadius: 6, paddingHorizontal: 8,
    paddingVertical: 2, borderWidth: 1,
  },
  statusText:  { fontSize: 11, fontWeight: 'bold' },
  billNotes: {
    fontSize: 12, color: '#aaa',
    paddingHorizontal: 14, paddingBottom: 10,
  },

  // Empty State
  emptyState:    { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30 },
  emptyIcon:     { fontSize: 56, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  pullToRefresh: { textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 16 },
allBillsButton: {
  flex: 1, backgroundColor: '#1565c0',
  borderRadius: 14, paddingVertical: 16,
  alignItems: 'center', elevation: 4,
},
allBillsButtonText: {
  color: '#fff', fontSize: 14, fontWeight: 'bold',
},
});
