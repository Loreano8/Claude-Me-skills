import { t } from '../i18n.ts';
// Questions fréquentes : affichées sur l'accueil et reprises telles quelles pour Google (balisage FAQ).

export const FAQ: { q: string; a: string }[] = [
  { q: t('Est-ce vraiment gratuit ?'), a: t('Oui : créer son CV avec les 3 modèles de base et le télécharger en PDF est gratuit et sans compte (avec une petite mention « Créé avec CVCasa » en bas de page). L’adaptation à une offre, la lettre, la fiche entretien ou la traduction coûtent 1 crédit chacune (la première est offerte) ; la version Pro d’un CV (sans mention, 13 modèles, export Word) coûte 2 crédits et reste acquise pour toujours sur ce CV.') },
  { q: t('Le scanner est-il gratuit ?'), a: t('Oui jusqu’à 2 pages par PDF (et pour un dossier : CV, lettre et 2 pièces). Au-delà, 1 crédit pour le PDF, pages illimitées. Transformer un document écrit à la main en texte tapé coûte 1 crédit par page. Vos papiers restent sur votre téléphone, sauf pour la retranscription, le temps de la lecture.') },
  { q: t('Faut-il un abonnement ?'), a: t('Non. Vous achetez un pack de crédits une fois, quand vous en avez besoin. Rien n’est prélevé automatiquement ensuite.') },
  { q: t('Comment payer ?'), a: t('Par Mobile Money (MTN MoMo, Moov Money), via FedaPay. Les crédits arrivent sur votre compte dès que le paiement est confirmé.') },
  { q: t('Mon CV va-t-il « faire IA » ?'), a: t('Non. CVCasa part de vos vraies expériences, avec vos mots : il ne fait que les mettre en forme et en valeur, sans rien inventer. Vous relisez et modifiez tout avant de télécharger, et le CV reste le vôtre.') },
  { q: t('Où sont mes données ?'), a: t('Votre CV reste sur votre téléphone ou votre ordinateur. Seul le texte nécessaire à une adaptation ou à une lettre passe par notre serveur, le temps de la traiter.') },
  { q: t('Ça marche sur iPhone ?'), a: t('Oui, depuis Safari. Touchez « Partager » puis « Sur l’écran d’accueil » pour l’utiliser comme une application. Sur Android, l’application est aussi disponible.') },
];
