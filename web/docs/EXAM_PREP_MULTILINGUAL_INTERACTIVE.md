# CAPS Exam Preparation: Multilingual & Interactive System

## Overview

The CAPS Exam Preparation feature has been enhanced with:
1. **Multilingual Support**: Generate exam content in 5 South African languages
2. **Interactive Exams**: Practice tests with real-time feedback and scoring
3. **Language-aware AI**: Prompts dynamically adapt to selected language
4. **Seamless TTS Integration**: Voice output in the student's preferred language

---

## Features Implemented

### 1. Language Selector

**Location**: `web/src/components/dashboard/exam-prep/ExamPrepWidget.tsx`

**Supported Languages**:
- **en-ZA**: English (South Africa)
- **af-ZA**: Afrikaans
- **zu-ZA**: isiZulu
- **xh-ZA**: isiXhosa
- **nso-ZA**: Sepedi (Northern Sotho)

**UI Component**:
```tsx
<select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
  <option value="en-ZA">English (South Africa)</option>
  <option value="af-ZA">Afrikaans</option>
  <option value="zu-ZA">isiZulu</option>
  <option value="xh-ZA">isiXhosa</option>
  <option value="nso-ZA">Sepedi (Northern Sotho)</option>
</select>
```

**Language Code Alignment**:
- Matches `lib/voice/language.ts` for unified language management
- Compatible with Azure TTS voice mapping
- Syncs with i18n system (`lib/i18n.ts`)

---

### 2. Dynamic AI Prompts

**Changes**: All AI prompts now include language-specific instructions

**Before**:
```typescript
**IMPORTANT: Generate ALL content in English (en-ZA). Do NOT use isiZulu, Sepedi, Afrikaans or any other language unless specifically requested.**
```

**After**:
```typescript
const languageName = LANGUAGE_OPTIONS[selectedLanguage];
**IMPORTANT: Generate ALL content in ${languageName} (${selectedLanguage}). Use ONLY this language throughout the entire exam and memorandum. Do NOT switch languages unless the user explicitly requests it.**
```

**Applied to**:
- Practice Test prompts
- Revision Notes prompts
- Study Guide prompts
- Flashcards prompts

---

### 3. Interactive Exam System

#### a. Exam Parser (`web/src/lib/examParser.ts`)

**Purpose**: Convert AI-generated markdown exams into structured data

**Key Functions**:
- `parseExamMarkdown(markdown: string)`: Extracts questions, options, marks, and sections
- `gradeAnswer(question, answer)`: Validates student answers and provides feedback

**Supported Question Types**:
- **Multiple Choice**: Radio buttons (A, B, C, D)
- **Short Answer**: Text input
- **Essay**: Textarea (6 rows)
- **Numeric**: Number input

**Detection Logic**:
```typescript
// Multiple choice detection
if (questionText.toLowerCase().includes('choose') || 
    questionText.toLowerCase().includes('select') ||
    questionText.toLowerCase().includes('which')) {
  currentQuestion.type = 'multiple_choice';
}

// Essay detection
if (questionText.toLowerCase().includes('explain') ||
    questionText.toLowerCase().includes('describe') ||
    questionText.toLowerCase().includes('discuss')) {
  currentQuestion.type = 'essay';
}

// Numeric detection
if (questionText.toLowerCase().includes('calculate') ||
    questionText.toLowerCase().includes('solve')) {
  currentQuestion.type = 'numeric';
}
```

#### b. Interactive View (`web/src/components/dashboard/exam-prep/ExamInteractiveView.tsx`)

**Features**:
- ✅ Real-time answer tracking
- ✅ Progress indicator (e.g., "Answered: 5/20 questions")
- ✅ Submit button with validation
- ✅ Instant feedback with color-coded results
- ✅ Score display with percentage and emoji reactions
- ✅ Question-by-question feedback
- ✅ Marks awarded breakdown

**User Flow**:
1. Student sees parsed exam with interactive inputs
2. Answers questions (radio, textarea, or text input)
3. Progress tracked in real-time
4. Submits exam when ready
5. Instant feedback with score and detailed question feedback
6. Option to return to dashboard

**Scoring Logic**:
- **Multiple Choice**: Auto-graded (correct/incorrect)
- **Short Answer/Essay/Numeric**: Marked as "recorded" (requires teacher review in production)
- **Score Display**: 
  - 80-100%: 🌟 Outstanding!
  - 70-79%: ✨ Well done!
  - 50-69%: 👍 Good effort!
  - <50%: 💪 Keep practicing!

---

### 4. AskAIWidget Updates

**New Props**:
```typescript
interface AskAIWidgetProps {
  inline?: boolean;
  initialPrompt?: string;
  displayMessage?: string;
  fullscreen?: boolean;
  language?: string; // NEW: Language code (e.g., 'en-ZA')
  enableInteractive?: boolean; // NEW: Enable interactive exam parsing
}
```

**Integration Flow**:
```
ExamPrepWidget (selects language & exam type)
  ↓ onAskDashAI(prompt, display, language, enableInteractive)
Parent Dashboard handler
  ↓ Sets state: aiLanguage, aiInteractive
AskAIWidget receives:
  - language (passed to ai-proxy metadata)
  - enableInteractive (triggers exam parsing)
  ↓
AI Proxy responds with markdown content
  ↓
If enableInteractive && practice_test:
  parseExamMarkdown(content) → ParsedExam
  ↓
ExamInteractiveView renders
```

**AI Proxy Metadata**:
```typescript
metadata: {
  source: 'parent_dashboard',
  feature: 'exam_prep',
  language: language || 'en-ZA' // Sent to AI service
}
```

---

### 5. Page Integration

#### Parent Dashboard (`web/src/app/dashboard/parent/page.tsx`)

**State Management**:
```typescript
const [aiLanguage, setAiLanguage] = useState<string>('en-ZA');
const [aiInteractive, setAiInteractive] = useState(false);
```

**Handler**:
```typescript
const handleAskFromActivity = async (
  prompt: string,
  display: string,
  language?: string,
  enableInteractive?: boolean
) => {
  setAIPrompt(prompt);
  setAIDisplay(display);
  setAiLanguage(language || 'en-ZA');
  setAiInteractive(enableInteractive || false);
  setShowAskAI(true);
};
```

#### Exam Prep Landing Page (`web/src/app/exam-prep/page.tsx`)

**Same pattern as Parent Dashboard**, with guest mode enabled for free daily limit.

---

## Usage Guide

### For Parents

1. **Navigate to Parent Dashboard** or `/exam-prep` page
2. **Select exam parameters**:
   - Grade (R-12)
   - Subject (phase-specific)
   - **Language** (en-ZA, af-ZA, zu-ZA, xh-ZA, nso-ZA)
   - Resource type (Practice Test, Revision Notes, Study Guide, Flashcards)
3. **Click "Generate with Dash AI"**
4. **For Practice Tests**:
   - Interactive mode activates automatically
   - Answer questions directly in the interface
   - Submit for instant feedback and scoring
5. **For Other Types**:
   - Content displayed as formatted markdown

### For Developers

**Adding a New Language**:

1. Update `ExamPrepWidget.tsx`:
```typescript
const LANGUAGE_OPTIONS: Record<SouthAfricanLanguage, string> = {
  'en-ZA': 'English (South Africa)',
  'af-ZA': 'Afrikaans',
  'zu-ZA': 'isiZulu',
  'xh-ZA': 'isiXhosa',
  'nso-ZA': 'Sepedi (Northern Sotho)',
  'new-ZA': 'NewLanguage', // Add here
};
```

2. Update `lib/voice/language.ts`:
```typescript
export type SouthAfricanLanguage = 'en-ZA' | 'af-ZA' | 'zu-ZA' | 'xh-ZA' | 'nso-ZA' | 'new-ZA';
export const AZURE_VOICE_MAP: Record<SouthAfricanLanguage, { male: string; female: string }> = {
  // ...
  'new-ZA': { male: 'new-ZA-MaleNeural', female: 'new-ZA-FemaleNeural' },
};
```

3. Update i18n if needed (`lib/i18n.ts`)

**Adding a New Question Type**:

1. Update `ExamParser.ts`:
```typescript
export interface ExamQuestion {
  type: 'multiple_choice' | 'short_answer' | 'essay' | 'numeric' | 'new_type';
  // ...
}
```

2. Add detection logic in `parseExamMarkdown`

3. Add rendering logic in `ExamInteractiveView.tsx`:
```typescript
{question.type === 'new_type' && (
  <CustomInput
    value={answer}
    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
  />
)}
```

---

## Testing Checklist

### Language Selection
- [ ] All 5 languages selectable in dropdown
- [ ] Selected language passed correctly to AI prompt
- [ ] Language display name shown in AI modal header
- [ ] Language persisted across exam generations

### AI Content Generation
- [ ] English exams generate correctly
- [ ] Afrikaans exams use Afrikaans throughout
- [ ] isiZulu exams use isiZulu throughout
- [ ] isiXhosa exams use isiXhosa throughout
- [ ] Sepedi exams use Sepedi throughout
- [ ] No language mixing in single generation

### Interactive Exams
- [ ] Practice tests parse correctly
- [ ] Multiple choice questions render with radio buttons
- [ ] Short answer questions render with text input
- [ ] Essay questions render with textarea
- [ ] Progress indicator updates on answer
- [ ] Submit button disabled when no answers
- [ ] Scoring displays correctly
- [ ] Feedback shows for each question
- [ ] Marks allocated correctly

### Integration
- [ ] Parent dashboard ExamPrepWidget works
- [ ] `/exam-prep` page ExamPrepWidget works
- [ ] Guest mode daily limit enforced
- [ ] Authenticated unlimited generation works
- [ ] AskAI modal opens correctly
- [ ] Interactive exam displays in fullscreen modal
- [ ] Return to dashboard button works

### Cross-browser
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

---

## Future Enhancements

### Phase 1: Basic MVP (Complete)
- ✅ Language selector
- ✅ Dynamic prompts
- ✅ Interactive practice tests
- ✅ Basic question types (MCQ, short, essay, numeric)

### Phase 2: Advanced Grading
- [ ] AI-powered essay grading via separate API call
- [ ] Partial credit for numeric answers
- [ ] Rubric-based assessment
- [ ] Detailed feedback per answer

### Phase 3: Progress Tracking
- [ ] Save exam attempts to database
- [ ] Show history of exams taken
- [ ] Track improvement over time
- [ ] Generate performance reports

### Phase 4: TTS Integration
- [ ] Read questions aloud in selected language
- [ ] Voice commands for navigation
- [ ] Audio feedback for correct/incorrect answers
- [ ] Pronunciation assistance

### Phase 5: Advanced Features
- [ ] Timed exams with countdown
- [ ] Exam templates library
- [ ] Teacher-created custom exams
- [ ] Peer comparison (anonymized)
- [ ] Export exams to PDF

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      ExamPrepWidget                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Grade      │  │  Language    │  │   Exam Type  │         │
│  │   Selector   │  │  Selector    │  │   Selector   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
│                  onAskDashAI(prompt,                            │
│                              display,                            │
│                              language,                           │
│                              enableInteractive)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Parent Dashboard / Exam Prep Page                  │
│  handleAskFromActivity(prompt, display, language, interactive)  │
│  → Sets: aiPrompt, aiDisplay, aiLanguage, aiInteractive         │
│  → Opens modal with AskAIWidget                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       AskAIWidget                                │
│  Props: initialPrompt, displayMessage, language,                │
│         enableInteractive, fullscreen                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Invoke ai-proxy Edge Function with:                   │    │
│  │    - scope: 'parent'                                     │    │
│  │    - service_type: 'homework_help'                      │    │
│  │    - payload.metadata.language: language                │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ↓                                     │
│                     ┌──────────────┐                            │
│                     │ AI Response  │                            │
│                     │  (markdown)  │                            │
│                     └──────────────┘                            │
│                            │                                     │
│          ┌─────────────────┴─────────────────┐                 │
│          │ if enableInteractive:              │                 │
│          │   parseExamMarkdown(content)       │                 │
│          │      ↓                              │                 │
│          │ ┌────────────────────┐             │                 │
│          │ │   ParsedExam       │             │                 │
│          │ │   (structured)     │             │                 │
│          │ └────────────────────┘             │                 │
│          │      ↓                              │                 │
│          │ ExamInteractiveView                │                 │
│          │   - Answer tracking                │                 │
│          │   - Submit & scoring               │                 │
│          │   - Feedback display               │                 │
│          └────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Changed

### New Files
1. `web/src/lib/examParser.ts` - Exam markdown parser and grading logic
2. `web/src/components/dashboard/exam-prep/ExamInteractiveView.tsx` - Interactive exam UI
3. `web/docs/EXAM_PREP_MULTILINGUAL_INTERACTIVE.md` - This documentation

### Modified Files
1. `web/src/components/dashboard/exam-prep/ExamPrepWidget.tsx`
   - Added language selector
   - Updated prompts to use dynamic language
   - Added language & interactive mode to callback

2. `web/src/components/dashboard/AskAIWidget.tsx`
   - Added `language` and `enableInteractive` props
   - Parse exam markdown when interactive mode enabled
   - Display ExamInteractiveView for interactive exams

3. `web/src/app/dashboard/parent/page.tsx`
   - Added language and interactive state
   - Updated handler to accept new parameters
   - Pass to AskAIWidget

4. `web/src/app/exam-prep/page.tsx`
   - Same changes as parent dashboard

---

## Deployment Notes

### Environment Variables
No new environment variables required. Uses existing:
- `NEXT_PUBLIC_AI_PROXY_ENABLED=true`

### Database
No database migrations required for MVP. Future enhancements (Phase 3) will add:
- `exam_attempts` table
- `exam_answers` table
- `exam_feedback` table

### Performance Considerations
- Exam parsing is client-side (no backend load)
- Large exams (50+ questions) may take 1-2 seconds to parse
- Consider lazy loading for very long exams

### Accessibility
- All inputs are keyboard-navigable
- Screen reader compatible
- Color contrast meets WCAG AA standards
- Focus indicators present

---

## Support & Troubleshooting

### Known Issues
1. **Exam Parsing Fails**: AI-generated markdown must follow strict format. If parsing fails, exam displays as plain markdown fallback.
2. **Language Mixing**: Occasionally AI may mix languages despite instructions. Regenerate if this occurs.
3. **Essay Grading**: Currently manual review required. Phase 2 will add AI grading.

### Debug Mode
Enable in browser console:
```javascript
localStorage.setItem('DEBUG_EXAM_PARSER', 'true');
```

### Reporting Bugs
Include:
- Selected language
- Exam type
- Browser & version
- Console errors (if any)
- Generated prompt (if available)

---

## Credits

**Developed**: 2025-01-20  
**Aligns with**: WARP.md South African multilingual education standards  
**Dependencies**:
- TanStack Query v5 for data fetching
- Lucide React for icons
- React Markdown for content display
- Azure TTS for voice (future integration)

---

## Related Documentation
- `docs/governance/WARP.md` - Project standards
- `lib/voice/language.ts` - Voice language management
- `lib/i18n.ts` - UI internationalization
- `docs/COMPREHENSIVE_AUDIT_ROADMAP_OCT_2025.md` - Phase 0-7 roadmap
