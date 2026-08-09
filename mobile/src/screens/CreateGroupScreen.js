import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Avatar from '../components/Avatar';
import Input from '../components/Input';
import Button from '../components/Button';

const CreateGroupScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const colors = theme.colors;
  const { user: currentUser } = useAuth();

  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const safeTopPadding = Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, insets.top) + 6 : insets.top;

  // Search users to add to group
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.data?.users) {
          setSearchResults(res.data.users);
        }
      } catch (err) {
        console.error('[Search Group Users Error]:', err.message);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleSelectUser = (user) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u._id === user._id);
      if (exists) {
        return prev.filter((u) => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for your group chat.');
      return;
    }

    if (selectedUsers.length < 1) {
      Alert.alert('Select Participants', 'Please select at least 1 contact to add to the group.');
      return;
    }

    setCreating(true);
    try {
      const participantIds = selectedUsers.map((u) => u._id);
      const res = await api.post('/chats/group', {
        groupName: groupName.trim(),
        participantIds,
      });

      if (res.data?.chat) {
        navigation.replace('Chat', { chat: res.data.chat });
      }
    } catch (err) {
      console.error('[Create Group Error]:', err.message);
      Alert.alert('Error', err.response?.data?.message || 'Failed to create group chat.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: safeTopPadding }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Group Chat</Text>
      </View>

      <View style={styles.content}>
        {/* Group Name Input */}
        <Input
          label="Group Name"
          placeholder="e.g. Project Team, Family, Friends"
          value={groupName}
          onChangeText={setGroupName}
        />

        {/* Selected Users Chips */}
        {selectedUsers.length > 0 ? (
          <View style={styles.selectedContainer}>
            <Text style={[styles.selectedHeader, { color: colors.textSecondary }]}>
              Selected ({selectedUsers.length})
            </Text>
            <View style={styles.chipsRow}>
              {selectedUsers.map((u) => (
                <TouchableOpacity
                  key={u._id}
                  onPress={() => toggleSelectUser(u)}
                  style={[styles.chip, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.chipText}>{u.displayName} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* Search Contacts to Add */}
        <Input
          placeholder="Search contacts by name or username..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {/* User Search Results List */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const isSelected = selectedUsers.some((u) => u._id === item._id);
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleSelectUser(item)}
                  style={[
                    styles.userItem,
                    {
                      backgroundColor: isSelected ? colors.card : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Avatar uri={item.avatar} name={item.displayName} size={44} isOnline={item.isOnline} showOnlineBadge />
                  <View style={styles.userDetails}>
                    <Text style={[styles.displayName, { color: colors.text }]}>{item.displayName}</Text>
                    {item.username ? (
                      <Text style={[styles.usernameText, { color: colors.primary }]}>@{item.username}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.checkboxIcon, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                    {isSelected ? '☑️' : '◻️'}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery ? 'No contacts found.' : 'Search above to select contacts for your group.'}
                </Text>
              </View>
            )}
          />
        )}

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
          <Button title={creating ? 'Creating Group...' : 'Create Group Chat'} onPress={handleCreateGroup} disabled={creating} />
        </View>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    marginRight: 10,
  },
  backIcon: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  selectedContainer: {
    marginBottom: 12,
  },
  selectedHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  searchInput: {
    marginVertical: 10,
  },
  loader: {
    marginTop: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
  },
  usernameText: {
    fontSize: 12,
    marginTop: 2,
  },
  checkboxIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 10,
  },
});

export default CreateGroupScreen;
