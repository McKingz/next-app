import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ParentJoinService, type SearchedStudent } from '@/lib/services/parentJoinService';
import { useQueryClient } from '@tanstack/react-query';

type Step = 'search' | 'confirm';

export default function ParentClaimChildScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedStudent[]>([]);
  const [selectedChild, setSelectedChild] = useState<SearchedStudent | null>(null);
  const [relationship, setRelationship] = useState<'mother' | 'father' | 'guardian' | 'other'>('mother');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get preschool ID
  const preschoolId = profile?.organization_id || profile?.preschool_id;
  // Search for child
  const handleSearch = async (query?: string) => {
    const searchText = query !== undefined ? query : searchQuery;
    
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    if (!preschoolId) {
      Alert.alert(
        'School not linked',
        "Your account isn't linked to a school yet. Use your invite link to join your school, or contact the school to send a new invite."
      );
      return;
    }

    setSearching(true);
    try {
      const results = await ParentJoinService.searchChild(preschoolId, searchText.trim());
      setSearchResults(results);
      
      // Only show alert when manually triggered, not for live search
      if (results.length === 0 && query === undefined) {
        Alert.alert(
          'No Results',
          `No children found matching "${searchText}". Please check the spelling or try registering a new child.`,
          [
            { text: 'Try Again', style: 'cancel' },
            { text: 'Register New Child', onPress: () => router.push('/screens/parent-child-registration') }
          ]
        );
      }
    } catch (error: any) {
      console.error('Search error:', error);
      // Only show alert for manual search
      if (query === undefined) {
        Alert.alert('Error', error.message || 'Failed to search for child');
      }
    } finally {
      setSearching(false);
    }
  };

  // Live search effect with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if query is empty
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // Set new timeout for debounced search (500ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    // Cleanup on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, preschoolId]);

  // Select child and go to confirmation
  const handleSelectChild = (child: SearchedStudent) => {
    setSelectedChild(child);
    setStep('confirm');
  };

  // Submit claim request
  const handleSubmit = async () => {
    if (!selectedChild || !user) {
      return;
    }

    setSubmitting(true);
    try {
      await ParentJoinService.requestLink({
        schoolId: selectedChild.preschool_id || preschoolId || null,
        parentAuthId: user.id,
        parentEmail: user.email || null,
        studentId: selectedChild.id,
        childFullName: `${selectedChild.first_name} ${selectedChild.last_name}`,
        childClass: selectedChild.age_group?.name || null,
        relationship,
      });

      // Refresh pending requests on dashboard
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['guardian-requests', user.id] });
      }

      Alert.alert(
        'Request Submitted!',
        `Your request to link ${selectedChild.first_name} has been sent to the school for approval. You'll be notified when it's reviewed.`,
        [
          { text: 'OK', onPress: () => router.back() }
        ]
      );
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : '';
      const friendly = msg.includes('pending request')
        ? 'You already have a pending request for this child.'
        : (msg || 'Failed to submit request');
      Alert.alert('Error', friendly);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate age from date of birth
  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Render search step
  const renderSearchStep = () => (
    <>
      {!preschoolId && (
        <View style={[styles.helpCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="school" size={24} color={theme.primary} />
          <View style={styles.helpContent}>
            <Text style={[styles.helpTitle, { color: theme.text }]}>Link your school first</Text>
            <Text style={[styles.helpText, { color: theme.textSecondary }]}>
              Enter your school’s invitation code to link your account, then search for your child.
            </Text>
            <TouchableOpacity
              style={[styles.linkButton, { backgroundColor: theme.background }]}
              onPress={() => router.push('/screens/parent-join-by-code')}
            >
              <Text style={[styles.linkButtonText, { color: theme.primary }]}>Join School by Code</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Find Your Child</Text>
        <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
          Search by name to find your child in our system
        </Text>

        <View style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Enter child's name..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch()}
              autoCapitalize="words"
              returnKeyType="search"
            />
          </View>

          <TouchableOpacity
            style={[styles.searchButton, { backgroundColor: theme.primary }]}
            onPress={() => handleSearch()}
            disabled={searching || !searchQuery.trim()}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={[styles.resultsTitle, { color: theme.text }]}>
              {searchResults.length} {searchResults.length === 1 ? 'child' : 'children'} found
            </Text>
            {searchResults.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={[styles.resultItem, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => handleSelectChild(child)}
              >
                <View style={styles.resultContent}>
                  <Text style={[styles.childName, { color: theme.text }]}>
                    {child.first_name} {child.last_name}
                  </Text>
                  <View style={styles.childDetails}>
                    <Text style={[styles.childDetail, { color: theme.textSecondary }]}>
                      🎂 Age {calculateAge(child.date_of_birth)}
                    </Text>
                    {child.age_group && (
                      <Text style={[styles.childDetail, { color: theme.textSecondary }]}>
                        🎓 {child.age_group.name}
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.helpCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="information-circle" size={24} color={theme.primary} />
        <View style={styles.helpContent}>
          <Text style={[styles.helpTitle, { color: theme.text }]}>Can't find your child?</Text>
          <Text style={[styles.helpText, { color: theme.textSecondary }]}>
            If your child isn't enrolled yet, you can register them as a new student.
          </Text>
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: theme.background }]}
            onPress={() => router.push('/screens/parent-child-registration')}
          >
            <Text style={[styles.linkButtonText, { color: theme.primary }]}>Register New Child</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  // Render confirmation step
  const renderConfirmStep = () => {
    if (!selectedChild) return null;

    return (
      <>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Confirm Child Details</Text>
          
          <View style={styles.confirmDetails}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>📝 Child Name:</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {selectedChild.first_name} {selectedChild.last_name}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>🎂 Age:</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {calculateAge(selectedChild.date_of_birth)} years old
              </Text>
            </View>

            {selectedChild.age_group && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>🎓 Class:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedChild.age_group.name}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.warningBox, { backgroundColor: `${theme.primary}15`, borderColor: theme.primary }]}>
            <Ionicons name="alert-circle" size={20} color={theme.primary} />
            <Text style={[styles.warningText, { color: theme.text }]}>
              Your request will be sent to the school for verification before access is granted.
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Your Relationship *</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            How are you related to this child?
          </Text>

          <View style={styles.relationshipGrid}>
            {(['mother', 'father', 'guardian', 'other'] as const).map((rel) => (
              <TouchableOpacity
                key={rel}
                style={[
                  styles.relationshipButton,
                  { backgroundColor: theme.background, borderColor: theme.border },
                  relationship === rel && { borderColor: theme.primary, backgroundColor: `${theme.primary}15` }
                ]}
                onPress={() => setRelationship(rel)}
              >
                <Text style={[
                  styles.relationshipText,
                  { color: theme.textSecondary },
                  relationship === rel && { color: theme.primary, fontWeight: '600' }
                ]}>
                  {rel.charAt(0).toUpperCase() + rel.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setStep('search')}
            disabled={submitting}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
            <Text style={[styles.backButtonText, { color: theme.text }]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Submit Request</Text>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: step === 'search' ? 'Claim Your Child' : 'Confirm Details',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.primary,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'search' ? renderSearchStep() : renderConfirmStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a3442',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  searchContainer: {
    gap: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3442',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#fff',
  },
  searchButton: {
    backgroundColor: '#00f5ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#0b1220',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 24,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a3442',
  },
  resultContent: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  childDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  childDetail: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  helpCard: {
    flexDirection: 'row',
    backgroundColor: '#1a2332',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a3442',
    marginBottom: 16,
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1220',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00f5ff',
  },
  confirmDetails: {
    gap: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#00f5ff15',
    borderWidth: 1,
    borderColor: '#00f5ff',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  relationshipButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a3442',
  },
  relationshipText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a3442',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00f5ff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0b1220',
  },
});
