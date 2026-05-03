import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CustomersScreen from './src/screens/CustomersScreen';
import DashboardScreen      from './src/screens/DashboardScreen';
import AddBillScreen        from './src/screens/AddBillScreen';
import ReviewScreen         from './src/screens/ReviewScreen';
import BillDetailScreen     from './src/screens/BillDetailScreen';
import ReceivePaymentScreen from './src/screens/ReceivePaymentScreen';
import LedgerScreen         from './src/screens/LedgerScreen';
import EditBillScreen       from './src/screens/EditBillScreen';
import EditPaymentScreen    from './src/screens/EditPaymentScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AllBillsScreen from './src/screens/AllBillsScreen';
import LedgerReportScreen from './src/screens/LedgerReportScreen';
const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle:      { backgroundColor: '#7A2B83' },
  headerTintColor:  '#fff',
  headerTitleStyle: { fontWeight: 'bold' },
};

// ── Single root stack containing everything ───────────────
// Tabs sit at the bottom, all modal screens push on top
function TabScreens() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   '#7A2B83',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth:  1,
          borderTopColor:  '#e0e0e0',
          paddingBottom:   5,
          paddingTop:      5,
          height:          60,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon:  ({ color }) => (
            <Text style={{ fontSize: 22, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="AddBillTab"
        component={AddBillScreen}
        options={{
          tabBarLabel: 'Add Bill',
          tabBarIcon:  ({ color }) => (
            <Text style={{ fontSize: 22, color }}>➕</Text>
          ),
        }}
      />
      <Tab.Screen
        name="LedgerTab"
        component={LedgerScreen}
        options={{
          tabBarLabel: 'Ledger',
          tabBarIcon:  ({ color }) => (
            <Text style={{ fontSize: 22, color }}>📒</Text>
          ),
        }}
      />
      <Tab.Screen
  name="CustomersTab"
  component={CustomersScreen}
  options={{
    tabBarLabel: 'Customers',
    tabBarIcon:  ({ color }) => (
      <Text style={{ fontSize: 22, color }}>👥</Text>
    ),
  }}
/>

<Tab.Screen
  name="SettingsTab"
  component={SettingsScreen}
  options={{
    tabBarLabel: 'Settings',
    tabBarIcon:  ({ color }) => (
      <Text style={{ fontSize: 22, color }}>⚙️</Text>
    ),
    headerShown:  true,
    headerStyle:  { backgroundColor: '#7A2B83' },
    headerTintColor: '#fff',
    headerTitle:  '⚙️ Settings',
    headerTitleStyle: { fontWeight: 'bold', color: '#fff' },
  }}
/>

    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor="#7A2B83" />
        <Stack.Navigator screenOptions={screenOptions}>

          {/* Tabs are the root screen */}
          <Stack.Screen
            name="Tabs"
            component={TabScreens}
            options={{ headerShown: false }}
          />

          {/* All other screens push on top of tabs */}
          <Stack.Screen
            name="ReviewBill"
            component={ReviewScreen}
            options={{ title: 'Review & Confirm' }}
          />
          <Stack.Screen
            name="BillDetail"
            component={BillDetailScreen}
            options={{ title: 'Bill Details' }}
          />
          <Stack.Screen
            name="ReceivePayment"
            component={ReceivePaymentScreen}
            options={{ title: 'Receive Payment' }}
          />
          <Stack.Screen
            name="EditBill"
            component={EditBillScreen}
            options={{ title: 'Edit Bill' }}
          />
          <Stack.Screen
            name="EditPayment"
            component={EditPaymentScreen}
            options={{ title: 'Edit Payment' }}
          />
          <Stack.Screen
  name="LedgerReport"
  component={LedgerReportScreen}
  options={{ title: 'Ledger Report' }}
/>
          <Stack.Screen
  name="AllBills"
  component={AllBillsScreen}
  options={{ title: 'All Bills' }}
/>

        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}