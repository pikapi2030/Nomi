import React, { useRef, useState } from 'react';
import { View, Image, Animated, PanResponder, StyleSheet } from 'react-native';

const ZoomableImage = ({ uri, style }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const currentScale = useRef(1);
  const currentTranslateX = useRef(0);
  const currentTranslateY = useRef(0);

  const initialDistance = useRef(null);
  const lastTouchTime = useRef(0);

  scale.addListener(({ value }) => {
    currentScale.current = value;
  });
  translateX.addListener(({ value }) => {
    currentTranslateX.current = value;
  });
  translateY.addListener(({ value }) => {
    currentTranslateY.current = value;
  });

  const getDistance = (touches) => {
    const [t1, t2] = touches;
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.hypot(dx, dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          initialDistance.current = getDistance(touches);
        } else if (touches.length === 1) {
          const now = Date.now();
          if (now - lastTouchTime.current < 300) {
            // Double-Tap to Zoom In / Reset
            const targetScale = currentScale.current > 1.2 ? 1 : 2.5;
            Animated.parallel([
              Animated.spring(scale, { toValue: targetScale, useNativeDriver: true }),
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
              Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            ]).start();
          }
          lastTouchTime.current = now;
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          // Pinch Gesture
          const currentDistance = getDistance(touches);
          if (initialDistance.current) {
            const factor = currentDistance / initialDistance.current;
            const newScale = Math.min(Math.max(currentScale.current * factor, 1), 4);
            scale.setValue(newScale);
            initialDistance.current = currentDistance;
          }
        } else if (touches.length === 1 && currentScale.current > 1) {
          // Drag / Pan Gesture when zoomed in
          translateX.setValue(currentTranslateX.current + gestureState.dx);
          translateY.setValue(currentTranslateY.current + gestureState.dy);
        }
      },

      onPanResponderRelease: () => {
        initialDistance.current = null;
        if (currentScale.current <= 1) {
          // Reset alignment if zoomed out
          Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});

export default ZoomableImage;
