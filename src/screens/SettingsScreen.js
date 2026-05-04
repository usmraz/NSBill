import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  saveBackupToDownloads,
  shareBackup,
  restoreBackup,
} from '../storage/backupStorage';
import { saveDefaultDueDays, getDefaultDueDays } from '../storage/backupStorage';
export default function SettingsScreen({ navigation}) {
  const [loading, setLoading] = useState('');
const [defaultDays, setDefaultDays] = useState('15');
  // ── Save to Downloads ─────────────────────────────────
  const handleSaveBackup = async () => {
    setLoading('save');
    try {
      const { fileName } = await saveBackupToDownloads();
      Alert.alert(
        '✅ Backup Saved',
        `File saved as:\n${fileName}\n\nYou can find it in your app's files. Use "Share Backup" to send it to Google Drive or WhatsApp for safekeeping.`
      );
    } catch (e) {
      Alert.alert('Error', 'Could not save backup: ' + e.message);
    } finally {
      setLoading('');
    }
  };

  // ── Share Backup ──────────────────────────────────────
  const handleShareBackup = async () => {
    setLoading('share');
    try {
      await shareBackup();
    } catch (e) {
      Alert.alert('Error', 'Could not share backup: ' + e.message);
    } finally {
      setLoading('');
    }
  };


  useEffect(() => {
  getDefaultDueDays().then(d => setDefaultDays(String(d)));
}, []);

  // ── Restore ───────────────────────────────────────────
  const handleRestore = async () => {
    Alert.alert(
      '⚠️ Restore Backup',
      'This will REPLACE all current data with the backup.\n\nAre you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Restore',
          style: 'destructive',
          onPress: async () => {
            setLoading('restore');
            try {
              const result = await restoreBackup();
              if (!result) return; // user cancelled picker
              const d = new Date(result.createdAt);
              Alert.alert(
                '✅ Restored Successfully',
                `Data restored from backup created on:\n${d.toLocaleDateString()}\n\n` +
                `• ${result.counts.bills} bills\n` +
                `• ${result.counts.payments} payments\n` +
                `• ${result.counts.customers} customers\n\n` +
                `Please restart the app for all changes to take effect.`
              );
            } catch (e) {
              Alert.alert('Restore Failed', e.message);
            } finally {
              setLoading('');
            }
          },
        },
      ]
    );
  };

  const BtnLoader = ({ id }) =>
    loading === id
      ? <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
      : null;

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

      {/* ── DEFAULT DUE DAYS ── */}
<View style={styles.sectionCard}>
  <Text style={styles.sectionIcon}>🗓️</Text>
  <Text style={styles.sectionTitle}>Default Payment Period</Text>
  <Text style={styles.sectionDesc}>
    Set how many days after the bill date payment is due by default.
    You can always change this per bill.
  </Text>
  <View style={styles.dueDaysRow}>
    <Text style={styles.dueDaysLabel}>Default due days:</Text>
    <TextInput
      style={styles.dueDaysInput}
      value={defaultDays}
      onChangeText={v => setDefaultDays(v.replace(/[^0-9]/g, ''))}
      keyboardType="numeric"
      maxLength={3}
      returnKeyType="done"
    />
    <TouchableOpacity
      style={styles.dueDaysSaveBtn}
      onPress={async () => {
        if (!defaultDays || Number(defaultDays) <= 0) {
          Alert.alert('Invalid', 'Please enter a valid number of days.');
          return;
        }
        await saveDefaultDueDays(Number(defaultDays));
        Alert.alert('✅ Saved', `Default due period set to ${defaultDays} days.`);
      }}
    >
      <Text style={styles.dueDaysSaveBtnText}>Save</Text>
    </TouchableOpacity>
  </View>
</View>


        {/* ── BACKUP SECTION ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionIcon}>💾</Text>
          <Text style={styles.sectionTitle}>Backup Data</Text>
          <Text style={styles.sectionDesc}>
            Save all your bills, payments and customer records to a backup file.
            Always backup before updating the app.
          </Text>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, loading === 'share' && styles.btnDisabled]}
            onPress={handleShareBackup}
            disabled={!!loading}
          >
            <BtnLoader id="share" />
            <Text style={styles.btnTextWhite}>
              📤  Share Backup (WhatsApp / Drive / Email)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, loading === 'save' && styles.btnDisabled]}
            onPress={handleSaveBackup}
            disabled={!!loading}
          >
            <BtnLoader id="save" />
            <Text style={styles.btnTextPurple}>
              📁  Save Backup to Phone
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── RESTORE SECTION ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionIcon}>📂</Text>
          <Text style={styles.sectionTitle}>Restore Data</Text>
          <Text style={styles.sectionDesc}>
            Restore your data from a previously saved backup file.
            This will replace all current data.
          </Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Restoring will overwrite all current bills, payments
              and customers. This cannot be undone.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnDanger, loading === 'restore' && styles.btnDisabled]}
            onPress={handleRestore}
            disabled={!!loading}
          >
            <BtnLoader id="restore" />
            <Text style={styles.btnTextWhite}>
              📂  Select Backup File & Restore
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── APP INFO ── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🌱 Naya Sawera</Text>
          <Text style={styles.infoLine}>Agricultural Products Distribution</Text>
          <Text style={styles.infoLine}>Version 1.0.0</Text>
          <Text style={styles.infoLine}>
            Built with React Native + Expo
          </Text>
        </View>

      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll:    { padding: 16, paddingBottom: 50 },

  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 20, marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3,
  },
  sectionIcon:  { fontSize: 32, marginBottom: 8 },
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold',
    color: '#222', marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13, color: '#888',
    lineHeight: 20, marginBottom: 16,
  },

  warningBox: {
    backgroundColor: '#fff8e1', borderRadius: 10,
    padding: 12, marginBottom: 14,
    borderLeftWidth: 4, borderLeftColor: '#F9E219',
  },
  warningText: { color: '#795548', fontSize: 12, lineHeight: 18 },

  btn: {
    borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginBottom: 10,
    flexDirection: 'row', justifyContent: 'center',
  },
  btnPrimary:   { backgroundColor: '#7A2B83', elevation: 3 },
  btnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#7A2B83',
  },
  btnDanger:    { backgroundColor: '#e53935', elevation: 3 },
  btnDisabled:  { opacity: 0.6 },

  btnTextWhite:  { color: '#fff',    fontWeight: 'bold', fontSize: 15 },
  btnTextPurple: { color: '#7A2B83', fontWeight: 'bold', fontSize: 15 },

  infoCard: {
    backgroundColor: '#f3e5f5', borderRadius: 16,
    padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#e1bee7',
  },
  infoTitle: {
    fontSize: 18, fontWeight: 'bold',
    color: '#7A2B83', marginBottom: 8,
  },
  infoLine: { fontSize: 13, color: '#888', marginBottom: 4 },
dueDaysRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10, marginTop: 4,
},
dueDaysLabel: {
  fontSize: 14, color: '#444',
  fontWeight: '600', flex: 1,
},
dueDaysInput: {
  backgroundColor: '#f5f5f5',
  borderWidth: 2, borderColor: '#7A2B83',
  borderRadius: 10, paddingHorizontal: 12,
  paddingVertical: 10, fontSize: 18,
  fontWeight: 'bold', color: '#7A2B83',
  width: 70, textAlign: 'center',
},
dueDaysSaveBtn: {
  backgroundColor: '#7A2B83',
  borderRadius: 10, paddingHorizontal: 18,
  paddingVertical: 10,
},
dueDaysSaveBtnText: {
  color: '#fff', fontWeight: 'bold', fontSize: 14,
},
});
