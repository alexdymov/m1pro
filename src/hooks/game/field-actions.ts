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

export class FieldActions {
    private jq: JQuery<Element>;
    private globalBtns: JQuery<HTMLElement>;
    private fjqs: JQuery<HTMLElement>;
    private globalLock = false;

    constructor(public base: Vue, private state: GameState) {
        this.jq = jQuery(base.$el);
        state.$watch('usersLoaded', () => {
            state.mePlaying && this.init();
        });
    }

    private init() {
        require('../../style/game/field-actions.less');
        this.fjqs = jQuery('div.table-body-board-fields-one');

        this.state.storage.vms.fields.fields_with_equipment.forEach((field, id) => {
            const ctr = this.fjqs.eq(id);

            const levelupBtn = jQuery('<div class="table-body-board-fields-one-action _levelUp"><div class="ion-chevron-up"/></div>').hide()
                .on('click', this.actionCallHandler('levelUp', this.getField(id)))
                .on('check', () => { this.checkLevelUpBtn(levelupBtn, this.getField(id)) });
            const levelupMaxBtn = jQuery('<div class="table-body-board-fields-one-action _levelUpMax"><div class="ion-chevron-up"/><div class="ion-chevron-up"/></div>').hide()
                .on('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = jQuery(e.delegateTarget);
                    if (!btn.is('._disabled')) {
                        this.globalLock = true;
                        btn.addClass('_disabled');
                        const perso = this.base.getPersonalizedMonopolyInfo(this.state.user.user_id, field.group);
                        this.callRepeatAction(e, btn, 'levelUp', this.getField(id), () => {
                            const field = this.getField(id);
                            return perso.can_build && field.level < (field.levels.length - 1) && this.isEnoughMoneyToLevelUp(field);
                        });
                    }
                })
                .on('check', () => { this.checkLevelUpMaxBtn(levelupMaxBtn, this.getField(id)) });
            const levelDownBtn = jQuery('<div class="table-body-board-fields-one-action _levelDown"><div class="ion-chevron-down"/></div>').hide()
                .on('click', this.actionCallHandler('levelDown', this.getField(id)))
                .on('check', () => { this.checkLevelDownBtn(levelDownBtn, this.getField(id)) });
            const mortgageBtn = jQuery('<div class="table-body-board-fields-one-action _mortgage"><div class="ion-android-lock"/></div>').hide()
                .on('click', this.actionCallHandler('mortgage', this.getField(id)))
                .on('check', () => { this.checkMortgageBtn(mortgageBtn, this.getField(id)) });
            const unmortgageBtn = jQuery('<div class="table-body-board-fields-one-action _unmortgage"><div class="ion-android-unlock"/></div>').hide()
                .on('click', this.actionCallHandler('unmortgage', this.getField(id)))
                .on('check', () => { this.checkUnmortgageBtn(unmortgageBtn, this.getField(id)) });
            const remortgageBtn = jQuery('<div class="table-body-board-fields-one-action _remortgage"><div class="ion-loop"/></div>').hide()
                .on('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = jQuery(e.delegateTarget);
                    !btn.is('._disabled') &&
                        btn.addClass('_disabled') &&
                        window.Table.GameAPI.action.call(e, 'unmortgage', { field_id: id }, () => {
                            Vue.nextTick().then(() => this.checkAllFields()).then(() => {
                                window.Table.GameAPI.action.call(e, 'mortgage', { field_id: id }, () => {
                                    btn.removeClass('_disabled') &&
                                        Vue.nextTick().then(() => this.checkAllFields());
                                });
                            });
                        });
                })
                .on('check', () => { this.checkRemortgageBtn(remortgageBtn, this.getField(id)) });

            const label = ctr.find('div.table-body-board-fields-one-label');
            label.after($('<div class="table-body-board-fields-one-actions"/>').append(levelupBtn, levelupMaxBtn, levelDownBtn, mortgageBtn, unmortgageBtn, remortgageBtn));
            const btns = ctr.find('div.table-body-board-fields-one-action');

            this.state.$watch(() => {
                const field = this.getField(id);
                return [field.owner_true, this.isActionField(field)];
            }, (val) => {
                this.checkField(btns);
            }, { immediate: true });
        });

        const mortgageAllBtn = jQuery('<div class="table-global-action _mortgage"><div class="ion-android-lock"/><span>Заложить <span class="cnt"/> +<span class="money"/></span></div>').hide()
            .on('click', this.actionGlobalCallHandler('mortgage', () => this.getMortgageableFields()))
            .on('check', () => { this.checkMortgageAllBtn(mortgageAllBtn) });
        const unmortgageAllBtn = jQuery('<div class="table-global-action _unmortgage"><div class="ion-android-unlock"/><span>Выкупить <span class="cnt"/> -<span class="money"/></span></div>').hide()
            .on('click', this.actionGlobalCallHandler('unmortgage', () => this.getUnmortgageableFields()))
            .on('check', () => { this.checkUnmortgageAllBtn(unmortgageAllBtn) });
        const remortgageAllBtn = jQuery('<div class="table-global-action _remortgage"><div class="ion-loop"/><span>Перезаложить <span class="cnt"/> -<span class="money"/></span></div>').hide()
            .on('click', e => {
                const btn = jQuery(e.delegateTarget);
                if (!btn.is('._disabled')) {
                    this.globalLock = true;
                    btn.addClass('_disabled');
                    this.callFieldsDoubleAction(e, btn, 'unmortgage', 'mortgage', this.getRemortgageableFields().sort((a, b) => a.buy - b.buy));
                }
            })
            .on('check', () => { this.checkRemortgageAllBtn(remortgageAllBtn) });
        const ctr = $('<div class="table-global-actions"/>').append(mortgageAllBtn, unmortgageAllBtn, remortgageAllBtn);
        jQuery('div.table-body-board-chatbottom').before(ctr);
        this.globalBtns = ctr.find('div.table-global-action');

        this.state.$watch(() => this.getThisPlayerState().money, () => this.checkAllFields(), { immediate: true });
        this.state.$watch('storage.status.action_player', (v) => this.checkGlobalBtns());
        this.state.$watch('storage.current_move', (v) => this.checkGlobalBtns());
    }

    private checkMortgageAllBtn(btn: JQuery<HTMLElement>) {
        const fields = this.getMortgageableFields();
        if (fields.length) {
            const money = fields.map(f => this.state.getFieldMortgageWorth(f)).reduce((a, b) => a + b, 0);
            btn.show()
                .find('span.cnt').text(`${fields.length} пол${this.getCountable(fields.length)}`).end()
                .find('span.money').text(money).end();
        } else {
            btn.hide();
        }
    }

    private getMortgageableFields() {
        const allowedAction = this.state.storage.action_types.has('mortgage');
        return [...this.state.storage.vms.fields.fields_with_equipment.values()].filter(field => {
            const perso = this.base.getPersonalizedMonopolyInfo(this.state.user.user_id, field.group);
            return this.isBasicChecks(field) &&
                allowedAction &&
                !field.mortgaged &&
                field.level === 0 &&
                !this.isAlreadyMortgagedOnMove(field) &&
                (void 0 === perso.level_max || 0 === perso.level_max);
        });
    }

    private checkUnmortgageAllBtn(btn: JQuery<HTMLElement>) {
        const fields = this.getUnmortgageableFields();
        if (fields.length) {
            const money = fields.map(f => this.state.getFieldUnmortgage(f)).reduce((a, b) => a + b, 0);
            btn.show()
                .find('span.cnt').text(`${fields.length} пол${this.getCountable(fields.length)}`).end()
                .find('span.money').text(money).end();
            if (this.isEnoughMoney(money)) {
                btn.removeClass('_disabled');
            } else {
                btn.addClass('_disabled');
            }
        } else {
            btn.hide();
        }
    }

    private getCountable(length: number) {
        return length > 1 ? (length < 5 ? 'я' : 'ей') : 'е';
    }

    private getUnmortgageableFields() {
        const allowedAction = this.state.storage.action_types.has('unmortgage');
        return [...this.state.storage.vms.fields.fields_with_equipment.values()].filter(field => {
            return this.isBasicChecks(field) &&
                allowedAction &&
                field.mortgaged;
        });
    }

    private checkRemortgageAllBtn(btn: JQuery<HTMLElement>) {
        const fields = this.getRemortgageableFields();
        if (fields.length) {
            const money = fields.map(f => this.state.getFieldUnmortgage(f) - this.state.getFieldMortgageWorth(f)).reduce((a, b) => a + b, 0);
            btn.show()
                .find('span.cnt').text(`${fields.length} пол${this.getCountable(fields.length)}`).end()
                .find('span.money').text(money).end();

            let moneyLeft = this.getThisPlayerState().money;
            if (fields.every(f => {
                const cost = this.state.getFieldUnmortgage(f);
                if (cost > moneyLeft) {
                    return false;
                }
                moneyLeft -= cost - this.state.getFieldMortgageWorth(f);
                return true;
            })) {
                btn.removeClass('_disabled');
            } else {
                btn.addClass('_disabled');
            }
        } else {
            btn.hide();
        }
    }

    private getRemortgageableFields() {
        const allowedAction = this.state.storage.action_types.has('mortgage') && this.state.storage.action_types.has('unmortgage');
        return [...this.state.storage.vms.fields.fields_with_equipment.values()].filter(field => {
            return this.isBasicChecks(field) &&
                allowedAction &&
                field.mortgaged &&
                !this.isAlreadyMortgagedOnMove(field);
        });
    }

    private actionGlobalCallHandler(action: string, supplier: () => Array<GameField>) {
        return (e: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>) => {
            const btn = jQuery(e.delegateTarget);
            if (!btn.is('._disabled')) {
                this.globalLock = true;
                btn.addClass('_disabled');
                this.callFieldsAction(e, btn, action, supplier());
            }
        };
    }

    private callFieldsAction(e: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>, btn: JQuery<HTMLElement>, action: string, fields: Array<GameField>) {
        const field = fields.pop();
        if (field) {
            window.Table.GameAPI.action.call(e, action, { field_id: field.field_id }, () => {
                this.callFieldsAction(e, btn, action, fields);
            });
        } else {
            this.globalLock = false;
            btn.removeClass('_disabled');
            this.checkAllFields();
        }
    }

    private callRepeatAction(e: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>, btn: JQuery<HTMLElement>, action: string, field: GameField, predicate: () => boolean) {
        if (predicate()) {
            window.Table.GameAPI.action.call(e, action, { field_id: field.field_id }, (e: any) => {
                this.callRepeatAction(e, btn, action, field, () => e.code === 0 && predicate());
            });
        } else {
            this.globalLock = false;
            btn.removeClass('_disabled');
            this.checkAllFields();
        }
    }

    private callFieldsDoubleAction(e: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>, btn: JQuery<HTMLElement>, action: string, action2: string, fields: Array<GameField>) {
        const field = fields.pop();
        if (field) {
            window.Table.GameAPI.action.call(e, action, { field_id: field.field_id }, () => {
                window.Table.GameAPI.action.call(e, action2, { field_id: field.field_id }, () => {
                    this.callFieldsDoubleAction(e, btn, action, action2, fields);
                });
            });
        } else {
            this.globalLock = false;
            btn.removeClass('_disabled');
            this.checkAllFields();
        }
    }

    private actionCallHandler(action: string, field: GameField) {
        return (e: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = jQuery(e.delegateTarget);
            !btn.is('._disabled') &&
                btn.addClass('_disabled') &&
                window.Table.GameAPI.action.call(e, action, { field_id: field.field_id }, () => {
                    btn.removeClass('_disabled');
                    Vue.nextTick().then(() => this.checkAllFields());
                });
        };
    }

    private checkAllFields() {
        if (this.globalLock) {
            return;
        }
        const start = Date.now();
        this.state.storage.vms.fields.fields_with_equipment.forEach((v, field_id) => {
            const btns = this.fjqs.eq(field_id).find('div.table-body-board-fields-one-action');
            this.checkField(btns);
        });
        this.checkGlobalBtns();
        const end = Date.now();
        debug(`checkAllFields took ${end - start}ms`);
    }

    private checkGlobalBtns() {
        if (this.globalLock) {
            return;
        }
        this.globalBtns.each((i, btn) => {
            jQuery(btn).trigger('check');
        });
        const ctr = this.globalBtns.first().parent();
        if (this.globalBtns.filter((i, el) => jQuery(el).css('display') !== 'none').length) {
            ctr.show();
        } else {
            ctr.hide();
        }
    }

    private checkField(btns: JQuery<HTMLElement>) {
        if (this.globalLock) {
            return;
        }
        btns.each((i, btn) => {
            jQuery(btn).trigger('check');
        });
        const label = btns.parent().prev();
        if (btns.not(':hidden').length) {
            label.hide();
        } else {
            label.show();
        }
    }

    private checkRemortgageBtn(btn: JQuery<HTMLElement>, field: GameField) {
        const show = this.isBasicChecks(field) &&
            this.state.storage.action_types.has('mortgage') &&
            this.state.storage.action_types.has('unmortgage') &&
            field.mortgaged;
        // debug('check remort', field_id, show, perso, this.state.storage.action_types)
        if (show) {
            if (this.isAlreadyMortgagedOnMove(field) || !this.isEnoughMoneyToUnmortgage(field)) {
                btn.addClass('_disabled');
            } else {
                btn.removeClass('_disabled');
            }
            btn.show();
        } else {
            btn.hide();
        }
    }

    private checkUnmortgageBtn(btn: JQuery<HTMLElement>, field: GameField) {
        const show = this.isBasicChecks(field) &&
            this.state.storage.action_types.has('unmortgage') &&
            field.mortgaged;
        // debug('check unmort', field_id, show, perso, this.state.storage.action_types)
        if (show) {
            if (this.isEnoughMoneyToUnmortgage(field)) {
                btn.removeClass('_disabled');
            } else {
                btn.addClass('_disabled');
            }
            btn.show();
        } else {
            btn.hide();
        }
    }

    private checkMortgageBtn(btn: JQuery<HTMLElement>, field: GameField) {
        const perso = this.base.getPersonalizedMonopolyInfo(this.state.user.user_id, field.group);
        const show = this.isBasicChecks(field) &&
            this.state.storage.action_types.has('mortgage') &&
            !field.mortgaged &&
            field.level === 0 &&
            (void 0 === perso.level_max || 0 === perso.level_max);
        // debug('check mort', field_id, show, perso, this.state.storage.action_types)
        if (show) {
            if (this.isAlreadyMortgagedOnMove(field)) {
                btn.addClass('_disabled');
            } else {
                btn.removeClass('_disabled');
            }
            btn.show();
        } else {
            btn.hide();
        }
    }

    private checkLevelDownBtn(btn: JQuery<HTMLElement>, field: GameField) {
        const perso = this.base.getPersonalizedMonopolyInfo(this.state.user.user_id, field.group);
        const show = this.isBasicChecks(field) &&
            this.state.storage.action_types.has('levelDown') &&
            !field.mortgaged &&
            field.level != 0 &&
            perso.can_build &&
            this.isUnevenCase(field, perso);
        // debug('check lvldown', field_id, show, perso, this.state.storage.action_types)
        if (show) {
            btn.show();
        } else {
            btn.hide();
        }
    }

    private checkLevelUpMaxBtn(btn: JQuery<HTMLElement>, field: GameField) {
        const perso = this.base.getPersonalizedMonopolyInfo(this.state.user.user_id, field.group);
        const show = this.isBasicChecks(field) &&
            this.state.storage.config.UNLIMITED_LEVEL_CHANGE === 2 &&
            this.state.storage.status.round === 2 &&
            this.state.storage.action_types.has('levelUp') &&
            !field.mortgaged &&
            field.levelUpCost !== false &&
            field.level < (field.levels.length - 1) &&
            perso.can_build &&
            this.isUnevenCase(field, perso) &&
            !this.isAlreadyLeveledUpOnMove(field);
        // debug('check lvlup max', field_id, show, perso, this.state.storage.action_types) 
        if (show) {
            btn.show();
            if (this.isEnoughMoneyToLevelUp(field)) {
                btn.removeClass('_disabled');
            } else {
                btn.addClass('_disabled');
            }
        } else {
            btn.hide();
        }
    }

    private checkLevelUpBtn(btn: JQuery<HTMLElement>, field: GameField) {
        const perso = this.base.getPersonalizedMonopolyInfo(this.state.user.user_id, field.group);
        const show = this.isBasicChecks(field) &&
            this.state.storage.action_types.has('levelUp') &&
            !field.mortgaged &&
            field.levelUpCost !== false &&
            field.level < (field.levels.length - 1) &&
            perso.can_build &&
            this.isUnevenCase(field, perso) &&
            !this.isAlreadyLeveledUpOnMove(field);
        // debug('check lvlup', field_id, show, perso, this.state.storage.action_types)
        if (show) {
            btn.show();
            if (this.isEnoughMoneyToLevelUp(field)) {
                btn.removeClass('_disabled');
            } else {
                btn.addClass('_disabled');
            }
        } else {
            btn.hide();
        }
    }

    private isBasicChecks(field: GameField) {
        return this.isFieldOwner(field) &&
            this.isActionField(field) &&
            !this.state.storage.about.is_m1tv;
    }

    private isFieldOwner(field: GameField) {
        return field.owner_true === this.state.user.user_id;
    }

    private isAlreadyMortgagedOnMove(field: GameField) {
        return new Set(this.state.storage.current_move.mortgaged ?? []).has(field.field_id);
    }

    private isAlreadyLeveledUpOnMove(field: GameField) {
        return new Set(this.state.storage.current_move.levelUpped ?? []).has(field.group);
    }

    private isEnoughMoneyToUnmortgage(field: GameField) {
        return this.isEnoughMoney(this.state.getFieldUnmortgage(field));
    }

    private isEnoughMoneyToLevelUp(field: GameField) {
        return this.isEnoughMoney(field.levelUpCost);
    }

    private isEnoughMoney(cost: number | boolean) {
        return this.getThisPlayerState().money >= cost;
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