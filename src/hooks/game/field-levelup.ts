import Vue from 'vue';
import GameState from '../../components/game-state';
import { GameField, MResp } from '../../shared/beans';
import { debug } from '../../util/debug';

interface PersoInfo {
    is_owned: boolean
    fields_owned: number
    can_build: boolean
    level_min: number
    level_max: number
}

declare module 'vue/types/vue' {
    interface Vue {
        getPersonalizedMonopolyInfo(user_id: number, field_group: number): PersoInfo
    }
}

export class FieldLevelUp {
    private jq: JQuery<Element>;

    constructor(public base: Vue, private state: GameState) {
        this.jq = jQuery(base.$el);
        state.$watch('usersLoaded', () => {
            state.mePlaying && this.init();
        });
    }

    private init() {
        require('../../style/game/field-levelup.less');
        const fjqs = jQuery('div.table-body-board-fields-one');

        this.state.$watch(() => this.getThisPlayerState().money, () => this.checkAllFields(fjqs));

        this.state.storage.vms.fields.fields_with_equipment.forEach((v, field_id) => {
            const ctr = fjqs.eq(field_id);
            const btn = jQuery('<div class="table-body-board-fields-one-levelup"><div class="ion-plus"/></div>').hide();

            btn.on('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                !jQuery(e.delegateTarget).is('._disabled') && window.Table.GameAPI.action.call(e, 'levelUp', { field_id }, () => Vue.nextTick().then(() => this.checkAllFields(fjqs)));
            });
            ctr.find('div.table-body-board-fields-one-label').after(btn);

            this.state.$watch(() => {
                const field = this.getField(field_id);
                return [field.owner_true, this.isActionField(field)];
            }, (val) => {
                this.checkBtn(btn, field_id);
            }, { immediate: true });
        });
    }

    private checkAllFields(fjqs: JQuery<HTMLElement>) {
        this.state.storage.vms.fields.fields_with_equipment.forEach((v, field_id) => {
            this.checkBtn(fjqs.eq(field_id).find('div.table-body-board-fields-one-levelup'), field_id);
        });
    }

    private checkBtn(btn: JQuery<HTMLElement>, field_id: number) {
        const field = this.getField(field_id);
        const perso = this.base.getPersonalizedMonopolyInfo(this.state.user.user_id, field.group);
        const show = field.owner_true === this.state.user.user_id &&
            this.isActionField(field) &&
            this.state.storage.action_types.has('levelUp') &&
            !field.mortgaged &&
            field.levelUpCost !== false &&
            field.level < (field.levels.length - 1) &&
            perso.can_build &&
            this.isUnevenCase(field, perso) &&
            !new Set(this.state.storage.current_move.levelUpped ?? []).has(field.group) &&
            !this.state.storage.about.is_m1tv;
        // debug('check lvlup', field_id, show, perso, this.state.storage.action_types)
        if (show) {
            btn.show();
            btn.prev().hide();
            const spl = this.getThisPlayerState();
            const enough = spl.money >= field.levelUpCost;
            if (enough) {
                btn.removeClass('_disabled');
            }
            else {
                btn.addClass('_disabled');
            }
        } else {
            btn.hide();
            btn.prev().show();
        }
    }

    private getThisPlayerState() {
        return this.state.storage.status.players.find(pl => pl.user_id === this.state.user.user_id);
    }

    private isUnevenCase(field: GameField, perso: PersoInfo): boolean {
        const uneven = 1 === this.state.storage.config.UNEVEN_LEVEL_CHANGE;
        const is_can_build_no_mnpl = 1 === this.state.storage.config.LEVEL_CHANGE_NO_MNPL;
        return uneven || is_can_build_no_mnpl ||
            perso.level_max !== field.level ||
            perso.level_min === perso.level_max;
    }

    private isActionField(field: GameField) {
        return field.owner === this.state.storage.status.action_player;
    }

    private getField(k: number): GameField {
        return this.state.storage.vms.fields.fields_with_equipment.get(k);
    }
}