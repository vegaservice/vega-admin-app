// ██ LIVE MAP TAB — Real-time worker tracking
// Uses Leaflet.js + OpenStreetMap (free, no API key needed)
// Workers appear as colored pins — orange=working, green=idle, gray=offline
// Tap any pin to see worker details + current job
// Route Playback: replay any worker's path for today

import React, { useRef, useState, useCallback, memo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Modal, SafeAreaView, Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import firestore from '@react-native-firebase/firestore';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  bg: '#0F0A06', card: '#1A100A', card2: '#231408',
  orange: '#E8520A', orangeBg: '#2A1408', orangeBd: '#4A2010',
  green: '#22C55E', greenBg: '#0A2010', greenBd: '#1A4020',
  red: '#EF4444', redBg: '#2A0808', gold: '#D4901A',
  blue: '#3B82F6', muted: '#886858', text: '#F5EDE8', text2: '#C8A898',
  border: '#2A1808', border2: '#3A2010',
};

const timeAgo = (ts) => {
  if (!ts) return 'offline';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return 'offline';
};

// ── Build the full Leaflet HTML page
const buildMapHtml = (workers, trailPoints, viewMode) => {
  const markers = workers
    .filter(w => w.lastLat && w.lastLng)
    .map(w => ({
      id: w.id, name: w.name || 'Worker',
      lat: w.lastLat, lng: w.lastLng,
      status: w.currentStatus || (w.isAvailable ? 'idle' : 'offline'),
      tasks: w.tasksToday || 0,
      area: w.currentArea || '',
      updated: w.lastLocationAt ? timeAgo(w.lastLocationAt) : 'unknown',
      role: w.role || 'worker',
    }));

  const trail = trailPoints.map(p => [p.lat, p.lng]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0F0A06; font-family:-apple-system,sans-serif; height:100vh; overflow:hidden; }
  #map { width:100vw; height:100vh; }
  .custom-marker {
    display:flex; align-items:center; justify-content:center;
    border-radius:50%; border:3px solid; font-weight:900;
    font-size:13px; color:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.6);
  }
  .popup-content {
    background:#1A100A; color:#F5EDE8; border-radius:10px;
    padding:10px 12px; min-width:160px; font-size:13px;
  }
  .popup-name { font-weight:800; font-size:15px; margin-bottom:4px; }
  .popup-status { display:inline-block; padding:2px 8px; border-radius:10px;
    font-size:11px; font-weight:700; margin-bottom:6px; }
  .popup-row { color:#886858; font-size:11px; margin-top:3px; }
  .leaflet-popup-content-wrapper { background:transparent !important; border:none !important;
    box-shadow:none !important; padding:0 !important; }
  .leaflet-popup-tip-container { display:none !important; }
  .leaflet-popup-content { margin:0 !important; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  // Center on Visakhapatnam
  const map = L.map('map', {
    center: [17.7384, 83.2172],
    zoom: 12,
    zoomControl: false,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const STATUS_COLORS = {
    working: { bg:'#E8520A', border:'#FF6B2B', size:36 },
    idle:    { bg:'#22C55E', border:'#16A34A', size:32 },
    offline: { bg:'#444',   border:'#666',     size:28 },
  };

  const workers = ${JSON.stringify(markers)};
  const bounds = [];

  workers.forEach(w => {
    const cfg = STATUS_COLORS[w.status] || STATUS_COLORS.offline;
    const icon = L.divIcon({
      className:'',
      html: '<div class="custom-marker" style="width:'+cfg.size+'px;height:'+cfg.size+'px;background:'+cfg.bg+';border-color:'+cfg.border+';">'+(w.name[0]||'?')+'</div>',
      iconSize:[cfg.size, cfg.size],
      iconAnchor:[cfg.size/2, cfg.size/2],
    });
    const statusBg = w.status==='working'?'#2A1408':w.status==='idle'?'#0A2010':'#1A1A1A';
    const statusColor = w.status==='working'?'#E8520A':w.status==='idle'?'#22C55E':'#888';
    const popupHtml = '<div class="popup-content">'
      +'<div class="popup-name">'+w.name+'</div>'
      +'<span class="popup-status" style="background:'+statusBg+';color:'+statusColor+'">● '+w.status.toUpperCase()+'</span>'
      +'<div class="popup-row">📍 '+w.area+'</div>'
      +'<div class="popup-row">✅ '+w.tasks+' tasks today</div>'
      +'<div class="popup-row">🕐 Updated '+w.updated+'</div>'
      +'</div>';
    const marker = L.marker([w.lat, w.lng], { icon }).addTo(map);
    marker.bindPopup(popupHtml, { maxWidth:220, autoPan:true });
    bounds.push([w.lat, w.lng]);
    marker.on('click', () => {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type:'workerTap', workerId: w.id }));
    });
  });

  // Route trail
  const trail = ${JSON.stringify(trail)};
  if (trail.length > 1) {
    L.polyline(trail, { color:'#E8520A', weight:3, opacity:0.8, dashArray:'5,8' }).addTo(map);
    trail.forEach((pt, i) => {
      const isFirst = i === 0, isLast = i === trail.length-1;
      if (isFirst || isLast || i % 5 === 0) {
        L.circleMarker(pt, {
          radius: isLast ? 8 : 4,
          fillColor: isLast ? '#E8520A' : '#FF6B2B',
          color: '#fff', weight: 1, fillOpacity: 1,
        }).addTo(map);
      }
    });
    map.fitBounds(trail, { padding: [40, 40] });
  } else if (bounds.length > 0) {
    if (bounds.length === 1) { map.setView(bounds[0], 14); }
    else { map.fitBounds(bounds, { padding:[60,60] }); }
  }

  // Update markers dynamically
  window.updateWorkers = function(newWorkers) {
    // Called from RN to refresh markers without full page reload
    // Full reload is simpler for now — see sendWorkerData below
  };
</script>
</body>
</html>`;
};

// ── Route Playback Modal
const RoutePlaybackModal = memo(({ worker, visible, onClose }) => {
  const [trail, setTrail] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTrail = useCallback(async () => {
    if (!worker) return;
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const snap = await firestore()
        .collection('workers').doc(worker.id)
        .collection('location_trail')
        .where('timestamp', '>=', firestore.Timestamp.fromDate(today))
        .orderBy('timestamp', 'asc')
        .limit(500)
        .get();
      const points = snap.docs.map(d => d.data()).filter(p => p.lat && p.lng);
      setTrail(points);
    } catch (e) {
      console.error('trail:', e);
      setTrail([]);
    }
    setLoading(false);
  }, [worker]);

  React.useEffect(() => {
    if (visible && worker) loadTrail();
  }, [visible, worker]);

  const mapHtml = trail.length > 0
    ? buildMapHtml(worker ? [worker] : [], trail, 'trail')
    : buildMapHtml(worker ? [worker] : [], [], 'single');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: C.orange, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontWeight: '700' }}>{worker?.name} — Route Today</Text>
            <Text style={{ color: C.muted, fontSize: 11 }}>{trail.length} location points</Text>
          </View>
          <TouchableOpacity onPress={loadTrail}>
            <Text style={{ color: C.orange, fontSize: 13 }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.orange} size="large"/>
            <Text style={{ color: C.muted, marginTop: 12 }}>Loading route...</Text>
          </View>
        ) : trail.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 48 }}>🗺️</Text>
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 15 }}>No route data for today</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}>
              Route playback requires the Worker app to be active with location permission enabled
            </Text>
          </View>
        ) : (
          <WebView
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
                <ActivityIndicator color={C.orange} size="large"/>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
});

// ── Main Map Tab
const MapTab = memo(({ employees, bookings }) => {
  const webViewRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [filter, setFilter] = useState('All');

  const todayStr = new Date().toDateString();

  const workersWithLocation = employees.filter(e => e.lastLat && e.lastLng);
  const workersNoLocation   = employees.filter(e => !e.lastLat && !e.lastLng && e.isActive !== false);

  const filteredForMap = filter === 'All' ? employees
    : filter === 'Working' ? employees.filter(e => e.currentStatus === 'working')
    : filter === 'Available' ? employees.filter(e => e.isAvailable && e.currentStatus !== 'working')
    : employees.filter(e => !e.isAvailable && e.currentStatus !== 'working');

  const mapHtml = buildMapHtml(filteredForMap, [], 'live');

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'workerTap') {
        const worker = employees.find(e => e.id === data.workerId);
        if (worker) setSelectedWorker(worker);
      }
    } catch (e) {}
  }, [employees]);

  const workerJobs = selectedWorker
    ? bookings.filter(b => {
        const d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return b.assignedWorkerId === selectedWorker.id && d.toDateString() === todayStr;
      })
    : [];

  const liveCount     = employees.filter(e => e.lastLocationAt).length;
  const workingCount  = employees.filter(e => e.currentStatus === 'working').length;
  const availableCount= employees.filter(e => e.isAvailable && e.currentStatus !== 'working').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ padding: 12, paddingBottom: 8, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View>
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>🗺️ Live Worker Map</Text>
            <Text style={{ color: C.muted, fontSize: 11 }}>
              {workersWithLocation.length}/{employees.length} workers on map · Updates every 30s
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: C.orangeBg, borderWidth: 0.5, borderColor: C.orangeBd }}>
              <Text style={{ color: C.orange, fontSize: 11, fontWeight: '700' }}>🧹 {workingCount} Working</Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: C.greenBg, borderWidth: 0.5, borderColor: C.greenBd }}>
              <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>✅ {availableCount} Free</Text>
            </View>
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['All', 'Working', 'Available', 'Offline'].map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginRight: 8,
                backgroundColor: filter === f ? C.orange : C.card, borderWidth: 1,
                borderColor: filter === f ? C.orange : C.border2 }}>
              <Text style={{ color: filter === f ? '#FFF' : C.text2, fontWeight: '600', fontSize: 12 }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map */}
      <View style={{ flex: 1, position: 'relative' }}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
              <ActivityIndicator color={C.orange} size="large"/>
              <Text style={{ color: C.muted, marginTop: 12 }}>Loading live map...</Text>
            </View>
          )}
        />

        {/* Workers without location */}
        {workersNoLocation.length > 0 && (
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16,
            backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: C.border2 }}>
            <Text style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>
              ⚠️ {workersNoLocation.length} worker{workersNoLocation.length > 1 ? 's' : ''} — location not yet received
            </Text>
            <Text style={{ color: C.muted, fontSize: 10 }}>
              {workersNoLocation.map(w => w.name).join(', ')}
            </Text>
          </View>
        )}
      </View>

      {/* Worker Detail Bottom Sheet */}
      {selectedWorker && (
        <View style={{ backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: 16, borderTopWidth: 0.5, borderTopColor: C.border2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.orangeBg,
              alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.orangeBd }}>
              <Text style={{ color: C.orange, fontWeight: '900', fontSize: 18 }}>{selectedWorker.name?.[0] || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>{selectedWorker.name}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>📍 {selectedWorker.currentArea} · {workerJobs.length} jobs today</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedWorker(null)}>
              <Text style={{ color: C.muted, fontSize: 22 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: C.orangeBg, borderRadius: 12, padding: 10,
                alignItems: 'center', borderWidth: 0.5, borderColor: C.orangeBd }}
              onPress={() => { setShowRoute(true); }}>
              <Text style={{ color: C.orange, fontWeight: '700', fontSize: 13 }}>📍 Route Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: C.card2, borderRadius: 12, padding: 10,
                alignItems: 'center', borderWidth: 0.5, borderColor: C.border2 }}
              onPress={() => {
                // Find current job
                const currentJob = bookings.find(b => b.assignedWorkerId === selectedWorker.id && b.status === 'in_progress');
                if (currentJob) {
                  // Could navigate to booking detail
                }
              }}>
              <Text style={{ color: C.text2, fontWeight: '700', fontSize: 13 }}>
                {selectedWorker.currentStatus === 'working' ? '📦 Current Job' : '✅ Available'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Route Playback Modal */}
      <RoutePlaybackModal
        worker={selectedWorker}
        visible={showRoute}
        onClose={() => setShowRoute(false)}
      />
    </View>
  );
});

export default MapTab;
