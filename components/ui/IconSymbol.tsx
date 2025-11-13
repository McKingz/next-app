export type IconSymbolName =
  | 'brain'
  | 'cpu'
  | 'sparkles'
  | 'arrow.right'
  | 'play.fill'
  | 'xmark'
  | 'chevron.up'
  | 'chevron.down'
  | 'building.2.fill'
  | 'bolt'
  | string;

import React from 'react';
import { Text, TextStyle } from 'react-native';

const MAP: Record<string, string> = {
  brain: '🧠',
  cpu: '💾',
  sparkles: '✨',
  'arrow.right': '➡️',
  'play.fill': '▶️',
  xmark: '✖️',
  'chevron.up': '▲',
  'chevron.down': '▼',
  'building.2.fill': '🏫',
  bolt: '⚡',
};

export function IconSymbol({ name, size = 24, color = '#000000' }: { name: IconSymbolName; size?: number; color?: string }) {
  const glyph = MAP[name] ?? '⬤';
  const style: TextStyle = { fontSize: size, color };
  return <Text accessibilityLabel={name} style={style}>{glyph}</Text>;
}

