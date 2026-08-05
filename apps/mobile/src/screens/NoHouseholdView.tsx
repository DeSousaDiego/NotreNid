import { EmptyState, ScreenContainer } from '../components';
import { useAuth } from '../providers/AuthProvider';

/**
 * Affiché quand l'utilisateur n'appartient à aucun household. La création
 * d'un household est une mutation (Phase 3B) : pas de bouton d'action ici
 * pour ne pas présenter une fonctionnalité indisponible comme active.
 */
export function NoHouseholdView() {
  const { logout } = useAuth();

  return (
    <ScreenContainer>
      <EmptyState
        icon="home-outline"
        title="Votre nid est encore vide."
        message="Vous n'appartenez à aucun foyer pour le moment. La création et l'acceptation d'invitation arrivent bientôt."
        actionLabel="Se déconnecter"
        onAction={() => void logout()}
      />
    </ScreenContainer>
  );
}
