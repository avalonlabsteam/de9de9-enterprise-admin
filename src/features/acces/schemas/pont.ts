import { z } from 'zod';

// « Pont de9de9 » — the switch of the server-to-server link to the de9de9 app,
// now a card of the page « Accès ». Three words decide everything:
//   ouvert     the switch: the last admin's choice, else the server's default
//   configure  the server holds the bridge address and the shared key
//   actif      configure && ouvert — the only value that lets anything cross
// Every nullable field is `.nullish()`; `resultat` stays a string, not an enum.

export const pontEtatSchema = z.object({
  ouvert: z.boolean(),
  configure: z.boolean(),
  actif: z.boolean(),
  /** ISO instant of the last switch; null while no admin has ever switched it. */
  modifieLe: z.string().nullish(),
  modifieParUserId: z.string().nullish(),
  /** The admin's login (user name, else e-mail) at the moment of the switch. */
  modifiePar: z.string().nullish(),
  motif: z.string().nullish(),
  /** Sends still waiting, all companies together. */
  enFile: z.number(),
  suspensionsEnFile: z.number(),
  /** The read-only connection to the de9de9 app database is set. */
  miroirConfigure: z.boolean(),
});
export type PontEtat = z.infer<typeof pontEtatSchema>;

/** « Tester la connexion » — always 200, never stored: gone after a reload. */
export const pontTestSchema = z.object({
  /** ok · non_configure · cle_absente_de9de9 · cle_refusee · injoignable · reponse_inattendue */
  resultat: z.string(),
  label: z.string(),
  detail: z.string(),
  /** What the de9de9 app answered; null when it did not answer with an error status. */
  httpStatus: z.number().nullish(),
  dureeMs: z.number(),
  testeLe: z.string(),
});
export type PontTest = z.infer<typeof pontTestSchema>;
