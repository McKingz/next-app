import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';
import type { FABPosition, Position } from '@/lib/fab-position';
import { clampPosition, loadSavedPosition, savePosition } from '@/lib/fab-position';

/**
 * useFABDragGesture
 * - Manages PanResponder, position clamping, and persistence for FAB
 */
export function useFABDragGesture(initialPosition: FABPosition | Position = 'bottom-right') {
  const pan = useRef(new Animated.ValueXY()).current;
  const isDraggingRef = useRef(false);

  // Load saved position or use provided initial
  useEffect(() => {
    (async () => {
      let start: Position;
      if (typeof initialPosition === 'string') {
        start = await loadSavedPosition(initialPosition);
      } else {
        const clamped = clampPosition(initialPosition.x, initialPosition.y);
        start = clamped;
      }
      pan.setValue(start);
    })();
  }, []);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        isDraggingRef.current = false;
        // @ts-ignore private RN value access is acceptable here
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 15 || Math.abs(g.dy) > 15) {
          isDraggingRef.current = true;
        }
        // @ts-ignore
        const ox = pan.x._offset || 0;
        // @ts-ignore
        const oy = pan.y._offset || 0;
        const targetX = ox + g.dx;
        const targetY = oy + g.dy;
        const clamped = clampPosition(targetX, targetY);
        // @ts-ignore
        pan.x.setValue(clamped.x - ox);
        // @ts-ignore
        pan.y.setValue(clamped.y - oy);
      },
      onPanResponderRelease: (_, g) => {
        pan.flattenOffset();
        // @ts-ignore
        const currentX = pan.x._value || 0;
        // @ts-ignore
        const currentY = pan.y._value || 0;
        const clamped = clampPosition(currentX, currentY);
        if (clamped.x !== currentX || clamped.y !== currentY) {
          Animated.spring(pan, {
            toValue: { x: clamped.x, y: clamped.y },
            useNativeDriver: false,
            friction: 7,
            tension: 40,
          }).start();
        }
        void savePosition(clamped.x, clamped.y);
        // Treat as tap if barely moved
        const treatedAsTap = Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10 && !isDraggingRef.current;
        isDraggingRef.current = false;
        return treatedAsTap;
      },
    }),
    []
  );

  return { pan, panHandlers: panResponder.panHandlers, isDraggingRef };
}
