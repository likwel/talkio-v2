-- Champs d'en-tete "Partie 1" de la matrice de saisie des donnees qualitatives
-- (IDEAL) : composition du groupe (genre) et nombre de participants. Les
-- champs region/district/community existent deja (tableau de suivi) et sont
-- reutilises pour Etat/District/Communaute.

ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "genderMix" TEXT;
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "participantCount" INTEGER;
