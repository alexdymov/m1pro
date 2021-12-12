import Vue from 'vue';
import { debug } from '../../util/debug';

declare module 'vue/types/vue' {
    interface Vue {
        contract_ui: Array<{ sum: string }>
        contract: { money_from: number, money_to: number, user_id_from: number }
        is_m1tv: boolean
    }
}

export class TableContract {
    private jq: JQuery<Element>;

    constructor(public base: Vue) {
        this.jq = jQuery(base.$el);
        if (!base.is_m1tv) {
            this.init();
        }
    }

    private init() {
        require('../../style/game/table-contract.less');
        const el = jQuery('<div class="TableContract-content-equality"><div class="_button">= =</div></div>').hide().appendTo(this.jq.get(0))
            .find('div._button').on('click', () => {
                if (this.base.contract.money_from || this.base.contract.money_to) {
                    this.base.contract.money_from = this.base.contract.money_to = 0;
                }
                const [ left, right ] = this.getSums();
                const diff = left - right;
                if (diff > 0) {
                    this.base.contract.money_to += diff;
                } else {
                    this.base.contract.money_from += Math.abs(diff);
                }
            }).end();
        this.base.$watch('contract_ui', v => {
            const [ left, right ] = this.getSums();
            if (left !== right && this.base.contract.user_id_from === window.API.user.user_id) {
                el.show();
            } else {
                el.hide();
            }
        }, { deep: true });
    }

    private getSums(): number[] {
        return this.base.contract_ui.map(ui => Number(ui.sum.replace(new RegExp(/,/, 'g'), '')));
    }
}