/** Format d'erreur standard de l'API (docs/NOTRE_NID_PRD.md section 18). */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  requestId?: string;
}
