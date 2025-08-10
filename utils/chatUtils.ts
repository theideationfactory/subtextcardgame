// Chat utility functions for Subtext app

export const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - messageTime.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  
  // For older messages, show the date
  return messageTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

export const formatMessageTime = (timestamp: string): string => {
  const messageTime = new Date(timestamp);
  return messageTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatChatHeaderTime = (timestamp: string): string => {
  const messageTime = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return messageTime.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    return messageTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: messageTime.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
};

export const truncateMessage = (message: string, maxLength: number = 50): string => {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength - 3) + '...';
};

export const getMessagePreview = (message: string, messageType: string): string => {
  switch (messageType) {
    case 'card':
      return '📱 Shared a card';
    case 'spread':
      return '🃏 Shared a spread';
    case 'image':
      return '📷 Sent an image';
    case 'system':
      return message;
    default:
      return truncateMessage(message);
  }
};

export const generateConversationId = (user1Id: string, user2Id: string): string => {
  // Create consistent conversation ID regardless of user order
  const sortedIds = [user1Id, user2Id].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
};

export const isToday = (timestamp: string): boolean => {
  const messageDate = new Date(timestamp).toDateString();
  const today = new Date().toDateString();
  return messageDate === today;
};

export const isYesterday = (timestamp: string): boolean => {
  const messageDate = new Date(timestamp);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return messageDate.toDateString() === yesterday.toDateString();
};

export const shouldShowDateSeparator = (currentMessage: string, previousMessage?: string): boolean => {
  if (!previousMessage) return true;
  
  const currentDate = new Date(currentMessage).toDateString();
  const previousDate = new Date(previousMessage).toDateString();
  
  return currentDate !== previousDate;
};

export const getInitials = (email: string): string => {
  const parts = email.split('@')[0].split('.');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

export const getAvatarColor = (userId: string): string => {
  // Generate consistent color based on user ID
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};
