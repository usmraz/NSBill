import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker        from '@react-native-community/datetimepicker';
import { getCustomerNames, syncCustomersFromBills } from '../storage/customerStorage';
import { getAllBills }        from '../storage/billStorage';
import { getAllPayments }     from '../storage/paymentStorage';
import { generateFarmerSummaryReport } from '../storage/pdfStorage';

export default function FarmerSummaryViewScreen({ navigation, route }) {
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

  const [showAllFarmers, setShowAllFarmers] = useState(false);
  const [farmers,        setFarmers]        = useState([]);
  const [totals,         setTotals]         = useState({ billed: 0, paid: 0, outstanding: 0, advance: 0 });
  const [loading,        setLoading]        = useState(false);
  const [generated,      setGenerated]      = useState(false);
  const [generating,     setGenerating]     = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  // Auto-generate when customer pre-filled
  useEffect(() => {
    if (prefillCustomer) {
      buildSummary(prefillCustomer, null, null, false);
    }
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

  const parseDate = (str) => {
    if (!str) return new Date(0);
    const [d, m, y] = str.split('/');
    return new Date(y, m - 1, d);
  };

  // ── Build farmer summary data ────────────────────────────
  const buildSummary = async (custName, from, to, showAll) => {
    if (!custName) return;
    setLoading(true);
    try {
      const allBills    = await getAllBills();
      const allPayments = await getAllPayments();

      const fromD = from ? parseDate(from) : new Date(0);
      const toD   = to   ? parseDate(to)   : new Date(9999, 11, 31);
      toD.setHours(23, 59, 59);

      const bills = allBills.filter(b => {
        const d = parseDate(b.date);
        return b.customerName.toLowerCase() === custName.toLowerCase()
          && d >= fromD && d <= toD;
      });

      const payments = allPayments.filter(p => {
        const d = parseDate(p.date);
        return p.customerName.toLowerCase() === custName.toLowerCase()
          && d >= fromD && d <= toD
          && p.type !== 'advance';
      });

      const advances = allPayments.filter(p => {
        const d = parseDate(p.date);
        return p.customerName.toLowerCase() === custName.toLowerCase()
          && d >= fromD && d <= toD
          && p.type === 'advance';
      });

      // Build farmer map from bills
      const farmerMap = {};
      bills.forEach(b => {
        const key = (b.farmerName || 'General').trim();
        if (!farmerMap[key]) farmerMap[key] = { name: key, billed: 0, paid: 0 };
        farmerMap[key].billed += b.amount;
        farmerMap[key].paid   += (b.paidAmount || 0);
      });

      let result = Object.values(farmerMap).map(f => ({
        ...f,
        outstanding: f.billed - f.paid,
      }));

      if (!showAll) {
        result = result.filter(f => f.outstanding !== 0);
      }

      result.sort((a, b) => b.outstanding - a.outstanding);

      const totalAdvance     = advances.reduce((s, p) => s + p.amount, 0);
      const grandBilled      = result.reduce((s, f) => s + f.billed, 0);
      const grandPaid        = result.reduce((s, f) => s + f.paid,   0);
      const grandOutstanding = grandBilled - grandPaid - totalAdvance;

      setFarmers(result);
      setTotals({
        billed:      grandBilled,
        paid:        grandPaid,
        outstanding: grandOutstanding,
        advance:     totalAdvance,
      });
      setGenerated(true);
    } catch (e) {
      Alert.alert('Error', 'Could not build summary.');
    } finally {
      setLoading(false);
    }
  };

  // ── Generate prompt ──────────────────────────────────────
  const handleGenerate = () => {
    if (!selectedCust) {
      Alert.alert('Select Customer', 'Please select a customer first.');
      return;
    }
    Alert.alert(
      'Farmer Filter',
      'Which farmers should appear?',
      [
        {
          text: 'Non-zero balances only',
          onPress: () => {
            setShowAllFarmers(false);
            buildSummary(
              selectedCust,
              allDates ? null : formatDate(fromDate),
              allDates ? null : formatDate(toDate),
              false,
            );
          },
        },
        {
          text: 'All farmers',
          onPress: () => {
            setShowAllFarmers(true);
            buildSummary(
              selectedCust,
              allDates ? null : formatDate(fromDate),
              allDates ? null : formatDate(toDate),
              true,
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ── Export PDF ───────────────────────────────────────────
  const handleExportPDF = async () => {
    setGenerating(true);
    try {
      await generateFarmerSummaryReport(
        selectedCust,
        allDates ? null : formatDate(fromDate),
        allDates ? null : formatDate(toDate),
        showAllFarmers,
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not generate PDF.');
    } finally {
      setGenerating(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.toLowerCase().includes(custSearch.toLowerCase())
  );

  const periodLabel = allDates
    ? 'All dates'
    : `${fromDate ? formatDate(fromDate) : '?'} — ${toDate ? formatDate(toDate) : '?'}`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── CUSTOMER SELECTOR ── */}
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setShowCustPicker(p => !p)}
        >
          <View>
            <Text style={styles.selectBtnLabel}>Customer</Text>
            <Text style={[styles.selectBtnText,
              selectedCust && styles.selectBtnTextSelected]}>
              {selectedCust || 'Tap to select...'}
            </Text>
          </View>
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
              style={{ maxHeight: 180 }}
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
                    setGenerated(false);
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

        {/* ── DATE RANGE ── */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.allDatesBtn, allDates && styles.allDatesBtnActive]}
            onPress={() => {
              setAllDates(true);
              setFromDate(null);
              setToDate(null);
              setGenerated(false);
            }}
          >
            <Text style={[styles.allDatesBtnText,
              allDates && styles.allDatesBtnTextActive]}>
              All Dates
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePickerBtn,
              !allDates && fromDate && styles.datePickerBtnActive]}
            onPress={() => { setAllDates(false); setShowFromPicker(true); setGenerated(false); }}
          >
            <Text style={styles.datePickerBtnLabel}>From</Text>
            <Text style={styles.datePickerBtnText}>
              {fromDate ? formatDate(fromDate) : 'Select'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePickerBtn,
              !allDates && toDate && styles.datePickerBtnActive]}
            onPress={() => { setAllDates(false); setShowToPicker(true); setGenerated(false); }}
          >
            <Text style={styles.datePickerBtnLabel}>To</Text>
            <Text style={styles.datePickerBtnText}>
              {toDate ? formatDate(toDate) : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>

        {showFromPicker && (
          <DateTimePicker
            value={fromDate || new Date()}
            mode="date" display="default"
            maximumDate={toDate || new Date()}
            onChange={(e, d) => { setShowFromPicker(false); if (d) setFromDate(d); }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={toDate || new Date()}
            mode="date" display="default"
            minimumDate={fromDate || undefined}
            maximumDate={new Date()}
            onChange={(e, d) => { setShowToPicker(false); if (d) setToDate(d); }}
          />
        )}

        {/* ── GENERATE BUTTON ── */}
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#1a1a1a" />
            : <Text style={styles.generateBtnText}>
                👨‍🌾  View Farmer Summary
              </Text>
          }
        </TouchableOpacity>

        {/* ── RESULTS ── */}
        {generated && !loading && (
          <>
            {/* Period label */}
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.resultCustomer}>{selectedCust}</Text>
                <Text style={styles.resultPeriod}>
                  {periodLabel} &nbsp;·&nbsp;
                  {showAllFarmers ? 'All farmers' : 'Non-zero only'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.pdfBtn, generating && { opacity: 0.6 }]}
                onPress={handleExportPDF}
                disabled={generating}
              >
                {generating
                  ? <ActivityIndicator color="#7A2B83" size="small" />
                  : <Text style={styles.pdfBtnText}>📄 PDF</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Farmer cards */}
            {farmers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>No farmers found</Text>
                <Text style={styles.emptySubtitle}>
                  No data for this customer in the selected period.
                </Text>
              </View>
            ) : (
              farmers.map((f, idx) => (
                <View key={idx} style={styles.farmerCard}>
                  <View style={styles.farmerCardTop}>
                    <Text style={styles.farmerCardName}>{f.name}</Text>
                    <Text style={[
                      styles.farmerCardOutstanding,
                      f.outstanding === 0 && styles.farmerCardZero,
                    ]}>
                      Rs {f.outstanding.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.farmerCardBottom}>
                    <View style={styles.farmerCardStat}>
                      <Text style={styles.farmerCardStatLabel}>Billed</Text>
                      <Text style={styles.farmerCardStatValue}>
                        {f.billed.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.farmerCardDivider} />
                    <View style={styles.farmerCardStat}>
                      <Text style={styles.farmerCardStatLabel}>Paid</Text>
                      <Text style={styles.farmerCardStatValue}>
                        {f.paid.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.farmerCardDivider} />
                    <View style={styles.farmerCardStat}>
                      <Text style={styles.farmerCardStatLabel}>Outstanding</Text>
                      <Text style={[styles.farmerCardStatValue,
                        f.outstanding > 0
                          ? styles.farmerCardStatDanger
                          : styles.farmerCardStatSuccess]}>
                        {f.outstanding.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            {/* Totals footer */}
            {farmers.length > 0 && (
              <View style={styles.totalsCard}>
                <Text style={styles.totalsTitle}>
                  Summary — {farmers.length} farmer{farmers.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total Billed</Text>
                  <Text style={styles.totalsValue}>
                    Rs {totals.billed.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total Paid</Text>
                  <Text style={styles.totalsValue}>
                    Rs {totals.paid.toLocaleString()}
                  </Text>
                </View>
                {totals.advance > 0 && (
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Advance Credit</Text>
                    <Text style={[styles.totalsValue, { color: '#2e7d32' }]}>
                      − Rs {totals.advance.toLocaleString()}
                    </Text>
                  </View>
                )}
                <View style={[styles.totalsRow, styles.totalsRowFinal]}>
                  <Text style={styles.totalsFinalLabel}>Net Outstanding</Text>
                  <Text style={styles.totalsFinalValue}>
                    Rs {totals.outstanding.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll:    { padding: 16, paddingBottom: 50 },

  // Customer selector
  selectBtn: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#ddd',
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  selectBtnLabel:        { fontSize: 11, color: '#aaa', marginBottom: 2 },
  selectBtnText:         { fontSize: 15, color: '#bbb' },
  selectBtnTextSelected: { color: '#222', fontWeight: '600' },
  selectBtnArrow:        { fontSize: 12, color: '#7A2B83', fontWeight: '700' },

  custPickerContainer: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#ddd',
    marginBottom: 10, overflow: 'hidden',
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
  custPickerCheck:            { color: '#7A2B83', fontWeight: 'bold' },

  // Date row
  dateRow: {
    flexDirection: 'row', gap: 8,
    marginBottom: 14,
  },
  allDatesBtn: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1.5,
    borderColor: '#ddd', justifyContent: 'center',
  },
  allDatesBtnActive:     { backgroundColor: '#7A2B83', borderColor: '#7A2B83' },
  allDatesBtnText:       { fontSize: 12, fontWeight: '700', color: '#888' },
  allDatesBtnTextActive: { color: '#fff' },

  datePickerBtn: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 10, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1.5,
    borderColor: '#ddd',
  },
  datePickerBtnActive:  { borderColor: '#7A2B83', backgroundColor: '#f3e5f5' },
  datePickerBtnLabel:   { fontSize: 10, color: '#aaa', marginBottom: 2 },
  datePickerBtnText:    { fontSize: 12, color: '#444', fontWeight: '600' },

  // Generate button
  generateBtn: {
    backgroundColor: '#F9E219', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
    marginBottom: 20, elevation: 3,
  },
  generateBtnText: { color: '#1a1a1a', fontSize: 15, fontWeight: 'bold' },

  // Result header
  resultHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  resultCustomer: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  resultPeriod:   { fontSize: 11, color: '#888', marginTop: 2 },
  pdfBtn: {
    backgroundColor: '#f3e5f5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#7A2B83',
  },
  pdfBtnText: { color: '#7A2B83', fontWeight: '700', fontSize: 13 },

  // Farmer card
  farmerCard: {
    backgroundColor: '#fff', borderRadius: 12,
    marginBottom: 8, overflow: 'hidden',
    borderWidth: 0.5, borderColor: '#e0e0e0',
    elevation: 1,
  },
  farmerCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 14,
    paddingVertical: 12, borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  farmerCardName:        { fontSize: 14, fontWeight: '600', color: '#222' },
  farmerCardOutstanding: { fontSize: 14, fontWeight: 'bold', color: '#e53935' },
  farmerCardZero:        { color: '#4caf50' },
  farmerCardBottom: {
    flexDirection: 'row', paddingHorizontal: 14,
    paddingVertical: 10, backgroundColor: '#fafafa',
  },
  farmerCardStat:       { flex: 1, alignItems: 'center' },
  farmerCardDivider: {
    width: 0.5, backgroundColor: '#e0e0e0', marginHorizontal: 8,
  },
  farmerCardStatLabel: { fontSize: 10, color: '#aaa', marginBottom: 3 },
  farmerCardStatValue: { fontSize: 12, fontWeight: '600', color: '#444' },
  farmerCardStatDanger:  { color: '#e53935' },
  farmerCardStatSuccess: { color: '#4caf50' },

  // Totals card
  totalsCard: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginTop: 4,
    borderWidth: 1.5, borderColor: '#7A2B83',
  },
  totalsTitle: {
    fontSize: 13, fontWeight: 'bold',
    color: '#7A2B83', marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3e5f5',
    paddingBottom: 8,
  },
  totalsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 0.5,
    borderBottomColor: '#f5f5f5',
  },
  totalsLabel: { fontSize: 13, color: '#666' },
  totalsValue: { fontSize: 13, color: '#222', fontWeight: '600' },
  totalsRowFinal: {
    borderTopWidth: 1.5, borderTopColor: '#7A2B83',
    borderBottomWidth: 0, marginTop: 4, paddingTop: 10,
  },
  totalsFinalLabel: { fontSize: 14, fontWeight: 'bold', color: '#222' },
  totalsFinalValue: {
    fontSize: 16, fontWeight: 'bold', color: '#e53935',
  },

  // Empty
  emptyState:    { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:     { fontSize: 40, marginBottom: 12 },
  emptyTitle:    { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#888', textAlign: 'center' },
});