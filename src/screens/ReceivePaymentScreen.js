import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { savePayment }                    from '../storage/paymentStorage';
import { applyPaymentToBill, getAllBills } from '../storage/billStorage';
import AutocompleteInput                  from '../components/AutocompleteInput';
import {
  getCustomerNames,
  getFarmerNames,
  syncCustomersFromBills,
} from '../storage/customerStorage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function ReceivePaymentScreen({ navigation, route }) {
  const prefillBill     = route.params?.bill         || null;
  const prefillCustomer = route.params?.customerName || prefillBill?.customerName || '';
  const prefillFarmer   = route.params?.farmerName   || prefillBill?.farmerName   || '';

  // ── State ──────────────────────────────────────────────
  const [paymentType,   setPaymentType]   = useState(prefillBill ? 'bill' : 'advance');
  const [customerName,  setCustomerName]  = useState(prefillCustomer);
  const [farmerName,    setFarmerName]    = useState(prefillFarmer);
  const [amount,        setAmount]        = useState('');
  const [notes,         setNotes]         = useState('');
  const [date,          setDate]          = useState(new Date());
  const [showDatePicker,setShowDatePicker]= useState(false);
  const [saving,        setSaving]        = useState(false);

  // ── Autocomplete suggestions ───────────────────────────
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [farmerSuggestions,   setFarmerSuggestions]   = useState([]);

  // ── Bill selection (multi) ─────────────────────────────
  const [allUnpaidBills,  setAllUnpaidBills]  = useState([]);
  const [selectedBills,   setSelectedBills]   = useState(
    prefillBill ? [prefillBill] : []
  );
  const [showBillPicker,  setShowBillPicker]  = useState(false);
  const [billSearch,      setBillSearch]       = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Reload farmer suggestions when customer changes
  useEffect(() => {
    if (!customerName.trim()) {
      setFarmerSuggestions([]);
      return;
    }
    getFarmerNames(customerName.trim()).then(setFarmerSuggestions);
  }, [customerName]);

  // Reload bill list when customer or farmer changes
  useEffect(() => {
    if (paymentType === 'bill') filterBills();
  }, [customerName, farmerName, allUnpaidBills, paymentType]);

  const loadData = async () => {
    await syncCustomersFromBills();
    const [customers, bills] = await Promise.all([
      getCustomerNames(),
      getAllBills(),
    ]);
    setCustomerSuggestions(customers);
    setAllUnpaidBills(bills.filter(b => b.status !== 'paid'));
  };

  // ── Helpers ────────────────────────────────────────────
  const formatDate = (d) => {
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  // ── Filter bills by customer & farmer ─────────────────
  const filterBills = () => {
    // no filter if no customer typed
  };

  const filteredBills = allUnpaidBills.filter(b => {
    const q = billSearch.toLowerCase();
    const matchesSearch =
      b.customerName.toLowerCase().includes(q) ||
      (b.farmerName || '').toLowerCase().includes(q);
    // If customer is selected, filter to that customer
    const matchesCustomer = customerName.trim()
      ? b.customerName.toLowerCase() === customerName.toLowerCase()
      : true;
    const matchesFarmer = farmerName.trim()
      ? (b.farmerName || '').toLowerCase() === farmerName.toLowerCase()
      : true;
    return matchesSearch && matchesCustomer && matchesFarmer;
  });

  // ── Toggle bill selection ──────────────────────────────
  const toggleBillSelection = (bill) => {
    const alreadySelected = selectedBills.find(b => b.id === bill.id);
    if (alreadySelected) {
      setSelectedBills(prev => prev.filter(b => b.id !== bill.id));
    } else {
      setSelectedBills(prev => [...prev, bill]);
      // Auto-fill customer name from first selected bill
      if (!customerName.trim()) setCustomerName(bill.customerName);
    }
  };

  const isSelected = (billId) => selectedBills.some(b => b.id === billId);

  // ── Total outstanding of selected bills ────────────────
  const totalOutstanding = selectedBills.reduce(
    (sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0
  );

  // ── Apply payment oldest bill first ───────────────────
  const applyToOldestFirst = async (totalAmount, bills) => {
    // Sort by bill date oldest first
    const sorted = [...bills].sort((a, b) => {
      const parse = str => {
        const [d, m, y] = str.split('/');
        return new Date(y, m - 1, d);
      };
      return parse(a.date) - parse(b.date);
    });

    let remaining = totalAmount;
    const results = [];

    for (const bill of sorted) {
      if (remaining <= 0) break;
      const outstanding = bill.amount - (bill.paidAmount || 0);
      const paying      = Math.min(remaining, outstanding);

      // Save individual payment record
      await savePayment({
        billId:       bill.id,
        customerName: bill.customerName,
        farmerName:   bill.farmerName || '',
        amount:       paying,
        date:         formatDate(date),
        type:         'payment',
        notes:        notes.trim(),
      });

      // Apply to bill
      const { newStatus } = await applyPaymentToBill(bill.id, paying);
      results.push({
        bill,
        paid:   paying,
        status: newStatus,
      });

      remaining -= paying;
    }

    return { results, remaining };
  };

  // ── Validate & Save ────────────────────────────────────
  const handleSave = async () => {
    if (!customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter Customer Name.');
      return;
    }
    if (paymentType === 'bill' && selectedBills.length === 0) {
      Alert.alert('Missing Info', 'Please select at least one bill.');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Missing Info', 'Please enter a valid amount.');
      return;
    }
    if (paymentType === 'bill' && Number(amount) > totalOutstanding) {
      Alert.alert(
        'Amount Too High',
        `Total outstanding on selected bills is Rs ${totalOutstanding.toLocaleString()}.\n\nYou entered Rs ${Number(amount).toLocaleString()}.`
      );
      return;
    }

    setSaving(true);
    try {
      if (paymentType === 'bill') {
        const { results, remaining } = await applyToOldestFirst(
          Number(amount), selectedBills
        );

        // Build summary message
        let summary = results.map(r =>
          `• ${r.bill.customerName}${r.bill.farmerName ? ' / ' + r.bill.farmerName : ''} (${r.bill.date})\n  Paid: Rs ${r.paid.toLocaleString()} → ${r.status.toUpperCase()}`
        ).join('\n\n');

        if (remaining > 0) {
          summary += `\n\n⚠️ Rs ${remaining.toLocaleString()} could not be applied (all bills fully paid).`;
        }

        Alert.alert('✅ Payment Applied', summary, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Advance payment
        await savePayment({
          billId:       null,
          customerName: customerName.trim(),
          farmerName:   farmerName.trim(),
          amount:       Number(amount),
          date:         formatDate(date),
          type:         'advance',
          notes:        notes.trim(),
        });
        Alert.alert(
          '✅ Advance Recorded',
          `Rs ${Number(amount).toLocaleString()} advance recorded for ${customerName.trim()}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={100}
        extraHeight={150}
        enableAutomaticScroll={true}
      >
        
       

          {/* ── PAYMENT TYPE TOGGLE ── */}
          <Text style={styles.sectionLabel}>💳 Payment Type</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn,
                paymentType === 'bill' && styles.toggleBtnActive]}
              onPress={() => {
                setPaymentType('bill');
                setSelectedBills(prefillBill ? [prefillBill] : []);
              }}
            >
              <Text style={[styles.toggleBtnText,
                paymentType === 'bill' && styles.toggleBtnTextActive]}>
                🧾 Against Bills
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn,
                paymentType === 'advance' && styles.toggleBtnActive]}
              onPress={() => {
                setPaymentType('advance');
                setSelectedBills([]);
              }}
            >
              <Text style={[styles.toggleBtnText,
                paymentType === 'advance' && styles.toggleBtnTextActive]}>
                ⬆️ Advance
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* ── CUSTOMER NAME (with autocomplete) ── */}
          <AutocompleteInput
            label="Customer Name"
            required
            placeholder="e.g. Ahmed Traders"
            value={customerName}
            onChangeText={setCustomerName}
            suggestions={customerSuggestions}
          />

          {/* ── FARMER NAME (with autocomplete) ── */}
          {paymentType === 'advance' && (
            <AutocompleteInput
              label="Farmer Name (optional)"
              placeholder="Leave blank for general advance"
              value={farmerName}
              onChangeText={setFarmerName}
              suggestions={farmerSuggestions}
            />
          )}

          {/* ── BILL SELECTION (multi) ── */}
          {paymentType === 'bill' && (
            <>
              <Text style={styles.fieldLabel}>
                Select Bills <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.fieldHint}>
                Tap to select one or more bills. Payment applied oldest first.
              </Text>

              {/* Selected Bills Summary */}
              {selectedBills.length > 0 && (
                <View style={styles.selectedSummary}>
                  <Text style={styles.selectedSummaryTitle}>
                    ✅ {selectedBills.length} bill{selectedBills.length !== 1 ? 's' : ''} selected
                  </Text>
                  <Text style={styles.selectedSummaryAmount}>
                    Total Outstanding: Rs {totalOutstanding.toLocaleString()}
                  </Text>
                  {selectedBills.map(b => (
                    <View key={b.id} style={styles.selectedBillRow}>
                      <View style={styles.selectedBillInfo}>
                        <Text style={styles.selectedBillCustomer}>
                          {b.customerName}
                          {b.farmerName ? ` / ${b.farmerName}` : ''}
                        </Text>
                        <Text style={styles.selectedBillDate}>
                          📅 {b.date} — Due: Rs {(b.amount - (b.paidAmount || 0)).toLocaleString()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleBillSelection(b)}
                        style={styles.removeSelectedBtn}
                      >
                        <Text style={styles.removeSelectedBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Bill Picker Toggle */}
              <TouchableOpacity
                style={styles.showPickerBtn}
                onPress={() => setShowBillPicker(p => !p)}
              >
                <Text style={styles.showPickerBtnText}>
                  {showBillPicker ? '▲ Hide Bill List' : '▼ Show Bill List to Select'}
                </Text>
              </TouchableOpacity>

              {/* Bill List */}
              {showBillPicker && (
                <View style={styles.billPickerContainer}>
                  <TextInput
                    style={styles.billSearchInput}
                    placeholder="Search bills..."
                    placeholderTextColor="#bbb"
                    value={billSearch}
                    onChangeText={setBillSearch}
                  />
                  {filteredBills.length === 0 ? (
                    <Text style={styles.noBillsText}>
                      No unpaid bills found.
                      {customerName ? ` Try clearing customer filter.` : ''}
                    </Text>
                  ) : (
                    filteredBills.map(b => {
                      const outstanding = b.amount - (b.paidAmount || 0);
                      const selected    = isSelected(b.id);
                      return (
                        <TouchableOpacity
                          key={b.id}
                          style={[styles.billPickerItem,
                            selected && styles.billPickerItemSelected]}
                          onPress={() => toggleBillSelection(b)}
                        >
                          <View style={styles.billPickerCheckbox}>
                            <Text style={styles.billPickerCheckboxText}>
                              {selected ? '☑' : '☐'}
                            </Text>
                          </View>
                          <View style={styles.billPickerInfo}>
                            <Text style={styles.billPickerCustomer}>
                              {b.customerName}
                              {b.farmerName ? ` / ${b.farmerName}` : ''}
                            </Text>
                            <Text style={styles.billPickerDate}>
                              📅 {b.date}
                            </Text>
                          </View>
                          <View style={styles.billPickerAmounts}>
                            <Text style={styles.billPickerTotal}>
                              Rs {b.amount.toLocaleString()}
                            </Text>
                            <Text style={styles.billPickerDue}>
                              Due: Rs {outstanding.toLocaleString()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </>
          )}

          <View style={styles.divider} />

          {/* ── AMOUNT ── */}
          <Text style={styles.fieldLabel}>
            Amount Received (Rs) <Text style={styles.required}>*</Text>
          </Text>
          {paymentType === 'bill' && selectedBills.length > 0 && (
            <TouchableOpacity
              style={styles.fullAmountHint}
              onPress={() => setAmount(String(totalOutstanding))}
            >
              <Text style={styles.fullAmountHintText}>
                💡 Tap to fill full outstanding: Rs {totalOutstanding.toLocaleString()}
              </Text>
            </TouchableOpacity>
          )}
          <TextInput
            style={[styles.input, styles.amountInput]}
            placeholder="e.g. 5000"
            placeholderTextColor="#bbb"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            returnKeyType="done"
          />

          {/* ── DATE ── */}
          <Text style={styles.fieldLabel}>Payment Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>📅  {formatDate(date)}</Text>
            <Text style={styles.dateEditHint}>Tap to change</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}

          {/* ── NOTES ── */}
          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="e.g. Cash received..."
            placeholderTextColor="#bbb"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.divider} />

          {/* ── SAVE ── */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#1a1a1a" />
              : <Text style={styles.saveBtnText}>
                  {paymentType === 'advance'
                    ? '✅  Save Advance Payment'
                    : '✅  Save Payment'}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

        
      
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f5f5' },
  scroll:       { padding: 20, paddingBottom: 50 },
  sectionLabel: {
    fontSize: 16, fontWeight: 'bold',
    color: '#7A2B83', marginBottom: 14,
  },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },
  fieldLabel: {
    fontSize: 14, fontWeight: '600',
    color: '#444', marginBottom: 4, marginTop: 14,
  },
  fieldHint:  { fontSize: 12, color: '#aaa', marginBottom: 8 },
  required:   { color: '#e53935' },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 2, borderColor: '#ddd',
  },
  toggleBtnActive:     { backgroundColor: '#7A2B83', borderColor: '#7A2B83' },
  toggleBtnText:       { color: '#888', fontWeight: '700', fontSize: 14 },
  toggleBtnTextActive: { color: '#fff' },

  // Selected Bills Summary
  selectedSummary: {
    backgroundColor: '#e8f5e9', borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#a5d6a7',
  },
  selectedSummaryTitle: {
    fontSize: 14, fontWeight: 'bold',
    color: '#2e7d32', marginBottom: 4,
  },
  selectedSummaryAmount: {
    fontSize: 13, color: '#2e7d32',
    fontWeight: '600', marginBottom: 10,
  },
  selectedBillRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 8,
    padding: 10, marginBottom: 6,
  },
  selectedBillInfo:     { flex: 1 },
  selectedBillCustomer: { fontSize: 13, fontWeight: '600', color: '#222' },
  selectedBillDate:     { fontSize: 11, color: '#888', marginTop: 2 },
  removeSelectedBtn: {
    backgroundColor: '#ffebee', borderRadius: 6,
    padding: 6, marginLeft: 8,
  },
  removeSelectedBtnText: { color: '#e53935', fontWeight: 'bold', fontSize: 14 },

  // Bill Picker
  showPickerBtn: {
    backgroundColor: '#f3e5f5', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ce93d8',
  },
  showPickerBtnText: { color: '#7A2B83', fontWeight: '700', fontSize: 14 },
  billPickerContainer: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#ddd',
    marginTop: 8, overflow: 'hidden',
  },
  billSearchInput: {
    borderBottomWidth: 1, borderBottomColor: '#eee',
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: '#222',
  },
  billPickerItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  billPickerItemSelected: { backgroundColor: '#f3e5f5' },
  billPickerCheckbox:     { marginRight: 10 },
  billPickerCheckboxText: { fontSize: 22, color: '#7A2B83' },
  billPickerInfo:         { flex: 1 },
  billPickerCustomer:     { fontSize: 13, fontWeight: '600', color: '#222' },
  billPickerDate:         { fontSize: 11, color: '#888', marginTop: 2 },
  billPickerAmounts:      { alignItems: 'flex-end' },
  billPickerTotal:        { fontSize: 13, fontWeight: 'bold', color: '#7A2B83' },
  billPickerDue:          { fontSize: 11, color: '#e53935', fontWeight: '600' },
  noBillsText:            { padding: 20, textAlign: 'center', color: '#aaa' },

  // Inputs
  input: {
    backgroundColor: '#fff', borderWidth: 1.5,
    borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#222',
  },
  amountInput: {
    fontSize: 22, fontWeight: 'bold',
    color: '#2e7d32', borderColor: '#2e7d32', borderWidth: 2,
  },
  notesInput: { height: 90, paddingTop: 12 },
  dateInput: {
    backgroundColor: '#fff', borderWidth: 1.5,
    borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText:     { fontSize: 16, color: '#222' },
  dateEditHint: { fontSize: 12, color: '#7A2B83', fontWeight: '600' },

  // Full amount hint
  fullAmountHint: {
    backgroundColor: '#e8f5e9', borderRadius: 8,
    padding: 10, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: '#4caf50',
  },
  fullAmountHintText: { color: '#2e7d32', fontSize: 13, fontWeight: '600' },

  // Buttons
  saveBtn: {
    backgroundColor: '#F9E219', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    marginBottom: 12, elevation: 4,
  },
  saveBtnText:   { color: '#1a1a1a', fontSize: 18, fontWeight: 'bold' },
  cancelBtn: {
    backgroundColor: '#f0f0f0', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
});