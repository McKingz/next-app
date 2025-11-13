# Quick Reference: Mobile-First CSS Utilities

## Common Patterns

### 1. Touch-Friendly Buttons
```tsx
// ❌ Before (inline styles)
<button style={{ height: 40, padding: '0 14px' }}>Click</button>

// ✅ After (design.css)
<button className="btn btnPrimary">Click</button>
// Auto becomes 44px on mobile!
```

### 2. Responsive Grids
```tsx
// ❌ Before
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>

// ✅ After
<div className="grid2">  
// Mobile: 2 cols, Tablet: 3 cols, Desktop: 4 cols
```

### 3. Flexbox Layouts
```tsx
// ❌ Before
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

// ✅ After
<div className="flex items-center gap-3">
```

### 4. Cards
```tsx
// ❌ Before
<div style={{ padding: 16, borderRadius: 12, background: '#121826' }}>

// ✅ After
<div className="card">
// Auto adjusts padding: 16px desktop, 12px mobile
```

### 5. Clickable Cards
```tsx
// ❌ Before
<div className="card" style={{ cursor: 'pointer' }}>

// ✅ After
<div className="card card-interactive">
// Hover effects + touch feedback included!
```

## Utility Class Cheat Sheet

### Layout
```css
.flex              /* display: flex */
.flex-col          /* flex-direction: column */
.grid              /* display: grid */
.grid-cols-2       /* 2 columns */
.items-center      /* align-items: center */
.justify-between   /* justify-content: space-between */
```

### Spacing
```css
.gap-2, .gap-3, .gap-4           /* gap (8px, 12px, 16px) */
.mb-2, .mb-3, .mb-4              /* margin-bottom */
.mt-2, .mt-3, .mt-4              /* margin-top */
.p-2, .p-3, .p-4                 /* padding */
```

### Typography
```css
.h2                /* 18px bold heading */
.h3                /* 16px bold heading */
.text-sm           /* 13px */
.text-xs           /* 11px */
.font-bold         /* 700 weight */
.font-semibold     /* 600 weight */
```

### Display
```css
.w-full            /* width: 100% */
.flex-1            /* flex: 1 */
.flex-shrink-0     /* flex-shrink: 0 */
.overflow-hidden   /* overflow: hidden */
.overflow-x-auto   /* horizontal scroll */
```

### Borders & Shadows
```css
.rounded           /* 8px radius */
.rounded-lg        /* 12px radius */
.rounded-full      /* pill shape */
.shadow-sm         /* small shadow */
.shadow-md         /* medium shadow */
.shadow-lg         /* large shadow */
```

### Colors
```css
.primary-bg        /* purple background */
.primary-border    /* purple border */
.success-bg        /* green background */
.warning-bg        /* orange background */
.danger-bg         /* red background */
```

## Mobile Breakpoints

```
< 640px   → Mobile phones
640-767px → Small tablets
768-1023px → Tablets
1024+px   → Desktops
```

## Responsive Grid Example

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
  {/* 1 col mobile, 2 cols small tablet, 3 cols desktop */}
</div>
```

## Touch Target Sizes

| Element | Mobile | Desktop |
|---------|--------|---------|
| Button | 44px | 40px |
| Icon Button | 44x44px | 36x36px |
| Bottom Nav Item | 52px | - |
| Collapsible Header | 56px | 56px |

## Quick Migration Guide

### Step 1: Replace common inline styles
```tsx
// Find
style={{ display: 'flex', alignItems: 'center' }}

// Replace with
className="flex items-center"
```

### Step 2: Use spacing utilities
```tsx
// Find
style={{ gap: 'var(--space-3)' }}

// Replace with
className="gap-3"
```

### Step 3: Apply grid classes
```tsx
// Find
style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}

// Replace with
className="grid grid-cols-2"
```

### Step 4: Use card classes
```tsx
// Find
<div className="card" style={{ cursor: 'pointer' }}>

// Replace with
<div className="card card-interactive">
```

## Performance Tips

1. ✅ **Prefer CSS classes** over inline styles (better caching)
2. ✅ **Use hardware-accelerated properties** (transform, opacity)
3. ✅ **Avoid inline style objects** (creates new object on each render)
4. ✅ **Use CSS transitions** over JS animations
5. ✅ **Leverage browser defaults** with utility classes

## Example: Complete Component

```tsx
// ❌ Before - Heavy inline styles
<div style={{ 
  display: 'flex', 
  flexDirection: 'column', 
  gap: 12,
  padding: 16
}}>
  <div style={{ 
    display: 'grid', 
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8
  }}>
    <div style={{ 
      padding: 16,
      borderRadius: 12,
      background: '#121826'
    }}>
      <div style={{ fontWeight: 700, fontSize: 18 }}>42</div>
      <div style={{ fontSize: 12, color: '#a0a8b5' }}>Students</div>
    </div>
  </div>
</div>

// ✅ After - Clean utility classes
<div className="flex flex-col gap-3 p-4">
  <div className="grid grid-cols-2 gap-2">
    <div className="card tile">
      <div className="metricValue">42</div>
      <div className="metricLabel">Students</div>
    </div>
  </div>
</div>
```

## Common Mistakes to Avoid

❌ **Don't mix systems**
```tsx
<div className="flex" style={{ display: 'grid' }}>  // Conflict!
```

❌ **Don't use arbitrary values**
```tsx
<div className="gap-5">  // Use gap-4 (16px) or gap-3 (12px)
```

❌ **Don't forget mobile**
```tsx
<button className="btn" style={{ height: 36 }}>  // Override breaks mobile!
```

✅ **Do use design tokens**
```tsx
<div className="flex gap-3 p-4">  // Consistent spacing
```

✅ **Do test on mobile**
```tsx
// Open DevTools → Toggle device toolbar → Test 375px width
```

✅ **Do leverage responsive classes**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3">  // Mobile-first!
```
