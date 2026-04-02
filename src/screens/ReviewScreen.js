import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { saveBill } from '../storage/billStorage';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReviewScreen({ navigation, route }) {
  const data = route.params || {};
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
  setSaving(true);
  try {
    await saveBill(data);
    Alert.alert(
      '✅ Bill Saved!',
      `Bill for ${data.customerName} of Rs ${Number(data.amount).toLocaleString()} has been saved.`,
      [
        {
          text: '💰 Add Payment',
          onPress: () => navigation.navigate('ReceivePayment'),
        },
        {
          text: '➕ New Bill',
          onPress: () => navigation.navigate('Tabs'),
        },
      ]
    );
  } catch (e) {
    Alert.alert('Error', 'Could not save the bill. Please try again.');
  } finally {
    setSaving(false);
  }
};

  const handleEdit = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.headerIcon}>🧾</Text>
          <Text style={styles.headerTitle}>Review Bill</Text>
          <Text style={styles.headerSubtitle}>
            Please confirm all details before saving.
          </Text>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>📋 Bill Details</Text>

          <Row label="Customer Name" value={data.customerName} highlight />
          <Row label="Farmer / Party" value={data.farmerName || '—'} />
          <Row label="Date" value={data.date} />

          {data.dueDate
  ? <Row
      label="Due Date"
      value={`📅 ${data.dueDate} (${data.dueDays} days)`}
      valueStyle={{ color: '#e53935' }}
    />
  : null
}

          <Row
            label="Amount"
            value={`Rs ${Number(data.amount).toLocaleString()}`}
            valueStyle={styles.amountValue}
          />
          {data.notes ? (
            <Row label="Notes" value={data.notes} />
          ) : null}
        </View>

        {/* Photo Section */}
        {data.photo ? (
          <View style={styles.photoCard}>
            <Text style={styles.cardTitle}>📸 Bill Photo</Text>
            <Image source={{ uri: data.photo }} style={styles.photo} />
          </View>
        ) : (
          <View style={styles.noPhotoCard}>
            <Text style={styles.noPhotoText}>📷 No photo attached</Text>
          </View>
        )}

        {/* Warning */}
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Please double-check the amount before saving. You can edit after saving from the Dashboard.
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Text style={styles.editButtonText}>✏️  Edit Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#1a1a1a" />
          ) : (
            <Text style={styles.saveButtonText}>✅  Confirm & Save</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Reusable Row Component ─────────────────────────────────
function Row({ label, value, highlight, valueStyle }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[
        styles.rowValue,
        highlight && styles.rowValueHighlight,
        valueStyle,
      ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    padding: 20,
    paddingBottom: 50,
  },

  // Header
  headerCard: {
    backgroundColor: '#7A2B83',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#e8c5ec',
    fontSize: 13,
    textAlign: 'center',
  },

  // Details Card
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#7A2B83',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3e5f5',
    paddingBottom: 8,
  },

  // Row
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  rowLabel: {
    fontSize: 14,
    color: '#888',
    flex: 1,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 15,
    color: '#222',
    flex: 2,
    textAlign: 'right',
    fontWeight: '600',
  },
  rowValueHighlight: {
    color: '#7A2B83',
    fontSize: 16,
  },
  amountValue: {
    color: '#2e7d32',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Photo
  photoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  noPhotoCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  noPhotoText: {
    color: '#bbb',
    fontSize: 14,
  },

  // Warning
  warningBox: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F9E219',
  },
  warningText: {
    color: '#795548',
    fontSize: 13,
    lineHeight: 20,
  },

  // Buttons
  editButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#7A2B83',
  },
  editButtonText: {
    color: '#7A2B83',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#F9E219',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#F9E219',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: 'bold',
  },
});