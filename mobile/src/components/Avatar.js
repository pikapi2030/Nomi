import React, { useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Preset vibrant avatar background colors (Telegram style)
const AVATAR_COLORS = [
  '#2563EB', // Blue
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#0891B2', // Cyan
  '#DB2777', // Pink
  '#4F46E5', // Indigo
];

// Hash name string to deterministically select a color
const getColorForName = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

const getInitials = (text = '') => {
  if (!text) return 'U';
  const parts = text.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return text.substring(0, 2).toUpperCase();
};

const Avatar = ({ uri, name = 'User', size = 48, style }) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [imageError, setImageError] = useState(false);

  const initials = getInitials(name);
  const avatarBgColor = getColorForName(name);

  // If a valid custom uri exists and hasn't errored, render Image, otherwise render instant native initials
  const hasCustomUri = uri && typeof uri === 'string' && uri.trim().startsWith('http') && !imageError;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarBgColor,
        },
        style,
      ]}
    >
      {hasCustomUri ? (
        <Image
          source={{ uri: uri.trim() }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <Text style={[styles.initialsText, { fontSize: size * 0.4 }]}>{initials}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default Avatar;
