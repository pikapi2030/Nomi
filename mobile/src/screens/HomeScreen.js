import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Avatar from '../components/Avatar';
import Input from '../components/Input';
import { formatChatTimestamp } from '../utils/formatTime';

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme, isDark } = useTheme();
  const colors = theme.colors;
  const { user: currentUser, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate safe top padding for Android notch / camera cutout
  const safeTopPadding = Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, insets.top) + 6 : insets.top;

  // Fetch user chats
  const fetchChats = useCallback(async () => {
    try {
      const res = await api.get('/chats');
      if (res.data?.chats) {
        setChats(res.data.chats);
      }
    } catch (err) {
      console.error('[Fetch Chats Error]:', err.message);
    } finally {
      setChatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Focus listener to refresh chat list when returning from ChatScreen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchChats();
    });
    return unsubscribe;
  }, [navigation, fetchChats]);

  // Perform user search when searchQuery changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.data?.users) {
          setSearchResults(res.data.users);
        }
      } catch (err) {
        console.error('[User Search Error]:', err.message);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchChats();
  };

  // Open or create chat with selected user from search
  const handleSelectUserFromSearch = async (otherUser) => {
    try {
      const res = await api.post('/chats', { recipientId: otherUser._id });
      if (res.data?.chat) {
        setSearchQuery('');
        setIsSearching(false);
        navigation.navigate('Chat', { chat: res.data.chat, otherUser });
      }
    } catch (err) {
      console.error('[Open Chat Error]:', err.message);
    }
  };

  // Open chat from recent list
  const handleSelectChat = (chatItem) => {
    const otherUser = chatItem.participants.find(
      (p) => p._id && p._id.toString() !== currentUser._id.toString()
    );
    navigation.navigate('Chat', { chat: chatItem, otherUser });
  };

  // Helper to extract recipient from participants
  const getOtherParticipant = (chatItem) => {
    if (!chatItem.participants) return { displayName: 'User' };
    return (
      chatItem.participants.find(
        (p) => p._id && p._id.toString() !== currentUser._id.toString()
      ) || { displayName: 'User' }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: safeTopPadding }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandIcon}>💬</Text>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Nomi</Text>
        </View>

        <View style={styles.headerActions}>
          {/* Theme Toggle */}
          <TouchableOpacity onPress={toggleTheme} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
            <Text style={styles.actionIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          {/* User Profile Shortcut */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.avatarBtn}
          >
            <Avatar uri={currentUser?.avatar} name={currentUser?.displayName} size={36} />
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity onPress={logout} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
            <Text style={styles.actionIcon}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <Input
          placeholder="Search users by display name or username..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          style={styles.searchInput}
        />
      </View>

      {/* Main Content View */}
      {isSearching ? (
        // Search Results Mode
        <View style={styles.contentContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            Search Results ({searchResults.length})
          </Text>
          {searchLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item._id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleSelectUserFromSearch(item)}
                  style={[styles.userListItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Avatar uri={item.avatar} name={item.displayName} size={50} />
                  <View style={styles.userListItemDetails}>
                    <Text style={[styles.displayName, { color: colors.text }]}>{item.displayName}</Text>
                    {item.username ? (
                      <Text style={[styles.usernameText, { color: colors.primary }]}>@{item.username}</Text>
                    ) : null}
                    {item.bio ? (
                      <Text numberOfLines={1} style={[styles.bioText, { color: colors.textSecondary }]}>
                        {item.bio}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No users found matching "{searchQuery}"
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      ) : (
        // Recent Chats Mode
        <View style={styles.contentContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Recent Chats</Text>
          {chatsLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={chats}
              keyExtractor={(item) => item._id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
              renderItem={({ item }) => {
                const otherUser = getOtherParticipant(item);
                const lastMsgText = item.lastMessage ? item.lastMessage.text : 'Tap to start conversation';
                const timestamp = formatChatTimestamp(item.updatedAt);

                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleSelectChat(item)}
                    style={[styles.chatListItem, { borderBottomColor: colors.border }]}
                  >
                    <Avatar uri={otherUser.avatar} name={otherUser.displayName} size={54} />
                    <View style={styles.chatListItemDetails}>
                      <View style={styles.chatItemRow}>
                        <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                          {otherUser.displayName}
                        </Text>
                        <Text style={[styles.timestampText, { color: colors.textSecondary }]}>
                          {timestamp}
                        </Text>
                      </View>

                      <Text numberOfLines={1} style={[styles.lastMsgText, { color: colors.textSecondary }]}>
                        {lastMsgText}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>💬</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Conversations Yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Search for users by username or display name above to start messaging!
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionIcon: {
    fontSize: 18,
  },
  avatarBtn: {
    marginLeft: 8,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    height: 46,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginVertical: 8,
  },
  loader: {
    marginTop: 40,
  },
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  userListItemDetails: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
  },
  usernameText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  bioText: {
    fontSize: 13,
    marginTop: 2,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chatListItemDetails: {
    marginLeft: 14,
    flex: 1,
  },
  chatItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 12,
    fontWeight: '500',
  },
  lastMsgText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 30,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HomeScreen;
