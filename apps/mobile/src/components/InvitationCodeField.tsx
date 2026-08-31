import { formatInvitationCode, normalizeInvitationCode } from '@notre-nid/shared';

import { TextField } from './TextField';

export interface InvitationCodeFieldProps {
  label?: string;
  value: string;
  onChangeText: (formatted: string) => void;
  onBlur?: () => void;
  errorMessage?: string;
}

/**
 * Champ de saisie du code d'invitation : reformate en direct avec des séparateurs
 * (`XXXX-XXXX`), accepte le collage avec ou sans préfixe d'affichage/séparateurs (tout est
 * normalisé avant reformatage), insensible à la casse (docs/NOTRE_NID_PRD.md, Bloc 2,
 * section 7). Partagé entre l'écran « Rejoindre un foyer » et l'accueil sans foyer.
 */
export function InvitationCodeField({
  label = "Code d'invitation",
  value,
  onChangeText,
  onBlur,
  errorMessage,
}: InvitationCodeFieldProps) {
  const handleChangeText = (text: string) => {
    const normalized = normalizeInvitationCode(text);
    onChangeText(normalized ? formatInvitationCode(normalized) : '');
  };

  return (
    <TextField
      label={label}
      value={value}
      onChangeText={handleChangeText}
      onBlur={onBlur}
      errorMessage={errorMessage}
      placeholder="XXXX-XXXX"
      autoCapitalize="characters"
      autoCorrect={false}
      autoComplete="off"
    />
  );
}
