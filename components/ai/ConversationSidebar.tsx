/**
 * ConversationSidebar Component
 * 
 * Sidebar for managing conversations with search and quick actions.
 * Tier-aware: search is available for Basic (Starter) and above.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, type DimensionValue } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashConversation } from '@/services/dash-ai/types';
import { useCapability } from '@/hooks/useCapability';
import { UpgradePromptModal } from './UpgradePromptModal';

export interface ConversationSidebarProps {
  onSelectConversation: (conversationId: string) => void;
  onNewConversation?: () => void;
  width?: DimensionValue;
}

export function ConversationSidebar({ onSelectConversation, onNewConversation, width = 320 }: ConversationSidebarProps) {
  const { theme, isDark } = useTheme();
  const [conversations, setConversations] = useState<DashConversation[]>([]);
  const [search, setSearch] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { can, tier } = useCapability();

  const canSearch = can('memory.standard'); // Search for Basic and above

  useEffect(() => {
    (async () => {
      try {
        const module = await import('@/services/dash-ai/DashAICompat');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (!dash) return;
        try { await dash.initialize(); } catch {}
        const list = await dash.getAllConversations();
        setConversations(list);
        const current = dash.getCurrentConversationId();
        if (current) setSelectedId(current);
      } catch {}
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim() || !canSearch) return conversations;
    const s = search.toLowerCase();
    return conversations.filter((c) =>
      (c.title || '').toLowerCase().includes(s) ||
      (c.summary || '').toLowerCase().includes(s)
    );
  }, [conversations, search, canSearch]);

  const handleSearchChange = (text: string) => {
    if (!canSearch) {
      setShowUpgrade(true);
      return;
    }
    setSearch(text);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectConversation?.(id);
  };

  const renderItem = ({ item }: { item: DashConversation }) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => handleSelect(item.id)}
      style={[styles.item, selectedId === item.id && { backgroundColor: isDark ? '#1f2937' : '#e5e7eb' }]}
    >
      <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
        {item.title || 'Conversation'}
      </Text>
      <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
        {new Date(item.updated_at).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { width, backgroundColor: isDark ? '#0b0f14' : '#f9fafb', borderColor: theme.border }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: theme.border }]}> 
        <Text style={[styles.headerTitle, { color: theme.text }]}>Conversations</Text>
        <TouchableOpacity style={[styles.newButton, { backgroundColor: theme.primary }]} onPress={onNewConversation}>
          <Text style={styles.newButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={handleSearchChange}
          placeholder={canSearch ? 'Search conversations' : 'Upgrade for search'}
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, {
            backgroundColor: isDark ? '#111827' : '#fff',
            color: theme.text,
            borderColor: theme.border,
          }]}
        />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      {/* Upgrade Prompt */}
      <UpgradePromptModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        currentTier={tier}
        requiredTier={'starter'}
        capability={'memory.standard'}
        featureName={'Conversation Search'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRightWidth: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  newButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchRow: {
    padding: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  list: {
    padding: 8,
    gap: 6,
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
