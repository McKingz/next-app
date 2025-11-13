/**
 * CAPS Document Card Component
 * 
 * Displays a single CAPS curriculum document with metadata and actions
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CAPSDocument {
  id: string;
  title: string;
  grade: string;
  subject: string;
  file_url?: string;
  document_type?: string;
  relevance_score?: number;
  page_hint?: number; // optional page citation
}

interface CAPSDocumentCardProps {
  document: CAPSDocument;
  onPress?: () => void;
}

export default function CAPSDocumentCard({ document, onPress }: CAPSDocumentCardProps) {
  const handleOpen = () => {
    if (document.file_url) {
      Linking.openURL(document.file_url).catch(err =>
        console.error('Failed to open CAPS document:', err)
      );
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress || handleOpen}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Ionicons name="document-text" size={24} color="#4F46E5" />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
            {document.title}
          </Text>
          <Text style={styles.metadata}>
            {document.subject} • Grade {document.grade}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.tags}>
          {document.document_type && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{document.document_type}</Text>
            </View>
          )}
          {typeof document.page_hint === 'number' && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>p. {document.page_hint}</Text>
            </View>
          )}
        </View>
        
        {document.file_url && (
          <TouchableOpacity style={styles.openButton} onPress={handleOpen}>
            <Text style={styles.openButtonText}>Open</Text>
            <Ionicons name="open-outline" size={16} color="#4F46E5" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
    lineHeight: 22,
  },
  metadata: {
    fontSize: 14,
    color: '#64748B',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  tags: {
    flexDirection: 'row',
    flex: 1,
  },
  tag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
  },
  openButtonText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
    marginRight: 4,
  },
});
