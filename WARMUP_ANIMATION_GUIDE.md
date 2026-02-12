# Animated Warmup Status - Usage Guide

## Quick Start

The animated warmup status indicator automatically appears on the warmup pages whenever an inbox is in the "ramping" phase with warmup enabled.

### Where to Find It

**Location**: Pool Warmup and Network Warmup pages
- Path: `/warmup/pool` and `/warmup/network`
- Table Column: "Status" column
- Trigger: Only displays when warmup is enabled AND phase is "ramping"

## Visual Design

### Appearance

```
┌─────────────────────────────────────────┐
│                                         │
│    ⚡ warming up ● ● ●                 │
│                                         │
│   (with orange-to-amber gradient       │
│    and subtle glow effect)              │
│                                         │
└─────────────────────────────────────────┘
```

### Animation Sequence

**Word Rotation** (6 seconds per word):
```
Time    Display
0s      "warming up" ● ● ●        (Gradient color 1)
1s      "warming up" ● ● ●        (Gradient shifts)
2s      "warming up" ● ● ●        (Gradient halfway)
3s      "warming up" ● ● ●        (Gradient continues)
4s      "warming up" ● ● ●        (Gradient returns)
5s      "warming up" ● ● ●        (Gradient returns)
5.5s    "heating" ● ● ●           (Fade transition)
6s      "heating" ● ● ●           (New word)
6-11s   "heating" ● ● ●           (Gradient cycles again)
11.5s   "preparing" ● ● ●         (Next transition)
```

**Dot Pulsing** (continuous, 1.4s cycle):
```
Dot 1:      ●····●····●    (Start immediately)
Dot 2:      ··●····●····   (Delayed 0.2s)
Dot 3:      ····●····●·    (Delayed 0.4s)

Combined:   ●●●····●●●····●●●  (Staggered pulse effect)
```

### Size Variants

The component supports three size variants:

#### Small (sm) - Table/Compact Display
```
"warming up ● ● ●"   (text-xs, px-2.5 py-0.5)
```
**Used in**: Warmup status tables

#### Medium (md) - Default
```
"warming up ● ● ●"   (text-sm, px-3 py-1)
```
**Used in**: General UI, stat cards

#### Large (lg) - Prominent Display
```
"warming up ● ● ●"   (text-base, px-4 py-1.5)
```
**Used in**: Hero sections, banners

## Code Examples

### Basic Usage
```tsx
import { AnimatedWarmupStatus } from '@/components/warmup/animated-warmup-status';

export function MyComponent() {
  return (
    <div>
      <AnimatedWarmupStatus />
    </div>
  );
}
```

### With Size Customization
```tsx
<AnimatedWarmupStatus size="lg" />
<AnimatedWarmupStatus size="md" />
<AnimatedWarmupStatus size="sm" />
```

### With Custom Styling
```tsx
<AnimatedWarmupStatus
  size="md"
  className="my-custom-class"
/>
```

### Conditional Rendering (Current Usage)
```tsx
{ws?.enabled ? (
  ws.phase === 'ramping' ? (
    <AnimatedWarmupStatus size="sm" />
  ) : (
    <span className={`badge ${getPhaseColor(ws.phase)}`}>
      {ws.phase}
    </span>
  )
) : (
  <span className="badge disabled">Disabled</span>
)}
```

## Customization Examples

### Example 1: Add More Synonyms

**File**: `apps/web/src/components/warmup/animated-warmup-status.tsx`

**Before**:
```typescript
const WARMUP_SYNONYMS = [
  'warming up',
  'heating',
  'preparing',
  'ramping up',
  'getting ready',
  'building momentum',
  'igniting',
  'accelerating',
];
```

**After** (with more synonyms):
```typescript
const WARMUP_SYNONYMS = [
  'warming up',
  'heating',
  'preparing',
  'ramping up',
  'getting ready',
  'building momentum',
  'igniting',
  'accelerating',
  'firing up',
  'powering up',
  'energizing',
  'revving',
  'boosting',
  'scaling up',
];
```

### Example 2: Change Animation Speed

**Faster Animation** (3 seconds per word):
```typescript
const WORD_DURATION = 3000;  // 3 seconds instead of 6
```

**Slower Animation** (10 seconds per word):
```typescript
const WORD_DURATION = 10000;  // 10 seconds instead of 6
```

Also update the CSS animation duration to match:
```typescript
style={{
  // ...
  animation: 'gradient-shift 10s ease-in-out infinite',  // Match WORD_DURATION
  // ...
}}
```

### Example 3: Different Color Scheme

**Cool Blue Theme**:
```typescript
style={{
  backgroundImage: `linear-gradient(
    90deg,
    #0369a1,  // Sky blue
    #06b6d4,  // Cyan
    #0ea5e9,  // Light blue
    #06b6d4,  // Cyan
    #0369a1   // Sky blue
  )`,
  // ...
}}
```

Update the className colors too:
```typescript
className={cn(
  // ... other classes
  'bg-gradient-to-r from-sky-100 to-cyan-100',
  'dark:from-sky-500/20 dark:to-cyan-500/20',
  // ...
)}
```

And the glow effect:
```typescript
<div
  className="absolute inset-0 rounded-full blur-xl opacity-40"
  style={{
    background: 'linear-gradient(90deg, #0369a1, #06b6d4, #0ea5e9)',
    // ...
  }}
/>
```

### Example 4: Disable Gradient Animation

If you only want rotating words without gradient animation:
```typescript
style={{
  backgroundImage: `linear-gradient(
    90deg,
    #f97316,  // Single fixed orange color
    #fb923c
  )`,
  // Remove or comment out:
  // animation: 'gradient-shift 6s ease-in-out infinite',
  // backgroundSize: '200% 100%',
}}
```

### Example 5: Remove Pulsing Dots

If you want just the word without the dots:
```tsx
// Replace the dots span section with:
<span className="relative">
  {currentWord}
</span>
```

## Responsive Behavior

The component works seamlessly across all screen sizes:

- **Mobile (< 768px)**: Compact layout, uses `sm` size
- **Tablet (768px - 1024px)**: Standard layout, uses `md` size
- **Desktop (> 1024px)**: Full layout, uses `md` or `lg` size

No special responsive styling is needed - the component adapts automatically based on the `size` prop.

## Dark Mode Support

The component automatically adjusts colors for dark mode:

**Light Mode**:
- Background: Warm orange/amber gradient
- Text: Gradient text with warm tones
- Glow: Soft orange glow

**Dark Mode**:
- Background: Dark orange/amber with reduced opacity
- Text: Lighter gradient text
- Glow: Brighter orange glow (adjusted for dark background)

### Manual Dark Mode Override

If you need to force a specific mode:
```tsx
<div className="dark">
  <AnimatedWarmupStatus />
</div>
```

## Performance Tips

### 1. Memoization
If the component is used in a heavy list, consider memoizing:
```tsx
import { memo } from 'react';

export const MemoizedAnimatedWarmupStatus = memo(AnimatedWarmupStatus);
```

### 2. Lazy Loading
For pages with many animated elements:
```tsx
import { lazy, Suspense } from 'react';

const AnimatedWarmupStatus = lazy(
  () => import('./animated-warmup-status').then(m => ({
    default: m.AnimatedWarmupStatus
  }))
);

// Usage:
<Suspense fallback={<div>Loading...</div>}>
  <AnimatedWarmupStatus />
</Suspense>
```

### 3. Conditional Animation
Pause animation if component is not visible:
```tsx
import { useInView } from 'react-intersection-observer';

export function ConditionalAnimatedWarmupStatus() {
  const { ref, inView } = useInView();

  // In component:
  <div ref={ref}>
    {inView && <AnimatedWarmupStatus />}
  </div>
}
```

## Troubleshooting

### Issue: Text Not Showing Gradient
**Solution**: Ensure `background-clip: text` and `WebkitBackgroundClip: text` are both set

### Issue: Dots Not Pulsing
**Solution**: Verify CSS animation is properly scoped with `<style jsx>`

### Issue: Animation Stuttering
**Solution**: Check browser GPU acceleration is enabled, reduce page complexity

### Issue: Colors Not Working in Dark Mode
**Solution**: Verify dark: prefixes are in className and style properties

## Accessibility Considerations

The component is accessibility-friendly:

✅ **Good Contrast**: Works in both light and dark modes
✅ **No Seizure Risk**: Smooth, gradual animations
✅ **Readable**: Text is clearly visible and distinguishable
✅ **Semantic**: Uses meaningful text content

### Potential Enhancement
Add `prefers-reduced-motion` support:
```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

useEffect(() => {
  if (prefersReducedMotion) {
    // Disable animations
    return;
  }
  // Regular animation code
}, []);
```

## Testing Checklist

- [ ] Visual appears in warmup table when inbox is ramping
- [ ] Word changes every 6 seconds
- [ ] Gradient animates smoothly
- [ ] Dots pulse in sequence
- [ ] Works in light mode
- [ ] Works in dark mode
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] Animation smooth on low-end devices
- [ ] Proper cleanup when component unmounts

## Browser Support Matrix

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome | ✅ Supported | Latest versions |
| Firefox | ✅ Supported | Latest versions |
| Safari | ✅ Supported | 12+ required |
| Edge | ✅ Supported | Chromium-based |
| Mobile Safari | ✅ Supported | iOS 12+ |
| Chrome Mobile | ✅ Supported | Latest versions |

## FAQ

**Q: Can I disable the animation?**
A: Yes, set `WORD_DURATION` to a very high number or remove the useEffect interval.

**Q: How do I change the colors?**
A: Edit the gradient colors in the `backgroundImage` property.

**Q: Can I add more words?**
A: Yes, add them to the `WARMUP_SYNONYMS` array.

**Q: Does this affect performance?**
A: Minimal impact - uses GPU-accelerated CSS animations.

**Q: Can I use this component elsewhere?**
A: Yes, it's fully self-contained and reusable anywhere in the app.

**Q: How do I make it smaller/larger?**
A: Use the `size` prop: `<AnimatedWarmupStatus size="sm" />`
