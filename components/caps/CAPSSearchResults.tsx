/**
 * CAPS Search Results Component
 * 
 * Displays a list of CAPS curriculum documents from search results
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import CAPSDocumentCard, { CAPSDocument } from './CAPSDocumentCard';

interface CAPSSearchResultsProps {
  query?: string;
  count: number;
  documents: CAPSDocument[];
  maxDisplay?: number;
}

export default function CAPSSearchResults({ 
  query, 
  count, 
  documents,
  maxDisplay = 5 
}: CAPSSearchResultsProps) {
  const displayedDocs = documents.slice(0, maxDisplay);
  const hasMore = documents.length > maxDisplay;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          📚 CAPS Curriculum Documents
        </Text>
        {query && (
          <Text style={styles.subtitle}>
            Search: "{query}" • {count} {count === 1 ? 'result' : 'results'}
          </Text>
        )}
      </View>

      <View style={styles.documentList}>
        {displayedDocs.map((doc) => (
          <CAPSDocumentCard key={doc.id} document={doc} />
        ))}
      </View>

      {hasMore && (
        <Text style={styles.moreText}>
          + {documents.length - maxDisplay} more document{documents.length - maxDisplay !== 1 ? 's' : ''} available
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  documentList: {
    gap: 8,
  },
  moreText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
