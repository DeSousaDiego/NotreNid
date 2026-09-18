/**
 * Un EAN-13 commençant par 978 ou 979 (préfixe "Bookland") est un ISBN-13 —
 * c'est la forme que prennent la quasi-totalité des codes-barres de livres
 * publiés depuis 2007 (les 978/979 remplacent l'ancien "country code" EAN par
 * un espace réservé au livre). Un code de 8 ou 12 chiffres, ou un EAN-13 ne
 * commençant pas par 978/979, est une forme de code-barres généralement valide
 * mais n'est structurellement pas un ISBN : chercher un livre avec n'aurait
 * aucun sens (ni Google Books ni Open Library n'indexent les livres par un
 * autre identifiant que l'ISBN) — c'est une décision de validation de forme,
 * pas une affirmation sur l'existence réelle d'un livre pour ce code.
 */
const ISBN_13_PATTERN = /^97[89]\d{10}$/;

export function isIsbn13Candidate(barcode: string): boolean {
  return ISBN_13_PATTERN.test(barcode);
}

/**
 * L'ISBN-13 utilisé pour interroger les providers est le code-barres lui-même
 * (aucune conversion vers ISBN-10 : Google Books et Open Library acceptent
 * tous deux nativement une recherche par ISBN-13) — cette fonction existe pour
 * documenter explicitement ce point de normalisation à un seul endroit plutôt
 * que de réutiliser `barcode` implicitement partout où l'ISBN est nécessaire.
 */
export function normalizeIsbnForLookup(barcode: string): string {
  return barcode;
}
