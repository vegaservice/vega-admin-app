// ████ VEGA ADMIN APP ████
// Super Admin Dashboard — v2.0 May 2026
// Mahesh Pappala — VEGA Home Services, Visakhapatnam
// FIX: All tab components moved OUTSIDE App() → no keyboard dismissal on typing

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, SafeAreaView, Dimensions,
  Animated, Modal, ActivityIndicator, RefreshControl, Platform,
  KeyboardAvoidingView,
} from 'react-native';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';

const { width: W } = Dimensions.get('window');

// ══════════════════════════════════════════════════
// SUPER ADMIN NUMBERS
// ══════════════════════════════════════════════════
const ADMIN_PHONES = ['9441270570'];

// ══════════════════════════════════════════════════
// COLORS
// ══════════════════════════════════════════════════
const C = {
  bg:       '#0F0A06',
  card:     '#1A100A',
  card2:    '#231408',
  orange:   '#E8520A',
  orange2:  '#FF6B2B',
  orangeBg: '#2A1408',
  orangeBd: '#4A2010',
  gold:     '#D4901A',
  goldBg:   '#2A1E08',
  green:    '#22C55E',
  greenBg:  '#0A2010',
  greenBd:  '#1A4020',
  red:      '#EF4444',
  redBg:    '#2A0808',
  redBd:    '#4A1010',
  blue:     '#3B82F6',
  blueBg:   '#08102A',
  purple:   '#A855F7',
  purpleBg: '#18082A',
  white:    '#FFFFFF',
  text:     '#F5EDE8',
  text2:    '#C8A898',
  muted:    '#886858',
  border:   '#2A1808',
  border2:  '#3A2010',
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

const fmtTime = (ts) => {
  if (!ts) return '--';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: true });
};

const STATUS_COLORS = {
  confirmed:   { bg: C.blueBg,   text: C.blue,   border: '#1A3060' },
  assigned:    { bg: C.goldBg,   text: C.gold,   border: '#4A3010' },
  on_the_way:  { bg: C.orangeBg, text: C.orange, border: C.orangeBd },
  in_progress: { bg: C.purpleBg, text: C.purple, border: '#3A1060' },
  completed:   { bg: C.greenBg,  text: C.green,  border: C.greenBd },
  cancelled:   { bg: C.redBg,    text: C.red,    border: C.redBd },
  rejected:    { bg: C.redBg,    text: C.red,    border: C.redBd },
};

const WORKER_STATUS_COLORS = {
  working: { bg: C.orangeBg, text: C.orange, border: C.orangeBd, dot: C.orange },
  idle:    { bg: C.greenBg,  text: C.green,  border: C.greenBd,  dot: C.green  },
  offline: { bg: C.card2,    text: C.muted,  border: C.border2,  dot: C.muted  },
};

// ══════════════════════════════════════════════════
// FIRESTORE HELPERS
// ══════════════════════════════════════════════════
const fbGetAll = async (col, limit = 100) => {
  try {
    const snap = await firestore().collection(col).orderBy('createdAt','desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.error(col, e); return []; }
};

const fbUpdate = async (col, id, data) => {
  try { await firestore().collection(col).doc(id).update(data); return true; }
  catch(e) { console.error('fbUpdate', e); return false; }
};

const fbSet = async (col, id, data) => {
  try { await firestore().collection(col).doc(id).set(data); return true; }
  catch(e) { console.error('fbSet', e); return false; }
};

// ══════════════════════════════════════════════════
// SMALL REUSABLE COMPONENTS
// ══════════════════════════════════════════════════
const LabeledInput = memo(({ label, value, onChangeText, placeholder, keyboardType, maxLength, autoCapitalize, multiline, numberOfLines }) => (
  <View>
    <Text style={S.lbl}>{label}</Text>
    <TextInput
      style={[S.inp, multiline && { height: 80, textAlignVertical:'top' }]}
      placeholder={placeholder}
      placeholderTextColor={C.muted}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType || 'default'}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize || 'words'}
      multiline={multiline}
      numberOfLines={numberOfLines}
      color={C.text}
    />
  </View>
));

// ══════════════════════════════════════════════════
// WORKER DETAIL MODAL (top level)
// ══════════════════════════════════════════════════
const WorkerDetailModal = memo(({ worker, visible, onClose, bookings, onToggleAvailable, onRemove }) => {
  if (!worker) return null;
  const ws = WORKER_STATUS_COLORS[worker.currentStatus || (worker.isAvailable ? 'idle' : 'offline')];
  const workerJobs = bookings.filter(b => b.assignedWorkerId === worker.id);
  const todayStr = new Date().toDateString();
  const todayJobs = workerJobs.filter(b => {
    const d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt||0);
    return d.toDateString() === todayStr;
  });
  const completedToday = todayJobs.filter(b => b.status === 'completed').length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color:C.orange, fontSize:16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:16 }}>Worker Profile</Text>
          <View style={{ width:60 }}/>
        </View>
        <ScrollView style={{ padding:16 }}>
          {/* Profile Header */}
          <View style={[S.card, { alignItems:'center', marginBottom:16 }]}>
            <View style={{ width:72, height:72, borderRadius:36, backgroundColor:C.orangeBg, alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:C.orange, marginBottom:12 }}>
              <Text style={{ color:C.orange, fontWeight:'900', fontSize:28 }}>{worker.name?.[0]||'?'}</Text>
            </View>
            <Text style={{ color:C.text, fontWeight:'800', fontSize:20 }}>{worker.name}</Text>
            <Text style={{ color:C.muted, fontSize:13, marginTop:4 }}>📞 {worker.phone}</Text>
            {worker.altPhone && <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>Alt: {worker.altPhone}</Text>}
            <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
              <View style={{ paddingHorizontal:12, paddingVertical:4, borderRadius:12, backgroundColor:ws.bg, borderWidth:0.5, borderColor:ws.border }}>
                <Text style={{ color:ws.text, fontWeight:'700', fontSize:12 }}>
                  ● {(worker.currentStatus || (worker.isAvailable?'idle':'offline')).toUpperCase()}
                </Text>
              </View>
              <View style={{ paddingHorizontal:12, paddingVertical:4, borderRadius:12, backgroundColor:C.card2, borderWidth:0.5, borderColor:C.border2 }}>
                <Text style={{ color:C.text2, fontSize:12 }}>{worker.role === 'hub_manager' ? '🏢 Hub Manager' : '🧹 Worker'}</Text>
              </View>
            </View>
          </View>

          {/* Today's Activity */}
          <View style={S.card}>
            <Text style={S.sectionHead}>📊 Today's Activity</Text>
            <View style={{ flexDirection:'row', justifyContent:'space-around', marginTop:12 }}>
              <View style={{ alignItems:'center' }}>
                <Text style={{ color:C.orange, fontWeight:'900', fontSize:24 }}>{worker.tasksToday || completedToday || 0}</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>Tasks Done</Text>
              </View>
              <View style={{ alignItems:'center' }}>
                <Text style={{ color:C.gold, fontWeight:'900', fontSize:20 }}>{fmtTime(worker.loginTime)}</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>Login Time</Text>
              </View>
              <View style={{ alignItems:'center' }}>
                <Text style={{ color:C.blue, fontWeight:'900', fontSize:20 }}>{fmtTime(worker.logoutTime)}</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>Logout Time</Text>
              </View>
            </View>
          </View>

          {/* Location */}
          <View style={[S.card, { marginTop:12 }]}>
            <Text style={S.sectionHead}>📍 Last Known Location</Text>
            {worker.lastLocation ? (
              <View style={{ marginTop:10 }}>
                <Text style={{ color:C.text2, fontSize:13 }}>
                  Lat: {worker.lastLocation.lat?.toFixed(4)}, Lng: {worker.lastLocation.lng?.toFixed(4)}
                </Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:4 }}>
                  Updated: {timeAgo(worker.locationUpdatedAt)}
                </Text>
                {worker.currentArea && (
                  <Text style={{ color:C.orange, fontSize:13, marginTop:4 }}>Area: {worker.currentArea}</Text>
                )}
              </View>
            ) : (
              <Text style={{ color:C.muted, fontSize:13, marginTop:10 }}>Location not available</Text>
            )}
          </View>

          {/* KYC Details */}
          <View style={[S.card, { marginTop:12 }]}>
            <Text style={S.sectionHead}>📋 KYC & Employment Details</Text>
            {[
              ['Aadhar Number', worker.aadharNumber],
              ['PAN Number', worker.panNumber],
              ['PF Number', worker.pfNumber],
              ['Address', worker.fullAddress],
              ['Assigned Area', worker.currentArea],
              ['Join Date', worker.joinedAt ? (worker.joinedAt.toDate ? worker.joinedAt.toDate().toLocaleDateString('en-IN') : worker.joinedAt) : 'N/A'],
            ].map(([label, value]) => value ? (
              <View key={label} style={{ flexDirection:'row', justifyContent:'space-between', marginTop:10, paddingBottom:8, borderBottomWidth:0.3, borderBottomColor:C.border }}>
                <Text style={{ color:C.muted, fontSize:12 }}>{label}</Text>
                <Text style={{ color:C.text2, fontSize:12, flex:1, textAlign:'right', marginLeft:8 }}>{value}</Text>
              </View>
            ) : null)}
          </View>

          {/* Earnings */}
          <View style={[S.card, { marginTop:12 }]}>
            <Text style={S.sectionHead}>💰 Earnings</Text>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:12 }}>
              {[
                { label:'Today', val: fmt(worker.earnings?.today||0), color:C.orange },
                { label:'Week', val: fmt(worker.earnings?.thisWeek||0), color:C.gold },
                { label:'Month', val: fmt(worker.earnings?.thisMonth||0), color:C.green },
                { label:'Total', val: fmt(worker.earnings?.total||0), color:C.blue },
              ].map(item => (
                <View key={item.label} style={{ alignItems:'center' }}>
                  <Text style={{ color:item.color, fontWeight:'800', fontSize:15 }}>{item.val}</Text>
                  <Text style={{ color:C.muted, fontSize:10, marginTop:3 }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Performance */}
          <View style={[S.card, { marginTop:12 }]}>
            <Text style={S.sectionHead}>⭐ Performance</Text>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:12 }}>
              {[
                { label:'Rating', val: worker.ratingAvg || 4.9, color:C.gold },
                { label:'Total Jobs', val: worker.totalJobsCompleted || workerJobs.length, color:C.blue },
                { label:'Score', val: `${worker.performanceScore||85}%`, color:C.green },
              ].map(item => (
                <View key={item.label} style={{ alignItems:'center', flex:1 }}>
                  <Text style={{ color:item.color, fontWeight:'800', fontSize:20 }}>{item.val}</Text>
                  <Text style={{ color:C.muted, fontSize:11, marginTop:3 }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection:'row', gap:10, marginTop:16, marginBottom:40 }}>
            <TouchableOpacity style={[S.btn, { flex:1, backgroundColor: worker.isAvailable ? C.redBg : C.greenBg, borderWidth:1, borderColor: worker.isAvailable ? C.redBd : C.greenBd }]}
              onPress={() => onToggleAvailable(worker)}>
              <Text style={[S.btnT, { color: worker.isAvailable ? C.red : C.green, fontSize:13 }]}>
                {worker.isAvailable ? '⏸ Mark Unavailable' : '▶ Mark Available'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.btn, { flex:1, backgroundColor:C.redBg, borderWidth:1, borderColor:C.redBd }]}
              onPress={() => onRemove(worker)}>
              <Text style={[S.btnT, { color:C.red, fontSize:13 }]}>🗑 Remove</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
});

// ══════════════════════════════════════════════════
// BOOKING DETAIL MODAL (top level)
// ══════════════════════════════════════════════════
const BookingDetailModal = memo(({ selBooking, setSelBooking, employees, onAssign, onUpdateStatus }) => {
  const [assignModal, setAssignModal] = useState(false);
  if (!selBooking) return null;
  const sc = STATUS_COLORS[selBooking.status] || STATUS_COLORS.confirmed;

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
          <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:16 }}>
            <View style={{ paddingHorizontal:14, paddingVertical:6, borderRadius:20, backgroundColor:sc.bg, borderWidth:1, borderColor:sc.border }}>
              <Text style={{ color:sc.text, fontWeight:'700', fontSize:13 }}>{selBooking.status}</Text>
            </View>
            <Text style={{ color:C.muted, fontSize:12 }}>{timeAgo(selBooking.createdAt)}</Text>
          </View>

          <View style={S.detailCard}>
            <Text style={S.detailTitle}>👤 CUSTOMER</Text>
            <Text style={S.detailVal}>{selBooking.userName || 'Unknown'}</Text>
            <Text style={{ color:C.orange, fontSize:14, marginTop:4 }}>📞 +91 {selBooking.userPhone}</Text>
            <Text style={{ color:C.muted, fontSize:13, marginTop:4 }}>📍 {selBooking.addressFull || 'No address'}</Text>
          </View>

          <View style={S.detailCard}>
            <Text style={S.detailTitle}>🛠 SERVICES</Text>
            {(selBooking.items||[]).map((item,i)=>(
              <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
                <Text style={{ color:C.text2, fontSize:13, flex:1 }}>{item.name}</Text>
                <Text style={{ color:C.orange, fontWeight:'700' }}>₹{item.price}</Text>
              </View>
            ))}
          </View>

          <View style={S.detailCard}>
            <Text style={S.detailTitle}>💰 BILL</Text>
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

          <View style={S.detailCard}>
            <Text style={S.detailTitle}>📅 SCHEDULE</Text>
            <Text style={{ color:C.text2, fontSize:14, marginTop:8 }}>{selBooking.slot}</Text>
            <Text style={{ color:C.muted, fontSize:12, marginTop:4 }}>Mode: {selBooking.bookingMode||'instant'}</Text>
            <Text style={{ color:C.gold, fontSize:14, marginTop:8 }}>🔐 OTP: {selBooking.otp}</Text>
          </View>

          {selBooking.professional ? (
            <View style={S.detailCard}>
              <Text style={S.detailTitle}>👩 ASSIGNED PROFESSIONAL</Text>
              <Text style={{ color:C.text, fontSize:15, fontWeight:'600', marginTop:8 }}>{selBooking.professional.name}</Text>
              <Text style={{ color:C.orange }}>📞 +91 {selBooking.professional.phone}</Text>
            </View>
          ) : (
            <TouchableOpacity style={[S.btn, { marginBottom:12 }]}
              onPress={()=>setAssignModal(true)}>
              <Text style={S.btnT}>👩 Assign Professional</Text>
            </TouchableOpacity>
          )}

          <View style={S.detailCard}>
            <Text style={S.detailTitle}>⚡ UPDATE STATUS</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 }}>
              {['confirmed','assigned','on_the_way','in_progress','completed','cancelled'].map(st=>(
                <TouchableOpacity key={st}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:16,
                    backgroundColor: selBooking.status===st ? C.orange : C.card2,
                    borderWidth:1, borderColor: selBooking.status===st ? C.orange : C.border2 }}
                  onPress={()=>onUpdateStatus(selBooking, st)}>
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
            {employees.filter(e=>e.isActive!==false && e.isAvailable).map(pro=>(
              <TouchableOpacity key={pro.id} style={[S.card, { flexDirection:'row', alignItems:'center', marginBottom:10 }]}
                onPress={()=>{ onAssign(selBooking, pro); setAssignModal(false); }}>
                <View style={{ width:44, height:44, borderRadius:22, backgroundColor:C.orangeBg, alignItems:'center', justifyContent:'center', marginRight:14 }}>
                  <Text style={{ color:C.orange, fontWeight:'900', fontSize:18 }}>{pro.name?.[0]||'?'}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ color:C.text, fontWeight:'700' }}>{pro.name}</Text>
                  <Text style={{ color:C.muted, fontSize:12 }}>📍 {pro.currentArea} · ⭐ {pro.ratingAvg||pro.rating||4.9}</Text>
                </View>
                <Text style={{ color:C.orange, fontSize:22 }}>›</Text>
              </TouchableOpacity>
            ))}
            {employees.filter(e=>e.isActive!==false && e.isAvailable).length === 0 && (
              <Text style={{ color:C.muted, textAlign:'center', marginTop:40 }}>No available professionals right now</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
});

// ══════════════════════════════════════════════════
// ADD EMPLOYEE MODAL (top level)
// ══════════════════════════════════════════════════
const AddEmployeeModal = memo(({ visible, onClose, onSave }) => {
  const [empName,    setEmpName]    = useState('');
  const [empPhone,   setEmpPhone]   = useState('');
  const [empAltPhone,setEmpAltPhone]= useState('');
  const [empRole,    setEmpRole]    = useState('worker');
  const [empArea,    setEmpArea]    = useState('Madhurawada');
  const [empAadhar,  setEmpAadhar]  = useState('');
  const [empPan,     setEmpPan]     = useState('');
  const [empPf,      setEmpPf]      = useState('');
  const [empAddress, setEmpAddress] = useState('');
  const [saving,     setSaving]     = useState(false);

  const handleSave = async () => {
    if (!empName.trim() || !empPhone.trim() || empPhone.length < 10) {
      Alert.alert('Required', 'Please fill Full Name and 10-digit Mobile Number');
      return;
    }
    setSaving(true);
    const ok = await onSave({
      name: empName.trim(), phone: empPhone.trim(),
      altPhone: empAltPhone.trim(), role: empRole,
      currentArea: empArea, assignedAreas: [empArea],
      aadharNumber: empAadhar.trim(), panNumber: empPan.trim().toUpperCase(),
      pfNumber: empPf.trim(), fullAddress: empAddress.trim(),
    });
    setSaving(false);
    if (ok) {
      setEmpName(''); setEmpPhone(''); setEmpAltPhone('');
      setEmpRole('worker'); setEmpArea('Madhurawada');
      setEmpAadhar(''); setEmpPan(''); setEmpPf(''); setEmpAddress('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color:C.red, fontSize:15 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:16 }}>Add Employee</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={C.orange} size="small"/> :
              <Text style={{ color:C.orange, fontWeight:'700', fontSize:15 }}>Save</Text>}
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }} keyboardVerticalOffset={0}>
          <ScrollView style={{ padding:16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <Text style={[S.sectionHead, { marginBottom:4 }]}>👤 Personal Details</Text>

            <LabeledInput label="Full Name *" value={empName} onChangeText={setEmpName} placeholder="Lakshmi Devi"/>
            <LabeledInput label="Mobile Number *" value={empPhone} onChangeText={setEmpPhone} placeholder="9876543210" keyboardType="number-pad" maxLength={10} autoCapitalize="none"/>
            <LabeledInput label="Alternate Mobile Number" value={empAltPhone} onChangeText={setEmpAltPhone} placeholder="9876543211 (optional)" keyboardType="number-pad" maxLength={10} autoCapitalize="none"/>
            <LabeledInput label="Full Address" value={empAddress} onChangeText={setEmpAddress} placeholder="Flat no, Street, Landmark, City" multiline numberOfLines={3} autoCapitalize="sentences"/>

            <Text style={[S.sectionHead, { marginTop:8, marginBottom:4 }]}>🪪 KYC Documents</Text>

            <LabeledInput label="Aadhar Card Number" value={empAadhar} onChangeText={setEmpAadhar} placeholder="1234 5678 9012" keyboardType="number-pad" maxLength={14} autoCapitalize="none"/>
            <LabeledInput label="PAN Card Number" value={empPan} onChangeText={setEmpPan} placeholder="ABCDE1234F" maxLength={10} autoCapitalize="characters"/>
            <LabeledInput label="PF Account Number (if any)" value={empPf} onChangeText={setEmpPf} placeholder="TN/CHE/12345/67890 (optional)" autoCapitalize="characters"/>

            <Text style={[S.sectionHead, { marginTop:8, marginBottom:12 }]}>💼 Job Details</Text>

            <Text style={S.lbl}>Role</Text>
            <View style={{ flexDirection:'row', gap:10, marginBottom:16 }}>
              {[['worker','🧹 Worker'],['hub_manager','🏢 Hub Manager']].map(([val,lbl])=>(
                <TouchableOpacity key={val} onPress={()=>setEmpRole(val)}
                  style={{ flex:1, padding:14, borderRadius:14, alignItems:'center',
                    backgroundColor:empRole===val?C.orange:C.card, borderWidth:1,
                    borderColor:empRole===val?C.orange:C.border2 }}>
                  <Text style={{ color:empRole===val?'#FFF':C.text2, fontWeight:'700' }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={S.lbl}>Assigned Area</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:32 }}>
              {['Madhurawada','Rushikonda','MVP Colony','Gajuwaka','Dwaraka Nagar','Bheemunipatnam'].map(a=>(
                <TouchableOpacity key={a} onPress={()=>setEmpArea(a)}
                  style={{ paddingHorizontal:14, paddingVertical:8, borderRadius:20,
                    backgroundColor:empArea===a?C.orange:C.card, borderWidth:1,
                    borderColor:empArea===a?C.orange:C.border2 }}>
                  <Text style={{ color:empArea===a?'#FFF':C.text2, fontSize:12 }}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
});

// ══════════════════════════════════════════════════
// ADD PROMO MODAL (top level)
// ══════════════════════════════════════════════════
const AddPromoModal = memo(({ visible, onClose, onSave }) => {
  const [promoCode,  setPromoCode]  = useState('');
  const [promoType,  setPromoType]  = useState('pct');
  const [promoVal,   setPromoVal]   = useState('');
  const [promoLabel, setPromoLabel] = useState('');
  const [promoMin,   setPromoMin]   = useState('');
  const [saving,     setSaving]     = useState(false);

  const handleSave = async () => {
    if (!promoCode.trim() || !promoVal.trim()) {
      Alert.alert('Required', 'Fill in Promo Code and Discount Value');
      return;
    }
    setSaving(true);
    const ok = await onSave({
      code: promoCode.trim().toUpperCase(),
      type: promoType, val: Number(promoVal),
      label: promoLabel.trim() || promoCode.trim().toUpperCase(),
      minOrder: promoMin ? Number(promoMin) : 0,
      active: true,
    });
    setSaving(false);
    if (ok) {
      setPromoCode(''); setPromoVal(''); setPromoLabel(''); setPromoMin('');
      setPromoType('pct'); onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color:C.red }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700' }}>New Promo Code</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={C.orange} size="small"/> :
              <Text style={{ color:C.orange, fontWeight:'700' }}>Save</Text>}
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
          <ScrollView style={{ padding:16 }} keyboardShouldPersistTaps="handled">
            <LabeledInput label="Promo Code (e.g. DIWALI25)" value={promoCode} onChangeText={setPromoCode} placeholder="DIWALI25" autoCapitalize="characters"/>
            <LabeledInput label="Display Label" value={promoLabel} onChangeText={setPromoLabel} placeholder="25% off for Diwali" autoCapitalize="sentences"/>

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

            <LabeledInput label={`Discount Value (${promoType==='pct'?'% off':'₹ off'})`} value={promoVal} onChangeText={setPromoVal} placeholder={promoType==='pct'?'20':'100'} keyboardType="number-pad" autoCapitalize="none"/>
            <LabeledInput label="Minimum Order Amount (₹) — optional" value={promoMin} onChangeText={setPromoMin} placeholder="0" keyboardType="number-pad" autoCapitalize="none"/>
            <View style={{ height:40 }}/>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
});

// ══════════════════════════════════════════════════
// DASHBOARD TAB (top level)
// ══════════════════════════════════════════════════
const DashboardTab = memo(({ bookings, employees, customers, refreshing, onRefresh, setTab, setSelBooking }) => {
  const todayStr = new Date().toDateString();
  const todayBookings = bookings.filter(b => {
    const d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt||0);
    return d.toDateString() === todayStr;
  });
  const todayRevenue  = todayBookings.reduce((s,b) => s + (b.total||0), 0);
  const pendingCount  = bookings.filter(b => b.status === 'confirmed').length;
  const activeCount   = employees.filter(e => e.isActive!==false && e.isAvailable).length;
  const workingCount  = employees.filter(e => e.currentStatus === 'working').length;
  const totalRevenue  = bookings.reduce((s,b) => s + (b.total||0), 0);
  const hour          = new Date().getHours();

  return (
    <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange}/>}>

      <View style={{ padding:20, paddingTop:8 }}>
        <Text style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>VEGA OPERATIONS · VIZAG</Text>
        <Text style={{ fontSize:26, fontWeight:'900', color:C.text, marginTop:4 }}>
          {hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'} 🪷
        </Text>
        <Text style={{ fontSize:13, color:C.muted }}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</Text>
      </View>

      {/* Urgent Alert */}
      {pendingCount > 0 && (
        <TouchableOpacity style={{ marginHorizontal:16, marginBottom:16, backgroundColor:C.redBg, borderRadius:16, padding:16, flexDirection:'row', alignItems:'center', gap:12, borderWidth:1, borderColor:C.redBd }}
          onPress={()=>setTab('orders')}>
          <Text style={{ fontSize:24 }}>🔴</Text>
          <View style={{ flex:1 }}>
            <Text style={{ color:C.red, fontWeight:'800', fontSize:15 }}>{pendingCount} Unassigned Booking{pendingCount>1?'s':''}!</Text>
            <Text style={{ color:C.text2, fontSize:12, marginTop:2 }}>Tap to assign professionals now</Text>
          </View>
          <Text style={{ color:C.red, fontSize:22 }}>›</Text>
        </TouchableOpacity>
      )}

      {/* Stats Grid */}
      <View style={{ flexDirection:'row', flexWrap:'wrap', paddingHorizontal:12, gap:8, marginBottom:8 }}>
        {[
          { label:"Today's Revenue", val: fmt(todayRevenue), icon:'💰', color:C.gold, onPress:()=>setTab('finance') },
          { label:'Total Revenue',   val: fmt(totalRevenue), icon:'📈', color:C.green, onPress:()=>setTab('finance') },
          { label:"Today's Bookings",val: todayBookings.length, icon:'📦', color:C.blue, onPress:()=>setTab('orders') },
          { label:'Available Staff', val: activeCount, icon:'👥', color:C.orange, onPress:()=>setTab('employees') },
          { label:'Working Now',     val: workingCount, icon:'🧹', color:C.orange2, onPress:()=>setTab('employees') },
          { label:'Total Customers', val: customers.length, icon:'🏠', color:C.purple, onPress:null },
        ].map((stat,i)=>(
          <TouchableOpacity key={i} disabled={!stat.onPress} onPress={stat.onPress}
            style={{ width:(W-40)/2, backgroundColor:C.card, borderRadius:18, padding:16, borderWidth:0.5, borderColor:C.border2, ...SHADOW.card }}>
            <Text style={{ fontSize:28 }}>{stat.icon}</Text>
            <Text style={{ fontSize:26, fontWeight:'900', color:stat.color, marginTop:10 }}>{stat.val}</Text>
            <Text style={{ fontSize:11, color:C.muted, marginTop:4 }}>{stat.label}</Text>
            {stat.onPress && <Text style={{ color:C.muted, fontSize:10, marginTop:4 }}>Tap to view →</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Active Workers Strip */}
      {employees.filter(e => e.currentStatus === 'working').length > 0 && (
        <View style={{ marginHorizontal:16, marginBottom:12 }}>
          <Text style={{ color:C.text2, fontWeight:'700', marginBottom:8, fontSize:13 }}>🧹 Currently Working</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {employees.filter(e => e.currentStatus === 'working').map(w => (
              <View key={w.id} style={{ backgroundColor:C.orangeBg, borderRadius:14, padding:10, marginRight:10, borderWidth:0.5, borderColor:C.orangeBd, alignItems:'center', minWidth:80 }}>
                <Text style={{ color:C.orange, fontWeight:'900', fontSize:18 }}>{w.name?.[0]||'?'}</Text>
                <Text style={{ color:C.text2, fontSize:11, marginTop:4, fontWeight:'600' }}>{w.name?.split(' ')[0]}</Text>
                <Text style={{ color:C.muted, fontSize:10 }}>{w.tasksToday||0} tasks</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recent Bookings */}
      <View style={{ paddingHorizontal:16, marginTop:4 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <Text style={{ fontSize:17, fontWeight:'800', color:C.text }}>Recent Bookings</Text>
          <TouchableOpacity onPress={()=>setTab('orders')}>
            <Text style={{ color:C.orange, fontSize:13 }}>See all →</Text>
          </TouchableOpacity>
        </View>
        {bookings.slice(0,5).map(b => {
          const sc = STATUS_COLORS[b.status] || STATUS_COLORS.confirmed;
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
});

// ══════════════════════════════════════════════════
// ORDERS TAB (top level)
// ══════════════════════════════════════════════════
const OrdersTab = memo(({ bookings, refreshing, onRefresh, setSelBooking }) => {
  const [filter, setFilter] = useState('All');
  const filters = ['All','confirmed','assigned','on_the_way','in_progress','completed','cancelled'];
  const filtered = filter==='All' ? bookings : bookings.filter(b=>b.status===filter);

  return (
    <View style={{ flex:1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ paddingVertical:12, paddingHorizontal:16, maxHeight:56 }}>
        {filters.map(f=>(
          <TouchableOpacity key={f} onPress={()=>setFilter(f)}
            style={{ paddingHorizontal:14, paddingVertical:6, borderRadius:20, marginRight:8,
              backgroundColor: filter===f ? C.orange : C.card,
              borderWidth:1, borderColor: filter===f ? C.orange : C.border2 }}>
            <Text style={{ color: filter===f ? '#FFF' : C.text2, fontWeight:'600', fontSize:13 }}>
              {f} {f!=='All' && filter===f ? `(${filtered.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex:1, paddingHorizontal:16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange}/>}>
        <Text style={{ color:C.muted, fontSize:12, marginBottom:12, marginTop:4 }}>{filtered.length} bookings</Text>
        {filtered.map(b => {
          const sc = STATUS_COLORS[b.status] || STATUS_COLORS.confirmed;
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
                  {b.bookingMode==='recurring' && b.recurFreq && (
                    <View style={{ backgroundColor:C.goldBg, paddingHorizontal:8, paddingVertical:2, borderRadius:8, borderWidth:0.5, borderColor:'#4A3010', alignSelf:'flex-start', marginTop:4 }}>
                      <Text style={{ color:C.gold, fontSize:10, fontWeight:'700' }}>🔄 {b.recurFreq}</Text>
                    </View>
                  )}
                  {b.professional
                    ? <Text style={{ color:C.green, fontSize:12, marginTop:4 }}>👩 {b.professional.name}</Text>
                    : b.status==='confirmed' && <Text style={{ color:C.red, fontSize:12, marginTop:4 }}>⚠️ Needs assignment</Text>
                  }
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
});

// ══════════════════════════════════════════════════
// EMPLOYEES TAB (top level)
// ══════════════════════════════════════════════════
const EmployeesTab = memo(({ employees, bookings, refreshing, onRefresh, onAddEmployee, onToggleAvailable, onRemoveEmployee }) => {
  const [empFilter,  setEmpFilter]  = useState('All');
  const [addModal,   setAddModal]   = useState(false);
  const [selWorker,  setSelWorker]  = useState(null);
  const [detailVis,  setDetailVis]  = useState(false);

  const all    = employees.filter(e => e.isActive !== false);
  const filtered = empFilter==='All'       ? all
    : empFilter==='Working'    ? all.filter(e => e.currentStatus === 'working')
    : empFilter==='Available'  ? all.filter(e => e.isAvailable && e.currentStatus !== 'working')
    : empFilter==='Offline'    ? all.filter(e => !e.isAvailable && e.currentStatus !== 'working')
    : empFilter==='hub_manager'? all.filter(e => e.role === 'hub_manager')
    : all.filter(e => e.role === 'worker');

  const todayStr = new Date().toDateString();

  const handleSaveEmployee = async (empData) => {
    const id = `worker_${empData.phone}`;
    const data = {
      id, ...empData,
      isAvailable: true, isActive: true, status: 'active',
      currentStatus: 'offline',
      ratingAvg: 4.9, totalReviews: 0, totalJobsCompleted: 0,
      performanceScore: 85, salary: 12000, tasksToday: 0,
      joinedAt: firestore.FieldValue.serverTimestamp(),
      createdAt: firestore.FieldValue.serverTimestamp(),
      attendance: { jobsToday:0, jobsWeek:0, daysPresent:0, daysAbsent:0, daysLeave:0 },
      earnings: { today:0, thisWeek:0, thisMonth:0, total:0 },
    };
    const ok1 = await fbSet('workers', id, data);
    await fbSet('professionals', id, data);
    if (ok1) {
      Alert.alert('✅ Added', `${empData.name} added as ${empData.role === 'hub_manager' ? 'Hub Manager' : 'Worker'}`);
      return true;
    }
    Alert.alert('Error', 'Failed to add employee. Please try again.');
    return false;
  };

  const handleToggle = async (emp) => {
    const newVal = !emp.isAvailable;
    await fbUpdate('workers', emp.id, { isAvailable: newVal });
    await fbUpdate('professionals', emp.id, { isAvailable: newVal }).catch(()=>{});
  };

  const handleRemove = (emp) => {
    Alert.alert('Remove Employee', `Remove ${emp.name} from VEGA?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress: async () => {
        setDetailVis(false);
        await fbUpdate('workers', emp.id, { isActive: false, status: 'inactive' });
        await fbUpdate('professionals', emp.id, { isActive: false }).catch(()=>{});
        Alert.alert('Done', `${emp.name} removed`);
      }},
    ]);
  };

  return (
    <View style={{ flex:1 }}>
      {/* Header */}
      <View style={{ padding:16, paddingBottom:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <View>
          <Text style={{ color:C.text, fontWeight:'800', fontSize:17 }}>{all.length} Employees</Text>
          <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>
            {all.filter(e=>e.currentStatus==='working').length} working · {all.filter(e=>e.isAvailable).length} available
          </Text>
        </View>
        <TouchableOpacity style={{ backgroundColor:C.orange, paddingHorizontal:16, paddingVertical:8, borderRadius:20, ...SHADOW.glow }}
          onPress={()=>setAddModal(true)}>
          <Text style={{ color:'#FFF', fontWeight:'700', fontSize:13 }}>+ Add Employee</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal:16, maxHeight:48 }}>
        {['All','Working','Available','Offline','hub_manager','worker'].map(f=>(
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

      {/* Employee List */}
      <ScrollView style={{ flex:1, padding:16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange}/>}>

        {filtered.map(emp => {
          const ws  = WORKER_STATUS_COLORS[emp.currentStatus || (emp.isAvailable?'idle':'offline')];
          const empBookingsToday = bookings.filter(b => {
            const d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt||0);
            return b.assignedWorkerId === emp.id && d.toDateString() === todayStr;
          }).length;

          return (
            <TouchableOpacity key={emp.id} style={[S.card, { marginBottom:10 }]}
              onPress={()=>{ setSelWorker(emp); setDetailVis(true); }}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                {/* Avatar */}
                <View style={{ width:52, height:52, borderRadius:26, backgroundColor:C.orangeBg, alignItems:'center', justifyContent:'center', marginRight:14, borderWidth:1, borderColor:C.orangeBd }}>
                  <Text style={{ color:C.orange, fontWeight:'900', fontSize:22 }}>{emp.name?.[0]||'?'}</Text>
                </View>

                {/* Info */}
                <View style={{ flex:1 }}>
                  <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }}>{emp.name}</Text>
                  <Text style={{ color:C.muted, fontSize:12 }}>📞 {emp.phone}</Text>
                  <View style={{ flexDirection:'row', gap:6, marginTop:5, flexWrap:'wrap' }}>
                    <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:8, backgroundColor:ws.bg, borderWidth:0.5, borderColor:ws.border }}>
                      <Text style={{ color:ws.text, fontSize:10, fontWeight:'700' }}>
                        ● {(emp.currentStatus || (emp.isAvailable?'idle':'offline')).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:8, backgroundColor:C.card2, borderWidth:0.5, borderColor:C.border2 }}>
                      <Text style={{ color:C.text2, fontSize:10 }}>{emp.role==='hub_manager'?'Manager':'Worker'}</Text>
                    </View>
                  </View>
                </View>

                {/* Right side stats */}
                <View style={{ alignItems:'flex-end', gap:4 }}>
                  <Text style={{ color:C.gold, fontSize:12 }}>⭐ {emp.ratingAvg||emp.rating||4.9}</Text>
                  <Text style={{ color:C.muted, fontSize:11 }}>Today: {emp.tasksToday||empBookingsToday} tasks</Text>
                  <Text style={{ color:C.green, fontSize:11 }}>Login: {fmtTime(emp.loginTime)}</Text>
                </View>
              </View>

              {/* Earnings strip */}
              <View style={{ height:1, backgroundColor:C.border, marginVertical:10 }}/>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                {[
                  { label:'Today',  val: fmt(emp.earnings?.today||0)      },
                  { label:'Week',   val: fmt(emp.earnings?.thisWeek||0)   },
                  { label:'Month',  val: fmt(emp.earnings?.thisMonth||0)  },
                  { label:'Total',  val: fmt(emp.earnings?.total||0)      },
                ].map(item=>(
                  <View key={item.label} style={{ alignItems:'center' }}>
                    <Text style={{ color:C.orange, fontWeight:'700', fontSize:13 }}>{item.val}</Text>
                    <Text style={{ color:C.muted, fontSize:10, marginTop:2 }}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color:C.muted, fontSize:10, textAlign:'right', marginTop:6 }}>Tap for full profile →</Text>
            </TouchableOpacity>
          );
        })}

        {filtered.length===0 && (
          <View style={{ alignItems:'center', padding:60 }}>
            <Text style={{ fontSize:48 }}>👥</Text>
            <Text style={{ color:C.muted, marginTop:12, fontSize:15 }}>
              {all.length === 0 ? 'No employees yet' : `No ${empFilter} employees`}
            </Text>
            {all.length === 0 && (
              <TouchableOpacity style={[S.btn, { marginTop:20 }]} onPress={()=>setAddModal(true)}>
                <Text style={S.btnT}>+ Add First Employee</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={{ height:100 }}/>
      </ScrollView>

      {/* Modals */}
      <AddEmployeeModal visible={addModal} onClose={()=>setAddModal(false)} onSave={handleSaveEmployee}/>
      <WorkerDetailModal
        worker={selWorker} visible={detailVis} onClose={()=>setDetailVis(false)}
        bookings={bookings} onToggleAvailable={handleToggle} onRemove={handleRemove}
      />
    </View>
  );
});

// ══════════════════════════════════════════════════
// FINANCE TAB (top level)
// ══════════════════════════════════════════════════
const FinanceTab = memo(({ bookings, refreshing, onRefresh }) => {
  const completed    = bookings.filter(b=>b.status==='completed');
  const totalRevenue = bookings.reduce((s,b)=>s+(b.total||0),0);
  const totalCompleted = completed.reduce((s,b)=>s+(b.total||0),0);
  const totalPromo   = bookings.reduce((s,b)=>s+(b.promoDiscount||0),0);
  const totalWallet  = bookings.reduce((s,b)=>s+(b.walletUsed||0),0);
  const totalFees    = bookings.reduce((s,b)=>s+(b.platformFee||0),0);

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

      <View style={{ flexDirection:'row', gap:10, marginBottom:16 }}>
        <View style={[S.card, { flex:1, alignItems:'center' }]}>
          <Text style={{ fontSize:10, color:C.muted, marginBottom:6, letterSpacing:1 }}>TOTAL REVENUE</Text>
          <Text style={{ fontSize:24, fontWeight:'900', color:C.gold }}>{fmt(totalRevenue)}</Text>
          <Text style={{ fontSize:11, color:C.muted, marginTop:4 }}>{bookings.length} orders</Text>
        </View>
        <View style={[S.card, { flex:1, alignItems:'center' }]}>
          <Text style={{ fontSize:10, color:C.muted, marginBottom:6, letterSpacing:1 }}>COMPLETED</Text>
          <Text style={{ fontSize:24, fontWeight:'900', color:C.green }}>{fmt(totalCompleted)}</Text>
          <Text style={{ fontSize:11, color:C.muted, marginTop:4 }}>{completed.length} jobs</Text>
        </View>
      </View>

      <View style={S.card}>
        <Text style={{ color:C.text2, fontWeight:'700', marginBottom:14 }}>💸 Discounts & Fees</Text>
        {[
          { label:'Promo Discounts Given', val:totalPromo, color:C.red },
          { label:'Wallet Credits Used',   val:totalWallet, color:C.gold },
          { label:'Platform Fees Collected',val:totalFees, color:C.green },
        ].map((item,i)=>(
          <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:10 }}>
            <Text style={{ color:C.muted, fontSize:14 }}>{item.label}</Text>
            <Text style={{ color:item.color, fontWeight:'700', fontSize:15 }}>{fmt(item.val)}</Text>
          </View>
        ))}
      </View>

      <View style={[S.card, { marginTop:12 }]}>
        <Text style={{ color:C.text2, fontWeight:'700', marginBottom:16 }}>📊 Last 7 Days Revenue</Text>
        <View style={{ flexDirection:'row', alignItems:'flex-end', gap:6, height:120 }}>
          {weekData.map((d,i)=>(
            <View key={i} style={{ flex:1, alignItems:'center' }}>
              <Text style={{ color:C.muted, fontSize:9, marginBottom:4 }}>
                {d.revenue>0 ? `₹${d.revenue}` : ''}
              </Text>
              <View style={{
                width:'100%', borderRadius:6,
                height: Math.max(8, (d.revenue/maxRev)*90),
                backgroundColor: i===6 ? C.orange : C.orangeBg,
                borderWidth: i===6 ? 0 : 0.5, borderColor: C.orangeBd,
              }}/>
              <Text style={{ color:C.muted, fontSize:10, marginTop:6 }}>{d.label}</Text>
              <Text style={{ color:C.text2, fontSize:9 }}>{d.count}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[S.card, { marginTop:12 }]}>
        <Text style={{ color:C.text2, fontWeight:'700', marginBottom:14 }}>💳 Payment Methods</Text>
        {['upi','card','netbanking','cash'].map(method=>{
          const count = bookings.filter(b=>b.paymentMethod===method).length;
          const pct   = bookings.length ? Math.round(count/bookings.length*100) : 0;
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
        {bookings.length === 0 && <Text style={{ color:C.muted }}>No payment data yet</Text>}
      </View>
      <View style={{ height:100 }}/>
    </ScrollView>
  );
});

// ══════════════════════════════════════════════════
// OFFERS TAB (top level)
// ══════════════════════════════════════════════════
const OffersTab = memo(({ promos, onTogglePromo, onAddPromo }) => {
  const [addModal, setAddModal] = useState(false);

  const handleSavePromo = async ({ code, type, val, label, minOrder, active }) => {
    await onAddPromo(code, { type, val, label, minOrder, active });
    return true;
  };

  return (
    <ScrollView style={{ flex:1, padding:16 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <Text style={{ fontSize:17, fontWeight:'800', color:C.text }}>Promo Codes</Text>
        <TouchableOpacity style={{ backgroundColor:C.orange, paddingHorizontal:16, paddingVertical:8, borderRadius:20, ...SHADOW.glow }}
          onPress={()=>setAddModal(true)}>
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
            <TouchableOpacity onPress={()=>onTogglePromo(code, promo.active)}
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

      <AddPromoModal visible={addModal} onClose={()=>setAddModal(false)} onSave={handleSavePromo}/>
      <View style={{ height:100 }}/>
    </ScrollView>
  );
});

// ══════════════════════════════════════════════════
// REVIEWS TAB (top level)
// ══════════════════════════════════════════════════
const ReviewsTab = memo(({ bookings }) => {
  const rated    = bookings.filter(b=>b.rated && b.rating);
  const avgRating= rated.length ? (rated.reduce((s,b)=>s+b.rating,0)/rated.length).toFixed(1) : '—';
  const stars    = [5,4,3,2,1];

  return (
    <ScrollView style={{ flex:1, padding:16 }}>
      <View style={[S.card, { flexDirection:'row', alignItems:'center', marginBottom:16 }]}>
        <View style={{ flex:1, alignItems:'center' }}>
          <Text style={{ fontSize:48, fontWeight:'900', color:C.orange }}>{avgRating}</Text>
          <Text style={{ fontSize:20, marginTop:4 }}>{'⭐'.repeat(Math.round(Number(avgRating)||0))}</Text>
          <Text style={{ color:C.muted, fontSize:12, marginTop:4 }}>{rated.length} reviews</Text>
        </View>
        <View style={{ flex:2 }}>
          {stars.map(s=>{
            const count = rated.filter(b=>Math.round(b.rating)===s).length;
            const pct   = rated.length ? count/rated.length*100 : 0;
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
});

// ══════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════
const TABS = [
  { id:'dashboard', icon:'🏠', label:'Home' },
  { id:'orders',    icon:'📦', label:'Orders' },
  { id:'employees', icon:'👥', label:'Team' },
  { id:'finance',   icon:'💰', label:'Finance' },
  { id:'offers',    icon:'🎟️', label:'Offers' },
  { id:'reviews',   icon:'⭐', label:'Reviews' },
];

export default function App() {
  const [screen,     setScreen]    = useState('splash');
  const [tab,        setTab]       = useState('dashboard');
  const [phone,      setPhone]     = useState('');
  const [otpVal,     setOtpVal]    = useState('');
  const [confirm,    setConfirm]   = useState(null);
  const [loading,    setLoading]   = useState(false);
  const [refreshing, setRefreshing]= useState(false);

  // Data
  const [bookings,   setBookings]  = useState([]);
  const [employees,  setEmployees] = useState([]);
  const [customers,  setCustomers] = useState([]);
  const [promos,     setPromos]    = useState({});
  const [selBooking, setSelBooking]= useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue:1, duration:1200, useNativeDriver:true }).start();
    setTimeout(() => setScreen('login'), 2500);
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (screen !== 'main') return;
    const unsubs = [];

    // Bookings (real-time)
    unsubs.push(
      firestore().collection('bookings')
        .orderBy('createdAt','desc').limit(200)
        .onSnapshot(
          snap => setBookings(snap.docs.map(d=>({id:d.id,...d.data()}))),
          err  => console.error('bookings:', err)
        )
    );

    // Workers — no where() to avoid needing composite index
    // filter active on client side
    unsubs.push(
      firestore().collection('workers')
        .orderBy('name','asc').limit(200)
        .onSnapshot(
          snap => {
            const all = snap.docs.map(d=>({id:d.id,...d.data()}));
            setEmployees(all.filter(w => w.status !== 'inactive' && w.isActive !== false));
          },
          err => {
            console.error('workers listener failed, falling back:', err);
            // fallback without orderBy
            firestore().collection('workers').get()
              .then(snap => {
                const all = snap.docs.map(d=>({id:d.id,...d.data()}));
                setEmployees(all.filter(w => w.status !== 'inactive' && w.isActive !== false));
              }).catch(()=>{});
          }
        )
    );

    // Customers
    unsubs.push(
      firestore().collection('users')
        .orderBy('createdAt','desc').limit(200)
        .onSnapshot(
          snap => setCustomers(snap.docs.map(d=>({id:d.id,...d.data()}))),
          err  => console.error('users:', err)
        )
    );

    // Promos (one-time)
    firestore().collection('app_config').doc('promo_codes').get()
      .then(d => d.exists && setPromos(d.data())).catch(()=>{});

    return () => unsubs.forEach(u => u());
  }, [screen]);

  // ── AUTH
  const sendOTP = async () => {
    const clean = phone.replace(/\D/g,'');
    if (clean.length < 10) { Alert.alert('Invalid', 'Enter your 10-digit mobile number'); return; }
    if (!ADMIN_PHONES.includes(clean)) {
      Alert.alert('Access Denied', 'This number is not authorized for VEGA Admin.');
      return;
    }
    setLoading(true);
    try {
      const c = await auth().signInWithPhoneNumber(`+91${clean}`);
      setConfirm(c); setLoading(false); setScreen('otp');
    } catch(e) { setLoading(false); Alert.alert('OTP Failed', e.message); }
  };

  const verifyOTP = async () => {
    if (!otpVal || otpVal.length < 6) return;
    setLoading(true);
    try {
      await confirm.confirm(otpVal);
      setLoading(false); setScreen('main');
      // Save FCM token
      try {
        await messaging().requestPermission();
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
          await firestore().collection('admins').doc(phone).set(
            { fcmToken, fcmUpdatedAt: firestore.FieldValue.serverTimestamp(), phone },
            { merge: true }
          );
        }
      } catch(e) { console.log('FCM:', e.message); }
    } catch(e) { setLoading(false); Alert.alert('Wrong OTP', e.message); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [ws, us] = await Promise.all([
        firestore().collection('workers').orderBy('name','asc').limit(200).get(),
        firestore().collection('users').orderBy('createdAt','desc').limit(200).get(),
      ]);
      const all = ws.docs.map(d=>({id:d.id,...d.data()}));
      setEmployees(all.filter(w => w.status !== 'inactive' && w.isActive !== false));
      setCustomers(us.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e) { console.error('refresh:', e); }
    setRefreshing(false);
  }, []);

  // ── CALLBACKS (stable refs with useCallback)
  const handleAssign = useCallback(async (booking, pro) => {
    const ok = await fbUpdate('bookings', booking.id, {
      professional: { id:pro.id, name:pro.name, phone:pro.phone, rating:pro.ratingAvg||4.9 },
      assignedWorkerId: pro.id, assignedWorkerName: pro.name, assignedWorkerPhone: pro.phone,
      status: 'assigned',
      assignedAt: firestore.FieldValue.serverTimestamp(),
      updatedAt:  firestore.FieldValue.serverTimestamp(),
    });
    if (ok) {
      await fbUpdate('workers', pro.id, { isAvailable:false, currentJobId:booking.id, currentStatus:'working' }).catch(()=>{});
      Alert.alert('✅ Assigned', `${pro.name} assigned to order ${booking.orderId}`);
    }
  }, []);

  const handleUpdateStatus = useCallback(async (booking, status) => {
    await fbUpdate('bookings', booking.id, {
      status,
      [`${status}At`]: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    Alert.alert('Updated', `Order ${booking.orderId} → ${status}`);
    setSelBooking(prev => prev?.id === booking.id ? {...prev, status} : prev);
  }, []);

  const handleTogglePromo = useCallback(async (code, current) => {
    const updated = { ...promos, [code]: { ...promos[code], active: !current } };
    await fbSet('app_config', 'promo_codes', updated);
    setPromos(updated);
  }, [promos]);

  const handleAddPromo = useCallback(async (code, data) => {
    const updated = { ...promos, [code]: data };
    await fbSet('app_config', 'promo_codes', updated);
    setPromos(updated);
  }, [promos]);

  const pendingCount = bookings.filter(b => b.status === 'confirmed').length;

  // ══════════════════════════════════════════════════
  // SCREENS
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

  if (screen === 'login') return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
        <View style={{ flex:1, padding:24, justifyContent:'center' }}>
          <Text style={{ fontSize:32 }}>🪷</Text>
          <Text style={{ fontSize:28, fontWeight:'900', color:C.orange, marginTop:12 }}>Admin Login</Text>
          <Text style={{ fontSize:14, color:C.muted, marginTop:6, marginBottom:40 }}>Authorized personnel only</Text>

          <Text style={S.lbl}>Admin Mobile Number</Text>
          <View style={S.phoneRow}>
            <Text style={S.flag}>🇮🇳 +91</Text>
            <TextInput style={S.phoneInp} placeholder="9441270570" placeholderTextColor={C.muted}
              keyboardType="number-pad" maxLength={10} value={phone} onChangeText={setPhone} color={C.text}/>
          </View>

          <TouchableOpacity style={[S.btn, phone.length<10&&{opacity:0.4}, {marginTop:24}]}
            disabled={phone.length<10||loading} onPress={sendOTP}>
            {loading ? <ActivityIndicator color="#FFF"/> : <Text style={S.btnT}>Send OTP →</Text>}
          </TouchableOpacity>

          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:24 }}>
            <View style={{ width:8, height:8, borderRadius:4, backgroundColor:C.green }}/>
            <Text style={{ color:C.muted, fontSize:12 }}>Secured with Firebase Authentication</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (screen === 'otp') return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
        <View style={{ flex:1, padding:24, justifyContent:'center' }}>
          <TouchableOpacity onPress={()=>setScreen('login')} style={{ marginBottom:32 }}>
            <Text style={{ color:C.orange, fontSize:16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize:24, fontWeight:'900', color:C.text }}>Enter OTP</Text>
          <Text style={{ fontSize:13, color:C.muted, marginTop:6, marginBottom:32 }}>Sent to +91 {phone}</Text>

          <TextInput
            style={[S.inp, { fontSize:32, fontWeight:'900', letterSpacing:16, textAlign:'center', paddingVertical:20 }]}
            placeholder="——————" placeholderTextColor={C.border2}
            keyboardType="number-pad" maxLength={6} value={otpVal} onChangeText={setOtpVal} color={C.text}/>

          <TouchableOpacity style={[S.btn, otpVal.length<6&&{opacity:0.4}, {marginTop:24}]}
            disabled={otpVal.length<6||loading} onPress={verifyOTP}>
            {loading ? <ActivityIndicator color="#FFF"/> : <Text style={S.btnT}>Verify & Enter Admin →</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ── MAIN
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
            {pendingCount > 0 && (
              <View style={{ backgroundColor:C.red, width:22, height:22, borderRadius:11, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:'#FFF', fontSize:11, fontWeight:'900' }}>{pendingCount}</Text>
              </View>
            )}
            <TouchableOpacity onPress={()=>Alert.alert('Logout','Sign out of VEGA Admin?',[
              {text:'Cancel',style:'cancel'},
              {text:'Logout',style:'destructive',onPress:()=>{
                auth().signOut().catch(()=>{});
                setScreen('login'); setTab('dashboard');
                setBookings([]); setEmployees([]); setCustomers([]);
              }},
            ])}>
              <Text style={{ color:C.muted, fontSize:13 }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View style={{ flex:1 }}>
          {tab==='dashboard' && (
            <DashboardTab
              bookings={bookings} employees={employees} customers={customers}
              refreshing={refreshing} onRefresh={onRefresh}
              setTab={setTab} setSelBooking={setSelBooking}
            />
          )}
          {tab==='orders' && (
            <OrdersTab
              bookings={bookings} refreshing={refreshing}
              onRefresh={onRefresh} setSelBooking={setSelBooking}
            />
          )}
          {tab==='employees' && (
            <EmployeesTab
              employees={employees} bookings={bookings}
              refreshing={refreshing} onRefresh={onRefresh}
              onAddEmployee={null}
              onToggleAvailable={null}
              onRemoveEmployee={null}
            />
          )}
          {tab==='finance' && (
            <FinanceTab bookings={bookings} refreshing={refreshing} onRefresh={onRefresh}/>
          )}
          {tab==='offers' && (
            <OffersTab promos={promos} onTogglePromo={handleTogglePromo} onAddPromo={handleAddPromo}/>
          )}
          {tab==='reviews' && (
            <ReviewsTab bookings={bookings}/>
          )}
        </View>

        {/* Tab Bar */}
        <View style={{ flexDirection:'row', borderTopWidth:0.5, borderTopColor:C.border, backgroundColor:C.card, paddingBottom:Platform.OS==='ios'?16:8, paddingTop:8 }}>
          {TABS.map(t=>(
            <TouchableOpacity key={t.id} style={{ flex:1, alignItems:'center', gap:3 }} onPress={()=>setTab(t.id)}>
              <Text style={{ fontSize: tab===t.id ? 24 : 20 }}>{t.icon}</Text>
              <Text style={{ fontSize:9, fontWeight:tab===t.id?'800':'500', color:tab===t.id?C.orange:C.muted }}>
                {t.label}
              </Text>
              {t.id==='orders' && pendingCount>0 && (
                <View style={{ position:'absolute', top:-2, right:8, width:12, height:12, borderRadius:6, backgroundColor:C.red }}/>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* Booking Detail Modal (always rendered at root level) */}
      <BookingDetailModal
        selBooking={selBooking} setSelBooking={setSelBooking}
        employees={employees} onAssign={handleAssign} onUpdateStatus={handleUpdateStatus}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════
const S = StyleSheet.create({
  lbl:        { color:'#886858', fontSize:12, fontWeight:'600', marginBottom:8, marginTop:16 },
  inp:        { backgroundColor:'#1A100A', borderWidth:0.5, borderColor:'#3A2010', borderRadius:14, padding:14, fontSize:15, color:'#F5EDE8' },
  phoneRow:   { flexDirection:'row', backgroundColor:'#1A100A', borderWidth:0.5, borderColor:'#3A2010', borderRadius:14, overflow:'hidden' },
  flag:       { padding:14, fontSize:13, fontWeight:'700', color:'#F5EDE8', backgroundColor:'#231408', borderRightWidth:0.5, borderRightColor:'#3A2010' },
  phoneInp:   { flex:1, padding:14, fontSize:15, letterSpacing:2 },
  btn:        { backgroundColor:'#E8520A', borderRadius:30, padding:16, alignItems:'center', shadowColor:'#E8520A', shadowOffset:{width:0,height:0}, shadowOpacity:0.5, shadowRadius:12, elevation:6 },
  btnT:       { color:'#FFF', fontSize:15, fontWeight:'800' },
  card:       { backgroundColor:'#1A100A', borderRadius:18, padding:16, borderWidth:0.5, borderColor:'#3A2010', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.4, shadowRadius:8, elevation:4 },
  detailCard: { backgroundColor:'#1A100A', borderRadius:18, padding:16, borderWidth:0.5, borderColor:'#3A2010', marginBottom:12 },
  detailTitle:{ color:'#886858', fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:4 },
  detailVal:  { color:'#F5EDE8', fontSize:16, fontWeight:'700' },
  sectionHead:{ color:'#C8A898', fontSize:13, fontWeight:'800', letterSpacing:0.5, marginTop:8 },
});
