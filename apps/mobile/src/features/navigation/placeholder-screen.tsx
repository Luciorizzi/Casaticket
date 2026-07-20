import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MobilePlaceholderLink } from '@casaticket/ui';

interface PlaceholderScreenProps {
  badge: string;
  title: string;
  subtitle: string;
  links: MobilePlaceholderLink[];
}

export function PlaceholderScreen({ badge, title, subtitle, links }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f1e7' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <View
            style={{
              borderRadius: 12,
              backgroundColor: '#fffaf1',
              padding: 24,
              shadowColor: '#1f1b16',
              shadowOpacity: 0.08,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <Text
              style={{
                color: '#6f7d57',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              {badge}
            </Text>
            <Text
              style={{
                marginTop: 16,
                color: '#171411',
                fontSize: 34,
                fontWeight: '700',
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                marginTop: 12,
                color: '#475467',
                fontSize: 16,
                lineHeight: 24,
              }}
            >
              {subtitle}
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {links.map((link) => (
              <Link key={link.href} asChild href={link.href as Href}>
                <Pressable
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#d6c8b1',
                    backgroundColor: '#fff',
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                  }}
                >
                  <Text
                    style={{
                      color: '#171411',
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                  >
                    {link.label}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
