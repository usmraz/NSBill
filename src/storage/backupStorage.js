import * as FileSystem    from 'expo-file-system/legacy';
import * as Sharing       from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage       from '@react-native-async-storage/async-storage';

const BACKUP_KEYS = [
  'naya_sawera_bills',
  'naya_sawera_payments',
  'naya_sawera_customers',
];

// ── Create backup JSON ────────────────────────────────────
export const createBackup = async () => {
  const backup = {
    version:   '1.0',
    createdAt: new Date().toISOString(),
    appName:   'Naya Sawera',
    data:      {},
  };

  for (const key of BACKUP_KEYS) {
    const value = await AsyncStorage.getItem(key);
    backup.data[key] = value ? JSON.parse(value) : [];
  }

  return backup;
};

// ── Save backup to Downloads folder ──────────────────────
export const saveBackupToDownloads = async () => {
  try {
    const backup   = await createBackup();
    const json     = JSON.stringify(backup, null, 2);
    const date     = new Date().toISOString().split('T')[0];
    const fileName = `NayaSawera_Backup_${date}.json`;

    // Save to app's document directory first
    const fileUri = FileSystem.documentDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, json);

    return { fileUri, fileName };
  } catch (e) {
    console.error('saveBackupToDownloads error:', e);
    throw e;
  }
};

// ── Share backup file ─────────────────────────────────────
export const shareBackup = async () => {
  try {
    const { fileUri, fileName } = await saveBackupToDownloads();

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Sharing not available on this device');

    await Sharing.shareAsync(fileUri, {
      mimeType:    'application/json',
      dialogTitle: 'Share Naya Sawera Backup',
      UTI:         'public.json',
    });

    return fileName;
  } catch (e) {
    console.error('shareBackup error:', e);
    throw e;
  }
};

// ── Restore from backup file ──────────────────────────────
export const restoreBackup = async () => {
  try {
    // Let user pick the backup file
    const result = await DocumentPicker.getDocumentAsync({
      type:      'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled) return null;

    const fileUri = result.assets[0].uri;
    const file = await FileSystem.readAsStringAsync(fileUri);
const json = file;

    const backup = JSON.parse(json);

    // Validate backup format
    if (!backup.appName || backup.appName !== 'Naya Sawera') {
      throw new Error('Invalid backup file. Please select a Naya Sawera backup.');
    }
    if (!backup.data) {
      throw new Error('Backup file is corrupted or empty.');
    }

    // Restore all keys
    for (const key of BACKUP_KEYS) {
      if (backup.data[key] !== undefined) {
        await AsyncStorage.setItem(key, JSON.stringify(backup.data[key]));
      }
    }

    return {
      createdAt: backup.createdAt,
      counts: {
        bills:     (backup.data['naya_sawera_bills']     || []).length,
        payments:  (backup.data['naya_sawera_payments']  || []).length,
        customers: (backup.data['naya_sawera_customers'] || []).length,
      },
    };
  } catch (e) {
    console.error('restoreBackup error:', e);
    throw e;
  }
};
// ── Save/load default due days setting ───────────────────
export const saveDefaultDueDays = async (days) => {
  await AsyncStorage.setItem('naya_sawera_due_days', String(days));
};

export const getDefaultDueDays = async () => {
  const val = await AsyncStorage.getItem('naya_sawera_due_days');
  return val ? Number(val) : 30; // default 30 days
};