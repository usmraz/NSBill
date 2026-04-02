import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAllPayments, deletePayment } from '../storage/paymentStorage';
import { applyPaymentToBill, getAllBills, updateBill, computeStatus } from '../storage/billStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const PAYMENTS_KEY = 'naya_sawera_payments';

export default function EditPaymentScreen({ navigation, route }) {
  const original = route.params?.payment || {};

  const parseDate = (str) => {
    if (!str) return new Date();
    const [day, month, year] = str.split('/');
    return new Date(year, month - 1, day);
  };

  const formatDate = (d) => {
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const [amount, setAmount]   = useState(String(original.amount || ''));
  const [notes,  setNotes]    = useState(original.notes  || '');
  const [date,   setDate]     = useState(parseDate(original.date));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving]   = useState(false);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  // ── Recalculate bill's paidAmount after editing a payment ─
  const recalculateBill = async (billId) => {
    if (!billId) return;
    try {
      const allPayments = await getAllPayments();
      const allBills    = await getAllBills();
      const bill        = allBills.find(b => b.id === billId);
      if (!bill) return;

      const totalPaid = allPayments
        .filter(p => p.billId === billId)
        .reduce((sum, p) => sum + p.amount, 0);

      const newStatus = computeStatus(bill.amount, totalPaid);
      await updateBill(billId, { paidAmount: totalPaid, status: newStatus });
    } catch (e) {
      console.error('recalculateBill error:', e);
    }
  };

  // ── Save edited payment ───────────────────────────────────
  const handleSave = async () => {
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      // Update payment directly in storage
      const allPayments = await getAllPayments();
      const updated = allPayments.map(p =>
        p.id === original.id
          ? { ...p, amount: Number(amount), date: formatDate(date), notes: notes.trim() }
          : p
      );
      await AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(updated));

      // Recalculate the linked bill
      await recalculateBill(original.billId);

      Alert.alert('✅ Updated', 'Payment has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Could not update payment.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete payment ────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      '🗑️ Delete Payment',
      `Delete this payment of Rs ${original.amount?.toLocaleString()}?\n\nThis will update the bill balance accordingly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePayment(original.id);
              await recalculateBill(original.billId);
              Alert.alert('Deleted', 'Payment removed.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              Alert.alert('Error', 'Could not delete payment.');
            }
          },
        },
      ]
    );
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

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Payment Details</Text>
            <Text style={styles.infoRow}>
              👤 {original.customerName}
            </Text>
            {original.farmerName ? (
              <Text style={styles.infoRow}>
                👨‍🌾 {original.farmerName}
              </Text>
            ) : null}
            <Text style={styles.infoRow}>
              {original.type === 'advance' ? '⬆️ Advance Payment' : '💰 Bill Payment'}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>
            Amount (Rs) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.amountInput]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            returnKeyType="done"
            placeholder="Amount"
            placeholderTextColor="#bbb"
          />

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

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes..."
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.divider} />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#1a1a1a" />
              : <Text style={styles.saveBtnText}>✅  Save Changes</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Delete */}
          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>⚠️ Danger Zone</Text>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>🗑️  Delete This Payment</Text>
            </TouchableOpacity>
          </View>

        
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll:    { padding: 20, paddingBottom: 50 },
  fieldLabel: {
    fontSize: 14, fontWeight: '600',
    color: '#444', marginBottom: 6, marginTop: 16,
  },
  required: { color: '#e53935' },
  divider:  { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },

  infoCard: {
    backgroundColor: '#f3e5f5', borderRadius: 12,
    padding: 16, marginBottom: 8,
    borderLeftWidth: 4, borderLeftColor: '#7A2B83',
  },
  infoCardTitle: {
    fontSize: 13, fontWeight: 'bold',
    color: '#7A2B83', marginBottom: 8,
  },
  infoRow: { fontSize: 14, color: '#444', marginBottom: 4 },

  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#222',
  },
  amountInput: {
    fontSize: 22, fontWeight: 'bold',
    color: '#2e7d32', borderColor: '#2e7d32', borderWidth: 2,
  },
  notesInput: { height: 90, paddingTop: 12 },
  dateInput: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateText:     { fontSize: 16, color: '#222' },
  dateEditHint: { fontSize: 12, color: '#7A2B83', fontWeight: '600' },

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

  dangerZone: {
    backgroundColor: '#fff5f5', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: '#ffcdd2',
  },
  dangerTitle: {
    fontSize: 13, fontWeight: 'bold', color: '#c62828', marginBottom: 12,
  },
  deleteBtn: {
    backgroundColor: '#ffebee', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#ef9a9a',
  },
  deleteBtnText: { color: '#c62828', fontWeight: 'bold', fontSize: 15 },
});