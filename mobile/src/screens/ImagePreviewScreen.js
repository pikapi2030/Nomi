import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ImagePreviewScreen = ({ route, navigation }) => {
  const { imageUrl } = route.params || {};
  const insets = useSafeAreaInsets();

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const currentScale = useRef(1);
  const currentTranslateX = useRef(0);
  const currentTranslateY = useRef(0);

  const initialDistance = useRef(null);
  const lastTouchTime = useRef(0);

  useEffect(() => {
    const scaleSub = scale.addListener(({ value }) => {
      currentScale.current = value;
    });
    const txSub = translateX.addListener(({ value }) => {
      currentTranslateX.current = value;
    });
    const tySub = translateY.addListener(({ value }) => {
      currentTranslateY.current = value;
    });

    return () => {
      scale.removeListener(scaleSub);
      translateX.removeListener(txSub);
      translateY.removeListener(tySub);
    };
  }, []);

  const getDistance = (touches) => {
    if (!touches || touches.length < 2) return null;
    const [t1, t2] = touches;
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.hypot(dx, dy);
  };

  const handleReset = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length === 2) {
          initialDistance.current = getDistance(touches);
        } else if (touches && touches.length === 1) {
          const now = Date.now();
          if (now - lastTouchTime.current < 300) {
            // Double Tap to Zoom / Reset
            const targetScale = currentScale.current > 1.2 ? 1 : 2.5;
            if (targetScale === 1) {
              handleReset();
            } else {
              Animated.parallel([
                Animated.spring(scale, { toValue: targetScale, useNativeDriver: true }),
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
                Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
              ]).start();
            }
          }
          lastTouchTime.current = now;
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches && touches.length === 2) {
          // Pinch Zoom
          const currentDistance = getDistance(touches);
          if (initialDistance.current && currentDistance) {
            const factor = currentDistance / initialDistance.current;
            const newScale = Math.min(Math.max(currentScale.current * factor, 1), 4);
            scale.setValue(newScale);
            initialDistance.current = currentDistance;
          }
        } else if (touches && touches.length === 1 && currentScale.current > 1) {
          // Drag / Pan Image when zoomed in
          translateX.setValue(currentTranslateX.current + gestureState.dx);
          translateY.setValue(currentTranslateY.current + gestureState.dy);
        }
      },

      onPanResponderRelease: () => {
        initialDistance.current = null;
        if (currentScale.current <= 1) {
          handleReset();
        }
      },
    })
  ).current;

  const topPadding = Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, insets.top) + 10 : insets.top + 10;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Top Close Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.closeBtn, { top: topPadding }]}
      >
        <Text style={styles.closeBtnText}>✕ Close</Text>
      </TouchableOpacity>

      {/* Full-Screen Pinch & Double-Tap Zoomable Image */}
      <View style={styles.imageContainer} {...panResponder.panHandlers}>
        {imageUrl ? (
          <Animated.Image
            source={{ uri: imageUrl }}
            style={[
              styles.image,
              {
                transform: [
                  { scale },
                  { translateX },
                  { translateY },
                ],
              },
            ]}
            resizeMode="contain"
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default ImagePreviewScreen;
