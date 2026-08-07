// ponytail: check de isValidEmail — la garde qui empêche de créer un token
// sans destinataire (lien mort + email jamais envoyé).
// Lancer : npx tsx src/lib/invitation-email.test.ts
import assert from "node:assert/strict";
import { isValidEmail } from "./invitation-email";

// Le cas du bug : email absent ou vide → token inutilisable.
assert.equal(isValidEmail(""), false, "chaîne vide refusée");
assert.equal(isValidEmail("   "), false, "espaces seuls refusés");

// Fautes de frappe qui passaient avant et échouaient côté Resend.
assert.equal(isValidEmail("nancy@icloud"), false, "domaine sans TLD refusé");
assert.equal(isValidEmail("nancy.icloud.com"), false, "pas d'arobase");
assert.equal(isValidEmail("@icloud.com"), false, "pas de partie locale");
assert.equal(isValidEmail("nancy@"), false, "pas de domaine");
assert.equal(isValidEmail("a b@icloud.com"), false, "espace interdit");
assert.equal(isValidEmail("nancy@@icloud.com"), false, "double arobase");
assert.equal(isValidEmail("n@" + "a".repeat(260) + ".com"), false, "trop long");

// Adresses réelles acceptées.
assert.equal(isValidEmail("nancydepaix@icloud.com"), true);
assert.equal(isValidEmail("  nancydepaix@icloud.com  "), true, "trim appliqué");
assert.equal(isValidEmail("prenom.nom+tag@sous.domaine.fr"), true);
assert.equal(isValidEmail("mehdi.zaaboubammar@gmail.com"), true);

console.log("invitation-email: OK");
