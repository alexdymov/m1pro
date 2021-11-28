import GameState from '../../../components/game-state';
import Vue from 'vue';
import { debug } from '../../../util/debug';

declare module 'vue/types/vue' {
    interface Vue {
        is_hidden: boolean
        action_types: Set<string>
        action: (event: PointerEvent, type: string, s: any) => void
        current_move: {
            field?: number
            levelUpped?: Array<number>
        }
    }
}

export class TableAction {
    private lastReq = 0;
    private lastAct = 0;

    constructor(private base: Vue, private state: GameState) {
        require('../../../style/game/table-action.less');
        state.$watch('loaded', () => {
            this.init();
        });
    }

    private init() {
        this.base.$watch('is_hidden', (val) => {
            if (!val) {
                const prev = this.lastReq;
                this.lastReq = new Date().getTime();
                const par = this.base.$parent;
                // debug(par)
                const locked = this.state.lockedFields.has(par.current_move?.field);
                debug('actions', par.action_types, par.current_move?.field, locked);
                
                if (par.action_types.has('toAuction') && locked) {
                    this.perform('toAuction', par);
                }
                if (par.action_types.has('auctionDecline') && locked) {
                    this.perform('auctionDecline', par);
                    
                }
            }
        })
    }

    private perform(act: string, par: Vue) {
        if (this.lastReq - this.lastAct > 1000) {
            setTimeout(() => {
                this.lastAct = new Date().getTime();
                debug('performing act', par.action_types, this.lastAct, this.lastReq);
                this.base.action(new PointerEvent(''), act, {});
                this.base.is_hidden = true;
            }, 100);
        } else {
            debug('prevented repeat', par.action_types, this.lastAct, this.lastReq);
        }
    }
}