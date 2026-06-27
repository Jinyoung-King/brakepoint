import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useColors } from '../useColors';
import { darkColors } from '../theme';

type Item = { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap };

const ITEMS: Record<string, Item> = {
  Home: { label: '홈', icon: 'home-outline', activeIcon: 'home' },
  History: { label: '대시보드', icon: 'grid-outline', activeIcon: 'grid' },
  Settings: { label: '설정', icon: 'settings-outline', activeIcon: 'settings' },
};

// 하단 떠 있는 반투명 글라스 알약 탭바 (One UI 스타일). 누르면 화면만 전환.
export default function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isDark = c === darkColors;
  const glassBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)';
  const glassBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.08)';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 14 }]}>
      <View style={[styles.pill, { backgroundColor: glassBg, borderColor: glassBorder }]}>
        {state.routes.map((route, i) => {
          const item = ITEMS[route.name];
          if (!item) return null;
          const focused = state.index === i;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={6}
              style={[styles.item, focused && { backgroundColor: c.blue }]}
            >
              <Ionicons
                name={focused ? item.activeIcon : item.icon}
                size={20}
                color={focused ? '#fff' : c.textMuted}
              />
              <Text style={[styles.label, { color: focused ? '#fff' : c.textMuted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 30,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
