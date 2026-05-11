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
import messaging from '@react-native-firebase/messaging';
