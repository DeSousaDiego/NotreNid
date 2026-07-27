import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Écran de démarrage — Phase 1 (Fondation).
 *
 * Prouve que l'app Expo Router + TypeScript strict démarre correctement.
 * Le thème visuel (tokens de couleur, typographie), la navigation à cinq
 * destinations et les écrans réels sont construits en Phase 3, en suivant
 * la direction artistique de docs/NOTRE_NID_PRD.md (section 4).
 */
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Notre Nid</Text>
        <Text style={styles.subtitle}>Bienvenue dans votre nid.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E8',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#355A3A',
  },
  subtitle: {
    fontSize: 16,
    color: '#687269',
  },
});
