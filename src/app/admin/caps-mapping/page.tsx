'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface CAPSTopic {
  id: string;
  grade: string;
  subject: string;
  topic_code: string;
  topic_title: string;
  content_outline: string;
  learning_outcomes: string[];
  term: number;
}

interface Textbook {
  id: string;
  title: string;
  publisher: string;
  grade: string;
  subject: string;
  page_count: number;
  isbn: string;
}

interface TextbookContent {
  id: string;
  textbook_id: string;
  title: string;
  chapter_number: number;
  content_type: string;
  page_start: number;
  page_end: number;
}

interface Mapping {
  id: string;
  caps_topic_id: string;
  textbook_content_id: string;
  coverage_percentage: number;
  is_primary_reference: boolean;
  alignment_score: number;
  key_pages: number[];
  status: string;
}

export default function CAPSMappingAdmin() {
  // Filter State
  const [selectedGrade, setSelectedGrade] = useState<string>('5');
  const [selectedSubject, setSelectedSubject] = useState<string>('Geography');
  
  // Data State
  const [capsTopics, setCapsTopics] = useState<CAPSTopic[]>([]);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [textbookContent, setTextbookContent] = useState<TextbookContent[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  
  // Selection State
  const [selectedTopic, setSelectedTopic] = useState<CAPSTopic | null>(null);
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [selectedContent, setSelectedContent] = useState<TextbookContent | null>(null);
  
  // Form State
  const [keyPages, setKeyPages] = useState<string>('');
  const [coveragePercentage, setCoveragePercentage] = useState<number>(100);
  const [alignmentScore, setAlignmentScore] = useState<number>(5);
  const [isPrimary, setIsPrimary] = useState<boolean>(true);
  const [verificationNotes, setVerificationNotes] = useState<string>('');
  
  // UI State
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  // Load CAPS Topics
  useEffect(() => {
    loadCAPSTopics();
  }, [selectedGrade, selectedSubject]);

  // Load Textbooks
  useEffect(() => {
    loadTextbooks();
  }, [selectedGrade, selectedSubject]);

  // Load Textbook Content when textbook selected
  useEffect(() => {
    if (selectedTextbook) {
      loadTextbookContent(selectedTextbook.id);
    }
  }, [selectedTextbook]);

  // Load existing mappings when topic selected
  useEffect(() => {
    if (selectedTopic) {
      loadMappings(selectedTopic.id);
    }
  }, [selectedTopic]);

  const loadCAPSTopics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('caps_topics')
      .select('*')
      .eq('grade', selectedGrade)
      .eq('subject', selectedSubject)
      .order('topic_code');

    if (data) setCapsTopics(data);
    if (error) console.error('Error loading CAPS topics:', error);
    setLoading(false);
  };

  const loadTextbooks = async () => {
    const { data, error } = await supabase
      .from('textbooks')
      .select('*')
      .eq('grade', selectedGrade)
      .eq('subject', selectedSubject)
      .eq('is_active', true)
      .order('publication_year', { ascending: false });

    if (data) setTextbooks(data);
    if (error) console.error('Error loading textbooks:', error);
  };

  const loadTextbookContent = async (textbookId: string) => {
    const { data, error } = await supabase
      .from('textbook_content')
      .select('*')
      .eq('textbook_id', textbookId)
      .order('page_start');

    if (data) setTextbookContent(data);
    if (error) console.error('Error loading textbook content:', error);
  };

  const loadMappings = async (topicId: string) => {
    const { data, error } = await supabase
      .from('caps_textbook_mapping')
      .select('*')
      .eq('caps_topic_id', topicId);

    if (data) setMappings(data);
    if (error) console.error('Error loading mappings:', error);
  };

  const createMapping = async () => {
    if (!selectedTopic || !selectedContent) {
      setMessage('Please select both a CAPS topic and textbook content');
      return;
    }

    setLoading(true);
    
    // Parse key pages
    const parsedPages = keyPages
      .split(',')
      .map(p => parseInt(p.trim()))
      .filter(p => !isNaN(p));

    const { data: user } = await supabase.auth.getUser();

    const mappingData = {
      caps_topic_id: selectedTopic.id,
      textbook_content_id: selectedContent.id,
      coverage_percentage: coveragePercentage,
      is_primary_reference: isPrimary,
      alignment_score: alignmentScore,
      key_pages: parsedPages,
      status: 'verified',
      verified_by: user.user?.id,
      verification_date: new Date().toISOString(),
      verification_notes: verificationNotes,
      created_by: user.user?.id
    };

    const { error } = await supabase
      .from('caps_textbook_mapping')
      .insert(mappingData);

    if (error) {
      setMessage(`Error creating mapping: ${error.message}`);
      console.error(error);
    } else {
      setMessage('✅ Mapping created successfully!');
      loadMappings(selectedTopic.id);
      
      // Reset form
      setKeyPages('');
      setVerificationNotes('');
      setSelectedContent(null);
    }

    setLoading(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">CAPS Textbook Page Mapping</h1>
      
      {/* Grade and Subject Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Grade</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full border rounded p-2"
            >
              {['4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full border rounded p-2"
            >
              {['Geography', 'History', 'Mathematics', 'English', 'Afrikaans', 'Life Sciences', 'Physical Sciences', 'Economics', 'Accounting'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* CAPS Topics Panel */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">CAPS Topics ({capsTopics.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {capsTopics.map(topic => (
              <div
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                className={`p-3 border rounded cursor-pointer hover:bg-blue-50 ${
                  selectedTopic?.id === topic.id ? 'bg-blue-100 border-blue-500' : ''
                }`}
              >
                <div className="font-medium text-sm">{topic.topic_code}</div>
                <div className="text-sm">{topic.topic_title}</div>
                <div className="text-xs text-gray-500">Term {topic.term}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Textbooks Panel */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Textbooks ({textbooks.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {textbooks.map(textbook => (
              <div
                key={textbook.id}
                onClick={() => setSelectedTextbook(textbook)}
                className={`p-3 border rounded cursor-pointer hover:bg-green-50 ${
                  selectedTextbook?.id === textbook.id ? 'bg-green-100 border-green-500' : ''
                }`}
              >
                <div className="font-medium text-sm">{textbook.title}</div>
                <div className="text-xs text-gray-500">{textbook.publisher}</div>
                <div className="text-xs text-gray-500">{textbook.page_count} pages</div>
              </div>
            ))}
          </div>
        </div>

        {/* Textbook Content Panel */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">
            Chapters/Sections {selectedTextbook && `(${textbookContent.length})`}
          </h2>
          {selectedTextbook ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {textbookContent.map(content => (
                <div
                  key={content.id}
                  onClick={() => setSelectedContent(content)}
                  className={`p-3 border rounded cursor-pointer hover:bg-purple-50 ${
                    selectedContent?.id === content.id ? 'bg-purple-100 border-purple-500' : ''
                  }`}
                >
                  <div className="font-medium text-sm">
                    Ch {content.chapter_number}: {content.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    Pages {content.page_start}-{content.page_end}
                  </div>
                  <div className="text-xs text-gray-400">{content.content_type}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Select a textbook first</p>
          )}
        </div>
      </div>

      {/* Mapping Form */}
      {selectedTopic && selectedContent && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Create Mapping</h2>
          
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <h3 className="font-medium text-green-700 mb-2">CAPS Topic:</h3>
              <p className="text-sm">{selectedTopic.topic_code} - {selectedTopic.topic_title}</p>
            </div>
            
            <div>
              <h3 className="font-medium text-purple-700 mb-2">Textbook Section:</h3>
              <p className="text-sm">
                {selectedTextbook?.title} - {selectedContent.title}
                <br />
                <span className="text-gray-500">Pages {selectedContent.page_start}-{selectedContent.page_end}</span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Key Pages (comma-separated, e.g., "74, 75, 76")
              </label>
              <input
                type="text"
                value={keyPages}
                onChange={(e) => setKeyPages(e.target.value)}
                placeholder="74, 75, 76, 78"
                className="w-full border rounded p-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Coverage % (1-100)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={coveragePercentage}
                  onChange={(e) => setCoveragePercentage(parseInt(e.target.value))}
                  className="w-full border rounded p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Alignment Score (1-5)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={alignmentScore}
                  onChange={(e) => setAlignmentScore(parseInt(e.target.value))}
                  className="w-full border rounded p-2"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">Primary Reference</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Verification Notes
              </label>
              <textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Notes about content alignment, teaching tips, etc."
                rows={3}
                className="w-full border rounded p-2"
              />
            </div>

            <button
              onClick={createMapping}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Mapping'}
            </button>

            {message && (
              <div className={`p-3 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Mappings */}
      {selectedTopic && mappings.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">
            Existing Mappings for {selectedTopic.topic_title} ({mappings.length})
          </h2>
          
          <div className="space-y-2">
            {mappings.map(mapping => (
              <div key={mapping.id} className="border p-3 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">Content ID: {mapping.textbook_content_id.substring(0, 8)}...</div>
                    <div className="text-sm text-gray-600">
                      Key Pages: {mapping.key_pages.join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      mapping.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-gray-100'
                    }`}>
                      {mapping.status}
                    </span>
                    <div className="text-sm mt-1">
                      {mapping.alignment_score}/5 ⭐ | {mapping.coverage_percentage}% coverage
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
