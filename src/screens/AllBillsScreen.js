import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAllBills, isBillOverdue } from '../storage/billStorage';

export default function AllBillsScreen({ navigation }) {
  const [bills,      setBills]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters,  setShowFilters]  = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadBills();
    }, [])
  );

  const loadBills = async () => {
    try {
      const all = await getAllBills();
      setBills(all);
    } catch (e) {
      console.error('loadBills error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBills();
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

  const filtered = bills.filter(bill => {
    const matchesSearch =
      bill.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (bill.farmerName || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7A2B83" />
        <Text style={styles.loadingText}>Loading bills...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* ── SEARCH & FILTER ── */}
      <View style={styles.topBar}>
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

        {showFilters && (
          <View style={styles.filterRow}>
            {['all', 'unpaid', 'partial', 'paid'].map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip,
                  statusFilter === s && styles.filterChipActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text style={[styles.filterChipText,
                  statusFilter === s && styles.filterChipTextActive]}>
                  {s === 'all'     ? 'All'
                  : s === 'unpaid'  ? '✕ Unpaid'
                  : s === 'partial' ? '◑ Partial'
                  :                   '✓ Paid'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {filtered.length} of {bills.length} bills
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
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Bills Found</Text>
            <Text style={styles.emptySubtitle}>
              {bills.length === 0
                ? 'No bills have been created yet.'
                : 'No bills match your search or filter.'}
            </Text>
          </View>
        ) : (
          filtered.map(bill => {
            const overdue     = isBillOverdue(bill);
            const outstanding = bill.amount - (bill.paidAmount || 0);
            return (
              <View
                key={bill.id}
                style={[styles.billCard,
                  overdue && styles.billCardOverdue]}
              >
                {/* Overdue Banner */}
                {overdue && (
                  <View style={styles.overdueBanner}>
                    <Text style={styles.overdueBannerText}>
                      ⚠️ OVERDUE — Due: {bill.dueDate}
                    </Text>
                  </View>
                )}

                <View style={styles.billCardBody}>
                  <View style={styles.billCardLeft}>
                    <Text style={styles.billCustomer} numberOfLines={1}>
                      {bill.customerName}
                    </Text>
                    {bill.farmerName ? (
                      <Text style={styles.billFarmer}>
                        👨‍🌾 {bill.farmerName}
                      </Text>
                    ) : null}
                    <Text style={styles.billDate}>📅 {bill.date}</Text>
                    {bill.dueDate ? (
                      <Text style={[styles.billDueDate,
                        overdue && styles.billDueDateOverdue]}>
                        🗓️ Due: {bill.dueDate}
                      </Text>
                    ) : null}
                    {bill.notes ? (
                      <Text style={styles.billNotes} numberOfLines={1}>
                        📝 {bill.notes}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.billCardRight}>
                    <Text style={[styles.billAmount,
                      overdue && styles.billAmountOverdue]}>
                      Rs {outstanding.toLocaleString()}
                    </Text>
                    <Text style={styles.billAmountLabel}>outstanding</Text>
                    <Text style={styles.billTotal}>
                      Total: Rs {bill.amount.toLocaleString()}
                    </Text>
                    <View style={[styles.statusBadge,
                      { backgroundColor: getStatusColor(bill.status) + '20',
                        borderColor: getStatusColor(bill.status) }]}>
                      <Text style={[styles.statusText,
                        { color: getStatusColor(bill.status) }]}>
                        {getStatusLabel(bill.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.billActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('BillDetail', { bill })}
                  >
                    <Text style={styles.actionBtnText}>👁️ View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnEdit]}
                    onPress={() => navigation.navigate('EditBill', { bill })}
                  >
                    <Text style={[styles.actionBtnText, styles.actionBtnEditText]}>
                      ✏️ Edit
                    </Text>
                  </TouchableOpacity>
                  {bill.status !== 'paid' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnPay]}
                      onPress={() => navigation.navigate('ReceivePayment', { bill })}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnPayText]}>
                        💰 Pay
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.pullHint}>↓ Pull down to refresh</Text>
      </ScrollView>
    </SafeAreaView>
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
    width: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#eee',
  },
  filterBtnActive:   { backgroundColor: '#f3e5f5', borderColor: '#7A2B83' },
  filterBtnText:     { fontSize: 18 },
  filterRow: {
    flexDirection: 'row', gap: 8,
    marginBottom: 8, flexWrap: 'wrap',
  },
  filterChip: {
    backgroundColor: '#f5f5f5', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#ddd',
  },
  filterChipActive:     { backgroundColor: '#7A2B83', borderColor: '#7A2B83' },
  filterChipText:       { fontSize: 12, color: '#666', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  countRow:   { alignItems: 'flex-end' },
  countText:  { fontSize: 12, color: '#aaa' },

  scroll: { padding: 14, paddingBottom: 40 },

  // Bill Card
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
  billCardBody: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 14,
  },
  billCardLeft:  { flex: 1, marginRight: 10 },
  billCardRight: { alignItems: 'flex-end' },

  billCustomer: {
    fontSize: 15, fontWeight: 'bold',
    color: '#222', marginBottom: 3,
  },
  billFarmer:   { fontSize: 12, color: '#666', marginBottom: 2 },
  billDate:     { fontSize: 12, color: '#888', marginBottom: 2 },
  billDueDate:  { fontSize: 12, color: '#7A2B83', fontWeight: '600', marginBottom: 2 },
  billDueDateOverdue: { color: '#e53935' },
  billNotes:    { fontSize: 11, color: '#aaa', marginTop: 2 },

  billAmount: {
    fontSize: 17, fontWeight: 'bold', color: '#7A2B83',
  },
  billAmountOverdue: { color: '#e53935' },
  billAmountLabel:   { fontSize: 10, color: '#aaa', marginBottom: 2 },
  billTotal:         { fontSize: 11, color: '#bbb', marginBottom: 4 },
  statusBadge: {
    borderRadius: 6, paddingHorizontal: 8,
    paddingVertical: 2, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: 'bold' },

  // Action Buttons Row
  billActions: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
  },
  actionBtn: {
    flex: 1, paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1, borderRightColor: '#f5f5f5',
  },
  actionBtnEdit: { backgroundColor: '#f3e5f5' },
  actionBtnPay:  { backgroundColor: '#e8f5e9' },
  actionBtnText: {
    fontSize: 13, fontWeight: '600', color: '#666',
  },
  actionBtnEditText: { color: '#7A2B83' },
  actionBtnPayText:  { color: '#2e7d32' },

  // Empty
  emptyState: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30,
  },
  emptyIcon:     { fontSize: 56, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  pullHint:      { textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 16 },
});