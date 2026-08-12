import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type ExportFormat = 'json' | 'csv';

export class SharingUnavailableError extends Error {
  constructor() {
    super(
      "Le partage n'est pas disponible sur cet appareil. Le fichier a été préparé mais ne peut pas être envoyé automatiquement.",
    );
    this.name = 'SharingUnavailableError';
  }
}

const MIME_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
};

/**
 * Écrit le contenu exporté dans le cache local puis ouvre le panneau de
 * partage natif (docs/NOTRE_NID_PRD.md section 9, « Exports »). Si le partage
 * n'est pas disponible sur la plateforme (ex. web), le fichier reste écrit
 * mais l'utilisateur en est informé explicitement plutôt qu'un succès muet.
 */
export async function shareExportFile(
  householdName: string,
  format: ExportFormat,
  content: string,
): Promise<void> {
  const filename = `notre-nid-${slugify(householdName)}.${format}`;
  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new SharingUnavailableError();
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: MIME_TYPES[format],
    dialogTitle: `Exporter la collection (${format.toUpperCase()})`,
  });
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'export'
  );
}
