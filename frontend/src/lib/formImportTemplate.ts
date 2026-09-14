/**
 * Modele d'import JSON pour les formulaires (« .talkioform.json »).
 * Meme structure que l'export : { title, description, requireLogin, allowMultiple, sections[], fields[] }.
 *
 * Types de champ acceptes : TEXT, TEXTAREA, NUMBER, INTEGER, DECIMAL, DATE, DATETIME,
 * TIME, EMAIL, PHONE, URL, RATING, RANGE, SELECT, MULTISELECT, BOOLEAN, ACKNOWLEDGE,
 * NOTE, BARCODE, SIGNATURE, GEOPOINT, PHOTO.
 *
 * `key` : minuscules / chiffres / underscore, unique dans le formulaire.
 * `sectionKey` : rattache le champ a une section (via sa `key`).
 * Logique d'affichage : relevantField + relevantOp (eq|ne|gt|lt|gte|lte|contains|empty|notempty) + relevantValue.
 */
export const FORM_IMPORT_TEMPLATE = {
  talkioForm: 1,
  title: 'Modele de formulaire',
  description: 'Exemple montrant les principaux types de champs et la logique conditionnelle.',
  requireLogin: false,
  allowMultiple: true,
  sections: [
    {
      key: 'identite',
      title: 'Identification',
      description: 'Informations sur la personne enquetee.',
      position: 0,
      repeatable: false,
    },
    {
      key: 'menage',
      title: 'Composition du menage',
      description: 'Une entree par membre du menage.',
      position: 1,
      repeatable: true,
      repeatLabel: 'Membre',
      minRepeat: 0,
      maxRepeat: 20,
    },
  ],
  fields: [
    {
      label: 'Nom complet',
      key: 'nom_complet',
      type: 'TEXT',
      required: true,
      position: 0,
      sectionKey: 'identite',
      placeholder: 'Prenom NOM',
    },
    {
      label: 'Adresse e-mail',
      key: 'email',
      type: 'EMAIL',
      required: false,
      position: 1,
      sectionKey: 'identite',
    },
    {
      label: 'Sexe',
      key: 'sexe',
      type: 'SELECT',
      required: true,
      position: 2,
      sectionKey: 'identite',
      options: ['Femme', 'Homme', 'Autre'],
    },
    {
      label: 'Age',
      key: 'age',
      type: 'INTEGER',
      required: true,
      position: 3,
      sectionKey: 'identite',
      minValue: 0,
      maxValue: 120,
    },
    {
      label: 'Est-ce un chef de menage ?',
      key: 'chef_menage',
      type: 'BOOLEAN',
      required: false,
      position: 4,
      sectionKey: 'identite',
    },
    {
      label: 'Nombre de personnes a charge',
      key: 'personnes_charge',
      type: 'INTEGER',
      required: false,
      position: 5,
      sectionKey: 'identite',
      minValue: 0,
      relevantField: 'chef_menage',
      relevantOp: 'eq',
      relevantValue: 'true',
      helpText: 'Affiche uniquement si « chef de menage » est coche.',
    },
    {
      label: 'Prenom du membre',
      key: 'membre_prenom',
      type: 'TEXT',
      required: true,
      position: 6,
      sectionKey: 'menage',
    },
    {
      label: 'Lien de parente',
      key: 'membre_lien',
      type: 'SELECT',
      required: true,
      position: 7,
      sectionKey: 'menage',
      options: ['Conjoint(e)', 'Enfant', 'Parent', 'Autre'],
    },
    {
      label: 'Date de l’enquete',
      key: 'date_enquete',
      type: 'DATE',
      required: true,
      position: 8,
    },
    {
      label: 'Localisation GPS',
      key: 'gps',
      type: 'GEOPOINT',
      required: false,
      position: 9,
    },
    {
      label: 'Observations',
      key: 'observations',
      type: 'TEXTAREA',
      required: false,
      position: 10,
    },
    {
      label: 'Je certifie l’exactitude des informations',
      key: 'certification',
      type: 'ACKNOWLEDGE',
      required: true,
      position: 11,
    },
  ],
} as const;

/** Telecharge le modele d'import au format .talkioform.json. */
export function downloadFormImportTemplate() {
  const blob = new Blob([JSON.stringify(FORM_IMPORT_TEMPLATE, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele-formulaire.talkioform.json';
  a.click();
  URL.revokeObjectURL(url);
}
