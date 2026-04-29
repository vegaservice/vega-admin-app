// ████ VEGA ADMIN APP ████
// Super Admin Dashboard — iPhone Only (TestFlight)
// Version 1.0 — April 2026
// Mahesh Pappala — VEGA Home Services, Visakhapatnam

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, SafeAreaView, Dimensions,
  Animated, Modal, ActivityIndicator, RefreshControl, Platform,
  KeyboardAvoidingView,
} from 'react-native';

// ── Firebase
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const { width: W, height: H } = Dimensions.get('window');

// ══════════════════════════════════════════════════
// SUPER ADMIN NUMBERS — Only these can login
// ══════════════════════════════════════════════════
const ADMIN_PHONES = ['9441270570']; // Mahesh — add more here

// ══════════════════════════════════════════════════
// COLORS — VEGA Admin Dark Theme
// ══════════════════════════════════════════════════
const C = {
  bg:         '#0F0A06',
  card:       '#1A100A',
  card2:      '#231408',
  orange:     '#E8520A',
  orange2:    '#FF6B2B',
  orangeBg:   '#2A1408',
  orangeBd:   '#4A2010',
  gold:       '#D4901A',
  goldBg:     '#2A1E08',
  green:      '#22C55E',
  greenBg:    '#0A2010',
  greenBd:    '#1A4020',
  red:        '#EF4444',
  redBg:      '#2A0808',
  redBd:      '#4A1010',
  blue:       '#3B82F6',
  blueBg:     '#08102A',
  purple:     '#A855F7',
  purpleBg:   '#18082A',
  white:      '#FFFFFF',
  text:       '#F5EDE8',
  text2:      '#C8A898',
  muted:      '#886858',
  border:     '#2A1808',
  border2:    '#3A2010',
};

const SHADOW = {
  card: { shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.4, shadowRadius:8, elevation:4 },
  glow: { shadowColor:C.orange, shadowOffset:{width:0,height:0}, shadowOpacity:0.5, shadowRadius:12, elevation:6 },
};

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════
const fmt = (n) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(1)}K` : `₹${n||0}`;
const timeAgo = (ts) => {
  if (!ts) return 'Just now';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

const STATUS_COLORS = {
  Confirmed:  { bg: C.blueBg,   text: C.blue,   border: '#1A3060' },
  Assigned:   { bg: C.goldBg,   text: C.gold,   border: '#4A3010' },
  OnTheWay:   { bg: C.orangeBg, text: C.orange, border: C.orangeBd },
  Started:    { bg: C.purpleBg, text: C.purple, border: '#3A1060' },
  Completed:  { bg: C.greenBg,  text: C.green,  border: C.greenBd },
  Cancelled:  { bg: C.redBg,    text: C.red,    border: C.redBd },
};

// ══════════════════════════════════════════════════
// FIRESTORE HELPERS
// ══════════════════════════════════════════════════
const fbGetAll = async (col, limit = 50) => {
  try {
    const snap = await firestore().collection(col).orderBy('createdAt','desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.error(col, e); return []; }
};

const fbListen = (col, cb, query) => {
  let ref = firestore().collection(col).orderBy('createdAt','desc').limit(100);
  if (query) ref = query(firestore().collection(col));
  return ref.onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

const fbUpdate = async (col, id, data) => {
  try { await firestore().collection(col).doc(id).update(data); return true; }
  catch(e) { console.error('fbUpdate', e); return false; }
};

const fbSet = async (col, id, data) => {
  try { await firestore().collection(col).doc(id).set(data); return true; }
  catch(e) { console.error('fbSet', e); return false; }
};

const fbDelete = async (col, id) => {
  try { await firestore().collection(col).doc(id).delete(); return true; }
  catch(e) { console.error('fbDelete', e); return false; }
};

// ══════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════
export default function App() {
  const [screen,      setScreen]    = useState('splash');
  const [tab,         setTab]       = useState('dashboard');
  const [phone,       setPhone]     = useState('');
  const [otpVal,      setOtpVal]    = useState('');
  const [confirm,     setConfirm]   = useState(null);
  const [loading,     setLoading]   = useState(false);
  const [isAdmin,     setIsAdmin]   = useState(false);
  const [refreshing,  setRefreshing]= useState(false);

  // Data states
  const [bookings,    setBookings]  = useState([]);
  const [employees,   setEmployees] = useState([]);
  const [customers,   setCustomers] = useState([]);
  const [promos,      setPromos]    = useState({});
  const [settings,    setSettings]  = useState({});
  const [selBooking,  setSelBooking]= useState(null);
  const [selEmployee, setSelEmployee]= useState(null);

  // Modals
  const [addEmpModal, setAddEmpModal] = useState(false);
  const [addPromoModal, setAddPromoModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);

  // Form states
  const [empName,  setEmpName]  = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole,  setEmpRole]  = useState('worker');
  const [empArea,  setEmpArea]  = useState('Madhurawada');
  const [promoCode, setPromoCode] = useState('');
  const [promoType, setPromoType] = useState('pct');
  const [promoVal,  setPromoVal]  = useState('');
  const [promoLabel,setPromoLabel]= useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue:1, duration:1200, useNativeDriver:true }).start();
    setTimeout(() => setScreen('login'), 2500);
  }, []);

  // Load data when logged in
  useEffect(() => {
    if (screen !== 'main') return;
    // Real-time bookings listener
    const unsub = fbListen('bookings', setBookings);
    // Load employees + config
    fbGetAll('professionals', 100).then(setEmployees);
    fbGetAll('users', 100).then(setCustomers);
    firestore().collection('app_config').doc('promo_codes').get()
      .then(d => d.exists && setPromos(d.data()));
    firestore().collection('app_config').doc('settings').get()
      .then(d => d.exists && setSettings(d.data()));
    return () => unsub();
  }, [screen]);

  // ── AUTH
  const sendOTP = async () => {
    if (!phone || phone.length < 10) { Alert.alert('Invalid number'); return; }
    if (!ADMIN_PHONES.includes(phone)) {
      Alert.alert('Access Denied', 'This number is not authorized for VEGA Admin.');
      return;
    }
    setLoading(true);
    try {
      const c = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirm(c); setLoading(false); setScreen('otp');
    } catch(e) { setLoading(false); Alert.alert('OTP Failed', e.message); }
  };

  const verifyOTP = async () => {
    if (!otpVal || otpVal.length < 6) return;
    setLoading(true);
    try {
      await confirm.confirm(otpVal);
      setIsAdmin(true); setLoading(false); setScreen('main');
    } catch(e) { setLoading(false); Alert.alert('Wrong OTP', e.message); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fbGetAll('professionals', 100).then(setEmployees);
    await fbGetAll('users', 100).then(setCustomers);
    setRefreshing(false);
  };

  // ── COMPUTED STATS
  const todayStr = new Date().toDateString();
  const todayBookings = bookings.filter(b => {
    const d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt||0);
    return d.toDateString() === todayStr;
  });
  const todayRevenue = todayBookings.reduce((s,b) => s + (b.total||0), 0);
  const pendingBookings = bookings.filter(b => b.status === 'Confirmed');
  const activeEmployees = employees.filter(e => e.isAvailable && e.isActive);
  const totalRevenue = bookings.reduce((s,b) => s + (b.total||0), 0);

  // ── ASSIGN PROFESSIONAL
  const assignPro = async (booking, pro) => {
    const ok = await fbUpdate('bookings', booking.id, {
      professional: { id: pro.id, name: pro.name, phone: pro.phone, rating: pro.rating||4.9 },
      status: 'Assigned',
      assignedAt: firestore.FieldValue.serverTimestamp(),
    });
    if (ok) {
      Alert.alert('✅ Assigned', `${pro.name} assigned to booking ${booking.orderId}`);
      setAssignModal(false);
    }
  };

  const updateBookingStatus = async (booking, status) => {
    await fbUpdate('bookings', booking.id, {
      status, [`${status.toLowerCase()}At`]: firestore.FieldValue.serverTimestamp(),
    });
    Alert.alert('Updated', `Booking ${booking.orderId} → ${status}`);
  };

  const addEmployee = async () => {
    if (!empName || !empPhone) { Alert.alert('Fill all fields'); return; }
    const id = `worker_${empPhone}`;
    const empData = {
      id, name: empName, phone: empPhone,
      role: empRole, isAvailable: true, isActive: true,
      status: 'active',
      currentArea: empArea, assignedAreas: [empArea],
      ratingAvg: 4.9, totalReviews: 0, totalJobsCompleted: 0,
      performanceScore: 85, salary: 12000,
      joinedAt: firestore.FieldValue.serverTimestamp(),
      attendance: { jobsToday:0, jobsWeek:0, daysPresent:0, daysAbsent:0, daysLeave:0 },
      earnings: { today:0, thisWeek:0, thisMonth:0, total:0 },
    };
    // Write to both collections for compatibility
    await fbSet('workers', id, empData);
    await fbSet('professionals', id, empData);
    setAddEmpModal(false); setEmpName(''); setEmpPhone('');
    fbGetAll('professionals', 100).then(setEmployees);
    Alert.alert('✅ Added', `${empName} added as ${empRole}`);
  };

  const removeEmployee = (emp) => {
    Alert.alert('Remove Employee', `Remove ${emp.name} from VEGA?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await fbUpdate('professionals', emp.id, { isActive: false });
        fbGetAll('professionals', 100).then(setEmployees);
      }},
    ]);
  };

  const togglePromo = async (code, current) => {
    const updated = { ...promos, [code]: { ...promos[code], active: !current } };
    await fbSet('app_config', 'promo_codes', updated);
    setPromos(updated);
  };

  const addPromo = async () => {
    if (!promoCode || !promoVal) { Alert.alert('Fill all fields'); return; }
    const updated = { ...promos, [promoCode.toUpperCase()]: {
      type: promoType, val: Number(promoVal), label: promoLabel||promoCode, active: true,
    }};
    await fbSet('app_config', 'promo_codes', updated);
    setPromos(updated); setAddPromoModal(false);
    setPromoCode(''); setPromoVal(''); setPromoLabel('');
  };

  // ══════════════════════════════════════════════════
  // SPLASH
  // ══════════════════════════════════════════════════
  if (screen === 'splash') return (
    <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <Animated.View style={{ opacity:fadeAnim, alignItems:'center' }}>
        <Text style={{ fontSize:60 }}>🪷</Text>
        <Text style={{ fontSize:36, fontWeight:'900', color:C.orange, letterSpacing:6, marginTop:12 }}>VEGA</Text>
        <Text style={{ fontSize:14, color:C.text2, marginTop:8, letterSpacing:2 }}>ADMIN CONSOLE</Text>
        <View style={{ width:40, height:2, backgroundColor:C.orange, borderRadius:1, marginTop:16 }}/>
        <Text style={{ fontSize:11, color:C.muted, marginTop:12 }}>Visakhapatnam Operations</Text>
      </Animated.View>
    </View>
  );

  // ══════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════
  if (screen === 'login') return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <View style={{ flex:1, padding:24, justifyContent:'center' }}>
        <Text style={{ fontSize:32 }}>🪷</Text>
        <Text style={{ fontSize:28, fontWeight:'900', color:C.orange, marginTop:12 }}>Admin Login</Text>
        <Text style={{ fontSize:14, color:C.muted, marginTop:6, marginBottom:40 }}>Authorized personnel only</Text>

        <Text style={S.lbl}>Admin Mobile Number</Text>
        <View style={S.phoneRow}>
          <Text style={S.flag}>🇮🇳 +91</Text>
          <TextInput style={S.phoneInp} placeholder="9441270570" placeholderTextColor={C.muted}
            keyboardType="number-pad" maxLength={10} value={phone} onChangeText={setPhone}
            color={C.text}/>
        </View>

        <TouchableOpacity style={[S.btn, phone.length<10&&{opacity:0.4}, {marginTop:24}]}
          disabled={phone.length<10||loading} onPress={sendOTP}>
          {loading ? <ActivityIndicator color="#FFF"/> :
            <Text style={S.btnT}>Send OTP →</Text>}
        </TouchableOpacity>

        <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:24 }}>
          <View style={{ width:8, height:8, borderRadius:4, backgroundColor:C.green }}/>
          <Text style={{ color:C.muted, fontSize:12 }}>Secured with Firebase Authentication</Text>
        </View>
      </View>
    </SafeAreaView>
  );

  // ══════════════════════════════════════════════════
  // OTP
  // ══════════════════════════════════════════════════
  if (screen === 'otp') return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <View style={{ flex:1, padding:24, justifyContent:'center' }}>
        <TouchableOpacity onPress={()=>setScreen('login')} style={{ marginBottom:32 }}>
          <Text style={{ color:C.orange, fontSize:16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize:24, fontWeight:'900', color:C.text }}>Enter OTP</Text>
        <Text style={{ fontSize:13, color:C.muted, marginTop:6, marginBottom:32 }}>Sent to +91 {phone}</Text>

        <TextInput style={[S.inp, { fontSize:32, fontWeight:'900', letterSpacing:16, textAlign:'center', paddingVertical:20 }]}
          placeholder="——————" placeholderTextColor={C.border2}
          keyboardType="number-pad" maxLength={6} value={otpVal} onChangeText={setOtpVal}
          color={C.text}/>

        <TouchableOpacity style={[S.btn, otpVal.length<6&&{opacity:0.4}, {marginTop:24}]}
          disabled={otpVal.length<6||loading} onPress={verifyOTP}>
          {loading ? <ActivityIndicator color="#FFF"/> :
            <Text style={S.btnT}>Verify & Enter Admin →</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ══════════════════════════════════════════════════
  // BOOKING DETAIL MODAL
  // ══════════════════════════════════════════════════
  const BookingDetailModal = () => {
    if (!selBooking) return null;
    const sc = STATUS_COLORS[selBooking.status] || STATUS_COLORS.Confirmed;
    return (
      <Modal visible={!!selBooking} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
            <TouchableOpacity onPress={()=>setSelBooking(null)}>
              <Text style={{ color:C.orange, fontSize:16 }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:16 }}>Order #{selBooking.orderId}</Text>
            <View style={{ width:60 }}/>
          </View>
          <ScrollView style={{ padding:16 }}>
            {/* Status */}
            <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:16 }}>
              <View style={{ paddingHorizontal:14, paddingVertical:6, borderRadius:20, backgroundColor:sc.bg, borderWidth:1, borderColor:sc.border }}>
                <Text style={{ color:sc.text, fontWeight:'700', fontSize:13 }}>{selBooking.status}</Text>
              </View>
              <Text style={{ color:C.muted, fontSize:12 }}>{timeAgo(selBooking.createdAt)}</Text>
            </View>

            {/* Customer Info */}
            <View style={S.detailCard}>
              <Text style={S.detailTitle}>👤 Customer</Text>
              <Text style={S.detailVal}>{selBooking.userName || 'Unknown'}</Text>
              <Text style={{ color:C.orange, fontSize:14, marginTop:4 }}>📞 +91 {selBooking.userPhone}</Text>
              <Text style={{ color:C.muted, fontSize:13, marginTop:4 }}>📍 {selBooking.addressFull || 'No address'}</Text>
            </View>

            {/* Services */}
            <View style={S.detailCard}>
              <Text style={S.detailTitle}>🛠 Services</Text>
              {(selBooking.items||[]).map((item,i)=>(
                <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
                  <Text style={{ color:C.text2, fontSize:13, flex:1 }}>{item.name}</Text>
                  <Text style={{ color:C.orange, fontWeight:'700' }}>₹{item.price}</Text>
                </View>
              ))}
            </View>

            {/* Bill */}
            <View style={S.detailCard}>
              <Text style={S.detailTitle}>💰 Bill</Text>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
                <Text style={{ color:C.muted }}>Subtotal</Text>
                <Text style={{ color:C.text2 }}>₹{selBooking.subtotal||0}</Text>
              </View>
              {selBooking.promoDiscount>0 && (
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:4 }}>
                  <Text style={{ color:C.muted }}>Promo ({selBooking.promoCode})</Text>
                  <Text style={{ color:C.green }}>-₹{selBooking.promoDiscount}</Text>
                </View>
              )}
              {selBooking.walletUsed>0 && (
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:4 }}>
                  <Text style={{ color:C.muted }}>Wallet</Text>
                  <Text style={{ color:C.gold }}>-₹{selBooking.walletUsed}</Text>
                </View>
              )}
              <View style={{ height:1, backgroundColor:C.border, marginVertical:10 }}/>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:16 }}>Total</Text>
                <Text style={{ color:C.orange, fontWeight:'900', fontSize:18 }}>₹{selBooking.total}</Text>
              </View>
            </View>

            {/* Schedule */}
            <View style={S.detailCard}>
              <Text style={S.detailTitle}>📅 Schedule</Text>
              <Text style={{ color:C.text2, fontSize:14, marginTop:8 }}>{selBooking.slot}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:4 }}>Mode: {selBooking.bookingMode||'instant'}</Text>
              <Text style={{ color:C.gold, fontSize:14, marginTop:8 }}>🔐 OTP: {selBooking.otp}</Text>
            </View>

            {/* Professional */}
            {selBooking.professional ? (
              <View style={S.detailCard}>
                <Text style={S.detailTitle}>👩 Assigned Professional</Text>
                <Text style={{ color:C.text, fontSize:15, fontWeight:'600', marginTop:8 }}>{selBooking.professional.name}</Text>
                <Text style={{ color:C.orange }}>📞 +91 {selBooking.professional.phone}</Text>
              </View>
            ) : (
              <TouchableOpacity style={[S.btn, { marginBottom:12 }]}
                onPress={()=>{ setAssignModal(true); }}>
                <Text style={S.btnT}>👩 Assign Professional</Text>
              </TouchableOpacity>
            )}

            {/* Status Actions */}
            <View style={S.detailCard}>
              <Text style={S.detailTitle}>⚡ Update Status</Text>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 }}>
                {['Confirmed','Assigned','OnTheWay','Started','Completed','Cancelled'].map(st=>(
                  <TouchableOpacity key={st}
                    style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:16,
                      backgroundColor: selBooking.status===st ? C.orange : C.card2,
                      borderWidth:1, borderColor: selBooking.status===st ? C.orange : C.border2 }}
                    onPress={()=>updateBookingStatus(selBooking, st)}>
                    <Text style={{ color: selBooking.status===st ? '#FFF' : C.text2, fontSize:12, fontWeight:'600' }}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ height:40 }}/>
          </ScrollView>
        </SafeAreaView>

        {/* Assign Modal */}
        <Modal visible={assignModal} animationType="slide" presentationStyle="formSheet">
          <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
              <TouchableOpacity onPress={()=>setAssignModal(false)}>
                <Text style={{ color:C.orange }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color:C.text, fontWeight:'700' }}>Select Professional</Text>
              <View style={{ width:60 }}/>
            </View>
            <ScrollView style={{ padding:16 }}>
              {employees.filter(e=>e.isActive&&e.isAvailable).map(pro=>(
                <TouchableOpacity key={pro.id} style={[S.card, { flexDirection:'row', alignItems:'center', marginBottom:10 }]}
                  onPress={()=>assignPro(selBooking, pro)}>
                  <View style={{ width:44, height:44, borderRadius:22, backgroundColor:C.orangeBg, alignItems:'center', justifyContent:'center', marginRight:14 }}>
                    <Text style={{ color:C.orange, fontWeight:'900', fontSize:18 }}>{pro.name?.[0]||'?'}</Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:C.text, fontWeight:'700' }}>{pro.name}</Text>
                    <Text style={{ color:C.muted, fontSize:12 }}>📍 {pro.currentArea} • ⭐ {pro.rating}</Text>
                  </View>
                  <Text style={{ color:C.orange, fontSize:18 }}>›</Text>
                </TouchableOpacity>
              ))}
              {employees.filter(e=>e.isActive&&e.isAvailable).length === 0 && (
                <Text style={{ color:C.muted, textAlign:'center', marginTop:40 }}>No available professionals right now</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </Modal>
    );
  };

  // ══════════════════════════════════════════════════
  // DASHBOARD TAB
  // ══════════════════════════════════════════════════
  const DashboardTab = () => (
    <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange}/>}>

      {/* Header */}
      <View style={{ padding:20, paddingTop:8 }}>
        <Text style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>VEGA OPERATIONS</Text>
        <Text style={{ fontSize:26, fontWeight:'900', color:C.text, marginTop:4 }}>Good {new Date().getHours()<12?'Morning':'Evening'} 🪷</Text>
        <Text style={{ fontSize:13, color:C.muted }}>Visakhapatnam · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</Text>
      </View>

      {/* Urgent Alert */}
      {pendingBookings.length > 0 && (
        <TouchableOpacity style={{ marginHorizontal:16, marginBottom:16, backgroundColor:C.redBg, borderRadius:16, padding:16, flexDirection:'row', alignItems:'center', gap:12, borderWidth:1, borderColor:C.redBd }}
          onPress={()=>setTab('orders')}>
          <Text style={{ fontSize:24 }}>🔴</Text>
          <View style={{ flex:1 }}>
            <Text style={{ color:C.red, fontWeight:'800', fontSize:15 }}>{pendingBookings.length} Unassigned Booking{pendingBookings.length>1?'s':''}!</Text>
            <Text style={{ color:C.text2, fontSize:12, marginTop:2 }}>Tap to assign professionals now</Text>
          </View>
          <Text style={{ color:C.red, fontSize:22 }}>›</Text>
        </TouchableOpacity>
      )}

      {/* Stats Grid */}
      <View style={{ flexDirection:'row', flexWrap:'wrap', paddingHorizontal:12, gap:8, marginBottom:8 }}>
        {[
          { label:"Today's Revenue", val: fmt(todayRevenue), icon:'💰', color:C.gold },
          { label:'Total Revenue', val: fmt(totalRevenue), icon:'📈', color:C.green },
          { label:"Today's Bookings", val: todayBookings.length, icon:'📦', color:C.blue },
          { label:'Active Staff', val: activeEmployees.length, icon:'👥', color:C.orange },
          { label:'Total Bookings', val: bookings.length, icon:'🗂', color:C.purple },
          { label:'Total Customers', val: customers.length, icon:'🏠', color:C.orange2 },
        ].map((stat,i)=>(
          <View key={i} style={{ width:(W-40)/2, backgroundColor:C.card, borderRadius:18, padding:16, borderWidth:0.5, borderColor:C.border2, ...SHADOW.card }}>
            <Text style={{ fontSize:28 }}>{stat.icon}</Text>
            <Text style={{ fontSize:26, fontWeight:'900', color:stat.color, marginTop:10 }}>{stat.val}</Text>
            <Text style={{ fontSize:11, color:C.muted, marginTop:4 }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Recent Bookings */}
      <View style={{ paddingHorizontal:16, marginTop:8 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <Text style={{ fontSize:17, fontWeight:'800', color:C.text }}>Recent Bookings</Text>
          <TouchableOpacity onPress={()=>setTab('orders')}>
            <Text style={{ color:C.orange, fontSize:13 }}>See all →</Text>
          </TouchableOpacity>
        </View>
        {bookings.slice(0,5).map(b => {
          const sc = STATUS_COLORS[b.status] || STATUS_COLORS.Confirmed;
          return (
            <TouchableOpacity key={b.id} style={[S.card, { flexDirection:'row', alignItems:'center', marginBottom:10 }]}
              onPress={()=>setSelBooking(b)}>
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
                  <Text style={{ color:C.orange, fontWeight:'700', fontSize:13 }}>{b.orderId}</Text>
                  <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:10, backgroundColor:sc.bg, borderWidth:0.5, borderColor:sc.border }}>
                    <Text style={{ color:sc.text, fontSize:10, fontWeight:'700' }}>{b.status}</Text>
                  </View>
                </View>
                <Text style={{ color:C.text2, fontSize:13 }}>{b.userName} · {b.userPhone}</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{timeAgo(b.createdAt)}</Text>
              </View>
              <Text style={{ color:C.orange, fontWeight:'900', fontSize:16 }}>₹{b.total}</Text>
            </TouchableOpacity>
          );
        })}
        {bookings.length === 0 && (
          <View style={{ alignItems:'center', padding:40 }}>
            <Text style={{ fontSize:48 }}>📦</Text>
            <Text style={{ color:C.muted, marginTop:12 }}>No bookings yet</Text>
          </View>
        )}
      </View>
      <View style={{ height:100 }}/>
    </ScrollView>
  );

  // ══════════════════════════════════════════════════
  // ORDERS TAB
  // ══════════════════════════════════════════════════
  const OrdersTab = () => {
    const [filter, setFilter] = useState('All');
    const filters = ['All','Confirmed','Assigned','OnTheWay','Started','Completed','Cancelled'];
    const filtered = filter==='All' ? bookings : bookings.filter(b=>b.status===filter);
    return (
      <View style={{ flex:1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ paddingVertical:12, paddingHorizontal:16, maxHeight:56 }}>
          {filters.map(f => {
            const sc = STATUS_COLORS[f];
            return (
              <TouchableOpacity key={f} onPress={()=>setFilter(f)}
                style={{ paddingHorizontal:14, paddingVertical:6, borderRadius:20, marginRight:8,
                  backgroundColor: filter===f ? C.orange : C.card,
                  borderWidth:1, borderColor: filter===f ? C.orange : C.border2 }}>
                <Text style={{ color: filter===f ? '#FFF' : C.text2, fontWeight:'600', fontSize:13 }}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <ScrollView style={{ flex:1, paddingHorizontal:16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange}/>}>
          <Text style={{ color:C.muted, fontSize:12, marginBottom:12 }}>{filtered.length} bookings</Text>
          {filtered.map(b => {
            const sc = STATUS_COLORS[b.status] || STATUS_COLORS.Confirmed;
            return (
              <TouchableOpacity key={b.id} style={[S.card, { marginBottom:10 }]}
                onPress={()=>setSelBooking(b)}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:6 }}>
                      <Text style={{ color:C.orange, fontWeight:'800', fontSize:14 }}>{b.orderId}</Text>
                      <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:10, backgroundColor:sc.bg, borderWidth:0.5, borderColor:sc.border }}>
                        <Text style={{ color:sc.text, fontSize:11, fontWeight:'700' }}>{b.status}</Text>
                      </View>
                    </View>
                    <Text style={{ color:C.text, fontSize:14, fontWeight:'600' }}>{b.userName||'Customer'}</Text>
                    <Text style={{ color:C.muted, fontSize:12 }}>📞 {b.userPhone}</Text>
                    <Text style={{ color:C.text2, fontSize:12, marginTop:4 }}>📍 {b.addressFull||'No address'}</Text>
                    <Text style={{ color:C.muted, fontSize:11, marginTop:4 }}>📅 {b.slot}</Text>
                    {b.professional && (
                      <Text style={{ color:C.green, fontSize:12, marginTop:4 }}>👩 {b.professional.name}</Text>
                    )}
                    {!b.professional && b.status==='Confirmed' && (
                      <Text style={{ color:C.red, fontSize:12, marginTop:4 }}>⚠️ No professional assigned</Text>
                    )}
                  </View>
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={{ color:C.orange, fontWeight:'900', fontSize:18 }}>₹{b.total}</Text>
                    <Text style={{ color:C.muted, fontSize:11, marginTop:4 }}>{timeAgo(b.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          {filtered.length===0 && (
            <View style={{ alignItems:'center', padding:60 }}>
              <Text style={{ fontSize:48 }}>📭</Text>
              <Text style={{ color:C.muted, marginTop:12 }}>No {filter} bookings</Text>
            </View>
          )}
          <View style={{ height:100 }}/>
        </ScrollView>
      </View>
    );
  };

  // ══════════════════════════════════════════════════
  // EMPLOYEES TAB
  // ══════════════════════════════════════════════════
  const EmployeesTab = () => {
    const [empFilter, setEmpFilter] = useState('All');
    const active = employees.filter(e => e.isActive !== false);
    const filtered = empFilter==='All' ? active :
      empFilter==='Available' ? active.filter(e=>e.isAvailable) :
      empFilter==='Busy' ? active.filter(e=>!e.isAvailable) :
      active.filter(e=>e.role===empFilter);

    return (
      <View style={{ flex:1 }}>
        <View style={{ padding:16, paddingBottom:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ color:C.text, fontWeight:'800', fontSize:17 }}>{active.length} Employees</Text>
          <TouchableOpacity style={{ backgroundColor:C.orange, paddingHorizontal:16, paddingVertical:8, borderRadius:20, ...SHADOW.glow }}
            onPress={()=>setAddEmpModal(true)}>
            <Text style={{ color:'#FFF', fontWeight:'700', fontSize:13 }}>+ Add Employee</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal:16, maxHeight:48 }}>
          {['All','Available','Busy','hub_manager','worker'].map(f=>(
            <TouchableOpacity key={f} onPress={()=>setEmpFilter(f)}
              style={{ paddingHorizontal:14, paddingVertical:6, borderRadius:20, marginRight:8,
                backgroundColor:empFilter===f?C.orange:C.card, borderWidth:1,
                borderColor:empFilter===f?C.orange:C.border2 }}>
              <Text style={{ color:empFilter===f?'#FFF':C.text2, fontWeight:'600', fontSize:12 }}>
                {f==='hub_manager'?'Managers':f==='worker'?'Workers':f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView style={{ flex:1, padding:16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange}/>}>
          {filtered.map(emp => (
            <View key={emp.id} style={[S.card, { marginBottom:10 }]}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <View style={{ width:48, height:48, borderRadius:24, backgroundColor:C.orangeBg, alignItems:'center', justifyContent:'center', marginRight:14, borderWidth:1, borderColor:C.orangeBd }}>
                  <Text style={{ color:C.orange, fontWeight:'900', fontSize:20 }}>{emp.name?.[0]||'?'}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }}>{emp.name}</Text>
                  <Text style={{ color:C.muted, fontSize:12 }}>📞 {emp.phone}</Text>
                  <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
                    <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:8,
                      backgroundColor: emp.isAvailable ? C.greenBg : C.redBg,
                      borderWidth:0.5, borderColor: emp.isAvailable ? C.greenBd : C.redBd }}>
                      <Text style={{ color: emp.isAvailable ? C.green : C.red, fontSize:10, fontWeight:'700' }}>
                        {emp.isAvailable ? '● Available' : '● Busy'}
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:8, backgroundColor:C.card2, borderWidth:0.5, borderColor:C.border2 }}>
                      <Text style={{ color:C.text2, fontSize:10 }}>{emp.role==='hub_manager'?'Manager':'Worker'}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems:'flex-end', gap:6 }}>
                  <Text style={{ color:C.gold, fontSize:12 }}>⭐ {emp.rating||4.9}</Text>
                  <Text style={{ color:C.muted, fontSize:11 }}>{emp.totalJobs||0} jobs</Text>
                  <TouchableOpacity onPress={()=>{
                    Alert.alert(emp.name, 'Choose action', [
                      { text:'Toggle Available', onPress: async ()=>{
                        await fbUpdate('professionals',emp.id,{isAvailable:!emp.isAvailable});
                        fbGetAll('professionals',100).then(setEmployees);
                      }},
                      { text:'Remove Employee', style:'destructive', onPress:()=>removeEmployee(emp) },
                      { text:'Cancel', style:'cancel' },
                    ]);
                  }}>
                    <View style={{ backgroundColor:C.card2, paddingHorizontal:10, paddingVertical:4, borderRadius:10, borderWidth:0.5, borderColor:C.border2 }}>
                      <Text style={{ color:C.text2, fontSize:11 }}>⋯ Actions</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ height:1, backgroundColor:C.border, marginVertical:10 }}/>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <View style={{ alignItems:'center' }}>
                  <Text style={{ color:C.orange, fontWeight:'700' }}>{fmt(emp.earnings?.today||0)}</Text>
                  <Text style={{ color:C.muted, fontSize:10 }}>Today</Text>
                </View>
                <View style={{ alignItems:'center' }}>
                  <Text style={{ color:C.orange, fontWeight:'700' }}>{fmt(emp.earnings?.thisWeek||0)}</Text>
                  <Text style={{ color:C.muted, fontSize:10 }}>This Week</Text>
                </View>
                <View style={{ alignItems:'center' }}>
                  <Text style={{ color:C.orange, fontWeight:'700' }}>{fmt(emp.earnings?.thisMonth||0)}</Text>
                  <Text style={{ color:C.muted, fontSize:10 }}>This Month</Text>
                </View>
                <View style={{ alignItems:'center' }}>
                  <Text style={{ color:C.gold, fontWeight:'700' }}>{fmt(emp.earnings?.total||0)}</Text>
                  <Text style={{ color:C.muted, fontSize:10 }}>Total</Text>
                </View>
              </View>
            </View>
          ))}
          {filtered.length===0 && (
            <View style={{ alignItems:'center', padding:60 }}>
              <Text style={{ fontSize:48 }}>👥</Text>
              <Text style={{ color:C.muted, marginTop:12 }}>No employees yet</Text>
              <TouchableOpacity style={[S.btn,{marginTop:20}]} onPress={()=>setAddEmpModal(true)}>
                <Text style={S.btnT}>+ Add First Employee</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height:100 }}/>
        </ScrollView>

        {/* Add Employee Modal */}
        <Modal visible={addEmpModal} animationType="slide" presentationStyle="formSheet">
          <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
              <TouchableOpacity onPress={()=>setAddEmpModal(false)}>
                <Text style={{ color:C.red }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color:C.text, fontWeight:'700' }}>Add Employee</Text>
              <TouchableOpacity onPress={addEmployee}>
                <Text style={{ color:C.orange, fontWeight:'700' }}>Save</Text>
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
            <ScrollView style={{ padding:16 }} keyboardShouldPersistTaps="handled">
              <Text style={S.lbl}>Full Name</Text>
              <TextInput style={S.inp} placeholder="Lakshmi Devi" placeholderTextColor={C.muted}
                value={empName} onChangeText={setEmpName} color={C.text}/>
              <Text style={S.lbl}>Mobile Number</Text>
              <TextInput style={S.inp} placeholder="9876543210" placeholderTextColor={C.muted}
                keyboardType="number-pad" maxLength={10} value={empPhone} onChangeText={setEmpPhone} color={C.text}/>
              <Text style={S.lbl}>Role</Text>
              <View style={{ flexDirection:'row', gap:10, marginBottom:16 }}>
                {[['worker','Worker'],['hub_manager','Hub Manager']].map(([val,lbl])=>(
                  <TouchableOpacity key={val} onPress={()=>setEmpRole(val)}
                    style={{ flex:1, padding:14, borderRadius:14, alignItems:'center',
                      backgroundColor:empRole===val?C.orange:C.card, borderWidth:1,
                      borderColor:empRole===val?C.orange:C.border2 }}>
                    <Text style={{ color:empRole===val?'#FFF':C.text2, fontWeight:'700' }}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={S.lbl}>Area</Text>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
                {['Madhurawada','Rushikonda','MVP Colony','Gajuwaka'].map(a=>(
                  <TouchableOpacity key={a} onPress={()=>setEmpArea(a)}
                    style={{ paddingHorizontal:14, paddingVertical:8, borderRadius:20,
                      backgroundColor:empArea===a?C.orange:C.card, borderWidth:1,
                      borderColor:empArea===a?C.orange:C.border2 }}>
                    <Text style={{ color:empArea===a?'#FFF':C.text2, fontSize:13 }}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </View>
    );
  };

  // ══════════════════════════════════════════════════
  // FINANCE TAB
  // ══════════════════════════════════════════════════
  const FinanceTab = () => {
    const completed = bookings.filter(b=>b.status==='Completed');
    const totalCompleted = completed.reduce((s,b)=>s+(b.total||0),0);
    const totalPromo = bookings.reduce((s,b)=>s+(b.promoDiscount||0),0);
    const totalWallet = bookings.reduce((s,b)=>s+(b.walletUsed||0),0);
    const totalFees = bookings.reduce((s,b)=>s+(b.platformFee||0),0);

    // Weekly breakdown (last 7 days)
    const weekData = Array.from({length:7},(_,i)=>{
      const d = new Date(); d.setDate(d.getDate()-i);
      const dayStr = d.toDateString();
      const dayBookings = bookings.filter(b=>{
        const bd = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt||0);
        return bd.toDateString()===dayStr;
      });
      return {
        label: i===0?'Today':['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
        revenue: dayBookings.reduce((s,b)=>s+(b.total||0),0),
        count: dayBookings.length,
      };
    }).reverse();

    const maxRev = Math.max(...weekData.map(d=>d.revenue), 1);

    return (
      <ScrollView style={{ flex:1, padding:16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange}/>}>
        <Text style={{ fontSize:17, fontWeight:'800', color:C.text, marginBottom:16 }}>Finance Overview</Text>

        {/* Summary Cards */}
        <View style={{ flexDirection:'row', gap:10, marginBottom:16 }}>
          <View style={[S.card, { flex:1, alignItems:'center' }]}>
            <Text style={{ fontSize:11, color:C.muted, marginBottom:6 }}>TOTAL REVENUE</Text>
            <Text style={{ fontSize:24, fontWeight:'900', color:C.gold }}>{fmt(totalRevenue)}</Text>
            <Text style={{ fontSize:11, color:C.muted, marginTop:4 }}>{bookings.length} orders</Text>
          </View>
          <View style={[S.card, { flex:1, alignItems:'center' }]}>
            <Text style={{ fontSize:11, color:C.muted, marginBottom:6 }}>COMPLETED</Text>
            <Text style={{ fontSize:24, fontWeight:'900', color:C.green }}>{fmt(totalCompleted)}</Text>
            <Text style={{ fontSize:11, color:C.muted, marginTop:4 }}>{completed.length} jobs</Text>
          </View>
        </View>

        {/* Deductions */}
        <View style={S.card}>
          <Text style={{ color:C.text2, fontWeight:'700', marginBottom:14 }}>💸 Discounts Given</Text>
          {[
            { label:'Promo Discounts', val:totalPromo, color:C.red },
            { label:'Wallet Credits Used', val:totalWallet, color:C.gold },
            { label:'Platform Fees Collected', val:totalFees, color:C.green },
          ].map((item,i)=>(
            <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:10 }}>
              <Text style={{ color:C.muted, fontSize:14 }}>{item.label}</Text>
              <Text style={{ color:item.color, fontWeight:'700', fontSize:15 }}>{fmt(item.val)}</Text>
            </View>
          ))}
        </View>

        {/* Weekly Chart */}
        <View style={[S.card, { marginTop:12 }]}>
          <Text style={{ color:C.text2, fontWeight:'700', marginBottom:16 }}>📊 Last 7 Days</Text>
          <View style={{ flexDirection:'row', alignItems:'flex-end', gap:6, height:120 }}>
            {weekData.map((d,i)=>(
              <View key={i} style={{ flex:1, alignItems:'center' }}>
                <Text style={{ color:C.muted, fontSize:9, marginBottom:4 }}>
                  {d.revenue>0 ? `₹${d.revenue}` : ''}
                </Text>
                <View style={{
                  width:'100%', borderRadius:6,
                  height: Math.max(8, (d.revenue/maxRev)*90),
                  backgroundColor: i===6?C.orange:C.orangeBg,
                  borderWidth: i===6?0:0.5, borderColor:C.orangeBd,
                }}/>
                <Text style={{ color:C.muted, fontSize:10, marginTop:6 }}>{d.label}</Text>
                <Text style={{ color:C.text2, fontSize:9 }}>{d.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Payment Methods Breakdown */}
        <View style={[S.card, { marginTop:12 }]}>
          <Text style={{ color:C.text2, fontWeight:'700', marginBottom:14 }}>💳 Payment Methods</Text>
          {['upi','card','netbanking','cash'].map(method=>{
            const count = bookings.filter(b=>b.paymentMethod===method).length;
            const pct = bookings.length ? Math.round(count/bookings.length*100) : 0;
            return count > 0 ? (
              <View key={method} style={{ marginBottom:10 }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
                  <Text style={{ color:C.text2, fontSize:13, textTransform:'capitalize' }}>{method}</Text>
                  <Text style={{ color:C.muted, fontSize:12 }}>{count} orders ({pct}%)</Text>
                </View>
                <View style={{ height:4, backgroundColor:C.border, borderRadius:2 }}>
                  <View style={{ height:4, width:`${pct}%`, backgroundColor:C.orange, borderRadius:2 }}/>
                </View>
              </View>
            ) : null;
          })}
        </View>
        <View style={{ height:100 }}/>
      </ScrollView>
    );
  };

  // ══════════════════════════════════════════════════
  // OFFERS TAB
  // ══════════════════════════════════════════════════
  const OffersTab = () => (
    <ScrollView style={{ flex:1, padding:16 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <Text style={{ fontSize:17, fontWeight:'800', color:C.text }}>Promo Codes</Text>
        <TouchableOpacity style={{ backgroundColor:C.orange, paddingHorizontal:16, paddingVertical:8, borderRadius:20, ...SHADOW.glow }}
          onPress={()=>setAddPromoModal(true)}>
          <Text style={{ color:'#FFF', fontWeight:'700', fontSize:13 }}>+ Add Promo</Text>
        </TouchableOpacity>
      </View>

      {Object.entries(promos).map(([code, promo])=>(
        <View key={code} style={[S.card, { marginBottom:10 }]}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
            <View style={{ flex:1 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:6 }}>
                <Text style={{ color:C.orange, fontWeight:'900', fontSize:18 }}>{code}</Text>
                <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:8,
                  backgroundColor:promo.active?C.greenBg:C.redBg, borderWidth:0.5,
                  borderColor:promo.active?C.greenBd:C.redBd }}>
                  <Text style={{ color:promo.active?C.green:C.red, fontSize:11, fontWeight:'700' }}>
                    {promo.active?'ACTIVE':'INACTIVE'}
                  </Text>
                </View>
              </View>
              <Text style={{ color:C.text2, fontSize:13 }}>{promo.label}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:4 }}>
                {promo.type==='pct' ? `${promo.val}% off` : `₹${promo.val} flat off`}
                {promo.minOrder ? ` · Min order ₹${promo.minOrder}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={()=>togglePromo(code, promo.active)}
              style={{ paddingHorizontal:14, paddingVertical:8, borderRadius:14,
                backgroundColor:promo.active?C.redBg:C.greenBg, borderWidth:1,
                borderColor:promo.active?C.redBd:C.greenBd }}>
              <Text style={{ color:promo.active?C.red:C.green, fontWeight:'700', fontSize:12 }}>
                {promo.active?'Disable':'Enable'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {Object.keys(promos).length===0 && (
        <View style={{ alignItems:'center', padding:60 }}>
          <Text style={{ fontSize:48 }}>🎟️</Text>
          <Text style={{ color:C.muted, marginTop:12 }}>No promo codes yet</Text>
        </View>
      )}

      {/* Add Promo Modal */}
      <Modal visible={addPromoModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
            <TouchableOpacity onPress={()=>setAddPromoModal(false)}>
              <Text style={{ color:C.red }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color:C.text, fontWeight:'700' }}>New Promo Code</Text>
            <TouchableOpacity onPress={addPromo}>
              <Text style={{ color:C.orange, fontWeight:'700' }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding:16 }}>
            <Text style={S.lbl}>Promo Code (e.g. DIWALI25)</Text>
            <TextInput style={S.inp} placeholder="DIWALI25" placeholderTextColor={C.muted}
              autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} color={C.text}/>
            <Text style={S.lbl}>Display Label</Text>
            <TextInput style={S.inp} placeholder="25% off for Diwali" placeholderTextColor={C.muted}
              value={promoLabel} onChangeText={setPromoLabel} color={C.text}/>
            <Text style={S.lbl}>Discount Type</Text>
            <View style={{ flexDirection:'row', gap:10, marginBottom:16 }}>
              {[['pct','Percentage (%)'],['flat','Flat Amount (₹)']].map(([val,lbl])=>(
                <TouchableOpacity key={val} onPress={()=>setPromoType(val)}
                  style={{ flex:1, padding:14, borderRadius:14, alignItems:'center',
                    backgroundColor:promoType===val?C.orange:C.card, borderWidth:1,
                    borderColor:promoType===val?C.orange:C.border2 }}>
                  <Text style={{ color:promoType===val?'#FFF':C.text2, fontWeight:'700', fontSize:13 }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={S.lbl}>Value ({promoType==='pct'?'% off':'₹ off'})</Text>
            <TextInput style={S.inp} placeholder={promoType==='pct'?'50':'100'} placeholderTextColor={C.muted}
              keyboardType="number-pad" value={promoVal} onChangeText={setPromoVal} color={C.text}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <View style={{ height:100 }}/>
    </ScrollView>
  );

  // ══════════════════════════════════════════════════
  // REVIEWS TAB
  // ══════════════════════════════════════════════════
  const ReviewsTab = () => {
    const rated = bookings.filter(b=>b.rated && b.rating);
    const avgRating = rated.length ? (rated.reduce((s,b)=>s+b.rating,0)/rated.length).toFixed(1) : '—';
    const stars = [5,4,3,2,1];
    return (
      <ScrollView style={{ flex:1, padding:16 }}>
        {/* Summary */}
        <View style={[S.card, { flexDirection:'row', alignItems:'center', marginBottom:16 }]}>
          <View style={{ flex:1, alignItems:'center' }}>
            <Text style={{ fontSize:48, fontWeight:'900', color:C.orange }}>{avgRating}</Text>
            <Text style={{ fontSize:20, marginTop:4 }}>{'⭐'.repeat(Math.round(Number(avgRating)||0))}</Text>
            <Text style={{ color:C.muted, fontSize:12, marginTop:4 }}>{rated.length} reviews</Text>
          </View>
          <View style={{ flex:2 }}>
            {stars.map(s=>{
              const count = rated.filter(b=>Math.round(b.rating)===s).length;
              const pct = rated.length ? count/rated.length*100 : 0;
              return (
                <View key={s} style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:6 }}>
                  <Text style={{ color:C.muted, width:20, fontSize:12 }}>{s}★</Text>
                  <View style={{ flex:1, height:6, backgroundColor:C.border, borderRadius:3 }}>
                    <View style={{ height:6, width:`${pct}%`, backgroundColor:C.orange, borderRadius:3 }}/>
                  </View>
                  <Text style={{ color:C.muted, width:24, fontSize:11 }}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Reviews list */}
        {rated.sort((a,b)=>(b.rating-a.rating)).map(b=>(
          <View key={b.id} style={[S.card, { marginBottom:10 }]}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
              <Text style={{ color:C.text, fontWeight:'700' }}>{b.userName||'Customer'}</Text>
              <Text style={{ fontSize:14 }}>{'⭐'.repeat(b.rating||0)}</Text>
            </View>
            {b.ratingNote && <Text style={{ color:C.text2, fontSize:13, lineHeight:18, fontStyle:'italic' }}>"{b.ratingNote}"</Text>}
            <Text style={{ color:C.muted, fontSize:11, marginTop:6 }}>{b.orderId} · {timeAgo(b.ratedAt||b.createdAt)}</Text>
          </View>
        ))}
        {rated.length===0 && (
          <View style={{ alignItems:'center', padding:60 }}>
            <Text style={{ fontSize:48 }}>⭐</Text>
            <Text style={{ color:C.muted, marginTop:12 }}>No reviews yet</Text>
          </View>
        )}
        <View style={{ height:100 }}/>
      </ScrollView>
    );
  };

  // ══════════════════════════════════════════════════
  // MAIN — Tab Navigation
  // ══════════════════════════════════════════════════
  const TABS = [
    { id:'dashboard', icon:'🏠', label:'Home' },
    { id:'orders',    icon:'📦', label:'Orders' },
    { id:'employees', icon:'👥', label:'Team' },
    { id:'finance',   icon:'💰', label:'Finance' },
    { id:'offers',    icon:'🎟️', label:'Offers' },
    { id:'reviews',   icon:'⭐', label:'Reviews' },
  ];

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <SafeAreaView style={{ flex:1 }}>
        {/* Top Bar */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:12, borderBottomWidth:0.5, borderBottomColor:C.border }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Text style={{ fontSize:18 }}>🪷</Text>
            <Text style={{ fontSize:16, fontWeight:'900', color:C.orange, letterSpacing:2 }}>VEGA</Text>
            <View style={{ backgroundColor:C.orangeBg, paddingHorizontal:8, paddingVertical:2, borderRadius:8, borderWidth:0.5, borderColor:C.orangeBd }}>
              <Text style={{ color:C.orange, fontSize:9, fontWeight:'700', letterSpacing:1 }}>ADMIN</Text>
            </View>
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
            {pendingBookings.length>0 && (
              <View style={{ backgroundColor:C.red, width:20, height:20, borderRadius:10, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:'#FFF', fontSize:11, fontWeight:'900' }}>{pendingBookings.length}</Text>
              </View>
            )}
            <TouchableOpacity onPress={()=>Alert.alert('Logout','Sign out of VEGA Admin?',[
              {text:'Cancel',style:'cancel'},
              {text:'Logout',style:'destructive',onPress:()=>{auth().signOut();setScreen('login');setTab('dashboard');}},
            ])}>
              <Text style={{ color:C.muted, fontSize:13 }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={{ flex:1 }}>
          {tab==='dashboard' && <DashboardTab/>}
          {tab==='orders'    && <OrdersTab/>}
          {tab==='employees' && <EmployeesTab/>}
          {tab==='finance'   && <FinanceTab/>}
          {tab==='offers'    && <OffersTab/>}
          {tab==='reviews'   && <ReviewsTab/>}
        </View>

        {/* Tab Bar */}
        <View style={{ flexDirection:'row', borderTopWidth:0.5, borderTopColor:C.border, backgroundColor:C.card, paddingBottom:Platform.OS==='ios'?16:8, paddingTop:8 }}>
          {TABS.map(t=>(
            <TouchableOpacity key={t.id} style={{ flex:1, alignItems:'center', gap:3 }} onPress={()=>setTab(t.id)}>
              <Text style={{ fontSize:tab===t.id?24:20 }}>{t.icon}</Text>
              <Text style={{ fontSize:9, fontWeight:tab===t.id?'800':'500', color:tab===t.id?C.orange:C.muted }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* Booking Detail Modal */}
      <BookingDetailModal/>
    </View>
  );
}

// ══════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════
const S = StyleSheet.create({
  lbl:      { color:'#886858', fontSize:12, fontWeight:'600', marginBottom:8, marginTop:16 },
  inp:      { backgroundColor:'#1A100A', borderWidth:0.5, borderColor:'#3A2010', borderRadius:14, padding:14, fontSize:15, color:'#F5EDE8' },
  phoneRow: { flexDirection:'row', backgroundColor:'#1A100A', borderWidth:0.5, borderColor:'#3A2010', borderRadius:14, overflow:'hidden' },
  flag:     { padding:14, fontSize:13, fontWeight:'700', color:'#F5EDE8', backgroundColor:'#231408', borderRightWidth:0.5, borderRightColor:'#3A2010' },
  phoneInp: { flex:1, padding:14, fontSize:15, letterSpacing:2 },
  btn:      { backgroundColor:'#E8520A', borderRadius:30, padding:16, alignItems:'center', shadowColor:'#E8520A', shadowOffset:{width:0,height:0}, shadowOpacity:0.5, shadowRadius:12, elevation:6 },
  btnT:     { color:'#FFF', fontSize:15, fontWeight:'800' },
  card:     { backgroundColor:'#1A100A', borderRadius:18, padding:16, borderWidth:0.5, borderColor:'#3A2010', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.4, shadowRadius:8, elevation:4 },
  detailCard:  { backgroundColor:'#1A100A', borderRadius:18, padding:16, borderWidth:0.5, borderColor:'#3A2010', marginBottom:12 },
  detailTitle: { color:'#886858', fontSize:12, fontWeight:'700', letterSpacing:1, marginBottom:4 },
  detailVal:   { color:'#F5EDE8', fontSize:16, fontWeight:'700' },
});
