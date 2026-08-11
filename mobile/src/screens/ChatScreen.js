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
  Image,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import Avatar from '../components/Avatar';
import ZoomableImage from '../components/ZoomableImage';
import { formatChatTimestamp } from '../utils/formatTime';

const REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥', '😮', '👏'];

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

  // V2 Feature States
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [otherUserStatus, setOtherUserStatus] = useState(routeOtherUser || {});
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const [selectedImageForSending, setSelectedImageForSending] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const safeTopPadding = Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, insets.top) + 4 : insets.top;
  const isGroup = initialChat?.isGroup;

  const recipientUser =
    otherUserStatus._id ? otherUserStatus :
    routeOtherUser ||
    initialChat?.participants?.find(
      (p) => p._id && p._id.toString() !== currentUser._id.toString()
    ) || { displayName: 'Chat' };

  // Fetch messages from REST API
  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await api.get(`/messages/${chatId}`);
      const msgList = res?.data?.messages || res?.messages || [];
      setMessages(msgList);

      // Mark unread messages as read
      const unreadIds = msgList
        .filter((m) => {
          const senderId = m.sender?._id ? m.sender._id.toString() : m.sender?.toString();
          if (senderId === currentUser._id.toString()) return false;
          const hasRead = m.readBy?.some((r) => {
            const rId = r.user?._id ? r.user._id.toString() : r.user?.toString();
            return rId === currentUser._id.toString();
          });
          return !hasRead;
        })
        .map((m) => m._id);

      if (unreadIds.length > 0 && socket) {
        socket.emit('mark_read', { chatId, messageIds: unreadIds });
      }
    } catch (err) {
      console.error('[Fetch Messages Error]:', err.message);
    } finally {
      setLoading(false);
    }
  }, [chatId, currentUser._id, socket]);

  // Initial setup & Socket room lifecycle
  useEffect(() => {
    if (!chatId) return;

    fetchMessages();
    joinChat(chatId);

    return () => {
      leaveChat(chatId);
    };
  }, [chatId, fetchMessages, joinChat, leaveChat]);

  // Socket listeners for real-time features
  useEffect(() => {
    if (!socket || !chatId) return;

    // Receive Message
    const handleReceiveMessage = (newMessage) => {
      if (newMessage.chatId === chatId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === newMessage._id);
          if (exists) return prev;
          return [...prev, newMessage];
        });

        // Auto mark read if sender is not me
        const senderId = newMessage.sender?._id ? newMessage.sender._id.toString() : newMessage.sender?.toString();
        if (senderId !== currentUser._id.toString()) {
          socket.emit('mark_read', { chatId, messageIds: [newMessage._id] });
        }

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    // User Typing
    const handleUserTyping = ({ chatId: eventChatId, user }) => {
      if (eventChatId === chatId && user._id !== currentUser._id) {
        setIsTyping(true);
        setTypingUser(user.displayName);
      }
    };

    const handleUserStopTyping = ({ chatId: eventChatId, user }) => {
      if (eventChatId === chatId && user._id !== currentUser._id) {
        setIsTyping(false);
        setTypingUser('');
      }
    };

    // Messages Read Status
    const handleMessagesRead = ({ chatId: eventChatId, messageIds, userId: readerId }) => {
      if (eventChatId === chatId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (messageIds.includes(m._id)) {
              const alreadyRead = m.readBy?.some((r) => {
                const rId = r.user?._id ? r.user._id.toString() : r.user?.toString();
                return rId === readerId.toString();
              });
              if (!alreadyRead) {
                return {
                  ...m,
                  readBy: [...(m.readBy || []), { user: readerId, readAt: new Date() }],
                };
              }
            }
            return m;
          })
        );
      }
    };

    // Message Reaction Updated
    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    };

    // Online Status Update
    const handleUserStatus = ({ userId, isOnline, lastSeen }) => {
      if (recipientUser._id && recipientUser._id.toString() === userId.toString()) {
        setOtherUserStatus((prev) => ({ ...prev, isOnline, lastSeen }));
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('messages_read', handleMessagesRead);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('user_status', handleUserStatus);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('messages_read', handleMessagesRead);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('user_status', handleUserStatus);
    };
  }, [socket, chatId, currentUser._id, recipientUser._id]);

  // Emit typing status on text input change
  const handleInputChange = (text) => {
    setInputText(text);

    if (!socket || !chatId) return;

    socket.emit('typing', { chatId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { chatId });
    }, 1500);
  };

  // Send Text Message
  const handleSendText = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || !chatId || sending) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socket) socket.emit('stop_typing', { chatId });

    setInputText('');
    setSending(true);

    try {
      const res = await api.post('/messages', {
        chatId,
        text: textToSend,
        messageType: 'text',
      });

      const savedMessage = res?.data?.message || res?.message;

      if (savedMessage) {
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === savedMessage._id);
          if (exists) return prev;
          return [...prev, savedMessage];
        });
        sendMessageSocket(savedMessage);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err) {
      console.error('[Send Message Error]:', err.message);
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  // Pick Photo & Open Preview Confirmation Modal
  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert('Permission to access photos is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSelectedImageForSending(base64Image);
      }
    } catch (err) {
      console.error('[Pick Image Error]:', err?.response?.data || err.message);
      alert('Failed to pick photo. Please try again.');
    }
  };

  // Confirm & Send Photo to Chat
  const confirmSendImage = async () => {
    if (!selectedImageForSending || !chatId || sending) return;
    const imgToSend = selectedImageForSending;
    setSelectedImageForSending(null);

    try {
      setSending(true);
      const res = await api.post('/messages', {
        chatId,
        text: '',
        messageType: 'image',
        imageUrl: imgToSend,
      });

      const savedMessage = res?.data?.message || res?.message;

      if (savedMessage) {
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === savedMessage._id);
          if (exists) return prev;
          return [...prev, savedMessage];
        });
        sendMessageSocket(savedMessage);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err) {
      console.error('[Send Image Error]:', err?.response?.data || err.message);
      alert(err.response?.data?.message || err.message || 'Failed to send image.');
    } finally {
      setSending(false);
    }
  };

  // Handle Adding Reaction to Message
  const handleSelectReaction = async (emoji) => {
    if (!selectedMessageForReaction) return;
    const msgId = selectedMessageForReaction._id;
    setSelectedMessageForReaction(null);

    try {
      if (socket) {
        socket.emit('add_reaction', { messageId: msgId, chatId, emoji });
      }
      await api.post(`/messages/${msgId}/react`, { emoji });
    } catch (err) {
      console.error('[React Error]:', err.message);
    }
  };

  // Render individual message item
  const renderMessageItem = ({ item }) => {
    const senderId = item.sender?._id ? item.sender._id.toString() : item.sender?.toString();
    const isMe = senderId === currentUser._id.toString();

    const timestamp = formatChatTimestamp(item.createdAt);

    // Robust Read Receipt logic: check if any participant other than sender is in readBy array
    const isReadByOther =
      isMe &&
      item.readBy &&
      item.readBy.some((r) => {
        const readerId = r.user?._id ? r.user._id.toString() : r.user?.toString();
        return readerId && readerId !== currentUser._id.toString();
      });

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        <Pressable
          onLongPress={() => setSelectedMessageForReaction(item)}
          style={({ pressed }) => [
            styles.messageBubble,
            isMe
              ? [styles.myBubble, { backgroundColor: colors.myBubble }]
              : [styles.otherBubble, { backgroundColor: colors.otherBubble }],
            pressed && { opacity: 0.9 },
          ]}
        >
          {/* Sender Name in Group Chat */}
          {isGroup && !isMe ? (
            <Text style={[styles.senderName, { color: colors.primary }]}>
              {item.sender?.displayName || 'Member'}
            </Text>
          ) : null}

          {/* Message Content: Image or Text */}
          {item.messageType === 'image' && item.imageUrl ? (
            <TouchableOpacity onPress={() => setPreviewImage(item.imageUrl)}>
              <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, { color: isMe ? colors.myBubbleText : colors.otherBubbleText }]}>
              {item.text}
            </Text>
          )}

          {/* Reactions Row */}
          {item.reactions && item.reactions.length > 0 ? (
            <View style={styles.reactionsRow}>
              {item.reactions.map((r, idx) => (
                <Text key={idx} style={styles.reactionEmoji}>
                  {r.emoji}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Footer Row: Timestamp & Read Receipt Checkmark */}
          <View style={styles.messageFooterRow}>
            <Text
              style={[
                styles.messageTime,
                { color: isMe ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary },
              ]}
            >
              {timestamp}
            </Text>
            {isMe ? (
              <Text style={[styles.readCheckmark, { color: isReadByOther ? '#60A5FA' : 'rgba(255,255,255,0.7)' }]}>
                {isReadByOther ? ' ✓✓' : ' ✓'}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: safeTopPadding }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={isGroup}
          onPress={() => navigation.navigate('Profile', { userId: recipientUser._id })}
          style={styles.headerTitleContainer}
        >
          <Avatar
            uri={isGroup ? initialChat.groupAvatar : recipientUser.avatar}
            name={isGroup ? initialChat.groupName : recipientUser.displayName}
            size={42}
            isOnline={recipientUser.isOnline}
            showOnlineBadge={!isGroup}
          />
          <View style={styles.headerTextDetails}>
            <Text style={[styles.headerDisplayName, { color: colors.text }]} numberOfLines={1}>
              {isGroup ? initialChat.groupName || 'Group Chat' : recipientUser.displayName}
            </Text>

            {/* Online Status / Member Count Subtitle */}
            {isGroup ? (
              <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>
                {initialChat.participants?.length || 0} members
              </Text>
            ) : (
              <Text style={[styles.headerStatus, { color: recipientUser.isOnline ? '#10B981' : colors.textSecondary }]}>
                {recipientUser.isOnline ? 'Online' : 'Offline'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Messages Area */}
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
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={() => (
              <View style={styles.emptyMessagesContainer}>
                <Text style={[styles.emptyMessagesText, { color: colors.textSecondary }]}>
                  This is the start of your conversation with {isGroup ? initialChat.groupName : recipientUser.displayName}.
                </Text>
              </View>
            )}
          />
        )}

        {/* Animated Typing Indicator Bar */}
        {isTyping ? (
          <View style={[styles.typingBar, { backgroundColor: colors.surface }]}>
            <Text style={[styles.typingText, { color: colors.primary }]}>
              ✍️ {typingUser || 'Someone'} is typing...
            </Text>
          </View>
        ) : null}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {/* Photo Attachment Button */}
          <TouchableOpacity onPress={handlePickImage} style={styles.attachButton} disabled={sending}>
            <Text style={styles.attachIcon}>📷</Text>
          </TouchableOpacity>

          <TextInput
            placeholder="Write a message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text }]}
          />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSendText}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() && !sending ? colors.primary : colors.border },
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

      {/* Reaction Emoji Picker Modal */}
      <Modal
        visible={!!selectedMessageForReaction}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessageForReaction(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedMessageForReaction(null)}>
          <View style={[styles.reactionBarContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => handleSelectReaction(emoji)} style={styles.reactionBtn}>
                <Text style={styles.reactionBtnEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Image Send Confirmation Modal */}
      <Modal
        visible={!!selectedImageForSending}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedImageForSending(null)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={[styles.confirmModalContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.confirmModalTitle, { color: colors.text }]}>Send Photo?</Text>
            {selectedImageForSending ? (
              <Image source={{ uri: selectedImageForSending }} style={styles.confirmPreviewImage} resizeMode="contain" />
            ) : null}

            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                onPress={() => setSelectedImageForSending(null)}
                style={[styles.confirmCancelBtn, { backgroundColor: colors.surface }]}
                disabled={sending}
              >
                <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmSendImage}
                style={[styles.confirmSendBtn, { backgroundColor: colors.primary }]}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmSendText}>Send Photo ➔</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Screen Pinch & Double-Tap Zoomable Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.imagePreviewModal}>
          <TouchableOpacity onPress={() => setPreviewImage(null)} style={styles.closeImageBtn}>
            <Text style={styles.closeImageText}>✕ Close</Text>
          </TouchableOpacity>
          {previewImage ? (
            <ZoomableImage uri={previewImage} style={styles.fullPreviewImage} />
          ) : null}
        </View>
      </Modal>
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
  headerStatus: {
    fontSize: 12,
    marginTop: 1,
    fontWeight: '500',
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
    maxWidth: '80%',
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
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageImage: {
    width: 200,
    height: 180,
    borderRadius: 12,
    marginVertical: 4,
  },
  reactionsRow: {
    flexDirection: 'row',
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  messageFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    fontWeight: '500',
  },
  readCheckmark: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  typingBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  typingText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  attachIcon: {
    fontSize: 22,
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
    marginLeft: 8,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionBarContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 30,
    borderWidth: 1,
    elevation: 5,
  },
  reactionBtn: {
    paddingHorizontal: 10,
  },
  reactionBtnEmoji: {
    fontSize: 26,
  },
  imagePreviewModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  closeImageText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  fullPreviewImage: {
    width: '100%',
    height: '100%',
  },
  zoomScrollView: {
    flex: 1,
    width: '100%',
  },
  zoomScrollViewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalContainer: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  confirmPreviewImage: {
    width: '100%',
    height: 260,
    borderRadius: 14,
    marginBottom: 16,
  },
  confirmModalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginRight: 8,
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmSendBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginLeft: 8,
  },
  confirmSendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ChatScreen;
