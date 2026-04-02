import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

export default function AutocompleteInput({
  label,
  value,
  onChangeText,
  suggestions = [],
  placeholder,
  required,
  autoCapitalize = 'words',
  style,
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter suggestions based on current input
  const filtered = value.trim().length > 0
    ? suggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase()) &&
        s.toLowerCase() !== value.toLowerCase()
      )
    : [];

  // Hide dropdown when no matches
  useEffect(() => {
    setShowDropdown(filtered.length > 0);
  }, [value, suggestions]);

  const handleSelect = (name) => {
    onChangeText(name);
    setShowDropdown(false);
  };

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={styles.fieldLabel}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        autoCapitalize={autoCapitalize}
        returnKeyType="next"
      />

      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={{ maxHeight: 180 }}
          >
            {filtered.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dropdownItem,
                  index < filtered.length - 1 && styles.dropdownItemBorder,
                ]}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.dropdownIcon}>👤</Text>
                <Text style={styles.dropdownText}>{item}</Text>
                <Text style={styles.dropdownHint}>tap to select</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { marginBottom: 0 },
  fieldLabel: {
    fontSize: 14, fontWeight: '600',
    color: '#444', marginBottom: 6, marginTop: 14,
  },
  required: { color: '#e53935' },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#ddd',
    borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: '#222',
  },

  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#7A2B83',
    borderRadius: 12, marginTop: 4,
    elevation: 8,
    shadowColor: '#7A2B83',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 999,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3e5f5',
  },
  dropdownIcon: { fontSize: 16 },
  dropdownText: {
    flex: 1, fontSize: 15,
    color: '#222', fontWeight: '600',
  },
  dropdownHint: {
    fontSize: 11, color: '#bbb', fontStyle: 'italic',
  },
});