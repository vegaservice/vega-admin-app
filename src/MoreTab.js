// ██ MORE TAB — Services, Customers, Finance, Offers, Reviews, Notifications
// This single tab contains all secondary screens accessible from a menu

import React, { useState, useCallback, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, SafeAreaView, ActivityIndicator,
  Platform, KeyboardAvoidingView, RefreshControl, Dimensions,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';

const { width: W } = Dimensions.get('window');

const C = {
  bg:'#0F0A06', card:'#1A100A', card2:'#231408',
  orange:'#E8520A', orangeBg:'#2A1408', orangeBd:'#4A2010',
  orange2:'#FF6B2B',
  gold:'#D4901A', goldBg:'#2A1E08',
  green:'#22C55E', greenBg:'#0A2010', greenBd:'#1A4020',
  red:'#EF4444', redBg:'#2A0808', redBd:'#4A1010',
  blue:'#3B82F6', blueBg:'#08102A',
  purple:'#A855F7', purpleBg:'#18082A',
  text:'#F5EDE8', text2:'#C8A898', muted:'#886858',
  border:'#2A1808', border2:'#3A2010',
};

const SHADOW = {
  card:{ shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.4,shadowRadius:8,elevation:4 },
  glow:{ shadowColor:C.orange,shadowOffset:{width:0,height:0},shadowOpacity:0.5,shadowRadius:12,elevation:6 },
};

const fmt=(n)=>n>=100000?`₹${(n/100000).toFixed(1)}L`:n>=1000?`₹${(n/1000).toFixed(1)}K`:`₹${n||0}`;
const timeAgo=(ts)=>{
  if(!ts) return '';
  const d=ts.toDate?ts.toDate():new Date(ts);
  const diff=Math.floor((Date.now()-d.getTime())/1000);
  if(diff<60) return `${diff}s ago`;
  if(diff<3600) return `${Math.floor(diff/60)}m ago`;
  if(diff<86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString('en-IN');
};

const fbSet=async(col,id,data)=>{
  try{await firestore().collection(col).doc(id).set(data);return true;}
  catch(e){console.error('fbSet',e);return false;}
};
const fbUpdate=async(col,id,data)=>{
  try{await firestore().collection(col).doc(id).update(data);return true;}
  catch(e){console.error('fbUpdate',e);return false;}
};
const fbDelete=async(col,id)=>{
  try{await firestore().collection(col).doc(id).delete();return true;}
  catch(e){console.error('fbDelete',e);return false;}
};

// ════════════════════════════════════════════════════
// SERVICES SCREEN
// ════════════════════════════════════════════════════
const CATEGORIES = ['Home Cleaning','Kitchen','Bathroom','Deep Clean','Office','Facility Management','Other'];

const ServiceEditModal = memo(({ service, visible, onClose, onSave }) => {
  const editing = !!service?.id;
  const [name,     setName]     = useState(service?.name || '');
  const [price,    setPrice]    = useState(String(service?.price || ''));
  const [duration, setDuration] = useState(String(service?.duration || '60'));
  const [category, setCategory] = useState(service?.category || CATEGORIES[0]);
  const [desc,     setDesc]     = useState(service?.description || '');
  const [icon,     setIcon]     = useState(service?.icon || '🧹');
  const [active,   setActive]   = useState(service?.active !== false);
  const [saving,   setSaving]   = useState(false);

  React.useEffect(() => {
    if (visible && service) {
      setName(service.name || '');
      setPrice(String(service.price || ''));
      setDuration(String(service.duration || '60'));
      setCategory(service.category || CATEGORIES[0]);
      setDesc(service.description || '');
      setIcon(service.icon || '🧹');
      setActive(service.active !== false);
    } else if (visible && !service) {
      setName(''); setPrice(''); setDuration('60');
      setCategory(CATEGORIES[0]); setDesc(''); setIcon('🧹'); setActive(true);
    }
  }, [visible, service]);

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Required', 'Service name and price are required');
      return;
    }
    setSaving(true);
    await onSave({
      id: service?.id || `svc_${Date.now()}`,
      name: name.trim(), price: Number(price),
      duration: Number(duration) || 60, category,
      description: desc.trim(), icon, active,
      updatedAt: firestore.FieldValue.serverTimestamp(),
      createdAt: service?.createdAt || firestore.FieldValue.serverTimestamp(),
    });
    setSaving(false);
    onClose();
  };

  const ICONS = ['🧹','🚿','🍳','🏠','🏢','🛁','🪣','🧺','🪴','🔧','⚡','🚰'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color:C.red }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700' }}>{editing ? 'Edit Service' : 'New Service'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={C.orange} size="small"/> :
              <Text style={{ color:C.orange, fontWeight:'700' }}>Save</Text>}
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
          <ScrollView style={{ padding:16 }} keyboardShouldPersistTaps="handled">
            <Text style={S.lbl}>Service Name *</Text>
            <TextInput style={S.inp} value={name} onChangeText={setName}
              placeholder="e.g. Home Deep Cleaning" placeholderTextColor={C.muted} color={C.text}/>

            <Text style={S.lbl}>Pick Icon</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {ICONS.map(ic=>(
                <TouchableOpacity key={ic} onPress={()=>setIcon(ic)}
                  style={{ width:44, height:44, borderRadius:12, alignItems:'center', justifyContent:'center',
                    backgroundColor:icon===ic?C.orangeBg:C.card, borderWidth:1,
                    borderColor:icon===ic?C.orange:C.border2 }}>
                  <Text style={{ fontSize:22 }}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection:'row', gap:12 }}>
              <View style={{ flex:1 }}>
                <Text style={S.lbl}>Price (₹) *</Text>
                <TextInput style={S.inp} value={price} onChangeText={setPrice}
                  placeholder="499" placeholderTextColor={C.muted} keyboardType="number-pad" color={C.text}/>
              </View>
              <View style={{ flex:1 }}>
                <Text style={S.lbl}>Duration (min)</Text>
                <TextInput style={S.inp} value={duration} onChangeText={setDuration}
                  placeholder="60" placeholderTextColor={C.muted} keyboardType="number-pad" color={C.text}/>
              </View>
            </View>

            <Text style={S.lbl}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
              {CATEGORIES.map(cat=>(
                <TouchableOpacity key={cat} onPress={()=>setCategory(cat)}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:20, marginRight:8,
                    backgroundColor:category===cat?C.orange:C.card, borderWidth:1,
                    borderColor:category===cat?C.orange:C.border2 }}>
                  <Text style={{ color:category===cat?'#FFF':C.text2, fontSize:12 }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={S.lbl}>Description</Text>
            <TextInput style={[S.inp,{ height:80, textAlignVertical:'top' }]}
              value={desc} onChangeText={setDesc} multiline
              placeholder="What's included in this service..." placeholderTextColor={C.muted} color={C.text}/>

            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:16, padding:16, backgroundColor:C.card, borderRadius:14, borderWidth:0.5, borderColor:C.border2 }}>
              <Text style={{ color:C.text, fontWeight:'600' }}>Service Active (visible to customers)</Text>
              <TouchableOpacity onPress={()=>setActive(!active)}
                style={{ width:48, height:28, borderRadius:14, backgroundColor:active?C.orange:C.card2,
                  justifyContent:'center', paddingHorizontal:3, borderWidth:1, borderColor:active?C.orange:C.border2 }}>
                <View style={{ width:22, height:22, borderRadius:11, backgroundColor:'#FFF',
                  alignSelf: active ? 'flex-end' : 'flex-start' }}/>
              </TouchableOpacity>
            </View>
            <View style={{ height:40 }}/>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
});

const ServicesScreen = memo(({ onBack }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editSvc,  setEditSvc]  = useState(null);
  const [showModal,setShowModal]= useState(false);

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await firestore().collection('services').orderBy('price','asc').get();
      setServices(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e) {
      // Try app_config fallback
      try {
        const doc = await firestore().collection('app_config').doc('services').get();
        if (doc.exists) {
          const data = doc.data();
          setServices(Object.entries(data).map(([id,v])=>({id,...v})));
        }
      } catch(e2) {}
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { loadServices(); }, []);

  const handleSave = async (data) => {
    await firestore().collection('services').doc(data.id).set(data);
    await loadServices();
  };

  const handleDelete = (svc) => {
    Alert.alert('Delete Service', `Delete "${svc.name}"?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        await fbDelete('services', svc.id);
        await loadServices();
      }},
    ]);
  };

  const handleToggle = async (svc) => {
    await fbUpdate('services', svc.id, { active: !svc.active });
    setServices(prev => prev.map(s => s.id===svc.id ? {...s,active:!s.active} : s));
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
        padding:16, borderBottomWidth:0.5, borderBottomColor:C.border }}>
        <TouchableOpacity onPress={onBack} style={{ padding:4 }}>
          <Text style={{ color:C.orange, fontSize:16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'800', fontSize:16 }}>Services & Pricing</Text>
        <TouchableOpacity style={{ backgroundColor:C.orange, paddingHorizontal:12, paddingVertical:6, borderRadius:16 }}
          onPress={()=>{ setEditSvc(null); setShowModal(true); }}>
          <Text style={{ color:'#FFF', fontWeight:'700', fontSize:12 }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={C.orange} size="large"/>
        </View>
      ) : (
        <ScrollView style={{ padding:16 }}>
          {services.length === 0 && (
            <View style={{ alignItems:'center', padding:60 }}>
              <Text style={{ fontSize:48 }}>🛠️</Text>
              <Text style={{ color:C.muted, marginTop:12 }}>No services yet</Text>
              <TouchableOpacity style={[S.btn,{marginTop:20}]} onPress={()=>{setEditSvc(null);setShowModal(true);}}>
                <Text style={S.btnT}>+ Add First Service</Text>
              </TouchableOpacity>
            </View>
          )}
          {services.map(svc=>(
            <View key={svc.id} style={[S.card,{marginBottom:10}]}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <View style={{ width:52, height:52, borderRadius:14, backgroundColor:C.orangeBg,
                  alignItems:'center', justifyContent:'center', marginRight:14, borderWidth:0.5, borderColor:C.orangeBd }}>
                  <Text style={{ fontSize:26 }}>{svc.icon||'🧹'}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }}>{svc.name}</Text>
                    <View style={{ paddingHorizontal:6, paddingVertical:2, borderRadius:8,
                      backgroundColor:svc.active?C.greenBg:C.redBg, borderWidth:0.5,
                      borderColor:svc.active?C.greenBd:C.redBd }}>
                      <Text style={{ color:svc.active?C.green:C.red, fontSize:9, fontWeight:'700' }}>
                        {svc.active?'ACTIVE':'OFF'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color:C.orange, fontWeight:'900', fontSize:17, marginTop:3 }}>₹{svc.price}</Text>
                  <Text style={{ color:C.muted, fontSize:11 }}>{svc.category} · {svc.duration||60} min</Text>
                </View>
                <View style={{ gap:8 }}>
                  <TouchableOpacity onPress={()=>{setEditSvc(svc);setShowModal(true);}}
                    style={{ backgroundColor:C.card2, paddingHorizontal:10, paddingVertical:5, borderRadius:10, borderWidth:0.5, borderColor:C.border2 }}>
                    <Text style={{ color:C.text2, fontSize:11 }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>handleToggle(svc)}
                    style={{ backgroundColor:svc.active?C.redBg:C.greenBg, paddingHorizontal:10, paddingVertical:5, borderRadius:10, borderWidth:0.5, borderColor:svc.active?C.redBd:C.greenBd }}>
                    <Text style={{ color:svc.active?C.red:C.green, fontSize:11 }}>
                      {svc.active?'Disable':'Enable'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {svc.description && (
                <Text style={{ color:C.muted, fontSize:12, marginTop:10, paddingTop:10, borderTopWidth:0.5, borderTopColor:C.border }}>
                  {svc.description}
                </Text>
              )}
            </View>
          ))}
          <View style={{ height:100 }}/>
        </ScrollView>
      )}

      <ServiceEditModal
        service={editSvc} visible={showModal}
        onClose={()=>{setShowModal(false);setEditSvc(null);}}
        onSave={handleSave}
      />
    </View>
  );
});

// ════════════════════════════════════════════════════
// CUSTOMERS SCREEN
// ════════════════════════════════════════════════════
const CustomerDetailModal = memo(({ customer, visible, onClose, bookings }) => {
  if (!customer) return null;
  const myBookings = bookings.filter(b => b.userId === customer.id || b.userPhone === customer.phone);
  const totalSpent = myBookings.reduce((s,b)=>s+(b.total||0),0);
  const completed  = myBookings.filter(b=>b.status==='completed').length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', padding:16, borderBottomWidth:1, borderBottomColor:C.border }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color:C.orange, fontSize:16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700' }}>Customer Profile</Text>
          <View style={{ width:60 }}/>
        </View>
        <ScrollView style={{ padding:16 }}>
          {/* Header */}
          <View style={[S.card,{alignItems:'center',marginBottom:16}]}>
            <View style={{ width:64,height:64,borderRadius:32,backgroundColor:C.blueBg,
              alignItems:'center',justifyContent:'center',marginBottom:12,borderWidth:1,borderColor:C.blue }}>
              <Text style={{ color:C.blue,fontWeight:'900',fontSize:26 }}>{(customer.name||customer.displayName||'U')[0].toUpperCase()}</Text>
            </View>
            <Text style={{ color:C.text, fontWeight:'800', fontSize:19 }}>{customer.name||customer.displayName||'Customer'}</Text>
            <Text style={{ color:C.muted, fontSize:13, marginTop:4 }}>📞 {customer.phone||customer.phoneNumber}</Text>
            {customer.email && <Text style={{ color:C.muted, fontSize:12 }}>✉️ {customer.email}</Text>}
            <Text style={{ color:C.muted, fontSize:11, marginTop:6 }}>Member since {customer.createdAt?.toDate
              ? customer.createdAt.toDate().toLocaleDateString('en-IN',{month:'short',year:'numeric'})
              : 'N/A'}</Text>
          </View>

          {/* Stats */}
          <View style={{ flexDirection:'row', gap:10, marginBottom:16 }}>
            {[
              { label:'Total Bookings', val:myBookings.length, color:C.blue },
              { label:'Completed',      val:completed,         color:C.green },
              { label:'Total Spent',    val:fmt(totalSpent),   color:C.gold },
              { label:'Wallet',         val:fmt(customer.walletBalance||0), color:C.purple },
            ].map(item=>(
              <View key={item.label} style={[S.card,{flex:1,alignItems:'center',padding:12}]}>
                <Text style={{ color:item.color, fontWeight:'900', fontSize:17 }}>{item.val}</Text>
                <Text style={{ color:C.muted, fontSize:9, marginTop:3, textAlign:'center' }}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Booking History */}
          <Text style={{ color:C.text2, fontWeight:'700', marginBottom:10, fontSize:14 }}>Booking History</Text>
          {myBookings.length === 0 && <Text style={{ color:C.muted }}>No bookings yet</Text>}
          {myBookings.map(b=>(
            <View key={b.id} style={[S.card,{marginBottom:8,flexDirection:'row',alignItems:'center'}]}>
              <View style={{ flex:1 }}>
                <Text style={{ color:C.orange, fontWeight:'700', fontSize:13 }}>{b.orderId}</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{b.slot} · {timeAgo(b.createdAt)}</Text>
                {b.professional && <Text style={{ color:C.green, fontSize:11 }}>👩 {b.professional.name}</Text>}
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ color:C.orange, fontWeight:'800' }}>₹{b.total}</Text>
                <Text style={{ color:C.muted, fontSize:11 }}>{b.status}</Text>
              </View>
            </View>
          ))}
          <View style={{ height:40 }}/>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
});

const CustomersScreen = memo(({ bookings, onBack }) => {
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [selCustomer,setSelCustomer]= useState(null);
  const [detailVis,  setDetailVis]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await firestore().collection('users').orderBy('createdAt','desc').limit(200).get();
      setCustomers(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  };

  const filtered = search.trim()
    ? customers.filter(c =>
        (c.name||c.displayName||'').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone||c.phoneNumber||'').includes(search)
      )
    : customers;

  const handleBlock = (customer) => {
    Alert.alert('Block Customer', `Block ${customer.name||'this customer'}? They won't be able to place orders.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Block', style:'destructive', onPress: async () => {
        await fbUpdate('users', customer.id, { isBlocked: true });
        setCustomers(prev => prev.map(c=>c.id===customer.id?{...c,isBlocked:true}:c));
      }},
    ]);
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
        padding:16, borderBottomWidth:0.5, borderBottomColor:C.border }}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color:C.orange, fontSize:16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'800', fontSize:16 }}>Customers</Text>
        <Text style={{ color:C.muted, fontSize:12 }}>{customers.length}</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal:16, paddingVertical:10 }}>
        <TextInput style={[S.inp,{paddingVertical:10}]}
          placeholder="Search by name or phone..." placeholderTextColor={C.muted}
          value={search} onChangeText={setSearch} color={C.text}/>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={C.orange} size="large"/>
        </View>
      ) : (
        <ScrollView style={{ flex:1, paddingHorizontal:16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange}/>}>
          {filtered.map(c=>{
            const myBookings = bookings.filter(b=>b.userId===c.id||b.userPhone===(c.phone||c.phoneNumber));
            const totalSpent = myBookings.reduce((s,b)=>s+(b.total||0),0);
            return (
              <TouchableOpacity key={c.id} style={[S.card,{marginBottom:10,flexDirection:'row',alignItems:'center'}]}
                onPress={()=>{setSelCustomer(c);setDetailVis(true);}}>
                <View style={{ width:44,height:44,borderRadius:22,backgroundColor:C.blueBg,
                  alignItems:'center',justifyContent:'center',marginRight:12,borderWidth:0.5,borderColor:C.blue }}>
                  <Text style={{ color:C.blue,fontWeight:'900',fontSize:18 }}>
                    {(c.name||c.displayName||'U')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{c.name||c.displayName||'Customer'}</Text>
                  <Text style={{ color:C.muted, fontSize:12 }}>📞 {c.phone||c.phoneNumber}</Text>
                  <Text style={{ color:C.muted, fontSize:11 }}>
                    {myBookings.length} bookings · {fmt(totalSpent)} spent
                  </Text>
                </View>
                <View style={{ alignItems:'flex-end', gap:4 }}>
                  {c.isBlocked && (
                    <View style={{ backgroundColor:C.redBg, paddingHorizontal:6, paddingVertical:2, borderRadius:8, borderWidth:0.5, borderColor:C.redBd }}>
                      <Text style={{ color:C.red, fontSize:9, fontWeight:'700' }}>BLOCKED</Text>
                    </View>
                  )}
                  {c.walletBalance > 0 && (
                    <Text style={{ color:C.gold, fontSize:11 }}>💰 {fmt(c.walletBalance)}</Text>
                  )}
                  <Text style={{ color:C.muted, fontSize:11 }}>{timeAgo(c.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {filtered.length === 0 && (
            <View style={{ alignItems:'center', padding:60 }}>
              <Text style={{ fontSize:48 }}>👤</Text>
              <Text style={{ color:C.muted, marginTop:12 }}>
                {search ? 'No customers found' : 'No customers yet'}
              </Text>
            </View>
          )}
          <View style={{ height:100 }}/>
        </ScrollView>
      )}

      <CustomerDetailModal
        customer={selCustomer} visible={detailVis}
        onClose={()=>setDetailVis(false)} bookings={bookings}
      />
    </View>
  );
});

// ════════════════════════════════════════════════════
// NOTIFICATIONS SCREEN
// ════════════════════════════════════════════════════
const NotificationsScreen = memo(({ onBack, employees, customers }) => {
  const [audience,  setAudience]  = useState('customers');
  const [title,     setTitle]     = useState('');
  const [body,      setBody]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [history,   setHistory]   = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  React.useEffect(() => {
    firestore().collection('admin_notifications')
      .orderBy('sentAt','desc').limit(30).get()
      .then(snap => {
        setHistory(snap.docs.map(d=>({id:d.id,...d.data()})));
        setLoadingHistory(false);
      }).catch(()=>setLoadingHistory(false));
  }, []);

  const sendBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Required', 'Enter both title and message');
      return;
    }
    Alert.alert(
      'Send Notification',
      `Send "${title}" to all ${audience === 'customers' ? 'customers' : audience === 'workers' ? 'workers' : 'everyone'}?`,
      [
        { text:'Cancel', style:'cancel' },
        { text:'Send Now', onPress: async () => {
          setSending(true);
          try {
            // Store notification record in Firestore
            // Cloud Functions (or your backend) will pick this up and fan out FCM messages
            const notifDoc = {
              title: title.trim(),
              body: body.trim(),
              audience,
              sentAt: firestore.FieldValue.serverTimestamp(),
              status: 'pending',
              sentBy: 'admin',
            };
            await firestore().collection('admin_notifications').add(notifDoc);
            // Also write to push_queue so Cloud Function triggers
            await firestore().collection('push_queue').add({
              ...notifDoc, type: 'broadcast',
              processAt: firestore.FieldValue.serverTimestamp(),
            });
            Alert.alert('✅ Queued!', 'Notification queued for delivery. Cloud Functions will send it to all devices.');
            setTitle(''); setBody('');
            // Refresh history
            const snap = await firestore().collection('admin_notifications').orderBy('sentAt','desc').limit(30).get();
            setHistory(snap.docs.map(d=>({id:d.id,...d.data()})));
          } catch(e) {
            Alert.alert('Error', 'Failed to send: ' + e.message);
          }
          setSending(false);
        }},
      ]
    );
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
        padding:16, borderBottomWidth:0.5, borderBottomColor:C.border }}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color:C.orange, fontSize:16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'800', fontSize:16 }}>Send Notifications</Text>
        <View style={{ width:60 }}/>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
        <ScrollView style={{ padding:16 }} keyboardShouldPersistTaps="handled">

          {/* Compose */}
          <View style={[S.card,{marginBottom:20}]}>
            <Text style={{ color:C.text, fontWeight:'800', fontSize:15, marginBottom:16 }}>📣 Broadcast Message</Text>

            <Text style={S.lbl}>Send to</Text>
            <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
              {[['customers','👤 Customers'],['workers','👷 Workers'],['all','🌐 Everyone']].map(([val,lbl])=>(
                <TouchableOpacity key={val} onPress={()=>setAudience(val)}
                  style={{ flex:1, padding:10, borderRadius:12, alignItems:'center',
                    backgroundColor:audience===val?C.orange:C.card2, borderWidth:1,
                    borderColor:audience===val?C.orange:C.border2 }}>
                  <Text style={{ color:audience===val?'#FFF':C.text2, fontWeight:'700', fontSize:11 }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={S.lbl}>Notification Title</Text>
            <TextInput style={S.inp} placeholder="e.g. 🎉 Diwali Special Offer!" placeholderTextColor={C.muted}
              value={title} onChangeText={setTitle} color={C.text}/>

            <Text style={S.lbl}>Message</Text>
            <TextInput style={[S.inp,{height:80,textAlignVertical:'top'}]}
              placeholder="Write your message here..." placeholderTextColor={C.muted}
              value={body} onChangeText={setBody} multiline color={C.text}/>

            <TouchableOpacity style={[S.btn,{marginTop:16}]} onPress={sendBroadcast} disabled={sending}>
              {sending ? <ActivityIndicator color="#FFF"/> :
                <Text style={S.btnT}>📨 Send Notification</Text>}
            </TouchableOpacity>

            <Text style={{ color:C.muted, fontSize:11, textAlign:'center', marginTop:10 }}>
              Notifications will reach all active app users via Firebase Cloud Messaging
            </Text>
          </View>

          {/* History */}
          <Text style={{ color:C.text2, fontWeight:'700', marginBottom:12, fontSize:14 }}>📋 Sent History</Text>
          {loadingHistory ? <ActivityIndicator color={C.orange}/> : (
            history.length === 0 ? (
              <Text style={{ color:C.muted }}>No notifications sent yet</Text>
            ) : (
              history.map(n => (
                <View key={n.id} style={[S.card,{marginBottom:8}]}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <View style={{ flex:1 }}>
                      <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{n.title}</Text>
                      <Text style={{ color:C.text2, fontSize:12, marginTop:3 }}>{n.body}</Text>
                      <Text style={{ color:C.muted, fontSize:11, marginTop:6 }}>
                        To: {n.audience} · {timeAgo(n.sentAt)}
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal:8, paddingVertical:3, borderRadius:10,
                      backgroundColor:n.status==='sent'?C.greenBg:C.orangeBg, borderWidth:0.5,
                      borderColor:n.status==='sent'?C.greenBd:C.orangeBd }}>
                      <Text style={{ color:n.status==='sent'?C.green:C.orange, fontSize:10, fontWeight:'700' }}>
                        {n.status||'queued'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )
          )}
          <View style={{ height:100 }}/>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
});

// ════════════════════════════════════════════════════
// FINANCE SCREEN (same as before but as a proper screen)
// ════════════════════════════════════════════════════
const FinanceScreen = memo(({ bookings, onBack }) => {
  const completed    = bookings.filter(b=>b.status==='completed');
  const totalRevenue = bookings.reduce((s,b)=>s+(b.total||0),0);
  const totalCompleted = completed.reduce((s,b)=>s+(b.total||0),0);
  const totalPromo   = bookings.reduce((s,b)=>s+(b.promoDiscount||0),0);
  const totalWallet  = bookings.reduce((s,b)=>s+(b.walletUsed||0),0);

  const weekData = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    const dayStr=d.toDateString();
    const dayBookings=bookings.filter(b=>{
      const bd=b.createdAt?.toDate?b.createdAt.toDate():new Date(b.createdAt||0);
      return bd.toDateString()===dayStr;
    });
    return{
      label:i===0?'Today':['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
      revenue:dayBookings.reduce((s,b)=>s+(b.total||0),0),
      count:dayBookings.length,
    };
  }).reverse();
  const maxRev=Math.max(...weekData.map(d=>d.revenue),1);

  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
        padding:16,borderBottomWidth:0.5,borderBottomColor:C.border}}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{color:C.orange,fontSize:16}}>← Back</Text>
        </TouchableOpacity>
        <Text style={{color:C.text,fontWeight:'800',fontSize:16}}>Finance</Text>
        <View style={{width:60}}/>
      </View>
      <ScrollView style={{padding:16}}>
        <View style={{flexDirection:'row',gap:10,marginBottom:16}}>
          <View style={[S.card,{flex:1,alignItems:'center'}]}>
            <Text style={{fontSize:10,color:C.muted,marginBottom:6,letterSpacing:1}}>TOTAL REVENUE</Text>
            <Text style={{fontSize:24,fontWeight:'900',color:C.gold}}>{fmt(totalRevenue)}</Text>
            <Text style={{fontSize:11,color:C.muted,marginTop:4}}>{bookings.length} orders</Text>
          </View>
          <View style={[S.card,{flex:1,alignItems:'center'}]}>
            <Text style={{fontSize:10,color:C.muted,marginBottom:6,letterSpacing:1}}>COMPLETED</Text>
            <Text style={{fontSize:24,fontWeight:'900',color:C.green}}>{fmt(totalCompleted)}</Text>
            <Text style={{fontSize:11,color:C.muted,marginTop:4}}>{completed.length} jobs</Text>
          </View>
        </View>
        <View style={S.card}>
          <Text style={{color:C.text2,fontWeight:'700',marginBottom:14}}>💸 Discounts & Fees</Text>
          {[
            {label:'Promo Discounts Given',val:totalPromo,color:C.red},
            {label:'Wallet Credits Used',val:totalWallet,color:C.gold},
          ].map((item,i)=>(
            <View key={i} style={{flexDirection:'row',justifyContent:'space-between',marginBottom:10}}>
              <Text style={{color:C.muted,fontSize:14}}>{item.label}</Text>
              <Text style={{color:item.color,fontWeight:'700',fontSize:15}}>{fmt(item.val)}</Text>
            </View>
          ))}
        </View>
        <View style={[S.card,{marginTop:12}]}>
          <Text style={{color:C.text2,fontWeight:'700',marginBottom:16}}>📊 Last 7 Days</Text>
          <View style={{flexDirection:'row',alignItems:'flex-end',gap:6,height:120}}>
            {weekData.map((d,i)=>(
              <View key={i} style={{flex:1,alignItems:'center'}}>
                <Text style={{color:C.muted,fontSize:9,marginBottom:4}}>{d.revenue>0?`₹${d.revenue}`:''}</Text>
                <View style={{width:'100%',borderRadius:6,height:Math.max(8,(d.revenue/maxRev)*90),
                  backgroundColor:i===6?C.orange:C.orangeBg,borderWidth:i===6?0:0.5,borderColor:C.orangeBd}}/>
                <Text style={{color:C.muted,fontSize:10,marginTop:6}}>{d.label}</Text>
                <Text style={{color:C.text2,fontSize:9}}>{d.count}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{height:100}}/>
      </ScrollView>
    </View>
  );
});

// ════════════════════════════════════════════════════
// OFFERS SCREEN
// ════════════════════════════════════════════════════
const OffersScreen = memo(({ promos, onTogglePromo, onAddPromo, onBack }) => {
  const [addModal, setAddModal]   = useState(false);
  const [promoCode,  setPromoCode]  = useState('');
  const [promoType,  setPromoType]  = useState('pct');
  const [promoVal,   setPromoVal]   = useState('');
  const [promoLabel, setPromoLabel] = useState('');
  const [saving,     setSaving]     = useState(false);

  const handleSave = async () => {
    if (!promoCode.trim() || !promoVal.trim()) { Alert.alert('Required','Fill Code and Value'); return; }
    setSaving(true);
    await onAddPromo(promoCode.toUpperCase(), {
      type:promoType, val:Number(promoVal),
      label:promoLabel.trim()||promoCode.toUpperCase(), active:true,
    });
    setSaving(false);
    setPromoCode(''); setPromoVal(''); setPromoLabel(''); setPromoType('pct');
    setAddModal(false);
  };

  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
        padding:16,borderBottomWidth:0.5,borderBottomColor:C.border}}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{color:C.orange,fontSize:16}}>← Back</Text>
        </TouchableOpacity>
        <Text style={{color:C.text,fontWeight:'800',fontSize:16}}>Promo Codes</Text>
        <TouchableOpacity style={{backgroundColor:C.orange,paddingHorizontal:12,paddingVertical:6,borderRadius:16}}
          onPress={()=>setAddModal(true)}>
          <Text style={{color:'#FFF',fontWeight:'700',fontSize:12}}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{padding:16}}>
        {Object.entries(promos).map(([code,promo])=>(
          <View key={code} style={[S.card,{marginBottom:10}]}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <View style={{flex:1}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:4}}>
                  <Text style={{color:C.orange,fontWeight:'900',fontSize:18}}>{code}</Text>
                  <View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:8,
                    backgroundColor:promo.active?C.greenBg:C.redBg,borderWidth:0.5,
                    borderColor:promo.active?C.greenBd:C.redBd}}>
                    <Text style={{color:promo.active?C.green:C.red,fontSize:11,fontWeight:'700'}}>
                      {promo.active?'ACTIVE':'OFF'}
                    </Text>
                  </View>
                </View>
                <Text style={{color:C.text2,fontSize:13}}>{promo.label}</Text>
                <Text style={{color:C.muted,fontSize:12,marginTop:2}}>
                  {promo.type==='pct'?`${promo.val}% off`:`₹${promo.val} flat`}
                </Text>
              </View>
              <TouchableOpacity onPress={()=>onTogglePromo(code,promo.active)}
                style={{paddingHorizontal:14,paddingVertical:8,borderRadius:14,
                  backgroundColor:promo.active?C.redBg:C.greenBg,borderWidth:1,
                  borderColor:promo.active?C.redBd:C.greenBd}}>
                <Text style={{color:promo.active?C.red:C.green,fontWeight:'700',fontSize:12}}>
                  {promo.active?'Disable':'Enable'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {Object.keys(promos).length===0&&(
          <View style={{alignItems:'center',padding:60}}>
            <Text style={{fontSize:48}}>🎟️</Text>
            <Text style={{color:C.muted,marginTop:12}}>No promo codes yet</Text>
          </View>
        )}
        <View style={{height:100}}/>
      </ScrollView>

      <Modal visible={addModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',
            padding:16,borderBottomWidth:1,borderBottomColor:C.border}}>
            <TouchableOpacity onPress={()=>setAddModal(false)}>
              <Text style={{color:C.red}}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{color:C.text,fontWeight:'700'}}>New Promo Code</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving?<ActivityIndicator color={C.orange} size="small"/>:
                <Text style={{color:C.orange,fontWeight:'700'}}>Save</Text>}
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
            <ScrollView style={{padding:16}} keyboardShouldPersistTaps="handled">
              <Text style={S.lbl}>Promo Code</Text>
              <TextInput style={S.inp} placeholder="DIWALI25" placeholderTextColor={C.muted}
                autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} color={C.text}/>
              <Text style={S.lbl}>Label</Text>
              <TextInput style={S.inp} placeholder="25% off for Diwali" placeholderTextColor={C.muted}
                value={promoLabel} onChangeText={setPromoLabel} color={C.text}/>
              <Text style={S.lbl}>Type</Text>
              <View style={{flexDirection:'row',gap:10,marginBottom:16}}>
                {[['pct','% Off'],['flat','₹ Flat']].map(([val,lbl])=>(
                  <TouchableOpacity key={val} onPress={()=>setPromoType(val)}
                    style={{flex:1,padding:14,borderRadius:14,alignItems:'center',
                      backgroundColor:promoType===val?C.orange:C.card,borderWidth:1,
                      borderColor:promoType===val?C.orange:C.border2}}>
                    <Text style={{color:promoType===val?'#FFF':C.text2,fontWeight:'700'}}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={S.lbl}>Value</Text>
              <TextInput style={S.inp} placeholder="20" placeholderTextColor={C.muted}
                keyboardType="number-pad" value={promoVal} onChangeText={setPromoVal} color={C.text}/>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
});

// ════════════════════════════════════════════════════
// REVIEWS SCREEN
// ════════════════════════════════════════════════════
const ReviewsScreen = memo(({ bookings, onBack }) => {
  const rated=bookings.filter(b=>b.rated&&b.rating);
  const avgRating=rated.length?(rated.reduce((s,b)=>s+b.rating,0)/rated.length).toFixed(1):'—';
  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
        padding:16,borderBottomWidth:0.5,borderBottomColor:C.border}}>
        <TouchableOpacity onPress={onBack}><Text style={{color:C.orange,fontSize:16}}>← Back</Text></TouchableOpacity>
        <Text style={{color:C.text,fontWeight:'800',fontSize:16}}>Customer Reviews</Text>
        <View style={{width:60}}/>
      </View>
      <ScrollView style={{padding:16}}>
        <View style={[S.card,{flexDirection:'row',alignItems:'center',marginBottom:16}]}>
          <View style={{flex:1,alignItems:'center'}}>
            <Text style={{fontSize:48,fontWeight:'900',color:C.orange}}>{avgRating}</Text>
            <Text style={{fontSize:16,marginTop:4}}>{'⭐'.repeat(Math.round(Number(avgRating)||0))}</Text>
            <Text style={{color:C.muted,fontSize:12,marginTop:4}}>{rated.length} reviews</Text>
          </View>
          <View style={{flex:2}}>
            {[5,4,3,2,1].map(s=>{
              const count=rated.filter(b=>Math.round(b.rating)===s).length;
              const pct=rated.length?count/rated.length*100:0;
              return(
                <View key={s} style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:6}}>
                  <Text style={{color:C.muted,width:20,fontSize:12}}>{s}★</Text>
                  <View style={{flex:1,height:6,backgroundColor:C.border,borderRadius:3}}>
                    <View style={{height:6,width:`${pct}%`,backgroundColor:C.orange,borderRadius:3}}/>
                  </View>
                  <Text style={{color:C.muted,width:24,fontSize:11}}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
        {rated.sort((a,b)=>b.rating-a.rating).map(b=>(
          <View key={b.id} style={[S.card,{marginBottom:10}]}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
              <Text style={{color:C.text,fontWeight:'700'}}>{b.userName||'Customer'}</Text>
              <Text style={{fontSize:14}}>{'⭐'.repeat(b.rating||0)}</Text>
            </View>
            {b.ratingNote&&<Text style={{color:C.text2,fontSize:13,lineHeight:18,fontStyle:'italic'}}>"{b.ratingNote}"</Text>}
            <Text style={{color:C.muted,fontSize:11,marginTop:6}}>{b.orderId} · {timeAgo(b.ratedAt||b.createdAt)}</Text>
          </View>
        ))}
        {rated.length===0&&<View style={{alignItems:'center',padding:60}}>
          <Text style={{fontSize:48}}>⭐</Text>
          <Text style={{color:C.muted,marginTop:12}}>No reviews yet</Text>
        </View>}
        <View style={{height:100}}/>
      </ScrollView>
    </View>
  );
});

// ════════════════════════════════════════════════════
// MORE TAB — Main Menu
// ════════════════════════════════════════════════════
const MoreTab = memo(({ bookings, employees, customers, promos, onTogglePromo, onAddPromo }) => {
  const [subScreen, setSubScreen] = useState(null); // null = menu

  if (subScreen === 'services')      return <ServicesScreen onBack={()=>setSubScreen(null)}/>;
  if (subScreen === 'customers')     return <CustomersScreen bookings={bookings} onBack={()=>setSubScreen(null)}/>;
  if (subScreen === 'finance')       return <FinanceScreen bookings={bookings} onBack={()=>setSubScreen(null)}/>;
  if (subScreen === 'offers')        return <OffersScreen promos={promos} onTogglePromo={onTogglePromo} onAddPromo={onAddPromo} onBack={()=>setSubScreen(null)}/>;
  if (subScreen === 'reviews')       return <ReviewsScreen bookings={bookings} onBack={()=>setSubScreen(null)}/>;
  if (subScreen === 'notifications') return <NotificationsScreen employees={employees} customers={customers} onBack={()=>setSubScreen(null)}/>;

  const MENU = [
    { id:'services',      icon:'🛠️', label:'Services & Pricing',   desc:'Add/edit services and prices',           color:C.orange },
    { id:'customers',     icon:'👤', label:'Customers',             desc:`${customers?.length||0} registered customers`,  color:C.blue },
    { id:'finance',       icon:'💰', label:'Finance & Reports',     desc:'Revenue, weekly charts, payments',       color:C.gold },
    { id:'notifications', icon:'🔔', label:'Send Notifications',    desc:'Broadcast to customers or workers',      color:C.purple },
    { id:'offers',        icon:'🎟️', label:'Promo Codes',           desc:`${Object.keys(promos||{}).length} active promos`, color:C.green },
    { id:'reviews',       icon:'⭐', label:'Customer Reviews',      desc:'Ratings and feedback',                   color:C.orange2 },
  ];

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ padding:20, paddingTop:16 }}>
        <Text style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>MANAGEMENT</Text>
        <Text style={{ fontSize:22, fontWeight:'900', color:C.text, marginTop:4 }}>More Options</Text>
      </View>

      <View style={{ paddingHorizontal:16 }}>
        {MENU.map(item => (
          <TouchableOpacity key={item.id} onPress={()=>setSubScreen(item.id)}
            style={[S.card, { flexDirection:'row', alignItems:'center', marginBottom:10 }]}>
            <View style={{ width:52, height:52, borderRadius:16, alignItems:'center', justifyContent:'center',
              marginRight:16, backgroundColor:C.card2, borderWidth:0.5, borderColor:C.border2 }}>
              <Text style={{ fontSize:26 }}>{item.icon}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }}>{item.label}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>{item.desc}</Text>
            </View>
            <Text style={{ color:item.color, fontSize:22 }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height:100 }}/>
    </ScrollView>
  );
});

export default MoreTab;

// ══════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════
const S = StyleSheet.create({
  lbl:  { color:'#886858', fontSize:12, fontWeight:'600', marginBottom:8, marginTop:16 },
  inp:  { backgroundColor:'#1A100A', borderWidth:0.5, borderColor:'#3A2010', borderRadius:14, padding:14, fontSize:15, color:'#F5EDE8' },
  btn:  { backgroundColor:'#E8520A', borderRadius:30, padding:16, alignItems:'center', shadowColor:'#E8520A', shadowOffset:{width:0,height:0}, shadowOpacity:0.5, shadowRadius:12, elevation:6 },
  btnT: { color:'#FFF', fontSize:15, fontWeight:'800' },
  card: { backgroundColor:'#1A100A', borderRadius:18, padding:16, borderWidth:0.5, borderColor:'#3A2010', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.4, shadowRadius:8, elevation:4 },
});
