import Vue from 'vue';
import MainState from '../../components/main-state';
import { debug } from '../../util/debug';
import info from '../../components/info';

type Handler = () => void;
class Item {
    constructor(
        public tooltip: string,
        public icon: string,
        public hrefOrClick: string | Handler,
        public badger?: () => JQuery<HTMLElement>
    ) { }
}

export class HeaderMenu {
    private jq: JQuery<Element>;
    private verBadge: JQuery<HTMLElement>;

    constructor(public base: Vue | { $el: HTMLElement }, private state: MainState) {
        this.jq = jQuery(base.$el).parent();
        this.init();
    }

    private init(): void {
        require('../../style/main/header.less');

        const signed = window.API.isUserSignedIn();
        const rightctr = this.jq.find('div.header-right');
        [
            new Item('Маркет', 'ion-ios-cart', '/market', () => jQuery('<span class="badge" />').hide()),
            signed ? new Item('Друзья', 'ion-ios-people', '/friends', () => this.findBadge('friends')) : [],
            signed ? new Item('Инвентарь', 'ion-bag', '/inventory') : [],
            new Item('M1TV', 'ion-monitor', '/m1tv', () => this.findBadge('m1tv')),
            new Item('Поиск игр', 'ion-ios-game-controller-b', '/games'),
        ].flat().forEach(it => rightctr.prepend(this.newItem('header-right-one', it)));

        this.verBadge = jQuery('<div class="badge">1</div>').hide();
        const infoItem = new Item('Информация', 'ion-information-circled', () => window.require("/js/dialog.js").showComponent(info(this.state)), () => this.verBadge);
        if (!signed) {
            setTimeout(() => {
                jQuery('.header-auth div.button').removeClass('button').removeClass('button-grass').text('').addClass('ion-log-in').addClass('header-user-one')
                    .parent().addClass('header-user-new').attr('kd-tooltip', 'Войти').append(this.newItem('header-user-one', infoItem));
            }, 1);
        } else {
            const userctr = jQuery('<div class="header-user-new"/>').appendTo('.header > .widther');
            [
                new Item('Обмены', 'ion-shuffle', '/trades', () => this.findBadge('inventory')),
                new Item('Кошелек', 'ion-social-usd', '/wallet'),
                new Item('Настройки', 'ion-gear-b', '/settings'),
                infoItem,
                // new Item('Выйти', 'ion-log-out', '/'),
            ].forEach(it => userctr.append(this.newItem('header-user-one', it)));
        }

        jQuery('.header-right-one._search').attr('kd-tooltip', 'Поиск игроков');
        jQuery('.header-right-one._im').attr('kd-tooltip', 'Чат');

        this.state.$watch('lastSeen', () => this.checkVersion(), { immediate: true });
        this.state.$watch('lots', () => this.showLots(), { immediate: true });
    }

    private newItem(cls: string, it: Item): JQuery<HTMLElement> {
        const inner = jQuery(`<div class="${cls} ${it.icon}" kd-tooltip="${it.tooltip}" />`);
        if (it.badger) {
            inner.append(it.badger());
        }
        const item = typeof it.hrefOrClick === 'string' ?
            jQuery(`<a href="${it.hrefOrClick}" class="header-link" />`) :
            jQuery('<div class="header-link"/>').on('click', <Handler>it.hrefOrClick);
        item.append(inner);
        return item;
    }

    private showLots() {
        const badge = jQuery('.header-right .ion-ios-cart span.badge');
        if (this.state.lots?.count) {
            badge.show().text(this.state.lots.count);
        } else {
            badge.hide();
        }
    }

    private findBadge(link: string): JQuery<HTMLElement> {
        return jQuery(`.header-menu a[href="/${link}"] span`).clone();
    }

    private checkVersion() {
        this.state.isUnseen(VERSION) ? this.verBadge.show() : this.verBadge.hide();
    }
}