import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { updateBill, deleteBill } from '../storage/billStorage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPaymentsForBill } from '../storage/paymentStorage';
import React, { useState, useEffect } from 'react';

export default function BillDetailScreen({ navigation, route }) {
  const [bill, setBill] = useState(route.params?.bill || {});
  const [updating, setUpdating] = useState(false);
  const [payments, setPayments] = useState([]);

useEffect(() => {
  loadPayments();
}, []);

const loadPayments = async () => {
  const p = await getPaymentsForBill(bill.id);
  setPayments(p);
};

  // ── Status Helpers ────────────────────────────────────────
  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':    return '#4caf50';
      case 'partial': return '#ff9800';
      default:        return '#e53935';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid':    return '✓ Paid';
      case 'partial': return '◑ Partial';
      default:        return '✕ Unpaid';
    }
  };

  // ── Mark Status ───────────────────────────────────────────
  const handleMarkStatus = () => {
    Alert.alert(
      'Update Payment Status',
      `Current status: ${getStatusLabel(bill.status)}\n\nChoose new status:`,
      [
        {
          text: '✕ Unpaid',
          onPress: () => changeStatus('unpaid'),
        },
        {
          text: '◑ Partial Payment',
          onPress: () => changeStatus('partial'),
        },
        {
          text: '✓ Mark as Paid',
          style: 'default',
          onPress: () => changeStatus('paid'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const changeStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await updateBill(bill.id, { status: newStatus });
      setBill(prev => ({ ...prev, status: newStatus }));
      Alert.alert('Updated!', `Bill marked as ${getStatusLabel(newStatus)}`);
    } catch (e) {
      Alert.alert('Error', 'Could not update status.');
    } finally {
      setUpdating(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      '🗑️ Delete Bill',
      `Are you sure you want to delete the bill for:\n\n${bill.customerName}\nRs ${bill.amount?.toLocaleString()}\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBill(bill.id);
              Alert.alert('Deleted', 'Bill has been removed.', [
                { text: 'OK', onPress: () => navigation.popToTop() },
              ]);
            } catch (e) {
              Alert.alert('Error', 'Could not delete bill.');
            }
          },
        },
      ]
    );
  };

  // ── Reminder Message ──────────────────────────────────────
  const reminderMessage = () => {
    return (
      `Assalam o Alaikum ${bill.customerName},\n\n` +
      `Yeh Naya Sawera ki taraf se ek yaad daahani hai.\n\n` +
      `Aap ka ${bill.date} ka bill Rs ${bill.amount?.toLocaleString()} ` +
      `abhi tak pending hai.\n\n` +
      `Meherbani kar ke jald az jald payment kar dein.\n\n` +
      `Shukriya 🌱 Naya Sawera`
    );
  };

  // ── Send SMS ──────────────────────────────────────────────
  const handleSMS = () => {
    const msg = reminderMessage();
    const url = `sms:?body=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open SMS app.')
    );
  };

  // ── Send WhatsApp ─────────────────────────────────────────
  const handleWhatsApp = () => {
    const msg = reminderMessage();
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(
        'WhatsApp Not Found',
        'WhatsApp is not installed on this device.'
      )
    );
  };

  // ── Copy Message (preview) ────────────────────────────────
  const handlePreviewMessage = () => {
    Alert.alert(
      '📨 Reminder Message Preview',
      reminderMessage(),
      [
        { text: 'Send SMS',      onPress: handleSMS },
        { text: 'Send WhatsApp', onPress: handleWhatsApp },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── STATUS BANNER ── */}
        <View style={[
          styles.statusBanner,
          { backgroundColor: getStatusColor(bill.status) }
        ]}>
          <Text style={styles.statusBannerText}>
            {getStatusLabel(bill.status)}
          </Text>
          <TouchableOpacity
            style={styles.changeStatusBtn}
            onPress={handleMarkStatus}
            disabled={updating}
          >
            {updating
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.changeStatusBtnText}>Change Status</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── BILL INFO CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Bill Details</Text>

          <InfoRow label="Customer Name" value={bill.customerName} large />
          {bill.farmerName
            ? <InfoRow label="Farmer / Party" value={bill.farmerName} />
            : null
          }
          <InfoRow label="Date"   value={bill.date} />
          <InfoRow
            label="Amount"
            value={`Rs ${bill.amount?.toLocaleString()}`}
            amountStyle
          />
          {bill.notes
            ? <InfoRow label="Notes" value={bill.notes} />
            : null
          }
          <InfoRow
            label="Saved On"
            value={new Date(bill.createdAt).toLocaleDateString('en-PK', {
              day: '2-digit', month: 'short', year: 'numeric'
            })}
            small
          />
        </View>

        {/* ── PHOTO ── */}
        {bill.photo ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📸 Bill Photo</Text>
            <Image source={{ uri: bill.photo }} style={styles.photo} />
          </View>
        ) : (
          <View style={styles.noPhotoRow}>
            <Text style={styles.noPhotoText}>📷 No photo attached</Text>
          </View>
        )}

        {/* ── EDIT BILL ── */}
<TouchableOpacity
  style={styles.editBillBtn}
  onPress={() => navigation.navigate('EditBill', { bill })}
>
  <Text style={styles.editBillBtnText}>✏️  Edit Bill Details</Text>
</TouchableOpacity>

          {/* ── RECEIVE PAYMENT ── */}
{bill.status !== 'paid' && (
  <TouchableOpacity
    style={styles.receivePaymentBtn}
    onPress={() =>
      navigation.navigate('ReceivePayment', { bill })
    }
  >
    <Text style={styles.receivePaymentBtnText}>
      💰  Receive Payment Against This Bill
    </Text>
  </TouchableOpacity>
)}


        {/* ── REMINDER SECTION ── */}
        {bill.status !== 'paid' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔔 Send Payment Reminder</Text>
            <Text style={styles.reminderNote}>
              Send a pre-filled reminder message to the customer.
            </Text>

            <TouchableOpacity
              style={styles.previewBtn}
              onPress={handlePreviewMessage}
            >
              <Text style={styles.previewBtnText}>👁️  Preview Message</Text>
            </TouchableOpacity>

            <View style={styles.reminderButtons}>
              <TouchableOpacity style={styles.smsBtn} onPress={handleSMS}>
                <Text style={styles.smsBtnIcon}>💬</Text>
                <Text style={styles.smsBtnText}>Send SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.waBtn} onPress={handleWhatsApp}>
                <Text style={styles.waBtnIcon}>📱</Text>
                <Text style={styles.waBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── PAYMENT HISTORY ── */}
{payments.length > 0 && (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>💰 Payment History</Text>
    {payments.map(p => (
      <View key={p.id} style={styles.paymentRow}>
        <View style={styles.paymentRowLeft}>
          <Text style={styles.paymentRowAmount}>
            Rs {p.amount.toLocaleString()}
          </Text>
          <Text style={styles.paymentRowDate}>📅 {p.date}</Text>
          {p.notes ? (
            <Text style={styles.paymentRowNotes} numberOfLines={1}>
              📝 {p.notes}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.editPaymentBtn}
          onPress={() => navigation.navigate('EditPayment', { payment: p })}
        >
          <Text style={styles.editPaymentBtnText}>✏️ Edit</Text>
        </TouchableOpacity>
      </View>
    ))}
  </View>
)}


        {/* ── DANGER ZONE ── */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>⚠️ Danger Zone</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑️  Delete This Bill</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Reusable Info Row ─────────────────────────────────────
function InfoRow({ label, value, large, small, amountStyle }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[
        styles.infoValue,
        large       && styles.infoValueLarge,
        small       && styles.infoValueSmall,
        amountStyle && styles.infoValueAmount,
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
    padding: 16,
    paddingBottom: 50,
  },

  // Status Banner
  statusBanner: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
  },
  statusBannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  changeStatusBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  changeStatusBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7A2B83',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3e5f5',
    paddingBottom: 8,
  },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#fafafa',
  },
  infoLabel: {
    fontSize: 13,
    color: '#999',
    flex: 1,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#222',
    flex: 2,
    textAlign: 'right',
    fontWeight: '600',
  },
  infoValueLarge: {
    fontSize: 18,
    color: '#7A2B83',
    fontWeight: 'bold',
  },
  infoValueSmall: {
    fontSize: 12,
    color: '#aaa',
    fontWeight: '400',
  },
  infoValueAmount: {
    fontSize: 20,
    color: '#2e7d32',
    fontWeight: 'bold',
  },

  // Photo
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  noPhotoRow: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 14,
  },
  noPhotoText: {
    color: '#ccc',
    fontSize: 13,
  },

  // Reminder
  reminderNote: {
    fontSize: 13,
    color: '#888',
    marginBottom: 14,
    lineHeight: 20,
  },
  previewBtn: {
    backgroundColor: '#f3e5f5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1bee7',
  },
  previewBtnText: {
    color: '#7A2B83',
    fontWeight: '700',
    fontSize: 14,
  },
  reminderButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  smsBtn: {
    flex: 1,
    backgroundColor: '#1976d2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  smsBtnIcon: { fontSize: 22, marginBottom: 4 },
  smsBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  waBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  waBtnIcon: { fontSize: 22, marginBottom: 4 },
  waBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Danger Zone
  dangerZone: {
    backgroundColor: '#fff5f5',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 12,
  },
  deleteBtn: {
    backgroundColor: '#ffebee',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef9a9a',
  },
  deleteBtnText: {
    color: '#c62828',
    fontWeight: 'bold',
    fontSize: 15,
  },
  receivePaymentBtn: {
  backgroundColor: '#2e7d32',
  borderRadius: 14,
  paddingVertical: 16,
  alignItems: 'center',
  marginBottom: 14,
  elevation: 3,
},
receivePaymentBtnText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
editBillBtn: {
  backgroundColor: '#f3e5f5',
  borderRadius: 14, paddingVertical: 16,
  alignItems: 'center', marginBottom: 14,
  borderWidth: 2, borderColor: '#7A2B83',
},
editBillBtnText: {
  color: '#7A2B83', fontSize: 16, fontWeight: 'bold',
},
paymentRow: {
  flexDirection: 'row', justifyContent: 'space-between',
  alignItems: 'center', paddingVertical: 10,
  borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
},
paymentRowLeft:   { flex: 1 },
paymentRowAmount: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32' },
paymentRowDate:   { fontSize: 12, color: '#888', marginTop: 2 },
paymentRowNotes:  { fontSize: 12, color: '#aaa', marginTop: 2 },
editPaymentBtn: {
  backgroundColor: '#fff8e1', borderRadius: 8,
  paddingHorizontal: 14, paddingVertical: 8,
  borderWidth: 1, borderColor: '#ffe082',
},
editPaymentBtnText: { color: '#f57f17', fontWeight: '700', fontSize: 13 },

});