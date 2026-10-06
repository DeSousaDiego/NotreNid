import type { DigitEyesResponse } from '../../providers/digit-eyes.provider';

/** Une réponse réelle Digit-Eyes (corps JSON 200) et le code demandé. */
export interface DigitEyesFixture {
  barcode: string;
  response: DigitEyesResponse;
}
