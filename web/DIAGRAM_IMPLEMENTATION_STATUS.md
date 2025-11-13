# Diagram Implementation Status

## ? Completed

### 1. Libraries Installed
```bash
? recharts - For charts (bar, line, pie, area)
? mermaid - For diagrams from text (flowcharts, sequence, etc.)
? react-svg-pan-zoom - For interactive SVG viewing
```

### 2. Schema Updated
? `ExamQuestion` interface now supports `diagram` field:
```typescript
diagram?: {
  type: 'chart' | 'mermaid' | 'svg' | 'image';
  data: any;
  title?: string;
  caption?: string;
}
```

---

## ?? Next Steps (TODO)

### Step 1: Create Diagram Component
**File:** `/workspace/web/src/components/dashboard/exam-prep/ExamDiagram.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import mermaid from 'mermaid';

interface ExamDiagramProps {
  diagram: {
    type: 'chart' | 'mermaid' | 'svg' | 'image';
    data: any;
    title?: string;
    caption?: string;
  };
}

export function ExamDiagram({ diagram }: ExamDiagramProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (diagram.type === 'mermaid' && mermaidRef.current) {
      mermaid.initialize({ startOnLoad: true, theme: 'default' });
      mermaid.contentLoaded();
    }
  }, [diagram]);

  return (
    <div className="examDiagram" style={{
      margin: '1rem 0',
      padding: '1rem',
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      background: '#f9fafb'
    }}>
      {diagram.title && (
        <div style={{ 
          fontWeight: 600, 
          marginBottom: '0.5rem',
          fontSize: '14px',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          {diagram.title}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {diagram.type === 'chart' && renderChart(diagram.data)}
        {diagram.type === 'mermaid' && (
          <div ref={mermaidRef} className="mermaid">
            {diagram.data}
          </div>
        )}
        {diagram.type === 'svg' && (
          <div dangerouslySetInnerHTML={{ __html: diagram.data }} />
        )}
        {diagram.type === 'image' && (
          <img 
            src={diagram.data} 
            alt={diagram.title || 'Exam diagram'}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
      </div>

      {diagram.caption && (
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          marginTop: '0.5rem',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          {diagram.caption}
        </div>
      )}
    </div>
  );
}

function renderChart(data: any) {
  const { chartType, data: chartData, xKey, yKey } = data;

  return (
    <ResponsiveContainer width="100%" height={300}>
      {chartType === 'bar' && (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey || 'name'} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={yKey || 'value'} fill="#7c3aed" />
        </BarChart>
      )}
      {chartType === 'line' && (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey || 'name'} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={yKey || 'value'} stroke="#7c3aed" />
        </LineChart>
      )}
      {chartType === 'pie' && (
        <PieChart>
          <Pie data={chartData} dataKey={yKey || 'value'} nameKey={xKey || 'name'} fill="#7c3aed" label />
          <Tooltip />
        </PieChart>
      )}
    </ResponsiveContainer>
  );
}
```

### Step 2: Update ExamInteractiveView
**File:** `/workspace/web/src/components/dashboard/exam-prep/ExamInteractiveView.tsx`

Add import:
```typescript
import { ExamDiagram } from './ExamDiagram';
```

In `renderQuestion`, after question text, add:
```typescript
{question.diagram && <ExamDiagram diagram={question.diagram} />}
```

### Step 3: Add generate_diagram Tool
**File:** `/workspace/supabase/functions/ai-proxy/index.ts`

Add to tools array (around line 300):
```typescript
{
  name: 'generate_diagram',
  description: 'Generate a diagram, chart, or visual aid for exam questions. Use when a question requires visual representation (charts, flowcharts, shapes, etc.). Returns diagram data that will be rendered in the question.',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['chart', 'mermaid', 'svg'],
        description: 'Type of diagram. chart=bar/line/pie charts, mermaid=flowcharts/diagrams, svg=custom SVG'
      },
      data: {
        type: 'object',
        description: 'Diagram-specific data',
        properties: {
          // For charts
          chartType: {
            type: 'string',
            enum: ['bar', 'line', 'pie'],
            description: 'Type of chart'
          },
          data: {
            type: 'array',
            description: 'Chart data points',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' }
              }
            }
          },
          xKey: { type: 'string', description: 'X-axis key (default: name)' },
          yKey: { type: 'string', description: 'Y-axis key (default: value)' },
          // For mermaid
          mermaidCode: { type: 'string', description: 'Mermaid diagram code' }
        }
      },
      title: {
        type: 'string',
        description: 'Diagram title'
      },
      caption: {
        type: 'string',
        description: 'Optional caption explaining the diagram'
      }
    },
    required: ['type', 'data']
  }
}
```

Add executor (around line 350):
```typescript
async function executeGenerateDiagramTool(
  input: any,
  context: ToolExecutionContext
): Promise<any> {
  console.log('[ai-proxy] Executing generate_diagram tool');
  
  const { type, data, title, caption } = input;
  
  return {
    success: true,
    diagram: {
      type,
      data: type === 'mermaid' ? data.mermaidCode : data,
      title,
      caption
    }
  };
}
```

Register in executeTool (around line 330):
```typescript
if (toolName === 'generate_diagram') {
  return await executeGenerateDiagramTool(toolInput, context)
}
```

### Step 4: Update AI Instructions
**File:** `/workspace/supabase/functions/ai-proxy/index.ts`

Update tool description (line ~214):
```typescript
description: `Generate a structured, CAPS-aligned examination paper for INTERACTIVE use.

CRITICAL RULES - Questions MUST:
1. Include ALL data inline as text OR use generate_diagram tool for visual aids
2. Use clear action verbs (Calculate, List, Identify, Rewrite, Complete, etc.)
3. For questions needing diagrams: Call generate_diagram FIRST, then reference it in the question

WHEN TO USE DIAGRAMS:
? Bar charts, line graphs, pie charts (data representation)
? Flowcharts, process diagrams (logic, sequences)
? Geometric shapes (math, geometry)
? Number lines (fractions, operations)
? Tables with visual data

EXAMPLES:
? "According to the bar chart, which month had the highest sales?"
  [Uses generate_diagram with chart data]
  
? "Based on the flowchart, what is the next step after testing?"
  [Uses generate_diagram with mermaid flowchart]

When generating exams, use diagrams to make questions clearer and more engaging.`
```

---

## ?? Example Usage

### Bar Chart Question
```typescript
{
  text: "According to the chart, which month had the most rainfall?",
  type: "multiple_choice",
  options: ["January", "February", "March", "April"],
  correctAnswer: "March",
  diagram: {
    type: "chart",
    data: {
      chartType: "bar",
      data: [
        { name: "Jan", value: 120 },
        { name: "Feb", value: 150 },
        { name: "Mar", value: 180 },
        { name: "Apr", value: 140 }
      ]
    },
    title: "Monthly Rainfall (mm)",
    caption: "Data collected at Cape Town weather station"
  }
}
```

### Mermaid Flowchart
```typescript
{
  text: "According to the flowchart, what happens if the test fails?",
  type: "short_answer",
  diagram: {
    type: "mermaid",
    data: `flowchart TD
      A[Start] --> B{Test?}
      B -->|Pass| C[Continue]
      B -->|Fail| D[Fix Error]
      D --> B`,
    title: "Software Testing Process"
  }
}
```

---

## ?? Testing

### Test 1: Chart Generation
```bash
Generate Grade 10 Math exam with:
"Create a question about interpreting bar chart data"
```

**Expected:** Question with embedded bar chart

### Test 2: Mermaid Diagram
```bash
Generate Grade 8 Tech exam with:
"Create a flowchart question about algorithms"
```

**Expected:** Question with flowchart diagram

### Test 3: Combined
```bash
Generate Grade 12 Math exam with mixed questions
```

**Expected:** Some with diagrams, some text-only

---

## ?? Implementation Checklist

- [x] Install libraries (recharts, mermaid, react-svg-pan-zoom)
- [x] Update exam schema with diagram field
- [x] Push changes to GitHub
- [ ] Create ExamDiagram component
- [ ] Update ExamInteractiveView to render diagrams
- [ ] Add generate_diagram tool to ai-proxy
- [ ] Update AI instructions for diagram generation
- [ ] Test with sample questions
- [ ] Deploy Edge Function changes

---

## ?? Next Steps for User

**Pull latest changes:**
```bash
cd /workspace
git pull origin cursor/fix-inconsistent-hook-order-in-parent-dashboard-265a
```

**Verify libraries:**
```bash
cd /workspace/web
npm list recharts mermaid react-svg-pan-zoom
```

**Continue implementation:**
I'll complete the remaining steps in the next interaction. The foundation is ready!

---

**Status:** ?? Libraries installed, schema updated, ready for component implementation
**Branch:** `cursor/fix-inconsistent-hook-order-in-parent-dashboard-265a`
**Commit:** `879dfc7 feat: Add diagram support to exam schema`
