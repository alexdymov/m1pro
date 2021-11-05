import GameState from "../../components/game-state";
import { debug } from '../../util/debug';
import { GamePlayer } from '../../shared/beans';

export class PlayerCards {
    private showShare = false;

    constructor(private state: GameState) {
        require('../../style/game/player-card.less');
        state.$watch('loaded', () => {
            this.init();
        });
    }

    private init() {
        this.showShare = this.state.party;
        
        jQuery('div.table-body-players-card').mnpl('opened', '1').each((i, el) => this.initCard(jQuery(el)));

        this.state.$watch('storage.status.round', () => {
            this.state.storage.status.players.forEach((spl, i) => {
                if (spl.can_use_credit && spl.status === 0) {
                    // debug('round credit')
                    this.changeCreditStatus(spl, jQuery(`#player_card_${spl.user_id} div.table-body-players-card-body-credit`));
                }
            });
        })
        this.state.$watch('storage.status', () => {
            this.state.players.forEach((pl, i) => {
                jQuery(`#player_card_${pl.user_id} div.table-body-players-card-body-assets-worth`).text(this.state.getAssetsWorth(pl.user_id));
                if (this.showShare) {
                    jQuery(`#player_card_${pl.user_id} div.table-body-players-card-body-share-worth`).text(this.state.getShareableWorth(pl.user_id));
                }
            })
        })
    }

    private initCard(card: JQuery<HTMLElement>) {
        const body = card.find('div.table-body-players-card-body');

        const circle = jQuery('<div class="table-body-players-card-body-circle"/>').prependTo(body);
        circle.append(
            card.find('div.table-body-players-card-body-avatar').detach(),
            card.find('div.table-body-players-card-body-timer').detach()
        );

        const stats = jQuery('<div class="table-body-players-card-body-stats"/>').appendTo(body);
        let [credit, share, assets]: JQuery<HTMLElement>[] = [];
        stats.append(
            card.find('div.table-body-players-card-body-money').detach().addClass('ion-social-usd'),
            assets = jQuery('<div class="table-body-players-card-body-assets-worth ion-bag"/>').hide(),
            share = jQuery('<div class="table-body-players-card-body-share-worth ion-ios-cart"/>').hide(),
            credit = jQuery('<div class="table-body-players-card-body-credit ion-card"><span/><div class="avail"/></div>').hide()
        );

        const order = Number(card.mnpl('order'));
        const idx = this.state.players.findIndex(pl => pl.order === order);
        const pl = this.state.players[idx];
        card.find('div._nick, div.table-body-players-card-body-avatar > div, div.table-body-players-card-body-timer')
            .on('click', () => window.PageNavigation.openInNewTab(`/profile/${pl.user_id}`));

        const spl = this.state.storage.status.players[idx];
        if (spl.status === 0) {
            this.showShare && share.text(this.state.getShareableWorth(spl.user_id)).show();
            assets.text(this.state.getAssetsWorth(spl.user_id)).show();
            if (spl.can_use_credit) {
                // debug('credit init');
                this.changeCreditStatus(spl, credit);
                credit.show();
            }
        }
        this.state.$watch(`storage.status.players.${idx}.credit_toPay`, (val) => {
            // debug('credit_toPay', val)
            this.changeCreditStatus(spl, credit);
        });
        this.state.$watch(`storage.status.players.${idx}.status`, (status: number) => {
            if (status === -1) {
                [credit, share, assets].forEach(jq => jq.hide());
            }
        });
    }

    private changeCreditStatus(spl: GamePlayer, jq: JQuery<HTMLElement>) {
        const pay = spl.credit_payRound;
        // debug(spl.user_id, spl.credit_payRound, spl.credit_nextTakeRound, this.state.storage.status.round);
        const roundLeft = <number>(pay ? spl.credit_payRound : spl.credit_nextTakeRound) - this.state.storage.status.round;
        // debug(roundLeft)
        const status = jq.find('div');
        if (pay) {
            status.removeClass('ion-close-circled').removeClass('ion-plus-circled').addClass('ion-arrow-return-left');
        } else {
            status.addClass(roundLeft > 0 ? 'ion-close-circled' : 'ion-plus-circled');
        }
        const postfix = this.getRoundsPostfix(roundLeft);
        jq.find('span').text(roundLeft > 0 ? `${roundLeft} раунд${postfix}` : (roundLeft === 0 ? 'уже' : ''));
    }

    private getRoundsPostfix(roundsLeft: number) {
        return roundsLeft < 5 && roundsLeft ? roundsLeft != 1 ? 'а' : '' : 'ов';
    }
}