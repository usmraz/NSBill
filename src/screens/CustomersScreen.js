import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Alert, ActivityIndicator,
  RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAllCustomers, addCustomer, addFarmer,
  renameCustomer, renameFarmer, syncCustomersFromBills,
} from '../storage/customerStorage';

export default function CustomersScreen() {
  const [customers,   setCustomers]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [expanded,    setExpanded]    = useState(null);

  // ── Modal state ───────────────────────────────────────────
  const [modal, setModal] = useState({
    visible:  false,
    type:     '',       // 'addCustomer' | 'addFarmer' | 'renameCustomer' | 'renameFarmer'
    value:    '',
    original: '',
    extra:    '',       // customerName when renaming a farmer
  });

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [])
  );

  const loadCustomers = async () => {
    try {
      // Auto-sync from bills first
      await syncCustomersFromBills();
      const data = await getAllCustomers();
      // Sort alphabetically
      data.sort((a, b) => a.name.localeCompare(b.name));
      data.forEach(c => {
        c.farmers.sort((a, b) => a.name.localeCompare(b.name));
      });
      setCustomers(data);
    } catch (e) {
      console.error('loadCustomers error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCustomers();
  };

  // ── Modal helpers ─────────────────────────────────────────
  const openModal = (type, original = '', extra = '') => {
    setModal({ visible: true, type, value: original, original, extra });
  };

  const closeModal = () => {
    setModal({ visible: false, type: '', value: '', original: '', extra: '' });
  };

  const handleModalSave = async () => {
    const { type, value, original, extra } = modal;
    const trimmed = value.trim();

    if (!trimmed) {
      Alert.alert('Empty Name', 'Please enter a name.');
      return;
    }

    try {
      if (type === 'addCustomer') {
        await addCustomer(trimmed);
        Alert.alert('✅ Added', `Customer "${trimmed}" added.`);
      } else if (type === 'addFarmer') {
        await addFarmer(original, trimmed);
        Alert.alert('✅ Added', `Farmer "${trimmed}" added under ${original}.`);
      } else if (type === 'renameCustomer') {
        if (trimmed.toLowerCase() === original.toLowerCase()) {
          closeModal();
          return;
        }
        await renameCustomer(original, trimmed);
        Alert.alert('✅ Renamed', `All records updated to "${trimmed}".`);
      } else if (type === 'renameFarmer') {
        if (trimmed.toLowerCase() === original.toLowerCase()) {
          closeModal();
          return;
        }
        await renameFarmer(extra, original, trimmed);
        Alert.alert('✅ Renamed', `All records updated to "${trimmed}".`);
      }
      closeModal();
      loadCustomers();
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    }
  };

  // ── Modal title helper ────────────────────────────────────
  const modalTitle = () => {
    switch (modal.type) {
      case 'addCustomer':     return '➕ Add New Customer';
      case 'addFarmer':       return `➕ Add Farmer under\n${modal.original}`;
      case 'renameCustomer':  return '✏️ Rename Customer';
      case 'renameFarmer':    return '✏️ Rename Farmer';
      default:                return '';
    }
  };

  // ── Filter ────────────────────────────────────────────────
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.farmers.some(f =>
      f.name.toLowerCase().includes(search.toLowerCase())
    )
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7A2B83" />
        <Text style={styles.loadingText}>Loading customers...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* ── HEADER BAR ── */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerLabel}>TOTAL CUSTOMERS</Text>
          <Text style={styles.headerCount}>{customers.length}</Text>
        </View>
        <TouchableOpacity
          style={styles.addCustomerBtn}
          onPress={() => openModal('addCustomer')}
        >
          <Text style={styles.addCustomerBtnText}>➕ Add Customer</Text>
        </TouchableOpacity>
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
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Customers Yet</Text>
            <Text style={styles.emptySubtitle}>
              Add a customer above, or they will appear automatically when you create bills.
            </Text>
          </View>
        ) : (
          filtered.map(customer => (
            <View key={customer.id} style={styles.customerCard}>

              {/* Customer Row */}
              <View style={styles.customerRow}>
                <TouchableOpacity
                  style={styles.customerRowLeft}
                  onPress={() =>
                    setExpanded(p =>
                      p === customer.id ? null : customer.id
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.customerAvatar}>
                    <Text style={styles.customerAvatarText}>
                      {customer.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.customerName}>{customer.name}</Text>
                    <Text style={styles.customerMeta}>
                      {customer.farmers.length} farmer
                      {customer.farmers.length !== 1 ? 's' : ''}
                      {'  '}
                      <Text style={styles.expandHint}>
                        {expanded === customer.id ? '▲ hide' : '▼ show'}
                      </Text>
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Customer Actions */}
                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => openModal('renameCustomer', customer.name)}
                  >
                    <Text style={styles.iconBtnText}>✏️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Farmers List */}
              {expanded === customer.id && (
                <View style={styles.farmerList}>

                  {customer.farmers.length === 0 ? (
                    <Text style={styles.noFarmersText}>
                      No farmers yet under this customer.
                    </Text>
                  ) : (
                    customer.farmers.map(farmer => (
                      <View key={farmer.id} style={styles.farmerRow}>
                        <Text style={styles.farmerIcon}>👨‍🌾</Text>
                        <Text style={styles.farmerName}>{farmer.name}</Text>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() =>
                            openModal('renameFarmer', farmer.name, customer.name)
                          }
                        >
                          <Text style={styles.iconBtnText}>✏️</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  {/* Add Farmer Button */}
                  <TouchableOpacity
                    style={styles.addFarmerBtn}
                    onPress={() => openModal('addFarmer', customer.name)}
                  >
                    <Text style={styles.addFarmerBtnText}>
                      ➕ Add Farmer under {customer.name}
                    </Text>
                  </TouchableOpacity>

                </View>
              )}
            </View>
          ))
        )}

        <Text style={styles.pullHint}>↓ Pull down to refresh</Text>
      </ScrollView>

      {/* ── MODAL ── */}
      <Modal
        visible={modal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>

            <Text style={styles.modalTitle}>{modalTitle()}</Text>

            <TextInput
              style={styles.modalInput}
              value={modal.value}
              onChangeText={v => setModal(p => ({ ...p, value: v }))}
              placeholder="Enter name..."
              placeholderTextColor="#bbb"
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleModalSave}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeModal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleModalSave}
              >
                <Text style={styles.modalSaveText}>
                  {modal.type.startsWith('add') ? 'Add' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText:      { marginTop: 12, color: '#7A2B83', fontSize: 15 },

  // Header
  headerBar: {
    backgroundColor: '#7A2B83',
    paddingHorizontal: 20, paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  headerLabel: {
    color: '#e8c5ec', fontSize: 11,
    fontWeight: '700', letterSpacing: 1,
  },
  headerCount: {
    color: '#F9E219', fontSize: 32, fontWeight: 'bold',
  },
  addCustomerBtn: {
    backgroundColor: '#F9E219',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
  },
  addCustomerBtnText: {
    color: '#1a1a1a', fontWeight: 'bold', fontSize: 14,
  },

  // Search
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#222',
  },

  scroll: { padding: 14, paddingBottom: 40 },

  // Customer Card
  customerCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginBottom: 10, overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3,
  },
  customerRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14,
  },
  customerRowLeft: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  customerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7A2B83',
    alignItems: 'center', justifyContent: 'center',
  },
  customerAvatarText: {
    color: '#fff', fontSize: 18, fontWeight: 'bold',
  },
  customerName: {
    fontSize: 16, fontWeight: 'bold', color: '#222',
  },
  customerMeta: {
    fontSize: 12, color: '#999', marginTop: 2,
  },
  expandHint: {
    color: '#7A2B83', fontWeight: '600',
  },
  actionBtns: {
    flexDirection: 'row', gap: 6,
  },
  iconBtn: {
    backgroundColor: '#f5f5f5', borderRadius: 8,
    padding: 8,
  },
  iconBtnText: { fontSize: 16 },

  // Farmer List
  farmerList: {
    backgroundColor: '#fafafa',
    borderTopWidth: 1, borderTopColor: '#f0e0f4',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  farmerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
    gap: 10,
  },
  farmerIcon: { fontSize: 16 },
  farmerName: {
    flex: 1, fontSize: 14, color: '#444', fontWeight: '500',
  },
  noFarmersText: {
    color: '#bbb', fontSize: 13,
    textAlign: 'center', paddingVertical: 14,
  },
  addFarmerBtn: {
    marginTop: 12, backgroundColor: '#f3e5f5',
    borderRadius: 10, paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#ce93d8',
    borderStyle: 'dashed',
  },
  addFarmerBtnText: {
    color: '#7A2B83', fontWeight: '700', fontSize: 13,
  },

  // Empty
  emptyState:    { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIcon:     { fontSize: 56, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  pullHint:      { textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 16 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 24, width: '100%',
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16, fontWeight: 'bold',
    color: '#7A2B83', marginBottom: 16,
    textAlign: 'center', lineHeight: 24,
  },
  modalInput: {
    backgroundColor: '#f5f5f5', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#222',
    borderWidth: 1.5, borderColor: '#ddd',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row', gap: 10,
  },
  modalCancelBtn: {
    flex: 1, backgroundColor: '#f0f0f0',
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: '#666', fontWeight: '700', fontSize: 15 },
  modalSaveBtn: {
    flex: 1, backgroundColor: '#7A2B83',
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});