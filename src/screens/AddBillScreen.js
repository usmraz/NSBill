import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity,
 TextInput, Image, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import AutocompleteInput        from '../components/AutocompleteInput';
import { computeDueDate }       from '../storage/billStorage';
import { getDefaultDueDays }    from '../storage/backupStorage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function AddBillScreen({ navigation }) {

  // ── ALL useState FIRST — no exceptions ───────────────────
  const [customerName, setCustomerName] = useState('');
  const [farmerName,   setFarmerName]   = useState('');
  const [amount,       setAmount]       = useState('');
  const [notes,        setNotes]        = useState('');
  const [photo,        setPhoto]        = useState(null);

  const [date,          setDate]          = useState(new Date());
  const [showDatePicker,setShowDatePicker]= useState(false);

  const [dueDays,       setDueDays]       = useState('30');
  const [dueDate,       setDueDate]       = useState('');
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [duePickerDate, setDuePickerDate] = useState(new Date());

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [farmerSuggestions,   setFarmerSuggestions]   = useState([]);

  // ── ALL useEffect / useFocusEffect AFTER useState ────────

  // Reset form every time this screen gets focus
  useFocusEffect(
    useCallback(() => {
      setCustomerName('');
      setFarmerName('');
      setAmount('');
      setNotes('');
      setPhoto(null);
      setDate(new Date());
      setDueDate('');
      loadSuggestions();
    }, [])
  );

  // Update farmer suggestions when customer changes
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

  // Recompute due date whenever bill date OR dueDays changes
  useEffect(() => {
    if (!dueDays || Number(dueDays) <= 0) return;
    const computed = computeDueDate(formatDate(date), Number(dueDays));
    if (computed) {
      setDueDate(computed);
      const [d, m, y] = computed.split('/');
      setDuePickerDate(new Date(y, m - 1, d));
    }
  }, [date, dueDays]);

  // ── FUNCTIONS ─────────────────────────────────────────────

  const formatDate = (d) => {
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const loadSuggestions = async () => {
    // Load default due days FIRST so useEffect computes correct due date
    const days = await getDefaultDueDays();
    setDueDays(String(days));

    // Load customer names for autocomplete
    const { getCustomerNames, syncCustomersFromBills } =
      await import('../storage/customerStorage');
    await syncCustomersFromBills();
    const customers = await getCustomerNames();
    setCustomerSuggestions(customers);
  };

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

  const handleRemovePhoto = () => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setPhoto(null) },
    ]);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const handleProceedToReview = () => {
    if (!customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter the Customer Name.');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Missing Info', 'Please enter a valid Amount.');
      return;
    }
    navigation.navigate('ReviewBill', {
      customerName: customerName.trim(),
      farmerName:   farmerName.trim(),
      date:         formatDate(date),
      amount:       amount.trim(),
      notes:        notes.trim(),
      photo:        photo,
      dueDate:      dueDate,
      dueDays:      dueDays,
    });
  };

  // ── UI ────────────────────────────────────────────────────
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

          {/* ── PHOTO SECTION ── */}
          <Text style={styles.sectionLabel}>📸 Bill Photo (Optional)</Text>

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
                <Text style={[styles.photoBtnText, { color: '#7A2B83' }]}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoBtn, styles.photoBtnSkip]}
                onPress={() => {}}
              >
                <Text style={styles.photoBtnIcon}>⏭️</Text>
                <Text style={[styles.photoBtnText, { color: '#888' }]}>Skip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: photo }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.removePhotoBtn} onPress={handleRemovePhoto}>
                <Text style={styles.removePhotoBtnText}>✕ Remove Photo</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          {/* ── FORM FIELDS ── */}
          <Text style={styles.sectionLabel}>📝 Bill Details</Text>

          <AutocompleteInput
            label="Customer Name"
            required
            placeholder="e.g. Ahmed Traders"
            value={customerName}
            onChangeText={setCustomerName}
            suggestions={customerSuggestions}
          />

          <AutocompleteInput
            label="Farmer / Party Name"
            placeholder="e.g. Haji Mushtaq (optional)"
            value={farmerName}
            onChangeText={setFarmerName}
            suggestions={farmerSuggestions}
          />

          {/* Bill Date */}
          <Text style={styles.fieldLabel}>Bill Date</Text>
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

          {/* Amount */}
          <Text style={styles.fieldLabel}>
            Total Amount (Rs) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.amountInput]}
            placeholder="e.g. 15000"
            placeholderTextColor="#bbb"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            returnKeyType="done"
          />

          {/* Notes */}
          <Text style={styles.fieldLabel}>Notes / Remarks</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="e.g. Paid 2000 advance, balance 13000..."
            placeholderTextColor="#bbb"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* ── DUE DATE ── */}
          <View style={styles.dueDateSection}>
            <Text style={styles.fieldLabel}>Due Date</Text>
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
              <Text style={styles.dueDaysLabel}>days →</Text>
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

          <Text style={styles.requiredNote}>
            <Text style={styles.required}>*</Text> Required fields
          </Text>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.proceedButton}
            onPress={handleProceedToReview}
          >
            <Text style={styles.proceedButtonText}>Review & Save  →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
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
    color: '#7A2B83', marginBottom: 14, marginTop: 4,
  },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },
  fieldLabel: {
    fontSize: 14, fontWeight: '600',
    color: '#444', marginBottom: 6, marginTop: 14,
  },
  required:     { color: '#e53935', fontWeight: 'bold' },
  requiredNote: { fontSize: 12, color: '#888', marginTop: 8 },

  // Photo
  photoButtons: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  photoBtn: {
    flex: 1, backgroundColor: '#7A2B83',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  photoBtnSecondary: {
    backgroundColor: '#f3e5f5',
    borderWidth: 1, borderColor: '#7A2B83',
  },
  photoBtnSkip: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1, borderColor: '#ddd',
  },
  photoBtnIcon: { fontSize: 22, marginBottom: 4 },
  photoBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  photoPreviewContainer: { alignItems: 'center', marginBottom: 4 },
  photoPreview: {
    width: '100%', height: 200, borderRadius: 12,
    marginBottom: 10, resizeMode: 'cover',
  },
  removePhotoBtn: {
    backgroundColor: '#ffebee', borderWidth: 1,
    borderColor: '#ef9a9a', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 20,
  },
  removePhotoBtnText: { color: '#c62828', fontWeight: '600', fontSize: 14 },

  // Inputs
  input: {
    backgroundColor: '#fff', borderWidth: 1.5,
    borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#222',
  },
  amountInput: {
    fontSize: 20, fontWeight: 'bold',
    color: '#7A2B83', borderColor: '#7A2B83', borderWidth: 2,
  },
  notesInput: { height: 90, paddingTop: 12 },
  dateInput: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateText:     { fontSize: 16, color: '#222' },
  dateEditHint: { fontSize: 12, color: '#7A2B83', fontWeight: '600' },

  // Due Date
  dueDateSection: { marginTop: 14 },
  dueDaysRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 6,
  },
  dueDaysLabel:  { fontSize: 14, color: '#444', fontWeight: '600' },
  dueDaysInput: {
    backgroundColor: '#fff', borderWidth: 2,
    borderColor: '#7A2B83', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, fontWeight: 'bold',
    color: '#7A2B83', width: 60, textAlign: 'center',
  },
  dueDateDisplay: {
    flex: 1, backgroundColor: '#f3e5f5',
    borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, borderWidth: 1.5,
    borderColor: '#ce93d8',
  },
  dueDateDisplayText: { color: '#7A2B83', fontWeight: '600', fontSize: 13 },
  dueDateHint:        { fontSize: 11, color: '#aaa', marginLeft: 2 },

  // Buttons
  proceedButton: {
    backgroundColor: '#7A2B83', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    marginBottom: 12, elevation: 4,
    shadowColor: '#7A2B83',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  proceedButtonText: {
    color: '#F9E219', fontSize: 18,
    fontWeight: 'bold', letterSpacing: 0.5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  cancelButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
});