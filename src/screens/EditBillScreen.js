import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  Platform, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { updateBill, computeStatus } from '../storage/billStorage';
import AutocompleteInput from '../components/AutocompleteInput';
import { getAllBills }   from '../storage/billStorage';
import { computeDueDate }    from '../storage/billStorage';
import { getDefaultDueDays } from '../storage/backupStorage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function EditBillScreen({ navigation, route }) {
  const original = route.params?.bill || {};

  // ── Parse existing date string DD/MM/YYYY → Date object ──
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

  // ── State pre-filled from existing bill ──────────────────
  const [customerName, setCustomerName] = useState(original.customerName || '');
  const [farmerName,   setFarmerName]   = useState(original.farmerName   || '');
  const [amount,       setAmount]       = useState(String(original.amount || ''));
  const [notes,        setNotes]        = useState(original.notes        || '');
  const [photo,        setPhoto]        = useState(original.photo        || null);
  const [date,         setDate]         = useState(parseDate(original.date));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
const [farmerSuggestions,   setFarmerSuggestions]   = useState([]);
const [dueDays,       setDueDays]       = useState(String(original.dueDays || '30'));
const [dueDate,       setDueDate]       = useState(original.dueDate || '');
const [showDuePicker, setShowDuePicker] = useState(false);
const [duePickerDate, setDuePickerDate] = useState(() => {
  if (original.dueDate) {
    const [d, m, y] = original.dueDate.split('/');
    return new Date(y, m - 1, d);
  }
  return new Date();
});


  // ── Photo ─────────────────────────────────────────────────
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Gallery access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  // ── Date ──────────────────────────────────────────────────
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter Customer Name.');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Missing Info', 'Please enter a valid Amount.');
      return;
    }
    if (Number(amount) < (original.paidAmount || 0)) {
      Alert.alert(
        'Invalid Amount',
        `Bill amount cannot be less than amount already paid (Rs ${original.paidAmount?.toLocaleString()}).`
      );
      return;
    }

    setSaving(true);
    try {
      const newAmount = Number(amount);
      const newStatus = computeStatus(newAmount, original.paidAmount || 0);

      await updateBill(original.id, {
        customerName: customerName.trim(),
        farmerName:   farmerName.trim(),
        amount:       newAmount,
        date:         formatDate(date),
        notes:        notes.trim(),
        photo:        photo,
        status:       newStatus,
        dueDate:       dueDate,
        dueDays:       Number(dueDays),
      });

      Alert.alert('✅ Updated', 'Bill has been updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Could not update bill. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
  loadSuggestions();
}, []);

const loadSuggestions = async () => {
  const { getCustomerNames, syncCustomersFromBills } =
    await import('../storage/customerStorage');
  await syncCustomersFromBills();
  const customers = await getCustomerNames();
  setCustomerSuggestions(customers);
};

useEffect(() => {
  if (!customerName.trim()) {
    setFarmerSuggestions([]);
    return;
  }
  (async () => {
    const { getFarmerNames } = await import('../storage/customerStorage');
    const farmers = await getFarmerNames(customerName.trim());
    setFarmerSuggestions(farmers);
  })();
}, [customerName]);

useEffect(() => {
  if (dueDays && Number(dueDays) > 0) {
    const computed = computeDueDate(formatDate(date), Number(dueDays));
    if (computed) {
      setDueDate(computed);
      const [d, m, y] = computed.split('/');
      setDuePickerDate(new Date(y, m - 1, d));
    }
  }
}, [date, dueDays]);

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
          {/* Already paid notice */}
          {(original.paidAmount || 0) > 0 && (
            <View style={styles.paidNotice}>
              <Text style={styles.paidNoticeText}>
                ⚠️ Rs {original.paidAmount?.toLocaleString()} already received
                against this bill. Bill amount cannot be set lower than this.
              </Text>
            </View>
          )}

          {/* ── PHOTO ── */}
          <Text style={styles.sectionLabel}>📸 Bill Photo</Text>
          {!photo ? (
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
                <Text style={styles.photoBtnIcon}>📷</Text>
                <Text style={styles.photoBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoBtn, styles.photoBtnSecondary]}
                onPress={handlePickFromGallery}
              >
                <Text style={styles.photoBtnIcon}>🖼️</Text>
                <Text style={[styles.photoBtnText, { color: '#7A2B83' }]}>
                  Gallery
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: photo }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => setPhoto(null)}
              >
                <Text style={styles.removePhotoBtnText}>✕ Remove Photo</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          {/* ── FIELDS ── */}
          <Text style={styles.sectionLabel}>📝 Bill Details</Text>

         <AutocompleteInput
  label="Customer Name"
  required
  placeholder="Customer name"
  value={customerName}
  onChangeText={setCustomerName}
  suggestions={customerSuggestions}
/>

          <AutocompleteInput
  label="Farmer / Party Name"
  placeholder="Farmer name (optional)"
  value={farmerName}
  onChangeText={setFarmerName}
  suggestions={farmerSuggestions}
/>

          <Text style={styles.fieldLabel}>Date</Text>
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

          <Text style={styles.fieldLabel}>
            Total Amount (Rs) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.amountInput]}
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 15000"
            placeholderTextColor="#bbb"
            keyboardType="numeric"
            returnKeyType="done"
          />

          <Text style={styles.fieldLabel}>Notes / Remarks</Text>
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

          {/* ── DUE DATE ── */}
          <View style={styles.dueDateSection}>
            <Text style={styles.fieldLabel}>Due Date</Text>
          
            {/* Days input */}
            <View style={styles.dueDaysRow}>
              <Text style={styles.dueDaysLabel}>Pay within</Text>
              <TextInput
                style={styles.dueDaysInput}
                value={dueDays}
                onChangeText={v => setDueDays(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={3}
                returnKeyType="done"
              />
              <Text style={styles.dueDaysLabel}>days  →</Text>
              <TouchableOpacity
                style={styles.dueDateDisplay}
                onPress={() => setShowDuePicker(true)}
              >
                <Text style={styles.dueDateDisplayText}>
                  📅 {dueDate || 'Not set'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dueDateHint}>
              Tap the date to change it manually
            </Text>
          
            {showDuePicker && (
              <DateTimePicker
                value={duePickerDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDuePicker(false);
                  if (selectedDate) {
                    setDuePickerDate(selectedDate);
                    const d = String(selectedDate.getDate()).padStart(2, '0');
                    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const y = selectedDate.getFullYear();
                    setDueDate(`${d}/${m}/${y}`);
                  }
                }}
              />
            )}
          </View>

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

      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f5f5f5' },
  scroll:     { padding: 20, paddingBottom: 50 },
  sectionLabel: {
    fontSize: 16, fontWeight: 'bold',
    color: '#7A2B83', marginBottom: 14, marginTop: 4,
  },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },
  fieldLabel: {
    fontSize: 14, fontWeight: '600',
    color: '#444', marginBottom: 6, marginTop: 14,
  },
  required: { color: '#e53935' },

  paidNotice: {
    backgroundColor: '#fff8e1',
    borderRadius: 10, padding: 14, marginBottom: 16,
    borderLeftWidth: 4, borderLeftColor: '#F9E219',
  },
  paidNoticeText: { color: '#795548', fontSize: 13, lineHeight: 20 },

  photoButtons:        { flexDirection: 'row', gap: 10, marginBottom: 4 },
  photoBtn: {
    flex: 1, backgroundColor: '#7A2B83', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  photoBtnSecondary: {
    backgroundColor: '#f3e5f5',
    borderWidth: 1, borderColor: '#7A2B83',
  },
  photoBtnIcon: { fontSize: 22, marginBottom: 4 },
  photoBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  photoPreviewContainer: { alignItems: 'center', marginBottom: 4 },
  photoPreview: {
    width: '100%', height: 200, borderRadius: 12,
    marginBottom: 10, resizeMode: 'cover',
  },
  removePhotoBtn: {
    backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#ef9a9a',
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20,
  },
  removePhotoBtnText: { color: '#c62828', fontWeight: '600', fontSize: 14 },

  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#222',
  },
  amountInput: {
    fontSize: 22, fontWeight: 'bold',
    color: '#7A2B83', borderColor: '#7A2B83', borderWidth: 2,
  },
  notesInput:  { height: 90, paddingTop: 12 },
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
  saveBtnText:  { color: '#1a1a1a', fontSize: 18, fontWeight: 'bold' },
  cancelBtn: {
    backgroundColor: '#f0f0f0', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
dueDateSection: {
  marginTop: 14,
},
dueDaysRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
},
dueDaysLabel: {
  fontSize: 14, color: '#444', fontWeight: '600',
},
dueDaysInput: {
  backgroundColor: '#fff',
  borderWidth: 2, borderColor: '#7A2B83',
  borderRadius: 10, paddingHorizontal: 12,
  paddingVertical: 10, fontSize: 16,
  fontWeight: 'bold', color: '#7A2B83',
  width: 60, textAlign: 'center',
},
dueDateDisplay: {
  flex: 1, backgroundColor: '#f3e5f5',
  borderRadius: 10, paddingHorizontal: 12,
  paddingVertical: 10, borderWidth: 1.5,
  borderColor: '#ce93d8',
},
dueDateDisplayText: {
  color: '#7A2B83', fontWeight: '600', fontSize: 13,
},
dueDateHint: {
  fontSize: 11, color: '#aaa', marginLeft: 2,
},
});
