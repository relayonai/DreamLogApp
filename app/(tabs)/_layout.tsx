import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';

function HomeIcon({ color }: { color: string }) {
  return (
    <View style={iconStyles.container}>
      <View style={[iconStyles.homeRoof, { borderBottomColor: color }]} />
      <View style={[iconStyles.homeBody, { borderColor: color }]} />
    </View>
  );
}

function LibraryIcon({ color }: { color: string }) {
  return (
    <View style={iconStyles.container}>
      <View style={iconStyles.gridRow}>
        <View style={[iconStyles.gridCell, { borderColor: color }]} />
        <View style={[iconStyles.gridCell, { borderColor: color }]} />
      </View>
      <View style={iconStyles.gridRow}>
        <View style={[iconStyles.gridCell, { borderColor: color }]} />
        <View style={[iconStyles.gridCell, { borderColor: color }]} />
      </View>
    </View>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <View style={iconStyles.container}>
      <View style={[iconStyles.settingsLine, { backgroundColor: color }]}>
        <View style={[iconStyles.settingsDot, { borderColor: color, left: 2 }]} />
      </View>
      <View style={[iconStyles.settingsLine, { backgroundColor: color }]}>
        <View style={[iconStyles.settingsDot, { borderColor: color, right: 2, left: undefined }]} />
      </View>
      <View style={[iconStyles.settingsLine, { backgroundColor: color }]}>
        <View style={[iconStyles.settingsDot, { borderColor: color, left: 8 }]} />
      </View>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  container: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  homeRoof: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginBottom: -1 },
  homeBody: { width: 14, height: 10, borderWidth: 1.5, borderTopWidth: 0, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  gridRow: { flexDirection: 'row', gap: 3 },
  gridCell: { width: 8, height: 8, borderWidth: 1.5, borderRadius: 2, marginBottom: 3 },
  settingsLine: { width: 18, height: 1.5, borderRadius: 1, marginBottom: 5, position: 'relative' },
  settingsDot: { position: 'absolute', width: 5, height: 5, borderRadius: 3, borderWidth: 1.5, top: -2, backgroundColor: '#0d0d1a' },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0d0d1a',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 64 : 88,
          paddingBottom: Platform.OS === 'web' ? 10 : 30,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#8b7cf7',
        tabBarInactiveTintColor: '#444',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <LibraryIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
