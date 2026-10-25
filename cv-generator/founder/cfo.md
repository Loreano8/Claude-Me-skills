# Note du CFO — CV Studio

*Tous les montants sont en **FCFA**. Ils sont calculés par l'outil founder-cfo à partir de `founder/numbers.json`. Les sources et estimations sont détaillées dans `founder/cfo-sources.md`. Ce n'est pas un avis comptable ou fiscal : un comptable doit vérifier la structure (statut, TVA, impôts) avant que l'argent circule.*

- **La marge.** Chaque pack vendu (695 FCFA en moyenne) laisse **352 FCFA** de contribution (51 %), une fois payés l'IA, FedaPay et les crédits gratuits. Au volume visé (6 packs par jour), la marge nette est de **27 %**.
- **Le coût de l'IA n'est pas le problème.** Mesure réelle : de **15 à 43 FCFA par action** avec Opus 5.5. Un crédit est vendu 120 à 167 FCFA. Le premier conseil du conseil (« mesurer le coût IA ») est rempli : la marge par action est largement positive.
- **La ligne à surveiller : le budget pub face au volume.** Avec 30 000 FCFA de pub par mois, il faut **3 packs par jour** pour être à l'équilibre. Avec 20 % de ventes en moins, l'année 1 passe à **−30 528 FCFA**. Avec un prix 10 % plus bas, à **−29 475 FCFA**. La rentabilité dépend donc du coût d'acquisition réel, encore inconnu.
- **La trésorerie.** Avec ce plan, il faut avancer jusqu'à **108 800 FCFA** (≈ 166 €) avant que ça se rembourse, soit le mois 12. Sans pub payante (bouche-à-oreille, statuts, groupes WhatsApp), il suffit d'environ **18 000 FCFA**. Mais les ventes viendraient plus lentement : ce scénario garde le même volume, ce qui est optimiste.
- **Trois leviers pour améliorer la marge** (chacun simulé avec l'outil) :
  1. **Passer l'IA sur Sonnet 5.5** (2 $ et 10 $ par million de jetons au lieu de 4 $ et 20 $), et réduire le coût des crédits gratuits. La contribution passe de 352 à **517 FCFA** (74 %), la marge au plan de 27 % à **50 %**, et l'année 1 de 51 840 à **244 890 FCFA**. À valider d'abord en comparant la qualité sur nos propres tests.
  2. **Faire venir les clients sans pub payante** : parrainage, statuts WhatsApp, partenaires comme les écoles ou les cybercafés. Chaque tranche de 30 000 FCFA de pub mensuelle économisée améliore directement le résultat.
  3. **Ne pas vendre les crédits par Google Play.** Avec 15 % de commission sur toutes les ventes, la contribution tombe à 248 FCFA et l'année 1 devient **négative (−70 132 FCFA)**. Il faut garder le paiement MoMo sur le site, et choisir la stratégie Play Store en connaissance de cause.
- **Les conditions financières du conseil :**
  - ✅ Le coût IA est mesuré, et la marge par pack est positive après FedaPay.
  - ⚠️ Elle reste positive après les 15 % de Google, mais trop mince pour payer la pub.
  - ❌ Le coût d'acquisition et la conversion réels restent inconnus. Il faut les mesurer avec un petit budget test avant d'augmenter la pub.

---

# Unit economics: CV Studio

Every number below comes from the input file. Nothing is looked up or guessed.

## One pack de crédits vendu (moyenne pondérée)

| line | per pack de crédits vendu (moyenne pondérée) |
| --- | ---: |
| Price | 695 FCFA |
| IA Anthropic : 4,05 actions utilisées × 32 FCFA (mesuré) | -130 FCFA |
| Frais FedaPay (1,8 %, observé) | -13 FCFA |
| Crédits gratuits des non-payeurs et du payeur, ramenés à une vente (estimation) | -200 FCFA |
| **Contribution** (what each pack de crédits vendu (moyenne pondérée) leaves to pay the fixed costs) | **352 FCFA** (51%) |

## The margin that matters

Fixed costs: 30,000 FCFA a month (Hébergement Render + Supabase (offres gratuites) 0, FCFA Publicité Facebook/TikTok (estimation, à fixer par le plan marketing) 30,000 FCFA).

- **Break-even: 3 pack de crédits vendu (moyenne pondérée)s a day.** Below that you lose money every month.
- **Profit margin at your plan** (6 a day): **27%** of every sale, after every cost.

## Year 1, month by month

| month | pack de crédits vendu (moyenne pondérée)s a day | revenue | profit | cumulative (after 38,000 FCFA startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 10,425 FCFA | -24,720 FCFA | -62,720 FCFA |
| 2 | 1 | 20,850 FCFA | -19,440 FCFA | -82,160 FCFA |
| 3 | 2 | 31,275 FCFA | -14,160 FCFA | -96,320 FCFA |
| 4 | 2 | 41,700 FCFA | -8,880 FCFA | -105,200 FCFA |
| 5 | 2 | 52,125 FCFA | -3,600 FCFA | -108,800 FCFA |
| 6 | 3 | 62,550 FCFA | 1,680 FCFA | -107,120 FCFA |
| 7 | 4 | 72,975 FCFA | 6,960 FCFA | -100,160 FCFA |
| 8 | 4 | 83,400 FCFA | 12,240 FCFA | -87,920 FCFA |
| 9 | 4 | 93,825 FCFA | 17,520 FCFA | -70,400 FCFA |
| 10 | 5 | 104,250 FCFA | 22,800 FCFA | -47,600 FCFA |
| 11 | 6 | 114,675 FCFA | 28,080 FCFA | -19,520 FCFA |
| 12 | 6 | 125,100 FCFA | 33,360 FCFA | 13,840 FCFA |

- **Year 1 operating profit: 51,840 FCFA** on 813,150 FCFA of revenue.
- After the 38,000 FCFA startup spend: 13,840 FCFA.
- Startup money earned back: month 12.
- Cash you need before it pays for itself: **108,800 FCFA**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 27% | 3 | 51,840 FCFA |
| Price -10% | 19% | 4 | -29,475 FCFA |
| Volume -20% | 21% | 3 | -30,528 FCFA |
| Unit costs +15% | 19% | 4 | -8,356 FCFA |

No red flags in these numbers. They are only as good as the inputs: check every cost against a real quote.
