import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const ZoomableImage = ({ uri, style }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const currentScale = useRef(1);
  const currentTranslateX = useRef(0);
  const currentTranslateY = useRef(0);

  const [scaleDisplay, setScaleDisplay] = useState(100);

  const initialDistance = useRef(null);
  const lastTouchTime = useRef(0);

  useEffect(() => {
    const scaleSub = scale.addListener(({ value }) => {
      currentScale.current = value;
      setScaleDisplay(Math.round(value * 100));
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

  const handleZoomIn = () => {
    const newScale = Math.min(currentScale.current + 0.5, 4);
    Animated.spring(scale, { toValue: newScale, useNativeDriver: true }).start();
  };

  const handleZoomOut = () => {
    const newScale = Math.max(currentScale.current - 0.5, 1);
    if (newScale === 1) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.spring(scale, { toValue: newScale, useNativeDriver: true }).start();
    }
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
            // Double Tap to toggle Zoom
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
          // Pan / Move Image when zoomed in
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

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer} {...panResponder.panHandlers}>
        <Animated.Image
          source={{ uri }}
          style={[
            style,
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
      </View>

      {/* On-Screen Zoom Controls Overlay */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity onPress={handleZoomOut} style={styles.controlBtn}>
          <Text style={styles.controlBtnText}>➖</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleReset} style={styles.scaleBadge}>
          <Text style={styles.scaleBadgeText}>{scaleDisplay}%</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleZoomIn} style={styles.controlBtn}>
          <Text style={styles.controlBtnText}>➕</Text>
        </TouchableOpacity>

        {scaleDisplay > 100 ? (
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>🔄 Reset</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 8,
  },
  controlBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  controlBtnText: {
    fontSize: 20,
  },
  scaleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 8,
  },
  scaleBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  resetBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});

export default ZoomableImage;
