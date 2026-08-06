// ponytail: interrupteurs de fonctionnalités désactivées temporairement.
// Rien n'est supprimé — repasser une valeur à `true` réactive la fonctionnalité.

/** Page "Protocole" (/course + /lesson/$lessonId) et son entrée de nav. */
export const PROTOCOLE_ENABLED = false;

/** Onboarding interne (questionnaire /intake + /questionnaire).
 *  Désactivé : le questionnaire passe par Tally, le coach remplit le profil
 *  depuis /admin. Les liens d'invitation mènent directement à la création
 *  du mot de passe puis à /products. */
export const ONBOARDING_ENABLED = false;
