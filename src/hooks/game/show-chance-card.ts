import Vue from 'vue';
import GameState from '../../components/game-state';
import { CurrentChanceCard } from '../../shared/beans';
import { debug } from '../../util/debug';

export class ShowChanceCard {
    private jq: JQuery<Element>;
    private fjqs: JQuery<HTMLElement>;

    constructor(public base: Vue, private state: GameState) {
        this.jq = jQuery(base.$el);
        state.$watch('usersLoaded', () => {
            this.init();
        });
    }

    private init() {
        require('../../style/game/show-chance-card.less');
        this.fjqs = jQuery('div.table-body-board-fields-one');
        this.fjqs.filter('[mnpl-special="1"]').find('div.table-body-board-fields-one-body').wrap('<div class="table-body-board-fields-one-wrap" />').parent()/* .on('click', function (e) {
            e.stopPropagation();
            const parent = $(this);
            if (!parent.is(':has(div.table-body-board-fields-one-back)')) {
                parent.append(jQuery('<div class="table-body-board-fields-one-back"/>').append('<div class="_logo teleport"/>'));
            }
            parent.toggleClass('active');
        }) */;
        this.state.$watch('currentChanceCards', (cards: Array<CurrentChanceCard>) => {
            debug('cur chance cards', JSON.parse(JSON.stringify(cards)));
            cards.forEach(card => {
                const field = this.fjqs.eq(card.fieldId);
                const back = jQuery('<div class="table-body-board-fields-one-back"/>').appendTo(field.find('div.table-body-board-fields-one-wrap'));
                switch (card.card.type) {
                    case 'teleport':
                        back.append('<div class="_logo teleport"/>');
                        break;
                    case 'jail':
                        back.append('<div class="_logo jail"/>');
                        break;
                    case 'cash_in':
                        back.append(`<span class="profit_pos ion-social-usd _text">+${card.sum}</span>`);
                        break;
                    case 'birthday':
                        back.append(`<span class="profit_pos ion-social-usd _text">+${card.sum * (this.state.storage.status.players.filter(pl => pl.status !== -1).length - 1)}</span>`);
                        break;
                    case 'cash_out':
                        back.append(`<span class="profit_neg ion-social-usd _text">-${card.sum}</span>`);
                        break;
                    case 'insurance':
                        back.append(`<span class="profit_neg ion-social-usd _text">-${card.sum}</span>`);
                        break;
                    case 'repair':
                        back.append(`<span class="profit_neg ion-social-usd _text">-${card.sum}</span>`);
                        break;
                    case 'move_skip':
                        back.append('<span class="ion-pause"/>');
                        break;
                    case 'reverse':
                        back.append('<span class="ion-ios-rewind"/>');
                        break;
                    case 'fields_disaster':
                        back.append('<span class="nuclear"/>');
                        break;
                }
                // back.append('<div class="ion-ios-rewind"/>');
                field.find('div.table-body-board-fields-one-wrap').addClass('active');
            });
            if (cards.length) {
                cards.splice(0, cards.length);
            }
        });
        this.state.$watch('storage.is_events_processing', p => {
            if (!p) {
                const toRemove = this.fjqs.find('.active').removeClass('active').find('div.table-body-board-fields-one-back');
                setTimeout(() => {
                    toRemove.remove();
                }, 600);
            }
        })
    }
}