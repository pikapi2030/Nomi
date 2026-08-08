import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import Avatar from '../components/Avatar';
import { formatChatTimestamp } from '../utils/formatTime';

const ChatScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { chat: initialChat, otherUser: routeOtherUser } = route.params || {};
  const chatId = initialChat?._id;

  const { theme, isDark } = useTheme();
  const colors = theme.colors;
  const { user: currentUser } = useAuth();
  const { socket, joinChat, leaveChat, sendMessageSocket } = useSocket();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const flatListRef = useRef(null);

  // Calculate safe top padding for Android notch / camera cutout
  const safeTopPadding = Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, insets.top) + 4 : insets.top;

  // Extract recipient user (always showing Display Name)
  const recipientUser =
    routeOtherUser ||
    initialChat?.participants?.find(
      (p) => p._id && p._id.toString() !== currentUser._id.toString()
    ) || { displayName: 'Chat' };

  // Fetch message history from REST API
  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await api.get(`/messages/${chatId}`);
      if (res.data?.messages) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error('[Fetch Messages Error]:', err.message);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  // Initial setup & Socket.io room lifecycle
  useEffect(() => {
    if (!chatId) return;

    fetchMessages();
    joinChat(chatId);

    return () => {
      leaveChat(chatId);
    };
  }, [chatId, fetchMessages, joinChat, leaveChat]);

  // Real-time socket message receiver
  useEffect(() => {
    if (!socket || !chatId) return;

    const handleReceiveMessage = (newMessage) => {
      if (newMessage.chatId === chatId) {
        setMessages((prevMessages) => {
          // Avoid duplicate messages
          const exists = prevMessages.some((m) => m._id === newMessage._id);
          if (exists) return prevMessages;
          return [...prevMessages, newMessage];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, chatId]);

  // Scroll to bottom when messages load
  const handleContentSizeChange = () => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  };

  // Handle sending a new message
  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || !chatId || sending) return;

    setInputText('');
    setSending(true);

    try {
      // 1. Send message via REST API to persist in MongoDB
      const res = await api.post('/messages', { chatId, text: textToSend });

      if (res.data?.message) {
        const savedMessage = res.data.message;

        // Add to local state if not already received via socket
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === savedMessage._id);
          if (exists) return prev;
          return [...prev, savedMessage];
        });

        // 2. Broadcast message instantly via Socket.io
        sendMessageSocket(savedMessage);

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err) {
      console.error('[Send Message Error]:', err.message);
      // Restore input text on error
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  // Render individual message bubble
  const renderMessageItem = ({ item }) => {
    const isMe = item.sender?._id
      ? item.sender._id.toString() === currentUser._id.toString()
      : item.sender?.toString() === currentUser._id.toString();

    const timestamp = formatChatTimestamp(item.createdAt);

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.myMessageRow : styles.otherMessageRow,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMe
              ? [styles.myBubble, { backgroundColor: colors.myBubble }]
              : [styles.otherBubble, { backgroundColor: colors.otherBubble }],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isMe ? colors.myBubbleText : colors.otherBubbleText },
            ]}
          >
            {item.text}
          </Text>

          <Text
            style={[
              styles.messageTime,
              {
                color: isMe
                  ? 'rgba(255, 255, 255, 0.7)'
                  : colors.textSecondary,
              },
            ]}
          >
            {timestamp}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: safeTopPadding }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Profile', { userId: recipientUser._id })}
          style={styles.headerTitleContainer}
        >
          <Avatar uri={recipientUser.avatar} name={recipientUser.displayName} size={42} />
          <View style={styles.headerTextDetails}>
            <Text style={[styles.headerDisplayName, { color: colors.text }]} numberOfLines={1}>
              {recipientUser.displayName}
            </Text>
            {recipientUser.username ? (
              <Text style={[styles.headerUsername, { color: colors.textSecondary }]}>
                @{recipientUser.username}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      {/* Messages List Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.keyboardContainer}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesListContent}
            onContentSizeChange={handleContentSizeChange}
            ListEmptyComponent={() => (
              <View style={styles.emptyMessagesContainer}>
                <Text style={[styles.emptyMessagesText, { color: colors.textSecondary }]}>
                  This is the start of your conversation with {recipientUser.displayName}.
                </Text>
              </View>
            )}
          />
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            placeholder="Write a message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text }]}
          />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  inputText.trim() && !sending ? colors.primary : colors.border,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendIcon}>➔</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    elevation: 2,
  },
  backBtn: {
    padding: 8,
    marginRight: 6,
  },
  backIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextDetails: {
    marginLeft: 12,
    flex: 1,
  },
  headerDisplayName: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerUsername: {
    fontSize: 12,
    marginTop: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesListContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
    width: '100%',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 18,
    elevation: 1,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
    fontWeight: '500',
  },
  emptyMessagesContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyMessagesText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ChatScreen;
