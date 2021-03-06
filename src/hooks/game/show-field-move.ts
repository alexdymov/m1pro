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

            this.state.$watch('currentEvents.lastDiceEvent', (v: GameEvent) => {
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

            this.state.$watch('currentTeleports', (v: Array<GameEvent>) => {
                debug('currentTeleports', JSON.parse(JSON.stringify(v)));
                if (v.length) {
                    this.fjqs.first().parent().addClass('_mode_choose_field');
                    v.forEach(ev => this.fjqs.eq(ev.mean_position).addClass('_mode_choose_field_available'));
                    v.splice(0, v.length);
                    this.pending = true;
                }
            });

            this.state.$watch('currentChooses', (v: Array<GameEvent>) => {
                debug('currentChooses', JSON.parse(JSON.stringify(v)));
                if (v.length) {
                    this.fjqs.first().parent().addClass('_mode_choose_field');
                    if (this.pendingBus) {
                        this.fjqs.removeClass('_mode_choose_field_available');
                    }
                    v.forEach(ev => this.fjqs.eq(ev.field_id ?? ev.mean_position).addClass('_mode_choose_field_available'));
                    v.splice(0, v.length);
                    this.pending = true;
                }
            });

            state.$watch('wormholeDestinations', (v: Array<number>) => {
                if (v.length) {
                    this.fjqs.first().parent().addClass('_mode_choose_field');
                    v.forEach(ev => this.fjqs.eq(ev).addClass('_mode_choose_field_available'));
                } else {
                    this.fjqs.removeClass('_mode_choose_field_available');
                    this.fjqs.parent().removeClass('_mode_choose_field');
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
        const reverse = v.move_reverse;
        const dices = v.dices;
        const singlePos = [v.mean_position];
        if (this.isComboJail()) {
            return [];
        }

        const spl = this.state.storage.status.players.find(pl => pl.user_id === v.user_id);
        if (spl.jailed && spl.unjailAttempts !== 2 && !this.state.currentEvents.events.find(e => e.type === 'rollDicesForUnjailSuccess')) {
            return [];
        }
        if (dices.length == 2) {
            return singlePos;
        } else if (dices.length > 2 && !this.isTrippleDiceRoll(dices)) {
            const last = dices[2];
            const currPos = spl.position;
            if (last === 4 || last === 6) {
                return this.getBusPositions(currPos, dices, reverse, v.user_id);
            } else if (last === 5) {
                return this.getM1Positions(currPos, v.mean_position, reverse, v.user_id);
            } else {
                return singlePos;
            }
        }
        return [];
    }

    private getM1Positions(currPos: number, meanPos: number, reverse: number, user: number) {
        const telePos = this.state.currentTeleports.length && this.state.currentTeleports[this.state.currentTeleports.length - 1].mean_position;
        const startSearchPos = telePos || meanPos;
        const fields = this.getDirectionFields(startSearchPos, reverse);
        const vacantFields = fields.filter(f => !f.owner_true);
        const firstVacant = vacantFields.length > 0 && vacantFields[0];
        const singlePos = [meanPos];
        debug('pos', currPos)
        debug('fields', fields);
        debug('vacant', firstVacant?.field_id);
        if (this.isPosJail(meanPos)) {
            return singlePos;
        }
        if (vacantFields.length === 1 && vacantFields[0].field_id === meanPos) {
            return singlePos;
        }
        if (firstVacant) {
            return [meanPos, firstVacant.field_id];
        } else {
            return [meanPos, fields.find(f => f.owner_true !== user && f.mortgaged !== true).field_id];
        }
    }

    private isComboJail() {
        return !!this.state.currentEvents.events.find(e => e.type === 'goToJailByCombo');
    }

    private isPosJail(meanPos: number) {
        const byChance = !!this.state.currentEvents.events.find(e => e.type === 'chance' && this.state.storage.config.chance_cards[e.chance_id].type === 'jail');
        return meanPos === 30 || byChance;
    }

    private getDirectionFields(fromPos: number, reverse: number) {
        let fields = [...this.state.storage.vms.fields.fields_with_equipment.values()];
        fields = [...fields.filter(f => f.field_id > fromPos), ...fields.filter(f => fromPos > f.field_id)];
        reverse && (fields = fields.reverse());
        return fields;
    }

    private getBusPositions(currPos: number, dices: number[], reverse: number, user: number) {
        if (user === this.state.user.user_id && !this.state.storage.about.is_m1tv) {
            return [];
        }
        this.pendingBus = true;
        if (reverse) {
            return [(currPos - dices[0]) % 40, (currPos - dices[1]) % 40, (currPos - dices[0] - dices[1]) % 40];
        } else {
            return [(currPos + dices[0]) % 40, (currPos + dices[1]) % 40, (currPos + dices[0] + dices[1]) % 40];
        }
    }

    private isTrippleDiceRoll(dices: number[]) {
        return dices[0] < 4 && dices[0] === dices[1] && dices[0] === dices[2];
    }
}