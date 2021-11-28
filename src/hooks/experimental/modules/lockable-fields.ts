import GameState from '../../../components/game-state';
import { debug } from '../../../util/debug';

export class LockableFields {
    constructor(private state: GameState) {
        require('../../../style/game/lockable-fields.less');
        state.$watch('loaded', () => {
            if (!state.storage.about.is_m1tv && state.mePlaying) {
                // this.lockAll();
                this.init();
            }
        });
    }

    private init() {
        const fjqs = jQuery('div.table-body-board-fields-one');
        this.state.storage.vms.fields.fields_with_equipment.forEach((v, k) => {
            const ctr = fjqs.eq(k);
            const btn = jQuery('<div class="table-body-board-fields-one-lock"><div class="ion-toggle-filled"/></div>').hide();

            const checkLocked = (k: number, locked: boolean) => {
                btn.find('div').addClass(locked ? 'ion-toggle' : 'ion-toggle-filled').removeClass(!locked ? 'ion-toggle' : 'ion-toggle-filled');
                if (locked) {
                    ctr.mnpl('locked', '1');
                    this.state.lockedFields.add(k);
                } else {
                    ctr.mnpl('locked', '0');
                    this.unlock(k);
                }
            }

            btn.on('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                checkLocked(k, !this.isLocked(k));
            });
            ctr.append(btn);
            checkLocked(k, this.isLocked(k));

            this.state.$watch(() => this.state.storage.vms.fields.fields_with_equipment.get(k).owner_true, (val) => {
                if (val) {
                    btn.hide();
                    ctr.mnpl('locked', '0');
                    btn.find('div').addClass('ion-toggle').removeClass('ion-toggle-filled');
                    this.unlock(k);
                } else {
                    btn.show();
                }
            }, { immediate: true });
        });
    }

    private unlock(k: number) {
        this.state.lockedFields.delete(k);
    }

    private lockAll() {
        this.state.storage.vms.fields.fields_with_equipment.forEach((v, k) => {
            this.state.lockedFields.add(k);
        });
    }

    private isLocked(id: number) {
        return this.state.lockedFields.has(id);
    }
}