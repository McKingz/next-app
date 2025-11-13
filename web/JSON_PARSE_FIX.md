# JSON Parse Crash Fix

## ? Error

```
SyntaxError: Unexpected token 'E', "Error: Que"... is not valid JSON
    at JSON.parse (<anonymous>:null:null)
    at eval (src/components/dashboard/AskAIWidget.tsx:153:24)
```

**When it happened:** When AI tool execution returned a validation error.

---

## ?? Root Cause

**File:** `/workspace/web/src/components/dashboard/AskAIWidget.tsx`  
**Line:** 153

**The Problem:**

When the AI tool (e.g., `generate_caps_exam`) returned an error like:
```
"Error: Question missing clear action verb..."
```

The code blindly tried to parse it as JSON:
```typescript
JSON.parse("Error: Question missing...") // ? CRASH!
```

**Why it crashed:**
- The error string is NOT valid JSON
- `JSON.parse()` expects `{...}` or `[...]`
- Got plain text starting with "Error:"
- JavaScript threw `SyntaxError: Unexpected token 'E'`

---

## ? Solution

Added a **pre-flight check** before `JSON.parse()`:

### Before (Broken)
```typescript
// Line 152-154
results: typeof data.tool_results[0]?.content === 'string' 
  ? JSON.parse(data.tool_results[0]?.content || '{}')  // ? Crashes on error strings
  : data.tool_results[0]?.content
```

### After (Fixed)
```typescript
let toolResults;
const resultContent = data.tool_results[0]?.content;

// Try to parse as JSON, but handle error strings gracefully
if (typeof resultContent === 'string') {
  if (resultContent.startsWith('Error:') || resultContent.startsWith('{') === false) {
    // It's an error message, not JSON
    toolResults = { error: resultContent };
  } else {
    try {
      toolResults = JSON.parse(resultContent);
    } catch (e) {
      console.error('[DashAI] Failed to parse tool result as JSON:', e);
      toolResults = { error: resultContent };
    }
  }
} else {
  toolResults = resultContent;
}
```

---

## ??? Safety Checks Added

### Check 1: Starts with "Error:"
```typescript
if (resultContent.startsWith('Error:'))
```
If it's an error message, wrap it as an object instead of parsing.

### Check 2: Doesn't start with "{"
```typescript
if (resultContent.startsWith('{') === false)
```
If it doesn't look like JSON, don't try to parse.

### Check 3: Try/Catch
```typescript
try {
  toolResults = JSON.parse(resultContent);
} catch (e) {
  toolResults = { error: resultContent };
}
```
If parsing fails, wrap as error object.

---

## ?? Result

### Before (Crashes)
```
1. AI returns: "Error: Question missing verb"
2. Code tries: JSON.parse("Error: Question...")
3. Browser: ? SyntaxError crash
4. App: White screen / error boundary
```

### After (Graceful)
```
1. AI returns: "Error: Question missing verb"
2. Code checks: Starts with "Error:"? Yes
3. Code wraps: { error: "Error: Question missing verb" }
4. App: ? Displays error message to user
```

---

## ?? Testing

### Test 1: Error String
**Input:** `"Error: Missing required fields: totalMarks"`  
**Expected:** Wrapped as `{ error: "Error: ..." }`  
**Result:** ? No crash, error displays

### Test 2: Valid JSON
**Input:** `'{"success":true,"data":{...}}'`  
**Expected:** Parsed as JSON object  
**Result:** ? Parsed correctly

### Test 3: Invalid JSON
**Input:** `"Not JSON and not an error"`  
**Expected:** Wrapped as `{ error: "..." }`  
**Result:** ? No crash, wrapped safely

### Test 4: Already an Object
**Input:** `{ success: false, error: "..." }`  
**Expected:** Used as-is  
**Result:** ? No parsing needed

---

## ?? Error Types Handled

| Error Type | Example | Handling |
|------------|---------|----------|
| Validation error | `"Error: Question missing verb"` | ? Wrapped |
| Missing field error | `"Error: Missing totalMarks"` | ? Wrapped |
| Plain text | `"Something went wrong"` | ? Wrapped |
| Valid JSON | `'{"success":true}'` | ? Parsed |
| Already object | `{success:false}` | ? Used as-is |

---

## ?? Related Fixes

This fix complements other validation fixes:
1. **Auto-calculate totalMarks** - Reduces "Missing totalMarks" errors
2. **Added action verbs** - Reduces "missing verb" errors
3. **JSON parse safety** - Handles remaining errors gracefully

---

## ?? Summary

| Before | After |
|--------|-------|
| ? Crashes on error strings | ? Handles gracefully |
| ? No try/catch protection | ? Safe with try/catch |
| ? No pre-flight checks | ? Checks before parsing |
| ? User sees crash screen | ? User sees error message |

**Result:** App is now **crash-proof** when handling tool execution errors.

---

**Fixed:** 2025-11-02  
**Commit:** `aca7968 fix: Handle error strings in tool results without JSON.parse crash`  
**File:** `/workspace/web/src/components/dashboard/AskAIWidget.tsx`  
**Lines:** 143-176
