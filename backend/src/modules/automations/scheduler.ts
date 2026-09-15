import { checkScheduledAutomations, checkOverdueCards } from './dispatch';

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Verifie chaque minute :
 * - si une regle "briefing journalier" (schedule.daily) doit se declencher ;
 * - si des taches (cartes Kanban) viennent de depasser leur echeance (card.overdue).
 */
export function startAutomationScheduler(): void {
  if (timer) return;
  const tick = () => {
    checkScheduledAutomations().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[automations] echec du tick planificateur', err);
    });
    checkOverdueCards().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[automations] echec du tick taches en retard', err);
    });
  };
  tick();
  timer = setInterval(tick, 60_000);
}
