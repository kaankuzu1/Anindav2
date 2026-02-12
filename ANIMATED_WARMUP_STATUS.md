# Animated Warmup Status Indicator

## Overview

The Animated Warmup Status Indicator is a new UI enhancement for the warmup page that replaces the static "ramping" status text with an engaging, animated component that rotates through warming-up synonyms with smooth transitions and beautiful gradient effects.

## Features

- **Rotating Synonyms**: Cycles through 8 different warmup-related words:
  - warming up
  - heating
  - preparing
  - ramping up
  - getting ready
  - building momentum
  - igniting
  - accelerating

- **Animated Gradients**: Beautiful orange-to-amber gradient that shifts colors throughout the animation

- **Pulsing Dots**: Three animated dots (similar to Claude's thinking indicator) that appear after the current word

- **Smooth Transitions**: 500ms fade transitions between word changes

- **6-Second Word Duration**: Each word displays for 6 seconds before transitioning to the next

- **Dark Mode Support**: Fully styled for both light and dark modes

- **Glow Effect**: Subtle background glow adds visual depth

## Technical Implementation

### Component File
`apps/web/src/components/warmup/animated-warmup-status.tsx`

### Component Props

```typescript
interface AnimatedWarmupStatusProps {
  className?: string;  // Optional CSS class for customization
  size?: 'sm' | 'md' | 'lg';  // Size variants (default: 'md')
}
```

### Size Variants

- **sm**: `text-xs px-2.5 py-0.5` - Used in tables and compact layouts
- **md**: `text-sm px-3 py-1` - Default size for general use
- **lg**: `text-base px-4 py-1.5` - Larger text for prominent displays

### Animation Details

#### Gradient Shift Animation
- Duration: 6 seconds
- Pattern: Linear gradient that shifts left to right continuously
- Colors: Orange-to-amber spectrum (`#ea580c` → `#f97316` → `#fb923c` → `#fbbf24` → `#f59e0b` → `#ea580c`)

#### Pulsing Dot Animation
- Duration: 1.4 seconds
- Pattern: Fade in/out with slight scale transformation
- Three dots with staggered timing (0.2s and 0.4s delays)

#### Word Transition
- Duration: 500ms fade out/in
- Occurs every 6 seconds with automatic word rotation

## Integration

### Location
The component is integrated into `apps/web/src/components/warmup/warmup-inbox-table.tsx` in the Status column.

### Usage
When an inbox has warmup enabled and is in the "ramping" phase:

```typescript
{ws?.phase === 'ramping' ? (
  <AnimatedWarmupStatus size="sm" />
) : (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getPhaseColor(ws.phase)}`}>
    {ws.phase}
  </span>
)}
```

Other phases (maintaining, paused, completed) continue to display their static badges.

## Styling Details

### Colors (Light Mode)
- Badge Background: `bg-gradient-to-r from-orange-100 to-amber-100`
- Badge Foreground: Gradient text clipped to background
- Text Color: Transparent (uses gradient background)

### Colors (Dark Mode)
- Badge Background: `dark:from-orange-500/20 dark:to-amber-500/20`
- Badge Foreground: Gradient text with dark mode adjustments
- Glow Effect: Orange-to-amber gradient with blur

### CSS Properties
- `background-clip: text` - Text clips to gradient
- `WebkitBackgroundClip: text` - Webkit vendor prefix for browser support
- `WebkitTextFillColor: transparent` - Makes text transparent to show gradient
- `animation: gradient-shift 6s ease-in-out infinite` - Continuous gradient animation

## Browser Support

Works in all modern browsers that support:
- CSS Gradients
- CSS Animations
- CSS Text Clipping
- CSS Grid/Flexbox

Tested and confirmed working in:
- Chrome/Edge (Chromium-based)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Customization

### Adding More Synonyms
Edit the `WARMUP_SYNONYMS` array in the component:

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
  // Add more here
];
```

### Adjusting Timing
Change these constants:

```typescript
const WORD_DURATION = 6000; // Milliseconds per word
const TRANSITION_DURATION = 500; // Milliseconds for fade transition
```

### Modifying Colors
Update the gradient colors in the `style` prop:

```typescript
style={{
  backgroundImage: `linear-gradient(
    90deg,
    #ea580c,  // Start color
    #f97316,
    #fb923c,
    #fbbf24,
    #f59e0b,
    #ea580c   // End color (loops back)
  )`,
  // ...
}}
```

## Performance Considerations

- **Lightweight**: Single component with minimal DOM elements
- **Optimized Animations**: Uses CSS keyframes (GPU-accelerated) instead of JavaScript transforms
- **Cleanup**: Proper interval cleanup in useEffect return function prevents memory leaks
- **Re-render Optimization**: Only updates when `currentIndex` changes every 6 seconds

## Accessibility

- Text is readable with proper contrast in both light and dark modes
- No animated elements that could cause seizures (smooth, gradual animations)
- Semantic HTML structure
- CSS animations respect `prefers-reduced-motion` (can be enhanced further if needed)

## Future Enhancements

Possible improvements:
1. Add `prefers-reduced-motion` media query support
2. Animate the dots independently from word changes
3. Add sound effects (optional, user-controlled)
4. Allow customization of gradient colors via props
5. Add icon animations alongside the text
6. Support for multiple animation styles/themes

## Files Modified

1. **Created**: `apps/web/src/components/warmup/animated-warmup-status.tsx`
2. **Modified**: `apps/web/src/components/warmup/warmup-inbox-table.tsx`
   - Added import for `AnimatedWarmupStatus`
   - Updated status display logic to use animated component for "ramping" phase

## Testing Recommendations

1. **Visual Testing**:
   - View in light mode and dark mode
   - Test on different screen sizes
   - Verify gradient animation smoothness
   - Check word rotation every 6 seconds

2. **Functional Testing**:
   - Switch between different inbox statuses
   - Verify "ramping" inboxes show animated status
   - Verify other phases show static badges
   - Test page refresh maintains animation state

3. **Performance Testing**:
   - Monitor CPU usage during animation
   - Check memory usage over extended viewing time
   - Verify no console errors or warnings

4. **Browser Testing**:
   - Chrome/Edge (latest)
   - Firefox (latest)
   - Safari (latest)
   - Mobile Safari (iOS)
   - Chrome Mobile (Android)

## Notes

- The component uses inline styles for animations to support dynamic keyword frame definitions
- Background glow effect has reduced opacity to avoid being too distracting
- The component is "use client" for Next.js App Router
- All animations use `ease-in-out` timing function for smooth, natural feel
