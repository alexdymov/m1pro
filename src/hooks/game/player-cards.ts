import GameState from "../../components/game-state";
import { debug } from '../../util/debug';
import { GamePlayer, Friendship, Gender } from '../../shared/beans';

export class PlayerCards {
    constructor(private state: GameState) {
        require('../../style/game/player-card.less');
        state.$watch('loaded', () => {
            this.init();
        });
    }

    private init() {
        const cards = jQuery('div.table-body-players-card').mnpl('opened', '1');
        cards.each((i, el) => this.initCard(jQuery(el)));

        this.state.$watch('storage.status.round', () => {
            this.state.storage.status.players.forEach((spl, i) => {
                if (spl.can_use_credit && spl.status === 0) {
                    // debug('round credit')
                    this.changeCreditStatus(spl, jQuery(`#player_card_${spl.user_id} div.table-body-players-card-body-credit`));
                }
            });
        });
        this.state.$watch('storage.status', () => {
            this.state.players.forEach((pl, i) => {
                jQuery(`#player_card_${pl.user_id} div.table-body-players-card-body-assets-worth`).text(this.state.getAssetsWorth(pl.user_id));
                jQuery(`#player_card_${pl.user_id} div.table-body-players-card-body-share-worth`).text(this.state.getShareableWorth(pl.user_id));
            })
        });
        this.state.$watch('usersLoaded', () => {
            cards.each((i, el) => this.updateCard(jQuery(el)));
        });
        if (this.state.party) {
            const vs = jQuery('div.table-body-players-vs').append('<div class="table-body-team" mnpl-team="0"><span class="ion-ios-cart"/></div><div class="table-body-team" mnpl-team="1"><span class="ion-ios-cart"/></div>');
            this.state.$watch('storage.status', () => {
                this.updateTeams(vs);
            });
            this.updateTeams(vs);
        }
    }

    private updateTeams(vs: JQuery<HTMLElement>) {
        vs.find('div[mnpl-team="0"] span').text(this.state.getTeamWorth(0));
        vs.find('div[mnpl-team="1"] span').text(this.state.getTeamWorth(1));
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

        const extra = jQuery('<div class="table-body-players-card-body-extra"/>').appendTo(body).hide();
        const extraBtn = jQuery('<div class="table-body-players-card-body-show-extra ion-plus-circled"/>').appendTo(body).hide();
        let score: JQuery<HTMLElement>;
        extra.append(
            score = jQuery('<div class="table-body-players-card-body-score ion-scissors"/>').text('0'),
            jQuery('<div class="table-body-players-card-body-games ion-stats-bars"/>'),
            jQuery('<div class="table-body-players-card-body-winrate ion-pie-graph"/>')
        );
        extraBtn.on('mouseenter', () => {
            extra.show();
            stats.hide();
        });
        extraBtn.on('mouseleave', () => {
            extra.hide();
            stats.show();
        });

        const order = Number(card.mnpl('order'));
        const idx = this.state.players.findIndex(pl => pl.order === order);
        const pl = this.state.players[idx];
        card.find('div._nick, div.table-body-players-card-body-avatar > div, div.table-body-players-card-body-timer')
            .on('click', () => window.PageNavigation.openInNewTab(`/profile/${pl.user_id}`));

        const spl = this.state.storage.status.players[idx];
        if (spl.status === 0) {
            share.text(this.state.getShareableWorth(spl.user_id)).show();
            assets.text(this.state.getAssetsWorth(spl.user_id)).show();
            extraBtn.show();
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
                [credit, share, assets, extraBtn].forEach(jq => jq.hide());
            }
        });
        this.state.$watch(`storage.status.players.${idx}.score`, (val: number) => {
            score.text(this.state.formatMoney(val));
        });
    }

    private updateCard(card: JQuery<HTMLElement>) {
        const order = Number(card.mnpl('order'));
        const pl = this.state.players.find(pl => pl.order === order);
        card.find('div.table-body-players-card-body').append(
            jQuery('<div class="table-body-players-card-body-info"/>').append(
                pl.rank?.pts && jQuery('<span class="rank ion-connection-bars" />').text(pl.rank?.pts),
                pl.mfp_ban_history && jQuery('<span class="mfp ion-android-sad" />').text(pl.mfp_ban_history.count),
                pl.friendship === Friendship.Active && jQuery('<span class="friends ion-ios-people" />'),
                jQuery('<span class="gender" />').addClass(pl.gender === Gender.Male ? 'ion-male' : 'ion-female'),
            )
        )
        card.find('div.table-body-players-card-body-games').text(`${pl.games}/${pl.wins}`);
        card.find('div.table-body-players-card-body-winrate').text(`${pl.winrate}%`);
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