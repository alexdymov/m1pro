import Vue from 'vue';
import GameState from '../../components/game-state';
import { debug } from '../../util/debug';

declare module 'vue/types/vue' {
    interface Vue {
        contract_ui: Array<{ sum: string }>
        contract: { money_from: number, money_to: number, user_id_from: number, user_id_to: number, field_ids_from: Array<number>, field_ids_to: Array<number> }
        is_m1tv: boolean
    }
}

export class TableContract {
    private jq: JQuery<Element>;
    private btnCtr: JQuery<HTMLElement>;
    private eqBtn: JQuery<HTMLElement>;
    private x2Btn: JQuery<HTMLElement>;
    private payhelp: JQuery<HTMLElement>;
    private diffhelp: JQuery<HTMLElement>;
    private user = window.API.user.user_id;

    constructor(public base: Vue, private state: GameState) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init() {
        require('../../style/game/table-contract.less');
        this.btnCtr = jQuery('<div class="TableContract-content-buttons"/>').appendTo(this.jq.get(0));
        this.initEqBtn();
        this.initX2Btn();
        this.initPaymentHelper();
        this.base.$watch('contract_ui', v => {
            if (!v) return;
            this.checkEq();
            this.checkX2();
        }, { deep: true });
    }

    private initPaymentHelper() {
        this.payhelp = jQuery('<div class="TableContract-actions-payment"><span>К оплате: <span class="paysum"/></span></div>').prependTo(this.jq.find('div.TableContract-actions'));
        this.diffhelp = jQuery('<div class="TableContract-content-payment"><span class="paydifftext"/>: <span class="paydiff"/><span class="paydiff_withmort"> (с закладом текущих полей <span class="paydifftext_mort"/>: <span class="paydiff_mort"/>)</span></div>').appendTo(this.jq.find('div.TableContract-content'));;
        this.base.$watch('contract_ui', v => {
            if (!v) return;
            const user = this.base.contract.user_id_from;
            const spl = this.state.storage.status.players.find(spl => spl.user_id === user);
            const field = this.state.storage.vms.fields.fields_with_equipment.get(spl.position);
            const money = this.state.storage.current_move.moneyToPay || this.state.storage.current_move.pay || (field && field.owner_true === undefined ? field.buy : 0);
            const plMoney = spl.money;
            if (money && money > 0) {
                this.payhelp.show().find('span.paysum').text(this.state.formatMoney(money)).end();

                const fieldsWorth = this.base.contract.field_ids_to
                    .map(id => this.state.storage.vms.fields.fields_with_equipment.get(id))
                    .map(field => this.state.getFieldMortgageWorth(field)).reduce((a, b) => a + b, 0);
                let diff = plMoney - money + (this.base.contract.money_to || 0) + fieldsWorth;
                this.diffhelp.show().find('span.paydifftext').text(diff >= 0 ? 'Остаток' : 'Нехватка');
                this.showDiff('paydiff', diff);

                if (diff < 0) {
                    this.diffhelp.find('span.paydiff_withmort').show();
                    diff += this.state.getPlayerFieldsWorth(user);
                    this.diffhelp.find('span.paydifftext_mort').text(diff >= 0 ? 'остаток' : 'нехватка');
                    this.showDiff('paydiff_mort', diff);
                } else {
                    this.diffhelp.find('span.paydiff_withmort').hide();
                }
            } else {
                this.payhelp.hide();
                this.diffhelp.hide();
            }
        }, { deep: true });
    }

    private showDiff(cls: string, diff: number) {
        this.diffhelp.find(`span.${cls}`)
            .text(this.state.formatMoney(Math.abs(diff)))
            .addClass(diff >= 0 ? 'diff_pos' : 'diff_neg')
            .removeClass(diff < 0 ? 'diff_pos' : 'diff_neg');
    }

    private checkEq() {
        const [left, right] = this.getSums();
        const outgoing = this.base.contract.user_id_from === this.user;
        const team = this.state.players.find(pl => pl.user_id === this.user).team;
        const toTeammate = this.state.party && this.state.players.find(pl => pl.user_id === this.base.contract.user_id_to).team === team;
        if (!this.base.is_m1tv && left !== right && outgoing && !toTeammate) {
            this.eqBtn.show();
        } else {
            this.eqBtn.hide();
        }
    }

    private checkX2() {
        const [left, right] = this.getSumsX2();
        const outgoing = this.base.contract.user_id_from === this.user;
        const team = this.state.players.find(pl => pl.user_id === this.user).team;
        const toTeammate = this.state.party && this.state.players.find(pl => pl.user_id === this.base.contract.user_id_to).team === team;
        if (!this.base.is_m1tv && (left * 2) !== right && outgoing && !toTeammate) {
            this.x2Btn.show();
        } else {
            this.x2Btn.hide();
        }
    }

    private initEqBtn() {
        this.eqBtn = jQuery('<div class="_button">= =</div>').hide().appendTo(this.btnCtr)
            .on('click', () => {
                if (this.base.contract.money_from || this.base.contract.money_to) {
                    this.base.contract.money_from = this.base.contract.money_to = 0;
                }
                const [left, right] = this.getSums();
                const diff = left - right;
                if (diff > 0) {
                    this.base.contract.money_to += diff;
                } else {
                    this.base.contract.money_from += Math.abs(diff);
                }
            });
    }

    private initX2Btn() {
        this.x2Btn = jQuery('<div class="_button">x2</div>').hide().appendTo(this.btnCtr)
            .on('click', () => {
                if (this.base.contract.money_from || this.base.contract.money_to) {
                    this.base.contract.money_from = this.base.contract.money_to = 0;
                }
                const [left, right] = this.getSumsX2();
                const diff = left - right;
                if (diff > 0) {
                    this.base.contract.money_to += diff;
                } else {
                    this.base.contract.money_from += Math.abs(diff);
                }
            });
    }

    private getSums(): number[] {
        return this.base.contract_ui.map(ui => Number(ui.sum.replace(new RegExp(/,/, 'g'), '')));
    }

    private getSumsX2(): number[] {
        return this.base.contract_ui.map(ui => Number(ui.sum.replace(new RegExp(/,/, 'g'), '')) * 2);
    }
}