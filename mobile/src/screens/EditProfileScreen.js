import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import Avatar from '../components/Avatar';

const EditProfileScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const colors = theme.colors;
  const { user, updateUserProfile } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [showUsername, setShowUsername] = useState(user?.privacy?.showUsername ?? false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const payload = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar: avatar.trim(),
        privacy: {
          showUsername,
        },
      };

      const res = await api.put('/users/profile', payload);

      if (res.data?.user) {
        await updateUserProfile(res.data.user);
        setSuccess('Profile updated successfully!');
        setTimeout(() => {
          navigation.goBack();
        }, 1000);
      }
    } catch (err) {
      console.error('[Update Profile Error]:', err.message);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Avatar Preview */}
          <View style={styles.avatarContainer}>
            <Avatar uri={avatar || user?.avatar} name={displayName || user?.displayName} size={90} />
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
              Avatar Preview
            </Text>
          </View>

          {/* Error / Success Banners */}
          {error ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Text style={[styles.bannerText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={[styles.bannerText, { color: colors.statusOnline }]}>{success}</Text>
            </View>
          ) : null}

          {/* Read-Only Permanent Username */}
          <View style={styles.immutableField}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Username (Permanent - Cannot be changed)
            </Text>
            <View style={[styles.disabledInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.disabledText, { color: colors.textSecondary }]}>
                @{user?.username}
              </Text>
            </View>
          </View>

          {/* Editable Display Name */}
          <Input
            label="Display Name (Shown across UI)"
            placeholder="Enter display name"
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              if (error) setError('');
            }}
          />

          {/* Editable Bio */}
          <Input
            label="Bio"
            placeholder="Write something about yourself..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
          />

          {/* Editable Avatar Image URL */}
          <Input
            label="Avatar Image URL"
            placeholder="https://..."
            value={avatar}
            onChangeText={setAvatar}
            autoCapitalize="none"
          />

          {/* Privacy Settings Card */}
          <View style={[styles.privacyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.privacyHeader}>
              <Text style={[styles.privacyTitle, { color: colors.text }]}>Show Username publicly</Text>
              <Switch
                value={showUsername}
                onValueChange={setShowUsername}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <Text style={[styles.privacySubtext, { color: colors.textSecondary }]}>
              When disabled, only your Display Name is shown throughout ChatLoop, and your username remains hidden from other users.
            </Text>
          </View>

          <Button
            title="Save Profile Changes"
            onPress={handleSaveProfile}
            loading={loading}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarHint: {
    fontSize: 12,
    marginTop: 6,
  },
  banner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  immutableField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  disabledInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    justifyContent: 'center',
  },
  disabledText: {
    fontSize: 15,
    fontWeight: '600',
  },
  privacyCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 14,
  },
  privacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  privacySubtext: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  saveBtn: {
    marginTop: 10,
    marginBottom: 30,
  },
});

export default EditProfileScreen;
