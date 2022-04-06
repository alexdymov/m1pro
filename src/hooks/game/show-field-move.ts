import Vue from 'vue';
import GameState from '../../components/game-state';
import { GameEvent } from '../../shared/beans';
import { debug } from '../../util/debug';

export class ShowFieldMove {
    private jq: JQuery<Element>;
    private fjqs: JQuery<HTMLElement>;
    private pending = false;
    private pendingBus = false;

    constructor(public base: Vue, private state: GameState) {
        this.jq = jQuery(base.$el);

        state.$watch('loaded', _ => {
            this.fjqs = jQuery('div.table-body-board-fields-one');

            this.state.$watch('currentDiceRoll', (v: GameEvent) => {
                debug('current_move', v && JSON.parse(JSON.stringify(v)));
                if (v) {
                    const poss = this.getPositions(v);
                    debug('poss', poss)
                    if (poss.length) {
                        this.fjqs.first().parent().addClass('_mode_choose_field');
                        poss.forEach(p => this.fjqs.eq(p).addClass('_mode_choose_field_available'));
                        this.pending = true;
                    }
                }
            });

            this.state.$watch('currentTeleport', (v: GameEvent) => {
                debug('currentTeleport', v && JSON.parse(JSON.stringify(v)));
                if (v) {
                    this.fjqs.first().parent().addClass('_mode_choose_field');
                    this.fjqs.eq(v.mean_position).addClass('_mode_choose_field_available');
                    this.pending = true;
                }
            });

            state.$watch('storage.is_events_processing', p => {
                debug('is_events_processing', p);
                if (!p && this.pending && !this.pendingBus) {
                    debug('remove pending');
                    this.fjqs.removeClass('_mode_choose_field_available');
                    this.fjqs.parent().removeClass('_mode_choose_field');
                    this.pending = false;
                }
            });
            state.$watch('lastBusUserId', s => {
                s && (this.pendingBus = false);
            });
        })
    }

    private getPositions(v: GameEvent) {
        const reverse = this.state.lastReverseMoveRounds[v.user_id];
        if (v.dices.length == 2) {
            return [v.mean_position];
        } else if (v.dices.length > 2 && !(v.dices[0] < 4 && v.dices[0] === v.dices[1] && v.dices[0] === v.dices[2])) {
            const last = v.dices[2];
            const pos = this.state.storage.status.players.find(pl => pl.user_id === v.user_id).position;
            if (last === 4 || last === 6) {
                if (v.user_id === this.state.user.user_id && !this.state.storage.about.is_m1tv) {
                    return [];
                }
                this.pendingBus = true;
                if (reverse) {
                    return [(pos - v.dices[0]) % 40, (pos - v.dices[1]) % 40, (pos - v.dices[0] - v.dices[1]) % 40];
                } else {
                    return [(pos + v.dices[0]) % 40, (pos + v.dices[1]) % 40, (pos + v.dices[0] + v.dices[1]) % 40];
                }
            } else if (last === 5) {
                let fields = [...this.state.storage.vms.fields.fields_with_equipment.values()];
                fields = [...fields.filter(f => f.field_id > v.mean_position), ...fields.filter(f => v.mean_position > f.field_id)];
                reverse && (fields = fields.reverse());
                const vacantFields = fields.filter(f => !f.owner_true);
                const firstVacant = vacantFields.length > 0 && vacantFields[0];
                debug('pos', pos)
                debug('fields', fields);
                debug('vacant', firstVacant?.field_id);
                if (v.mean_position === 30) {
                    return [v.mean_position];
                }
                if (vacantFields.length === 1 && vacantFields[0].field_id === v.mean_position) {
                    return [v.mean_position];
                }
                if (firstVacant) {
                    return [v.mean_position, firstVacant.field_id];
                } else {
                    return [v.mean_position, fields.find(f => f.owner_true !== v.user_id && f.mortgaged !== true).field_id];
                }
            } else {
                return [v.mean_position];
            }
        }
        return [];
    }
}