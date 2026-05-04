import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCustomerNames, syncCustomersFromBills } from '../storage/customerStorage';
import { generateFarmerSummaryReport } from '../storage/pdfStorage';

export default function FarmerSummaryReportScreen({ navigation, route }) {
  const prefillCustomer = route.params?.customerName || '';

  const [customers,      setCustomers]      = useState([]);
  const [selectedCust,   setSelectedCust]   = useState(prefillCustomer);
  const [showCustPicker, setShowCustPicker] = useState(false);
  const [custSearch,     setCustSearch]     = useState('');

  const [fromDate,       setFromDate]       = useState(null);
  const [toDate,         setToDate]         = useState(null);
  const [allDates,       setAllDates]       = useState(true);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker,   setShowToPicker]   = useState(false);
  const [generating,     setGenerating]     = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    await syncCustomersFromBills();
    const names = await getCustomerNames();
    setCustomers(names);
  };

  const formatDate = (d) => {
    if (!d) return '';
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const filteredCustomers = customers.filter(c =>
    c.toLowerCase().includes(custSearch.toLowerCase())
  );

  const handleGenerate = () => {
    if (!selectedCust) {
      Alert.alert('Select Customer', 'Please select a customer first.');
      return;
    }

    // Prompt for filter preference
    Alert.alert(
      'Farmer Filter',
      'Which farmers should appear in the report?',
      [
        {
          text: 'Non-zero balances only',
          onPress: () => runReport(false),
        },
        {
          text: 'All farmers',
          onPress: () => runReport(true),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const runReport = async (showAll) => {
    setGenerating(true);
    try {
      await generateFarmerSummaryReport(
        selectedCust,
        allDates ? null : formatDate(fromDate),
        allDates ? null : formatDate(toDate),
        showAll,
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not generate report.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── CUSTOMER ── */}
        <Text style={styles.sectionLabel}>👤 Select Customer</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setShowCustPicker(p => !p)}
        >
          <Text style={[styles.selectBtnText,
            selectedCust && styles.selectBtnTextSelected]}>
            {selectedCust || 'Tap to select customer...'}
          </Text>
          <Text style={styles.selectBtnArrow}>
            {showCustPicker ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showCustPicker && (
          <View style={styles.custPickerContainer}>
            <TextInput
              style={styles.custSearchInput}
              placeholder="Search customer..."
              placeholderTextColor="#bbb"
              value={custSearch}
              onChangeText={setCustSearch}
              autoFocus
            />
            <ScrollView
              style={{ maxHeight: 200 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {filteredCustomers.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.custPickerItem,
                    selectedCust === c && styles.custPickerItemSelected]}
                  onPress={() => {
                    setSelectedCust(c);
                    setShowCustPicker(false);
                    setCustSearch('');
                  }}
                >
                  <Text style={[styles.custPickerItemText,
                    selectedCust === c && styles.custPickerItemTextSelected]}>
                    {c}
                  </Text>
                  {selectedCust === c && (
                    <Text style={styles.custPickerCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.divider} />

        {/* ── DATE RANGE ── */}
        <Text style={styles.sectionLabel}>📅 Statement Period</Text>

        <TouchableOpacity
          style={[styles.allDatesBtn, allDates && styles.allDatesBtnActive]}
          onPress={() => { setAllDates(true); setFromDate(null); setToDate(null); }}
        >
          <Text style={[styles.allDatesBtnText,
            allDates && styles.allDatesBtnTextActive]}>
            📋  All Dates
          </Text>
        </TouchableOpacity>

        <View style={styles.dateRangeRow}>
          <View style={styles.dateRangeCol}>
            <Text style={styles.dateRangeLabel}>From</Text>
            <TouchableOpacity
              style={[styles.datePicker,
                !allDates && fromDate && styles.datePickerActive]}
              onPress={() => { setAllDates(false); setShowFromPicker(true); }}
            >
              <Text style={styles.datePickerText}>
                {fromDate ? formatDate(fromDate) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.dateRangeSep}>→</Text>
          <View style={styles.dateRangeCol}>
            <Text style={styles.dateRangeLabel}>To</Text>
            <TouchableOpacity
              style={[styles.datePicker,
                !allDates && toDate && styles.datePickerActive]}
              onPress={() => { setAllDates(false); setShowToPicker(true); }}
            >
              <Text style={styles.datePickerText}>
                {toDate ? formatDate(toDate) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showFromPicker && (
          <DateTimePicker
            value={fromDate || new Date()}
            mode="date"
            display="default"
            maximumDate={toDate || new Date()}
            onChange={(e, d) => {
              setShowFromPicker(false);
              if (d) { setFromDate(d); setAllDates(false); }
            }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={toDate || new Date()}
            mode="date"
            display="default"
            minimumDate={fromDate || undefined}
            maximumDate={new Date()}
            onChange={(e, d) => {
              setShowToPicker(false);
              if (d) { setToDate(d); setAllDates(false); }
            }}
          />
        )}

        <View style={styles.divider} />

        {/* ── PREVIEW ── */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Report Preview</Text>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Customer</Text>
            <Text style={styles.previewValue}>{selectedCust || '—'}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Period</Text>
            <Text style={styles.previewValue}>
              {allDates
                ? 'All Dates'
                : `${fromDate ? formatDate(fromDate) : '?'} to ${toDate ? formatDate(toDate) : '?'}`}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Content</Text>
            <Text style={styles.previewValue}>
              One row per farmer — billed, paid, outstanding
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Filter</Text>
            <Text style={styles.previewValue}>
              You will be asked when generating
            </Text>
          </View>
        </View>

        {/* ── GENERATE ── */}
        <TouchableOpacity
          style={[styles.generateBtn, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator color="#1a1a1a" />
            : <Text style={styles.generateBtnText}>
                👨‍🌾  Generate Farmer Summary PDF
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll:    { padding: 20, paddingBottom: 50 },
  sectionLabel: {
    fontSize: 15, fontWeight: 'bold',
    color: '#7A2B83', marginBottom: 12,
  },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },

  selectBtn: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#ddd',
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  selectBtnText:         { fontSize: 15, color: '#bbb' },
  selectBtnTextSelected: { color: '#222', fontWeight: '600' },
  selectBtnArrow:        { fontSize: 12, color: '#7A2B83', fontWeight: '700' },

  custPickerContainer: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#ddd',
    marginTop: 6, overflow: 'hidden',
  },
  custSearchInput: {
    borderBottomWidth: 1, borderBottomColor: '#eee',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#222',
  },
  custPickerItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 13, borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  custPickerItemSelected:     { backgroundColor: '#f3e5f5' },
  custPickerItemText:         { fontSize: 14, color: '#222' },
  custPickerItemTextSelected: { color: '#7A2B83', fontWeight: '700' },
  custPickerCheck:            { color: '#7A2B83', fontWeight: 'bold', fontSize: 16 },

  allDatesBtn: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 2, borderColor: '#ddd',
    paddingVertical: 13, alignItems: 'center', marginBottom: 14,
  },
  allDatesBtnActive:     { backgroundColor: '#7A2B83', borderColor: '#7A2B83' },
  allDatesBtnText:       { fontSize: 15, fontWeight: '700', color: '#888' },
  allDatesBtnTextActive: { color: '#fff' },

  dateRangeRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateRangeCol:   { flex: 1 },
  dateRangeLabel: { fontSize: 12, color: '#888', marginBottom: 6, fontWeight: '600' },
  dateRangeSep:   { fontSize: 18, color: '#7A2B83', fontWeight: 'bold', marginTop: 16 },
  datePicker: {
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#ddd',
    paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center',
  },
  datePickerActive: { borderColor: '#7A2B83', backgroundColor: '#f3e5f5' },
  datePickerText:   { fontSize: 13, color: '#444', fontWeight: '600' },

  previewCard: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#e8e8e8',
  },
  previewTitle: {
    fontSize: 13, fontWeight: 'bold',
    color: '#7A2B83', marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5', paddingBottom: 8,
  },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#fafafa',
  },
  previewLabel: { fontSize: 12, color: '#888', flex: 1 },
  previewValue: {
    fontSize: 12, color: '#222',
    fontWeight: '600', flex: 2, textAlign: 'right',
  },

  generateBtn: {
    backgroundColor: '#F9E219', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    marginBottom: 12, elevation: 4,
  },
  generateBtnText: { color: '#1a1a1a', fontSize: 17, fontWeight: 'bold' },
  cancelBtn: {
    backgroundColor: '#f0f0f0', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
});