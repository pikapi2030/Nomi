import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Avatar from '../components/Avatar';
import Button from '../components/Button';

const ProfileScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { userId } = route.params || {};
  const { theme, isDark } = useTheme();
  const colors = theme.colors;
  const { user: currentUser } = useAuth();

  const isSelf = !userId || userId === currentUser?._id;

  const [profileUser, setProfileUser] = useState(isSelf ? currentUser : null);
  const [loading, setLoading] = useState(!isSelf);
  const [error, setError] = useState('');

  const safeTopPadding = Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, insets.top) + 4 : insets.top;

  useEffect(() => {
    if (isSelf) {
      setProfileUser(currentUser);
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/users/${userId}`);
        if (res.data?.user) {
          setProfileUser(res.data.user);
        }
      } catch (err) {
        console.error('[Fetch Profile Error]:', err.message);
        setError('Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, isSelf, currentUser]);

  const handleStartChat = async () => {
    if (!profileUser) return;
    try {
      const res = await api.post('/chats', { recipientId: profileUser._id });
      if (res.data?.chat) {
        navigation.navigate('Chat', { chat: res.data.chat, otherUser: profileUser });
      }
    } catch (err) {
      console.error('[Start Chat Error]:', err.message);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !profileUser) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error || 'User not found'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: safeTopPadding }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Avatar & Header */}
        <View style={styles.headerCard}>
          <Avatar uri={profileUser.avatar} name={profileUser.displayName} size={110} />
          
          <Text style={[styles.displayName, { color: colors.text }]}>
            {profileUser.displayName}
          </Text>

          {profileUser.username ? (
            <Text style={[styles.usernameHandle, { color: colors.primary }]}>
              @{profileUser.username}
            </Text>
          ) : (
            <Text style={[styles.usernameHidden, { color: colors.textSecondary }]}>
              Username Hidden
            </Text>
          )}
        </View>

        {/* Details Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Bio</Text>
          <Text style={[styles.bioContent, { color: profileUser.bio ? colors.text : colors.textSecondary }]}>
            {profileUser.bio || 'No bio provided.'}
          </Text>
        </View>

        {isSelf ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Privacy Settings</Text>
            <View style={styles.settingRow}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Show Username to others</Text>
              <Text style={[styles.settingBadge, { color: colors.primary }]}>
                {profileUser.privacy?.showUsername ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {isSelf ? (
            <Button
              title="Edit Profile"
              onPress={() => navigation.navigate('EditProfile')}
            />
          ) : (
            <Button
              title="Start Conversation"
              onPress={handleStartChat}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    alignItems: 'center',
    marginVertical: 20,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 14,
  },
  usernameHandle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  usernameHidden: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  bioContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingBadge: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionContainer: {
    marginTop: 10,
  },
});

export default ProfileScreen;
